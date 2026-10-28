// "Send to The Lead": jobs a company publishes from its own TMM app, kept in R2 + D1.
//
// Publishing (TMM app -> here), with the company's publish key (Authorization: Bearer <key>; D1 keeps
// only sha256(key) in lead_keys, one row per company):
//   PUT    /api/lead/publish/<slug>/<ver>/<file>   one file, streamed to R2 view/<slug>/<ver>/<file>
//          (x-tmm-sha256: hex of the body; R2 refuses a body that doesn't match)
//   POST   /api/lead/publish   {slug, ver, title, code_hash, cookie_hash, files:{name:{size, sha256}}}
//          checks every file landed whole, then points the job at <ver> in one D1 write (the phone
//          never sees half a job) and clears versions older than the one before it.
//   DELETE /api/lead/publish/<slug>   takes the job down (its files are deleted; the slug stays the company's).
// A slug is the company's that first published it; another key gets 403. The passcode itself never
// comes here: the app sends sha256("<slug>:<CODE>") and sha256(sha256("ck:<slug>:<CODE>")), the same two
// hashes worker/private.js keeps for the hand-made locked jobs.
//
// Serving: /view/<slug>/ and its files for a published job go through the same passcode check
// (private.js passCheck: same form, same cookie, same 303), plus a wrong-code limit (10 per 15 minutes per
// job and address, then 429). The page is the Lead page bundled with this Worker (worker/lead_page.html);
// the data files come from R2. Published jobs are never listed anywhere and always need the passcode.
import { passCheck, sha256, isHandMade } from './private.js';
import PAGE from './lead_page.html';

export const FILES = {
  'meta.json': 'application/json; charset=utf-8',
  'blocks.b64.txt': 'text/plain; charset=utf-8',
  'rebar.b64.txt': 'text/plain; charset=utf-8',
  'model.usdz': 'model/vnd.usdz+zip',
};
const REQUIRED = ['meta.json', 'blocks.b64.txt'];
export const MAX_FILE = 95 * 1024 * 1024;          // a Worker request body is capped at 100 MB (Free/Pro)
const SLUG_RE = /^[a-z0-9]{12,40}$/, VER_RE = /^[a-z0-9]{8,32}$/, HEX64 = /^[0-9a-f]{64}$/;
const TRY_N = 10, TRY_MS = 15 * 60 * 1000;
const NOINDEX = { 'x-robots-tag': 'noindex, nofollow, noarchive', 'referrer-policy': 'no-referrer' };

