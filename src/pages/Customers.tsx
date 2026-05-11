/**
 * 顧客台帳 一覧ページ (/customers)
 *
 * - 実 BASE「新規顧客データ」(tblaxZtrnk0jwBjB) を一覧表示
 * - キーワード検索 (姓/名/フリガナ/電話番号)
 * - 性別 / 来店のきっかけで絞り込み
 * - 並び順: 最近の来店順 / 姓フリガナ順 / 顧客No順
 * - ページネーション (page_token ベース)
 * - 「新規登録」モーダルから POST /api/customers
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useTheme } from "@/lib/auth-context";
import AppShell from "@/components/AppShell";
import { VISIT_TRIGGERS } from "../../shared/types";
import type { Customer, CustomerInput, VisitTrigger } from "../../shared/types";
import type { ThemeConfig } from "../../shared/themes";

type SortKey = "recent" | "lastName" | "customerNo";

export default function Customers() {
  const theme = useTheme();
  const [, setLocation] = useLocation();

  // 検索条件
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [gender, setGender] = useState<"" | "男性" | "女性">("");
  const [visitTrigger, setVisitTrigger] = useState<"" | VisitTrigger>("");
  const [sort, setSort] = useState<SortKey>("recent");

  // 一覧
  const [items, setItems] = useState<Customer[]>([]);
  const [pageToken, setPageToken] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 新規モーダル
  const [showCreate, setShowCreate] = useState(false);

  const fetchPage = useCallback(
    async (reset = true) => {
      const isFirst = reset;
      isFirst ? setLoading(true) : setLoadingMore(true);
      try {
        const res = await api.customerLedger.list({
          q: appliedKeyword || undefined,
          gender: gender || undefined,
          visitTrigger: visitTrigger || undefined,
          sort,
          pageToken: isFirst ? undefined : pageToken,
          pageSize: 50,
        });
        setItems((prev) => (isFirst ? res.items : [...prev, ...res.items]));
        setHasMore(res.hasMore);
        setPageToken(res.pageToken);
        setError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "顧客の取得に失敗しました";
        setError(msg);
      } finally {
        isFirst ? setLoading(false) : setLoadingMore(false);
      }
    },
    [appliedKeyword, gender, visitTrigger, sort, pageToken]
  );

  // 検索条件が変わったら再取得
  useEffect(() => {
    fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedKeyword, gender, visitTrigger, sort]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedKeyword(keyword.trim());
  }

  function resetFilters() {
    setKeyword("");
    setAppliedKeyword("");
    setGender("");
    setVisitTrigger("");
    setSort("recent");
  }

  return (
    <AppShell subtitle="顧客台帳" activeNav="customers">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* ページタイトル */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hover:underline inline-flex items-center gap-1 text-sm"
              style={{ color: theme.colors.textMuted }}
            >
              <ArrowLeft className="w-4 h-4" /> ホーム
            </Link>
            <span style={{ color: theme.colors.border }}>/</span>
            <h1
              className="text-xl font-semibold inline-flex items-center gap-2"
              style={{ color: theme.colors.text, fontFamily: theme.fonts.heading }}
            >
              <Users className="w-5 h-5" />
              顧客台帳
            </h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
            style={{ background: theme.colors.primary }}
          >
            <Plus className="w-4 h-4" />
            新規登録
          </button>
        </div>

        {/* 検索バー */}
        <div className="bg-white rounded-2xl p-4 mb-4 border" style={{ borderColor: theme.colors.border }}>
          <form onSubmit={applySearch} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs text-slate-500 mb-1">
                キーワード（姓・名・フリガナ・電話）
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="search"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="例: 田中 / タナカ / 090..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">性別</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as typeof gender)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">すべて</option>
                <option value="男性">男性</option>
                <option value="女性">女性</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">来店のきっかけ</label>
              <select
                value={visitTrigger}
                onChange={(e) => setVisitTrigger(e.target.value as typeof visitTrigger)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">すべて</option>
                {VISIT_TRIGGERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">並び順</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="recent">最近の来店順</option>
                <option value="lastName">姓（フリガナ）順</option>
                <option value="customerNo">顧客No順</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700"
            >
              検索
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
            >
              クリア
            </button>
          </form>
        </div>

        {/* 一覧 */}
        {loading ? (
          <CenteredMessage>読み込み中…</CenteredMessage>
        ) : error ? (
          <CenteredMessage>
            <span className="text-red-600">{error}</span>
            <button
              onClick={() => fetchPage(true)}
              className="block mx-auto mt-2 underline text-sm text-slate-600"
            >
              再試行
            </button>
          </CenteredMessage>
        ) : items.length === 0 ? (
          <CenteredMessage>
            該当する顧客は見つかりませんでした。
            <button
              onClick={() => setShowCreate(true)}
              className="block mx-auto mt-3 px-4 py-1.5 rounded-lg text-white text-sm"
              style={{ background: theme.colors.primary }}
            >
              新規登録する
            </button>
          </CenteredMessage>
        ) : (
          <CustomerTable
            items={items}
            onRowClick={(c) => setLocation(`/customers/${c.recordId}`)}
          />
        )}

        {hasMore && !loading && (
          <div className="mt-4 flex justify-center">
            <button
              disabled={loadingMore}
              onClick={() => fetchPage(false)}
              className="px-5 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              {loadingMore ? "読み込み中…" : "もっと読む"}
            </button>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(c) => {
            setShowCreate(false);
            toast.success(`${c.fullName || c.lastName} さんを登録しました`);
            // 先頭に挿入
            setItems((prev) => [c, ...prev]);
          }}
        />
      )}
    </AppShell>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <div className="text-center py-16 text-slate-500 bg-white rounded-2xl border" style={{ borderColor: theme.colors.border }}>
      {children}
    </div>
  );
}

