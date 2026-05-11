/**
 * Lark Open API クライアント (Cloudflare Pages Functions 用)
 *
 * - tenant_access_token を KV に2時間キャッシュ
 * - 429 / 一時障害は Exponential Backoff で 3 回までリトライ
 * - 失敗時は LarkApiError をスロー
 *
 * 実 BASE の 5 テーブル構造に対応:
 *   年間目標シート / 月間目標シート / 新規顧客データ / カルテデータ / 売上・分析
 *
 * 注: salons テーブルが (app_id, app_secret, bitable_app_token, table_id) を
 *     テナントごとに持つため、クライアントは「サロン単位」で生成して使う。
 */

import type { SalonLarkConfig } from "../../shared/types";

export interface LarkClientEnv {
  KV: KVNamespace;
  LARK_DOMAIN?: string; // default: open.larksuite.com
}

export class LarkApiError extends Error {
  code: number;
  status?: number;
  constructor(message: string, code: number, status?: number) {
    super(message);
    this.name = "LarkApiError";
    this.code = code;
    this.status = status;
  }
}

const TOKEN_TTL_SECONDS = 2 * 60 * 60 - 300; // 2時間 - 5分のマージン
const MAX_RETRIES = 3;

export class LarkClient {
  private env: LarkClientEnv;
  private appId: string;
  private appSecret: string;
  private appToken: string;
  private domain: string;

  constructor(env: LarkClientEnv, appId: string, appSecret: string, appToken: string) {
    this.env = env;
    this.appId = appId;
    this.appSecret = appSecret;
    this.appToken = appToken;
    this.domain = env.LARK_DOMAIN || "open.larksuite.com";
  }

  /** 設定オブジェクトから生成する糖衣 */
  static fromConfig(env: LarkClientEnv, config: SalonLarkConfig): LarkClient {
    return new LarkClient(env, config.appId, config.appSecret, config.bitableAppToken);
  }

  // ── トークン管理 ──
  private cacheKey(): string {
    return `lark:tenant_access_token:${this.appId}`;
  }

  async getTenantAccessToken(forceRefresh = false): Promise<string> {
    const key = this.cacheKey();
    if (!forceRefresh && this.env.KV) {
      const cached = await this.env.KV.get(key);
      if (cached) return cached;
    }

    const res = await fetch(
      `https://${this.domain}/open-apis/auth/v3/tenant_access_token/internal`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: this.appId, app_secret: this.appSecret }),
      }
    );
    const data = (await res.json()) as { code: number; msg?: string; tenant_access_token?: string; expire?: number };

    if (data.code !== 0 || !data.tenant_access_token) {
      throw new LarkApiError(
        `Lark 認証失敗: ${data.msg || "unknown"}`,
        data.code,
        res.status
      );
    }

    const token = data.tenant_access_token;
    const ttl = Math.min(data.expire ?? 7200, TOKEN_TTL_SECONDS);
    if (this.env.KV) {
      await this.env.KV.put(key, token, { expirationTtl: ttl });
    }
    return token;
  }

  // ── 汎用リクエスト（リトライ付き） ──
  private async request<T = unknown>(
    method: string,
    apiPath: string,
    body?: unknown
  ): Promise<T> {
    let lastError: LarkApiError | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const token = await this.getTenantAccessToken(attempt > 0);
      const res = await fetch(`https://${this.domain}/open-apis${apiPath}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      // 429 → backoff
      if (res.status === 429) {
        const wait = Math.min(1000 * Math.pow(2, attempt), 4000);
        await sleep(wait);
        continue;
      }

      const data = (await res.json()) as { code: number; msg?: string; data?: T };

      // トークン期限切れ → 強制リフレッシュしてリトライ
      if (data.code === 99991663 || data.code === 99991661) {
        if (attempt < MAX_RETRIES - 1) continue;
      }

      if (data.code !== 0) {
        lastError = new LarkApiError(
          `Lark API エラー (${apiPath}): ${data.msg || "unknown"}`,
          data.code,
          res.status
        );
        // 5xx は再試行、4xx は即時失敗
        if (res.status >= 500 && attempt < MAX_RETRIES - 1) {
          await sleep(1000 * Math.pow(2, attempt));
          continue;
        }
        throw lastError;
      }

      return data.data as T;
    }

    throw lastError ?? new LarkApiError("Lark API リトライ上限", -1);
  }

  // ── Bitable Records CRUD ──
  async createRecord(
    tableId: string,
    fields: Record<string, unknown>
  ): Promise<{ record_id: string; fields: Record<string, unknown> }> {
    const data = await this.request<{ record: { record_id: string; fields: Record<string, unknown> } }>(
      "POST",
      `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records`,
      { fields }
    );
    return data.record;
  }

  async listRecords(
    tableId: string,
    options: { pageSize?: number; pageToken?: string; viewId?: string } = {}
  ): Promise<{ items: LarkRecord[]; has_more: boolean; page_token?: string }> {
    const params = new URLSearchParams();
    if (options.pageSize) params.set("page_size", String(options.pageSize));
    if (options.pageToken) params.set("page_token", options.pageToken);
    if (options.viewId) params.set("view_id", options.viewId);
    const qs = params.toString() ? `?${params}` : "";
    return this.request(`GET`, `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records${qs}`);
  }

  async getRecord(tableId: string, recordId: string): Promise<LarkRecord> {
    const data = await this.request<{ record: LarkRecord }>(
      "GET",
      `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records/${recordId}`
    );
    return data.record;
  }

  async updateRecord(
    tableId: string,
    recordId: string,
    fields: Record<string, unknown>
  ): Promise<LarkRecord> {
    const data = await this.request<{ record: LarkRecord }>(
      "PUT",
      `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records/${recordId}`,
      { fields }
    );
    return data.record;
  }

  async deleteRecord(tableId: string, recordId: string): Promise<void> {
    await this.request("DELETE", `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records/${recordId}`);
  }

  /**
   * Bitable の search エンドポイント（複雑なフィルタ用）
   * body 例: { filter: { conjunction: "and", conditions: [...] }, sort: [...] }
   */
  async searchRecords(
    tableId: string,
    body: Record<string, unknown> = {}
  ): Promise<{ items: LarkRecord[]; has_more: boolean; page_token?: string }> {
    return this.request(
      "POST",
      `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records/search`,
      body
    );
  }

  // ── フィールド構造取得（デバッグ・自動マッピング用） ──
  async listFields(tableId: string): Promise<LarkField[]> {
    const data = await this.request<{ items: LarkField[] }>(
      "GET",
      `/bitable/v1/apps/${this.appToken}/tables/${tableId}/fields?page_size=100`
    );
    return data.items;
  }

  // ── テーブル一覧 ──
  async listTables(): Promise<Array<{ table_id: string; name: string; revision: number }>> {
    const data = await this.request<{ items: Array<{ table_id: string; name: string; revision: number }> }>(
      "GET",
      `/bitable/v1/apps/${this.appToken}/tables`
    );
    return data.items;
  }
}

// ── 型 ──
export interface LarkRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

export interface LarkField {
  field_id: string;
  field_name: string;
  type: number;
  ui_type: string;
  property?: unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
