-- Salon Form System: D1 (SQLite) Schema
-- Run: wrangler d1 execute SALON_DB --remote --file=./drizzle/migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS salons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  theme_id TEXT NOT NULL DEFAULT 'calmer',
  logo_url TEXT,
  lark_app_id TEXT,
  lark_app_secret TEXT,
  lark_bitable_app_token TEXT,
  lark_customer_table_id TEXT,
  lark_monthly_goal_table_id TEXT,
  lark_yearly_goal_table_id TEXT,
  lark_karte_table_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_id INTEGER NOT NULL,
  form_type TEXT NOT NULL,
  form_data TEXT NOT NULL,
  lark_synced INTEGER NOT NULL DEFAULT 0,
  lark_record_id TEXT,
  sync_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (salon_id) REFERENCES salons(id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_salon ON submissions(salon_id);
CREATE INDEX IF NOT EXISTS idx_submissions_form_type ON submissions(form_type);
CREATE INDEX IF NOT EXISTS idx_salons_slug ON salons(slug);
