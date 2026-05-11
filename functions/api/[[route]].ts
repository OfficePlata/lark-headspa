/**
 * Cloudflare Pages Functions - Hono API Server
 * All API routes under /api/* are handled here
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { THEMES, THEME_LIST, getTheme, DEFAULT_FORM_CONFIGS, FORM_TYPES, LARK_READONLY_FIELDS } from "../../shared/themes";
import type { TenantInfo, SessionInfo } from "../../shared/types";
import { ERROR_CODES } from "../../shared/types";
import {
  buildClearCookie,
  buildSessionCookie,
  clearLoginFailures,
  createSession,
  deleteSession,
  getSession,
  isLockedOut,
  readSessionTokenFromCookie,
  recordLoginFailure,
  verifyPassword,
  type AuthEnv,
  type UserRow,
} from "../../src/lib/auth";
import {
  resolveTenant,
  toLarkConfig,
  toTenantInfo,
  type SalonRow,
} from "../../src/lib/tenant";
import { LarkClient } from "../../src/lib/lark-client";
import {
  buildSearchBody,
  customerInputToFields,
  fieldsToCustomer,
  validateCustomerInput,
} from "../../src/lib/customer-mapper";
import {
  buildKarteSearchBody,
  fieldsToKarte,
  karteInputToFields,
  validateKarteInput,
} from "../../src/lib/karte-mapper";
import {
  fieldsToYearlyGoal,
  fieldsToMonthlyGoal,
  fieldsToSalesAnalytics,
  yearlyGoalInputToFields,
  monthlyGoalInputToFields,
  validateYearlyGoalInput,
  validateMonthlyGoalInput,
} from "../../src/lib/goals-mapper";
import {
  buildPlatformClearCookie,
  buildPlatformSessionCookie,
  createPlatformSession,
  deletePlatformSession,
  getPlatformSession,
  readPlatformSessionTokenFromCookie,
  verifyPlatformPassword,
  type PlatformAdminRow,
} from "../../src/lib/platform-auth";
import { hashPassword } from "../../src/lib/auth";
import type {
  CustomerInput,
  CustomerListResult,
  Customer,
  KarteInput,
  KarteListResult,
  Karte,
  YearlyGoal,
  YearlyGoalInput,
  MonthlyGoal,
  MonthlyGoalInput,
  SalesAnalytics,
  PlatformAdmin,
  PlatformSessionInfo,
  TenantSummary,
  TenantDetail,
  TenantUpsertInput,
  BitableTablesInspection,
  StaffUser,
  StaffCreateInput,
  StaffUpdateInput,
} from "../../shared/types";

// ============================================================
// Types
// ============================================================
interface Env {
  SALON_DB: D1Database;
  KV: KVNamespace;
  LARK_APP_ID?: string;
  LARK_APP_SECRET?: string;
  AUTH_SECRET?: string;
  LARK_DOMAIN?: string;
}

// ── 共通ヘルパー: API レスポンス整形 ──
function ok<T>(data: T) {
  return { ok: true as const, data };
}
function err(code: string, message: string, field?: string) {
  return { ok: false as const, error: { code, message, ...(field ? { field } : {}) } };
}

interface Salon {
  id: number;
  salon_name: string;
  slug: string;
  theme_id: string;
  logo_url: string | null;
  lark_app_id: string | null;
  lark_app_secret: string | null;
  lark_bitable_app_token: string | null;
  lark_customer_table_id: string | null;
  lark_monthly_goal_table_id: string | null;
  lark_yearly_goal_table_id: string | null;
  lark_karte_table_id: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface Submission {
  id: number;
  salon_id: number;
  form_type: string;
  form_data: string;
  lark_synced: number;
  lark_record_id: string | null;
  sync_error: string | null;
  created_at: string;
}

// ============================================================
// Lark API Helpers
// ============================================================
async function getTenantAccessToken(appId: string, appSecret: string): Promise<string> {
  const res = await fetch("https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const data = await res.json() as any;
  if (data.code !== 0) {
    throw new Error(`Lark auth failed: ${data.msg || "Unknown error"}`);
  }
  return data.tenant_access_token;
}

async function createBitableRecord(
  appId: string,
  appSecret: string,
  appToken: string,
  tableId: string,
  fields: Record<string, unknown>
): Promise<{ recordId: string }> {
  const token = await getTenantAccessToken(appId, appSecret);
  const res = await fetch(
    `https://open.larksuite.com/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    }
  );
  const data = await res.json() as any;
  if (data.code !== 0) {
    throw new Error(`Lark Bitable error: ${data.msg || "Unknown"} (code: ${data.code})`);
  }
  return { recordId: data.data?.record?.record_id || "" };
}

/**
 * Extract plain text from a Lark Bitable field value.
 * Lark returns different shapes depending on field type:
 *   - Text / AutoNumber: plain string  → "C-001"
 *   - Formula (text result): { type: 1, value: ["text"] }
 *   - Formula (number): { type: 2, value: [123] }
 *   - Lookup: [{ type: "text", text: "abc" }] or [{ text: "abc" }]
 *   - RichText / Link segments: [{ type: "text", text: "..." }, ...]
 *   - Object with text property: { text: "..." }
 *   - Other: try JSON.stringify fallback
 */
function extractLarkFieldText(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);

  // Array form: [{ text: "a" }, { text: "b" }] or ["a", "b"]
  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "number") return String(item);
        if (item && typeof item === "object" && "text" in item) return String((item as any).text);
        return "";
      })
      .filter(Boolean)
      .join("");
  }

  // Object form: { type: N, value: [...] } (Formula)
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    if ("value" in obj) {
      // Recursive: value is usually an array
      return extractLarkFieldText(obj.value);
    }
    if ("text" in obj) {
      return String(obj.text);
    }
  }

  // Fallback
  return "";
}

/**
 * Fetch customer list from Lark Bitable (顧客情報テーブル)
 * Returns list of { recordId, customerNo, name } for the customer_lookup field
 */
async function fetchCustomerList(
  appId: string,
  appSecret: string,
  appToken: string,
  tableId: string
): Promise<Array<{ recordId: string; customerNo: string; name: string }>> {
  const token = await getTenantAccessToken(appId, appSecret);

  const customers: Array<{ recordId: string; customerNo: string; name: string }> = [];
  let pageToken: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(
      `https://open.larksuite.com/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`
    );
    url.searchParams.set("page_size", "100");
    if (pageToken) {
      url.searchParams.set("page_token", pageToken);
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json() as any;

    if (data.code !== 0) {
      throw new Error(`Lark Bitable list error: ${data.msg || "Unknown"} (code: ${data.code})`);
    }

    const items = data.data?.items || [];
    for (const item of items) {
      const fields = item.fields || {};
      // Extract plain text from Lark field values
      // Lark returns different formats depending on field type:
      //   Text: "string"
      //   AutoNumber: "C-001"
      //   Formula/Lookup: { type: 0, value: [...] } or [{ type: "text", text: "..." }]
      const customerNo = extractLarkFieldText(fields["顧客No"] ?? fields["顧客no"] ?? fields["No"] ?? "");
      const sei = extractLarkFieldText(fields["姓"] ?? "");
      const mei = extractLarkFieldText(fields["名前"] ?? fields["名"] ?? "");
      const shimei = extractLarkFieldText(fields["氏名"] ?? "");
      const displayName = shimei || `${sei} ${mei}`.trim() || "名前なし";

      customers.push({
        recordId: item.record_id,
        customerNo: customerNo || item.record_id,
        name: displayName,
      });
    }

    hasMore = data.data?.has_more || false;
    pageToken = data.data?.page_token;
  }

  return customers;
}

/**
 * Upload a file to Lark Drive for use as a Bitable attachment.
 * For Bitable attachments, use parent_type = "bitable_image" 
 * and parent_node = bitable app_token.
 */
