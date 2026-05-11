/**
 * 加盟店スタッフ向けホーム画面 (/dashboard)
 *
 * ログイン直後に表示する。テーマカラーで彩られたカード型のリンクで
 * 主要機能 (顧客台帳 / カルテ / 目標 / スタッフ) への導線をシンプルに提供する。
 */
import { Link } from "wouter";
import {
  ArrowUpRight,
  ClipboardList,
  Target,
  Users,
} from "lucide-react";
import { useAuthSession } from "@/lib/auth-context";
import AppShell from "@/components/AppShell";

export default function Dashboard() {
  const { session, theme } = useAuthSession();
  const isOwner = session.user.role === "owner";

  const tiles: Array<{
    href: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    show?: boolean;
  }> = [
    {
      href: "/customers",
      label: "顧客台帳",
      description: "顧客情報の新規登録・編集・検索",
      icon: <Users className="w-6 h-6" />,
    },
    {
      href: "/karte",
      label: "カルテ",
      description: "来店履歴・施術コメント・写真の記録",
      icon: <ClipboardList className="w-6 h-6" />,
    },
    {
      href: "/goals",
      label: "目標 / 売上分析",
      description: "年間/月間目標と達成率の確認",
      icon: <Target className="w-6 h-6" />,
    },
    {
      href: "/staff",
      label: "スタッフ管理",
      description: "スタッフの追加・編集 (オーナーのみ)",
      icon: <Users className="w-6 h-6" />,
      show: isOwner,
    },
  ];

  return (
    <AppShell subtitle="ホーム" activeNav="dashboard">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: theme.fonts.heading, color: theme.colors.text }}
          >
            ようこそ、{session.user.displayName} さん
          </h1>
          <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>
            {session.tenant.salonName} の管理画面です。下のメニューから機能を選んでください。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles
            .filter((t) => t.show !== false)
            .map((t) => (
              <Link key={t.href} href={t.href}>
                <Tile theme={theme} icon={t.icon} label={t.label} description={t.description} />
              </Link>
            ))}
        </div>
      </div>
    </AppShell>
  );
}

function Tile({
  theme,
  icon,
  label,
  description,
}: {
  theme: ReturnType<typeof useAuthSession>["theme"];
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div
      className="block bg-white p-5 hover:shadow-md transition cursor-pointer group"
      style={{
        borderRadius: theme.borderRadius,
        border: `1px solid ${theme.colors.border}`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{ background: theme.colors.primary }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h3
              className="text-base font-bold"
              style={{ color: theme.colors.text }}
            >
              {label}
            </h3>
            <ArrowUpRight
              className="w-4 h-4 opacity-0 group-hover:opacity-100 transition"
              style={{ color: theme.colors.primary }}
            />
          </div>
          <p
            className="text-xs mt-1 leading-relaxed"
            style={{ color: theme.colors.textMuted }}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
