# Lark HeadSpa - Salon Form System

美容サロン向けの顧客情報入力フォームシステムです。  
Lark Bitable APIと連携し、フォーム送信データを自動的にLark BASEに保存します。

---

## ターミナル不要！Dashboard操作だけで完結するセットアップ

このシステムは **Cloudflare Dashboard + Lark管理画面のブラウザ操作だけ** で構築・デプロイできます。  
ローカルPCにNode.jsやCLIツールをインストールする必要はありません。

---

## セットアップ手順（全5ステップ）

### Step 1: GitHubにリポジトリを用意する

1. このリポジトリを **Fork** するか、コードをまるごとコピーして自分のGitHubリポジトリに置く
2. ファイル構成はそのまま（変更不要）

---

### Step 2: Cloudflare Pagesプロジェクトを作成する

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. 左メニューから **Workers & Pages** を選択
3. **「Create」** ボタンをクリック
4. **「Pages」** タブを選択し、 **「Connect to Git」** をクリック
5. GitHubアカウントを連携し、Step 1で用意したリポジトリを選択
6. ビルド設定を以下のように入力:

| 設定項目 | 値 |
|---------|-----|
| プロジェクト名 | 任意（例: `lark-headspa`） |
| プロダクションブランチ | `main` |
| フレームワークプリセット | **None** |
| ビルドコマンド | `npm install && npm run build` |
| ビルド出力ディレクトリ | `dist` |

7. **「Save and Deploy」** をクリック → 初回ビルドが開始されます

> ⚠️ この時点ではD1データベースが未接続のため、APIはエラーになります。次のステップで設定します。

---

### Step 3: D1データベースを作成してテーブルを作る

#### 3-1. D1データベースの作成

1. Cloudflare Dashboard → 左メニュー **「Workers & Pages」** → **「D1 SQL Database」**
2. **「Create」** をクリック
3. データベース名: `salon-db`（任意）
4. **「Create」** をクリック

#### 3-2. テーブルの作成（SQLをコンソールで実行）

1. 作成した `salon-db` をクリック
2. **「Console」** タブを開く
3. 以下のSQLを **そのままコピペ** して **「Execute」** をクリック:

```sql
CREATE TABLE IF NOT EXISTS salons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  theme_id TEXT NOT NULL DEFAULT 'calmer',
  logo_url TEXT,
  lark_app_id TEXT,
  lark_app_secret TEXT,
  lark_bitable_app_token TEXT,
  lark_customer_table_id TEXT,
  lark_monthly_goal_table_id TEXT,
  lark_yearly_goal_table_id TEXT,
  lark_karte_table_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_id INTEGER NOT NULL,
  form_type TEXT NOT NULL,
  form_data TEXT NOT NULL,
  lark_synced INTEGER NOT NULL DEFAULT 0,
  lark_record_id TEXT,
  sync_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (salon_id) REFERENCES salons(id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_salon ON submissions(salon_id);
CREATE INDEX IF NOT EXISTS idx_submissions_form_type ON submissions(form_type);
CREATE INDEX IF NOT EXISTS idx_salons_slug ON salons(slug);
```

「Success」と表示されればOKです。

#### 3-3. PagesプロジェクトにD1をバインド

1. Cloudflare Dashboard → **Workers & Pages** → 作成したPagesプロジェクトを選択
2. **「Settings」** → **「Functions」** → **「D1 database bindings」**
3. **「Add binding」** をクリック
4. 以下を入力:

| 設定 | 値 |
|------|-----|
| Variable name | `SALON_DB` |
| D1 database | `salon-db`（先ほど作成したもの） |

5. **「Save」** をクリック

> ⚠️ バインド設定後、**再デプロイが必要**です。  
> **「Deployments」** タブ → 最新のデプロイの **「⋯」** → **「Retry deployment」** をクリック。

---

### Step 4: Lark Open Platformでアプリを作成する

#### 4-1. Larkアプリの作成

