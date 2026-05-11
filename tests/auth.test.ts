/**
 * 認証ユーティリティの単体テスト
 *
 * Cloudflare Workers ランタイム依存（D1/KV）は対象外。
 * 純粋関数のみテストする:
 *   - hashPassword / verifyPassword の往復
 *   - generateSessionToken の一意性とフォーマット
 *   - Cookie ヘルパーの組立 / 読み取り
 */
import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  buildSessionCookie,
  buildClearCookie,
  readSessionTokenFromCookie,
  SESSION_COOKIE_NAME,
} from "../src/lib/auth";

describe("hashPassword / verifyPassword", () => {
  it("正しいパスワードで検証が通る", async () => {
    const hash = await hashPassword("S3cret!password");
    expect(await verifyPassword("S3cret!password", hash)).toBe(true);
  });

  it("違うパスワードは弾かれる", async () => {
    const hash = await hashPassword("S3cret!password");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("ハッシュは毎回異なる (salt 付き)", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });
});

describe("generateSessionToken", () => {
  it("64文字 hex を返す (32バイト)", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("一意である (1000回中に重複しない)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateSessionToken());
    expect(seen.size).toBe(1000);
  });
});

describe("Cookie helpers", () => {
  it("buildSessionCookie は必須属性を含む", () => {
    const cookie = buildSessionCookie("abc123", true);
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=abc123`);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toMatch(/Max-Age=\d+/);
  });

  it("HTTPなら Secure は付かない", () => {
    const cookie = buildSessionCookie("x", false);
    expect(cookie).not.toContain("Secure");
  });

  it("buildClearCookie は Max-Age=0", () => {
    expect(buildClearCookie(true)).toContain("Max-Age=0");
  });

  it("readSessionTokenFromCookie は対象クッキーを抜き出す", () => {
    const header = `foo=bar; ${SESSION_COOKIE_NAME}=token123; baz=qux`;
    expect(readSessionTokenFromCookie(header)).toBe("token123");
  });

  it("対象クッキーが無ければ null", () => {
    expect(readSessionTokenFromCookie("a=b; c=d")).toBe(null);
    expect(readSessionTokenFromCookie(null)).toBe(null);
  });
});