// ── 顧客テーブル ──
function CustomerTable({
  items,
  onRowClick,
}: {
  items: Customer[];
  onRowClick: (c: Customer) => void;
}) {
  const theme = useTheme();
  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: theme.colors.border }}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">顧客No</th>
              <th className="px-4 py-3 text-left">氏名</th>
              <th className="px-4 py-3 text-left">フリガナ</th>
              <th className="px-4 py-3 text-left">性別</th>
              <th className="px-4 py-3 text-right">年齢</th>
              <th className="px-4 py-3 text-left">電話番号</th>
              <th className="px-4 py-3 text-left">来店日</th>
              <th className="px-4 py-3 text-left">きっかけ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((c) => (
              <tr
                key={c.recordId}
                onClick={() => onRowClick(c)}
                className="hover:bg-slate-50 cursor-pointer"
              >
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{c.customerNo || "—"}</td>
                <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                  {c.fullName || `${c.lastName} ${c.firstName}`.trim() || "—"}
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{c.kana || "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <GenderBadge gender={c.gender} />
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {c.age !== null ? `${c.age}` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{c.phone || "—"}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {c.firstVisitDate || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {c.visitTriggers.length === 0
                      ? "—"
                      : c.visitTriggers.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600"
                          >
                            {t}
                          </span>
                        ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-slate-400">
                  <ChevronRight className="w-4 h-4 inline" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GenderBadge({ gender }: { gender: Customer["gender"] }) {
  if (gender === "男性") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
        男性
      </span>
    );
  }
  if (gender === "女性") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-pink-50 text-pink-700">
        女性
      </span>
    );
  }
  return <span className="text-slate-400">—</span>;
}

// ── 新規登録モーダル ──
function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: Customer) => void;
}) {
  const [form, setForm] = useState<CustomerInput>({
    lastName: "",
    firstName: "",
    kana: "",
    phone: "",
  });
  const theme = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => form.lastName.trim().length > 0 && form.firstName.trim().length > 0 && !submitting,
    [form.lastName, form.firstName, submitting]
  );

  function setField<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTrigger(t: VisitTrigger) {
    setForm((prev) => {
      const current = prev.visitTriggers || [];
      return {
        ...prev,
        visitTriggers: current.includes(t)
          ? current.filter((x) => x !== t)
          : [...current, t],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const customer = await api.customerLedger.create(form);
      onCreated(customer);
    } catch (e) {
      const msg = e instanceof ApiError || e instanceof Error ? e.message : "登録に失敗しました";
      setErrorMsg(msg);
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
        className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden"
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">顧客の新規登録</h2>
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="姓" required>
              <input
                type="text"
                required
                value={form.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="名前" required>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="フリガナ">
            <input
              type="text"
              value={form.kana ?? ""}
              onChange={(e) => setField("kana", e.target.value)}
              placeholder="セイ メイ"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="性別">
              <select
                value={form.gender ?? ""}
                onChange={(e) =>
                  setField(
                    "gender",
                    e.target.value === "男性" || e.target.value === "女性" ? e.target.value : undefined
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
                onChange={(e) => setField("birthday", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="電話番号">
            <input
              type="tel"
              value={form.phone ?? ""}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="090-0000-0000"
              className={inputCls}
            />
          </Field>
          <Field label="来店日">
            <input
              type="date"
              value={form.firstVisitDate ?? ""}
              onChange={(e) => setField("firstVisitDate", e.target.value)}
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
              disabled={!canSubmit}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: theme.colors.primary }}
            >
              {submitting ? "登録中…" : "登録"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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
