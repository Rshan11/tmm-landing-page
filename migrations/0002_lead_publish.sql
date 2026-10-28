-- "Send to The Lead" (worker/lead.js): jobs a company publishes from its own TMM app.
-- lead_keys: one publish key per company; only sha256(key) is stored (the key lives in that company's
--            TMM app as the Fly secret TMM_LEAD_PUBLISH_KEY).
-- lead_jobs: slug -> the company that owns it, the passcode hashes (same scheme as worker/private.js:
--            code_hash = sha256("<slug>:<CODE>"), cookie_hash = sha256(sha256("ck:<slug>:<CODE>"))), and the
--            R2 version (view/<slug>/<ver>/<file>) the job serves now. The passcode itself is never sent here.
-- lead_tries: wrong passcode tries per job and address (10 per 15 minutes).
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
  cookie_hash TEXT NOT NULL,
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