function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...NOINDEX } });
}
const hex = buf => buf ? [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('') : '';

// The company a publish key belongs to, or null. Only sha256(key) is stored.
async function companyOf(req, env) {
  const m = /^Bearer ([A-Za-z0-9_-]{32,200})$/.exec(req.headers.get('authorization') || '');
  if (!m) return null;
  const r = await env.PROGRESS.prepare('SELECT company FROM lead_keys WHERE key_hash = ? AND revoked = 0').bind(await sha256(m[1])).first();
  return r ? r.company : null;
}

async function jobRow(env, slug) {
  return env.PROGRESS.prepare('SELECT slug, company, code_hash, cookie_hash, ver, files, removed FROM lead_jobs WHERE slug = ?').bind(slug).first();
}

// May `company` write `slug`? 'ok' (its own, or free), 'taken' (another company's), 'reserved' (a site job).
async function claim(env, url, company, slug) {
  const row = await jobRow(env, slug);
  if (row) return row.company === company ? 'ok' : 'taken';
  if (isHandMade(slug)) return 'reserved';
  // a public job folder in the site's static files keeps its slug
  const r = await env.ASSETS.fetch(new Request(url.origin + '/view/' + slug + '/meta.json', { method: 'HEAD' }));
  return r.status === 200 ? 'reserved' : 'ok';
}

async function putFile(req, env, url, company, slug, ver, file) {
  if (!FILES[file]) return json({ error: 'file' }, 400);
  const len = +(req.headers.get('content-length') || -1);
  if (!(len >= 0)) return json({ error: 'length required' }, 411);
  if (len > MAX_FILE) return json({ error: 'too large' }, 413);
  const sum = (req.headers.get('x-tmm-sha256') || '').toLowerCase();
  if (!HEX64.test(sum)) return json({ error: 'checksum' }, 400);
  const c = await claim(env, url, company, slug);
  if (c !== 'ok') return json({ error: c }, c === 'taken' ? 403 : 409);
  try {
    await env.LEAD.put(`view/${slug}/${ver}/${file}`, req.body, { httpMetadata: { contentType: FILES[file] }, sha256: sum, customMetadata: { company } });
  } catch (e) {
    return json({ error: 'upload', detail: String(e && e.message || e).slice(0, 200) }, 400);
  }
  return json({ ok: true, file, size: len });
}

async function finish(req, env, url, ctx, company) {
  const len = +(req.headers.get('content-length') || 0);
  if (len > 65536) return json({ error: 'too large' }, 413);
  let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (!b || typeof b !== 'object') return json({ error: 'bad body' }, 400);
  const { slug, ver, code_hash, cookie_hash } = b;
  const title = typeof b.title === 'string' ? b.title.slice(0, 200) : '';
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) return json({ error: 'slug' }, 400);
  if (typeof ver !== 'string' || !VER_RE.test(ver)) return json({ error: 'ver' }, 400);
  if (!HEX64.test(String(code_hash)) || !HEX64.test(String(cookie_hash))) return json({ error: 'passcode' }, 400);
  const files = b.files && typeof b.files === 'object' ? b.files : null;
  if (!files) return json({ error: 'files' }, 400);
  const names = Object.keys(files);
  if (names.some(n => !FILES[n]) || REQUIRED.some(n => !names.includes(n))) return json({ error: 'files' }, 400);
  const c = await claim(env, url, company, slug);
  if (c !== 'ok') return json({ error: c }, c === 'taken' ? 403 : 409);
  // every file is there, whole, in this version
  const kept = {};
  for (const n of names) {
    const f = files[n] || {};
    const o = await env.LEAD.head(`view/${slug}/${ver}/${n}`);
    if (!o) return json({ error: 'missing', file: n }, 409);
    if (o.size !== f.size || hex(o.checksums && o.checksums.sha256) !== String(f.sha256 || '').toLowerCase()) return json({ error: 'mismatch', file: n }, 409);
    kept[n] = { size: o.size, sha256: hex(o.checksums.sha256) };
  }
  const prev = await jobRow(env, slug);
  const now = Date.now();
  const r = await env.PROGRESS.prepare(
    `INSERT INTO lead_jobs (slug, company, title, code_hash, cookie_hash, ver, prev_ver, files, created, updated, publishes, removed)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, '', ?7, ?8, ?8, 1, 0)
     ON CONFLICT(slug) DO UPDATE SET title = excluded.title, code_hash = excluded.code_hash, cookie_hash = excluded.cookie_hash,
       prev_ver = lead_jobs.ver, ver = excluded.ver, files = excluded.files, updated = excluded.updated,
       publishes = lead_jobs.publishes + 1, removed = 0
     WHERE lead_jobs.company = excluded.company`)
    .bind(slug, company, title, code_hash, cookie_hash, ver, JSON.stringify(kept), now).run();
  if (!r.meta || !r.meta.changes) return json({ error: 'taken' }, 403);
  // keep this version and the one before it (a phone part way through a download); clear the rest
  const keep = new Set([ver, prev && !prev.removed ? prev.ver : '']);
  ctx.waitUntil(sweep(env, slug, keep).catch(() => {}));
  return json({ ok: true, slug, ver, url: `${url.origin}/view/${slug}/`, files: kept, first: !prev });
}

