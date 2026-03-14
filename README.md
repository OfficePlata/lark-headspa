# Lark HeadSpa - Salon Form System

美容サロン向けの顧客情報入力フォームシステムです。Lark Bitable APIと連携し、フォーム送信データを自動的にLark BASEに保存します。

## 技術構成

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19 + Tailwind CSS 4 + Vite |
| バックエンド | Hono（Cloudflare Pages Functions） |
| データベース | Cloudflare D1（SQLite） |
| ホスティング | Cloudflare Pages |
| 外部連携 | Lark Bitable API |

## ディレクトリ構成

```
lark-headspa-cf/
├── functions/              ← Cloudflare Pages Functions（API）
│   └── api/
│       └── [[route]].ts    ← Hono APIサーバー（全APIルート）
├── src/                    ← フロントエンド（React）
│   ├── pages/
│   │   ├── Home.tsx        ← ランディングページ
│   │   ├── PublicForm.tsx  ← 公開フォーム（テーマ動的切替）
│   │   └── Dashboard.tsx   ← 管理画面（サロン・テーマ・Lark設定）
│   ├── lib/
│   │   └── api.ts          ← APIクライアント
│   ├── App.tsx             ← ルーティング
│   ├── main.tsx            ← エントリーポイント
│   └── index.css           ← グローバルスタイル
├── shared/                 ← フロント・バックエンド共有
│   └── themes.ts           ← デザインテーマ定義（5種類）
├── drizzle/
│   └── migrations/
│       └── 0001_init.sql   ← D1マイグレーション
├── public/                 ← 静的ファイル
│   ├── _routes.json        ← Cloudflare Pages ルーティング設定
│   └── _redirects          ← SPA用リダイレクト
├── wrangler.toml           ← Cloudflare設定
├── vite.config.ts          ← Viteビルド設定
└── package.json
```

## セットアップ手順

### 1. 前提条件

- Node.js 18以上
- pnpm（推奨）
- Cloudflareアカウント
- Wrangler CLI（`npm install -g wrangler`）

### 2. 依存関係のインストール

```bash
pnpm install
```

### 3. Cloudflare D1データベースの作成

```bash
# D1データベースを作成
wrangler d1 create salon-db

# 出力されたdatabase_idをwrangler.tomlに貼り付け
# database_id = "<YOUR_D1_DATABASE_ID>"

# マイグレーション実行（ローカル）
pnpm db:migrate:local

# マイグレーション実行（リモート）
pnpm db:migrate:remote
```

### 4. ローカル開発

```bash
# フロントエンド開発サーバー（Vite）
pnpm dev

# 別ターミナルでバックエンド（Wrangler Pages）
pnpm pages:dev
```

フロントエンドは `http://localhost:5173`、APIは `http://localhost:8788` で起動します。
Viteのプロキシ設定により、フロントエンドから `/api/*` へのリクエストは自動的にバックエンドに転送されます。

### 5. デプロイ

#### 方法A: Wrangler CLIでデプロイ

```bash
pnpm pages:deploy
```

#### 方法B: GitHub連携（推奨）

1. Cloudflare Dashboard > Pages > 「プロジェクトを作成」
2. GitHubリポジトリ（`OfficePlata/lark-headspa`）を接続
3. ビルド設定:
   - **フレームワークプリセット**: なし
   - **ビルドコマンド**: `pnpm install && pnpm build`
   - **ビルド出力ディレクトリ**: `dist`
4. 環境変数を設定（下記参照）
5. D1データベースをバインド:
   - Settings > Functions > D1 database bindings
   - Variable name: `SALON_DB`
   - D1 database: 作成したデータベースを選択

### 6. 環境変数

Cloudflare Dashboard > Pages > Settings > Environment Variables で以下を設定:

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `LARK_APP_ID` | Lark App ID（グローバル設定用） | 任意 |
| `LARK_APP_SECRET` | Lark App Secret（グローバル設定用） | 任意 |
| `AUTH_SECRET` | セッション署名用シークレット | 任意 |

> Lark APIの認証情報はサロンごとに管理画面から個別に設定することもできます。

## Lark Bitable連携の設定

### Lark Open Platformでの準備

1. [Lark Open Platform](https://open.larksuite.com/) にアクセス
2. 新しいアプリを作成
3. 以下の権限を有効化:
   - `bitable:app` - Bitable アプリへのアクセス
   - `bitable:record` - レコードの読み書き
4. App IDとApp Secretを取得

### Bitable（多次元表）の準備

1. Lark Baseで以下のテーブルを作成:
   - **顧客情報テーブル**: 日付、姓、名、フリガナ、性別、電話番号、生年月日、来店経緯
   - **カルテテーブル**: カルテID、顧客No、氏名、顧客区分、来店年月、来店日、施術コース、施術コメント、施術支払額、物販支払額、総支払額、支払方法
   - **月間目標テーブル**: 年月、目標売上、目標稼働日数、客単価
   - **年間目標テーブル**: 年度、年間売上目標、客単価、自由記入欄
2. Bitable URLからApp Tokenを取得（URLの `app_token` パラメータ）
3. 各テーブルのTable IDを取得

### 管理画面での設定

1. `/dashboard` にアクセス
2. サロンを作成
3. 「Lark設定」タブで認証情報とテーブルIDを入力
4. フォームから送信テスト

## デザインテーマ

5種類のデザインテーマから選択できます:

| テーマ | 説明 | メインカラー |
|--------|------|-------------|
| カルメ | 落ち着いたベージュ×ゴールドの癒し系 | #8B7355 |
| ナチュラル | 自然派・オーガニック系のグリーン | #5B7B5B |
| エレガント | ネイビー×ゴールドの高級感 | #2C3E6B |
| フレッシュ | ライトブルー×ホワイトの清潔感 | #4A90B8 |
| サクラ | ピンク×ローズの華やかさ | #C07088 |

管理画面の「テーマ」タブからワンクリックで切り替え可能です。

## APIエンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/health` | ヘルスチェック |
| GET | `/api/themes` | テーマ一覧取得 |
| GET | `/api/themes/:id` | テーマ詳細取得 |
| GET | `/api/salons` | サロン一覧取得 |
| POST | `/api/salons` | サロン作成 |
| GET | `/api/salons/:id` | サロン詳細取得 |
| PUT | `/api/salons/:id` | サロン更新 |
| GET | `/api/form/:slug` | 公開フォーム設定取得 |
| POST | `/api/form/:slug/submit` | フォーム送信 |
| GET | `/api/salons/:id/submissions` | 送信履歴取得 |
| GET | `/api/form-types` | フォームタイプ一覧 |

## ライセンス

MIT