async function uploadFileToLark(
  appId: string,
  appSecret: string,
  appToken: string,
  fileData: ArrayBuffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const token = await getTenantAccessToken(appId, appSecret);

  const formData = new FormData();
  const blob = new Blob([fileData], { type: mimeType });
  formData.append("file", blob, fileName);
  formData.append("file_name", fileName);
  formData.append("parent_type", "bitable_image");
  formData.append("parent_node", appToken);
  formData.append("size", String(fileData.byteLength));

  const res = await fetch(
    "https://open.larksuite.com/open-apis/drive/v1/medias/upload_all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const data = await res.json() as any;
  if (data.code !== 0) {
    throw new Error(`Lark file upload error: ${data.msg || "Unknown"} (code: ${data.code})`);
  }

  return data.data?.file_token || "";
}

/**
 * Map form data to Lark Bitable fields
 * - Converts date strings to millisecond timestamps
 * - Converts numeric strings to numbers
 * - Handles SingleSelect and MultiSelect field types
 * - Skips read-only fields (AutoNumber, Formula, Lookup, DuplexLink)
 * - Skips photo fields (handled separately)
 */
function mapFormDataToLarkFields(
  formData: Record<string, unknown>,
  formType: string
): Record<string, unknown> {
  const larkFields: Record<string, unknown> = {};
  const readonlyFields = LARK_READONLY_FIELDS[formType] || [];
  const formConfig = DEFAULT_FORM_CONFIGS[formType as keyof typeof DEFAULT_FORM_CONFIGS];

  for (const [key, value] of Object.entries(formData)) {
    // Skip empty values
    if (value === null || value === undefined || value === "") continue;

    // Skip read-only fields
    if (readonlyFields.includes(key)) continue;

    // Find field config to determine Lark field type
    const fieldConfig = formConfig?.fields.find(
      (f) => f.fieldName === key || (f as any).larkFieldName === key
    );

    // Use larkFieldName if available, otherwise use the key as-is
    const larkFieldName = (fieldConfig as any)?.larkFieldName || key;
    const larkFieldType = (fieldConfig as any)?.larkFieldType || "";
    const fieldType = (fieldConfig as any)?.fieldType || "";

    // Skip photo fields - they are handled separately via file upload
    if (fieldType === "photo" || larkFieldType === "Attachment") continue;

    // DuplexLink (双方向関連) → plain array of record_id strings: ["recXXX"]
    // customer_lookup sends JSON: {"recordId":"recXXX","customerNo":"C-004","name":"..."}
    if (larkFieldType === "DuplexLink" || fieldType === "customer_lookup") {
      try {
        let recordId: string | null = null;
        if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            recordId = parsed.recordId || null;
          } catch {
            if (typeof value === "string" && value.startsWith("rec")) {
              recordId = value;
            }
          }
        }
        if (recordId) {
          larkFields[larkFieldName] = [recordId];
        }
      } catch (e) {
        console.error("DuplexLink parse error:", e);
      }
      continue;
    }

    // Date values → millisecond timestamps
    if (larkFieldType === "DateTime" || (typeof value === "string" && /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(value))) {
      const dateStr = typeof value === "string" ? value.replace(/\//g, "-") : String(value);
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        larkFields[larkFieldName] = date.getTime();
        continue;
      }
    }

    // Year-month values → keep as text for Text fields
    if (typeof value === "string" && /^\d{4}[-/]\d{2}$/.test(value)) {
      if (larkFieldType === "Text") {
        larkFields[larkFieldName] = value;
        continue;
      }
      // If DateTime, convert to timestamp
      const date = new Date(value.replace(/\//g, "-") + "-01");
      if (!isNaN(date.getTime())) {
        larkFields[larkFieldName] = date.getTime();
        continue;
      }
    }

    // MultiSelect → must be array of strings
    if (larkFieldType === "MultiSelect") {
      if (Array.isArray(value)) {
        larkFields[larkFieldName] = value;
      } else if (typeof value === "string") {
        larkFields[larkFieldName] = [value];
      }
      continue;
    }

    // SingleSelect → plain string value
    if (larkFieldType === "SingleSelect") {
      larkFields[larkFieldName] = String(value);
      continue;
    }

    // Phone → plain string
    if (larkFieldType === "Phone") {
      larkFields[larkFieldName] = String(value);
      continue;
    }

    // Currency / Number → numeric value
    if (larkFieldType === "Currency" || larkFieldType === "Number") {
      const num = Number(value);
      if (!isNaN(num)) {
        larkFields[larkFieldName] = num;
        continue;
      }
    }

    // Numeric strings (fallback)
    if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value)) {
      larkFields[larkFieldName] = Number(value);
      continue;
    }

    // Default: pass as-is
    larkFields[larkFieldName] = value;
  }

  return larkFields;
}

// ============================================================
// Hono App
// ============================================================
const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.use("/*", cors());

// Global error handler
app.onError((err, c) => {
  console.error("API Error:", err.message, err.stack);
  return c.json({ error: err.message || "Internal Server Error" }, 500);
});

// ---------- Health Check ----------
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// ---------- Theme Routes ----------
app.get("/themes", (c) => {
  return c.json(THEME_LIST.map((t) => ({
    id: t.id, name: t.name, nameJa: t.nameJa, description: t.description,
    colors: t.colors, fonts: t.fonts, borderRadius: t.borderRadius,
  })));
});

app.get("/themes/:id", (c) => {
  const theme = getTheme(c.req.param("id"));
  return c.json(theme);
});

// ---------- Salon CRUD ----------
app.get("/salons", async (c) => {
  const db = c.env.SALON_DB;
  const salons = await db.prepare("SELECT * FROM salons ORDER BY created_at DESC").all<Salon>();
  return c.json(salons.results);
});

app.post("/salons", async (c) => {
  const db = c.env.SALON_DB;
  const body = await c.req.json<{ salonName: string; slug: string; themeId?: string }>();

  if (!body.salonName || !body.slug) {
    return c.json({ error: "salonName と slug は必須です" }, 400);
  }
  if (!/^[a-z0-9-]+$/.test(body.slug)) {
    return c.json({ error: "slug は半角英数字とハイフンのみ使用できます" }, 400);
  }

  // Check slug uniqueness
  const existing = await db.prepare("SELECT id FROM salons WHERE slug = ?").bind(body.slug).first();
  if (existing) {
    return c.json({ error: "このスラッグは既に使用されています" }, 409);
  }

  const result = await db.prepare(
    "INSERT INTO salons (salon_name, slug, theme_id) VALUES (?, ?, ?)"
  ).bind(body.salonName, body.slug, body.themeId || "calmer").run();

  return c.json({ id: result.meta.last_row_id, success: true }, 201);
});

app.get("/salons/:id", async (c) => {
  const db = c.env.SALON_DB;
  const salon = await db.prepare("SELECT * FROM salons WHERE id = ?").bind(Number(c.req.param("id"))).first<Salon>();
  if (!salon) return c.json({ error: "サロンが見つかりません" }, 404);
  return c.json(salon);
});

app.put("/salons/:id", async (c) => {
  const db = c.env.SALON_DB;
  const id = Number(c.req.param("id"));
  const body = await c.req.json<Partial<Record<string, string>>>();

  const allowedFields = [
    "salon_name", "theme_id", "logo_url",
    "lark_app_id", "lark_app_secret", "lark_bitable_app_token",
    "lark_customer_table_id", "lark_monthly_goal_table_id",
    "lark_yearly_goal_table_id", "lark_karte_table_id",
  ];

  const updates: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(body)) {
    // Convert camelCase to snake_case
    const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    if (allowedFields.includes(snakeKey)) {
      updates.push(`${snakeKey} = ?`);
      values.push(value);
    }
  }

  if (updates.length === 0) {
    return c.json({ error: "更新するフィールドがありません" }, 400);
  }

  updates.push("updated_at = datetime('now')");
  values.push(id);

  await db.prepare(`UPDATE salons SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
  return c.json({ success: true });
});

// ---------- Customer List (for customer_lookup field) ----------

// ---------- Debug: Lark Table Fields ----------
app.get("/salons/:slug/lark-fields", async (c) => {
  const db = c.env.SALON_DB;
  const slug = c.req.param("slug");
  const tableType = c.req.query("table") || "karte"; // karte, customer, monthly_goal, yearly_goal

  const salon = await db.prepare("SELECT * FROM salons WHERE slug = ? AND is_active = 1").bind(slug).first<Salon>();
  if (!salon) return c.json({ error: "サロンが見つかりません" }, 404);

  if (!salon.lark_app_id || !salon.lark_app_secret || !salon.lark_bitable_app_token) {
    return c.json({ error: "Lark API設定が不足しています" }, 400);
  }

  const tableIdMap: Record<string, string | null> = {
    customer: salon.lark_customer_table_id,
    monthly_goal: salon.lark_monthly_goal_table_id,
    yearly_goal: salon.lark_yearly_goal_table_id,
    karte: salon.lark_karte_table_id,
  };
  const tableId = tableIdMap[tableType];
  if (!tableId) return c.json({ error: `テーブルID未設定: ${tableType}` }, 400);

  try {
    const token = await getTenantAccessToken(salon.lark_app_id, salon.lark_app_secret);
    const res = await fetch(
      `https://open.larksuite.com/open-apis/bitable/v1/apps/${salon.lark_bitable_app_token}/tables/${tableId}/fields?page_size=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json() as any;
    if (data.code !== 0) {
      return c.json({ error: data.msg, code: data.code }, 500);
    }

    const fields = (data.data?.items || []).map((f: any) => ({
      field_name: f.field_name,
      type: f.type,
      ui_type: f.ui_type,
      is_primary: f.is_primary || false,
      property: f.property || null,
    }));

    return c.json({ tableType, tableId, fields });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/salons/:slug/customers", async (c) => {
  const db = c.env.SALON_DB;
  const slug = c.req.param("slug");

  const salon = await db.prepare("SELECT * FROM salons WHERE slug = ? AND is_active = 1").bind(slug).first<Salon>();
  if (!salon) return c.json({ error: "サロンが見つかりません" }, 404);

  if (!salon.lark_app_id || !salon.lark_app_secret || !salon.lark_bitable_app_token || !salon.lark_customer_table_id) {
    return c.json({ error: "Lark API設定が不足しています", customers: [] }, 200);
  }

  try {
    const customers = await fetchCustomerList(
      salon.lark_app_id,
      salon.lark_app_secret,
      salon.lark_bitable_app_token,
      salon.lark_customer_table_id
    );
    return c.json({ customers });
  } catch (err: any) {
    console.error("Customer list fetch error:", err.message);
    return c.json({ error: err.message, customers: [] }, 200);
  }
});