async function sweep(env, slug, keep) {
  let cursor;
  do {
    const l = await env.LEAD.list({ prefix: `view/${slug}/`, cursor });
    const gone = l.objects.map(o => o.key).filter(k => !keep.has(k.split('/')[2]));
    if (gone.length) await env.LEAD.delete(gone);
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
}

async function takeDown(env, url, ctx, company, slug) {
  const row = await jobRow(env, slug);
  if (!row) return json({ error: 'not found' }, 404);
  if (row.company !== company) return json({ error: 'taken' }, 403);
  await env.PROGRESS.prepare('UPDATE lead_jobs SET removed = 1, updated = ? WHERE slug = ? AND company = ?').bind(Date.now(), slug, company).run();
  ctx.waitUntil(sweep(env, slug, new Set()).catch(() => {}));
  return json({ ok: true, slug, removed: true });
}

// /api/lead/... (the TMM app's publish calls). Returns a Response, or null for any other /api/ path.
export async function leadApi(req, env, url, ctx) {
  if (!url.pathname.startsWith('/api/lead/publish')) return null;
  if (!env.LEAD) return json({ error: 'not set up' }, 503);
  const company = await companyOf(req, env);
  if (!company) return json({ error: 'key' }, 401);
  if (url.pathname === '/api/lead/publish' || url.pathname === '/api/lead/publish/') {
    return req.method === 'POST' ? finish(req, env, url, ctx, company) : json({ error: 'method' }, 405);
  }
  let m = /^\/api\/lead\/publish\/([a-z0-9]{12,40})\/([a-z0-9]{8,32})\/([a-z0-9.]{1,32})$/.exec(url.pathname);
  if (m) return req.method === 'PUT' ? putFile(req, env, url, company, m[1], m[2], m[3]) : json({ error: 'method' }, 405);
  m = /^\/api\/lead\/publish\/([a-z0-9]{12,40})\/?$/.exec(url.pathname);
  if (m) return req.method === 'DELETE' ? takeDown(env, url, ctx, company, m[1]) : json({ error: 'method' }, 405);
  return json({ error: 'not found' }, 404);
}

// Wrong-code limit for one published job, per address.
function triesFor(env, slug, req) {
  const k = 'lead|' + slug + '|' + (req.headers.get('cf-connecting-ip') || 'x');
  return {
    async locked() {
      const f = await env.PROGRESS.prepare('SELECT n, ts FROM lead_tries WHERE k = ?').bind(k).first();
      return !!(f && f.n >= TRY_N && Date.now() - f.ts < TRY_MS);
    },
    async failed() {
      const now = Date.now();
      const f = await env.PROGRESS.prepare('SELECT n, ts FROM lead_tries WHERE k = ?').bind(k).first();
      const n = f && now - f.ts < TRY_MS ? f.n + 1 : 1;
      await env.PROGRESS.prepare('INSERT INTO lead_tries (k, n, ts) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET n = excluded.n, ts = excluded.ts').bind(k, n, now).run();
    },
    async cleared() { await env.PROGRESS.prepare('DELETE FROM lead_tries WHERE k = ?').bind(k).run(); },
  };
}

// /view/<slug>/... for a published job: the passcode check, then the page or one of its files.
// null = not a published job (the hand-made locked jobs and the public folders are served as before).
export async function serveLead(req, env, url) {
  const m = /^\/view\/([a-z0-9]{12,40})(?:\/(.*))?$/.exec(url.pathname);
  if (!m || isHandMade(m[1]) || !env.LEAD) return null;
  const slug = m[1];
  const job = await jobRow(env, slug);
  if (!job || job.removed) return null;
  const locked = await passCheck(req, url, slug, job.code_hash, job.cookie_hash, triesFor(env, slug, req));
  if (locked) return locked;
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD', 'cache-control': 'no-store', ...NOINDEX } });
  const tail = m[2] === undefined ? null : m[2];
  if (tail === null) return new Response(null, { status: 308, headers: { location: `/view/${slug}/`, 'cache-control': 'no-store' } });
  if (tail === '' || tail === 'index.html') {
    return new Response(req.method === 'HEAD' ? null : PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...NOINDEX } });
  }
  let files = {}; try { files = JSON.parse(job.files || '{}'); } catch (e) { files = {}; }
  if (!FILES[tail] || !files[tail]) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store', ...NOINDEX } });
  const key = `view/${slug}/${job.ver}/${tail}`;
  const o = req.method === 'HEAD' ? await env.LEAD.head(key) : await env.LEAD.get(key, { onlyIf: req.headers });
  if (!o) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store', ...NOINDEX } });
  const h = new Headers({ 'content-type': FILES[tail], 'cache-control': 'private, no-cache', etag: o.httpEtag, ...NOINDEX });
  h.set('content-length', String(o.size));
  if (req.method === 'HEAD') return new Response(null, { headers: h });
  if (!('body' in o) || !o.body) { h.delete('content-length'); return new Response(null, { status: 304, headers: h }); }
  return new Response(o.body, { headers: h });
}
