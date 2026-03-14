# shared/ - 共有モジュール

フロントエンドとバックエンド（Cloudflare Pages Functions）の両方で使用される共有コードです。

## themes.ts

5種類のデザインテーマ定義と、デフォルトフォーム設定を含みます。

### テーマ構成

各テーマは以下のプロパティを持ちます:

- `id` - テーマ識別子
- `name` / `nameJa` - 英語名 / 日本語名
- `description` - テーマの説明
- `colors` - 16色のカラーパレット（primary, background, surface, text, border, input等）
- `fonts` - 見出し用・本文用フォント
- `borderRadius` - 角丸サイズ
- `shadow` - ボックスシャドウ

### デフォルトフォーム設定

`DEFAULT_FORM_CONFIGS` に4種類のフォームのデフォルトフィールド構成を定義:

- `customer` - 新規顧客情報（8フィールド）
- `karte` - カルテデータ（12フィールド）
- `monthly_goal` - 月間目標（4フィールド）
- `yearly_goal` - 年間目標（4フィールド）