1. [Lark Open Platform](https://open.larksuite.com/) にアクセス
2. **「Create Custom App」** をクリック
3. アプリ名を入力して作成
4. **App ID** と **App Secret** をメモしておく

#### 4-2. 権限の設定

アプリの **「Permissions & Scopes」** で以下を有効化:

- `bitable:app` — Bitable アプリへのアクセス
- `bitable:app:readonly` — Bitable アプリ読取
- `drive:drive` — ドライブへのアクセス（写真添付用）

#### 4-3. Bitable（多次元表）の準備

1. Lark BASEで以下の4つのテーブルを含むBitableを作成:

| テーブル | 主なフィールド |
|---------|-------------|
| 新規顧客データ | 顧客No（自動採番）、姓、名前、フリガナ、性別、電話番号、生年月日、来店日、来店のきっかけ |
| カルテデータ | カルテID（自動採番）、顧客No（双方向関連→顧客テーブル）、顧客区分、来店日、施術コース、施術コメント、施術：支払金額、物販：支払金額、支払方法、写真（添付ファイル） |
| 月間目標 | 年月、月間目標売上、目標稼働日数、客単価 |
| 年間目標 | 年度、売上、客単価、自由記入欄 |

2. BitableのURLから **App Token** を取得  
   → URLが `https://xxx.larksuite.com/base/TC4QbGyrLarVFcsqmNIjrzmLp4f` なら、`TC4QbGyrLarVFcsqmNIjrzmLp4f` がApp Token

3. 各テーブルのURLから **Table ID** を取得  
   → URLに含まれる `tblXXXXXXXX` の部分

---

### Step 5: 管理画面で設定を完了する

1. デプロイされたサイトの `/dashboard` にアクセス  
   （例: `https://lark-headspa.pages.dev/dashboard`）

2. **「サロン追加」** をクリックしてサロンを作成:
   - サロン名: 任意（例: `My Salon`）
   - スラッグ: URL用の英数字（例: `my-salon`）
   - テーマ: 5種類から選択

3. 作成したサロンを選択 → **「Lark設定」** タブで以下を入力:

| 設定項目 | 値 |
|---------|-----|
| Lark App ID | Step 4でメモしたApp ID |
| Lark App Secret | Step 4でメモしたApp Secret |
| Bitable App Token | Step 4で取得したApp Token |
| 顧客テーブルID | `tblXXXXXXXX`（顧客テーブル） |
| カルテテーブルID | `tblXXXXXXXX`（カルテテーブル） |
| 月間目標テーブルID | `tblXXXXXXXX`（月間目標テーブル） |
| 年間目標テーブルID | `tblXXXXXXXX`（年間目標テーブル） |

4. **「設定を保存」** をクリック

---

## 使い方

### フォームURL

設定完了後、以下のURLでフォームにアクセスできます:

| フォーム | URL |
|---------|-----|
| 新規顧客情報 | `https://あなたのドメイン/form/スラッグ?type=customer` |
| カルテデータ | `https://あなたのドメイン/form/スラッグ?type=karte` |
| 月間目標 | `https://あなたのドメイン/form/スラッグ?type=monthly_goal` |
| 年間目標 | `https://あなたのドメイン/form/スラッグ?type=yearly_goal` |

管理画面の **「概要」** タブからURLのコピーもできます。

### カルテフォームの特別機能

- **顧客No.選択**: Lark顧客テーブルから自動取得。検索・絞り込み対応
- **写真添付**: カメラ撮影 or フォトライブラリから選択。Lark BASEに自動アップロード

---

## 技術構成

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19 + Tailwind CSS 4 + Vite |
| バックエンド | Hono（Cloudflare Pages Functions） |
| データベース | Cloudflare D1（SQLite） |
| ホスティング | Cloudflare Pages |
| 外部連携 | Lark Bitable API |

---

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

---

## デザインテーマ

5種類のデザインテーマから選択できます:

| テーマ | 説明 | メインカラー |
|--------|------|-------------|
| カルメ | 落ち着いたベージュ×ゴールドの癒し系 | #8B7355 |
| ナチュラル | 自然派・オーガニック系のグリーン | #5B7B5B |
| エレガント | ネイビー×ゴールドの高級感 | #2C3E6B |
| フレッシュ | ライトブルー×ホワイトの清潔感 | #4A90B8 |
| サクラ | ピンク×ローズの華やかさ | #C07088 |

管理画面の **「テーマ」** タブからワンクリックで切り替え可能です。

---

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
| GET | `/api/salons/:slug/customers` | 顧客一覧取得（Lark連携） |
| POST | `/api/salons/:slug/upload-photo` | 写真アップロード（Lark連携） |
| GET | `/api/salons/:slug/lark-fields` | Larkフィールド名確認（デバッグ用） |
| GET | `/api/form/:slug` | 公開フォーム設定取得 |
| POST | `/api/form/:slug/submit` | フォーム送信 |
| GET | `/api/salons/:id/submissions` | 送信履歴取得 |
| GET | `/api/form-types` | フォームタイプ一覧 |

---

## トラブルシューティング

### 「FieldNameNotFound」エラーが出る

コード側のフィールド名とLarkテーブルのフィールド名が1文字でも違うと発生します。  
デバッグ用エンドポイントで実際のフィールド名を確認してください:

```
https://あなたのドメイン/api/salons/スラッグ/lark-fields?table=karte
```

`shared/themes.ts` の `larkFieldName` を返ってきた `field_name` に合わせて修正します。

### 「DuplexLink field invalid」エラーが出る

カルテの「顧客No」は双方向関連（DuplexLink）フィールドです。  
`shared/themes.ts` で `larkFieldType: "DuplexLink"` になっていることを確認してください。

### D1バインドが反映されない

Settings → Functions でバインドを追加した後は、**再デプロイが必要**です。  
Deployments タブから **Retry deployment** を実行してください。

---

## Lark Bitableのフィールド名対応表

コードの `shared/themes.ts` 内の `larkFieldName` が、Larkテーブルの実際のフィールド名と **完全一致** している必要があります。  
環境に合わせて `shared/themes.ts` を編集してください。

### カルテテーブルの例

| コード側 `larkFieldName` | Lark側フィールド名 | Lark側タイプ |
|-------------------------|-------------------|-------------|
| 顧客No | 顧客No | DuplexLink |
| 顧客区分 | 顧客区分 | SingleSelect |
| 来店日 | 来店日 | DateTime |
| 施術コース | 施術コース | MultiSelect |
| 施術コメント | 施術コメント | Text |
| 施術：支払金額 | 施術：支払金額 | Currency |
| 物販：支払金額 | 物販：支払金額 | Currency |
| 支払方法 | 支払方法 | MultiSelect |
| 写真 | 写真（※Lark側の実際の名前に合わせる） | Attachment |

> 💡 スキップされるフィールド（自動計算・Lookup等）:  
> カルテID、氏名、性別、来店年月、総支払額

---

## ライセンス

MIT
