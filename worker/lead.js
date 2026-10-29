// "Send to The Lead": jobs a company publishes from its own TMM app, kept in R2 + D1.
//
// Publishing (TMM app -> here), with the company's publish key (Authorization: Bearer <key>; D1 keeps
// only sha256(key) in lead_keys, one row per company):
//   PUT    /api/lead/publish/<slug>/<ver>/<file>   one file, streamed to R2 stage/<slug>/<ver>/<file>
//          (x-tmm-sha256: hex of the body; R2 refuses a body that doesn't match). Counted against the
//          company's daily byte cap (LEAD_DAILY_BYTES, default 1 GB) before anything is written.
//          stage/ is swept by an R2 lifecycle rule after 1 day (an upload never finished goes away).
//   POST   /api/lead/publish   {slug, ver, title, code_salt, code_hash, files:{name:{size, sha256}}}
//          checks every staged file landed whole, copies them to view/<slug>/<ver>/, then points the
//          job at <ver> in one D1 write (the phone never sees half a job) and clears older versions.
//   DELETE /api/lead/publish/<slug>   takes the job down (the files that exist then are deleted; the slug
//          stays the company's and a later send brings it back).
// A slug is the company's that first published it; another key gets 403. The passcode itself never
// comes here: the app sends a random per-job salt and sha256("<salt>:<slug>:<CODE>").
//
// Serving: /view/<slug>/ and its files for a published job go through private.js passCheck (same form,
// same 303, same cookie name and path as every locked job). The cookie is
// HMAC-SHA256(LEAD_COOKIE_SECRET, "ck:<slug>:<code_hash>"): it can't be worked out offline. Wrong codes
// and wrong cookies are counted (private.js tries). The page is the Lead page bundled with this Worker
// (worker/lead_page.html); the data files come from R2. Published jobs are never listed anywhere.
import { passCheck, tries, sha256, same, isHandMade } from './private.js';
import PAGE from './lead_page.html';

export const FILES = {
  'meta.json': 'application/json; charset=utf-8',
  'blocks.b64.txt': 'text/plain; charset=utf-8',
  'rebar.b64.txt': 'text/plain; charset=utf-8',
  'model.usdz': 'model/vnd.usdz+zip',
};
const REQUIRED = ['meta.json', 'blocks.b64.txt'];
export const MAX_FILE = 95 * 1024 * 1024;          // a Worker request body is capped at 100 MB (Free/Pro)
const DAILY_BYTES = 1000 * 1000 * 1000;
const SLUG_RE = /^[a-z0-9]{12,40}$/, VER_RE = /^[a-z0-9]{8,32}$/, HEX64 = /^[0-9a-f]{64}$/, SALT_RE = /^[0-9a-f]{32}$/;
const NOINDEX = { 'x-robots-tag': 'noindex, nofollow, noarchive', 'referrer-policy': 'no-referrer' };

function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...NOINDEX } });
}
const hex = buf => buf ? [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('') : '';

async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
}

// The company a publish key belongs to, or null. Only sha256(key) is stored.
async function companyOf(req, env) {
  const m = /^Bearer ([A-Za-z0-9_-]{32,200})$/.exec(req.headers.get('authorization') || '');
  if (!m) return null;
  const r = await env.PROGRESS.prepare('SELECT company FROM lead_keys WHERE key_hash = ? AND revoked = 0').bind(await sha256(m[1])).first();
  return r ? r.company : null;
}

