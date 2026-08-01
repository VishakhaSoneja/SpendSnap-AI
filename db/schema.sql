-- SpendSnap AI - SQLite schema
-- Executed automatically on startup by config/db.js (CREATE IF NOT EXISTS).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name      TEXT    NOT NULL,
  email          TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  phone          TEXT    NOT NULL DEFAULT '',
  password       TEXT    NOT NULL,
  profile_image  TEXT    NOT NULL DEFAULT '',
  currency       TEXT    NOT NULL DEFAULT 'INR',
  monthly_budget REAL    NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           TEXT    NOT NULL CHECK (type IN ('Income', 'Expense', 'Investment')),
  category       TEXT    NOT NULL,
  amount         REAL    NOT NULL CHECK (amount >= 0),
  payment_method TEXT    NOT NULL DEFAULT 'Other',
  note           TEXT    NOT NULL DEFAULT '',
  receipt        TEXT    NOT NULL DEFAULT '',
  date           TEXT    NOT NULL,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS budgets (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month            TEXT    NOT NULL,
  monthly_budget   REAL    NOT NULL DEFAULT 0,
  total_spent      REAL    NOT NULL DEFAULT 0,
  remaining_budget REAL    NOT NULL DEFAULT 0,
  saving_goal      REAL    NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL,
  UNIQUE (user_id, month)
);

CREATE TABLE IF NOT EXISTS goals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  target_amount REAL    NOT NULL CHECK (target_amount > 0),
  saved_amount  REAL    NOT NULL DEFAULT 0,
  deadline      TEXT,
  category      TEXT    NOT NULL DEFAULT 'Other',
  status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'achieved')),
  note          TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_insights (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  message    TEXT    NOT NULL,
  priority   TEXT    NOT NULL DEFAULT 'low' CHECK (priority IN ('low', 'medium', 'high')),
  category   TEXT    NOT NULL DEFAULT 'Overall',
  dedupe_key TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  UNIQUE (user_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  message    TEXT    NOT NULL,
  type       TEXT    NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'danger')),
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL
);

-- Lookup indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_date  ON transactions (user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type  ON transactions (user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_cat   ON transactions (user_id, category);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month      ON budgets (user_id, month);
CREATE INDEX IF NOT EXISTS idx_goals_user              ON goals (user_id);
CREATE INDEX IF NOT EXISTS idx_insights_user_created   ON ai_insights (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, is_read);
