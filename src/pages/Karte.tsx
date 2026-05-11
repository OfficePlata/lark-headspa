/**
 * カルテ 一覧ページ (/karte)
 *
 * - 実 BASE「カルテデータ」(tbl4Crds3zemyxUp) を一覧表示
 * - 顧客名キーワード / 期間 (来店日) / 顧客区分 / 施術コース で絞り込み
 * - 行クリックで詳細 /karte/:recordId へ
 * - 「新規カルテ」ボタン → /karte/new
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Image as ImageIcon,
  LogOut,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthSession } from "@/lib/auth-context";
import { CUSTOMER_KIND, TREATMENT_COURSES } from "../../shared/types";
import type { CustomerKind, Karte, TreatmentCourse } from "../../shared/types";

export default function KartePage() {
  const { session, logout } = useAuthSession();
  const [, setLocation] = useLocation();

  // 検索条件
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [customerKind, setCustomerKind] = useState<"" | CustomerKind>("");
  const [treatmentCourse, setTreatmentCourse] = useState<"" | TreatmentCourse>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // 一覧
  const [items, setItems] = useState<Karte[]>([]);
  const [pageToken, setPageToken] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (reset = true) => {
      const isFirst = reset;
      isFirst ? setLoading(true) : setLoadingMore(true);
      try {
        const res = await api.karte.list({
          customerName: appliedKeyword || undefined,
          customerKind: customerKind || undefined,
          treatmentCourse: treatmentCourse || undefined,
          visitDateFrom: from || undefined,
          visitDateTo: to || undefined,
          pageToken: isFirst ? undefined : pageToken,
          pageSize: 50,
        });
        setItems((prev) => (isFirst ? res.items : [...prev, ...res.items]));
        setHasMore(res.hasMore);
        setPageToken(res.pageToken);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "カルテの取得に失敗しました");
      } finally {
        isFirst ? setLoading(false) : setLoadingMore(false);
      }
    },
    [appliedKeyword, customerKind, treatmentCourse, from, to, pageToken]
  );

  useEffect(() => {
    fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedKeyword, customerKind, treatmentCourse, from, to]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedKeyword(keyword.trim());
  }

  function resetFilters() {
    setKeyword("");
    setAppliedKeyword("");
    setCustomerKind("");
    setTreatmentCourse("");
    setFrom("");
    setTo("");
  }

  return (
    <div className="min-h-screen" style={{ background: "#FAF7F2" }}>
      <Header
        salonName={session.tenant.salonName}
        userDisplayName={session.user.displayName}
        onLogout={() => logout()}
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> ダッシュボード
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-xl font-semibold text-slate-800 inline-flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              カルテ
            </h1>
          </div>
          <Link
            href="/karte/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
            style={{ background: "#8B7355" }}
          >
            <Plus className="w-4 h-4" />
            新規カルテ
          </Link>
        </div>

        {/* 検索バー */}
        <div
          className="bg-white rounded-2xl p-4 mb-4 border"
          style={{ borderColor: "#E8DFD0" }}
        >
          <form onSubmit={applySearch} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs text-slate-500 mb-1">顧客名キーワード</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="search"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="例: 田中 / タナカ"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">来店日 開始</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">来店日 終了</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">顧客区分</label>
              <select
                value={customerKind}
                onChange={(e) => setCustomerKind(e.target.value as typeof customerKind)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">すべて</option>
                {CUSTOMER_KIND.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">施術コース</label>
              <select
                value={treatmentCourse}
                onChange={(e) => setTreatmentCourse(e.target.value as typeof treatmentCourse)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">すべて</option>
                {TREATMENT_COURSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
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
            該当するカルテは見つかりませんでした。
            <Link
              href="/karte/new"
              className="block mx-auto mt-3 px-4 py-1.5 rounded-lg text-white text-sm w-fit"
              style={{ background: "#8B7355" }}
            >
              新規カルテを追加
            </Link>
          </CenteredMessage>
        ) : (
          <KarteTable
            items={items}
            onRowClick={(k) => setLocation(`/karte/${k.recordId}`)}
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
    </div>
  );
}

function KarteTable({
  items,
  onRowClick,
}: {
  items: Karte[];
  onRowClick: (k: Karte) => void;
}) {
  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: "#E8DFD0" }}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">カルテID</th>
              <th className="px-4 py-3 text-left">来店日</th>
              <th className="px-4 py-3 text-left">顧客名</th>
              <th className="px-4 py-3 text-left">区分</th>
              <th className="px-4 py-3 text-left">施術コース</th>
              <th className="px-4 py-3 text-right">総支払額</th>
              <th className="px-4 py-3 text-left">写真</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((k) => (
              <tr
                key={k.recordId}
                onClick={() => onRowClick(k)}
                className="hover:bg-slate-50 cursor-pointer"
              >
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{k.karteId || "—"}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {k.visitDate || "—"}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                  {k.customerName || "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <KindBadge kind={k.customerKind} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {k.treatmentCourses.length === 0
                      ? "—"
                      : k.treatmentCourses.map((c) => (
                          <span
                            key={c}
                            className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700"
                          >
                            {c}
                          </span>
                        ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">
                  {k.totalAmount !== null
                    ? `¥${k.totalAmount.toLocaleString()}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {k.photos.length === 0 ? (
                    <span className="text-slate-300">—</span>
                  ) : (
                    <div className="inline-flex items-center gap-1 text-slate-500 text-xs">
                      <ImageIcon className="w-3.5 h-3.5" />
                      {k.photos.length}
                    </div>
                  )}
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

function KindBadge({ kind }: { kind: Karte["customerKind"] }) {
  if (kind === "新規") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700">
        新規
      </span>
    );
  }
  if (kind === "既存") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
        既存
      </span>
    );
  }
  return <span className="text-slate-400">—</span>;
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-center py-16 text-slate-500 bg-white rounded-2xl border"
      style={{ borderColor: "#E8DFD0" }}
    >
      {children}
    </div>
  );
}

function Header({
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
            <ClipboardList className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span
              className="text-base font-bold truncate"
              style={{ fontFamily: "'Noto Serif JP', serif", color: "#3D3226" }}
            >
              {salonName}
            </span>
            <span className="text-xs text-slate-500 truncate">カルテ</span>
          </div>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/customers"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
          >
            <Users className="w-4 h-4" />
            顧客台帳
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">ログアウト</span>
          </button>
        </div>
      </div>
    </header>
  );
}
