-- Private visit counter (worker/stats.js). No raw IP or UA: vh is a salted, daily SHA-256.
CREATE TABLE IF NOT EXISTS views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,              -- epoch ms
  day TEXT NOT NULL,                -- UTC YYYY-MM-DD
  path TEXT NOT NULL,
  vh TEXT NOT NULL,                 -- SHA-256(ip|ua|day|STATS_SALT), 24 hex
  device TEXT NOT NULL,             -- iPhone / iPad / Android / Android tablet / desktop
  ref TEXT NOT NULL DEFAULT '',     -- off-site referrer host only
  country TEXT NOT NULL DEFAULT ''  -- request.cf.country
);
CREATE INDEX IF NOT EXISTS views_path_day ON views (path, day);
