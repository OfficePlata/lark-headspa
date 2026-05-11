/**
 * 顧客台帳 詳細・編集ページ (/customers/:recordId)
 *
 * - GET /api/customers/:recordId で詳細を表示
 * - 「編集」モードに切り替えると姓・名・フリガナ・性別・電話・生年月日・来店日・来店のきっかけを変更可能
 * - 「保存」で PUT /api/customers/:recordId
 * - 顧客No / 年齢 / 氏名 / 来店年月 は読み取り専用 (Lark 側で自動計算)
 * - 関連カルテ件数 (カルテデータ DuplexLink) も表示
 */
import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Edit3,
  Image as ImageIcon,
  Phone,
  Plus,
  Save,
  User,
  Users,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useTheme } from "@/lib/auth-context";
import AppShell from "@/components/AppShell";
import { VISIT_TRIGGERS } from "../../shared/types";
import type { Customer, CustomerInput, Karte, VisitTrigger } from "../../shared/types";

export default function CustomerDetail() {
  const theme = useTheme();
  const [, params] = useRoute<{ recordId: string }>("/customers/:recordId");
  const [, setLocation] = useLocation();
  const recordId = params?.recordId;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CustomerInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    api.customerLedger
      .get(recordId)
      .then((c) => {
        setCustomer(c);
        setForm(customerToInput(c));
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "顧客の取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, [recordId]);

  function startEdit() {
    if (!customer) return;
    setForm(customerToInput(customer));
    setEditing(true);
    setSaveError(null);
  }

  function cancelEdit() {
    if (customer) setForm(customerToInput(customer));
    setEditing(false);
    setSaveError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!recordId || !form) return;
    if (!form.lastName.trim() || !form.firstName.trim()) {
      setSaveError("姓・名前は必須です");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.customerLedger.update(recordId, form);
      setCustomer(updated);
      setForm(customerToInput(updated));
      setEditing(false);
      toast.success("更新しました");
    } catch (e) {
      setSaveError(e instanceof ApiError || e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (!recordId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        顧客IDが指定されていません。
      </div>
    );
  }

  return (
    <AppShell subtitle="顧客詳細" activeNav="customers">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* パンくず */}
        <div className="flex items-center gap-3 mb-6 text-sm">
          <Link
            href="/customers"
            className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> 顧客一覧
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-800 font-medium">
            {customer?.fullName || "顧客詳細"}
          </span>
        </div>

        {loading ? (
          <CenteredCard>読み込み中…</CenteredCard>
        ) : error ? (
          <CenteredCard>
            <span className="text-red-600">{error}</span>
            <button
              onClick={() => setLocation("/customers")}
              className="block mx-auto mt-3 underline text-sm text-slate-600"
            >
              顧客一覧へ戻る
            </button>
          </CenteredCard>
        ) : customer && form ? (
          <>
            {/* タイトル + 編集ボタン */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-xs text-slate-500 mb-1">{customer.customerNo}</div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  {customer.fullName || `${customer.lastName} ${customer.firstName}`.trim()}
                  {customer.gender && (
                    <span
                      className={`text-xs font-normal px-2 py-0.5 rounded-full ${
                        customer.gender === "男性"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-pink-50 text-pink-700"
                      }`}
                    >
                      {customer.gender}
                    </span>
                  )}
                  {customer.age !== null && (
                    <span className="text-sm font-normal text-slate-500">{customer.age}歳</span>
                  )}
                </h1>
                {customer.kana && (
                  <div className="text-sm text-slate-500 mt-1">{customer.kana}</div>
                )}
              </div>
              {!editing ? (
                <button
                  onClick={startEdit}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
                  style={{ background: "var(--theme-primary)" }}
                >
                  <Edit3 className="w-4 h-4" />
                  編集
                </button>
              ) : (
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                  キャンセル
                </button>
              )}
            </div>

            {editing ? (
              <EditForm
                form={form}
                onChange={setForm}
                onSubmit={handleSave}
                saving={saving}
                errorMsg={saveError}
              />
            ) : (
              <ReadView customer={customer} />
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

// ── 表示モード ──
function ReadView({ customer }: { customer: Customer }) {
  return (
    <div className="space-y-4">
      <Card title="基本情報" icon={<User className="w-4 h-4" />}>
        <DataRow label="顧客No" value={customer.customerNo || "—"} />
        <DataRow label="姓" value={customer.lastName || "—"} />
        <DataRow label="名前" value={customer.firstName || "—"} />
        <DataRow label="氏名（自動）" value={customer.fullName || "—"} muted />
        <DataRow label="フリガナ" value={customer.kana || "—"} />
        <DataRow label="性別" value={customer.gender || "—"} />
        <DataRow
          label="生年月日"
          value={customer.birthday || "—"}
          rightExtra={customer.age !== null ? `${customer.age} 歳` : null}
        />
      </Card>

      <Card title="連絡先" icon={<Phone className="w-4 h-4" />}>
        <DataRow label="電話番号" value={customer.phone || "—"} />
      </Card>

      <Card title="来店情報" icon={<CalendarDays className="w-4 h-4" />}>
        <DataRow label="来店日" value={customer.firstVisitDate || "—"} />
        <DataRow label="来店年月（自動）" value={customer.firstVisitYearMonth || "—"} muted />
        <DataRow
          label="来店のきっかけ"
          value={
            customer.visitTriggers.length === 0 ? (
              "—"
            ) : (
              <div className="flex gap-1 flex-wrap">
                {customer.visitTriggers.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )
          }
        />
      </Card>

      <KarteCard customerRecordId={customer.recordId} />
    </div>
  );
}

// ── この顧客のカルテ一覧 ──
function KarteCard({ customerRecordId }: { customerRecordId: string }) {
  const [items, setItems] = useState<Karte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.karte
      .list({ customerRecordId, pageSize: 20 })
      .then((res) => {
        setItems(res.items);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "カルテ取得失敗"))
      .finally(() => setLoading(false));
  }, [customerRecordId]);

  return (
    <section
      className="bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--theme-border)" }}
    >
      <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700 inline-flex items-center gap-2">
          <ClipboardList className="w-4 h-4" />
          カルテ ({items.length}件)
        </span>
        <Link
          href={`/karte/new?customerRecordId=${encodeURIComponent(customerRecordId)}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-90"
          style={{ background: "var(--theme-primary)" }}
        >
          <Plus className="w-3.5 h-3.5" />
          新規カルテ
        </Link>
      </header>
      {loading ? (
        <div className="px-5 py-6 text-center text-slate-400 text-sm">読み込み中…</div>
      ) : error ? (
        <div className="px-5 py-6 text-center text-red-600 text-sm">{error}</div>
      ) : items.length === 0 ? (
        <div className="px-5 py-6 text-center text-slate-400 text-sm">
          まだカルテがありません
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((k) => (
            <li key={k.recordId}>
              <Link
                href={`/karte/${k.recordId}`}
                className="grid grid-cols-[6rem_1fr_auto] gap-3 px-5 py-3 hover:bg-slate-50 items-center"
              >
                <div className="text-xs text-slate-500">
                  {k.visitDate || k.karteId || "—"}
                </div>
                <div className="text-sm text-slate-700">
                  <div className="flex gap-1 flex-wrap">
                    {k.treatmentCourses.length > 0
                      ? k.treatmentCourses.map((c) => (
                          <span
                            key={c}
                            className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700"
                          >
                            {c}
                          </span>
                        ))
                      : "—"}
                  </div>
                  {k.treatmentComment && (
                    <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                      {k.treatmentComment}
                    </div>
                  )}
                </div>
                <div className="text-sm text-slate-700 text-right">
                  {k.totalAmount !== null ? `¥${k.totalAmount.toLocaleString()}` : "—"}
                  {k.photos.length > 0 && (
                    <div className="text-xs text-slate-400 inline-flex items-center gap-1 ml-2">
                      <ImageIcon className="w-3 h-3" />
                      {k.photos.length}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--theme-border)" }}>
      <header className="px-5 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700 inline-flex items-center gap-2 w-full">
        {icon}
        {title}
      </header>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function DataRow({
  label,
  value,
  muted,
  rightExtra,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  rightExtra?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[10rem_1fr_auto] gap-3 px-5 py-3 text-sm items-center">
      <div className={`text-slate-500 ${muted ? "italic" : ""}`}>{label}</div>
      <div className={`text-slate-800 ${muted ? "text-slate-500" : ""}`}>{value}</div>
      <div className="text-xs text-slate-400">{rightExtra}</div>
    </div>
  );
}

// ── 編集モード ──
function EditForm({
  form,
  onChange,
  onSubmit,
  saving,
  errorMsg,
}: {
  form: CustomerInput;
  onChange: (f: CustomerInput) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  errorMsg: string | null;
}) {
  function set<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    onChange({ ...form, [key]: value });
  }

  function toggleTrigger(t: VisitTrigger) {
    const current = form.visitTriggers || [];
    set(
      "visitTriggers",
      current.includes(t) ? current.filter((x) => x !== t) : [...current, t]
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-2xl border p-6 space-y-4"
      style={{ borderColor: "var(--theme-border)" }}
    >
      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {errorMsg}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="姓" required>
          <input
            type="text"
            required
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="名前" required>
          <input
            type="text"
            required
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="フリガナ">
        <input
          type="text"
          value={form.kana ?? ""}
          onChange={(e) => set("kana", e.target.value)}
          placeholder="セイ メイ"
          className={inputCls}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="性別">
          <select
            value={form.gender ?? ""}
            onChange={(e) =>
              set(
                "gender",
                e.target.value === "男性" || e.target.value === "女性"
                  ? e.target.value
                  : undefined
              )
            }
            className={inputCls}
          >
            <option value="">未選択</option>
            <option value="男性">男性</option>
            <option value="女性">女性</option>
          </select>
        </Field>
        <Field label="生年月日">
          <input
            type="date"
            value={form.birthday ?? ""}
            onChange={(e) => set("birthday", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="電話番号">
        <input
          type="tel"
          value={form.phone ?? ""}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="090-0000-0000"
          className={inputCls}
        />
      </Field>
      <Field label="来店日">
        <input
          type="date"
          value={form.firstVisitDate ?? ""}
          onChange={(e) => set("firstVisitDate", e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label="来店のきっかけ（複数選択可）">
        <div className="flex gap-2 flex-wrap">
          {VISIT_TRIGGERS.map((t) => {
            const active = (form.visitTriggers || []).includes(t);
            return (
              <button
                type="button"
                key={t}
                onClick={() => toggleTrigger(t)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  active
                    ? "bg-amber-50 text-amber-700 border-amber-300"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="flex justify-end pt-2">
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
  );
}

// ── 共通 ──
function customerToInput(c: Customer): CustomerInput {
  return {
    lastName: c.lastName,
    firstName: c.firstName,
    kana: c.kana,
    gender: c.gender || undefined,
    phone: c.phone,
    birthday: c.birthday || undefined,
    visitTriggers: c.visitTriggers,
    firstVisitDate: c.firstVisitDate || undefined,
  };
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white";

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

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center py-16 text-slate-500 bg-white rounded-2xl border" style={{ borderColor: "var(--theme-border)" }}>
      {children}
    </div>
  );
}

