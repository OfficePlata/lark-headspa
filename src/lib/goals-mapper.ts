/**
 * Lark Bitable「年間目標シート」「月間目標シート」「売上・分析」⇔ TS 型のマッパー。
 *
 *   年間目標 (tblABnUfoY8XMaD0): 年度 / 売上 / 客単価 / [月間売上目標 RO] / [年間来店数目標(人) RO] / 自由記入欄
 *   月間目標 (tblhOI7T3lu5T7xM): 年月 / [月間売上目標目安 RO] / 月間目標売上 / 目標稼働日数 / [売上(日) RO] / 客単価 / [客数(日) RO]
 *   売上・分析 (tbl2ZzvKO8q5NEh7): 年月 / 総来店数 / 新規 / 新規率 / 既存 / 既存率 / 施術売上 / 物販売上 / 総売上 / 客単価 / 客数 / 達成率
 *
 * RO = 読み取り専用、書き込みフィールドからは除外する。
 */
import type {
  YearlyGoal,
  YearlyGoalInput,
  MonthlyGoal,
  MonthlyGoalInput,
  SalesAnalytics,
} from "../../shared/types";
import { extractNumber, extractText } from "./customer-mapper";

// ── 年間目標 ──

export function fieldsToYearlyGoal(recordId: string, fields: Record<string, unknown>): YearlyGoal {
  return {
    recordId,
    fiscalYear: extractText(fields["年度"]),
    revenueTarget: extractNumber(fields["売上"]),
    averageSpend: extractNumber(fields["客単価"]),
    monthlyRevenueTarget: extractNumber(fields["月間売上目標"]),
    yearlyVisitsTarget: extractNumber(fields["年間来店数目標(人)"] ?? fields["年間来店数目標(人)"] ?? fields["年間来店数目標"]),
    note: extractText(fields["自由記入欄"]),
  };
}

export function yearlyGoalInputToFields(input: YearlyGoalInput): Record<string, unknown> {
  const out: Record<string, unknown> = { 年度: input.fiscalYear };
  if (input.revenueTarget !== undefined && input.revenueTarget !== null) {
    out["売上"] = input.revenueTarget;
  }
  if (input.averageSpend !== undefined && input.averageSpend !== null) {
    out["客単価"] = input.averageSpend;
  }
  if (input.note !== undefined) out["自由記入欄"] = input.note;
  return out;
}

export function validateYearlyGoalInput(input: Partial<YearlyGoalInput>): string | null {
  if (!input.fiscalYear || !input.fiscalYear.trim()) return "年度は必須です";
  return null;
}

// ── 月間目標 ──

export function fieldsToMonthlyGoal(
  recordId: string,
  fields: Record<string, unknown>
): MonthlyGoal {
  return {
    recordId,
    yearMonth: yearMonthFromJa(extractText(fields["年月"])),
    benchmarkFromYearly: extractNumber(fields["月間売上目標目安"]),
    revenueTarget: extractNumber(fields["月間目標売上"]),
    workingDaysTarget: extractNumber(fields["目標稼働日数"]),
    revenuePerDay: extractNumber(fields["売上(日)"] ?? fields["売上（日）"]),
    averageSpend: extractNumber(fields["客単価"]),
    visitsPerDay: extractNumber(fields["客数(日)"] ?? fields["客数（日）"]),
  };
}

export function monthlyGoalInputToFields(input: MonthlyGoalInput): Record<string, unknown> {
  // 「YYYY-MM」入力なら売上・分析と連動できる「yyyy年MM月」形式に変換して保存
  const yearMonth = /^\d{4}-\d{2}$/.test(input.yearMonth)
    ? yearMonthToJa(input.yearMonth)
    : input.yearMonth;
  const out: Record<string, unknown> = { 年月: yearMonth };
  if (input.revenueTarget !== undefined && input.revenueTarget !== null) {
    out["月間目標売上"] = input.revenueTarget;
  }
  if (input.workingDaysTarget !== undefined && input.workingDaysTarget !== null) {
    out["目標稼働日数"] = input.workingDaysTarget;
  }
  if (input.averageSpend !== undefined && input.averageSpend !== null) {
    out["客単価"] = input.averageSpend;
  }
  return out;
}

export function validateMonthlyGoalInput(input: Partial<MonthlyGoalInput>): string | null {
  if (!input.yearMonth || !input.yearMonth.trim()) return "年月は必須です";
  return null;
}

// ── 売上・分析（読み取り専用） ──

export function fieldsToSalesAnalytics(
  recordId: string,
  fields: Record<string, unknown>
): SalesAnalytics {
  return {
    recordId,
    yearMonth: yearMonthFromJa(extractText(fields["年月"])),
    totalVisits: extractNumber(fields["総来店数"]),
    newVisits: extractNumber(fields["新規"]),
    newRate: extractNumber(fields["新規率"]),
    existingVisits: extractNumber(fields["既存"]),
    existingRate: extractNumber(fields["既存率"]),
    treatmentRevenue: extractNumber(fields["施術売上"]),
    productRevenue: extractNumber(fields["物販売上"]),
    totalRevenue: extractNumber(fields["総売上"]),
    averageSpend: extractNumber(fields["客単価"]),
    visitsPerWorkingDay: extractNumber(fields["客数"]),
    achievementRate: extractNumber(fields["達成率"]),
  };
}

/** 「YYYY年MM月」⇔「YYYY-MM」の相互変換ヘルパー（売上・分析が前者形式を使うため） */
export function yearMonthToJa(yyyymm: string): string {
  // "2026-05" → "2026年05月"
  const m = yyyymm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return yyyymm;
  return `${m[1]}年${m[2]}月`;
}
export function yearMonthFromJa(ja: string): string {
  // "2026年05月" → "2026-05"
  const m = ja.match(/^(\d{4})年(\d{1,2})月$/);
  if (!m) return ja;
  return `${m[1]}-${String(m[2]).padStart(2, "0")}`;
}