// ---------- Photo Upload ----------
app.post("/salons/:slug/upload-photo", async (c) => {
  const db = c.env.SALON_DB;
  const slug = c.req.param("slug");

  const salon = await db.prepare("SELECT * FROM salons WHERE slug = ? AND is_active = 1").bind(slug).first<Salon>();
  if (!salon) return c.json({ error: "サロンが見つかりません" }, 404);

  if (!salon.lark_app_id || !salon.lark_app_secret || !salon.lark_bitable_app_token) {
    return c.json({ error: "Lark API設定が不足しています" }, 400);
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return c.json({ error: "ファイルが選択されていません" }, 400);
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic"];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: "対応していないファイル形式です（JPEG, PNG, GIF, WebP, HEICのみ）" }, 400);
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: "ファイルサイズが大きすぎます（最大10MB）" }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileToken = await uploadFileToLark(
      salon.lark_app_id,
      salon.lark_app_secret,
      salon.lark_bitable_app_token,
      arrayBuffer,
      file.name,
      file.type
    );

    return c.json({ success: true, fileToken });
  } catch (err: any) {
    console.error("Photo upload error:", err.message);
    return c.json({ error: err.message || "写真のアップロードに失敗しました" }, 500);
  }
});

// ---------- Public Form Routes ----------
app.get("/form/:slug", async (c) => {
  const db = c.env.SALON_DB;
  const slug = c.req.param("slug");
  const formType = c.req.query("type") || "customer";

  const salon = await db.prepare("SELECT * FROM salons WHERE slug = ? AND is_active = 1").bind(slug).first<Salon>();
  if (!salon) return c.json({ error: "サロンが見つかりません" }, 404);

  const theme = getTheme(salon.theme_id);
  const formConfig = DEFAULT_FORM_CONFIGS[formType as keyof typeof DEFAULT_FORM_CONFIGS];

  return c.json({
    salon: {
      id: salon.id,
      salonName: salon.salon_name,
      slug: salon.slug,
      logoUrl: salon.logo_url,
    },
    theme,
    formTitle: formConfig?.title || "入力フォーム",
    fields: (formConfig?.fields || []).map((f, i) => ({
      id: i,
      fieldName: f.fieldName,
      fieldLabel: f.fieldLabel,
      fieldType: f.fieldType,
      options: "options" in f ? f.options : null,
      placeholder: f.placeholder || null,
      isRequired: f.isRequired ?? true,
      sortOrder: i,
    })),
  });
});

app.post("/form/:slug/submit", async (c) => {
  const db = c.env.SALON_DB;
  const slug = c.req.param("slug");

  let body: { formType: string; formData: Record<string, unknown>; photoTokens?: string[] };
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.formType || !body.formData) {
    return c.json({ error: "formType と formData は必須です" }, 400);
  }

  let salon: Salon | null;
  try {
    salon = await db.prepare("SELECT * FROM salons WHERE slug = ? AND is_active = 1").bind(slug).first<Salon>();
  } catch (e: any) {
    console.error("DB error (select salon):", e.message);
    return c.json({ error: "Database error", details: e.message }, 500);
  }

  if (!salon) return c.json({ error: "サロンが見つかりません" }, 404);

  // Save submission to D1
  let submissionId: number | null = null;
  try {
    const result = await db.prepare(
      "INSERT INTO submissions (salon_id, form_type, form_data) VALUES (?, ?, ?)"
    ).bind(salon.id, body.formType, JSON.stringify(body.formData)).run();
    submissionId = result.meta.last_row_id as number;
  } catch (e: any) {
    console.error("DB error (insert submission):", e.message);
    return c.json({ error: "Failed to save submission", details: e.message }, 500);
  }

  // Try Lark sync (non-blocking - errors won't cause 500)
  let larkSynced = false;
  let larkRecordId: string | null = null;
  let syncError: string | null = null;

  const tableIdMap: Record<string, string | null> = {
    customer: salon.lark_customer_table_id,
    monthly_goal: salon.lark_monthly_goal_table_id,
    yearly_goal: salon.lark_yearly_goal_table_id,
    karte: salon.lark_karte_table_id,
  };
  const tableId = tableIdMap[body.formType];

  if (salon.lark_app_id && salon.lark_app_secret && salon.lark_bitable_app_token && tableId) {
    try {
      const larkFields = mapFormDataToLarkFields(body.formData as Record<string, unknown>, body.formType);

      // Handle photo attachments for karte
      if (body.formType === "karte" && body.photoTokens && body.photoTokens.length > 0) {
        larkFields["写真"] = body.photoTokens.map((token: string) => ({
          file_token: token,
        }));
      }

      console.log("Lark fields to sync:", JSON.stringify(larkFields));
      const larkResult = await createBitableRecord(
        salon.lark_app_id, salon.lark_app_secret,
        salon.lark_bitable_app_token, tableId, larkFields
      );
      larkSynced = true;
      larkRecordId = larkResult.recordId;
    } catch (err: any) {
      console.error("Lark sync error:", err.message);
      syncError = err.message || "Lark sync failed";
    }
  } else {
    syncError = "Lark API credentials not configured for this form type";
  }

  // Update sync status (non-critical, don't fail the request)
  try {
    await db.prepare(
      "UPDATE submissions SET lark_synced = ?, lark_record_id = ?, sync_error = ? WHERE id = ?"
    ).bind(larkSynced ? 1 : 0, larkRecordId, syncError, submissionId).run();
  } catch (e: any) {
    console.error("DB error (update sync status):", e.message);
    // Don't fail the request, submission was already saved
  }

  return c.json({
    success: true,
    submissionId,
    larkSynced,
    syncError,
  });
});

// ---------- Submission History ----------
app.get("/salons/:id/submissions", async (c) => {
  const db = c.env.SALON_DB;
  const salonId = Number(c.req.param("id"));
  const formType = c.req.query("formType");

  let query = "SELECT * FROM submissions WHERE salon_id = ?";
  const bindings: unknown[] = [salonId];

  if (formType) {
    query += " AND form_type = ?";
    bindings.push(formType);
  }
  query += " ORDER BY created_at DESC LIMIT 100";

  const subs = await db.prepare(query).bind(...bindings).all<Submission>();
  return c.json(subs.results.map((s) => ({
    ...s,
    formData: JSON.parse(s.form_data),
    larkSynced: !!s.lark_synced,
  })));
});

// ---------- Form Types ----------
app.get("/form-types", (c) => {
  return c.json(FORM_TYPES.map((ft) => ({
    id: ft,
    title: DEFAULT_FORM_CONFIGS[ft].title,
    fieldCount: DEFAULT_FORM_CONFIGS[ft].fields.length,
  })));
});

// ============================================================
// 認証・テナント API (Phase 0-1)
// ============================================================

// ── 軽量: ログイン画面の店舗名表示用 ──
app.get("/tenant-info", async (c) => {
  const tenant = await resolveTenant(c.env as AuthEnv & Env, {
    host: c.req.header("Host") || null,
    query: c.req.query("tenant"),
    header: c.req.header("X-Tenant-Slug"),
  });
  if (!tenant) {
    return c.json(err(ERROR_CODES.AUTH_TENANT_NOT_FOUND, "テナントが見つかりません"), 404);
  }
  return c.json(ok<TenantInfo>(toTenantInfo(tenant)));
});

