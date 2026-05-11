/**
 * テナント解決ミドルウェア (Cloudflare Pages Functions 用)
 *
 * Host ヘッダーからサブドメインを抽出し、salons テーブルから
 * テナント (= サロン) を引き当てる。
 *
 * 想定ドメイン:
 *   本番:   {subdomain}.crm.example.com
 *   ローカル: {subdomain}.localhost:8788
 *   Pages:  {subdomain}.lark-headspa.pages.dev
 *
 * 単一テナントしかない開発ではクエリパラメータ ?tenant=slug や
 * X-Tenant-Slug ヘッダーでの上書きを許可する。
 */

import type { SalonLarkConfig, TenantInfo } from "../../shared/types";

export interface TenantEnv {
  SALON_DB: D1Database;
}

export interface SalonRow {
  id: number;
  salon_name: string;
  slug: string;
  subdomain: string | null;
  theme_id: string;
  logo_url: string | null;
  lark_app_id: string | null;
  lark_app_secret: string | null;
  lark_bitable_app_token: string | null;
  lark_customer_table_id: string | null;
  lark_karte_table_id: string | null;
  lark_monthly_goal_table_id: string | null;
  lark_yearly_goal_table_id: string | null;
  lark_sales_table_id: string | null;
  is_active: number;
}

/** Host 文字列からサブドメインを抜き出す。 */
export function extractSubdomain(host: string | null): string | null {
  if (!host) return null;
  // ポートを切る
  const hostname = host.split(":")[0].toLowerCase();

  // 完全に localhost / IP は null
  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;

  const parts = hostname.split(".");

  // *.localhost (例: calmer-kirishima.localhost) → 先頭をテナント扱い
  if (parts[parts.length - 1] === "localhost") {
    return parts.length >= 2 ? parts[0] : null;
  }

  // 標準ドメイン: a.b.c → 先頭がサブドメイン
  // ただし *.pages.dev のような3階層では先頭をテナント名と仮定
  if (parts.length >= 3) return parts[0];

  return null;
}

/**
 * リクエストから (Host / クエリ / ヘッダー) を見てテナントを解決する。
 */
export async function resolveTenant(
  env: TenantEnv,
  options: { host: string | null; query?: string | null; header?: string | null }
): Promise<SalonRow | null> {
  // 優先順位: explicit header > query > subdomain
  const candidate =
    (options.header && options.header.trim()) ||
    (options.query && options.query.trim()) ||
    extractSubdomain(options.host);

  if (!candidate) return null;

  // subdomain 列で探す → なければ slug でフォールバック
  return env.SALON_DB.prepare(
    `SELECT * FROM salons
       WHERE (subdomain = ? OR slug = ?) AND is_active = 1 LIMIT 1`
  )
    .bind(candidate, candidate)
    .first<SalonRow>();
}

/** SalonRow → クライアントに渡せる TenantInfo に整形 */
export function toTenantInfo(salon: SalonRow): TenantInfo {
  return {
    id: salon.id,
    salonName: salon.salon_name,
    slug: salon.slug,
    subdomain: salon.subdomain || salon.slug,
    themeId: salon.theme_id,
    logoUrl: salon.logo_url,
  };
}

/** SalonRow → LarkClient 用設定。未設定なら null。 */
export function toLarkConfig(salon: SalonRow): SalonLarkConfig | null {
  if (!salon.lark_app_id || !salon.lark_app_secret || !salon.lark_bitable_app_token) {
    return null;
  }
  return {
    appId: salon.lark_app_id,
    appSecret: salon.lark_app_secret,
    bitableAppToken: salon.lark_bitable_app_token,
    tables: {
      customer: salon.lark_customer_table_id || "",
      karte: salon.lark_karte_table_id || "",
      monthlyGoal: salon.lark_monthly_goal_table_id || "",
      yearlyGoal: salon.lark_yearly_goal_table_id || "",
      sales: salon.lark_sales_table_id || "",
    },
  };
}
