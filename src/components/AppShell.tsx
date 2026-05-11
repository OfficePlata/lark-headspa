/**
 * 加盟店スタッフ向け共通シェル: ヘッダー + テーマ適用 + ユーザーメニュー
 *
 * テナント (salons.theme_id) のテーマで、ヘッダー背景・主要ボタン・リンク色を切り替える。
 * 全画面で同じ構造の上部ナビ (顧客台帳 / カルテ / 目標 / スタッフ) を提供。
 */
import { useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  ClipboardList,
  KeyRound,
  LogOut,
  Settings,
  Target,
  Users,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuthSession } from "@/lib/auth-context";
import type { ThemeConfig } from "../../shared/themes";

interface AppShellProps {
  /** ヘッダーロゴ下に出るページ名（例: "顧客台帳"） */
  subtitle?: string;
  /** ナビゲーションのうちアクティブにするキー */
  activeNav?: "customers" | "karte" | "goals" | "staff" | "dashboard";
  children: ReactNode;
}

export default function AppShell({ subtitle, activeNav, children }: AppShellProps) {
  const { session, theme, logout } = useAuthSession();
  const [openMenu, setOpenMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const isOwner = session.user.role === "owner";

  return (
    <div
      className="min-h-screen"
      style={
        {
          background: theme.colors.background,
          fontFamily: theme.fonts.body,
          color: theme.colors.text,
          // 子コンポーネントで `var(--theme-*)` として参照できるよう CSS 変数を流す
          "--theme-primary": theme.colors.primary,
          "--theme-primary-dark": theme.colors.primaryDark,
          "--theme-primary-light": theme.colors.primaryLight,
          "--theme-accent": theme.colors.accent,
          "--theme-background": theme.colors.background,
          "--theme-surface": theme.colors.surface,
          "--theme-surface-hover": theme.colors.surfaceHover,
          "--theme-text": theme.colors.text,
          "--theme-text-muted": theme.colors.textMuted,
          "--theme-border": theme.colors.border,
          "--theme-radius": theme.borderRadius,
          "--theme-font-heading": theme.fonts.heading,
          "--theme-font-body": theme.fonts.body,
        } as React.CSSProperties
      }
    >
      <Header
        salonName={session.tenant.salonName}
        userDisplayName={session.user.displayName}
        subtitle={subtitle}
        activeNav={activeNav}
        isOwner={isOwner}
        theme={theme}
        openMenu={openMenu}
        onToggleMenu={() => setOpenMenu((v) => !v)}
        onCloseMenu={() => setOpenMenu(false)}
        onOpenPassword={() => {
          setOpenMenu(false);
          setShowPasswordModal(true);
        }}
        onLogout={() => {
          setOpenMenu(false);
          logout();
        }}
      />

      {children}

      {showPasswordModal && (
        <ChangePasswordModal theme={theme} onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
}

// ── ヘッダー ──
function Header({
  salonName,
  userDisplayName,
  subtitle,
  activeNav,
  isOwner,
  theme,
  openMenu,
  onToggleMenu,
  onCloseMenu,
  onOpenPassword,
  onLogout,
}: {
  salonName: string;
  userDisplayName: string;
  subtitle?: string;
  activeNav?: AppShellProps["activeNav"];
  isOwner: boolean;
  theme: ThemeConfig;
  openMenu: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onOpenPassword: () => void;
  onLogout: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <header
      style={{
        background: theme.colors.primary,
        color: "#FFFFFF",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border border-white/30"
            style={{ background: theme.colors.primaryDark }}
          >
            <Settings className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span
              className="text-base font-bold truncate text-white"
              style={{ fontFamily: theme.fonts.heading }}
            >
              {salonName}
            </span>
            {subtitle && (
              <span className="text-xs text-white/75 truncate">{subtitle}</span>
            )}
          </div>
        </Link>

        <nav className="hidden sm:flex items-center gap-1 text-sm">
          <NavLink href="/customers" active={activeNav === "customers"} icon={<Users className="w-4 h-4" />}>
            顧客台帳
          </NavLink>
          <NavLink href="/karte" active={activeNav === "karte"} icon={<ClipboardList className="w-4 h-4" />}>
            カルテ
          </NavLink>
          <NavLink href="/goals" active={activeNav === "goals"} icon={<Target className="w-4 h-4" />}>
            目標
          </NavLink>
          {isOwner && (
            <NavLink href="/staff" active={activeNav === "staff"} icon={<Users className="w-4 h-4" />}>
              スタッフ
            </NavLink>
          )}
        </nav>

        <div className="relative" ref={menuRef}>
          <button
            onClick={onToggleMenu}
            className="flex items-center gap-2 px-2 py-1 rounded-full bg-white/15 hover:bg-white/25 transition"
          >
            <div
              className="w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center"
              style={{ background: theme.colors.primaryDark, color: "#FFFFFF" }}
            >
              {userDisplayName.slice(0, 1)}
            </div>
            <span className="text-xs text-white max-w-[8rem] truncate hidden sm:inline">
              {userDisplayName}
            </span>
          </button>

          {openMenu && (
            <>
              {/* クリック外で閉じる用 オーバーレイ */}
              <button
                aria-hidden
                onClick={onCloseMenu}
                className="fixed inset-0 z-10 cursor-default bg-transparent"
              />
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl bg-white shadow-xl border border-slate-200 py-1 z-20 text-sm">
                <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">
                  ログイン中: <span className="text-slate-800">{userDisplayName}</span>
                </div>
                <button
                  onClick={onOpenPassword}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700"
                >
                  <KeyRound className="w-4 h-4" />
                  パスワード変更
                </button>
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700"
                >
                  <LogOut className="w-4 h-4" />
                  ログアウト
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
        active ? "bg-white/25 text-white font-medium" : "text-white/85 hover:bg-white/15"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

// ── パスワード変更モーダル ──
function ChangePasswordModal({
  theme,
  onClose,
}: {
  theme: ThemeConfig;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!current || !next) return setErrorMsg("現在/新パスワードを入力してください");
    if (next.length < 8) return setErrorMsg("新パスワードは8文字以上");
    if (next === current) return setErrorMsg("新パスワードは現在と異なる必要があります");
    if (next !== confirm) return setErrorMsg("確認用パスワードが一致しません");

    setSubmitting(true);
    try {
      await api.me.changePassword(current, next);
      toast.success("パスワードを変更しました。他端末のセッションは無効化されています");
      onClose();
      // 念のためダッシュボードに遷移
      setLocation("/dashboard");
    } catch (e) {
      setErrorMsg(e instanceof ApiError || e instanceof Error ? e.message : "変更失敗");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden"
        style={{ borderRadius: theme.borderRadius }}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800 inline-flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            パスワード変更
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {errorMsg}
            </div>
          )}
          <Field label="現在のパスワード" required>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="新しいパスワード" required help="8文字以上">
            <input
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="新パスワード（確認）" required>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputCls}
            />
          </Field>
          <div className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded p-2">
            変更後、別端末でログイン中のセッションは無効化されます。再ログインが必要です。
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-300 hover:bg-slate-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
              style={{ background: theme.colors.primary }}
            >
              <KeyRound className="w-4 h-4" />
              {submitting ? "変更中…" : "パスワードを変更"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white";

function Field({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {help && <span className="block text-xs text-slate-400 mt-1">{help}</span>}
    </label>
  );
}
