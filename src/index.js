/**
 * メインエントリーポイント
 * - DBスケジュール管理に基づいた動的cron
 * - Web管理画面 (Express) を同時起動
 */

require("dotenv").config();
const cron = require("node-cron");
const { ROUTES } = require("../config/routes");
const { fetchAllTraffic } = require("./traffic");
const { sendTrafficEmail } = require("./mailer");
const { initDB, logSend } = require("./db");
const { initScheduleTable, getNotifiableNow } = require("./scheduler");
const { startWebServer } = require("./web");

function checkEnv() {
  const required = ["SENDGRID_API_KEY", "FROM_EMAIL", "DATABASE_URL"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("❌ 未設定の環境変数:", missing.join(", "));
    process.exit(1);
  }
  if (!process.env.TO_EMAILS) {
    console.warn("⚠️  TO_EMAILS 未設定: DBのスケジュールに recipients を設定してください");
  }
}

async function runJob() {
  const startTime = new Date();
  console.log(`\n${"=".repeat(50)}`);
  console.log(`🕐 チェック開始: ${startTime.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`);

  // 今このタイミングで通知すべきスケジュールを取得
  const notifiable = await getNotifiableNow();
  if (notifiable.length === 0) {
    console.log("   → 通知対象スケジュールなし（時間外 or 間隔未到来）");
    return;
  }

  console.log(`   → 通知対象スケジュール: ${notifiable.length}件`);

  // 交通情報を1回だけ取得して全スケジュールで共有
  let trafficData;
  try {
    trafficData = await fetchAllTraffic(ROUTES);
  } catch (err) {
    console.error("❌ 交通情報取得エラー:", err.message);
    await logSend({ recipientCount: 0, hasCongestion: false, summary: "交通情報取得失敗", status: "error", errorMessage: err.message });
    return;
  }

  const hasCongestion = trafficData.some((r) => r.hasCongestion);
  const summary = trafficData.map((r) => `${r.routeName}:${r.hasCongestion ? "渋滞あり" : "なし"}`).join(" / ");

  // 各スケジュールの送信先にメール送信
  for (const { schedule, recipients } of notifiable) {
    console.log(`\n📧 [${schedule.name}] → ${recipients.join(", ")}`);
    const mailResult = await sendTrafficEmail(recipients, trafficData);
    await logSend({
      recipientCount: recipients.length,
      hasCongestion,
      summary: `[${schedule.name}] ${summary}`,
      status: mailResult.success ? "success" : "mail_error",
      errorMessage: mailResult.error || null,
    });
  }

  console.log(`\n✅ 完了 (${((Date.now() - startTime) / 1000).toFixed(1)}秒)`);
}

async function main() {
  checkEnv();

  // DB初期化
  await initDB().catch((e) => console.warn("⚠️  DB初期化スキップ:", e.message));
  await initScheduleTable().catch((e) => console.warn("⚠️  スケジュールテーブルスキップ:", e.message));

  // Web管理画面を起動
  startWebServer();

  // 起動時に即チェック
  await runJob();

  // 毎分チェック（スケジュール条件を内部で判定）
  cron.schedule("* * * * *", runJob, { timezone: "Asia/Tokyo" });
  console.log("\n⏰ 毎分チェック開始（スケジュール設定に従って送信）\n");
}

main().catch((err) => {
  console.error("💥 致命的エラー:", err);
  process.exit(1);
});
