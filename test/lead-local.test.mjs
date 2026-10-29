// Local proof for "Send to The Lead" (worker/lead.js) on wrangler dev --local (miniflare): no Cloudflare
// account is touched. Needs a built ./dist (npm run build, or a copy).
//
//   node test/lead-local.test.mjs              run every check; exit 1 on any failure
//   node test/lead-local.test.mjs --serve      leave the new Worker running on :8791 (publish key printed
//                                              to .wrangler/lead-test/key.txt, never to the console)
//
// It runs TWO Workers side by side: this branch's (port 8791) and master's worker/ + run_worker_first
// (port 8792, from `git show master:...`), and checks the public job folders answer byte for byte the same.
import { spawn, execFileSync } from 'node:child_process';
import http from 'node:http';
import { handMadeCookie } from '../worker/private.js';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORK = join(SITE, '.wrangler', 'lead-test');
const NEW_PORT = 8791, OLD_PORT = 8792;
const SERVE = process.argv.includes('--serve');
const sh = (s) => createHash('sha256').update(s).digest('hex');
const isWin = process.platform === 'win32';

function jsonc(text) {   // strip // comments outside strings
  let out = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && text[i - 1] !== '\\') q = !q;
    if (!q && c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
    out += c;
  }
  return JSON.parse(out);
}

function config(cfgText, mainRel, dir) {
  const c = jsonc(cfgText);
  delete c.build;                                   // dist is already there
  c.name = c.name + '-localtest';
  c.main = mainRel;
  c.assets.directory = join(SITE, 'dist');
  for (const d of c.d1_databases || []) { d.database_id = 'local-test'; d.migrations_dir = join(SITE, 'migrations'); }
  mkdirSync(dir, { recursive: true });
  const p = join(dir, 'wrangler.json');
  writeFileSync(p, JSON.stringify(c, null, 1));
  return p;
}

function wrangler(args, opts = {}) {
  return execFileSync(isWin ? 'wrangler.cmd' : 'wrangler', args, { cwd: SITE, stdio: ['ignore', 'pipe', 'pipe'], shell: isWin, ...opts }).toString();
}

const SECRET = randomBytes(32).toString('hex');
function start(cfg, port, persist, vars = []) {
  const p = spawn(isWin ? 'wrangler.cmd' : 'wrangler', ['dev', '-c', cfg, '--local', '--ip', '127.0.0.1', '--port', String(port), ...vars.flatMap(v => ['--var', v]),
    '--inspector-port', String(port + 1000), '--persist-to', persist, '--show-interactive-dev-session=false', '--log-level', 'warn'],
    { cwd: SITE, stdio: ['ignore', 'pipe', 'pipe'], shell: isWin });
  let log = ''; p.stdout.on('data', d => log += d); p.stderr.on('data', d => log += d);
  p.log = () => log;
  return p;
}

