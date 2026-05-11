/**
 * Lark Bitable「カルテデータ」⇔ Karte 型の相互変換。
 *
 * 実 BASE: tbl4Crds3zemyxUp
 *   カルテID(AutoNumber, RO) / 顧客No(DuplexLink) / 氏名(Lookup, RO) / 性別(Lookup, RO) /
 *   顧客区分(SingleSelect) / 来店年月(Formula, RO) / 来店日(DateTime) /
 *   施術コース(MultiSelect) / 施術コメント(Text) /
 *   施術：支払金額(Currency) / 物販：支払金額(Currency) /
 *   総支払額(Formula, RO) / 支払方法(MultiSelect) / 写真(Attachment)
 *
 * RO = 読み取り専用、書き込みフィールドからは除外する。
 */
import type {
  Karte,
  KarteInput,
  KarteListQuery,
  KartePhoto,
  CustomerKind,
  TreatmentCourse,
  PaymentMethod,
} from "../../shared/types";
import {
  extractText,
  extractNumber,
  extractMultiSelect,
  extractLinkRecordIds,
  timestampToDateStr,
  dateStrToTimestamp,
} from "./customer-mapper";

// ── 写真フィールドの抽出 ──
export function extractPhotos(val: unknown): KartePhoto[] {
  if (val === null || val === undefined) return [];
  const arr = Array.isArray(val) ? val : [val];
  return arr
    .map((item): KartePhoto | null => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const token = (obj.file_token as string) || (obj.fileToken as string) || "";
      if (!token) return null;
      return {
        fileToken: token,
        name: (obj.name as string) || (obj.file_name as string) || "photo",
        size: typeof obj.size === "number" ? obj.size : undefined,
        type: (obj.type as string) || (obj.mime_type as string) || undefined,
      };
    })
    .filter((x): x is KartePhoto => x !== null);
}

// ── Lark fields ⇔ Karte ──

export function fieldsToKarte(recordId: string, fields: Record<string, unknown>): Karte {
  const customerIds = extractLinkRecordIds(fields["顧客No"]);
  return {
    recordId,
    karteId: extractText(fields["カルテID"]),
    customerRecordId: customerIds[0] ?? null,
    customerName: extractText(fields["氏名"]),
    customerGender: extractText(fields["性別"]),
    customerKind: (extractText(fields["顧客区分"]) as CustomerKind) || "",
    visitYearMonth: extractText(fields["来店年月"]),
    visitDate: timestampToDateStr(fields["来店日"]),
    treatmentCourses: extractMultiSelect(fields["施術コース"]) as TreatmentCourse[],
    treatmentComment: extractText(fields["施術コメント"]),
    treatmentAmount: extractNumber(fields["施術：支払金額"]),
    productAmount: extractNumber(fields["物販：支払金額"]),
    totalAmount: extractNumber(fields["総支払額"]),
    paymentMethods: extractMultiSelect(fields["支払方法"]) as PaymentMethod[],
    photos: extractPhotos(fields["写真"]),
  };
}

/** KarteInput → Lark fields */
export function karteInputToFields(input: KarteInput): Record<string, unknown> {
  const out: Record<string, unknown> = {
    顧客No: [input.customerRecordId],
  };
  if (input.customerKind) out["顧客区分"] = input.customerKind;
  if (input.visitDate) out["来店日"] = dateStrToTimestamp(input.visitDate);
  if (input.treatmentCourses && input.treatmentCourses.length > 0) {
    out["施術コース"] = input.treatmentCourses;
  }
  if (input.treatmentComment !== undefined) out["施術コメント"] = input.treatmentComment;
  if (input.treatmentAmount !== undefined && input.treatmentAmount !== null) {
    out["施術：支払金額"] = input.treatmentAmount;
  }
  if (input.productAmount !== undefined && input.productAmount !== null) {
    out["物販：支払金額"] = input.productAmount;
  }
  if (input.paymentMethods && input.paymentMethods.length > 0) {
    out["支払方法"] = input.paymentMethods;
  }
  if (input.photoFileTokens && input.photoFileTokens.length > 0) {
    out["写真"] = input.photoFileTokens.map((token) => ({ file_token: token }));
  }
  return out;
}

// ── 検索フィルタ ──

export function buildKarteSearchBody(query: KarteListQuery): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const conditions: any[] = [];

  if (query.customerRecordId) {
    // DuplexLink を recordId で絞り込む。Lark の DuplexLink は "is" で record_id を渡せる
    conditions.push({
      field_name: "顧客No",
      operator: "contains",
      value: [query.customerRecordId],
    });
  }
  if (query.customerName) {
    // 氏名 (Lookup) への部分一致
    conditions.push({
      field_name: "氏名",
      operator: "contains",
      value: [query.customerName],
    });
  }
  if (query.customerKind) {
    conditions.push({
      field_name: "顧客区分",
      operator: "is",
      value: [query.customerKind],
    });
  }
  if (query.treatmentCourse) {
    conditions.push({
      field_name: "施術コース",
      operator: "contains",
      value: [query.treatmentCourse],
    });
  }
  if (query.visitDateFrom) {
    conditions.push({
      field_name: "来店日",
      operator: "isGreaterEqual",
      value: ["ExactDate", String(dateStrToTimestamp(query.visitDateFrom))],
    });
  }
  if (query.visitDateTo) {
    conditions.push({
      field_name: "来店日",
      operator: "isLessEqual",
      value: ["ExactDate", String(dateStrToTimestamp(query.visitDateTo))],
    });
  }

  if (conditions.length > 0) {
    body.filter = { conjunction: "and", conditions };
  }

  // デフォルトは来店日の新しい順
  body.sort = [{ field_name: "来店日", desc: true }];
  return body;
}

// ── バリデーション ──

export function validateKarteInput(input: Partial<KarteInput>): string | null {
  if (!input.customerRecordId) return "顧客を選択してください";
  if (input.visitDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.visitDate)) {
    return "来店日は yyyy-MM-dd 形式で指定してください";
  }
  if (
    input.treatmentAmount !== undefined &&
    input.treatmentAmount !== null &&
    !Number.isFinite(input.treatmentAmount)
  ) {
    return "施術金額は数値で指定してください";
  }
  if (
    input.productAmount !== undefined &&
    input.productAmount !== null &&
    !Number.isFinite(input.productAmount)
  ) {
    return "物販金額は数値で指定してください";
  }
  return null;
}
