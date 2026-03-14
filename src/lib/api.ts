/**
 * API Client - Simple fetch wrapper for Cloudflare Pages Functions
 * Replaces tRPC with direct REST API calls
 */

const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
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
};
