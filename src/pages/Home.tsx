import { motion } from "framer-motion";
import { ClipboardList, Palette, Shield, Zap, ArrowRight } from "lucide-react";

const features = [
  {
    icon: ClipboardList,
    title: "Lark BASE連携フォーム",
    description: "フォーム送信データが自動的にLark Bitableに保存されます。手動入力の手間を削減し、データ管理を効率化します。",
  },
  {
    icon: Palette,
    title: "5種類のデザインテーマ",
    description: "カルメ・ナチュラル・エレガント・フレッシュ・サクラの5テーマから、サロンの雰囲気に合ったデザインを選択できます。",
  },
  {
    icon: Shield,
    title: "安全なデータ管理",
    description: "Cloudflareのグローバルネットワーク上で動作し、高速かつ安全なデータ処理を実現します。",
  },
  {
    icon: Zap,
    title: "かんたんセットアップ",
    description: "サロン名とスラッグを入力するだけで、すぐにフォームが利用可能。Lark APIの設定も管理画面から簡単に行えます。",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: "#FAF7F2" }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: "#E8DFD0" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#8B7355" }}>
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold" style={{ fontFamily: "'Noto Serif JP', serif", color: "#3D3226" }}>
              Salon Form
            </span>
          </div>
          <a
            href="/dashboard"
            className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: "#8B7355" }}
          >
            管理画面
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-bold leading-tight mb-6"
            style={{ fontFamily: "'Noto Serif JP', serif", color: "#3D3226" }}
          >
            美容サロンのための
            <br />
            <span style={{ color: "#8B7355" }}>スマートフォームシステム</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-lg mb-10 max-w-2xl mx-auto"
            style={{ color: "#8B7D6B" }}
          >
            Lark BASEと連携した顧客情報入力フォームを、美しいデザインで簡単に作成。
            代理店ごとにテーマを選んで、サロンのブランドに合わせたフォームを提供できます。
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-white font-medium transition-all hover:shadow-lg"
              style={{ background: "#8B7355" }}
            >
              はじめる
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="/form/demo"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-medium border-2 transition-all hover:shadow-md"
              style={{ borderColor: "#8B7355", color: "#8B7355" }}
            >
              デモフォームを見る
            </a>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6" style={{ background: "#FFFFFF" }}>
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl font-bold text-center mb-4"
            style={{ fontFamily: "'Noto Serif JP', serif", color: "#3D3226" }}
          >
            主な機能
          </h2>
          <p className="text-center mb-14" style={{ color: "#8B7D6B" }}>
            サロン業務に特化した入力フォームシステム
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="p-8 rounded-2xl border transition-shadow hover:shadow-lg"
                style={{ borderColor: "#E8DFD0", background: "#FAF7F2" }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: "#C4A882" }}
                >
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ color: "#3D3226" }}>
                  {f.title}
                </h3>
                <p className="leading-relaxed" style={{ color: "#8B7D6B" }}>
                  {f.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Form Types */}
      <section className="py-20 px-6" style={{ background: "#FAF7F2" }}>
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl font-bold text-center mb-14"
            style={{ fontFamily: "'Noto Serif JP', serif", color: "#3D3226" }}
          >
            対応フォーム
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "新規顧客情報", desc: "氏名・連絡先・来店経緯など", fields: 8 },
              { title: "カルテデータ", desc: "施術内容・支払情報など", fields: 12 },
              { title: "月間目標", desc: "売上目標・稼働日数など", fields: 4 },
              { title: "年間目標", desc: "年間売上・客単価など", fields: 4 },
            ].map((form, i) => (
              <motion.div
                key={form.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="p-6 rounded-2xl bg-white border text-center"
                style={{ borderColor: "#E8DFD0" }}
              >
                <h3 className="text-lg font-bold mb-2" style={{ color: "#3D3226" }}>
                  {form.title}
                </h3>
                <p className="text-sm mb-3" style={{ color: "#8B7D6B" }}>
                  {form.desc}
                </p>
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                  style={{ background: "#F5F0E8", color: "#8B7355" }}
                >
                  {form.fields} フィールド
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t" style={{ borderColor: "#E8DFD0" }}>
        <div className="max-w-6xl mx-auto text-center text-sm" style={{ color: "#8B7D6B" }}>
          Salon Form System &mdash; Powered by Cloudflare Pages + Lark Bitable API
        </div>
      </footer>
    </div>
  );
}
