// tmm-landing-page: static site (ASSETS) + the field-view production API.
//   GET  /api/progress/<job>  -> { job, marks:[...] }            public, like the page
//   POST /api/progress/<job>  { pin, ops:[{add:[mark]},{del:[id]}] } -> { job, marks }
// Crew PINs live in the CREW_PINS secret ({"job":"pin"}), never in the page.
//   GET  /stats?key=<STATS_KEY>  private visit counter (worker/stats.js); wrong/missing key = 404
//   /api/lead/publish...  jobs a company sends from its TMM app ("Send to The Lead", worker/lead.js)
//   /view/<slug>/...  hand-made locked jobs (private.js), app-published jobs (lead.js, R2 + D1, always
//                     behind a passcode), else the public static job folders exactly as before
import { shouldCount, countView, stats } from './stats.js';
import { gate } from './private.js';
import { leadApi, serveLead } from './lead.js';
const MAX_BODY = 65536, MAX_OPS = 100, MAX_ITEMS = 400, MAX_MARKS = 5000, LOCK_N = 10, LOCK_MS = 15 * 60 * 1000;

function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}
function pins(env) { try { const p = JSON.parse(env.CREW_PINS || '{}'); return p && typeof p === 'object' ? p : {}; } catch (e) { return {}; } }
function same(a, b) {   // constant-time-ish compare
  a = String(a); b = String(b); let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
const isStr = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
const isNum = v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e6;
function cleanMark(m) {
  if (!m || typeof m !== 'object') return null;
  if (!isStr(m.id, 40) || !/^[A-Za-z0-9_-]{6,40}$/.test(m.id)) return null;
  if (!isStr(m.g, 60)) return null;
  if (!Number.isInteger(m.l) || m.l < 0 || m.l > 200) return null;
  if (!['B', 'R', 'G'].includes(m.t)) return null;
  if (!isStr(m.d, 32) || !/^\d{4}-\d{2}-\d{2}/.test(m.d)) return null;
  const out = { id: m.id, g: m.g, l: m.l, t: m.t, d: m.d };
  if (m.n !== undefined && m.n !== null && m.n !== '') { if (!isStr(m.n, 40)) return null; out.n = m.n; }
  if (m.r !== undefined && m.r !== null) {
    if (!Array.isArray(m.r) || m.r.length < 1 || m.r.length > 40) return null;
    out.r = [];
    for (const x of m.r) {
      if (!Array.isArray(x) || x.length !== 3 || !isStr(x[0], 24) || !isNum(x[1]) || !isNum(x[2])) return null;
      out.r.push([x[0], x[1], x[2]]);
    }
  }
  return out;
}
async function list(env, job) {
  const r = await env.PROGRESS.prepare('SELECT body FROM marks WHERE job = ? ORDER BY created, id').bind(job).all();
  return (r.results || []).map(x => { try { return JSON.parse(x.body); } catch (e) { return null; } }).filter(Boolean);
}

async function progress(req, env, job) {
  const pinMap = pins(env);
  if (!Object.prototype.hasOwnProperty.call(pinMap, job)) return json({ error: 'unknown job' }, 404);
  if (req.method === 'GET' || req.method === 'HEAD') return json({ job, marks: await list(env, job) });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const len = +(req.headers.get('content-length') || 0);
  if (len > MAX_BODY) return json({ error: 'too large' }, 413);
  const text = await req.text();
  if (text.length > MAX_BODY) return json({ error: 'too large' }, 413);
  let body; try { body = JSON.parse(text); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'bad body' }, 400);

  const ip = req.headers.get('cf-connecting-ip') || 'x', fk = job + '|' + ip, now = Date.now();
  const f = await env.PROGRESS.prepare('SELECT n, ts FROM pinfail WHERE k = ?').bind(fk).first();
  if (f && f.n >= LOCK_N && now - f.ts < LOCK_MS) return json({ error: 'locked' }, 429);
  if (typeof body.pin !== 'string' || !same(body.pin, pinMap[job])) {
    const n = f && now - f.ts < LOCK_MS ? f.n + 1 : 1;
    await env.PROGRESS.prepare('INSERT INTO pinfail (k, n, ts) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET n = excluded.n, ts = excluded.ts').bind(fk, n, now).run();
    return json({ error: 'pin' }, 403);
  }
  if (f) await env.PROGRESS.prepare('DELETE FROM pinfail WHERE k = ?').bind(fk).run();

  const ops = body.ops;
  if (!Array.isArray(ops) || ops.length > MAX_OPS) return json({ error: 'bad ops' }, 400);
  const stmts = []; let items = 0, adds = 0;
  for (const op of ops) {
    if (!op || typeof op !== 'object') return json({ error: 'bad op' }, 400);
    for (const id of op.del || []) {
      if (!isStr(id, 40)) return json({ error: 'bad id' }, 400);
      stmts.push(env.PROGRESS.prepare('DELETE FROM marks WHERE job = ? AND id = ?').bind(job, id)); items++;
    }
    for (const m of op.add || []) {
      const c = cleanMark(m); if (!c) return json({ error: 'bad mark' }, 400);
      stmts.push(env.PROGRESS.prepare('INSERT OR REPLACE INTO marks (job, id, body, created) VALUES (?, ?, ?, ?)').bind(job, c.id, JSON.stringify(c), now + items)); items++; adds++;
    }
    if (items > MAX_ITEMS) return json({ error: 'too many' }, 400);
  }
  if (adds) {
    const c = await env.PROGRESS.prepare('SELECT COUNT(*) AS n FROM marks WHERE job = ?').bind(job).first();
    if (c && c.n + adds > MAX_MARKS) return json({ error: 'job full' }, 400);
  }
  if (stmts.length) await env.PROGRESS.batch(stmts);
  return json({ job, marks: await list(env, job) });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/lead/')) {
      try { const r = await leadApi(req, env, url, ctx); if (r) return r; } catch (e) { return json({ error: 'server' }, 500); }
    }
    if (url.pathname.startsWith('/api/')) {
      const m = /^\/api\/progress\/([a-z0-9-]{1,40})\/?$/.exec(url.pathname);
      if (!m) return json({ error: 'not found' }, 404);
      try { return await progress(req, env, m[1]); } catch (e) { return json({ error: 'server' }, 500); }
    }
    if (url.pathname === '/stats' || url.pathname === '/stats/') return stats(req, env, url);
    const locked = await gate(req, url);
    if (locked) return locked;
    let res = null;
    // a D1 / R2 hiccup must never take the public job folders down: fall through to the static files
    if (url.pathname.startsWith('/view/')) { try { res = await serveLead(req, env, url); } catch (e) { res = null; } }
    if (!res) res = await env.ASSETS.fetch(req);
    // Page views: only GET 200 text/html counts (stats.js shouldCount); /view/* data files reach the
    // Worker too now (wrangler.jsonc run_worker_first) but are never counted.
    try { if (shouldCount(req, res)) ctx.waitUntil(countView(req, env, url)); } catch (e) { /* never break a page */ }
    return res;
  }
};
