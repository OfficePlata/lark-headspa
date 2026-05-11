/**
 * Platform Admin — 加盟店 詳細・編集・新規 (/platform/tenants/:id, /platform/tenants/new)
 *
 * 新規モード: 店舗情報 + Lark設定 + 初期オーナー登録
 * 編集モード: 店舗情報 + Lark設定 (オーナーセクションなし)
 *
 * Lark テーブル ID は「Bitable App Token を入れて [自動判定] ボタンで
 * 5 テーブルを名前マッチで自動入力 → 必要なら手動調整」というUX。
 */
import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  LogOut,
  Plus,
  Save,
  Search,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuthSession } from "@/lib/platform-auth-context";
import type {
  BitableTablesInspection,
  StaffUser,
  TenantDetail,
  TenantUpsertInput,
} from "../../shared/types";

type FormState = TenantUpsertInput;

const EMPTY_FORM: FormState = {
  salonName: "",
  slug: "",
  subdomain: "",
  themeId: "calmer",
  larkAppId: "",
  larkAppSecret: "",
  larkBitableAppToken: "",
  larkCustomerTableId: "",
  larkKarteTableId: "",
  larkMonthlyGoalTableId: "",
  larkYearlyGoalTableId: "",
  larkSalesTableId: "",
  ownerEmail: "",
  ownerName: "",
  ownerPassword: "",
};

