/**
 * Platform Admin (OFFICE PLATA 側) 用認証
 *
 * サロンスタッフ用 (src/lib/auth.ts) と並行運用するため、
 * Cookie 名・KV キー名・テーブル (platform_sessions) を分けている。
 */
import bcrypt from "bcryptjs";

const SESSION_TTL_SECONDS = 24 * 60 * 60;
const SESSION_KV_CACHE_SECONDS = 5 * 60;

export interface PlatformAuthEnv {
  SALON_DB: D1Database;
  KV: KVNamespace;
}

export interface PlatformAdminRow {
  id: number;
  email: string;
  password_hash: string;
  display_name: string;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
}

export interface PlatformSessionRow {
  token: string;
  admin_id: number;
  user_agent: string | null;
  expires_at: string;
  created_at: string;
}

// ── トークン生成 ──
export function generatePlatformSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ── セッション ──
export async function createPlatformSession(
  env: PlatformAuthEnv,
  adminId: number,
  userAgent: string | null
): Promise<{ token: string; expiresAt: Date }> {
  const token = generatePlatformSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await env.SALON_DB.prepare(
    `INSERT INTO platform_sessions (token, admin_id, user_agent, expires_at)
     VALUES (?, ?, ?, ?)`
  )
    .bind(token, adminId, userAgent, expiresAt.toISOString())
    .run();

  await env.KV.put(
    platformSessionKvKey(token),
    JSON.stringify({
      token,
      admin_id: adminId,
      user_agent: userAgent,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    } satisfies PlatformSessionRow),
    { expirationTtl: SESSION_TTL_SECONDS }
  );

  return { token, expiresAt };
}

export async function getPlatformSession(
  env: PlatformAuthEnv,
  token: string
): Promise<PlatformSessionRow | null> {
  if (!token) return null;

  const cached = await env.KV.get(platformSessionKvKey(token));
  if (cached) {
    const sess = JSON.parse(cached) as PlatformSessionRow;
    if (new Date(sess.expires_at).getTime() > Date.now()) return sess;
    await env.KV.delete(platformSessionKvKey(token));
    return null;
  }

  const sess = await env.SALON_DB.prepare(
    `SELECT token, admin_id, user_agent, expires_at, created_at
       FROM platform_sessions WHERE token = ?`
  )
    .bind(token)
    .first<PlatformSessionRow>();
  if (!sess) return null;
  if (new Date(sess.expires_at).getTime() <= Date.now()) {
    await deletePlatformSession(env, token);
    return null;
  }

  await env.KV.put(platformSessionKvKey(token), JSON.stringify(sess), {
    expirationTtl: SESSION_KV_CACHE_SECONDS,
  });
  return sess;
}

export async function deletePlatformSession(env: PlatformAuthEnv, token: string): Promise<void> {
  await env.SALON_DB.prepare("DELETE FROM platform_sessions WHERE token = ?")
    .bind(token)
    .run();
  await env.KV.delete(platformSessionKvKey(token));
}

function platformSessionKvKey(token: string): string {
  return `platform_session:${token}`;
}

// ── パスワード検証 ──
export async function verifyPlatformPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── Cookie ──
export const PLATFORM_SESSION_COOKIE_NAME = "platform_session";

export function buildPlatformSessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${PLATFORM_SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function buildPlatformClearCookie(secure: boolean): string {
  const parts = [
    `${PLATFORM_SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readPlatformSessionTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(/;\s*/)) {
    const [name, ...rest] = part.split("=");
    if (name === PLATFORM_SESSION_COOKIE_NAME) return rest.join("=");
  }
  return null;
}