// ── ログイン ──
app.post("/auth/login", async (c) => {
  const env = c.env as Env;
  let body: { email?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "不正なリクエスト形式です"), 400);
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !password) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "メールとパスワードを入力してください"), 400);
  }

  // テナント解決
  const tenant = await resolveTenant(env, {
    host: c.req.header("Host") || null,
    query: c.req.query("tenant"),
    header: c.req.header("X-Tenant-Slug"),
  });
  if (!tenant) {
    return c.json(err(ERROR_CODES.AUTH_TENANT_NOT_FOUND, "テナントが見つかりません"), 404);
  }

  // ロックアウト判定
  if (await isLockedOut(env, email)) {
    return c.json(err(ERROR_CODES.AUTH_LOCKED, "失敗回数の上限に達しました。10分後に再試行してください"), 429);
  }

  const user = await env.SALON_DB.prepare(
    `SELECT * FROM users WHERE salon_id = ? AND email = ? AND is_active = 1 LIMIT 1`
  )
    .bind(tenant.id, email)
    .first<UserRow>();

  const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || null;
  const userAgent = c.req.header("User-Agent") || null;

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    const count = await recordLoginFailure(env, email, tenant.id, ip, userAgent);
    const code = count >= 5 ? ERROR_CODES.AUTH_LOCKED : ERROR_CODES.AUTH_INVALID_CREDENTIALS;
    return c.json(err(code, "メールアドレスまたはパスワードが正しくありません"), 401);
  }

  // 成功
  await clearLoginFailures(env, email);
  const session = await createSession(env, user.id, tenant.id, userAgent);

  await env.SALON_DB.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`)
    .bind(user.id)
    .run();

  const isHttps = (c.req.header("X-Forwarded-Proto") || "").toLowerCase() === "https" ||
    (c.req.url.startsWith("https://"));
  c.header("Set-Cookie", buildSessionCookie(session.token, isHttps));

  const sessionInfo: SessionInfo = {
    user: {
      id: user.id,
      salonId: user.salon_id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
    },
    tenant: toTenantInfo(tenant),
    expiresAt: session.expiresAt.toISOString(),
  };
  return c.json(ok(sessionInfo));
});

// ── ログアウト ──
app.post("/auth/logout", async (c) => {
  const env = c.env as Env;
  const token = readSessionTokenFromCookie(c.req.header("Cookie") || null);
  if (token) {
    await deleteSession(env, token);
  }
  const isHttps = (c.req.header("X-Forwarded-Proto") || "").toLowerCase() === "https" ||
    c.req.url.startsWith("https://");
  c.header("Set-Cookie", buildClearCookie(isHttps));
  return c.json(ok({ loggedOut: true }));
});

// ── 認証必須ガード: セッション→テナント→LarkClient まで一括で解決 ──
type AuthContext = {
  session: { user_id: number; salon_id: number };
  salon: SalonRow;
  client: LarkClient;
  customerTableId: string;
  karteTableId: string;
  tables: {
    customer: string;
    karte: string;
    monthlyGoal: string;
    yearlyGoal: string;
    sales: string;
  };
};

async function requireAuthWithLark(
  c: any
): Promise<{ ok: true; ctx: AuthContext } | { ok: false; response: Response }> {
  const env = c.env as Env;
  const token = readSessionTokenFromCookie(c.req.header("Cookie") || null);
  if (!token) {
    return {
      ok: false,
      response: c.json(err(ERROR_CODES.AUTH_UNAUTHENTICATED, "未認証です"), 401),
    };
  }
  const session = await getSession(env, token);
  if (!session) {
    return {
      ok: false,
      response: c.json(err(ERROR_CODES.AUTH_UNAUTHENTICATED, "セッションが無効です"), 401),
    };
  }
  const salon = await env.SALON_DB.prepare(`SELECT * FROM salons WHERE id = ? LIMIT 1`)
    .bind(session.salon_id)
    .first<SalonRow>();
  if (!salon) {
    return {
      ok: false,
      response: c.json(err(ERROR_CODES.AUTH_TENANT_NOT_FOUND, "テナントが見つかりません"), 401),
    };
  }
  const config = toLarkConfig(salon);
  if (!config) {
    return {
      ok: false,
      response: c.json(
        err(ERROR_CODES.VALIDATION_ERROR, "サロンの Lark 設定が未完了です。ダッシュボードで Lark App ID / Secret / Bitable App Token を設定してください"),
        400
      ),
    };
  }
  if (!config.tables.customer) {
    return {
      ok: false,
      response: c.json(
        err(ERROR_CODES.VALIDATION_ERROR, "顧客テーブル ID (lark_customer_table_id) が未設定です"),
        400
      ),
    };
  }
  const client = LarkClient.fromConfig(env, config);
  return {
    ok: true,
    ctx: {
      session: { user_id: session.user_id, salon_id: session.salon_id },
      salon,
      client,
      customerTableId: config.tables.customer,
      karteTableId: config.tables.karte,
      tables: config.tables,
    },
  };
}

// ── セッション取得 ──
app.get("/auth/session", async (c) => {
  const env = c.env as Env;
  const token = readSessionTokenFromCookie(c.req.header("Cookie") || null);
  if (!token) {
    return c.json(err(ERROR_CODES.AUTH_UNAUTHENTICATED, "未認証です"), 401);
  }
  const session = await getSession(env, token);
  if (!session) {
    return c.json(err(ERROR_CODES.AUTH_UNAUTHENTICATED, "セッションが無効です"), 401);
  }

  const user = await env.SALON_DB.prepare(
    `SELECT * FROM users WHERE id = ? AND is_active = 1 LIMIT 1`
  )
    .bind(session.user_id)
    .first<UserRow>();
  if (!user) {
    return c.json(err(ERROR_CODES.AUTH_UNAUTHENTICATED, "ユーザーが無効化されています"), 401);
  }

  const salon = await env.SALON_DB.prepare(
    `SELECT * FROM salons WHERE id = ? LIMIT 1`
  )
    .bind(session.salon_id)
    .first<SalonRow>();
  if (!salon) {
    return c.json(err(ERROR_CODES.AUTH_TENANT_NOT_FOUND, "テナントが無効化されています"), 401);
  }

  const sessionInfo: SessionInfo = {
    user: {
      id: user.id,
      salonId: user.salon_id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
    },
    tenant: toTenantInfo(salon),
    expiresAt: session.expires_at,
  };
  return c.json(ok(sessionInfo));
});

// ============================================================
// 顧客台帳 API (Phase 2)
//   実 BASE: 新規顧客データ (tblaxZtrnk0jwBjB)
// ============================================================

// ── 一覧 (キーワード検索 / 性別 / 来店のきっかけ / 並び順 / ページネーション) ──
app.get("/customers", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const { client, customerTableId } = auth.ctx;

  const q = (c.req.query("q") || "").trim();
  const gender = (c.req.query("gender") || "").trim();
  const visitTrigger = (c.req.query("visitTrigger") || "").trim();
  const sort = (c.req.query("sort") || "recent").trim();
  const pageToken = c.req.query("pageToken") || undefined;
  const pageSizeRaw = Number(c.req.query("pageSize") || "50");
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(Math.max(pageSizeRaw, 1), 100)
    : 50;

  const searchBody = buildSearchBody({
    q: q || undefined,
    gender: gender === "男性" || gender === "女性" ? gender : undefined,
    visitTrigger: (["紹介", "instagram", "TikTok", "ホットペッパー"].includes(visitTrigger)
      ? visitTrigger
      : undefined) as any,
    sort: (["recent", "lastName", "customerNo"].includes(sort) ? sort : "recent") as any,
  });

  try {
    // page_size と page_token はクエリ文字列で渡す
    const params = new URLSearchParams({ page_size: String(pageSize) });
    if (pageToken) params.set("page_token", pageToken);

    // LarkClient の search は path にクエリを乗せないので、低レベル fetch を使う
    const token = await client.getTenantAccessToken();
    const domain = (c.env as Env).LARK_DOMAIN || "open.larksuite.com";
    const url = `https://${domain}/open-apis/bitable/v1/apps/${auth.ctx.salon.lark_bitable_app_token}/tables/${customerTableId}/records/search?${params}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(searchBody),
    });
    const data = (await res.json()) as {
      code: number;
      msg?: string;
      data?: { items?: Array<{ record_id: string; fields: Record<string, unknown> }>; has_more?: boolean; page_token?: string };
    };
    if (data.code !== 0) {
      return c.json(err(ERROR_CODES.LARK_API_ERROR, data.msg || "Lark search failed"), 502);
    }
    const items: Customer[] = (data.data?.items || []).map((r) =>
      fieldsToCustomer(r.record_id, r.fields)
    );
    const result: CustomerListResult = {
      items,
      hasMore: !!data.data?.has_more,
      pageToken: data.data?.page_token,
    };
    return c.json(ok(result));
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── 詳細 ──
app.get("/customers/:recordId", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const { client, customerTableId } = auth.ctx;
  const recordId = c.req.param("recordId");

  try {
    const record = await client.getRecord(customerTableId, recordId);
    if (!record) {
      return c.json(err(ERROR_CODES.NOT_FOUND, "顧客が見つかりません"), 404);
    }
    return c.json(ok(fieldsToCustomer(record.record_id, record.fields)));
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── 新規登録 ──
app.post("/customers", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const { client, customerTableId } = auth.ctx;

  let body: CustomerInput;
  try {
    body = (await c.req.json()) as CustomerInput;
  } catch {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "不正なリクエスト形式です"), 400);
  }
  const validation = validateCustomerInput(body);
  if (validation) return c.json(err(ERROR_CODES.VALIDATION_ERROR, validation), 400);

  try {
    const fields = customerInputToFields(body);
    const created = await client.createRecord(customerTableId, fields);
    return c.json(ok(fieldsToCustomer(created.record_id, created.fields)), 201);
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── 編集 ──
app.put("/customers/:recordId", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const { client, customerTableId } = auth.ctx;
  const recordId = c.req.param("recordId");

  let body: Partial<CustomerInput>;
  try {
    body = (await c.req.json()) as Partial<CustomerInput>;
  } catch {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "不正なリクエスト形式です"), 400);
  }
  // PUT では姓・名はオプショナル扱いにする（完全な置換ではなくパッチ的更新）
  if (body.lastName !== undefined && !body.lastName.trim())
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "姓は空にできません", "lastName"), 400);
  if (body.firstName !== undefined && !body.firstName.trim())
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "名前は空にできません", "firstName"), 400);
  if (body.birthday && !/^\d{4}-\d{2}-\d{2}$/.test(body.birthday))
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "生年月日は yyyy-MM-dd 形式で", "birthday"), 400);
  if (body.firstVisitDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.firstVisitDate))
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "来店日は yyyy-MM-dd 形式で", "firstVisitDate"), 400);

  try {
    // CustomerInput を満たすように既存値で穴埋め
    const baseFields = customerInputToFields({
      lastName: body.lastName ?? "",
      firstName: body.firstName ?? "",
      kana: body.kana,
      gender: body.gender,
      phone: body.phone,
      birthday: body.birthday,
      visitTriggers: body.visitTriggers,
      firstVisitDate: body.firstVisitDate,
    });
    // 未指定の必須は送らない
    if (body.lastName === undefined) delete baseFields["姓"];
    if (body.firstName === undefined) delete baseFields["名前"];

    const updated = await client.updateRecord(customerTableId, recordId, baseFields);
    return c.json(ok(fieldsToCustomer(updated.record_id, updated.fields)));
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ============================================================
// カルテ API (Phase 3)
//   実 BASE: カルテデータ (tbl4Crds3zemyxUp)
// ============================================================

// ── 一覧 ──
app.get("/karte", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const { client, karteTableId, salon } = auth.ctx;
  if (!karteTableId) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "カルテテーブル ID が未設定です"), 400);
  }

  const customerRecordId = c.req.query("customerRecordId") || undefined;
  const customerName = c.req.query("customerName") || undefined;
  const customerKind = c.req.query("customerKind") || undefined;
  const treatmentCourse = c.req.query("treatmentCourse") || undefined;
  const visitDateFrom = c.req.query("visitDateFrom") || undefined;
  const visitDateTo = c.req.query("visitDateTo") || undefined;
  const pageToken = c.req.query("pageToken") || undefined;
  const pageSizeRaw = Number(c.req.query("pageSize") || "50");
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(Math.max(pageSizeRaw, 1), 100)
    : 50;

  const searchBody = buildKarteSearchBody({
    customerRecordId,
    customerName,
    customerKind: customerKind === "新規" || customerKind === "既存" ? customerKind : undefined,
    treatmentCourse: treatmentCourse as any,
    visitDateFrom,
    visitDateTo,
  });

  try {
    const params = new URLSearchParams({ page_size: String(pageSize) });
    if (pageToken) params.set("page_token", pageToken);

    const token = await client.getTenantAccessToken();
    const domain = (c.env as Env).LARK_DOMAIN || "open.larksuite.com";
    const url = `https://${domain}/open-apis/bitable/v1/apps/${salon.lark_bitable_app_token}/tables/${karteTableId}/records/search?${params}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    });
    const data = (await res.json()) as any;
    if (data.code !== 0) {
      return c.json(err(ERROR_CODES.LARK_API_ERROR, data.msg || "Lark search failed"), 502);
    }
    const items: Karte[] = (data.data?.items || []).map((r: any) =>
      attachPhotoUrls(fieldsToKarte(r.record_id, r.fields))
    );
    const result: KarteListResult = {
      items,
      hasMore: !!data.data?.has_more,
      pageToken: data.data?.page_token,
    };
    return c.json(ok(result));
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── 詳細 ──
app.get("/karte/:recordId", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const { client, karteTableId } = auth.ctx;
  const recordId = c.req.param("recordId");

  try {
    const record = await client.getRecord(karteTableId, recordId);
    if (!record) {
      return c.json(err(ERROR_CODES.NOT_FOUND, "カルテが見つかりません"), 404);
    }
    return c.json(ok(attachPhotoUrls(fieldsToKarte(record.record_id, record.fields))));
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── 新規 ──
app.post("/karte", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const { client, karteTableId } = auth.ctx;

  let body: KarteInput;
  try {
    body = (await c.req.json()) as KarteInput;
  } catch {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "不正なリクエスト形式です"), 400);
  }
  const validation = validateKarteInput(body);
  if (validation) return c.json(err(ERROR_CODES.VALIDATION_ERROR, validation), 400);

  try {
    const fields = karteInputToFields(body);
    const created = await client.createRecord(karteTableId, fields);
    return c.json(ok(attachPhotoUrls(fieldsToKarte(created.record_id, created.fields))), 201);
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── 編集 ──
app.put("/karte/:recordId", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const { client, karteTableId } = auth.ctx;
  const recordId = c.req.param("recordId");

  let body: Partial<KarteInput>;
  try {
    body = (await c.req.json()) as Partial<KarteInput>;
  } catch {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "不正なリクエスト形式です"), 400);
  }
  if (body.visitDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.visitDate))
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "来店日は yyyy-MM-dd 形式で", "visitDate"), 400);

  try {
    // 更新: customerRecordId が指定されていれば顧客No も差し替え
    const fields = karteInputToFields({
      customerRecordId: body.customerRecordId ?? "",
      customerKind: body.customerKind,
      visitDate: body.visitDate,
      treatmentCourses: body.treatmentCourses,
      treatmentComment: body.treatmentComment,
      treatmentAmount: body.treatmentAmount,
      productAmount: body.productAmount,
      paymentMethods: body.paymentMethods,
      photoFileTokens: body.photoFileTokens,
    });
    if (!body.customerRecordId) delete fields["顧客No"];

    const updated = await client.updateRecord(karteTableId, recordId, fields);
    return c.json(ok(attachPhotoUrls(fieldsToKarte(updated.record_id, updated.fields))));
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── 写真アップロード ──
//   FormData の "file" に画像を含める。返り値の fileToken を KarteInput.photoFileTokens に
//   詰めて POST/PUT /karte に渡すと、カルテレコードの「写真」フィールドに紐付く。
app.post("/karte/upload-photo", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const { salon, client } = auth.ctx;

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as unknown as File | null;
    if (!file) {
      return c.json(err(ERROR_CODES.VALIDATION_ERROR, "ファイルが選択されていません"), 400);
    }
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic"];
    if (!allowed.includes(file.type)) {
      return c.json(err(ERROR_CODES.VALIDATION_ERROR, "対応形式は JPEG / PNG / GIF / WebP / HEIC のみです"), 400);
    }
    if (file.size > 10 * 1024 * 1024) {
      return c.json(err(ERROR_CODES.VALIDATION_ERROR, "ファイルサイズが大きすぎます（最大10MB）"), 400);
    }

    const token = await client.getTenantAccessToken();
    const domain = (c.env as Env).LARK_DOMAIN || "open.larksuite.com";
    const upstream = new FormData();
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    upstream.append("file", blob, file.name);
    upstream.append("file_name", file.name);
    upstream.append("parent_type", "bitable_image");
    upstream.append("parent_node", salon.lark_bitable_app_token!);
    upstream.append("size", String(file.size));

    const res = await fetch(`https://${domain}/open-apis/drive/v1/medias/upload_all`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: upstream,
    });
    const data = (await res.json()) as any;
    if (data.code !== 0) {
      return c.json(err(ERROR_CODES.LARK_API_ERROR, data.msg || "Lark upload failed"), 502);
    }
    return c.json(ok({ fileToken: data.data?.file_token as string, name: file.name }));
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "写真アップロード失敗"), 502);
  }
});