async function jobRow(env, slug) {
  return env.PROGRESS.prepare('SELECT slug, company, code_salt, code_hash, ver, prev_ver, files, removed FROM lead_jobs WHERE slug = ?').bind(slug).first();
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

// Count `len` bytes against today's cap for the company; false (and nothing counted) when over it.
async function spend(env, company, len) {
  const cap = +env.LEAD_DAILY_BYTES || DAILY_BYTES, day = new Date().toISOString().slice(0, 10);
  const r = await env.PROGRESS.prepare(
    `INSERT INTO lead_usage (company, day, bytes) VALUES (?1, ?2, ?3)
     ON CONFLICT(company, day) DO UPDATE SET bytes = lead_usage.bytes + ?3 RETURNING bytes`).bind(company, day, len).first();
  if (r && r.bytes > cap) {
    await env.PROGRESS.prepare('UPDATE lead_usage SET bytes = bytes - ?3 WHERE company = ?1 AND day = ?2').bind(company, day, len).run();
    return false;
  }
  return true;
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
  if (!await spend(env, company, len)) return json({ error: 'daily limit' }, 429);
  try {
    await env.LEAD.put(`stage/${slug}/${ver}/${file}`, req.body, { httpMetadata: { contentType: FILES[file] }, sha256: sum, customMetadata: { company } });
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
  const { slug, ver, code_salt, code_hash } = b;
  const title = typeof b.title === 'string' ? b.title.slice(0, 200) : '';
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) return json({ error: 'slug' }, 400);
  if (typeof ver !== 'string' || !VER_RE.test(ver)) return json({ error: 'ver' }, 400);
  if (!SALT_RE.test(String(code_salt)) || !HEX64.test(String(code_hash))) return json({ error: 'passcode' }, 400);
  const files = b.files && typeof b.files === 'object' ? b.files : null;
  if (!files) return json({ error: 'files' }, 400);
  const names = Object.keys(files);
  if (names.some(n => !FILES[n]) || REQUIRED.some(n => !names.includes(n))) return json({ error: 'files' }, 400);
  const c = await claim(env, url, company, slug);
  if (c !== 'ok') return json({ error: c }, c === 'taken' ? 403 : 409);
  // every file is staged, whole, in this version
  const kept = {};
  for (const n of names) {
    const f = files[n] || {};
    const o = await env.LEAD.head(`stage/${slug}/${ver}/${n}`);
    if (!o) return json({ error: 'missing', file: n }, 409);
    if (o.size !== f.size || hex(o.checksums && o.checksums.sha256) !== String(f.sha256 || '').toLowerCase()) return json({ error: 'mismatch', file: n }, 409);
    kept[n] = { size: o.size, sha256: hex(o.checksums.sha256) };
  }
  // staged -> served (R2 has no copy: each file is read and written again, checksum checked again;
  // a known length is needed for the write, and a file is at most 95 MB)
  for (const n of names) {
    const o = await env.LEAD.get(`stage/${slug}/${ver}/${n}`);
    if (!o) return json({ error: 'missing', file: n }, 409);
    await env.LEAD.put(`view/${slug}/${ver}/${n}`, await o.arrayBuffer(), { httpMetadata: { contentType: FILES[n] }, sha256: kept[n].sha256, customMetadata: { company } });
  }
  await env.LEAD.delete(names.map(n => `stage/${slug}/${ver}/${n}`));
  const prev = await jobRow(env, slug);
  const now = Date.now();
  const r = await env.PROGRESS.prepare(
    `INSERT INTO lead_jobs (slug, company, title, code_salt, code_hash, ver, prev_ver, files, created, updated, publishes, removed)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, '', ?7, ?8, ?8, 1, 0)
     ON CONFLICT(slug) DO UPDATE SET title = excluded.title, code_salt = excluded.code_salt, code_hash = excluded.code_hash,
       prev_ver = CASE WHEN lead_jobs.removed THEN '' ELSE lead_jobs.ver END, ver = excluded.ver, files = excluded.files,
       updated = excluded.updated, publishes = lead_jobs.publishes + 1, removed = 0
     WHERE lead_jobs.company = excluded.company`)
    .bind(slug, company, title, code_salt, code_hash, ver, JSON.stringify(kept), now).run();
  if (!r.meta || !r.meta.changes) return json({ error: 'taken' }, 403);
  // keep this version and the one before it (a phone part way through a download); clear the rest
  ctx.waitUntil(sweepOld(env, slug).catch(() => {}));
  return json({ ok: true, slug, ver, url: `${url.origin}/view/${slug}/`, files: kept, first: !prev });
}

async function listKeys(env, prefix) {
  const keys = []; let cursor;
  do {
    const l = await env.LEAD.list({ prefix, cursor });
    keys.push(...l.objects.map(o => o.key));
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
  return keys;
}

// Versions other than the job's current and previous one, read from D1 right before deleting (a send
// that finished meanwhile keeps its files).
async function sweepOld(env, slug) {
  const keys = await listKeys(env, `view/${slug}/`);
  const row = await jobRow(env, slug);
  if (!row || row.removed) return;
  const keep = new Set([row.ver, row.prev_ver].filter(Boolean));
  const gone = keys.filter(k => !keep.has(k.split('/')[2]));
  for (let i = 0; i < gone.length; i += 1000) await env.LEAD.delete(gone.slice(i, i + 1000));
}

async function takeDown(env, url, ctx, company, slug) {
  const row = await jobRow(env, slug);
  if (!row) return json({ error: 'not found' }, 404);
  if (row.company !== company) return json({ error: 'taken' }, 403);
  // the files that exist NOW; a send that comes after this answer writes a new version, never listed here
  const keys = await listKeys(env, `view/${slug}/`);
  await env.PROGRESS.prepare('UPDATE lead_jobs SET removed = 1, updated = ? WHERE slug = ? AND company = ?').bind(Date.now(), slug, company).run();
  ctx.waitUntil((async () => {
    const cur = await jobRow(env, slug);
    const live = cur && !cur.removed ? new Set([cur.ver, cur.prev_ver]) : new Set();
    const gone = keys.filter(k => !live.has(k.split('/')[2]));
    for (let i = 0; i < gone.length; i += 1000) await env.LEAD.delete(gone.slice(i, i + 1000));
  })().catch(() => {}));
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

// /view/<slug>/... for a published job: the passcode check, then the page or one of its files.
// null = not a published job (the hand-made locked jobs and the public folders are served as before).
export async function serveLead(req, env, url) {
  const m = /^\/view\/([a-z0-9]{12,40})(?:\/(.*))?$/.exec(url.pathname);
  if (!m || isHandMade(m[1]) || !env.LEAD) return null;
  const slug = m[1];
  const job = await jobRow(env, slug);
  if (!job || job.removed) return null;
  const secret = env.LEAD_COOKIE_SECRET;
  if (!secret || secret.length < 32) return new Response('Not set up', { status: 503, headers: { 'cache-control': 'no-store', ...NOINDEX } });
  const want = await hmac(secret, `ck:${slug}:${job.code_hash}`);
  const locked = await passCheck(req, url, slug, {
    guessable: false,
    codeOk: async typed => same(await sha256(`${job.code_salt}:${slug}:${typed}`), job.code_hash),
    cookieOk: async v => same(v, want),
    cookieFor: async () => want,
  }, tries(env, 'lead', slug, req));
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
