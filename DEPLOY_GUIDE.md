# デプロイガイド: GitHub + Cloudflare Pages

このガイドでは、Salon Form SystemをGitHubリポジトリからCloudflare Pagesにデプロイする手順を説明します。

---

## 前提条件

- GitHubアカウント
- Cloudflareアカウント
- Lark Open Platformアカウント（Bitable API連携用）

---

## 1. GitHubリポジトリの準備

### 1.1 リポジトリを作成

1. GitHubで新しいリポジトリを作成します
2. プロジェクトのコードをプッシュします

```bash
git init
git add .
git commit -m "Initial commit: Salon Form System"
git remote add origin https://github.com/YOUR_USERNAME/salon-form-system.git
git push -u origin main
```

### 1.2 環境変数の設定

以下の環境変数が必要です（Cloudflare Pages側で設定）:

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DATABASE_URL` | MySQL/TiDB接続文字列 | `mysql://user:pass@host:port/db` |
| `JWT_SECRET` | セッション署名用シークレット | ランダムな文字列 |

---

## 2. Cloudflare Pagesの設定

### 2.1 プロジェクトの作成

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. **Pages** > **Create a project** > **Connect to Git**
3. GitHubリポジトリを選択

### 2.2 ビルド設定

| 設定項目 | 値 |
|----------|-----|
| Framework preset | None |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node.js version | `22` |

### 2.3 環境変数の設定

**Settings** > **Environment variables** で以下を設定:

- `DATABASE_URL`: データベース接続文字列
- `JWT_SECRET`: セッション署名用シークレット
- `NODE_ENV`: `production`

---

## 3. Cloudflare Workers（APIサーバー）の設定

フロントエンドはCloudflare Pagesで、バックエンドAPIはCloudflare Workersで動作させます。

### 3.1 Wrangler設定

プロジェクトルートに `wrangler.toml` を作成:

```toml
name = "salon-form-api"
main = "dist/index.js"
compatibility_date = "2024-01-01"

[vars]
NODE_ENV = "production"

[[d1_databases]]
binding = "DB"
database_name = "salon-form-db"
database_id = "YOUR_D1_DATABASE_ID"
```

### 3.2 デプロイ

```bash
npx wrangler deploy
```

---

## 4. Lark API設定

### 4.1 Larkアプリの作成

1. [Lark Open Platform](https://open.larksuite.com/) にアクセス
2. **Create App** で新しいアプリを作成
3. **App ID** と **App Secret** をメモ

### 4.2 権限の設定

以下の権限を有効化:
- `bitable:app` - Bitable アプリへのアクセス
- `bitable:record` - Bitable レコードの読み書き

### 4.3 Bitable設定

1. Lark BASEで必要なテーブルを作成（顧客データ、カルテ、月間目標、年間目標）
2. 各テーブルのURLからApp TokenとTable IDを取得

**URL例**: `https://xxx.larksuite.com/base/bascnXXXXXXXX?table=tblYYYYYYYY`
- App Token: `bascnXXXXXXXX`
- Table ID: `tblYYYYYYYY`

### 4.4 管理画面での設定

1. サロンフォームシステムにログイン
2. ダッシュボード > サロンを選択 > Lark設定タブ
3. App ID、App Secret、App Token、各テーブルIDを入力
4. 保存

---

## 5. 代理店向け設定

### 5.1 サロンの作成

1. ダッシュボードにログイン
2. 「+」ボタンでサロンを作成
3. サロン名とスラッグ（URL用）を入力

### 5.2 デザインテーマの選択

1. サロンを選択 > デザインタブ
2. 5種類のテーマから選択:
   - **カルメ**: ベージュ×ゴールドの癒し系
   - **ナチュラル**: グリーン×アースカラー
   - **エレガント**: ネイビー×ゴールドの高級感
   - **フレッシュ**: ライトブルー×ホワイトの清潔感
   - **サクラ**: ピンク×ローズの華やかさ

### 5.3 フォームURLの共有

各フォームのURLは以下の形式:
```
https://YOUR_DOMAIN/form/{slug}?type={formType}
```

フォーム種別:
- `customer` - 新規顧客情報
- `karte` - カルテデータ
- `monthly_goal` - 月間目標
- `yearly_goal` - 年間目標

---

## 6. トラブルシューティング

### Lark同期が失敗する場合

1. App IDとApp Secretが正しいか確認
2. Bitable権限が有効化されているか確認
3. テーブルIDが正しいか確認
4. Larkアプリがテーブルにアクセス権を持っているか確認

### フォームが表示されない場合

1. サロンのスラッグが正しいか確認
2. サロンがアクティブ状態か確認
3. ブラウザのコンソールでエラーを確認

---

## アーキテクチャ概要

```
[ユーザー] → [Cloudflare Pages (フロントエンド)]
                    ↓
            [API Server (バックエンド)]
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
  [データベース]          [Lark Bitable API]
  (MySQL/TiDB)           (顧客データ保存)
```
