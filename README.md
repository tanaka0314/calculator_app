# 計算パターン帳

事前に計算式を登録しておき、変数に数値を入れるだけで即座に結果が出る計算アプリです。

## 機能

- 四則演算 (`+` `-` `*` `/`) と括弧をサポート
- 変数名は日本語・英字どちらもOK（例: `税率`, `price`）
- パターンを画面上から追加・編集・削除
- データは `localStorage` に自動保存（リロードしても消えない）
- サーバ不要 — ブラウザで直接開くだけ

## ローカルで使う

`index.html` をブラウザでそのまま開いてください（ダブルクリック可）。

> **注意**: `type="module"` を使っているため、`file://` で開いたとき一部ブラウザ (Chrome) でエラーが出る場合があります。その場合は以下のどちらかで対応してください。
> ```
> # Python 3 が入っている場合
> python -m http.server 8080
> # → http://localhost:8080 で開く
> ```

## GitHub Pages で公開する手順

1. GitHub で新しいリポジトリを作成（例: `keisan`）
2. このフォルダを push する:
   ```sh
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/<ユーザー名>/keisan.git
   git push -u origin main
   ```
3. リポジトリの **Settings → Pages → Source** を `main` ブランチ / `/ (root)` に設定
4. `https://<ユーザー名>.github.io/keisan/` で公開完了

## 数式の例

| パターン名 | 数式 |
|---|---|
| 消費税込み価格 | `税抜価格 * (1 + 税率 / 100)` |
| 割引後価格 | `定価 * (1 - 割引率 / 100)` |
| 3つの平均 | `(a + b + c) / 3` |
| 利益率 | `(売値 - 原価) / 売値 * 100` |
| 月利計算 | `元本 * 月利率 / 100 * 期間` |
