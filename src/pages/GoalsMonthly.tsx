/**
 * 月間目標 一覧+編集 (/goals/monthly)
 *
 * - 一覧: 年月・月間目標売上・目標稼働日数・客単価・(自動)売上/客数
 * - 行クリック or 「編集」でモーダル
 * - 「新規」ボタンで新規モーダル
 * - 売上・分析テーブルの当月実績と並べる
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Edit3,
  LogOut,
  Plus,
  Save,
  Target,
  Users,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuthSession } from "@/lib/auth-context";
import type {
  MonthlyGoal,
  MonthlyGoalInput,
  SalesAnalytics,
} from "../../shared/types";

export default function GoalsMonthlyPage() {
  const { session, logout } = useAuthSession();
  const [items, setItems] = useState<MonthlyGoal[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MonthlyGoal | null>(null);
  const [creating, setCreating] = useState(false);

  function reload() {
    setLoading(true);
    Promise.all([api.goals.monthly.list(), api.analytics.list()])
      .then(([m, a]) => {
        setItems(m.items);
        setAnalytics(a.items);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "取得失敗"))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  const analyticsByMonth = useMemo(() => {
    const map = new Map<string, SalesAnalytics>();
    for (const a of analytics) if (a.yearMonth) map.set(a.yearMonth, a);
    return map;
  }, [analytics]);

  const currentYearMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#FAF7F2" }}>
      <PageHeader
        salonName={session.tenant.salonName}
        userDisplayName={session.user.displayName}
        onLogout={() => logout()}
      />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/goals"
              className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> 目標ダッシュボード
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-xl font-semibold text-slate-800 inline-flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              月間目標
            </h1>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
            style={{ background: "#8B7355" }}
          >
            <Plus className="w-4 h-4" />
            新規
          </button>
        </div>

        {loading ? (
          <CenteredCard>読み込み中…</CenteredCard>
        ) : error ? (
          <CenteredCard>
            <span className="text-red-600">{error}</span>
          </CenteredCard>
        ) : items.length === 0 ? (
          <CenteredCard>まだ月間目標が登録されていません</CenteredCard>
        ) : (
          <div className="space-y-3">
            {items.map((m) => (
              <MonthlyCard
                key={m.recordId}
                item={m}
                analytics={analyticsByMonth.get(m.yearMonth) || null}
                isCurrent={m.yearMonth === currentYearMonth}
                onEdit={() => setEditing(m)}
              />
            ))}
          </div>
        )}
      </div>

      {creating && (
        <MonthlyModal
          mode="create"
          initial={{ yearMonth: currentYearMonth }}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      {editing && (
        <MonthlyModal
          mode="edit"
          recordId={editing.recordId}
          initial={{
            yearMonth: editing.yearMonth,
            revenueTarget: editing.revenueTarget ?? undefined,
            workingDaysTarget: editing.workingDaysTarget ?? undefined,
            averageSpend: editing.averageSpend ?? undefined,
          }}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function MonthlyCard({
  item,
  analytics,
  isCurrent,
  onEdit,
}: {
  item: MonthlyGoal;
  analytics: SalesAnalytics | null;
  isCurrent: boolean;
  onEdit: () => void;
}) {
  return (
    <section
      className="bg-white rounded-2xl border p-5"
      style={{ borderColor: "#E8DFD0" }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-slate-800">{item.yearMonth}</span>
          {isCurrent && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              今月
            </span>
          )}
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        >
          <Edit3 className="w-3.5 h-3.5" />
          編集
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Stat label="月間目標売上" value={fmtCurrency(item.revenueTarget)} />
        <Stat
          label="目標稼働日数"
          value={item.workingDaysTarget !== null ? `${item.workingDaysTarget} 日` : "—"}
        />
        <Stat label="客単価" value={fmtCurrency(item.averageSpend)} />
        <Stat label="売上/日(自動)" value={fmtCurrency(item.revenuePerDay)} muted />
      </div>

      {analytics && (
        <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">実績 (売上・分析より)</span>
            {analytics.achievementRate !== null && (
              <span
                className={`text-base font-bold ${
                  analytics.achievementRate >= 1
                    ? "text-emerald-600"
                    : analytics.achievementRate >= 0.8
                      ? "text-amber-600"
                      : "text-slate-600"
                }`}
              >
                達成率 {(analytics.achievementRate * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <KeyVal label="総売上" value={fmtCurrency(analytics.totalRevenue)} />
            <KeyVal
              label="総来店"
              value={
                analytics.totalVisits !== null ? `${analytics.totalVisits} 人` : "—"
              }
            />
            <KeyVal
              label="新規率"
              value={
                analytics.newRate !== null
                  ? `${(analytics.newRate * 100).toFixed(0)}%`
                  : "—"
              }
            />
            <KeyVal label="客単価" value={fmtCurrency(analytics.averageSpend)} />
          </div>
        </div>
      )}
    </section>
  );
}

function MonthlyModal({
  mode,
  recordId,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  recordId?: string;
  initial: MonthlyGoalInput;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<MonthlyGoalInput>(initial);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function set<K extends keyof MonthlyGoalInput>(key: K, value: MonthlyGoalInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.yearMonth.trim()) {
      setErrorMsg("年月は必須です");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      if (mode === "create") await api.goals.monthly.create(form);
      else await api.goals.monthly.update(recordId!, form);
      toast.success(mode === "create" ? "月間目標を作成しました" : "更新しました");
      onSaved();
    } catch (e) {
      setErrorMsg(e instanceof ApiError || e instanceof Error ? e.message : "保存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden"
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">
            {mode === "create" ? "月間目標 新規" : "月間目標 編集"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {errorMsg}
            </div>
          )}
          <Field label="年月" required>
            <input
              type="month"
              required
              value={form.yearMonth}
              onChange={(e) => set("yearMonth", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="月間目標売上 (¥)">
            <input
              type="number"
              min={0}
              value={form.revenueTarget ?? ""}
              onChange={(e) =>
                set("revenueTarget", e.target.value === "" ? undefined : Number(e.target.value))
              }
              className={inputCls}
            />
          </Field>
          <Field label="目標稼働日数 (日)">
            <input
              type="number"
              min={0}
              max={31}
              value={form.workingDaysTarget ?? ""}
              onChange={(e) =>
                set(
                  "workingDaysTarget",
                  e.target.value === "" ? undefined : Number(e.target.value)
                )
              }
              className={inputCls}
            />
          </Field>
          <Field label="客単価 (¥)">
            <input
              type="number"
              min={0}
              value={form.averageSpend ?? ""}
              onChange={(e) =>
                set("averageSpend", e.target.value === "" ? undefined : Number(e.target.value))
              }
              className={inputCls}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-300 hover:bg-slate-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
              style={{ background: "#8B7355" }}
            >
              <Save className="w-4 h-4" />
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 共通 ──
function Stat({
  label,
  value,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-base font-semibold ${muted ? "text-slate-500" : "text-slate-800"}`}>
        {value}
      </div>
    </div>
  );
}

function KeyVal({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-700">{value}</div>
    </div>
  );
}

function fmtCurrency(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `¥${Math.round(v).toLocaleString()}`;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white";

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-center py-16 text-slate-500 bg-white rounded-2xl border"
      style={{ borderColor: "#E8DFD0" }}
    >
      {children}
    </div>
  );
}

function PageHeader({
  salonName,
  userDisplayName,
  onLogout,
}: {
  salonName: string;
  userDisplayName: string;
  onLogout: () => void;
}) {
  return (
    <header className="border-b bg-white" style={{ borderColor: "#E8DFD0" }}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "#8B7355" }}
          >
            <Target className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span
              className="text-base font-bold truncate"
              style={{ fontFamily: "'Noto Serif JP', serif", color: "#3D3226" }}
            >
              {salonName}
            </span>
            <span className="text-xs text-slate-500 truncate">月間目標</span>
          </div>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/customers"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <Users className="w-4 h-4" />
            顧客台帳
          </Link>
          <Link
            href="/karte"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <ClipboardList className="w-4 h-4" />
            カルテ
          </Link>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
            <div className="w-6 h-6 rounded-full bg-slate-300 text-white text-xs font-semibold flex items-center justify-center">
              {userDisplayName.slice(0, 1)}
            </div>
            <span className="text-xs text-slate-700 max-w-[10rem] truncate">
              {userDisplayName}
            </span>
          </div>
          <button
            onClick={onLogout}
            title="ログアウト"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">ログアウト</span>
          </button>
        </div>
      </div>
    </header>
  );
}
