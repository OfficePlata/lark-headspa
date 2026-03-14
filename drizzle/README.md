# Drizzle

データベーススキーマ定義とマイグレーションファイルを管理するディレクトリです。Drizzle ORM を使用して MySQL / TiDB データベースのテーブル構造を定義しています。

---

## ファイル構成

| ファイル | 説明 |
|----------|------|
| `schema.ts` | テーブル定義（TypeScript） |
| `relations.ts` | テーブル間のリレーション定義 |
| `0000_strong_ezekiel_stane.sql` | 初期マイグレーション（users テーブル） |
| `0001_calm_photon.sql` | サロン関連テーブルのマイグレーション |
| `meta/` | Drizzle Kit のメタデータ（スナップショット等） |
| `migrations/` | マイグレーション管理用ディレクトリ |

---

## テーブル定義

### users

認証ユーザーを管理するテーブルです。OAuth 認証で取得した情報を保存します。

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | INT (PK, Auto) | サロゲートキー |
| `openId` | VARCHAR(64) | OAuth 識別子（ユニーク） |
| `name` | TEXT | ユーザー名 |
| `email` | VARCHAR(320) | メールアドレス |
| `loginMethod` | VARCHAR(64) | ログイン方法 |
| `role` | ENUM('user','admin') | ユーザーロール |
| `createdAt` | TIMESTAMP | 作成日時 |
| `updatedAt` | TIMESTAMP | 更新日時 |
| `lastSignedIn` | TIMESTAMP | 最終ログイン日時 |

### salons

サロン情報を管理するテーブルです。代理店ごとに 1 つ以上のサロンを作成できます。

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | INT (PK, Auto) | サロゲートキー |
| `userId` | INT (FK) | オーナーユーザー ID |
| `salonName` | VARCHAR(255) | サロン名 |
| `slug` | VARCHAR(100) | URL 用スラッグ（ユニーク） |
| `themeId` | VARCHAR(50) | 適用中のテーマ ID |
| `logoUrl` | TEXT | ロゴ画像 URL |
| `larkAppId` | VARCHAR(255) | Lark App ID |
| `larkAppSecret` | VARCHAR(255) | Lark App Secret |
| `larkBitableAppToken` | VARCHAR(255) | Bitable App Token |
| `larkCustomerTableId` | VARCHAR(255) | 顧客テーブル ID |
| `larkMonthlyGoalTableId` | VARCHAR(255) | 月間目標テーブル ID |
| `larkYearlyGoalTableId` | VARCHAR(255) | 年間目標テーブル ID |
| `larkKarteTableId` | VARCHAR(255) | カルテテーブル ID |
| `isActive` | BOOLEAN | アクティブ状態 |
| `createdAt` | TIMESTAMP | 作成日時 |
| `updatedAt` | TIMESTAMP | 更新日時 |

### form_fields

フォームのフィールド構成を管理するテーブルです。サロンごと・フォームタイプごとにフィールドをカスタマイズできます。

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | INT (PK, Auto) | サロゲートキー |
| `salonId` | INT (FK) | サロン ID |
| `formType` | VARCHAR(50) | フォーム種別 |
| `fieldName` | VARCHAR(100) | フィールド名（Lark BASE 対応） |
| `fieldLabel` | VARCHAR(255) | 表示ラベル |
| `fieldType` | VARCHAR(50) | 入力タイプ（text, number, date, select, textarea, month） |
| `options` | JSON | セレクトボックスの選択肢 |
| `placeholder` | VARCHAR(255) | プレースホルダーテキスト |
| `isRequired` | BOOLEAN | 必須フラグ |
| `sortOrder` | INT | 表示順序 |
| `isActive` | BOOLEAN | アクティブ状態 |
| `createdAt` | TIMESTAMP | 作成日時 |

### submissions

フォーム送信データを管理するテーブルです。Lark Bitable への同期状態も記録します。

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | INT (PK, Auto) | サロゲートキー |
| `salonId` | INT (FK) | サロン ID |
| `formType` | VARCHAR(50) | フォーム種別 |
| `formData` | JSON | 送信データ |
| `larkSynced` | BOOLEAN | Lark 同期済みフラグ |
| `larkRecordId` | VARCHAR(255) | Lark レコード ID |
| `syncError` | TEXT | 同期エラーメッセージ |
| `createdAt` | TIMESTAMP | 送信日時 |

---

## マイグレーション

スキーマを変更した場合は、以下の手順でマイグレーションを実行します。

```bash
# マイグレーション SQL を生成
pnpm drizzle-kit generate

# マイグレーションを適用
pnpm drizzle-kit migrate
```

生成された SQL ファイルは `drizzle/` ディレクトリに保存されます。本番環境では `webdev_execute_sql` ツールを使用して SQL を直接実行してください。
