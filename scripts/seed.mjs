#!/usr/bin/env node
/**
 * 初期データ投入用 SQL ジェネレータ
 *
 * 使い方:
 *   # 環境変数で本番値を上書き可能。省略時はテスト用デフォルトを使う。
 *   node scripts/seed.mjs > /tmp/seed.sql
 *   wrangler d1 execute SALON_DB --local  --file=/tmp/seed.sql
 *   wrangler d1 execute SALON_DB --remote --file=/tmp/seed.sql
 *
 * 投入内容:
 *   - platform_admins: admin@officeplata.jp / ADMIN_PASSWORD
 *   - salons (テナント): calmer-kirishima / app_token は実 BASE のもの
 *   - users (テストスタッフ): rumi@calmer-kirishima.localhost / TEST_USER_PASSWORD
 *
 * 注: 実 BASE の app_token とテーブル ID は
 *     https://yjpw4ydvu698.jp.larksuite.com/base/TC4QbGyrLarVFcsqmNIjrzmLp4f
 *     のものをデフォルトとして入れる。LARK_APP_ID / LARK_APP_SECRET だけは
 *     環境変数で渡すか、後で Dashboard から設定する。
 */

import bcrypt from "bcryptjs";

const env = process.env;

const config = {
  adminEmail: env.ADMIN_EMAIL || "admin@officeplata.jp",
  adminName: env.ADMIN_NAME || "OFFICE PLATA 管理者",
  adminPassword: env.ADMIN_PASSWORD || "changeme-admin",

  salonName: env.SALON_NAME || "Calmer 霧島店",
  salonSlug: env.SALON_SLUG || "calmer-kirishima",
  themeId: env.THEME_ID || "calmer",

  // 実 BASE (URL: .../base/TC4QbGyrLarVFcsqmNIjrzmLp4f) のテーブル構造
  larkAppId: env.LARK_APP_ID || "",
  larkAppSecret: env.LARK_APP_SECRET || "",
  larkBitableAppToken: env.LARK_BITABLE_APP_TOKEN || "TC4QbGyrLarVFcsqmNIjrzmLp4f",
  larkYearlyGoalTableId: env.LARK_YEARLY_GOAL_TABLE_ID || "tblABnUfoY8XMaD0",
  larkMonthlyGoalTableId: env.LARK_MONTHLY_GOAL_TABLE_ID || "tblhOI7T3lu5T7xM",
  larkCustomerTableId: env.LARK_CUSTOMER_TABLE_ID || "tblaxZtrnk0jwBjB",
  larkKarteTableId: env.LARK_KARTE_TABLE_ID || "tbl4Crds3zemyxUp",
  larkSalesTableId: env.LARK_SALES_TABLE_ID || "tbl2ZzvKO8q5NEh7",

  testUserEmail: env.TEST_USER_EMAIL || "rumi@calmer-kirishima.localhost",
  testUserName: env.TEST_USER_NAME || "るみ",
  testUserPassword: env.TEST_USER_PASSWORD || "changeme-staff",
  testUserRole: env.TEST_USER_ROLE || "owner",
};

function escapeSqlText(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

const adminHash = bcrypt.hashSync(config.adminPassword, 10);
const userHash = bcrypt.hashSync(config.testUserPassword, 10);

const sql = `-- ============================================================
-- Phase 0-1: 初期データ
-- 生成時刻: ${new Date().toISOString()}
-- ============================================================

-- プラットフォーム管理者
INSERT OR IGNORE INTO platform_admins (email, password_hash, display_name)
VALUES (
  ${escapeSqlText(config.adminEmail)},
  ${escapeSqlText(adminHash)},
  ${escapeSqlText(config.adminName)}
);

-- サロン（テナント）
INSERT INTO salons (
  salon_name, slug, subdomain, theme_id,
  lark_app_id, lark_app_secret, lark_bitable_app_token,
  lark_customer_table_id, lark_karte_table_id,
  lark_monthly_goal_table_id, lark_yearly_goal_table_id,
  lark_sales_table_id
)
SELECT
  ${escapeSqlText(config.salonName)},
  ${escapeSqlText(config.salonSlug)},
  ${escapeSqlText(config.salonSlug)},
  ${escapeSqlText(config.themeId)},
  ${escapeSqlText(config.larkAppId || null)},
  ${escapeSqlText(config.larkAppSecret || null)},
  ${escapeSqlText(config.larkBitableAppToken)},
  ${escapeSqlText(config.larkCustomerTableId)},
  ${escapeSqlText(config.larkKarteTableId)},
  ${escapeSqlText(config.larkMonthlyGoalTableId)},
  ${escapeSqlText(config.larkYearlyGoalTableId)},
  ${escapeSqlText(config.larkSalesTableId)}
WHERE NOT EXISTS (SELECT 1 FROM salons WHERE slug = ${escapeSqlText(config.salonSlug)});

-- テストユーザー（サロンスタッフ）
INSERT INTO users (salon_id, email, password_hash, display_name, role)
SELECT
  s.id,
  ${escapeSqlText(config.testUserEmail)},
  ${escapeSqlText(userHash)},
  ${escapeSqlText(config.testUserName)},
  ${escapeSqlText(config.testUserRole)}
FROM salons s
WHERE s.slug = ${escapeSqlText(config.salonSlug)}
  AND NOT EXISTS (
    SELECT 1 FROM users u
     WHERE u.salon_id = s.id AND u.email = ${escapeSqlText(config.testUserEmail)}
  );
`;

process.stdout.write(sql);

// ヒント (stderr に出すのでパイプには載らない)
process.stderr.write(
  `
[seed] generated SQL with:
  admin    : ${config.adminEmail} / ${config.adminPassword}
  salon    : ${config.salonName} (slug=${config.salonSlug})
  bitable  : ${config.larkBitableAppToken}
  user     : ${config.testUserEmail} / ${config.testUserPassword} (role=${config.testUserRole})

apply with:
  node scripts/seed.mjs > /tmp/seed.sql
  wrangler d1 execute SALON_DB --local --file=/tmp/seed.sql
`
);