// ── 写真プロキシ (Lark の一時 URL にリダイレクト) ──
app.get("/karte/photo/:fileToken", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const { client } = auth.ctx;
  const fileToken = c.req.param("fileToken");

  try {
    const token = await client.getTenantAccessToken();
    const domain = (c.env as Env).LARK_DOMAIN || "open.larksuite.com";
    const url = `https://${domain}/open-apis/drive/v1/medias/batch_get_tmp_download_url?file_tokens=${encodeURIComponent(fileToken)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = (await res.json()) as any;
    if (data.code !== 0) {
      return c.json(err(ERROR_CODES.LARK_API_ERROR, data.msg || "URL取得失敗"), 502);
    }
    const tmpUrl: string | undefined = data.data?.tmp_download_urls?.[0]?.tmp_download_url;
    if (!tmpUrl) {
      return c.json(err(ERROR_CODES.NOT_FOUND, "写真が見つかりません"), 404);
    }
    // 一時URLにリダイレクト (ブラウザの <img src> で使える)
    return c.redirect(tmpUrl, 302);
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "写真取得失敗"), 502);
  }
});

/** Karte の photos に /api/karte/photo/{token} 形式の URL を埋める */
function attachPhotoUrls(karte: Karte): Karte {
  return {
    ...karte,
    photos: karte.photos.map((p) => ({
      ...p,
      url: `/api/karte/photo/${encodeURIComponent(p.fileToken)}`,
    })),
  };
}

// ============================================================
// 目標 / 売上分析 API (Phase 4)
//   年間目標 (tblABnUfoY8XMaD0) / 月間目標 (tblhOI7T3lu5T7xM) / 売上・分析 (tbl2ZzvKO8q5NEh7)
// ============================================================

/** Lark Bitable のテーブル全件を page_token 回しながら取得 */
async function listAllRecords(
  client: LarkClient,
  tableId: string,
  pageSize = 100
): Promise<Array<{ record_id: string; fields: Record<string, unknown> }>> {
  const all: Array<{ record_id: string; fields: Record<string, unknown> }> = [];
  let pageToken: string | undefined;
  let safety = 50;
  do {
    const data = await client.listRecords(tableId, { pageSize, pageToken });
    all.push(...((data.items as any) || []));
    pageToken = data.has_more ? data.page_token : undefined;
    safety--;
  } while (pageToken && safety > 0);
  return all;
}

// ── 年間目標: 一覧 ──
app.get("/goals/yearly", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const tableId = auth.ctx.tables.yearlyGoal;
  if (!tableId) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "年間目標テーブル ID が未設定です"), 400);
  }
  try {
    const records = await listAllRecords(auth.ctx.client, tableId);
    const items: YearlyGoal[] = records.map((r) => fieldsToYearlyGoal(r.record_id, r.fields));
    // 年度 desc で並べる
    items.sort((a, b) => (a.fiscalYear < b.fiscalYear ? 1 : a.fiscalYear > b.fiscalYear ? -1 : 0));
    return c.json(ok({ items }));
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── 年間目標: 詳細 ──
app.get("/goals/yearly/:recordId", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const tableId = auth.ctx.tables.yearlyGoal;
  if (!tableId) return c.json(err(ERROR_CODES.VALIDATION_ERROR, "年間目標テーブル ID 未設定"), 400);
  try {
    const r = await auth.ctx.client.getRecord(tableId, c.req.param("recordId"));
    if (!r) return c.json(err(ERROR_CODES.NOT_FOUND, "年間目標が見つかりません"), 404);
    return c.json(ok(fieldsToYearlyGoal(r.record_id, r.fields)));
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── 年間目標: 新規 ──
app.post("/goals/yearly", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const tableId = auth.ctx.tables.yearlyGoal;
  if (!tableId) return c.json(err(ERROR_CODES.VALIDATION_ERROR, "年間目標テーブル ID 未設定"), 400);
  let body: YearlyGoalInput;
  try {
    body = (await c.req.json()) as YearlyGoalInput;
  } catch {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "不正なリクエスト形式"), 400);
  }
  const v = validateYearlyGoalInput(body);
  if (v) return c.json(err(ERROR_CODES.VALIDATION_ERROR, v), 400);
  try {
    const created = await auth.ctx.client.createRecord(tableId, yearlyGoalInputToFields(body));
    return c.json(ok(fieldsToYearlyGoal(created.record_id, created.fields)), 201);
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── 年間目標: 編集 ──
app.put("/goals/yearly/:recordId", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const tableId = auth.ctx.tables.yearlyGoal;
  if (!tableId) return c.json(err(ERROR_CODES.VALIDATION_ERROR, "年間目標テーブル ID 未設定"), 400);
  let body: Partial<YearlyGoalInput>;
  try {
    body = (await c.req.json()) as Partial<YearlyGoalInput>;
  } catch {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "不正なリクエスト形式"), 400);
  }
  try {
    const fields = yearlyGoalInputToFields({
      fiscalYear: body.fiscalYear ?? "",
      revenueTarget: body.revenueTarget,
      averageSpend: body.averageSpend,
      note: body.note,
    });
    if (body.fiscalYear === undefined) delete fields["年度"];

    const updated = await auth.ctx.client.updateRecord(tableId, c.req.param("recordId"), fields);
    return c.json(ok(fieldsToYearlyGoal(updated.record_id, updated.fields)));
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── 月間目標: 一覧 ──
app.get("/goals/monthly", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const tableId = auth.ctx.tables.monthlyGoal;
  if (!tableId) return c.json(err(ERROR_CODES.VALIDATION_ERROR, "月間目標テーブル ID 未設定"), 400);
  try {
    const records = await listAllRecords(auth.ctx.client, tableId);
    const items: MonthlyGoal[] = records.map((r) => fieldsToMonthlyGoal(r.record_id, r.fields));
    items.sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : a.yearMonth > b.yearMonth ? -1 : 0));
    return c.json(ok({ items }));
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── 月間目標: 詳細 ──
app.get("/goals/monthly/:recordId", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const tableId = auth.ctx.tables.monthlyGoal;
  if (!tableId) return c.json(err(ERROR_CODES.VALIDATION_ERROR, "月間目標テーブル ID 未設定"), 400);
  try {
    const r = await auth.ctx.client.getRecord(tableId, c.req.param("recordId"));
    if (!r) return c.json(err(ERROR_CODES.NOT_FOUND, "月間目標が見つかりません"), 404);
    return c.json(ok(fieldsToMonthlyGoal(r.record_id, r.fields)));
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── 月間目標: 新規 ──
app.post("/goals/monthly", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const tableId = auth.ctx.tables.monthlyGoal;
  if (!tableId) return c.json(err(ERROR_CODES.VALIDATION_ERROR, "月間目標テーブル ID 未設定"), 400);
  let body: MonthlyGoalInput;
  try {
    body = (await c.req.json()) as MonthlyGoalInput;
  } catch {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "不正なリクエスト形式"), 400);
  }
  const v = validateMonthlyGoalInput(body);
  if (v) return c.json(err(ERROR_CODES.VALIDATION_ERROR, v), 400);
  try {
    const created = await auth.ctx.client.createRecord(tableId, monthlyGoalInputToFields(body));
    return c.json(ok(fieldsToMonthlyGoal(created.record_id, created.fields)), 201);
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── 月間目標: 編集 ──
app.put("/goals/monthly/:recordId", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const tableId = auth.ctx.tables.monthlyGoal;
  if (!tableId) return c.json(err(ERROR_CODES.VALIDATION_ERROR, "月間目標テーブル ID 未設定"), 400);
  let body: Partial<MonthlyGoalInput>;
  try {
    body = (await c.req.json()) as Partial<MonthlyGoalInput>;
  } catch {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "不正なリクエスト形式"), 400);
  }
  try {
    const fields = monthlyGoalInputToFields({
      yearMonth: body.yearMonth ?? "",
      revenueTarget: body.revenueTarget,
      workingDaysTarget: body.workingDaysTarget,
      averageSpend: body.averageSpend,
    });
    if (body.yearMonth === undefined) delete fields["年月"];

    const updated = await auth.ctx.client.updateRecord(tableId, c.req.param("recordId"), fields);
    return c.json(ok(fieldsToMonthlyGoal(updated.record_id, updated.fields)));
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── 売上・分析 (読み取り専用) ──
app.get("/analytics", async (c) => {
  const auth = await requireAuthWithLark(c);
  if (!auth.ok) return auth.response;
  const tableId = auth.ctx.tables.sales;
  if (!tableId) return c.json(err(ERROR_CODES.VALIDATION_ERROR, "売上・分析テーブル ID 未設定"), 400);
  try {
    const records = await listAllRecords(auth.ctx.client, tableId);
    const items: SalesAnalytics[] = records.map((r) =>
      fieldsToSalesAnalytics(r.record_id, r.fields)
    );
    items.sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : a.yearMonth > b.yearMonth ? -1 : 0));
    return c.json(ok({ items }));
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ============================================================
// Platform Admin API (Phase B-1)
//   OFFICE PLATA 側ログイン + 加盟店 (テナント) CRUD + Lark テーブル自動判定
// ============================================================

// ── Platform Admin 認証ガード ──
async function requirePlatformAuth(
  c: any
): Promise<{ ok: true; admin: PlatformAdminRow } | { ok: false; response: Response }> {
  const env = c.env as Env;
  const token = readPlatformSessionTokenFromCookie(c.req.header("Cookie") || null);
  if (!token) {
    return {
      ok: false,
      response: c.json(err(ERROR_CODES.AUTH_UNAUTHENTICATED, "未認証です"), 401),
    };
  }
  const session = await getPlatformSession(env, token);
  if (!session) {
    return {
      ok: false,
      response: c.json(err(ERROR_CODES.AUTH_UNAUTHENTICATED, "セッションが無効です"), 401),
    };
  }
  const admin = await env.SALON_DB.prepare(
    `SELECT * FROM platform_admins WHERE id = ? AND is_active = 1 LIMIT 1`
  )
    .bind(session.admin_id)
    .first<PlatformAdminRow>();
  if (!admin) {
    return {
      ok: false,
      response: c.json(err(ERROR_CODES.AUTH_UNAUTHENTICATED, "管理者が無効化されています"), 401),
    };
  }
  return { ok: true, admin };
}

// ── Platform Admin ログイン ──
app.post("/platform/auth/login", async (c) => {
  const env = c.env as Env;
  let body: { email?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "不正なリクエスト形式です"), 400);
  }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !password) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "メールとパスワードを入力してください"), 400);
  }

  const admin = await env.SALON_DB.prepare(
    `SELECT * FROM platform_admins WHERE email = ? AND is_active = 1 LIMIT 1`
  )
    .bind(email)
    .first<PlatformAdminRow>();

  if (!admin || !(await verifyPlatformPassword(password, admin.password_hash))) {
    return c.json(
      err(ERROR_CODES.AUTH_INVALID_CREDENTIALS, "メールアドレスまたはパスワードが正しくありません"),
      401
    );
  }

  const userAgent = c.req.header("User-Agent") || null;
  const session = await createPlatformSession(env, admin.id, userAgent);

  await env.SALON_DB.prepare(
    `UPDATE platform_admins SET last_login_at = datetime('now') WHERE id = ?`
  )
    .bind(admin.id)
    .run();

  const isHttps =
    (c.req.header("X-Forwarded-Proto") || "").toLowerCase() === "https" ||
    c.req.url.startsWith("https://");
  c.header("Set-Cookie", buildPlatformSessionCookie(session.token, isHttps));

  const info: PlatformSessionInfo = {
    admin: { id: admin.id, email: admin.email, displayName: admin.display_name },
    expiresAt: session.expiresAt.toISOString(),
  };
  return c.json(ok(info));
});

// ── Platform Admin ログアウト ──
app.post("/platform/auth/logout", async (c) => {
  const env = c.env as Env;
  const token = readPlatformSessionTokenFromCookie(c.req.header("Cookie") || null);
  if (token) await deletePlatformSession(env, token);
  const isHttps =
    (c.req.header("X-Forwarded-Proto") || "").toLowerCase() === "https" ||
    c.req.url.startsWith("https://");
  c.header("Set-Cookie", buildPlatformClearCookie(isHttps));
  return c.json(ok({ loggedOut: true }));
});

// ── Platform Admin セッション取得 ──
app.get("/platform/auth/session", async (c) => {
  const auth = await requirePlatformAuth(c);
  if (!auth.ok) return auth.response;
  const info: PlatformSessionInfo = {
    admin: {
      id: auth.admin.id,
      email: auth.admin.email,
      displayName: auth.admin.display_name,
    },
    // 期限は cookie 側で管理されているので簡略表示
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  return c.json(ok(info));
});

// ── 加盟店（テナント）一覧 ──
app.get("/platform/tenants", async (c) => {
  const auth = await requirePlatformAuth(c);
  if (!auth.ok) return auth.response;

  const rows = await (c.env as Env).SALON_DB.prepare(
    `SELECT s.*,
            (SELECT COUNT(*) FROM users u WHERE u.salon_id = s.id AND u.role = 'owner') AS owner_count,
            (SELECT COUNT(*) FROM users u WHERE u.salon_id = s.id) AS staff_count
       FROM salons s
       ORDER BY s.created_at DESC`
  ).all<SalonRow & { owner_count: number; staff_count: number }>();

  const items: TenantSummary[] = (rows.results || []).map((r) => toTenantSummary(r));
  return c.json(ok({ items }));
});

// ── 加盟店 詳細 ──
app.get("/platform/tenants/:id", async (c) => {
  const auth = await requirePlatformAuth(c);
  if (!auth.ok) return auth.response;
  const id = Number(c.req.param("id"));
  const row = await (c.env as Env).SALON_DB.prepare(
    `SELECT s.*,
            (SELECT COUNT(*) FROM users u WHERE u.salon_id = s.id AND u.role = 'owner') AS owner_count,
            (SELECT COUNT(*) FROM users u WHERE u.salon_id = s.id) AS staff_count
       FROM salons s WHERE s.id = ?`
  )
    .bind(id)
    .first<SalonRow & { owner_count: number; staff_count: number }>();
  if (!row) return c.json(err(ERROR_CODES.NOT_FOUND, "加盟店が見つかりません"), 404);
  return c.json(ok(toTenantDetail(row)));
});

// ── 加盟店 新規追加 (+ 初期オーナー) ──
app.post("/platform/tenants", async (c) => {
  const auth = await requirePlatformAuth(c);
  if (!auth.ok) return auth.response;
  const env = c.env as Env;

  let body: TenantUpsertInput;
  try {
    body = (await c.req.json()) as TenantUpsertInput;
  } catch {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "不正なリクエスト形式"), 400);
  }
  if (!body.salonName?.trim()) return c.json(err(ERROR_CODES.VALIDATION_ERROR, "店舗名は必須"), 400);
  if (!body.slug?.trim() || !/^[a-z0-9-]+$/.test(body.slug)) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "slug は半角英数字とハイフンのみ"), 400);
  }
  if (!body.larkBitableAppToken?.trim()) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "Bitable App Token は必須"), 400);
  }
  if (!body.ownerEmail || !body.ownerName || !body.ownerPassword) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "初期オーナー (email/name/password) は必須"), 400);
  }
  if (body.ownerPassword.length < 8) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "オーナーパスワードは8文字以上"), 400);
  }

  // 重複チェック
  const existing = await env.SALON_DB.prepare(`SELECT id FROM salons WHERE slug = ?`)
    .bind(body.slug)
    .first<{ id: number }>();
  if (existing) {
    return c.json(err(ERROR_CODES.CONFLICT, "この slug は既に使用されています", "slug"), 409);
  }

  // 加盟店追加
  const subdomain = body.subdomain?.trim() || body.slug;
  const themeId = body.themeId || "calmer";
  const result = await env.SALON_DB.prepare(
    `INSERT INTO salons (
       salon_name, slug, subdomain, theme_id,
       lark_app_id, lark_app_secret, lark_bitable_app_token,
       lark_customer_table_id, lark_karte_table_id,
       lark_monthly_goal_table_id, lark_yearly_goal_table_id,
       lark_sales_table_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      body.salonName,
      body.slug,
      subdomain,
      themeId,
      body.larkAppId || null,
      body.larkAppSecret || null,
      body.larkBitableAppToken,
      body.larkCustomerTableId || null,
      body.larkKarteTableId || null,
      body.larkMonthlyGoalTableId || null,
      body.larkYearlyGoalTableId || null,
      body.larkSalesTableId || null
    )
    .run();
  const salonId = result.meta.last_row_id as number;

  // 初期オーナー作成
  const hash = await hashPassword(body.ownerPassword);
  await env.SALON_DB.prepare(
    `INSERT INTO users (salon_id, email, password_hash, display_name, role)
     VALUES (?, ?, ?, ?, 'owner')`
  )
    .bind(salonId, body.ownerEmail.trim().toLowerCase(), hash, body.ownerName.trim())
    .run();

  const created = await env.SALON_DB.prepare(
    `SELECT s.*,
            (SELECT COUNT(*) FROM users u WHERE u.salon_id = s.id AND u.role = 'owner') AS owner_count,
            (SELECT COUNT(*) FROM users u WHERE u.salon_id = s.id) AS staff_count
       FROM salons s WHERE s.id = ?`
  )
    .bind(salonId)
    .first<SalonRow & { owner_count: number; staff_count: number }>();
  return c.json(ok(toTenantDetail(created!)), 201);
});

