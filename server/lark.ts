import axios from "axios";

const LARK_API_BASE = "https://open.larksuite.com/open-apis";

interface LarkTokenCache {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, LarkTokenCache>();

/**
 * Get tenant access token from Lark API
 */
export async function getTenantAccessToken(
  appId: string,
  appSecret: string
): Promise<string> {
  const cacheKey = `${appId}:${appSecret}`;
  const cached = tokenCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const response = await axios.post(
    `${LARK_API_BASE}/auth/v3/tenant_access_token/internal`,
    {
      app_id: appId,
      app_secret: appSecret,
    }
  );

  if (response.data.code !== 0) {
    throw new Error(
      `Lark auth failed: ${response.data.msg || "Unknown error"}`
    );
  }

  const token = response.data.tenant_access_token;
  const expiresIn = (response.data.expire || 7200) * 1000;

  tokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + expiresIn - 60000, // 1 min buffer
  });

  return token;
}

/**
 * Create a record in Lark Bitable
 */
export async function createBitableRecord(
  appId: string,
  appSecret: string,
  appToken: string,
  tableId: string,
  fields: Record<string, unknown>
): Promise<{ recordId: string }> {
  const token = await getTenantAccessToken(appId, appSecret);

  const response = await axios.post(
    `${LARK_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    { fields },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (response.data.code !== 0) {
    throw new Error(
      `Lark Bitable create record failed: ${response.data.msg || "Unknown error"} (code: ${response.data.code})`
    );
  }

  return {
    recordId: response.data.data?.record?.record_id || "",
  };
}

/**
 * Map form data to Lark Bitable field format
 * Handles special field types like dates, numbers, and select options
 */
export function mapFormDataToLarkFields(
  formData: Record<string, unknown>,
  fieldMappings?: Record<string, string>
): Record<string, unknown> {
  const larkFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(formData)) {
    const larkFieldName = fieldMappings?.[key] || key;

    if (value === null || value === undefined || value === "") {
      continue;
    }

    // Handle date values - Lark expects millisecond timestamps
    if (typeof value === "string" && /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(value)) {
      const date = new Date(value.replace(/\//g, "-"));
      if (!isNaN(date.getTime())) {
        larkFields[larkFieldName] = date.getTime();
        continue;
      }
    }

    // Handle year-month values
    if (typeof value === "string" && /^\d{4}[-/]\d{2}$/.test(value)) {
      const date = new Date(value.replace(/\//g, "-") + "-01");
      if (!isNaN(date.getTime())) {
        larkFields[larkFieldName] = date.getTime();
        continue;
      }
    }

    // Handle numeric strings
    if (typeof value === "string" && /^\d+$/.test(value)) {
      larkFields[larkFieldName] = Number(value);
      continue;
    }

    larkFields[larkFieldName] = value;
  }

  return larkFields;
}
