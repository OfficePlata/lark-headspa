-- ============================================================
-- Phase 0-1: 認証・テナント基盤
-- ============================================================
-- 既存の salons テーブルをマルチテナントの「テナント」として扱う。
-- 売上・分析テーブル (tbl2ZzvKO8q5NEh7) を保存できる列を salons に追加。
-- 認証用に users / sessions / platform_admins / login_failures を追加。
--
-- 実行:
--   wrangler d1 execute SALON_DB --local --file=./drizzle/migrations/0002_auth.sql
--   wrangler d1 execute SALON_DB --remote --file=./drizzle/migrations/0002_auth.sql
-- ============================================================

-- 既存 salons に「売上・分析」テーブル ID と表示用列を追加（冪等）
ALTER TABLE salons ADD COLUMN lark_sales_table_id TEXT;
ALTER TABLE salons ADD COLUMN subdomain TEXT;

-- subdomain は slug と同値で運用するため初期値をコピー
UPDATE salons SET subdomain = slug WHERE subdomain IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_salons_subdomain ON salons(subdomain);

-- ------------------------------------------------------------
-- ユーザー（サロンスタッフ）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff', -- 'owner' | 'staff'
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (salon_id, email),
  FOREIGN KEY (salon_id) REFERENCES salons(id)
);
CREATE INDEX IF NOT EXISTS idx_users_salon ON users(salon_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ------------------------------------------------------------
-- セッション
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,            -- 32バイト乱数の hex 文字列
  user_id INTEGER NOT NULL,
  salon_id INTEGER NOT NULL,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (salon_id) REFERENCES salons(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ------------------------------------------------------------
-- プラットフォーム管理者（OFFICE PLATA 側スタッフ）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- ログイン失敗カウント（簡易ロックアウト用）
--   KV にも同じ情報を持たせるが、永続記録としてここに置く
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_id INTEGER,
  email TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_failures_email ON login_failures(email, occurred_at);