// ── 加盟店 編集 (Lark 設定・テーブル ID・テーマ・名前) ──
app.put("/platform/tenants/:id", async (c) => {
  const auth = await requirePlatformAuth(c);
  if (!auth.ok) return auth.response;
  const env = c.env as Env;
  const id = Number(c.req.param("id"));

  let body: Partial<TenantUpsertInput>;
  try {
    body = (await c.req.json()) as Partial<TenantUpsertInput>;
  } catch {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "不正なリクエスト形式"), 400);
  }
  if (body.slug && !/^[a-z0-9-]+$/.test(body.slug)) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "slug は半角英数字とハイフンのみ"), 400);
  }

  // slug 衝突チェック
  if (body.slug) {
    const dup = await env.SALON_DB.prepare(`SELECT id FROM salons WHERE slug = ? AND id != ?`)
      .bind(body.slug, id)
      .first<{ id: number }>();
    if (dup) return c.json(err(ERROR_CODES.CONFLICT, "この slug は既に使用されています", "slug"), 409);
  }

  const fieldMap: Array<[keyof TenantUpsertInput, string]> = [
    ["salonName", "salon_name"],
    ["slug", "slug"],
    ["subdomain", "subdomain"],
    ["themeId", "theme_id"],
    ["larkAppId", "lark_app_id"],
    ["larkBitableAppToken", "lark_bitable_app_token"],
    ["larkCustomerTableId", "lark_customer_table_id"],
    ["larkKarteTableId", "lark_karte_table_id"],
    ["larkMonthlyGoalTableId", "lark_monthly_goal_table_id"],
    ["larkYearlyGoalTableId", "lark_yearly_goal_table_id"],
    ["larkSalesTableId", "lark_sales_table_id"],
  ];
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const [bk, col] of fieldMap) {
    if (body[bk] !== undefined) {
      updates.push(`${col} = ?`);
      values.push((body[bk] as string) || null);
    }
  }
  // App Secret は値が渡された時だけ更新 (空文字は触らない)
  if (body.larkAppSecret) {
    updates.push("lark_app_secret = ?");
    values.push(body.larkAppSecret);
  }
  if (updates.length === 0) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "更新するフィールドがありません"), 400);
  }
  updates.push("updated_at = datetime('now')");
  values.push(id);

  await env.SALON_DB.prepare(`UPDATE salons SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  const updated = await env.SALON_DB.prepare(
    `SELECT s.*,
            (SELECT COUNT(*) FROM users u WHERE u.salon_id = s.id AND u.role = 'owner') AS owner_count,
            (SELECT COUNT(*) FROM users u WHERE u.salon_id = s.id) AS staff_count
       FROM salons s WHERE s.id = ?`
  )
    .bind(id)
    .first<SalonRow & { owner_count: number; staff_count: number }>();
  if (!updated) return c.json(err(ERROR_CODES.NOT_FOUND, "加盟店が見つかりません"), 404);
  return c.json(ok(toTenantDetail(updated)));
});

// ── Lark テーブル自動判定 ──
//   Bitable App Token を渡すと、その BASE のテーブル一覧を取得して
//   実 BASE と同じ名前のテーブル ID を「matched」として返す。
app.get("/platform/lark-tables/inspect", async (c) => {
  const auth = await requirePlatformAuth(c);
  if (!auth.ok) return auth.response;
  const appToken = c.req.query("appToken")?.trim();
  const appId = c.req.query("appId")?.trim() || (c.env as Env).LARK_APP_ID;
  const appSecret = c.req.query("appSecret")?.trim() || (c.env as Env).LARK_APP_SECRET;
  if (!appToken) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "appToken は必須", "appToken"), 400);
  }
  if (!appId || !appSecret) {
    return c.json(
      err(ERROR_CODES.VALIDATION_ERROR, "Lark App ID / Secret が必要 (URL クエリ or サーバー側設定)"),
      400
    );
  }

  try {
    const client = new LarkClient(c.env as Env, appId, appSecret, appToken);
    const tables = await client.listTables();
    const items = tables.map((t) => ({ tableId: t.table_id, name: t.name }));
    const findBy = (re: RegExp) => items.find((t) => re.test(t.name))?.tableId ?? null;
    const matched: BitableTablesInspection["matched"] = {
      customer: findBy(/新規顧客|顧客データ|顧客台帳/),
      karte: findBy(/カルテ/),
      monthlyGoal: findBy(/月間目標/),
      yearlyGoal: findBy(/年間目標/),
      sales: findBy(/売上|分析/),
    };
    return c.json(ok({ tables: items, matched } satisfies BitableTablesInspection));
  } catch (e: any) {
    return c.json(err(ERROR_CODES.LARK_API_ERROR, e.message || "Lark API エラー"), 502);
  }
});

// ── SalonRow → TenantSummary / TenantDetail ──
function toTenantSummary(
  row: SalonRow & { owner_count: number; staff_count: number; created_at?: string; updated_at?: string }
): TenantSummary {
  const hasLarkConfig = !!(row.lark_app_id && row.lark_app_secret && row.lark_bitable_app_token);
  const hasAllTableIds = !!(
    row.lark_customer_table_id &&
    row.lark_karte_table_id &&
    row.lark_monthly_goal_table_id &&
    row.lark_yearly_goal_table_id &&
    row.lark_sales_table_id
  );
  return {
    id: row.id,
    salonName: row.salon_name,
    slug: row.slug,
    subdomain: row.subdomain || row.slug,
    themeId: row.theme_id,
    logoUrl: row.logo_url,
    hasLarkConfig,
    hasAllTableIds,
    ownerCount: row.owner_count,
    staffCount: row.staff_count,
    isActive: !!row.is_active,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function toTenantDetail(
  row: SalonRow & { owner_count: number; staff_count: number; created_at?: string; updated_at?: string }
): TenantDetail {
  return {
    ...toTenantSummary(row),
    larkAppId: row.lark_app_id || "",
    larkBitableAppToken: row.lark_bitable_app_token || "",
    larkCustomerTableId: row.lark_customer_table_id || "",
    larkKarteTableId: row.lark_karte_table_id || "",
    larkMonthlyGoalTableId: row.lark_monthly_goal_table_id || "",
    larkYearlyGoalTableId: row.lark_yearly_goal_table_id || "",
    larkSalesTableId: row.lark_sales_table_id || "",
  };
}

// ============================================================
// スタッフ管理 API (Phase B-2)
//   加盟店オーナー (role=owner) が自店舗のスタッフを管理する
// ============================================================

// ── スタッフ管理用ガード: 認証済み + 自サロンの owner のみ ──
async function requireOwner(
  c: any
): Promise<
  | { ok: true; me: UserRow; salonId: number }
  | { ok: false; response: Response }
> {
  const env = c.env as Env;
  const token = readSessionTokenFromCookie(c.req.header("Cookie") || null);
  if (!token) {
    return { ok: false, response: c.json(err(ERROR_CODES.AUTH_UNAUTHENTICATED, "未認証"), 401) };
  }
  const session = await getSession(env, token);
  if (!session) {
    return { ok: false, response: c.json(err(ERROR_CODES.AUTH_UNAUTHENTICATED, "セッション無効"), 401) };
  }
  const me = await env.SALON_DB.prepare(
    `SELECT * FROM users WHERE id = ? AND is_active = 1 LIMIT 1`
  )
    .bind(session.user_id)
    .first<UserRow>();
  if (!me) {
    return { ok: false, response: c.json(err(ERROR_CODES.AUTH_UNAUTHENTICATED, "ユーザー無効"), 401) };
  }
  if (me.role !== "owner") {
    return {
      ok: false,
      response: c.json(err(ERROR_CODES.AUTH_UNAUTHENTICATED, "スタッフ管理はオーナーのみ操作できます"), 403),
    };
  }
  return { ok: true, me, salonId: session.salon_id };
}

function toStaffUser(row: UserRow, selfId: number): StaffUser {
  return {
    id: row.id,
    salonId: row.salon_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: !!row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    isSelf: row.id === selfId,
  };
}

/** 自分の salon の「有効な owner」の数を返す */
async function countActiveOwners(env: Env, salonId: number): Promise<number> {
  const row = await env.SALON_DB.prepare(
    `SELECT COUNT(*) AS n FROM users
       WHERE salon_id = ? AND role = 'owner' AND is_active = 1`
  )
    .bind(salonId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// ── スタッフ一覧 ──
app.get("/staff", async (c) => {
  const auth = await requireOwner(c);
  if (!auth.ok) return auth.response;
  const env = c.env as Env;

  const rows = await env.SALON_DB.prepare(
    `SELECT * FROM users WHERE salon_id = ? ORDER BY is_active DESC, role DESC, created_at ASC`
  )
    .bind(auth.salonId)
    .all<UserRow>();
  const items: StaffUser[] = (rows.results || []).map((r) => toStaffUser(r, auth.me.id));
  return c.json(ok({ items }));
});

// ── スタッフ新規追加 ──
app.post("/staff", async (c) => {
  const auth = await requireOwner(c);
  if (!auth.ok) return auth.response;
  const env = c.env as Env;

  let body: StaffCreateInput;
  try {
    body = (await c.req.json()) as StaffCreateInput;
  } catch {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "不正なリクエスト形式"), 400);
  }
  const email = (body.email || "").trim().toLowerCase();
  if (!email) return c.json(err(ERROR_CODES.VALIDATION_ERROR, "メールは必須", "email"), 400);
  if (!body.displayName?.trim()) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "表示名は必須", "displayName"), 400);
  }
  if (!body.password || body.password.length < 8) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "パスワードは8文字以上", "password"), 400);
  }
  const role = body.role === "owner" ? "owner" : "staff";

  // 同 salon・同 email チェック
  const dup = await env.SALON_DB.prepare(
    `SELECT id FROM users WHERE salon_id = ? AND email = ?`
  )
    .bind(auth.salonId, email)
    .first<{ id: number }>();
  if (dup) {
    return c.json(err(ERROR_CODES.CONFLICT, "このメールは既に登録されています", "email"), 409);
  }

  const hash = await hashPassword(body.password);
  const result = await env.SALON_DB.prepare(
    `INSERT INTO users (salon_id, email, password_hash, display_name, role)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(auth.salonId, email, hash, body.displayName.trim(), role)
    .run();
  const newId = result.meta.last_row_id as number;

  const created = await env.SALON_DB.prepare(`SELECT * FROM users WHERE id = ?`)
    .bind(newId)
    .first<UserRow>();
  return c.json(ok(toStaffUser(created!, auth.me.id)), 201);
});