async function up(port, proc) {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/robots.txt`); if (r.status) return; } catch (e) { /* not yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`wrangler dev on ${port} never came up:\n${proc.log()}`);
}

function stop(p) {
  if (!p || p.exitCode !== null) return;
  if (isWin) { try { execFileSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) { /* gone */ } }
  else p.kill('SIGTERM');
}

// One request on its own connection (agent: false). wrangler dev keeps a kept-alive connection hung after a
// POST whose body the Worker never read (the static jobs' 405), on master's Worker as on this one.
function once(url, init) {
  return new Promise((resolve, reject) => {
    const q = http.request(url, { method: init.method, headers: init.headers, agent: false }, res => {
      const parts = []; res.on('data', d => parts.push(d));
      res.on('end', () => {
        const body = Buffer.concat(parts);
        resolve({ status: res.statusCode, headers: { get: k => { const v = res.headers[k]; return v === undefined ? null : Array.isArray(v) ? v.join(', ') : v; } },
          arrayBuffer: async () => body, text: async () => body.toString('utf8') });
      });
    });
    q.on('error', reject); q.setTimeout(init.wait || 20000, () => q.destroy(new Error('timeout')));
    q.end(init.body);
  });
}

let fails = 0, passes = 0;
function ok(cond, what) { if (cond) { passes++; console.log('  ok  ' + what); } else { fails++; console.log('  FAIL ' + what); } }

async function main() {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  // the new Worker (this branch)
  const newCfg = config(readFileSync(join(SITE, 'wrangler.jsonc'), 'utf8'), join(SITE, 'worker', 'index.js'), join(WORK, 'new'));
  // master's Worker, for "public pages unchanged"
  const oldDir = join(WORK, 'old');
  mkdirSync(join(oldDir, 'worker'), { recursive: true });
  for (const f of ['index.js', 'private.js', 'stats.js']) {
    writeFileSync(join(oldDir, 'worker', f), execFileSync('git', ['show', `master:worker/${f}`], { cwd: SITE }));
  }
  const oldCfg = config(execFileSync('git', ['show', 'master:wrangler.jsonc'], { cwd: SITE }).toString(), join(oldDir, 'worker', 'index.js'), oldDir);

  // a stand-in data file for one hand-made locked job, so "the right cookie opens" has a file to open
  const hmDir = join(SITE, 'dist', 'view', '716c78d5b6ad');
  if (!existsSync(join(hmDir, 'meta.json'))) { mkdirSync(hmDir, { recursive: true }); writeFileSync(join(hmDir, 'meta.json'), '{"stand_in":true}'); }
  const persist = join(WORK, 'state');
  for (const f of ['worker/schema.sql']) wrangler(['d1', 'execute', 'tmm-progress', '--local', '-c', newCfg, '--persist-to', persist, '--file', join(SITE, f)]);
  wrangler(['d1', 'migrations', 'apply', 'tmm-progress', '--local', '-c', newCfg, '--persist-to', persist]);
  // two companies' publish keys (only their hashes go into D1)
  const keyA = 'tmmlp_' + randomBytes(32).toString('base64url'), keyB = 'tmmlp_' + randomBytes(32).toString('base64url');
  writeFileSync(join(WORK, 'key.txt'), keyA);
  const now = Date.now();
  const keysSql = join(WORK, 'keys.sql');
  writeFileSync(keysSql, `INSERT INTO lead_keys (key_hash, company, label, created) VALUES ('${sh(keyA)}', 'sample-co', 'local test', ${now}), ('${sh(keyB)}', 'other-co', 'local test', ${now});
`);
  wrangler(['d1', 'execute', 'tmm-progress', '--local', '-c', newCfg, '--persist-to', persist, '--file', keysSql]);

  const pNew = start(newCfg, NEW_PORT, persist, [`LEAD_COOKIE_SECRET:${SECRET}`, 'LEAD_DAILY_BYTES:300000']);
  const pOld = SERVE ? null : start(oldCfg, OLD_PORT, join(WORK, 'state-old'));
  try {
    await up(NEW_PORT, pNew);
    if (SERVE) { console.log(`new Worker on http://127.0.0.1:${NEW_PORT} (key in ${join(WORK, 'key.txt')}); Ctrl+C to stop`); await new Promise(() => {}); }
    await up(OLD_PORT, pOld);
    const N = `http://127.0.0.1:${NEW_PORT}`, O = `http://127.0.0.1:${OLD_PORT}`;

    console.log('public job folders: this branch vs master');
    for (const job of ['georgeville', 'casper-arena', 'kelowna', 'steamboat']) {
      for (const [path, method] of [[`/view/${job}/`, 'GET'], [`/view/${job}/index.html`, 'GET'], [`/view/${job}/meta.json`, 'GET'], [`/view/${job}/blocks.b64.txt`, 'GET'],
        [`/view/${job}/rebar.b64.txt`, 'GET'], [`/view/${job}/model.usdz`, 'GET'], [`/view/${job}/model.usdz`, 'HEAD'], [`/view/${job}/nope.txt`, 'GET']]) {
        const init = { method, redirect: 'manual', headers: { 'user-agent': 'lead-test' } };
        const [a, b] = await Promise.all([once(N + path, init), once(O + path, init)]);
        const [ba, bb] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
        const same = a.status === b.status && sh(Buffer.from(ba)) === sh(Buffer.from(bb))
          && ['content-type', 'cache-control', 'etag', 'content-length', 'location', 'set-cookie'].every(h => a.headers.get(h) === b.headers.get(h));
        ok(same, `${method} ${path} -> ${a.status} ${a.headers.get('content-type')} same as master`);
      }
    }
    console.log('hand-made locked job: same as master');
    for (const [path, method, body] of [['/view/716c78d5b6ad/', 'GET'], ['/view/716c78d5b6ad/meta.json', 'GET'], ['/view/716c78d5b6ad/', 'POST', 'code=ZZZZ-0000']]) {
      const init = { method, redirect: 'manual', headers: body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}, body };
      const [a, b] = await Promise.all([once(N + path, init), once(O + path, init)]);
      const [ta, tb] = await Promise.all([a.text(), b.text()]);
      ok(a.status === b.status && ta === tb, `${method} ${path} -> ${a.status} same as master`);
    }

    console.log('publish');
    const slug = randomBytes(6).toString('hex'), code = 'TEST-4821';
    const salt = randomBytes(16).toString('hex'), hashFor = s => sh(`${salt}:${s}:${code}`);
    const files = {
      'meta.json': Buffer.from(JSON.stringify({ project: { name: 'Lead local test' }, nBlocks: 1, nRebarSegs: 0, walls: [] })),
      'blocks.b64.txt': Buffer.from(Buffer.alloc(38, 7).toString('base64')),
      'rebar.b64.txt': Buffer.from(''),
    };
    const put = (key, s, ver, name, body, sum) => fetch(`${N}/api/lead/publish/${s}/${ver}/${name}`, { method: 'PUT', body,
      headers: { authorization: 'Bearer ' + key, 'x-tmm-sha256': sum || sh(body), 'content-type': 'application/octet-stream' } });
    const fin = (key, s, ver, fl, extra = {}) => fetch(`${N}/api/lead/publish`, { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ slug: s, ver, title: 'Lead local test', code_salt: salt, code_hash: hashFor(s),
        files: Object.fromEntries(Object.entries(fl).map(([n, b]) => [n, { size: b.length, sha256: sh(b) }])), ...extra }) });
    ok((await put('', slug, 'v00000001', 'meta.json', files['meta.json'])).status === 401, 'no key: 401');
    ok((await put('tmmlp_' + 'x'.repeat(40), slug, 'v00000001', 'meta.json', files['meta.json'])).status === 401, 'wrong key: 401');
    ok((await put(keyA, slug, 'v00000001', 'meta.json', files['meta.json'], sh('other'))).status === 400, 'checksum that does not match the body: 400');
    ok((await put(keyA, '716c78d5b6ad', 'v00000001', 'meta.json', files['meta.json'])).status === 409, 'a hand-made job slug is reserved: 409');
    for (const [n, b] of Object.entries(files)) ok((await put(keyA, slug, 'v00000001', n, b)).status === 200, `PUT ${n}`);
    ok((await fin(keyA, slug, 'v00000001', { ...files, 'meta.json': Buffer.from('short') })).status === 409, 'finish with a size that does not match: 409');
    const f1 = await fin(keyA, slug, 'v00000001', files); const j1 = await f1.json();
    ok(f1.status === 200 && j1.url === `${N}/view/${slug}/`, `finish: 200, link ${j1.url}`);
    ok((await put(keyB, slug, 'v00000002', 'meta.json', files['meta.json'])).status === 403, "another company's key can't write the job: 403");
    ok((await fin(keyB, slug, 'v00000001', files)).status === 403, "another company's key can't finish it: 403");

    console.log('passcode gate (the iPhone app\'s contract)');
    let r = await fetch(`${N}/view/${slug}/`, { redirect: 'manual' }); let t = await r.text();
    ok(r.status === 401 && /name="code"/.test(t), 'page without the cookie: 401 passcode form');
    r = await fetch(`${N}/view/${slug}/meta.json`, { redirect: 'manual' });
    ok(r.status === 404, 'a file without the cookie: 404');
    r = await fetch(`${N}/view/${slug}/`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'code=WRNG-0000' }); t = await r.text();
    ok(r.status === 401 && /didn't match/.test(t) && !r.headers.get('set-cookie'), "wrong code: the form saying it didn't match, no cookie");
    r = await fetch(`${N}/view/${slug}/`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'code=' + encodeURIComponent(code) });
    const sc = r.headers.get('set-cookie') || '';
    ok(r.status === 303 && r.headers.get('location') === `/view/${slug}/` && sc.includes(`pv_${slug}=`) && sc.includes(`Path=/view/${slug}/`) && /HttpOnly/.test(sc), 'right code: 303 + HttpOnly cookie for the job path');
    const ck = sc.split(';')[0];
    r = await fetch(`${N}/view/${slug}/`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'code=test4821' });
    ok(r.status === 303, 'code typed lower case without the dash also opens');
    r = await fetch(`${N}/view/${slug}/`, { headers: { cookie: ck } }); t = await r.text();
    ok(r.status === 200 && /text\/html/.test(r.headers.get('content-type')) && t.includes("fetch('meta.json')") && /noindex/.test(r.headers.get('x-robots-tag')), 'page with the cookie: the Lead page, noindex');
    for (const [n, b] of Object.entries(files)) {
      r = await fetch(`${N}/view/${slug}/${n}`, { headers: { cookie: ck } });
      const got = Buffer.from(await r.arrayBuffer());
      ok(r.status === 200 && got.equals(b), `GET ${n} with the cookie: the bytes sent`);
    }
    const et = (await fetch(`${N}/view/${slug}/meta.json`, { headers: { cookie: ck } })).headers.get('etag');
    r = await fetch(`${N}/view/${slug}/meta.json`, { headers: { cookie: ck, 'if-none-match': et } });
    ok(r.status === 304, 'If-None-Match: 304');
    r = await fetch(`${N}/view/${slug}/model.usdz`, { method: 'HEAD', headers: { cookie: ck } });
    ok(r.status === 404, 'model.usdz not sent: 404 (the app treats it as optional)');
    r = await fetch(`${N}/view/${slug}/`, { method: 'POST', redirect: 'manual', headers: { cookie: ck } });
    ok(r.status === 405, 'POST with a good cookie: 405 (as the static jobs answer)');
    r = await fetch(`${N}/view/${slug}/meta.json`, { headers: { cookie: `pv_${slug}=` + sh(`ck:${slug}:${code}`) } });
    ok(r.status === 404, "the old offline cookie formula sha256('ck:slug:CODE') does not open a published job");
    ok(ck.split('=')[1] !== sh(`ck:${slug}:${code}`) && /^[0-9a-f]{64}$/.test(ck.split('=')[1]), 'the cookie is an HMAC with the server secret');

    console.log('wrong cookies are counted (audit S2-1), on a second job');
    const slug2 = randomBytes(6).toString('hex');
    for (const [n, b] of Object.entries(files)) await put(keyA, slug2, 'v00000001', n, b);
    ok((await fin(keyA, slug2, 'v00000001', files)).status === 200, 'second job published');
    const ipH = ip => ({ 'cf-connecting-ip': ip });
    const getAs = (ip, c) => fetch(`${N}/view/${slug2}/meta.json`, { headers: { ...ipH(ip), ...(c ? { cookie: c } : {}) } });
    ok((await getAs('203.0.113.7')).status === 404, 'meta.json with no cookie: 404');
    let codes = [];
    for (let i = 0; i < 11; i++) codes.push((await getAs('203.0.113.7', `pv_${slug2}=${randomBytes(32).toString('hex')}`)).status);
    ok(codes.slice(0, 10).every(c => c === 404) && codes[10] === 429, `a wrong-cookie loop reaches 429 on the 11th (${codes.join(',')})`);
    const r2 = await fetch(`${N}/view/${slug2}/`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...ipH('203.0.113.7') }, body: 'code=' + code });
    ok(r2.status === 429, 'locked address: even the right code is refused (429)');
    const ck2 = ((await fetch(`${N}/view/${slug2}/`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...ipH('198.51.100.20') }, body: 'code=' + code })).headers.get('set-cookie') || '').split(';')[0];
    ok((await getAs('203.0.113.7', ck2)).status === 200, 'a right (HMAC) cookie still opens the job from a locked address: an attack never locks the crew out');
    codes = [];
    for (let i = 0; i < 6; i++) codes.push((await getAs('2001:db8:1:2::5', `pv_${slug2}=bad${i}`)).status);
    for (let i = 0; i < 5; i++) codes.push((await getAs('2001:db8:1:2:ffff::9', `pv_${slug2}=bad${i}`)).status);
    ok(codes[10] === 429, `IPv6 is counted by /64: two addresses in one /64 share the limit (${codes.join(',')})`);
    codes = [];
    for (let i = 0; i < 40; i++) codes.push((await getAs(`192.0.2.${i + 1}`, `pv_${slug2}=bad`)).status);
    const firstLock = codes.indexOf(429);
    ok(firstLock > 0 && codes.slice(firstLock).every(c => c === 429), `every address together: 50 wrong tries an hour per job, then 429 for a fresh address (locked after ${firstLock} more)`);
    ok((await getAs('192.0.2.200', ck2)).status === 200, 'the right cookie still works while the job is locked');

    console.log('hand-made locked job: wrong cookies are counted too');
    codes = [];
    for (let i = 0; i < 11; i++) codes.push((await fetch(`${N}/view/716c78d5b6ad/meta.json`, { headers: { ...ipH('203.0.113.99'), cookie: 'pv_716c78d5b6ad=' + randomBytes(32).toString('hex') } })).status);
    ok(codes.slice(0, 10).every(c => c === 404) && codes[10] === 429, `hand-made job: wrong-cookie loop reaches 429 (${codes.join(',')})`);
    // delta audit S2: 50 wrong tries an hour across all addresses must not lock the crew out of a hand-made job
    for (let i = 0; i < 45; i++) {
      await fetch(`${N}/view/716c78d5b6ad/`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...ipH(`198.18.0.${i + 1}`) }, body: 'code=WRNG-' + (1000 + i) });
    }
    r = await fetch(`${N}/view/716c78d5b6ad/`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...ipH('198.18.1.1') }, body: 'code=WRNG-9999' });
    ok(r.status === 429, 'hand-made job locked job-wide after 50 wrong tries from many addresses');
    const goodHm = 'pv_716c78d5b6ad=' + await handMadeCookie(SECRET, '716c78d5b6ad');
    r = await fetch(`${N}/view/716c78d5b6ad/meta.json`, { headers: { ...ipH('198.18.1.2'), cookie: goodHm } });
    ok(r.status === 200, `hand-made job: the crew's valid (HMAC) cookie still opens while it is locked (${r.status})`);
    r = await fetch(`${N}/view/716c78d5b6ad/meta.json`, { headers: { ...ipH('198.18.1.3'), cookie: 'pv_716c78d5b6ad=' + sh('ck:716c78d5b6ad:ABCD-1234') } });
    ok(r.status === 429, 'hand-made job: an old-style sha256 cookie guess is just a wrong try (429 while locked)');

    console.log('update the Lead (same slug, same passcode)');
    const files2 = { ...files, 'meta.json': Buffer.from(JSON.stringify({ project: { name: 'Lead local test' }, nBlocks: 2, nRebarSegs: 0, walls: [] })), 'blocks.b64.txt': Buffer.from(Buffer.alloc(76, 9).toString('base64')) };
    for (const [n, b] of Object.entries(files2)) await put(keyA, slug, 'v00000002', n, b);
    ok((await fin(keyA, slug, 'v00000002', files2)).status === 200, 'finish v2');
    r = await fetch(`${N}/view/${slug}/blocks.b64.txt`, { headers: { cookie: ck } });
    ok(Buffer.from(await r.arrayBuffer()).equals(files2['blocks.b64.txt']), 'the same cookie gets the new blocks');
    for (const [n, b] of Object.entries(files2)) await put(keyA, slug, 'v00000003', n, b);
    await fin(keyA, slug, 'v00000003', files2);

    console.log('wrong-code limit');
    let last = 0;
    for (let i = 0; i < 11; i++) {
      r = await fetch(`${N}/view/${slug}/`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'code=BADD-' + String(1000 + i) });
      last = r.status;
    }
    ok(last === 429, '11th wrong code in 15 minutes: 429');

    console.log('take it down');
    r = await fetch(`${N}/api/lead/publish/${slug}`, { method: 'DELETE', headers: { authorization: 'Bearer ' + keyB } });
    ok(r.status === 403, "another company can't take it down");
    r = await fetch(`${N}/api/lead/publish/${slug}`, { method: 'DELETE', headers: { authorization: 'Bearer ' + keyA } });
    ok(r.status === 200, 'take down: 200');
    r = await fetch(`${N}/view/${slug}/meta.json`, { headers: { cookie: ck } });
    ok(r.status === 404, 'taken down: the files are gone (404)');
    r = await fetch(`${N}/view/${slug}/`, { redirect: 'manual' });
    ok(r.status === 404, 'taken down: the page is gone (404)');
    for (const [n, b] of Object.entries(files2)) await put(keyA, slug, 'v00000004', n, b);
    ok((await fin(keyA, slug, 'v00000004', files2)).status === 200, 'send again after the take-down');
    await new Promise(res => setTimeout(res, 1500));   // the take-down's background delete has run
    r = await fetch(`${N}/view/${slug}/blocks.b64.txt`, { headers: { cookie: ck } });
    ok(r.status === 200 && Buffer.from(await r.arrayBuffer()).equals(files2['blocks.b64.txt']), 'the fresh send is not wiped by the take-down sweep (audit S3-3)');

    console.log('daily byte cap per company');
    const big = Buffer.alloc(320000, 1);
    r = await put(keyA, slug, 'v00000005', 'blocks.b64.txt', big);
    ok(r.status === 429 && (await r.json()).error === 'daily limit', "over the day's bytes: 429 daily limit, nothing written");
    r = await put(keyB, randomBytes(6).toString('hex'), 'v00000001', 'meta.json', files['meta.json']);
    ok(r.status === 200, "another company's cap is its own");

    // Last: a POST to a public job (the iPhone app's "is it locked?" answer is 405). wrangler dev leaves the
    // next request on that Worker hanging after a POST whose body was never read, so these go at the end.
    console.log('public job POST (the app reads 405 as "no passcode needed"): this branch vs master');
    for (const job of ['georgeville', 'casper-arena', 'kelowna', 'steamboat']) {
      const init = { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'code=ABCD-1234' };
      const [a, b] = await Promise.all([once(N + `/view/${job}/`, init), once(O + `/view/${job}/`, init)]);
      ok(a.status === 405 && b.status === 405, `POST /view/${job}/ -> ${a.status} (master ${b.status})`);
      await Promise.all([once(N + '/robots.txt', { method: 'GET', headers: {}, wait: 3000 }).catch(() => null), once(O + '/robots.txt', { method: 'GET', headers: {}, wait: 3000 }).catch(() => null)]);
    }
  } finally {
    stop(pNew); stop(pOld);
  }
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
