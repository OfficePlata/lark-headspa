/**
 * Platform Admin — 加盟店一覧 (/platform/tenants)
 *
 * 加盟店 (テナント) 一覧 + 新規追加リンク + 各加盟店の設定状態バッジ。
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  LogOut,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { usePlatformAuthSession } from "@/lib/platform-auth-context";
import type { TenantSummary } from "../../shared/types";

export default function PlatformTenants() {
  const { session, logout } = usePlatformAuthSession();
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.platform.tenants
      .list()
      .then((res) => {
        setItems(res.items);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加盟店一覧の取得に失敗"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <Header adminName={session.admin.displayName} onLogout={() => logout()} />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 inline-flex items-center gap-2">
              <Users className="w-5 h-5" />
              加盟店一覧
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {items.length} 件の加盟店が登録されています
            </p>
          </div>
          <button
            onClick={() => setLocation("/platform/tenants/new")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700"
          >
            <Plus className="w-4 h-4" />
            加盟店を追加
          </button>
        </div>

        {loading ? (
          <Centered>読み込み中…</Centered>
        ) : error ? (
          <Centered>
            <span className="text-red-600">{error}</span>
          </Centered>
        ) : items.length === 0 ? (
          <Centered>
            まだ加盟店が登録されていません。
            <button
              onClick={() => setLocation("/platform/tenants/new")}
              className="block mx-auto mt-3 px-4 py-1.5 rounded-lg bg-slate-800 text-white text-sm"
            >
              最初の加盟店を追加
            </button>
          </Centered>
        ) : (
          <div className="space-y-3">
            {items.map((t) => (
              <TenantCard
                key={t.id}
                tenant={t}
                onSelect={() => setLocation(`/platform/tenants/${t.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TenantCard({
  tenant,
  onSelect,
}: {
  tenant: TenantSummary;
  onSelect: () => void;
}) {
  const ready = tenant.hasLarkConfig && tenant.hasAllTableIds;
  return (
    <button
      onClick={onSelect}
      className="w-full bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-400 hover:shadow-sm transition text-left"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-slate-800 truncate">
              {tenant.salonName}
            </h2>
            {!tenant.isActive && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                無効
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mb-3">
            slug: <code className="px-1 py-0.5 bg-slate-100 rounded">{tenant.slug}</code>
            <span className="ml-3">テーマ: {tenant.themeId}</span>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <StatusBadge
              ok={tenant.hasLarkConfig}
              label="Lark 認証"
            />
            <StatusBadge
              ok={tenant.hasAllTableIds}
              label="5 テーブル"
            />
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              オーナー {tenant.ownerCount}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              スタッフ計 {tenant.staffCount}
            </span>
          </div>

          {ready && (
            <a
              href={`/login?tenant=${tenant.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 mt-3 text-xs text-blue-600 hover:underline"
            >
              加盟店ログイン画面を開く
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
      </div>
    </button>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3 h-3" />
      {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      <AlertTriangle className="w-3 h-3" />
      {label} 未設定
    </span>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center py-16 text-slate-500 bg-white rounded-2xl border border-slate-200">
      {children}
    </div>
  );
}

function Header({ adminName, onLogout }: { adminName: string; onLogout: () => void }) {
  return (
    <header className="bg-slate-800 text-white">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/platform/tenants" className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          <span className="text-base font-bold">Platform Admin</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-300 hidden sm:inline">{adminName}</span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-slate-200 hover:bg-slate-700 transition"
          >
            <LogOut className="w-4 h-4" />
            ログアウト
          </button>
        </div>
      </div>
    </header>
  );
}
