import { describe, expect, it } from "vitest";
import { THEMES, THEME_LIST, getTheme, DEFAULT_FORM_CONFIGS, FORM_TYPES } from "../shared/themes";
import { mapFormDataToLarkFields } from "./lark";

describe("themes", () => {
  it("should have 5 themes defined", () => {
    expect(THEME_LIST.length).toBe(5);
    expect(Object.keys(THEMES)).toEqual(["calmer", "natural", "elegant", "fresh", "sakura"]);
  });

  it("each theme should have required color properties", () => {
    for (const theme of THEME_LIST) {
      expect(theme.id).toBeTruthy();
      expect(theme.name).toBeTruthy();
      expect(theme.nameJa).toBeTruthy();
      expect(theme.description).toBeTruthy();
      expect(theme.colors.primary).toBeTruthy();
      expect(theme.colors.primaryLight).toBeTruthy();
      expect(theme.colors.primaryDark).toBeTruthy();
      expect(theme.colors.background).toBeTruthy();
      expect(theme.colors.surface).toBeTruthy();
      expect(theme.colors.text).toBeTruthy();
      expect(theme.colors.inputBg).toBeTruthy();
      expect(theme.colors.inputBorder).toBeTruthy();
      expect(theme.colors.inputFocus).toBeTruthy();
      expect(theme.fonts.heading).toBeTruthy();
      expect(theme.fonts.body).toBeTruthy();
      expect(theme.borderRadius).toBeTruthy();
      expect(theme.shadow).toBeTruthy();
    }
  });

  it("getTheme should return correct theme", () => {
    const calmer = getTheme("calmer");
    expect(calmer.id).toBe("calmer");
    expect(calmer.nameJa).toBe("カルメ");

    const sakura = getTheme("sakura");
    expect(sakura.id).toBe("sakura");
    expect(sakura.nameJa).toBe("サクラ");
  });

  it("getTheme should fallback to calmer for unknown theme", () => {
    const unknown = getTheme("nonexistent");
    expect(unknown.id).toBe("calmer");
  });
});

describe("DEFAULT_FORM_CONFIGS", () => {
  it("should have 4 form types", () => {
    expect(FORM_TYPES).toEqual(["customer", "monthly_goal", "yearly_goal", "karte"]);
  });

  it("customer form should have correct fields", () => {
    const config = DEFAULT_FORM_CONFIGS.customer;
    expect(config.title).toBe("新規顧客情報入力フォーム");
    expect(config.fields.length).toBeGreaterThan(0);

    const fieldNames = config.fields.map((f) => f.fieldName);
    expect(fieldNames).toContain("日付");
    expect(fieldNames).toContain("姓");
    expect(fieldNames).toContain("名");
    expect(fieldNames).toContain("フリガナ");
    expect(fieldNames).toContain("性別");
    expect(fieldNames).toContain("電話番号");
    expect(fieldNames).toContain("生年月日");
    expect(fieldNames).toContain("来店経緯");
  });

  it("karte form should have correct fields", () => {
    const config = DEFAULT_FORM_CONFIGS.karte;
    expect(config.title).toContain("顧客管理情報");
    expect(config.fields.length).toBeGreaterThan(0);

    const fieldNames = config.fields.map((f) => f.fieldName);
    expect(fieldNames).toContain("カルテID");
    expect(fieldNames).toContain("氏名");
    expect(fieldNames).toContain("施術コース");
    expect(fieldNames).toContain("支払方法");
  });

  it("monthly_goal form should have correct fields", () => {
    const config = DEFAULT_FORM_CONFIGS.monthly_goal;
    expect(config.title).toBe("月間目標入力フォーム");
    const fieldNames = config.fields.map((f) => f.fieldName);
    expect(fieldNames).toContain("年月");
    expect(fieldNames).toContain("目標売上");
    expect(fieldNames).toContain("客単価");
  });

  it("yearly_goal form should have correct fields", () => {
    const config = DEFAULT_FORM_CONFIGS.yearly_goal;
    expect(config.title).toBe("年間目標入力フォーム");
    const fieldNames = config.fields.map((f) => f.fieldName);
    expect(fieldNames).toContain("年度");
    expect(fieldNames).toContain("年間売上目標");
    expect(fieldNames).toContain("自由記入欄");
  });

  it("all fields should have required properties", () => {
    for (const formType of FORM_TYPES) {
      const config = DEFAULT_FORM_CONFIGS[formType];
      for (const field of config.fields) {
        expect(field.fieldName).toBeTruthy();
        expect(field.fieldLabel).toBeTruthy();
        expect(field.fieldType).toBeTruthy();
        expect(typeof field.isRequired).toBe("boolean");
      }
    }
  });
});

describe("mapFormDataToLarkFields", () => {
  it("should pass through simple text values", () => {
    const result = mapFormDataToLarkFields({ "名前": "田中太郎" });
    expect(result).toEqual({ "名前": "田中太郎" });
  });

  it("should convert date strings to timestamps", () => {
    const result = mapFormDataToLarkFields({ "日付": "2026-01-15" });
    const expected = new Date("2026-01-15").getTime();
    expect(result["日付"]).toBe(expected);
  });

  it("should convert year-month strings to timestamps", () => {
    const result = mapFormDataToLarkFields({ "年月": "2026-01" });
    const expected = new Date("2026-01-01").getTime();
    expect(result["年月"]).toBe(expected);
  });

  it("should convert numeric strings to numbers", () => {
    const result = mapFormDataToLarkFields({ "金額": "5000" });
    expect(result["金額"]).toBe(5000);
  });

  it("should skip empty values", () => {
    const result = mapFormDataToLarkFields({
      "名前": "田中",
      "空": "",
      "null値": null,
      "undefined値": undefined,
    });
    expect(result).toEqual({ "名前": "田中" });
  });

  it("should use field mappings when provided", () => {
    const result = mapFormDataToLarkFields(
      { "名前": "田中太郎" },
      { "名前": "Name" }
    );
    expect(result).toEqual({ "Name": "田中太郎" });
  });

  it("should handle mixed data types", () => {
    const result = mapFormDataToLarkFields({
      "氏名": "長 智子",
      "来店日": "2026-01-08",
      "施術支払額": "5000",
      "施術コメント": "qqq",
    });
    expect(result["氏名"]).toBe("長 智子");
    expect(typeof result["来店日"]).toBe("number");
    expect(result["施術支払額"]).toBe(5000);
    expect(result["施術コメント"]).toBe("qqq");
  });
});
