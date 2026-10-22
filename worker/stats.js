// Private visit counter for tmm-landing-page.
// One row per HTML page view in D1 `views` (migrations/0001_views.sql). No raw IP or UA is ever
// stored: vh = SHA-256(ip|ua|day|STATS_SALT), truncated. Read at /stats?key=<STATS_KEY>.
// Counting runs in ctx.waitUntil and swallows every error: it can never break a page.

const BOT_RE = /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|embedly|quora link|outbrain|pinterest|vkshare|whatsapp|telegram|discord|slack|skype|headless|lighthouse|pagespeed|gtmetrix|curl|wget|python|httpclient|okhttp|java\/|go-http|node-fetch|axios|undici|libwww|scrapy|monitor|uptime|pingdom|validator|feedfetcher|google-inspectiontool|bingpreview|petalbot|semrush|ahrefs|mj12|dotbot|yandex|baidu|bytespider|gptbot|ccbot|claudebot|claude-web|perplexity|amazonbot|applebot|preview/i;

function same(a, b) {   // constant-time-ish compare
  a = String(a); b = String(b); let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

export function shouldCount(req, res) {
  if (req.method !== 'GET' || res.status !== 200) return false;
  if (!(res.headers.get('content-type') || '').includes('text/html')) return false;
  const ua = req.headers.get('user-agent') || '';
  if (!ua || BOT_RE.test(ua)) return false;
  const purpose = (req.headers.get('sec-purpose') || req.headers.get('purpose') || '').toLowerCase();
  return !purpose.includes('prefetch');
}

function deviceOf(ua) {
  if (/iPad/.test(ua)) return 'iPad';
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android' : 'Android tablet';
  if (/Macintosh/.test(ua) && /Mobile\//.test(ua)) return 'iPad';
  return 'desktop';
}

function cleanPath(p) {
  p = p.replace(/index\.html$/, '').toLowerCase();
  return p.length > 200 ? p.slice(0, 200) : p;
}

export async function countView(req, env, url) {
  try {
    const ua = req.headers.get('user-agent') || '', ip = req.headers.get('cf-connecting-ip') || '';
    const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
    const salt = env.STATS_SALT || env.STATS_KEY || 'tmm';
    const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + '|' + ua + '|' + day + '|' + salt));
    const vh = [...new Uint8Array(dig)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
    let ref = '';
    try {
      const r = req.headers.get('referer');
      if (r) { const h = new URL(r).hostname; if (h && h !== url.hostname) ref = h.slice(0, 100); }
    } catch (e) { /* bad referer */ }
    const country = String((req.cf && req.cf.country) || '').slice(0, 4);
    await env.PROGRESS.prepare('INSERT INTO views (ts, day, path, vh, device, ref, country) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(now, day, cleanPath(url.pathname), vh, deviceOf(ua), ref, country).run();
  } catch (e) { /* counting never breaks a page */ }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
function when(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' MT';
  } catch (e) { return new Date(ts).toISOString(); }
}
const PRIV = { 'cache-control': 'no-store, private', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer' };
function text(body, status) { return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...PRIV } }); }

export async function stats(req, env, url) {
  const key = url.searchParams.get('key') || '';
  const want = String(env.STATS_KEY || '').trim();
  if (want.length < 16 || !key || !same(key, want)) return text('Not found', 404);
  const db = env.PROGRESS, now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10), wk = new Date(now - 6 * 864e5).toISOString().slice(0, 10);
  let rows = [], last = [], days = [];
  try {
    rows = (await db.prepare(`SELECT path, COUNT(*) AS n, SUM(day = ?1) AS t, SUM(day >= ?2) AS w,
        COUNT(DISTINCT vh) AS u, MAX(ts) AS lt FROM views GROUP BY path ORDER BY lt DESC LIMIT 300`).bind(today, wk).all()).results || [];
    last = (await db.prepare(`SELECT v.path, v.ts, v.device, v.country, v.ref FROM views v
        JOIN (SELECT path, MAX(id) AS id FROM views GROUP BY path) m ON v.id = m.id`).all()).results || [];
    days = (await db.prepare(`SELECT path, day, COUNT(*) AS n, COUNT(DISTINCT vh) AS u FROM views
        WHERE path LIKE '/view/%' GROUP BY path, day ORDER BY path, day DESC LIMIT 3000`).all()).results || [];
  } catch (e) {
    return text('Stats unavailable: ' + (e && e.message), 500);
  }
  const lastBy = Object.fromEntries(last.map(r => [r.path, r]));
  const table = list => list.length ? `<table><tr><th>Page</th><th>Today</th><th>7 days</th><th>All</th><th>Unique</th><th>Last opened</th></tr>${list.map(r => {
    const l = lastBy[r.path] || {};
    const meta = [l.device, l.country, l.ref ? 'from ' + l.ref : ''].filter(Boolean).map(esc).join(' · ');
    return `<tr><td class="p">${esc(r.path)}</td><td>${r.t || 0}</td><td>${r.w || 0}</td><td>${r.n}</td><td>${r.u}</td><td class="l">${esc(when(l.ts || r.lt))}<br><span>${meta}</span></td></tr>`;
  }).join('')}</table>` : '<p class="m">No views yet.</p>';
  const jobs = rows.filter(r => r.path.startsWith('/view/')), pages = rows.filter(r => !r.path.startsWith('/view/'));
  const byJob = {};
  for (const d of days) (byJob[d.path] = byJob[d.path] || []).push(d);
  const perDay = Object.keys(byJob).sort().map(p => `<details><summary>${esc(p)}</summary><table><tr><th>Day (UTC)</th><th>Views</th><th>Unique</th></tr>${byJob[p].map(d => `<tr><td>${esc(d.day)}</td><td>${d.n}</td><td>${d.u}</td></tr>`).join('')}</table></details>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Site stats</title>
<style>body{font:15px/1.4 system-ui,-apple-system,sans-serif;margin:0;padding:16px;background:#fbfaf7;color:#1f2326}h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 6px}
.m{color:#6b6f72;font-size:13px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid #ddd;padding:6px 4px;text-align:right;vertical-align:top}th{font-size:12px;color:#6b6f72;font-weight:600}
th:first-child,td.p{text-align:left;word-break:break-all}td.l{text-align:left;font-size:12px;min-width:110px}td.l span{color:#6b6f72}details{margin:6px 0}summary{cursor:pointer;padding:6px 0;font-weight:600}
@media(prefers-color-scheme:dark){body{background:#17191b;color:#e6e4df}th,td{border-color:#333}.m,th,td.l span{color:#9a9ea1}}</style></head><body>
<h1>Site stats</h1><p class="m">Updated ${esc(when(now))}. Bots and HEAD requests are not counted. "Unique" = distinct visitors per day; no IP addresses are stored.</p>
<h2>Job links</h2>${table(jobs)}<h2>Per day, each job</h2>${perDay || '<p class="m">No job views yet.</p>'}<h2>Site pages</h2>${table(pages)}</body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', ...PRIV } });
}
