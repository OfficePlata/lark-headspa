/**
 * 年間目標 一覧+編集 (/goals/yearly)
 *
 * - 一覧: 年度・売上目標・客単価・自由記入欄
 * - 行クリック or 「編集」でモーダルで編集
 * - 「新規」ボタンで新規モーダル
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  Edit3,
  Plus,
  Save,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import AppShell from "@/components/AppShell";
import type { YearlyGoal, YearlyGoalInput } from "../../shared/types";

export default function GoalsYearlyPage() {
  const [items, setItems] = useState<YearlyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<YearlyGoal | null>(null);
  const [creating, setCreating] = useState(false);

  function reload() {
    setLoading(true);
    api.goals.yearly
      .list()
      .then((res) => {
        setItems(res.items);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "取得失敗"))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  return (
    <AppShell subtitle="年間目標" activeNav="goals">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/goals" className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> 目標ダッシュボード
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-xl font-semibold text-slate-800">年間目標</h1>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
            style={{ background: "var(--theme-primary)" }}
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
          <CenteredCard>まだ年間目標が登録されていません</CenteredCard>
        ) : (
          <div className="space-y-3">
            {items.map((y) => (
              <YearlyCard key={y.recordId} item={y} onEdit={() => setEditing(y)} />
            ))}
          </div>
        )}
      </div>

      {creating && (
        <YearlyModal
          mode="create"
          initial={{ fiscalYear: String(new Date().getFullYear()), note: "" }}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      {editing && (
        <YearlyModal
          mode="edit"
          recordId={editing.recordId}
          initial={{
            fiscalYear: editing.fiscalYear,
            revenueTarget: editing.revenueTarget ?? undefined,
            averageSpend: editing.averageSpend ?? undefined,
            note: editing.note,
          }}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </AppShell>
  );
}

function YearlyCard({ item, onEdit }: { item: YearlyGoal; onEdit: () => void }) {
  return (
    <section
      className="bg-white rounded-2xl border p-5 flex items-start justify-between gap-4"
      style={{ borderColor: "var(--theme-border)" }}
    >
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-base font-bold text-slate-800">{item.fiscalYear} 年度</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="年間売上目標" value={fmtCurrency(item.revenueTarget)} />
          <Stat label="客単価" value={fmtCurrency(item.averageSpend)} />
          <Stat label="月間売上目標(自動)" value={fmtCurrency(item.monthlyRevenueTarget)} muted />
          <Stat
            label="年間来店数目標(自動)"
            value={item.yearlyVisitsTarget !== null ? `${item.yearlyVisitsTarget} 人` : "—"}
            muted
          />
        </div>
        {item.note && (
          <div className="mt-3 p-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded whitespace-pre-wrap">
            {item.note}
          </div>
        )}
      </div>
      <button
        onClick={onEdit}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100"
      >
        <Edit3 className="w-3.5 h-3.5" />
        編集
      </button>
    </section>
  );
}

function YearlyModal({
  mode,
  recordId,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  recordId?: string;
  initial: YearlyGoalInput;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<YearlyGoalInput>(initial);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function set<K extends keyof YearlyGoalInput>(key: K, value: YearlyGoalInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fiscalYear.trim()) {
      setErrorMsg("年度は必須です");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      if (mode === "create") await api.goals.yearly.create(form);
      else await api.goals.yearly.update(recordId!, form);
      toast.success(mode === "create" ? "年間目標を作成しました" : "更新しました");
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
            {mode === "create" ? "年間目標 新規" : "年間目標 編集"}
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
          <Field label="年度" required>
            <input
              type="text"
              required
              value={form.fiscalYear}
              onChange={(e) => set("fiscalYear", e.target.value)}
              placeholder="2026"
              className={inputCls}
            />
          </Field>
          <Field label="年間売上目標 (¥)">
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
          <Field label="自由記入欄">
            <textarea
              value={form.note ?? ""}
              onChange={(e) => set("note", e.target.value)}
              rows={3}
              className={inputCls + " resize-y"}
              placeholder="今年の方針・メモなど"
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
              style={{ background: "var(--theme-primary)" }}
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
      style={{ borderColor: "var(--theme-border)" }}
    >
      {children}
    </div>
  );
}

