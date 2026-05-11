/**
 * 認証コンテキスト + ガードコンポーネント (Phase 0-1)
 *
 * - <AuthGuard> で囲んだ子ツリーは、認証済みでなければ /login にリダイレクト
 * - useAuthSession() でログイン中のユーザー / テナント情報にアクセス
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { api } from "./api";
import { getTheme, type ThemeConfig } from "../../shared/themes";
import type { SessionInfo } from "../../shared/types";

interface AuthContextValue {
  session: SessionInfo;
  theme: ThemeConfig;
  logout: () => Promise<void>;
}

/** ログイン中のテナント themeId から ThemeConfig を取得 */
export function useTheme(): ThemeConfig {
  return useAuthSession().theme;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthSession(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthSession must be used within <AuthGuard>");
  return ctx;
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // React Hooks Rules: hook は早期 return の前にすべて呼ぶ
  const theme = useMemo(
    () => getTheme(session?.tenant.themeId ?? "calmer"),
    [session?.tenant.themeId]
  );

  useEffect(() => {
    let mounted = true;
    api.auth
      .session()
      .then((s) => {
        if (mounted) {
          setSession(s);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setLoading(false);
          setLocation("/login");
        }
      });
    return () => {
      mounted = false;
    };
  }, [setLocation]);

  async function logout() {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    setLocation("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        読み込み中…
      </div>
    );
  }
  if (!session) {
    // すでに /login へリダイレクト中
    return null;
  }

  return (
    <AuthContext.Provider value={{ session, theme, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
