# functions/ - Cloudflare Pages Functions（API）

Honoフレームワークで構築されたバックエンドAPIです。Cloudflare Pages Functionsとして動作し、D1データベースとLark Bitable APIと連携します。

## アーキテクチャ

`functions/api/[[route]].ts` が全APIリクエストを処理するキャッチオールルートです。Honoの `basePath("/api")` により、`/api/*` パス以下の全リクエストがルーティングされます。

Cloudflare Pages Functionsの仕組みにより、`functions/` ディレクトリ内のファイルがサーバーレス関数として自動的にデプロイされます。`[[route]]` はワイルドカードパターンで、任意のサブパスにマッチします。

## D1データベースバインディング

環境変数 `SALON_DB` を通じてCloudflare D1データベースにアクセスします。wrangler.tomlの `[[d1_databases]]` セクションでバインディングを設定してください。

## Lark API連携

各サロンが個別にLark Open Platformの認証情報を持ち、フォーム送信時にBitable APIを呼び出してレコードを作成します。テナントアクセストークンの取得、Bitableレコードの作成、フォームデータからLarkフィールド形式への変換を処理します。日付はミリ秒タイムスタンプに、数値文字列はNumber型に自動変換されます。
