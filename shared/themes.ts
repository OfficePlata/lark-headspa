/**
 * Design themes for salon form pages
 * Each theme defines colors, fonts, and visual style
 */
export interface ThemeConfig {
  id: string;
  name: string;
  nameJa: string;
  description: string;
  colors: {
    primary: string;
    primaryLight: string;
    primaryDark: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    surfaceHover: string;
    text: string;
    textMuted: string;
    border: string;
    inputBg: string;
    inputBorder: string;
    inputFocus: string;
    success: string;
    error: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  borderRadius: string;
  shadow: string;
}

export const THEMES: Record<string, ThemeConfig> = {
  calmer: {
    id: "calmer",
    name: "Calmer",
    nameJa: "カルメ",
    description: "落ち着いたベージュ×ゴールドの癒し系デザイン",
    colors: {
      primary: "#8B7355",
      primaryLight: "#C4A882",
      primaryDark: "#6B5740",
      secondary: "#D4C5A9",
      accent: "#B8956A",
      background: "#FAF7F2",
      surface: "#FFFFFF",
      surfaceHover: "#F5F0E8",
      text: "#3D3226",
      textMuted: "#8B7D6B",
      border: "#E8DFD0",
      inputBg: "#FFFFFF",
      inputBorder: "#D4C5A9",
      inputFocus: "#B8956A",
      success: "#6B8E6B",
      error: "#C75050",
    },
    fonts: {
      heading: "'Noto Serif JP', serif",
      body: "'Noto Sans JP', sans-serif",
    },
    borderRadius: "12px",
    shadow: "0 4px 24px rgba(139, 115, 85, 0.08)",
  },
  natural: {
    id: "natural",
    name: "Natural",
    nameJa: "ナチュラル",
    description: "自然派・オーガニック系のグリーン×アースカラー",
    colors: {
      primary: "#5B7B5B",
      primaryLight: "#8BAF8B",
      primaryDark: "#3D5C3D",
      secondary: "#A8C5A8",
      accent: "#7BA07B",
      background: "#F5F8F2",
      surface: "#FFFFFF",
      surfaceHover: "#EDF3E8",
      text: "#2D3B2D",
      textMuted: "#6B7D6B",
      border: "#D0E0C8",
      inputBg: "#FFFFFF",
      inputBorder: "#B8D0A8",
      inputFocus: "#5B7B5B",
      success: "#5B8B5B",
      error: "#C75050",
    },
    fonts: {
      heading: "'Noto Serif JP', serif",
      body: "'Noto Sans JP', sans-serif",
    },
    borderRadius: "10px",
    shadow: "0 4px 24px rgba(91, 123, 91, 0.08)",
  },
  elegant: {
    id: "elegant",
    name: "Elegant",
    nameJa: "エレガント",
    description: "ネイビー×ゴールドの高級感あるプレミアムデザイン",
    colors: {
      primary: "#2C3E6B",
      primaryLight: "#4A6FA5",
      primaryDark: "#1A2A4A",
      secondary: "#C5A55A",
      accent: "#D4B86A",
      background: "#F5F6FA",
      surface: "#FFFFFF",
      surfaceHover: "#ECEEF5",
      text: "#1A1A2E",
      textMuted: "#6B6B8B",
      border: "#D0D4E0",
      inputBg: "#FFFFFF",
      inputBorder: "#C0C5D5",
      inputFocus: "#2C3E6B",
      success: "#4A8B6B",
      error: "#C75050",
    },
    fonts: {
      heading: "'Noto Serif JP', serif",
      body: "'Noto Sans JP', sans-serif",
    },
    borderRadius: "8px",
    shadow: "0 4px 24px rgba(44, 62, 107, 0.08)",
  },
  fresh: {
    id: "fresh",
    name: "Fresh",
    nameJa: "フレッシュ",
    description: "ライトブルー×ホワイトの清潔感あふれるデザイン",
    colors: {
      primary: "#4A90B8",
      primaryLight: "#7BB8D8",
      primaryDark: "#2E6E94",
      secondary: "#A8D4E8",
      accent: "#5BAAC8",
      background: "#F2F8FC",
      surface: "#FFFFFF",
      surfaceHover: "#E8F2F8",
      text: "#1A2E3D",
      textMuted: "#6B8B9B",
      border: "#C8DDE8",
      inputBg: "#FFFFFF",
      inputBorder: "#B0CCD8",
      inputFocus: "#4A90B8",
      success: "#4A8B6B",
      error: "#C75050",
    },
    fonts: {
      heading: "'Noto Sans JP', sans-serif",
      body: "'Noto Sans JP', sans-serif",
    },
    borderRadius: "14px",
    shadow: "0 4px 24px rgba(74, 144, 184, 0.08)",
  },
  sakura: {
    id: "sakura",
    name: "Sakura",
    nameJa: "サクラ",
    description: "ピンク×ローズの華やかで女性的なデザイン",
    colors: {
      primary: "#C07088",
      primaryLight: "#E0A0B0",
      primaryDark: "#9B5068",
      secondary: "#F0D0D8",
      accent: "#D08898",
      background: "#FDF5F7",
      surface: "#FFFFFF",
      surfaceHover: "#F8EBF0",
      text: "#3D2030",
      textMuted: "#8B6B7B",
      border: "#E8D0D8",
      inputBg: "#FFFFFF",
      inputBorder: "#E0C0C8",
      inputFocus: "#C07088",
      success: "#6B8B6B",
      error: "#C75050",
    },
    fonts: {
      heading: "'Noto Serif JP', serif",
      body: "'Noto Sans JP', sans-serif",
    },
    borderRadius: "16px",
    shadow: "0 4px 24px rgba(192, 112, 136, 0.08)",
  },
};

export const THEME_LIST = Object.values(THEMES);

export function getTheme(themeId: string): ThemeConfig {
  return THEMES[themeId] || THEMES.calmer;
}

/**
 * Default form field configurations for each form type
 * fieldName: フォーム内部で使用するフィールド名
 * larkFieldName: Lark Bitableのフィールド名（異なる場合のみ指定）
 * larkFieldType: Lark側のフィールドタイプ（マッピング用）
 * skipLarkSync: trueの場合、Lark同期時にスキップ（AutoNumber, Formula等）
 */
export const DEFAULT_FORM_CONFIGS = {
  customer: {
    title: "新規顧客情報入力フォーム",
    fields: [
      { fieldName: "来店日", fieldLabel: "来店日", fieldType: "date", placeholder: "年/月/日", isRequired: true, larkFieldName: "来店日", larkFieldType: "DateTime" },
      { fieldName: "姓", fieldLabel: "姓", fieldType: "text", placeholder: "内容を入力", isRequired: true, larkFieldName: "姓", larkFieldType: "Text" },
      { fieldName: "名前", fieldLabel: "名前", fieldType: "text", placeholder: "内容を入力", isRequired: true, larkFieldName: "名前", larkFieldType: "Text" },
      { fieldName: "フリガナ", fieldLabel: "フリガナ", fieldType: "text", placeholder: "※姓・名は空白を（例）ヤマダ タロウ", isRequired: true, larkFieldName: "フリガナ", larkFieldType: "Text" },
      { fieldName: "性別", fieldLabel: "性別", fieldType: "select", options: ["男性", "女性", "その他"], placeholder: "オプションを選択", isRequired: true, larkFieldName: "性別", larkFieldType: "SingleSelect" },
      { fieldName: "電話番号", fieldLabel: "電話番号（ハイフンなし）", fieldType: "text", placeholder: "09012345678", isRequired: true, larkFieldName: "電話番号", larkFieldType: "Phone" },
      { fieldName: "生年月日", fieldLabel: "生年月日（例：1990年1月1日）", fieldType: "date", placeholder: "年/月/日", isRequired: true, larkFieldName: "生年月日", larkFieldType: "DateTime" },
      { fieldName: "来店のきっかけ", fieldLabel: "どのようにして、当店をお知りになりましたか？", fieldType: "multiselect", options: ["紹介", "instagram", "TikTok", "ホットペッパー"], placeholder: "該当するものを選択", isRequired: true, larkFieldName: "来店のきっかけ", larkFieldType: "MultiSelect" },
    ],
  },
  monthly_goal: {
    title: "月間目標入力フォーム",
    fields: [
      { fieldName: "年月", fieldLabel: "年月", fieldType: "text", placeholder: "2026年01月", isRequired: true, larkFieldName: "年月", larkFieldType: "Text" },
      { fieldName: "月間目標売上", fieldLabel: "月間目標売上（単位：円）", fieldType: "number", placeholder: "100000", isRequired: true, larkFieldName: "月間目標売上", larkFieldType: "Currency" },
      { fieldName: "目標稼働日数", fieldLabel: "目標稼働日数（単位：日）", fieldType: "number", placeholder: "20", isRequired: true, larkFieldName: "目標稼働日数", larkFieldType: "Number" },
      { fieldName: "客単価", fieldLabel: "客単価（単位：円）", fieldType: "number", placeholder: "6000", isRequired: true, larkFieldName: "客単価", larkFieldType: "Number" },
    ],
  },
  yearly_goal: {
    title: "年間目標入力フォーム",
    fields: [
      { fieldName: "年度", fieldLabel: "年度", fieldType: "text", placeholder: "2026年", isRequired: true, larkFieldName: "年度", larkFieldType: "Text" },
      { fieldName: "売上", fieldLabel: "年間売上目標（単位：円）", fieldType: "number", placeholder: "2000000", isRequired: true, larkFieldName: "売上", larkFieldType: "Currency" },
      { fieldName: "客単価", fieldLabel: "客単価（単位：円）", fieldType: "number", placeholder: "6000", isRequired: true, larkFieldName: "客単価", larkFieldType: "Number" },
      { fieldName: "自由記入欄", fieldLabel: "自由記入欄", fieldType: "textarea", placeholder: "年間計画、理想のサロン、目標など", isRequired: false, larkFieldName: "自由記入欄", larkFieldType: "Text" },
    ],
  },
  karte: {
    title: "カルテデータ入力フォーム",
    fields: [
      { fieldName: "顧客区分", fieldLabel: "顧客区分", fieldType: "select", options: ["新規", "既存"], placeholder: "オプションを選択", isRequired: true, larkFieldName: "顧客区分", larkFieldType: "SingleSelect" },
      { fieldName: "来店日", fieldLabel: "来店日", fieldType: "date", placeholder: "年/月/日", isRequired: true, larkFieldName: "来店日", larkFieldType: "DateTime" },
      { fieldName: "施術コース", fieldLabel: "施術コース", fieldType: "multiselect", options: ["ヘッドスパ60分", "ヘッドスパ90分", "ヘッドスパ120分", "カット", "カラー", "トリートメント"], placeholder: "該当するものを選択", isRequired: true, larkFieldName: "施術コース", larkFieldType: "MultiSelect" },
      { fieldName: "施術コメント", fieldLabel: "施術コメント", fieldType: "textarea", placeholder: "施術内容を入力", isRequired: false, larkFieldName: "施術コメント", larkFieldType: "Text" },
      { fieldName: "施術：支払金額", fieldLabel: "施術：支払金額（円）", fieldType: "number", placeholder: "5000", isRequired: true, larkFieldName: "施術：支払金額", larkFieldType: "Currency" },
      { fieldName: "物販：支払金額", fieldLabel: "物販：支払金額（円）", fieldType: "number", placeholder: "1000", isRequired: false, larkFieldName: "物販：支払金額", larkFieldType: "Currency" },
      { fieldName: "支払方法", fieldLabel: "支払方法", fieldType: "multiselect", options: ["現金", "クレジット", "電子マネー", "QRコード決済"], placeholder: "該当するものを選択", isRequired: true, larkFieldName: "支払方法", larkFieldType: "MultiSelect" },
    ],
  },
};

export type FormType = keyof typeof DEFAULT_FORM_CONFIGS;
export const FORM_TYPES = Object.keys(DEFAULT_FORM_CONFIGS) as FormType[];

/**
 * Lark Bitableに書き込み不可のフィールド（AutoNumber, Formula, Lookup, DuplexLink）
 * これらのフィールドはLark同期時にスキップする
 */
export const LARK_READONLY_FIELDS: Record<string, string[]> = {
  customer: ["顧客No", "氏名", "年齢", "来店年月", "カルテデータ"],
  karte: ["カルテID", "顧客No", "氏名", "性別", "来店年月", "総支払額"],
  monthly_goal: ["月間売上目標目安", "売上（日）", "客数（日）"],
  yearly_goal: ["月間売上目標", "年間来店数目標（人）"],
};
