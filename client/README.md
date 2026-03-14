# Client

フロントエンド UI の実装です。React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui で構築されており、公開フォーム画面と代理店向け管理画面の 2 つの主要画面を提供します。

---

## ファイル構成

```
client/
├── src/
│   ├── pages/
│   │   ├── Home.tsx           # ランディングページ
│   │   ├── PublicForm.tsx     # 公開フォーム画面（テーマ対応）
│   │   ├── Dashboard.tsx      # 代理店向け管理画面
│   │   └── NotFound.tsx       # 404 ページ
│   ├── components/
│   │   ├── ThemeSelector.tsx   # デザインテーマ選択コンポーネント
│   │   ├── SalonSettings.tsx   # サロン設定（Lark API 設定）
│   │   ├── SubmissionList.tsx  # 送信履歴一覧
│   │   └── ui/                # shadcn/ui コンポーネント群
│   ├── contexts/
│   │   ├── SalonThemeContext.tsx  # 動的テーマ管理コンテキスト
│   │   └── ThemeContext.tsx       # アプリ全体のテーマ管理
│   ├── lib/
│   │   └── trpc.ts            # tRPC クライアント設定
│   ├── App.tsx                # ルーティング定義
│   ├── index.css              # グローバルスタイル・CSS 変数
│   └── main.tsx               # エントリーポイント
└── index.html                 # HTML テンプレート（Google Fonts 読み込み）
```

---

## 主要ページ

### Home.tsx（ランディングページ）

サイトのトップページです。サロンフォームシステムの概要、特徴、利用可能なテーマのプレビューを表示します。管理画面へのリンクとフォームのデモリンクを提供します。

### PublicForm.tsx（公開フォーム画面）

お客様やスタッフが実際にデータを入力するフォーム画面です。URL のスラッグとクエリパラメータ（`type`）に基づいて、該当サロンのテーマとフォーム設定を動的に読み込みます。

ルート: `/form/:slug?type=customer|karte|monthly_goal|yearly_goal`

テーマに応じてカラー、フォント、角丸、影などが動的に切り替わります。フォーム送信後は完了画面を表示し、Lark Bitable への同期結果も内部で処理されます。

### Dashboard.tsx（代理店向け管理画面）

認証が必要な管理画面です。以下の 4 つのタブで構成されています。

| タブ | 機能 |
|------|------|
| フォーム URL | 各フォームの URL コピー・プレビュー |
| デザイン | 5 種類のテーマからの選択 |
| Lark 設定 | Lark API 認証情報の入力 |
| 送信履歴 | フォーム送信データの確認 |

---

## コンポーネント

### ThemeSelector

5 種類のデザインテーマをカード形式でプレビュー表示し、選択できるコンポーネントです。各テーマのミニフォームプレビュー、カラースウォッチ、説明文を表示します。

### SalonSettings

サロンの基本情報と Lark API 認証情報を入力・保存するフォームコンポーネントです。App ID、App Secret、Bitable App Token、各テーブル ID の入力フィールドを提供します。

### SubmissionList

フォーム送信履歴をテーブル形式で表示するコンポーネントです。フォーム種別でのフィルタリング、Lark 同期ステータスの表示、送信データの詳細確認が可能です。

---

## テーマシステム

### SalonThemeContext

公開フォーム画面で使用する動的テーマ管理コンテキストです。テーマ設定に基づいて CSS カスタムプロパティ（`--salon-*`）をドキュメントルートに適用します。これにより、同一コンポーネントで異なるテーマのフォームを表示できます。

### デザイントークン

各テーマは以下のデザイントークンを定義しています。

| トークン | 用途 |
|----------|------|
| `colors.primary` | メインカラー（ボタン、アクセント） |
| `colors.background` | ページ背景色 |
| `colors.surface` | カード・フォーム背景色 |
| `colors.text` | 本文テキスト色 |
| `colors.inputBorder` | 入力フィールド枠線色 |
| `fonts.heading` | 見出しフォント |
| `fonts.body` | 本文フォント |
| `borderRadius` | 角丸サイズ |
| `shadow` | ボックスシャドウ |

---

## ルーティング

| パス | コンポーネント | 認証 |
|------|---------------|------|
| `/` | Home | 不要 |
| `/form/:slug` | PublicForm | 不要 |
| `/dashboard` | Dashboard | 必要 |
| `*` | NotFound | 不要 |