// ── スタッフ編集 (表示名 / ロール / 有効化フラグ) ──
app.put("/staff/:id", async (c) => {
  const auth = await requireOwner(c);
  if (!auth.ok) return auth.response;
  const env = c.env as Env;
  const targetId = Number(c.req.param("id"));

  let body: StaffUpdateInput;
  try {
    body = (await c.req.json()) as StaffUpdateInput;
  } catch {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "不正なリクエスト形式"), 400);
  }

  // 対象を取得
  const target = await env.SALON_DB.prepare(
    `SELECT * FROM users WHERE id = ? AND salon_id = ?`
  )
    .bind(targetId, auth.salonId)
    .first<UserRow>();
  if (!target) return c.json(err(ERROR_CODES.NOT_FOUND, "スタッフが見つかりません"), 404);

  // セーフガード:
  // - 自分自身を無効化はできない
  // - 自分自身の role を staff に下げるのは、他に owner がいる場合のみ
  // - 最後の有効な owner を無効化 / staff 降格はできない
  if (target.id === auth.me.id && body.isActive === false) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "自分自身を無効化することはできません"), 400);
  }
  const wantsDowngrade = body.role === "staff" && target.role === "owner";
  const wantsDisable = body.isActive === false && target.is_active === 1;
  if ((wantsDowngrade || wantsDisable) && target.role === "owner" && target.is_active === 1) {
    const owners = await countActiveOwners(env, auth.salonId);
    if (owners <= 1) {
      return c.json(
        err(ERROR_CODES.VALIDATION_ERROR, "最後の有効なオーナーは降格/無効化できません"),
        400
      );
    }
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.displayName !== undefined) {
    if (!body.displayName.trim())
      return c.json(err(ERROR_CODES.VALIDATION_ERROR, "表示名は空にできません", "displayName"), 400);
    updates.push("display_name = ?");
    values.push(body.displayName.trim());
  }
  if (body.role !== undefined) {
    if (body.role !== "owner" && body.role !== "staff") {
      return c.json(err(ERROR_CODES.VALIDATION_ERROR, "role は owner または staff", "role"), 400);
    }
    updates.push("role = ?");
    values.push(body.role);
  }
  if (body.isActive !== undefined) {
    updates.push("is_active = ?");
    values.push(body.isActive ? 1 : 0);
  }
  if (updates.length === 0) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "更新するフィールドがありません"), 400);
  }
  updates.push("updated_at = datetime('now')");
  values.push(targetId);

  await env.SALON_DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  const updated = await env.SALON_DB.prepare(`SELECT * FROM users WHERE id = ?`)
    .bind(targetId)
    .first<UserRow>();
  return c.json(ok(toStaffUser(updated!, auth.me.id)));
});

