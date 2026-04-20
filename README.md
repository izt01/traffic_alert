# 🚗 高速道路渋滞情報メール通知サービス v2

東名高速・中央道・圏央道の渋滞情報を、**設定した日程・時間帯・間隔**でメール通知するサービスです。

## ✅ データソース: 国土交通省 xROAD API（完全無料・クレカ不要）

- 利用規約への同意のみ必要: https://www.jartic-open-traffic.org/
- 高速道路の旅行速度データを5分ごとに提供
- APIキー不要

---

## 📐 アーキテクチャ

```
Railway (常時起動 / 毎分チェック)
    ├─ xROAD API ──────→ 旅行速度データ取得（無料）
    ├─ Railway PostgreSQL → スケジュール設定・送信ログ保存
    ├─ SendGrid ────────→ HTMLメール送信
    └─ Express Web UI ──→ ブラウザでスケジュール管理
```

---

## 📅 スケジュール機能

管理画面（Web UI）から以下を設定できます：

| 設定項目 | 例 |
|---|---|
| 有効期間 | 2025/04/29 〜 2025/05/06（GW期間のみ） |
| 通知時間帯 | 7:00 〜 22:00 |
| 通知間隔 | 30分 / 1時間 / 2時間ごと |
| 送信先 | スケジュールごとに個別指定可能 |
| 複数スケジュール | 「平日朝夕のみ」「GW集中監視」など並行設定OK |

---

## 🚀 セットアップ

### 1. SendGrid（または Gmail SMTP）の設定

**SendGrid（推奨の場合）:**
1. https://sendgrid.com/ でアカウント作成
2. Settings → API Keys → Create API Key
3. ⚠️ 無料枠は月100通のみ → 30分ごとには不足

**Gmail SMTPへの切り替え（無制限・無料）:**
```bash
npm install nodemailer
```
`src/mailer.js` の先頭を以下に変更:
```javascript
const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
});
// sendTrafficEmail 内の sgMail.send() を以下に変更:
await transporter.sendMail({
  from: `"高速道路渋滞情報" <${process.env.GMAIL_USER}>`,
  to: recipients.join(","), subject, text, html,
});
```
環境変数に追加:
```
GMAIL_USER=your@gmail.com
GMAIL_APP_PASS=xxxx xxxx xxxx xxxx  # Googleのアプリパスワード
```

### 2. Railwayにデプロイ

```bash
# Railwayにプロジェクト作成
railway init

# PostgreSQLプラグインを追加（管理画面から）
# 環境変数を Railway 管理画面で設定

# デプロイ
railway up
```

### 3. 環境変数を設定（Railway管理画面）

```
SENDGRID_API_KEY=SG.xxxxx
FROM_EMAIL=noreply@yourdomain.com
TO_EMAILS=you@example.com
DATABASE_URL=（Railwayが自動設定）
ADMIN_PASSWORD=（任意）
TZ=Asia/Tokyo
```

### 4. 管理画面でスケジュール設定

デプロイ後、`https://your-app.railway.app/` にアクセスして
通知スケジュールをブラウザから設定できます。

---

## 📁 ファイル構成

```
traffic-alert/
├── src/
│   ├── index.js      # メイン（毎分チェック + Web起動）
│   ├── traffic.js    # xROAD API交通情報取得
│   ├── mailer.js     # メール生成・送信（SendGrid）
│   ├── scheduler.js  # スケジュール管理ロジック
│   ├── web.js        # Express管理画面
│   ├── db.js         # Railway PostgreSQL操作
│   └── test.js       # テスト実行スクリプト
├── config/
│   └── routes.js     # IC区間の座標設定
├── .env.example
├── railway.toml
└── package.json
```

---

## ⏰ スケジュール設定例

| 名前 | 開始日 | 終了日 | 時間帯 | 間隔 |
|---|---|---|---|---|
| 通常（平日） | なし | なし | 7:00〜9:00, 17:00〜20:00 | 30分 |
| GW集中監視 | 4/29 | 5/6 | 6:00〜22:00 | 30分 |
| 週末チェック | なし | なし | 8:00〜20:00 | 1時間 |
