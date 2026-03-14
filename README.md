# Salon Form System

Lark Bitable API と連携した美容サロン向け顧客情報入力フォームシステムです。フォームから送信されたデータは自動的に Lark BASE に保存されます。代理店が独自のデザインテーマを選択してフォームをカスタマイズできる機能も備えています。

---

## 概要

このシステムは、美容サロンの顧客管理業務を効率化するために設計されました。Lark の標準フォーム UI ではなく、サロンのブランドイメージに合わせた美しい外部フォームを提供し、送信データを Lark Bitable に自動同期します。

| 機能 | 説明 |
|------|------|
| Lark BASE 連携 | フォーム送信データを Lark Bitable API 経由で自動保存 |
| 4 種類のフォーム | 新規顧客情報、カルテデータ、月間目標、年間目標 |
| 5 種類のデザインテーマ | カルメ、ナチュラル、エレガント、フレッシュ、サクラ |
| 代理店向け管理画面 | サロンごとにテーマ選択・Lark API 設定・送信履歴確認 |
| オーナー通知 | フォーム送信時に管理者へ自動通知 |

---

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| フロントエンド | React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| バックエンド | Express 4, tRPC 11, Drizzle ORM |
| データベース | MySQL / TiDB |
| 外部 API | Lark Bitable API (Open Platform) |
| ビルドツール | Vite 7, esbuild, pnpm |
| テスト | Vitest |

---

## ディレクトリ構成

```
lark-form-project/
├── client/                  # フロントエンド（React）
│   ├── src/
│   │   ├── pages/           # ページコンポーネント
│   │   ├── components/      # 再利用可能なUIコンポーネント
│   │   ├── contexts/        # React コンテキスト（テーマ管理等）
│   │   ├── lib/             # tRPC クライアント
│   │   ├── App.tsx          # ルーティング定義
│   │   └── index.css        # グローバルスタイル
│   └── index.html           # HTML テンプレート
├── server/                  # バックエンド（Express + tRPC）
│   ├── _core/               # フレームワーク基盤（認証、OAuth等）
│   ├── routers.ts           # tRPC ルーター定義
│   ├── db.ts                # データベースクエリヘルパー
│   ├── lark.ts              # Lark Bitable API 連携ヘルパー
│   └── storage.ts           # S3 ストレージヘルパー
├── drizzle/                 # データベーススキーマ・マイグレーション
│   ├── schema.ts            # テーブル定義
│   └── *.sql                # マイグレーション SQL
├── shared/                  # フロント・バック共有コード
│   ├── themes.ts            # デザインテーマ定義
│   └── const.ts             # 共有定数
├── DEPLOY_GUIDE.md          # デプロイ手順書
└── package.json
```

---

## セットアップ

### 前提条件

- Node.js 22 以上
- pnpm 10 以上
- MySQL または TiDB データベース
- Lark Open Platform アカウント

### インストール

```bash
# 依存関係のインストール
pnpm install

# 開発サーバーの起動
pnpm dev
```

### 環境変数

以下の環境変数を `.env` ファイルに設定してください。

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `DATABASE_URL` | MySQL/TiDB 接続文字列 | 必須 |
| `JWT_SECRET` | セッション署名用シークレット | 必須 |
| `NODE_ENV` | 実行環境（development / production） | 任意 |

Lark API の認証情報（App ID、App Secret、Bitable App Token、各テーブル ID）は、管理画面のサロン設定から入力します。

---

## 使い方

### 1. サロンの作成

管理画面（`/dashboard`）にログインし、「+」ボタンからサロンを作成します。サロン名と URL 用のスラッグを入力してください。

### 2. Lark API の設定

作成したサロンを選択し、「Lark 設定」タブから以下を入力します。

| 設定項目 | 取得元 |
|----------|--------|
| App ID | Lark Open Platform > アプリ管理 |
| App Secret | Lark Open Platform > アプリ管理 |
| Bitable App Token | BASE の URL: `https://xxx.larksuite.com/base/{appToken}` |
| 各テーブル ID | BASE の URL: `?table={tableId}` |

### 3. デザインテーマの選択

「デザイン」タブから 5 種類のテーマを選択できます。

| テーマ名 | 特徴 | カラー |
|----------|------|--------|
| カルメ | 落ち着いた癒し系 | ベージュ × ゴールド |
| ナチュラル | 自然派・オーガニック | グリーン × アースカラー |
| エレガント | 高級感・プレミアム | ネイビー × ゴールド |
| フレッシュ | 清潔感・爽やか | ライトブルー × ホワイト |
| サクラ | 華やか・女性的 | ピンク × ローズ |

### 4. フォーム URL の共有

「フォーム URL」タブから各フォームの URL をコピーし、お客様やスタッフに共有してください。

```
https://YOUR_DOMAIN/form/{slug}?type=customer       # 新規顧客情報
https://YOUR_DOMAIN/form/{slug}?type=karte           # カルテデータ
https://YOUR_DOMAIN/form/{slug}?type=monthly_goal    # 月間目標
https://YOUR_DOMAIN/form/{slug}?type=yearly_goal     # 年間目標
```

---

## 対応フォーム

### 新規顧客情報入力フォーム

日付、姓、名、フリガナ、性別、電話番号、生年月日、来店経緯の 8 項目を入力します。Lark BASE の「新規顧客データ」テーブルに対応しています。

### カルテデータ入力フォーム

カルテ ID、顧客 No、氏名、顧客区分、来店年月、来店日、施術コース、施術コメント、施術支払額、物販支払額、総支払額、支払方法の 12 項目を入力します。Lark BASE の「カルテデータ」テーブルに対応しています。

### 月間目標入力フォーム

年月、目標売上、目標稼働日数、客単価の 4 項目を入力します。Lark BASE の「月間目標シート」テーブルに対応しています。

### 年間目標入力フォーム

年度、年間売上目標、客単価、自由記入欄の 4 項目を入力します。Lark BASE の「年間目標シート」テーブルに対応しています。

---

## API エンドポイント

tRPC を使用しており、すべての API は `/api/trpc` 配下で提供されます。

| プロシージャ | 種別 | 認証 | 説明 |
|-------------|------|------|------|
| `themes.list` | Query | 不要 | テーマ一覧取得 |
| `themes.get` | Query | 不要 | テーマ詳細取得 |
| `salon.list` | Query | 必要 | ユーザーのサロン一覧 |
| `salon.create` | Mutation | 必要 | サロン作成 |
| `salon.get` | Query | 必要 | サロン詳細取得 |
| `salon.update` | Mutation | 必要 | サロン設定更新 |
| `salon.submissions` | Query | 必要 | 送信履歴取得 |
| `form.getBySlug` | Query | 不要 | 公開フォーム情報取得 |
| `form.submit` | Mutation | 不要 | フォームデータ送信 |

---

## テスト

```bash
pnpm test
```

テーマ定義、フォーム設定、Lark フィールドマッピングのユニットテストが含まれています。

---

## デプロイ

GitHub + Cloudflare Pages/Workers でのデプロイ手順は [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md) を参照してください。

---

## ライセンス

MIT
