-- ============================================================
-- Phase B-1: Platform Admin (OFFICE PLATA 側) のセッション
-- ============================================================
-- 加盟店スタッフ用の sessions と混在させないために別テーブルを用意。
-- Cookie 名も別 (platform_session) にして、サロンスタッフセッションと
-- 平行運用できるようにする。
--
-- 実行:
--   wrangler d1 execute SALON_DB --local --file=./drizzle/migrations/0003_platform.sql
--   wrangler d1 execute SALON_DB --remote --file=./drizzle/migrations/0003_platform.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_sessions (
  token TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (admin_id) REFERENCES platform_admins(id)
);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_admin ON platform_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_expires ON platform_sessions(expires_at);
