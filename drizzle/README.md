# drizzle/ - データベースマイグレーション

Cloudflare D1（SQLite）用のマイグレーションSQLファイルを格納しています。

## テーブル構成

**salons テーブル** はサロンの基本情報とLark API設定を保持します。各サロンは一意のスラッグ（URL用識別子）を持ち、選択されたデザインテーマID、Lark Open PlatformのApp ID/App Secret、Bitable App Token、各フォームタイプに対応するテーブルIDを格納します。

**submissions テーブル** はフォーム送信ログを記録します。送信されたフォームデータをJSON形式で保存し、Lark BASEへの同期状態（成功/失敗）、同期先のレコードID、エラーメッセージを追跡します。

## マイグレーション実行

ローカル環境では `pnpm db:migrate:local`、リモート（本番）環境では `pnpm db:migrate:remote` を実行してください。いずれもWrangler CLIを通じてD1データベースにSQLを適用します。
