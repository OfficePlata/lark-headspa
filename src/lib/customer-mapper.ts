/**
 * Lark Bitable「新規顧客データ」⇔ Customer 型の相互変換。
 *
 * 実 BASE: tblaxZtrnk0jwBjB
 *   顧客No(AutoNumber) / 姓 / 名前 / 氏名(Formula) / フリガナ /
 *   性別(SingleSelect) / 電話番号(Phone) / 生年月日(DateTime) /
 *   年齢(Formula) / 来店のきっかけ(MultiSelect) /
 *   来店日(DateTime) / 来店年月(Formula) /
 *   カルテデータ(DuplexLink)
 */
import type {
  Customer,
  CustomerInput,
  CustomerListQuery,
  Gender,
  VisitTrigger,
} from "../../shared/types";

// ── Lark のフィールド値を扱うユーティリティ ──

/** Lark の Text / AutoNumber / Formula(string) / Lookup から文字列を抽出 */
export function extractText(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) return String((item as any).text);
        return "";
      })
      .filter(Boolean)
      .join("");
  }
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    if ("value" in obj) return extractText(obj.value);
    if ("text" in obj) return String(obj.text);
  }
  return "";
}

export function extractNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }
  if (Array.isArray(val) && val.length > 0) return extractNumber(val[0]);
  if (typeof val === "object" && val !== null && "value" in val) {
    return extractNumber((val as any).value);
  }
  return null;
}

/** Lark の DateTime (ミリ秒タイムスタンプ) → "yyyy-MM-dd" */
export function timestampToDateStr(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n);
  if (isNaN(d.getTime())) return null;
  // ローカルタイムゾーン (Asia/Tokyo) で日付を取り出す
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** "yyyy-MM-dd" → ミリ秒タイムスタンプ (12:00 JST 固定で日付ズレを防ぐ) */
export function dateStrToTimestamp(s: string): number {
  // 正午で固定することでタイムゾーン換算による日付の前後ズレを回避
  const d = new Date(`${s}T12:00:00+09:00`);
  return d.getTime();
}

/** MultiSelect の値を文字列配列で取り出す */
export function extractMultiSelect(val: unknown): string[] {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) {
    return val
      .map((v) => (typeof v === "string" ? v : extractText(v)))
      .filter(Boolean);
  }
  if (typeof val === "string") return [val];
  return [];
}

/** DuplexLink フィールドから recordId 配列を取り出す */
export function extractLinkRecordIds(val: unknown): string[] {
  if (val === null || val === undefined) return [];
  // Lark の DuplexLink は { link_record_ids: ["rec..."] } または record_ids: [...]
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    const arr =
      (obj.link_record_ids as unknown) ?? (obj.record_ids as unknown) ?? (obj.records as unknown);
    if (Array.isArray(arr)) {
      return arr
        .map((v) => (typeof v === "string" ? v : extractText(v)))
        .filter(Boolean);
    }
  }
  if (Array.isArray(val)) {
    return val.map((v) => (typeof v === "string" ? v : extractText(v))).filter(Boolean);
  }
  return [];
}

// ── Lark fields ⇔ Customer ──

export function fieldsToCustomer(recordId: string, fields: Record<string, unknown>): Customer {
  const lastName = extractText(fields["姓"]);
  const firstName = extractText(fields["名前"]);
  const explicitFullName = extractText(fields["氏名"]);
  return {
    recordId,
    customerNo: extractText(fields["顧客No"]),
    lastName,
    firstName,
    fullName: explicitFullName || `${lastName} ${firstName}`.trim(),
    kana: extractText(fields["フリガナ"]),
    gender: extractText(fields["性別"]) as Customer["gender"],
    phone: extractText(fields["電話番号"]),
    birthday: timestampToDateStr(fields["生年月日"]),
    age: extractNumber(fields["年齢"]),
    visitTriggers: extractMultiSelect(fields["来店のきっかけ"]) as VisitTrigger[],
    firstVisitDate: timestampToDateStr(fields["来店日"]),
    firstVisitYearMonth: extractText(fields["来店年月"]) || null,
    karteRecordIds: extractLinkRecordIds(fields["カルテデータ"]),
  };
}

/** CustomerInput → Lark fields (読み取り専用フィールドは含めない) */
export function customerInputToFields(input: CustomerInput): Record<string, unknown> {
  const out: Record<string, unknown> = {
    姓: input.lastName,
    名前: input.firstName,
  };
  if (input.kana !== undefined) out["フリガナ"] = input.kana;
  if (input.gender) out["性別"] = input.gender;
  if (input.phone !== undefined) out["電話番号"] = input.phone;
  if (input.birthday) out["生年月日"] = dateStrToTimestamp(input.birthday);
  if (input.visitTriggers && input.visitTriggers.length > 0) {
    out["来店のきっかけ"] = input.visitTriggers;
  }
  if (input.firstVisitDate) out["来店日"] = dateStrToTimestamp(input.firstVisitDate);
  return out;
}

// ── 検索フィルタ / 並び順を Lark search の body に変換 ──

export function buildSearchBody(query: CustomerListQuery): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  // filter
  const conditions: any[] = [];
  const children: any[] = [];

  if (query.q) {
    children.push({
      conjunction: "or",
      conditions: [
        { field_name: "姓", operator: "contains", value: [query.q] },
        { field_name: "名前", operator: "contains", value: [query.q] },
        { field_name: "フリガナ", operator: "contains", value: [query.q] },
        { field_name: "電話番号", operator: "contains", value: [query.q] },
      ],
    });
  }
  if (query.gender) {
    conditions.push({ field_name: "性別", operator: "is", value: [query.gender] });
  }
  if (query.visitTrigger) {
    conditions.push({
      field_name: "来店のきっかけ",
      operator: "contains",
      value: [query.visitTrigger],
    });
  }

  if (conditions.length > 0 || children.length > 0) {
    body.filter = {
      conjunction: "and",
      ...(conditions.length > 0 ? { conditions } : {}),
      ...(children.length > 0 ? { children } : {}),
    };
  }

  // sort
  switch (query.sort) {
    case "lastName":
      body.sort = [
        { field_name: "フリガナ", desc: false },
        { field_name: "姓", desc: false },
      ];
      break;
    case "customerNo":
      body.sort = [{ field_name: "顧客No", desc: false }];
      break;
    case "recent":
    default:
      body.sort = [{ field_name: "来店日", desc: true }];
      break;
  }

  return body;
}

/** 入力バリデーション。エラーがあればメッセージを返す。 */
export function validateCustomerInput(input: Partial<CustomerInput>): string | null {
  if (!input.lastName || !input.lastName.trim()) return "姓は必須です";
  if (!input.firstName || !input.firstName.trim()) return "名前は必須です";
  if (input.gender && input.gender !== "男性" && input.gender !== "女性") {
    return "性別は男性または女性を指定してください";
  }
  if (input.birthday && !/^\d{4}-\d{2}-\d{2}$/.test(input.birthday)) {
    return "生年月日は yyyy-MM-dd 形式で指定してください";
  }
  if (input.firstVisitDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.firstVisitDate)) {
    return "来店日は yyyy-MM-dd 形式で指定してください";
  }
  return null;
}

export function _toGender(v: unknown): Gender | undefined {
  if (v === "男性" || v === "女性") return v;
  return undefined;
}