export default function PlatformTenantDetail() {
  const { session, logout } = usePlatformAuthSession();
  const [, params] = useRoute<{ id: string }>("/platform/tenants/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const isNew = id === "new";

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 自動判定状態
  const [inspecting, setInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState<BitableTablesInspection | null>(null);

  // 既存ロード (編集モード時)
  useEffect(() => {
    if (isNew || !id) return;
    setLoading(true);
    api.platform.tenants
      .get(Number(id))
      .then((t) => {
        setTenant(t);
        setForm({
          salonName: t.salonName,
          slug: t.slug,
          subdomain: t.subdomain,
          themeId: t.themeId,
          larkAppId: t.larkAppId,
          larkAppSecret: "", // 既存値は表示しない
          larkBitableAppToken: t.larkBitableAppToken,
          larkCustomerTableId: t.larkCustomerTableId,
          larkKarteTableId: t.larkKarteTableId,
          larkMonthlyGoalTableId: t.larkMonthlyGoalTableId,
          larkYearlyGoalTableId: t.larkYearlyGoalTableId,
          larkSalesTableId: t.larkSalesTableId,
        });
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加盟店の取得に失敗"))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleInspect() {
    if (!form.larkBitableAppToken.trim()) {
      toast.error("Bitable App Token を入力してください");
      return;
    }
    setInspecting(true);
    try {
      const res = await api.platform.inspectLarkTables({
        appToken: form.larkBitableAppToken.trim(),
        appId: form.larkAppId?.trim() || undefined,
        appSecret: form.larkAppSecret?.trim() || undefined,
      });
      setInspectResult(res);
      // matched で fields を埋める (元の値が空のところだけ)
      setForm((prev) => ({
        ...prev,
        larkCustomerTableId: res.matched.customer || prev.larkCustomerTableId,
        larkKarteTableId: res.matched.karte || prev.larkKarteTableId,
        larkMonthlyGoalTableId: res.matched.monthlyGoal || prev.larkMonthlyGoalTableId,
        larkYearlyGoalTableId: res.matched.yearlyGoal || prev.larkYearlyGoalTableId,
        larkSalesTableId: res.matched.sales || prev.larkSalesTableId,
      }));
      const filled = Object.values(res.matched).filter(Boolean).length;
      toast.success(`${filled}/5 テーブルを自動判定しました`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lark テーブル取得失敗");
    } finally {
      setInspecting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    if (!form.salonName.trim()) return setSaveError("店舗名は必須");
    if (!form.slug.trim() || !/^[a-z0-9-]+$/.test(form.slug))
      return setSaveError("slug は半角英数字とハイフンのみ");
    if (!form.larkBitableAppToken.trim()) return setSaveError("Bitable App Token は必須");

    if (isNew) {
      if (!form.ownerEmail || !form.ownerName || !form.ownerPassword) {
        return setSaveError("初期オーナー (メール / 名前 / パスワード) は必須");
      }
      if ((form.ownerPassword || "").length < 8) {
        return setSaveError("オーナーパスワードは8文字以上");
      }
    }

    setSaving(true);
    try {
      const payload: TenantUpsertInput = {
        ...form,
        subdomain: form.subdomain?.trim() || form.slug.trim(),
        // 空の App Secret は送らない (編集時に既存値を保持)
        larkAppSecret: form.larkAppSecret?.trim() || undefined,
      };
      let result: TenantDetail;
      if (isNew) {
        result = await api.platform.tenants.create(payload);
        toast.success("加盟店を作成しました");
      } else {
        result = await api.platform.tenants.update(Number(id), payload);
        toast.success("加盟店を更新しました");
        setTenant(result);
      }
      setLocation(`/platform/tenants/${result.id}`);
    } catch (e) {
      setSaveError(e instanceof ApiError || e instanceof Error ? e.message : "保存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Header adminName={session.admin.displayName} onLogout={() => logout()} />

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6 text-sm">
          <Link
            href="/platform/tenants"
            className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> 加盟店一覧
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-800 font-medium">
            {isNew ? "新規加盟店" : tenant?.salonName || "加盟店"}
          </span>
        </div>

        {loading ? (
          <Centered>読み込み中…</Centered>
        ) : error ? (
          <Centered>
            <span className="text-red-600">{error}</span>
          </Centered>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {saveError && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
                {saveError}
              </div>
            )}

            {/* 基本情報 */}
            <Section title="基本情報">
              <Grid>
                <Field label="店舗名" required>
                  <input
                    type="text"
                    required
                    value={form.salonName}
                    onChange={(e) => set("salonName", e.target.value)}
                    placeholder="Calmer 霧島店"
                    className={inputCls}
                  />
                </Field>
                <Field label="slug (URL用)" required help="半角英数字とハイフンのみ">
                  <input
                    type="text"
                    required
                    pattern="[a-z0-9-]+"
                    value={form.slug}
                    onChange={(e) => set("slug", e.target.value)}
                    placeholder="calmer-kirishima"
                    className={inputCls}
                    disabled={!isNew && !!tenant} // 編集時は念のため非活性 (運用上 slug 変更は危険)
                  />
                </Field>
                <Field label="サブドメイン" help="未指定なら slug と同じ">
                  <input
                    type="text"
                    value={form.subdomain ?? ""}
                    onChange={(e) => set("subdomain", e.target.value)}
                    placeholder="(slug と同じ)"
                    className={inputCls}
                  />
                </Field>
                <Field label="テーマ">
                  <select
                    value={form.themeId ?? "calmer"}
                    onChange={(e) => set("themeId", e.target.value)}
                    className={inputCls}
                  >
                    <option value="calmer">カルメ</option>
                    <option value="natural">ナチュラル</option>
                    <option value="elegant">エレガント</option>
                    <option value="fresh">フレッシュ</option>
                    <option value="sakura">サクラ</option>
                  </select>
                </Field>
              </Grid>
            </Section>

            {/* Lark 接続 */}
            <Section title="Lark BASE 接続">
              <Grid>
                <Field
                  label="Lark App ID"
                  help="加盟店共通のApp IDを使う場合は空でOK (環境変数のフォールバック)"
                >
                  <input
                    type="text"
                    value={form.larkAppId ?? ""}
                    onChange={(e) => set("larkAppId", e.target.value)}
                    placeholder="cli_xxxxxxxxx"
                    className={inputCls}
                  />
                </Field>
                <Field
                  label="Lark App Secret"
                  help={isNew ? "App ID と組で必要 (共通の場合は空)" : "変更時のみ入力。空なら既存値維持"}
                >
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={form.larkAppSecret ?? ""}
                    onChange={(e) => set("larkAppSecret", e.target.value)}
                    placeholder={isNew ? "" : "********"}
                    className={inputCls}
                  />
                </Field>
              </Grid>
              <Field label="Bitable App Token" required help="加盟店の Lark BASE URL の /base/ 直後の文字列">
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={form.larkBitableAppToken}
                    onChange={(e) => set("larkBitableAppToken", e.target.value)}
                    placeholder="TC4QbGyrLarVFcsqmNIjrzmLp4f"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    disabled={inspecting || !form.larkBitableAppToken.trim()}
                    onClick={handleInspect}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 shrink-0"
                  >
                    <Search className="w-4 h-4" />
                    {inspecting ? "確認中…" : "5テーブル自動判定"}
                  </button>
                </div>
              </Field>

              {inspectResult && (
                <InspectionResult inspection={inspectResult} />
              )}
            </Section>

            <Section title="テーブル ID (Bitable App Token を 自動判定 すれば自動入力)">
              <Grid>
                <Field label="新規顧客データ">
                  <input
                    type="text"
                    value={form.larkCustomerTableId ?? ""}
                    onChange={(e) => set("larkCustomerTableId", e.target.value)}
                    placeholder="tbl..."
                    className={inputCls}
                  />
                </Field>
                <Field label="カルテデータ">
                  <input
                    type="text"
                    value={form.larkKarteTableId ?? ""}
                    onChange={(e) => set("larkKarteTableId", e.target.value)}
                    placeholder="tbl..."
                    className={inputCls}
                  />
                </Field>
                <Field label="月間目標シート">
                  <input
                    type="text"
                    value={form.larkMonthlyGoalTableId ?? ""}
                    onChange={(e) => set("larkMonthlyGoalTableId", e.target.value)}
                    placeholder="tbl..."
                    className={inputCls}
                  />
                </Field>
                <Field label="年間目標シート">
                  <input
                    type="text"
                    value={form.larkYearlyGoalTableId ?? ""}
                    onChange={(e) => set("larkYearlyGoalTableId", e.target.value)}
                    placeholder="tbl..."
                    className={inputCls}
                  />
                </Field>
                <Field label="売上・分析">
                  <input
                    type="text"
                    value={form.larkSalesTableId ?? ""}
                    onChange={(e) => set("larkSalesTableId", e.target.value)}
                    placeholder="tbl..."
                    className={inputCls}
                  />
                </Field>
              </Grid>
            </Section>

            {/* 初期オーナー (新規時のみ) */}
            {isNew && (
              <Section title="初期オーナー (新規作成時のみ)">
                <Grid>
                  <Field label="メールアドレス" required>
                    <input
                      type="email"
                      required
                      value={form.ownerEmail ?? ""}
                      onChange={(e) => set("ownerEmail", e.target.value)}
                      placeholder="owner@calmer-kirishima.localhost"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="表示名" required>
                    <input
                      type="text"
                      required
                      value={form.ownerName ?? ""}
                      onChange={(e) => set("ownerName", e.target.value)}
                      placeholder="るみ"
                      className={inputCls}
                    />
                  </Field>
                </Grid>
                <Field label="初期パスワード" required help="8文字以上。オーナーに伝達後、初回ログイン後に変更してもらう想定">
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={form.ownerPassword ?? ""}
                    onChange={(e) => set("ownerPassword", e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </Section>
            )}

            {/* 編集時のアクション */}
            {!isNew && tenant && (
              <>
                <Section title="加盟店オーナーへのアクセス">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <div className="text-slate-700">
                        オーナー {tenant.ownerCount} / 全スタッフ {tenant.staffCount}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        加盟店オーナーは以下 URL でログインできます
                      </div>
                    </div>
                    <a
                      href={`/login?tenant=${tenant.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      /login?tenant={tenant.slug}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </Section>

                <TenantUsersSection tenantId={tenant.id} />
              </>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLocation("/platform/tenants")}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-300 bg-white hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "保存中…" : isNew ? "加盟店を作成" : "保存"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── 加盟店スタッフ管理 (Platform Admin 経由) ──
function TenantUsersSection({ tenantId }: { tenantId: number }) {
  const [items, setItems] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function reload() {
    setLoading(true);
    api.platform.tenantUsers
      .list(tenantId)
      .then((res) => {
        setItems(res.items);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "スタッフ取得失敗"))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [tenantId]);

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">スタッフ一覧</h2>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700"
        >
          <UserPlus className="w-3.5 h-3.5" />
          スタッフを追加
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-sm">読み込み中…</div>
      ) : error ? (
        <div className="text-center py-6 text-red-600 text-sm">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-sm">
          スタッフがまだ登録されていません。最初の1人を追加してください。
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">表示名</th>
                <th className="px-3 py-2 text-left">メール</th>
                <th className="px-3 py-2 text-left">ロール</th>
                <th className="px-3 py-2 text-left">状態</th>
                <th className="px-3 py-2 text-left">最終ログイン</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 font-medium text-slate-800">{s.displayName}</td>
                  <td className="px-3 py-2 text-slate-600">{s.email}</td>
                  <td className="px-3 py-2">
                    {s.role === "owner" ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                        オーナー
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        スタッフ
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {s.isActive ? (
                      <span className="text-xs text-emerald-700">有効</span>
                    ) : (
                      <span className="text-xs text-slate-400">無効</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString("ja-JP") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <TenantUserCreateModal
          tenantId={tenantId}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
            toast.success("スタッフを追加しました。加盟店オーナーに認証情報を伝達してください");
          }}
        />
      )}
    </section>
  );
}

function TenantUserCreateModal({
  tenantId,
  onClose,
  onCreated,
}: {
  tenantId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<{
    email: string;
    displayName: string;
    password: string;
    role: "owner" | "staff";
  }>({ email: "", displayName: "", password: "", role: "owner" });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!form.email.trim()) return setErrorMsg("メールは必須");
    if (!form.displayName.trim()) return setErrorMsg("表示名は必須");
    if (form.password.length < 8) return setErrorMsg("パスワードは8文字以上");
    setSubmitting(true);
    try {
      await api.platform.tenantUsers.create(tenantId, form);
      onCreated();
    } catch (e) {
      setErrorMsg(e instanceof ApiError || e instanceof Error ? e.message : "追加失敗");
    } finally {
      setSubmitting(false);
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
          <h2 className="text-base font-semibold text-slate-800 inline-flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            スタッフを追加
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
          <Field label="メールアドレス" required>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="owner@example.com"
              className={inputCls}
            />
          </Field>
          <Field label="表示名" required>
            <input
              type="text"
              required
              value={form.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              placeholder="山田"
              className={inputCls}
            />
          </Field>
          <Field label="初期パスワード" required help="8文字以上。本人に伝達後、本人がリセット可能">
            <input
              type="text"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="ロール" help="初期オーナーは owner を選択">
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value as "owner" | "staff")}
              className={inputCls}
            >
              <option value="owner">オーナー (スタッフ管理も可)</option>
              <option value="staff">スタッフ (通常)</option>
            </select>
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
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {submitting ? "追加中…" : "追加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InspectionResult({ inspection }: { inspection: BitableTablesInspection }) {
  const matched = inspection.matched;
  const rows: Array<{ label: string; tableId: string | null }> = [
    { label: "新規顧客データ", tableId: matched.customer },
    { label: "カルテデータ", tableId: matched.karte },
    { label: "月間目標シート", tableId: matched.monthlyGoal },
    { label: "年間目標シート", tableId: matched.yearlyGoal },
    { label: "売上・分析", tableId: matched.sales },
  ];
  return (
    <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
      <div className="text-xs text-slate-500 mb-2">
        Lark BASE のテーブル {inspection.tables.length} 件を検出 / マッチ結果:
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-xs">
            <span className="text-slate-700">{r.label}</span>
            {r.tableId ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <code className="px-1 py-0.5 bg-white rounded border border-slate-200">
                  {r.tableId}
                </code>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <X className="w-3.5 h-3.5" />
                未検出 (手入力してください)
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 共通 ──
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}

function Field({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {help && <span className="block text-xs text-slate-400 mt-1">{help}</span>}
    </label>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-slate-700 focus:ring-2 focus:ring-slate-200 outline-none text-sm bg-white disabled:bg-slate-100 disabled:text-slate-500";

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
