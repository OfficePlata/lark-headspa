/**
 * フロント・バックエンドで共有する型定義。
 * 認証系は API レスポンス形状の正準ソースとして使う。
 */

// ── テナント（サロン）情報 ──
export interface TenantInfo {
  id: number;
  salonName: string;
  slug: string;
  subdomain: string;
  themeId: string;
  logoUrl: string | null;
}

// ── 認証中のユーザー ──
export interface AuthUser {
  id: number;
  salonId: number;
  email: string;
  displayName: string;
  role: "owner" | "staff";
}

export interface SessionInfo {
  user: AuthUser;
  tenant: TenantInfo;
  expiresAt: string; // ISO8601
}

// ── 共通 API レスポンス（指示書 5.1.2 節） ──
export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = {
  ok: false;
  error: { code: string; message: string; field?: string };
};
export type ApiResponse<T> = ApiOk<T> | ApiErr;

// ── エラーコード一覧（指示書 5.1.3 節相当） ──
export const ERROR_CODES = {
  // 認証系
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_LOCKED: "AUTH_LOCKED",
  AUTH_UNAUTHENTICATED: "AUTH_UNAUTHENTICATED",
  AUTH_TENANT_NOT_FOUND: "AUTH_TENANT_NOT_FOUND",
  // リクエスト系
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  // システム系
  INTERNAL_ERROR: "INTERNAL_ERROR",
  LARK_API_ERROR: "LARK_API_ERROR",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ── 顧客（新規顧客データ テーブル: tblaxZtrnk0jwBjB） ──
export type Gender = "男性" | "女性";

/** 来店のきっかけの選択肢（実 BASE の MultiSelect オプションと一致させる） */
export const VISIT_TRIGGERS = ["紹介", "instagram", "TikTok", "ホットペッパー"] as const;
export type VisitTrigger = (typeof VISIT_TRIGGERS)[number];

/** クライアント側で扱う顧客レコード（camelCase に整形済み） */
export interface Customer {
  recordId: string;
  customerNo: string;          // 顧客No (AutoNumber: C-001)
  lastName: string;            // 姓
  firstName: string;           // 名前
  fullName: string;            // 氏名 (Formula で結合)
  kana: string;                // フリガナ
  gender: Gender | "";         // 性別
  phone: string;               // 電話番号
  birthday: string | null;     // 生年月日 (yyyy-MM-dd)
  age: number | null;          // 年齢 (Formula)
  visitTriggers: VisitTrigger[]; // 来店のきっかけ
  firstVisitDate: string | null; // 来店日 (yyyy-MM-dd)
  firstVisitYearMonth: string | null; // 来店年月 (Formula)
  karteRecordIds: string[];    // カルテデータへの DuplexLink
}

/** 作成/更新時の入力（読み取り専用フィールドを除く） */
export interface CustomerInput {
  lastName: string;
  firstName: string;
  kana?: string;
  gender?: Gender;
  phone?: string;
  birthday?: string;       // yyyy-MM-dd
  visitTriggers?: VisitTrigger[];
  firstVisitDate?: string; // yyyy-MM-dd
}

/** 顧客一覧 API のクエリ */
export interface CustomerListQuery {
  q?: string;                 // 姓/名/フリガナ/電話番号への部分一致
  gender?: Gender;
  visitTrigger?: VisitTrigger;
  sort?: "recent" | "lastName" | "customerNo";
  pageToken?: string;
  pageSize?: number;
}

export interface CustomerListResult {
  items: Customer[];
  hasMore: boolean;
  pageToken?: string;
}

// ── カルテ（カルテデータ テーブル: tbl4Crds3zemyxUp） ──

export const CUSTOMER_KIND = ["新規", "既存"] as const;
export type CustomerKind = (typeof CUSTOMER_KIND)[number];

export const TREATMENT_COURSES = [
  "コースA",
  "コースB",
  "コースC",
  "ヘッドスパ60分",
  "カット",
  "ヘッドスパ90分",
  "カラー",
] as const;
export type TreatmentCourse = (typeof TREATMENT_COURSES)[number];

export const PAYMENT_METHODS = ["現金", "クレジット"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** カルテに紐付いた写真 (Lark Bitable Attachment) */
export interface KartePhoto {
  fileToken: string;
  name: string;
  size?: number;
  type?: string;
  /** クライアント表示用に組み立てる /api/karte/photo/{token} の URL */
  url?: string;
}

export interface Karte {
  recordId: string;
  karteId: string;                  // C-001 (AutoNumber)
  customerRecordId: string | null;  // 顧客No (DuplexLink) の 1 件目
  customerName: string;             // 氏名 (Lookup, 読み取り専用)
  customerGender: string;           // 性別 (Lookup, 読み取り専用)
  customerKind: CustomerKind | "";  // 顧客区分 (SingleSelect)
  visitYearMonth: string;           // 来店年月 (Formula, 読み取り専用)
  visitDate: string | null;         // 来店日 (yyyy-MM-dd)
  treatmentCourses: TreatmentCourse[]; // 施術コース (MultiSelect)
  treatmentComment: string;         // 施術コメント
  treatmentAmount: number | null;   // 施術：支払金額 (Currency)
  productAmount: number | null;     // 物販：支払金額 (Currency)
  totalAmount: number | null;       // 総支払額 (Formula, 読み取り専用)
  paymentMethods: PaymentMethod[];  // 支払方法 (MultiSelect)
  photos: KartePhoto[];             // 写真 (Attachment)
}

/** 作成/更新時の入力 (読み取り専用フィールドを除く) */
export interface KarteInput {
  customerRecordId: string;         // 必須: 顧客No (DuplexLink) を 1 件指定
  customerKind?: CustomerKind;
  visitDate?: string;               // yyyy-MM-dd
  treatmentCourses?: TreatmentCourse[];
  treatmentComment?: string;
  treatmentAmount?: number;
  productAmount?: number;
  paymentMethods?: PaymentMethod[];
  photoFileTokens?: string[];       // POST /upload-photo で取得したトークン
}

export interface KarteListQuery {
  customerRecordId?: string;        // 特定顧客のカルテだけ
  customerName?: string;            // 顧客名キーワード (Lookup 列を contains)
  customerKind?: CustomerKind;
  treatmentCourse?: TreatmentCourse;
  visitDateFrom?: string;           // yyyy-MM-dd
  visitDateTo?: string;             // yyyy-MM-dd
  pageToken?: string;
  pageSize?: number;
}

export interface KarteListResult {
  items: Karte[];
  hasMore: boolean;
  pageToken?: string;
}

// ── 年間目標シート (tblABnUfoY8XMaD0) ──
//   年度 / 売上(¥) / 客単価 / 月間売上目標(Formula RO) / 年間来店数目標(Formula RO) / 自由記入欄
export interface YearlyGoal {
  recordId: string;
  fiscalYear: string;                 // 年度 (Text)
  revenueTarget: number | null;       // 売上 (Currency 年間目標)
  averageSpend: number | null;        // 客単価 (Number)
  monthlyRevenueTarget: number | null; // 月間売上目標 (Formula, RO)
  yearlyVisitsTarget: number | null;  // 年間来店数目標(人) (Formula, RO)
  note: string;                       // 自由記入欄
}
export interface YearlyGoalInput {
  fiscalYear: string;
  revenueTarget?: number;
  averageSpend?: number;
  note?: string;
}

// ── 月間目標シート (tblhOI7T3lu5T7xM) ──
//   年月 / 月間売上目標目安(Formula RO) / 月間目標売上 / 目標稼働日数 / 売上(日)(Formula RO) /
//   客単価 / 客数(日)(Formula RO)
export interface MonthlyGoal {
  recordId: string;
  yearMonth: string;                   // 年月 (Text) "2026-05" 形式を推奨
  benchmarkFromYearly: number | null;  // 月間売上目標目安 (Formula, RO)
  revenueTarget: number | null;        // 月間目標売上 (Currency)
  workingDaysTarget: number | null;    // 目標稼働日数 (Number)
  revenuePerDay: number | null;        // 売上(日) (Formula, RO)
  averageSpend: number | null;         // 客単価 (Number)
  visitsPerDay: number | null;         // 客数(日) (Formula, RO)
}
export interface MonthlyGoalInput {
  yearMonth: string;
  revenueTarget?: number;
  workingDaysTarget?: number;
  averageSpend?: number;
}

// ── 売上・分析 (tbl2ZzvKO8q5NEh7) — Formula/Lookup 中心、読み取り専用 ──
export interface SalesAnalytics {
  recordId: string;
  yearMonth: string;                  // 年月 (Text)
  totalVisits: number | null;         // 総来店数 (Lookup)
  newVisits: number | null;           // 新規 (Lookup)
  newRate: number | null;             // 新規率 (Formula)
  existingVisits: number | null;      // 既存 (Lookup)
  existingRate: number | null;        // 既存率 (Formula)
  treatmentRevenue: number | null;    // 施術売上 (Formula)
  productRevenue: number | null;      // 物販売上 (Formula)
  totalRevenue: number | null;        // 総売上 (Formula)
  averageSpend: number | null;        // 客単価 (Formula)
  visitsPerWorkingDay: number | null; // 客数 (Formula)
  achievementRate: number | null;     // 達成率 (Formula, 0-1)
}

// ── 実 BASE の 5 テーブル ID を持つテーブルマッピング ──
// 実 BASE 構造:
//   年間目標シート (tblABnUfoY8XMaD0) → lark_yearly_goal_table_id
//   月間目標シート (tblhOI7T3lu5T7xM) → lark_monthly_goal_table_id
//   新規顧客データ (tblaxZtrnk0jwBjB) → lark_customer_table_id
//   カルテデータ   (tbl4Crds3zemyxUp) → lark_karte_table_id
//   売上・分析     (tbl2ZzvKO8q5NEh7) → lark_sales_table_id
export interface SalonLarkConfig {
  appId: string;
  appSecret: string;
  bitableAppToken: string;
  tables: {
    customer: string;
    karte: string;
    monthlyGoal: string;
    yearlyGoal: string;
    sales: string;
  };
}
