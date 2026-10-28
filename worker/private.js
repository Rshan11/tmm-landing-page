// Passcode-locked job pages: /view/<slug>/ and every file under it (page, meta, blocks, rebar, usdz).
// PRIVATE maps slug -> [sha256("<slug>:<passcode>"), sha256(cookie value)]; the cookie value is
// sha256("ck:<slug>:<passcode>"), so neither the passcode nor a working cookie can be read from the repo.
// A right code (form POST or ?code=) sets an HttpOnly cookie for that job's path, 30 days.
// Jobs sent from the TMM app ("Send to The Lead", worker/lead.js) use the same two hashes, kept in D1
// instead of this map, and the same check (passCheck) so the page, the cookie and the iPhone app's
// passcode POST behave exactly alike.
const PRIVATE = {
  '716c78d5b6ad': ['702c32093e9534bca3b17be53144e0ea33a0962551c36cb77b6e3af702ef1a5b',
                   'f8b832c8aca758fe5b9612e936676d59224d9292acde6d9acf38d93e6fe1ebbd'],
  'd374f36ef6bd': ['f0081ba01b41256631d38017c22ef65af0809bf49d23a51b4a4ef6aabed825b2',
                   '0ad46100930e90f557dfc44c9125f2fd3b379b2a0e46e2476890b5d2615fc96d'],
  'e35f3337c9db': ['f2437842dd5709042f5964f83fc6f26f924f5dfa8f81a1d96aa51126b88b82a4',
                   'b6693580d73b44aaa332ace4a5a64cf61d7cb2b12b8e55e4f5e19e3c213bda56'],
  '36adef0c42ef': ['b1f1daa2278d1dbdf4a1284cfd10aa7cd80b4ea7d468c9bcb3fd16c187a86cec',
                   '6eeca40a124e73a33595b8ca8e4fbd6140fea2c9cc790471207bd64e3d80af00'],
};
const MAX_AGE = 30 * 24 * 3600;

export async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function same(a, b) {
  a = String(a); b = String(b); let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
function cookie(req, name) {
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}
const norm = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function form(slug, wrong) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Private job · The Masonry Modeler</title>
<style>:root{--bg:#f4f4f2;--card:#fff;--ink:#1d2327;--mute:#6b7378;--line:#d9dcdd;--accent:#2f7d4f}
@media (prefers-color-scheme:dark){:root{--bg:#15191b;--card:#1e2427;--ink:#e8ecee;--mute:#9aa3a8;--line:#323a3e;--accent:#4caf74}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:17px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;padding:16px;box-sizing:border-box}
form{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:28px;width:100%;max-width:360px;box-sizing:border-box}
h1{font-size:21px;margin:0 0 6px}p{color:var(--mute);margin:0 0 18px;font-size:15px}
input{width:100%;box-sizing:border-box;font-size:20px;letter-spacing:2px;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);text-transform:uppercase}
button{margin-top:14px;width:100%;font-size:18px;font-weight:600;padding:12px;border:0;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer}
.err{color:#c0392b;font-size:15px;margin:10px 0 0}</style></head><body>
<form method="post" action="/view/${slug}/"><h1>Private job</h1><p>Enter the passcode you were sent.</p>
<input name="code" autocomplete="off" autocapitalize="characters" autofocus aria-label="Passcode">
${wrong ? '<div class="err">That passcode didn\'t match.</div>' : ''}<button type="submit">Open</button></form></body></html>`;
  return new Response(html, { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}

// The passcode check for one locked job. Returns null when the request may go through (a good cookie),
// else the Response to send (303 + cookie for a right code, the form, the form saying it didn't match,
// or a bare 404 for a job file without the cookie). `tries` (optional) limits wrong codes:
// { locked(): Promise<bool>, failed(): Promise, cleared(): Promise }.
export async function passCheck(req, url, slug, wantCode, wantCookie, tries) {
  const name = 'pv_' + slug, base = `/view/${slug}/`;
  const have = cookie(req, name);
  if (have && same(await sha256(have), wantCookie)) return null;

  let code = url.searchParams.get('code');
  if (code === null && req.method === 'POST' && url.pathname === base) {
    try { code = (await req.formData()).get('code'); } catch (e) { code = ''; }
  }
  if (code !== null) {
    if (tries && await tries.locked()) {
      return new Response('Too many tries. Wait 15 minutes, then try again.', { status: 429,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'retry-after': '900' } });
    }
    const n = norm(code), typed = n.length === 8 ? n.slice(0, 4) + '-' + n.slice(4) : '';
    if (typed && same(await sha256(slug + ':' + typed), wantCode)) {
      if (tries) await tries.cleared();
      const value = await sha256('ck:' + slug + ':' + typed);
      return new Response(null, { status: 303, headers: {
        location: base, 'cache-control': 'no-store',
        'set-cookie': `${name}=${value}; Path=${base}; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax` } });
    }
    if (tries) await tries.failed();
    return form(slug, true);
  }
  if (url.pathname === base || url.pathname === base + 'index.html') return form(slug, false);
  return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}

// Returns a Response when the request is for a hand-made locked job and not let through; null otherwise.
export async function gate(req, url) {
  const m = /^\/view\/([a-z0-9]{6,40})(\/|$)/.exec(url.pathname);
  if (!m || !isHandMade(m[1])) return null;
  const [wantCode, wantCookie] = PRIVATE[m[1]];
  return passCheck(req, url, m[1], wantCode, wantCookie, null);
}

// A slug taken by a hand-made locked job (never given to an app-published job).
export function isHandMade(slug) { return Object.prototype.hasOwnProperty.call(PRIVATE, slug); }
