/**
 * Platform Admin 用 AuthGuard + Context (Phase B-1)
 *
 * サロンスタッフ用 (auth-context.tsx) と独立。
 * Cookie 名 (platform_session) と API パス (/platform/auth/*) が別なので、
 * 両者が同じブラウザで並行ログインしていても干渉しない。
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { api } from "./api";
import type { PlatformSessionInfo } from "../../shared/types";

interface PlatformAuthContextValue {
  session: PlatformSessionInfo;
  logout: () => Promise<void>;
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | null>(null);

export function usePlatformAuthSession(): PlatformAuthContextValue {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error("usePlatformAuthSession must be used within <PlatformAuthGuard>");
  return ctx;
}

export function PlatformAuthGuard({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<PlatformSessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.platform
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
          setLocation("/platform/login");
        }
      });
    return () => {
      mounted = false;
    };
  }, [setLocation]);

  async function logout() {
    try {
      await api.platform.logout();
    } catch {}
    setLocation("/platform/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        読み込み中…
      </div>
    );
  }
  if (!session) return null;
  return (
    <PlatformAuthContext.Provider value={{ session, logout }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}
