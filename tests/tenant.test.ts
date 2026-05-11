/**
 * テナント解決ロジックの単体テスト
 */
import { describe, it, expect } from "vitest";
import { extractSubdomain, toLarkConfig, toTenantInfo, type SalonRow } from "../src/lib/tenant";

describe("extractSubdomain", () => {
  const cases: Array<[string | null, string | null]> = [
    ["calmer-kirishima.crm.example.com", "calmer-kirishima"],
    ["calmer-kirishima.localhost:8788", "calmer-kirishima"],
    ["calmer-kirishima.localhost", "calmer-kirishima"],
    ["calmer-kirishima.lark-headspa.pages.dev", "calmer-kirishima"],
    ["localhost", null],
    ["localhost:8788", null],
    ["127.0.0.1:8788", null],
    ["example.com", null], // 2階層は不可
    [null, null],
  ];
  for (const [host, expected] of cases) {
    it(`${host ?? "null"} → ${expected ?? "null"}`, () => {
      expect(extractSubdomain(host)).toBe(expected);
    });
  }
});

describe("toTenantInfo", () => {
  it("camelCase に整形される", () => {
    const row: SalonRow = baseRow({ subdomain: "shop1" });
    const info = toTenantInfo(row);
    expect(info).toEqual({
      id: 1,
      salonName: "テストサロン",
      slug: "shop1",
      subdomain: "shop1",
      themeId: "calmer",
      logoUrl: null,
    });
  });

  it("subdomain が null なら slug がフォールバック", () => {
    const row = baseRow({ subdomain: null });
    expect(toTenantInfo(row).subdomain).toBe("shop1");
  });
});

describe("toLarkConfig", () => {
  it("必須 3 値が揃わなければ null", () => {
    expect(toLarkConfig(baseRow({ lark_app_id: null }))).toBe(null);
    expect(toLarkConfig(baseRow({ lark_app_secret: null }))).toBe(null);
    expect(toLarkConfig(baseRow({ lark_bitable_app_token: null }))).toBe(null);
  });

  it("揃っていれば構造化された設定を返す", () => {
    const config = toLarkConfig(baseRow());
    expect(config).not.toBeNull();
    expect(config!.appId).toBe("app");
    expect(config!.bitableAppToken).toBe("TC4Q...");
    expect(config!.tables.customer).toBe("tblaxZtrnk0jwBjB");
    expect(config!.tables.karte).toBe("tbl4Crds3zemyxUp");
    expect(config!.tables.sales).toBe("tbl2ZzvKO8q5NEh7");
  });
});

function baseRow(overrides: Partial<SalonRow> = {}): SalonRow {
  return {
    id: 1,
    salon_name: "テストサロン",
    slug: "shop1",
    subdomain: "shop1",
    theme_id: "calmer",
    logo_url: null,
    lark_app_id: "app",
    lark_app_secret: "secret",
    lark_bitable_app_token: "TC4Q...",
    lark_customer_table_id: "tblaxZtrnk0jwBjB",
    lark_karte_table_id: "tbl4Crds3zemyxUp",
    lark_monthly_goal_table_id: "tblhOI7T3lu5T7xM",
    lark_yearly_goal_table_id: "tblABnUfoY8XMaD0",
    lark_sales_table_id: "tbl2ZzvKO8q5NEh7",
    is_active: 1,
    ...overrides,
  };
}
