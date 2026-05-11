/**
 * Platform Admin (OFFICE PLATA 側) ログイン (/platform/login)
 *
 * サロンスタッフ用 /login と外見を分けるため、ダークなネイビー基調に。
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

export default function PlatformLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 既にログイン済みなら /platform/tenants へ
  useEffect(() => {
    api.platform
      .session()
      .then(() => setLocation("/platform/tenants"))
      .catch(() => {});
  }, [setLocation]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const session = await api.platform.login(email, password);
      toast.success(`ようこそ ${session.admin.displayName} さん`);
      setLocation("/platform/tenants");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "ログインに失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800 text-white shadow-lg mb-4 border border-slate-600">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">Platform Admin</h1>
          <p className="text-sm text-slate-300 mt-1">OFFICE PLATA 管理者ログイン</p>
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
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
              管理者メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-slate-700 focus:ring-2 focus:ring-slate-200 outline-none transition"
              placeholder="admin@officeplata.jp"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-slate-700 focus:ring-2 focus:ring-slate-200 outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full py-2.5 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 active:bg-slate-900 disabled:bg-slate-300 transition shadow-sm"
          >
            {submitting ? "ログイン中…" : "管理者ログイン"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          サロンCRM Platform Admin &copy; {new Date().getFullYear()} OFFICE PLATA
        </p>
      </div>
    </div>
  );
}
