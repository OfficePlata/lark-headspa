/**
 * Cloudflare Pages Functions - Hono API Server
 * All API routes under /api/* are handled here
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { THEMES, THEME_LIST, getTheme, DEFAULT_FORM_CONFIGS, FORM_TYPES, LARK_READONLY_FIELDS } from "../../shared/themes";

// ============================================================
// Types
// ============================================================
interface Env {
  SALON_DB: D1Database;
  LARK_APP_ID?: string;
  LARK_APP_SECRET?: string;
  AUTH_SECRET?: string;
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
      // Try common field names for customer number and name
      const customerNo = fields["顧客No"] || fields["顧客no"] || fields["No"] || "";
      const sei = fields["姓"] || "";
      const mei = fields["名前"] || fields["名"] || "";
      const shimei = fields["氏名"] || "";
      const displayName = shimei || `${sei} ${mei}`.trim() || "名前なし";

      customers.push({
        recordId: item.record_id,
        customerNo: String(customerNo),
        name: String(displayName),
      });
    }

    hasMore = data.data?.has_more || false;
    pageToken = data.data?.page_token;
  }

  return customers;
}

/**
 * Upload a file to Lark Drive and return the file_token for Bitable attachment
 */
async function uploadFileToLark(
  appId: string,
  appSecret: string,
  fileData: ArrayBuffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const token = await getTenantAccessToken(appId, appSecret);

  // Upload via Lark Drive media upload API
  const formData = new FormData();
  const blob = new Blob([fileData], { type: mimeType });
  formData.append("file", blob, fileName);
  formData.append("file_name", fileName);
  formData.append("parent_type", "bitable_file");
  formData.append("parent_node", "");
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

  if (!salon.lark_app_id || !salon.lark_app_secret) {
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
// Export for Cloudflare Pages Functions
// ============================================================
export const onRequest: PagesFunction<Env> = async (context) => {
  return app.fetch(context.request, context.env, context.ctx);
};
