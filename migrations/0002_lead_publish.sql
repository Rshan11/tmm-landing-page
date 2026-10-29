-- "Send to The Lead" (worker/lead.js): jobs a company publishes from its own TMM app.
-- lead_keys: one publish key per company; only sha256(key) is stored (the key lives in that company's
--            TMM app as the Fly secret TMM_LEAD_PUBLISH_KEY).
-- lead_jobs: slug -> the company that owns it, the passcode check (code_hash = sha256("<code_salt>:<slug>:<CODE>"),
--            code_salt random per job; the cookie is an HMAC with the LEAD_COOKIE_SECRET Worker secret, never
--            stored), and the R2 version (view/<slug>/<ver>/<file>) the job serves now. The passcode itself
--            is never sent here.
-- lead_tries: wrong passcodes and wrong passcode cookies, per job x address (10 per 15 minutes) and per job
--            (50 per hour), for every locked job (hand-made ones too). Rows older than a day are swept.
-- lead_usage: bytes uploaded per company per UTC day (cap LEAD_DAILY_BYTES, default 1 GB).
CREATE TABLE IF NOT EXISTS lead_keys (
  key_hash TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS lead_keys_company ON lead_keys (company);
CREATE TABLE IF NOT EXISTS lead_jobs (
  slug TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  ver TEXT NOT NULL,
  prev_ver TEXT NOT NULL DEFAULT '',
  files TEXT NOT NULL,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  publishes INTEGER NOT NULL DEFAULT 1,
  removed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS lead_jobs_company ON lead_jobs (company);
CREATE TABLE IF NOT EXISTS lead_tries (k TEXT PRIMARY KEY, n INTEGER NOT NULL, ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS lead_tries_ts ON lead_tries (ts);
CREATE TABLE IF NOT EXISTS lead_usage (company TEXT NOT NULL, day TEXT NOT NULL, bytes INTEGER NOT NULL, PRIMARY KEY (company, day));
