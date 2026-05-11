/**
 * Login ページ
 *
 * - GET /api/tenant-info でテナント情報（店舗名）を取得して表示
 * - POST /api/auth/login で認証 → 成功で /dashboard に遷移
 * - 401 でエラー表示、429 でロックアウト表示
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { api, ApiError } from "../lib/api";
import type { TenantInfo } from "../../shared/types";

export default function Login() {
  const [, setLocation] = useLocation();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 既にログイン済みなら /dashboard へ
  useEffect(() => {
    api.auth
      .session()
      .then(() => setLocation("/dashboard"))
      .catch(() => {
        // 未認証は想定通り
      });
  }, [setLocation]);

  // テナント情報を取得（無いときは「テナント未指定」状態）
  useEffect(() => {
    api.auth
      .tenantInfo()
      .then((t) => setTenant(t))
      .catch((e: ApiError | Error) => {
        setTenantError(e.message);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const session = await api.auth.login(email, password);
      toast.success(`ようこそ ${session.user.displayName} さん`);
      setLocation("/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ログインに失敗しました";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <div className="w-full max-w-md">
        {/* ロゴ・店舗名 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white text-2xl font-bold shadow-lg mb-4">
            {tenant?.salonName?.[0] ?? "CRM"}
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            {tenant?.salonName ?? "サロンCRM"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {tenantError
              ? "テナント未指定（管理画面はサブドメインからアクセスしてください）"
              : "スタッフ用ログイン"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-8 space-y-5"
        >
          {errorMsg && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3"
            >
              {errorMsg}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
              placeholder="staff@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 transition shadow-sm"
          >
            {submitting ? "ログイン中…" : "ログイン"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          サロンCRM &copy; {new Date().getFullYear()} OFFICE PLATA
        </p>
      </div>
    </div>
  );
}
