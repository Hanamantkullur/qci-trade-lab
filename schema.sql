-- QCI Trade Lab — D1 schema
-- Apply with:  npx wrangler d1 execute qci-trade-lab --file=./schema.sql --remote

CREATE TABLE IF NOT EXISTS datasets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,          -- internal, e.g. "XAUUSD 15M 2023"
  symbol_label TEXT,                      -- what students see, e.g. "Metal A"
  timeframe    TEXT,
  decimals     INTEGER NOT NULL DEFAULT 2,
  bars         INTEGER NOT NULL,
  r2_key       TEXT    NOT NULL,
  breaks       TEXT    NOT NULL DEFAULT '[]',  -- indices where the series is discontinuous
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS drills (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id    INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  title         TEXT    NOT NULL,
  objective     TEXT,                     -- the one lesson this drill teaches
  level         INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  start_index   INTEGER NOT NULL,
  visible_bars  INTEGER NOT NULL DEFAULT 90,
  forward_bars  INTEGER NOT NULL DEFAULT 60,
  max_trades    INTEGER NOT NULL DEFAULT 3,
  atr           REAL,
  decimals      INTEGER NOT NULL DEFAULT 2,
  symbol_label  TEXT,
  timeframe     TEXT,
  structure     TEXT,                     -- TREND | RANGE | SWEEP | BREAKOUT, when found by the scanner
  bias          TEXT,                     -- UP | DOWN | NO_TRADE — what the window actually did
  r2_key        TEXT    NOT NULL,         -- the extracted window, sliced at creation
  status        TEXT    NOT NULL DEFAULT 'draft',  -- draft | live | retired
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  phone      TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  drill_id    INTEGER NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  token       TEXT    NOT NULL,           -- random, proves this browser owns the run
  cursor      INTEGER NOT NULL DEFAULT 0, -- bars revealed beyond the visible window
  trades      TEXT    NOT NULL DEFAULT '[]',
  stats       TEXT,
  score       TEXT,
  total_score INTEGER,
  total_r     REAL,
  finished_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (drill_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_drills_live    ON drills (status, level, sort_order);
CREATE INDEX IF NOT EXISTS idx_sessions_stud  ON sessions (student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_drill ON sessions (drill_id, total_score DESC);