// ── スタッフのパスワードリセット ──
app.post("/staff/:id/reset-password", async (c) => {
  const auth = await requireOwner(c);
  if (!auth.ok) return auth.response;
  const env = c.env as Env;
  const targetId = Number(c.req.param("id"));

  let body: { password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "不正なリクエスト形式"), 400);
  }
  if (!body.password || body.password.length < 8) {
    return c.json(err(ERROR_CODES.VALIDATION_ERROR, "パスワードは8文字以上", "password"), 400);
  }

  const target = await env.SALON_DB.prepare(
    `SELECT id FROM users WHERE id = ? AND salon_id = ?`
  )
    .bind(targetId, auth.salonId)
    .first<{ id: number }>();
  if (!target) return c.json(err(ERROR_CODES.NOT_FOUND, "スタッフが見つかりません"), 404);

  const hash = await hashPassword(body.password);
  await env.SALON_DB.prepare(
    `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(hash, targetId)
    .run();

  // 該当ユーザーの既存セッションをすべて無効化 (パスワード変更後は再ログインを強制)
  await env.SALON_DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(targetId).run();
  // KV キャッシュは TTL でいずれ消えるので明示削除なし

  return c.json(ok({ resetAt: new Date().toISOString() }));
});

// ============================================================
// Export for Cloudflare Pages Functions
// ============================================================
export const onRequest: PagesFunction<Env> = async (context) => {
  return app.fetch(context.request, context.env, context.ctx);
};
