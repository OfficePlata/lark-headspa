/**
 * 認証ユーティリティ (Cloudflare Pages Functions 用)
 *
 * - パスワードハッシュ: bcryptjs cost=10
 * - セッショントークン: 32バイト乱数 hex
 * - セッション: D1 を正、KV を読みキャッシュ（5分）
 * - 失敗カウント: KV (10分/最大5回)
 *
 * 注: Cloudflare Workers 上では bcryptjs (Pure JS実装) を nodejs_compat フラグ下で動作させる。
 */

import bcrypt from "bcryptjs";

const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24時間
const SESSION_KV_CACHE_SECONDS = 5 * 60; // 5分
const LOGIN_LOCK_WINDOW_SECONDS = 10 * 60;
const LOGIN_LOCK_THRESHOLD = 5;

export interface AuthEnv {
  SALON_DB: D1Database;
  KV: KVNamespace;
}

export interface SessionRow {
  token: string;
  user_id: number;
  salon_id: number;
  user_agent: string | null;
  expires_at: string;
  created_at: string;
}

export interface UserRow {
  id: number;
  salon_id: number;
  email: string;
  password_hash: string;
  display_name: string;
  role: "owner" | "staff";
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── パスワード ──
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── セッショントークン ──
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ── セッション CRUD ──
export async function createSession(
  env: AuthEnv,
  userId: number,
  salonId: number,
  userAgent: string | null
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await env.SALON_DB.prepare(
    `INSERT INTO sessions (token, user_id, salon_id, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(token, userId, salonId, userAgent, expiresAt.toISOString())
    .run();

  // KV キャッシュにも入れておく（24時間TTL）
  await env.KV.put(
    sessionKvKey(token),
    JSON.stringify({
      token,
      user_id: userId,
      salon_id: salonId,
      user_agent: userAgent,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    } satisfies SessionRow),
    { expirationTtl: SESSION_TTL_SECONDS }
  );

  return { token, expiresAt };
}

export async function getSession(env: AuthEnv, token: string): Promise<SessionRow | null> {
  if (!token) return null;

  // KV 優先
  const cached = await env.KV.get(sessionKvKey(token));
  if (cached) {
    const sess = JSON.parse(cached) as SessionRow;
    if (new Date(sess.expires_at).getTime() > Date.now()) return sess;
    // 期限切れ
    await env.KV.delete(sessionKvKey(token));
    return null;
  }

  // D1 フォールバック
  const sess = await env.SALON_DB.prepare(
    `SELECT token, user_id, salon_id, user_agent, expires_at, created_at
       FROM sessions WHERE token = ?`
  )
    .bind(token)
    .first<SessionRow>();
  if (!sess) return null;
  if (new Date(sess.expires_at).getTime() <= Date.now()) {
    await deleteSession(env, token);
    return null;
  }

  // 5分キャッシュ
  await env.KV.put(sessionKvKey(token), JSON.stringify(sess), {
    expirationTtl: SESSION_KV_CACHE_SECONDS,
  });
  return sess;
}

export async function deleteSession(env: AuthEnv, token: string): Promise<void> {
  await env.SALON_DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  await env.KV.delete(sessionKvKey(token));
}

function sessionKvKey(token: string): string {
  return `session:${token}`;
}

// ── ログイン失敗カウント ──
export async function recordLoginFailure(
  env: AuthEnv,
  email: string,
  salonId: number | null,
  ip: string | null,
  userAgent: string | null
): Promise<number> {
  const key = loginFailKvKey(email);
  const current = await env.KV.get(key);
  const count = (current ? Number(current) : 0) + 1;
  await env.KV.put(key, String(count), { expirationTtl: LOGIN_LOCK_WINDOW_SECONDS });

  await env.SALON_DB.prepare(
    `INSERT INTO login_failures (salon_id, email, ip, user_agent) VALUES (?, ?, ?, ?)`
  )
    .bind(salonId, email, ip, userAgent)
    .run();

  return count;
}

export async function isLockedOut(env: AuthEnv, email: string): Promise<boolean> {
  const v = await env.KV.get(loginFailKvKey(email));
  return v !== null && Number(v) >= LOGIN_LOCK_THRESHOLD;
}

export async function clearLoginFailures(env: AuthEnv, email: string): Promise<void> {
  await env.KV.delete(loginFailKvKey(email));
}

function loginFailKvKey(email: string): string {
  return `login_fail:${email.toLowerCase()}`;
}

// ── Cookie ヘルパー ──
export const SESSION_COOKIE_NAME = "salon_session";

export function buildSessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearCookie(secure: boolean): string {
  const parts = [`${SESSION_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readSessionTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(/;\s*/)) {
    const [name, ...rest] = part.split("=");
    if (name === SESSION_COOKIE_NAME) return rest.join("=");
  }
  return null;
}
