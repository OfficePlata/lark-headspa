/**
 * API Client - Simple fetch wrapper for Cloudflare Pages Functions
 * Replaces tRPC with direct REST API calls
 */
import type {
  ApiResponse,
  Customer,
  CustomerInput,
  CustomerListQuery,
  CustomerListResult,
  Karte,
  KarteInput,
  KarteListQuery,
  KarteListResult,
  MonthlyGoal,
  MonthlyGoalInput,
  SalesAnalytics,
  SessionInfo,
  TenantInfo,
  YearlyGoal,
  YearlyGoalInput,
} from "../../shared/types";

const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((error as any).error || `API Error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/** 新 API 形式 ({ok:true,data} | {ok:false,error}) 専用 */
async function requestWithEnvelope<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  return res.json() as Promise<ApiResponse<T>>;
}

export class ApiError extends Error {
  code: string;
  field?: string;
  constructor(code: string, message: string, field?: string) {
    super(message);
    this.code = code;
    this.field = field;
  }
}

/** envelope を unwrap して、エラーなら ApiError を投げる */
async function unwrap<T>(promise: Promise<ApiResponse<T>>): Promise<T> {
  const res = await promise;
  if (res.ok) return res.data;
  throw new ApiError(res.error.code, res.error.message, res.error.field);
}

// ============ Theme API ============
export const api = {
  themes: {
    list: () => request<Array<{
      id: string; name: string; nameJa: string; description: string;
      colors: Record<string, string>; fonts: Record<string, string>;
      borderRadius: string;
    }>>("/themes"),

    get: (id: string) => request<any>(`/themes/${id}`),
  },

  salons: {
    list: () => request<any[]>("/salons"),

    create: (data: { salonName: string; slug: string; themeId?: string }) =>
      request<{ id: number; success: boolean }>("/salons", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    get: (id: number) => request<any>(`/salons/${id}`),

    update: (id: number, data: Record<string, string>) =>
      request<{ success: boolean }>(`/salons/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    submissions: (id: number, formType?: string) => {
      const params = formType ? `?formType=${formType}` : "";
      return request<any[]>(`/salons/${id}/submissions${params}`);
    },
  },

  form: {
    getBySlug: (slug: string, formType: string) =>
      request<{
        salon: { id: number; salonName: string; slug: string; logoUrl: string | null };
        theme: any;
        formTitle: string;
        fields: any[];
      } | null>(`/form/${slug}?type=${formType}`),

    submit: (slug: string, formType: string, formData: Record<string, unknown>, photoTokens?: string[]) =>
      request<{ success: boolean; submissionId: number; larkSynced: boolean; syncError: string | null }>(
        `/form/${slug}/submit`,
        { method: "POST", body: JSON.stringify({ formType, formData, photoTokens }) }
      ),
  },

  customers: {
    list: (slug: string) =>
      request<{
        customers: Array<{ recordId: string; customerNo: string; name: string }>;
        error?: string;
      }>(`/salons/${slug}/customers`),
  },

  photos: {
    upload: async (slug: string, file: File): Promise<{ success: boolean; fileToken: string }> => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/salons/${slug}/upload-photo`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((error as any).error || `Upload Error: ${res.status}`);
      }

      return res.json();
    },
  },

  formTypes: () =>
    request<Array<{ id: string; title: string; fieldCount: number }>>("/form-types"),

  // ── Phase 2: 顧客台帳 (認証付き / 実 BASE「新規顧客データ」テーブル) ──
  customerLedger: {
    list: (query: CustomerListQuery = {}) => {
      const params = new URLSearchParams();
      if (query.q) params.set("q", query.q);
      if (query.gender) params.set("gender", query.gender);
      if (query.visitTrigger) params.set("visitTrigger", query.visitTrigger);
      if (query.sort) params.set("sort", query.sort);
      if (query.pageToken) params.set("pageToken", query.pageToken);
      if (query.pageSize) params.set("pageSize", String(query.pageSize));
      const qs = params.toString();
      return unwrap(
        requestWithEnvelope<CustomerListResult>(`/customers${qs ? `?${qs}` : ""}`)
      );
    },

    get: (recordId: string) =>
      unwrap(requestWithEnvelope<Customer>(`/customers/${encodeURIComponent(recordId)}`)),

    create: (input: CustomerInput) =>
      unwrap(
        requestWithEnvelope<Customer>("/customers", {
          method: "POST",
          body: JSON.stringify(input),
        })
      ),

    update: (recordId: string, input: Partial<CustomerInput>) =>
      unwrap(
        requestWithEnvelope<Customer>(`/customers/${encodeURIComponent(recordId)}`, {
          method: "PUT",
          body: JSON.stringify(input),
        })
      ),
  },

  // ── Phase 3: カルテ (認証付き / 実 BASE「カルテデータ」テーブル) ──
  karte: {
    list: (query: KarteListQuery = {}) => {
      const params = new URLSearchParams();
      if (query.customerRecordId) params.set("customerRecordId", query.customerRecordId);
      if (query.customerName) params.set("customerName", query.customerName);
      if (query.customerKind) params.set("customerKind", query.customerKind);
      if (query.treatmentCourse) params.set("treatmentCourse", query.treatmentCourse);
      if (query.visitDateFrom) params.set("visitDateFrom", query.visitDateFrom);
      if (query.visitDateTo) params.set("visitDateTo", query.visitDateTo);
      if (query.pageToken) params.set("pageToken", query.pageToken);
      if (query.pageSize) params.set("pageSize", String(query.pageSize));
      const qs = params.toString();
      return unwrap(requestWithEnvelope<KarteListResult>(`/karte${qs ? `?${qs}` : ""}`));
    },

    get: (recordId: string) =>
      unwrap(requestWithEnvelope<Karte>(`/karte/${encodeURIComponent(recordId)}`)),

    create: (input: KarteInput) =>
      unwrap(
        requestWithEnvelope<Karte>("/karte", {
          method: "POST",
          body: JSON.stringify(input),
        })
      ),

    update: (recordId: string, input: Partial<KarteInput>) =>
      unwrap(
        requestWithEnvelope<Karte>(`/karte/${encodeURIComponent(recordId)}`, {
          method: "PUT",
          body: JSON.stringify(input),
        })
      ),

    /** 写真を Lark Drive にアップロードして file_token を取得 */
    uploadPhoto: async (file: File): Promise<{ fileToken: string; name: string }> => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/karte/upload-photo`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = (await res.json()) as ApiResponse<{ fileToken: string; name: string }>;
      if (data.ok) return data.data;
      throw new ApiError(data.error.code, data.error.message, data.error.field);
    },
  },

  // ── Phase 4: 目標管理 ──
  goals: {
    yearly: {
      list: () =>
        unwrap(requestWithEnvelope<{ items: YearlyGoal[] }>("/goals/yearly")),
      get: (recordId: string) =>
        unwrap(requestWithEnvelope<YearlyGoal>(`/goals/yearly/${encodeURIComponent(recordId)}`)),
      create: (input: YearlyGoalInput) =>
        unwrap(
          requestWithEnvelope<YearlyGoal>("/goals/yearly", {
            method: "POST",
            body: JSON.stringify(input),
          })
        ),
      update: (recordId: string, input: Partial<YearlyGoalInput>) =>
        unwrap(
          requestWithEnvelope<YearlyGoal>(`/goals/yearly/${encodeURIComponent(recordId)}`, {
            method: "PUT",
            body: JSON.stringify(input),
          })
        ),
    },
    monthly: {
      list: () =>
        unwrap(requestWithEnvelope<{ items: MonthlyGoal[] }>("/goals/monthly")),
      get: (recordId: string) =>
        unwrap(requestWithEnvelope<MonthlyGoal>(`/goals/monthly/${encodeURIComponent(recordId)}`)),
      create: (input: MonthlyGoalInput) =>
        unwrap(
          requestWithEnvelope<MonthlyGoal>("/goals/monthly", {
            method: "POST",
            body: JSON.stringify(input),
          })
        ),
      update: (recordId: string, input: Partial<MonthlyGoalInput>) =>
        unwrap(
          requestWithEnvelope<MonthlyGoal>(`/goals/monthly/${encodeURIComponent(recordId)}`, {
            method: "PUT",
            body: JSON.stringify(input),
          })
        ),
    },
  },

  analytics: {
    list: () =>
      unwrap(requestWithEnvelope<{ items: SalesAnalytics[] }>("/analytics")),
  },

  // ── Phase 0-1: 認証・テナント ──
  auth: {
    login: (email: string, password: string) =>
      unwrap(
        requestWithEnvelope<SessionInfo>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        })
      ),

    logout: () =>
      unwrap(requestWithEnvelope<{ loggedOut: boolean }>("/auth/logout", { method: "POST" })),

    session: () => unwrap(requestWithEnvelope<SessionInfo>("/auth/session")),

    tenantInfo: () => unwrap(requestWithEnvelope<TenantInfo>("/tenant-info")),
  },
};
