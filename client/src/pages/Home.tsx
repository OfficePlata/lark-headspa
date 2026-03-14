import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import {
  FileText,
  Palette,
  ArrowRight,
  Sparkles,
  Store,
  LayoutDashboard,
} from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span
              className="text-lg font-semibold text-foreground"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              Salon Form
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="sm" className="gap-1.5">
                  <LayoutDashboard className="h-4 w-4" />
                  管理画面
                </Button>
              </Link>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  window.location.href = getLoginUrl();
                }}
              >
                ログイン
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        {/* Decorative elements */}
        <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-10 left-10 w-48 h-48 rounded-full bg-accent/5 blur-3xl" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36 relative">
          <div className="max-w-3xl">
            <p
              className="text-sm tracking-widest uppercase text-muted-foreground mb-4"
              style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
            >
              Beauty Salon Form System
            </p>
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              美容サロンの
              <br />
              <span className="text-primary">顧客管理</span>を
              <br />
              もっとスマートに
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-xl">
              Lark BASEと連携した入力フォームで、顧客情報・カルテ・目標管理を
              一元化。代理店ごとにデザインをカスタマイズできます。
            </p>
            <div className="flex flex-wrap gap-4">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button size="lg" className="gap-2 px-8 h-14 text-base">
                    管理画面へ
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button
                  size="lg"
                  className="gap-2 px-8 h-14 text-base"
                  onClick={() => {
                    window.location.href = getLoginUrl();
                  }}
                >
                  無料で始める
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features section */}
      <section className="py-24 bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2
              className="text-3xl font-semibold text-foreground mb-4"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              主な機能
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              サロン運営に必要な入力フォームを、美しいデザインで提供します
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: FileText,
                title: "Lark BASE連携",
                desc: "フォーム送信データが自動的にLark BASEに保存。顧客情報、カルテ、目標データを一元管理できます。",
              },
              {
                icon: Palette,
                title: "デザインカスタマイズ",
                desc: "5種類のテーマから選択可能。サロンのブランドイメージに合わせたフォームを簡単に作成できます。",
              },
              {
                icon: Store,
                title: "代理店対応",
                desc: "複数のサロンを一つのアカウントで管理。代理店がそれぞれのサロンに最適なデザインを選択できます。",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group p-8 rounded-xl bg-background border border-border hover:shadow-lg hover:border-primary/20 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3
                  className="text-lg font-semibold text-foreground mb-3"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form types section */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2
              className="text-3xl font-semibold text-foreground mb-4"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              対応フォーム
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              サロン運営に必要な4種類のフォームをご用意しています
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "👤", title: "新規顧客情報", desc: "氏名・連絡先・来店経緯など基本情報の入力" },
              { icon: "📋", title: "カルテデータ", desc: "施術内容・支払額・コメントの記録" },
              { icon: "📊", title: "月間目標", desc: "売上目標・稼働日数・客単価の設定" },
              { icon: "🎯", title: "年間目標", desc: "年間売上・客単価・計画の策定" },
            ].map((form, i) => (
              <div
                key={i}
                className="group p-6 rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/20 transition-all duration-300 text-center"
              >
                <span className="text-3xl mb-4 block group-hover:scale-110 transition-transform">{form.icon}</span>
                <h3
                  className="font-semibold text-foreground mb-2"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  {form.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{form.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2
            className="text-2xl md:text-3xl font-semibold text-foreground mb-4"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            今すぐ始めましょう
          </h2>
          <p className="text-muted-foreground mb-8">
            アカウントを作成して、サロンのフォームを設定するだけ。
            <br />
            Lark BASEとの連携で、データ管理が劇的に変わります。
          </p>
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button size="lg" className="gap-2 px-10 h-14 text-base">
                管理画面へ
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Button
              size="lg"
              className="gap-2 px-10 h-14 text-base"
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
            >
              無料で始める
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs text-muted-foreground">
            Salon Form System &mdash; Powered by Lark Bitable API
          </p>
        </div>
      </footer>
    </div>
  );
}
