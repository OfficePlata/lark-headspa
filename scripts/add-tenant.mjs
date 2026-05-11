#!/usr/bin/env node
/**
 * 新規加盟店（テナント）追加スクリプト
 *
 * 使い方:
 *   SLUG=calmer-shimotsuke \
 *   SALON_NAME="Calmer 下野店" \
 *   OWNER_EMAIL="owner@calmer-shimotsuke.localhost" \
 *   OWNER_NAME="下野オーナー" \
 *   OWNER_PASSWORD="changeme" \
 *   BITABLE_APP_TOKEN="TC4QbGyrLarVFcsqmNIjrzmLp4f" \
 *   CUSTOMER_TABLE_ID="tblaxZtrnk0jwBjB" \
 *   KARTE_TABLE_ID="tbl4Crds3zemyxUp" \
 *   MONTHLY_GOAL_TABLE_ID="tblhOI7T3lu5T7xM" \
 *   YEARLY_GOAL_TABLE_ID="tblABnUfoY8XMaD0" \
 *   SALES_TABLE_ID="tbl2ZzvKO8q5NEh7" \
 *   node scripts/add-tenant.mjs > /tmp/add-tenant.sql
 *
 *   # ローカルへ適用
 *   wrangler d1 execute SALON_DB --local --file=/tmp/add-tenant.sql
 *   # 本番へ適用
 *   wrangler d1 execute SALON_DB --remote --file=/tmp/add-tenant.sql
 *
 * オプション環境変数:
 *   THEME_ID            ... テーマ ID（デフォルト: calmer）
 *   LARK_APP_ID         ... 加盟店固有のLark App ID（省略時は全社共通の想定で空）
 *   LARK_APP_SECRET     ... 同上
 *   OWNER_ROLE          ... owner | staff（デフォルト: owner）
 *   SUBDOMAIN           ... サブドメイン（デフォルト: SLUG と同じ）
 *
 * 同じ SLUG が既に存在する場合は salons の挿入はスキップされる。
 * 同じ (salon_id, owner_email) のユーザーも重複追加されない。
 */

import bcrypt from "bcryptjs";

const env = process.env;

function required(key) {
  const v = env[key];
  if (!v || !v.trim()) {
    process.stderr.write(`[add-tenant] ${key} は必須です\n`);
    process.exit(1);
  }
  return v.trim();
}

const config = {
  slug: required("SLUG"),
  salonName: required("SALON_NAME"),
  themeId: env.THEME_ID || "calmer",
  subdomain: env.SUBDOMAIN || env.SLUG,

  // Lark BASE 接続情報
  larkAppId: env.LARK_APP_ID || "",
  larkAppSecret: env.LARK_APP_SECRET || "",
  bitableAppToken: required("BITABLE_APP_TOKEN"),
  customerTableId: required("CUSTOMER_TABLE_ID"),
  karteTableId: required("KARTE_TABLE_ID"),
  monthlyGoalTableId: required("MONTHLY_GOAL_TABLE_ID"),
  yearlyGoalTableId: required("YEARLY_GOAL_TABLE_ID"),
  salesTableId: required("SALES_TABLE_ID"),

  // 初期オーナー
  ownerEmail: required("OWNER_EMAIL"),
  ownerName: required("OWNER_NAME"),
  ownerPassword: required("OWNER_PASSWORD"),
  ownerRole: env.OWNER_ROLE || "owner",
};

function esc(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

const ownerHash = bcrypt.hashSync(config.ownerPassword, 10);

const sql = `-- ============================================================
-- 加盟店追加: ${config.salonName} (slug=${config.slug})
-- 生成時刻: ${new Date().toISOString()}
-- ============================================================

-- サロン（テナント）を追加。同じ slug が既にあればスキップ
INSERT INTO salons (
  salon_name, slug, subdomain, theme_id,
  lark_app_id, lark_app_secret, lark_bitable_app_token,
  lark_customer_table_id, lark_karte_table_id,
  lark_monthly_goal_table_id, lark_yearly_goal_table_id,
  lark_sales_table_id
)
SELECT
  ${esc(config.salonName)},
  ${esc(config.slug)},
  ${esc(config.subdomain)},
  ${esc(config.themeId)},
  ${esc(config.larkAppId || null)},
  ${esc(config.larkAppSecret || null)},
  ${esc(config.bitableAppToken)},
  ${esc(config.customerTableId)},
  ${esc(config.karteTableId)},
  ${esc(config.monthlyGoalTableId)},
  ${esc(config.yearlyGoalTableId)},
  ${esc(config.salesTableId)}
WHERE NOT EXISTS (SELECT 1 FROM salons WHERE slug = ${esc(config.slug)});

-- 初期オーナーユーザーを追加（同じメールが既にあればスキップ）
INSERT INTO users (salon_id, email, password_hash, display_name, role)
SELECT
  s.id,
  ${esc(config.ownerEmail.toLowerCase())},
  ${esc(ownerHash)},
  ${esc(config.ownerName)},
  ${esc(config.ownerRole)}
FROM salons s
WHERE s.slug = ${esc(config.slug)}
  AND NOT EXISTS (
    SELECT 1 FROM users u
     WHERE u.salon_id = s.id AND u.email = ${esc(config.ownerEmail.toLowerCase())}
  );

-- 既存サロンの Lark 接続情報を最新値で UPDATE（slug 一致のみ）
--   (slug は既存で、テーブル ID を変更する場合に効く)
UPDATE salons SET
  salon_name = ${esc(config.salonName)},
  subdomain = COALESCE(subdomain, ${esc(config.subdomain)}),
  theme_id = ${esc(config.themeId)},
  lark_app_id = COALESCE(NULLIF(${esc(config.larkAppId || null)}, ''), lark_app_id),
  lark_app_secret = COALESCE(NULLIF(${esc(config.larkAppSecret || null)}, ''), lark_app_secret),
  lark_bitable_app_token = ${esc(config.bitableAppToken)},
  lark_customer_table_id = ${esc(config.customerTableId)},
  lark_karte_table_id = ${esc(config.karteTableId)},
  lark_monthly_goal_table_id = ${esc(config.monthlyGoalTableId)},
  lark_yearly_goal_table_id = ${esc(config.yearlyGoalTableId)},
  lark_sales_table_id = ${esc(config.salesTableId)},
  updated_at = datetime('now')
WHERE slug = ${esc(config.slug)};
`;

process.stdout.write(sql);

process.stderr.write(`
[add-tenant] generated SQL:
  salon       : ${config.salonName} (slug=${config.slug}, subdomain=${config.subdomain})
  base token  : ${config.bitableAppToken}
  tables      : 顧客=${config.customerTableId} / カルテ=${config.karteTableId}
                月間=${config.monthlyGoalTableId} / 年間=${config.yearlyGoalTableId} / 売上=${config.salesTableId}
  owner       : ${config.ownerName} <${config.ownerEmail}> (role=${config.ownerRole})

apply with:
  # ローカル
  wrangler d1 execute SALON_DB --local --file=/tmp/add-tenant.sql
  # 本番
  wrangler d1 execute SALON_DB --remote --file=/tmp/add-tenant.sql

access URL:
  https://lark-headspa.pages.dev/login?tenant=${config.slug}
`);
