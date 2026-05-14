/**
 * 目標ダッシュボード (/goals)
 *
 * 当年度の年間目標、今月の月間目標、当月の売上・分析（達成率）を一画面で俯瞰し、
 * 過去12ヶ月の月別実績テーブルへも導線をつける。
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import AppShell from "@/components/AppShell";
import type { MonthlyGoal, SalesAnalytics, YearlyGoal } from "../../shared/types";

export default function Goals() {
  const [yearly, setYearly] = useState<YearlyGoal[]>([]);
  const [monthly, setMonthly] = useState<MonthlyGoal[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.goals.yearly.list(), api.goals.monthly.list(), api.analytics.list()])
      .then(([y, m, a]) => {
        setYearly(y.items);
        setMonthly(m.items);
        setAnalytics(a.items);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "取得失敗"))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 年度文字列から数字4桁を抽出 ("2026年" / "2026年度" / "2026" すべて → "2026")
  const extractYear = (s: string): string => {
    const m = s.match(/(\d{4})/);
    return m ? m[1] : s;
  };

  // 表示する年度の手動選択 (4桁数字。null なら自動)
  const [selectedYear4, setSelectedYear4] = useState<string | null>(null);

  // 年度4桁で重複排除した一覧 (新しい順)
  //   同じ "2026年" レコードが複数あっても 1 つにまとめる。
  //   それぞれの代表レコードを sample として保持。
  const uniqueYears = useMemo(() => {
    const map = new Map<string, YearlyGoal>();
    for (const y of yearly) {
      const k = extractYear(y.fiscalYear);
      if (!map.has(k)) map.set(k, y);
    }
    return Array.from(map.entries())
      .map(([year4, sample]) => ({ year4, sample }))
      .sort((a, b) => (a.year4 < b.year4 ? 1 : a.year4 > b.year4 ? -1 : 0));
  }, [yearly]);

  // 現年度がデータにあればそれを優先、なければ最新 (sort desc 済) の先頭
  const autoYear4 = useMemo(() => {
    if (uniqueYears.find((u) => u.year4 === currentYear)) return currentYear;
    return uniqueYears[0]?.year4 ?? null;
  }, [uniqueYears, currentYear]);

  const effectiveYear4 = selectedYear4 ?? autoYear4;
  const hasCurrentYearData = !!uniqueYears.find((u) => u.year4 === currentYear);

  const currentYearly = useMemo(
    () =>
      effectiveYear4
        ? yearly.find((y) => extractYear(y.fiscalYear) === effectiveYear4) ?? null
        : null,
    [yearly, effectiveYear4]
  );

  // 当月の月間目標
  const currentMonthly = useMemo(
    () => monthly.find((m) => m.yearMonth === currentYearMonth) || null,
    [monthly, currentYearMonth]
  );

  // 当月の売上分析
  const currentAnalytics = useMemo(
    () => analytics.find((a) => a.yearMonth === currentYearMonth) || null,
    [analytics, currentYearMonth]
  );

  // 過去12ヶ月の月別実績
  const last12 = useMemo(() => {
    return [...analytics]
      .filter((a) => a.yearMonth)
      .sort((x, y) => (x.yearMonth < y.yearMonth ? 1 : -1))
      .slice(0, 12)
      .reverse(); // 古い順
  }, [analytics]);

  // 最大値 (棒グラフ正規化用)
  const maxRevenue = useMemo(
    () => Math.max(1, ...last12.map((a) => a.totalRevenue ?? 0)),
    [last12]
  );

  return (
    <AppShell subtitle="目標" activeNav="goals">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> ダッシュボード
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-xl font-semibold text-slate-800 inline-flex items-center gap-2">
              <Target className="w-5 h-5" />
              目標
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/goals/yearly"
              className="px-4 py-2 rounded-lg text-sm text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 inline-flex items-center gap-2"
            >
              年間目標一覧
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/goals/monthly"
              className="px-4 py-2 rounded-lg text-sm text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 inline-flex items-center gap-2"
            >
              月間目標一覧
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {!loading && !error && uniqueYears.length > 0 && (
          <FiscalYearSelector
            options={uniqueYears.map((u) => ({
              year4: u.year4,
              label: u.sample.fiscalYear,
            }))}
            value={effectiveYear4}
            currentYear={currentYear}
            hasCurrentYearData={hasCurrentYearData}
            onChange={setSelectedYear4}
          />
        )}

        {loading ? (
          <CenteredCard>読み込み中…</CenteredCard>
        ) : error ? (
          <CenteredCard>
            <span className="text-red-600">{error}</span>
          </CenteredCard>
        ) : (
          <>
            <YearlySummary yearly={currentYearly} fallbackYear={currentYear} />
            <CurrentMonthSection
              yearMonth={currentYearMonth}
              monthly={currentMonthly}
              analytics={currentAnalytics}
            />
            <Last12MonthsSection items={last12} maxRevenue={maxRevenue} />
          </>
        )}
      </div>
    </AppShell>
  );
}

// ── 年度セレクター + 現在年度未設定の警告 ──
//   options: 年度4桁でユニーク化したリスト (重複レコード問題対策)
//   value: 選択中の年度4桁 ("2026" など)
function FiscalYearSelector({
  options,
  value,
  currentYear,
  hasCurrentYearData,
  onChange,
}: {
  options: Array<{ year4: string; label: string }>;
  value: string | null;
  currentYear: string;
  hasCurrentYearData: boolean;
  onChange: (year4: string | null) => void;
}) {
  return (
    <section
      className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 justify-between"
      style={{ borderColor: "var(--theme-border)" }}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">表示中の年度</span>
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm bg-white"
        >
          {options.map((o) => (
            <option key={o.year4} value={o.year4}>
              {o.label}
              {o.year4 === currentYear ? "(今年)" : ""}
            </option>
          ))}
        </select>
        {value && value !== currentYear && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-slate-500 hover:text-slate-900 underline"
          >
            自動選択に戻す
          </button>
        )}
      </div>

      {!hasCurrentYearData && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          {currentYear} 年度の年間目標がまだ登録されていないため、別の年度を表示しています。
        </div>
      )}
    </section>
  );
}

// ── 当年度の年間目標サマリー ──
function YearlySummary({
  yearly,
  fallbackYear,
}: {
  yearly: YearlyGoal | null;
  fallbackYear: string;
}) {
  if (!yearly) {
    return (
      <section
        className="bg-white rounded-2xl border p-6 flex items-center justify-between"
        style={{ borderColor: "var(--theme-border)" }}
      >
        <div>
          <div className="text-xs text-slate-500 mb-1">{fallbackYear} 年度</div>
          <h2 className="text-lg font-semibold text-slate-700">年間目標が未設定です</h2>
          <p className="text-sm text-slate-500 mt-1">
            年間目標を設定すると、月間目標の目安や達成率がここに表示されます。
          </p>
        </div>
        <Link
          href="/goals/yearly"
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
          style={{ background: "var(--theme-primary)" }}
        >
          年間目標を作成
        </Link>
      </section>
    );
  }

  return (
    <section
      className="bg-white rounded-2xl border p-6"
      style={{ borderColor: "var(--theme-border)" }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs text-slate-500 mb-1">{yearly.fiscalYear} 年度</div>
          <h2 className="text-lg font-semibold text-slate-800">年間目標</h2>
        </div>
        <Link
          href={`/goals/yearly`}
          className="text-sm text-slate-600 hover:text-slate-900 underline"
        >
          編集
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="年間売上目標"
          value={fmtCurrency(yearly.revenueTarget)}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <Stat label="客単価" value={fmtCurrency(yearly.averageSpend)} />
        <Stat
          label="月間売上目標(自動)"
          value={fmtCurrency(yearly.monthlyRevenueTarget)}
          muted
        />
        <Stat
          label="年間来店数目標(自動)"
          value={yearly.yearlyVisitsTarget !== null ? `${yearly.yearlyVisitsTarget} 人` : "—"}
          muted
        />
      </div>

      {yearly.note && (
        <div className="mt-5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 whitespace-pre-wrap">
          {yearly.note}
        </div>
      )}
    </section>
  );
}

// ── 当月の月間目標 + 実績 ──
function CurrentMonthSection({
  yearMonth,
  monthly,
  analytics,
}: {
  yearMonth: string;
  monthly: MonthlyGoal | null;
  analytics: SalesAnalytics | null;
}) {
  return (
    <section
      className="bg-white rounded-2xl border p-6"
      style={{ borderColor: "var(--theme-border)" }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs text-slate-500 mb-1">{yearMonth}</div>
          <h2 className="text-lg font-semibold text-slate-800 inline-flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            今月の目標と実績
          </h2>
        </div>
        <Link
          href="/goals/monthly"
          className="text-sm text-slate-600 hover:text-slate-900 underline"
        >
          月間目標を編集
        </Link>
      </div>

      {!monthly && !analytics ? (
        <p className="text-sm text-slate-500">
          今月の目標と売上実績はまだ登録されていません。月間目標を追加するか、カルテを記録すると実績が集計されます。
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat
              label="月間目標売上"
              value={fmtCurrency(monthly?.revenueTarget ?? null)}
              icon={<Target className="w-4 h-4" />}
            />
            <Stat
              label="目標稼働日数"
              value={monthly?.workingDaysTarget !== null && monthly?.workingDaysTarget !== undefined
                ? `${monthly.workingDaysTarget} 日`
                : "—"}
            />
            <Stat label="売上(日)" value={fmtCurrency(monthly?.revenuePerDay ?? null)} muted />
            <Stat
              label="客数(日)"
              value={monthly?.visitsPerDay !== null && monthly?.visitsPerDay !== undefined
                ? `${monthly.visitsPerDay.toFixed(1)} 人`
                : "—"}
              muted
            />
          </div>

          {/* 達成率バー */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">達成率</span>
              <span
                className={`text-xl font-bold ${
                  achievementClass(analytics?.achievementRate ?? null)
                }`}
              >
                {analytics?.achievementRate !== null && analytics?.achievementRate !== undefined
                  ? `${(analytics.achievementRate * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <ProgressBar value={analytics?.achievementRate ?? 0} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
              <KeyVal label="総売上" value={fmtCurrency(analytics?.totalRevenue ?? null)} />
              <KeyVal label="施術売上" value={fmtCurrency(analytics?.treatmentRevenue ?? null)} />
              <KeyVal label="物販売上" value={fmtCurrency(analytics?.productRevenue ?? null)} />
              <KeyVal label="客単価" value={fmtCurrency(analytics?.averageSpend ?? null)} />
            </div>
          </div>

          {/* 来店者の内訳 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat
              label="総来店数"
              value={analytics?.totalVisits !== null && analytics?.totalVisits !== undefined
                ? `${analytics.totalVisits} 人`
                : "—"}
              icon={<Users className="w-4 h-4" />}
            />
            <Stat
              label="新規"
              value={
                analytics?.newVisits !== null && analytics?.newVisits !== undefined
                  ? `${analytics.newVisits} 人${
                      analytics.newRate !== null
                        ? ` (${(analytics.newRate * 100).toFixed(0)}%)`
                        : ""
                    }`
                  : "—"
              }
            />
            <Stat
              label="既存"
              value={
                analytics?.existingVisits !== null && analytics?.existingVisits !== undefined
                  ? `${analytics.existingVisits} 人${
                      analytics.existingRate !== null
                        ? ` (${(analytics.existingRate * 100).toFixed(0)}%)`
                        : ""
                    }`
                  : "—"
              }
            />
          </div>
        </div>
      )}
    </section>
  );
}

// ── 過去12ヶ月の実績 ──
function Last12MonthsSection({
  items,
  maxRevenue,
}: {
  items: SalesAnalytics[];
  maxRevenue: number;
}) {
  return (
    <section
      className="bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--theme-border)" }}
    >
      <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700 inline-flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          過去12ヶ月の月別実績
        </span>
        <Link
          href="/goals/monthly"
          className="text-xs text-slate-500 hover:text-slate-800 underline"
        >
          月間目標を編集
        </Link>
      </header>
      {items.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">まだ実績データがありません</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">年月</th>
                <th className="px-4 py-2 text-right">総売上</th>
                <th className="px-4 py-2 text-left">割合</th>
                <th className="px-4 py-2 text-right">来店</th>
                <th className="px-4 py-2 text-right">新規率</th>
                <th className="px-4 py-2 text-right">客単価</th>
                <th className="px-4 py-2 text-right">達成率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((a) => (
                <tr key={a.recordId} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-700 whitespace-nowrap">{a.yearMonth}</td>
                  <td className="px-4 py-2 text-right text-slate-800 whitespace-nowrap">
                    {fmtCurrency(a.totalRevenue)}
                  </td>
                  <td className="px-4 py-2 w-40">
                    <div className="h-2 bg-slate-100 rounded">
                      <div
                        className="h-2 rounded bg-amber-400"
                        style={{
                          width: `${
                            ((a.totalRevenue ?? 0) / maxRevenue) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-slate-600">
                    {a.totalVisits !== null ? `${a.totalVisits}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-600">
                    {a.newRate !== null ? `${(a.newRate * 100).toFixed(0)}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-600">
                    {fmtCurrency(a.averageSpend)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-medium ${achievementClass(a.achievementRate)}`}
                  >
                    {a.achievementRate !== null ? `${(a.achievementRate * 100).toFixed(0)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── 小さなユーティリティ ──
function Stat({
  label,
  value,
  muted,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
      <div className="text-xs text-slate-500 mb-1 inline-flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-bold ${muted ? "text-slate-500" : "text-slate-800"}`}>
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

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1.5, value)) * 100;
  return (
    <div className="h-3 w-full bg-slate-200 rounded overflow-hidden">
      <div
        className={`h-3 rounded ${
          value >= 1 ? "bg-emerald-500" : value >= 0.8 ? "bg-amber-400" : "bg-slate-400"
        }`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

function achievementClass(v: number | null): string {
  if (v === null) return "text-slate-400";
  if (v >= 1) return "text-emerald-600";
  if (v >= 0.8) return "text-amber-600";
  return "text-slate-600";
}

function fmtCurrency(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `¥${Math.round(v).toLocaleString()}`;
}

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

