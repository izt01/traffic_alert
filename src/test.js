/**
 * テスト実行スクリプト
 * cronを使わず一度だけ実行してメール送信を確認する
 *
 * 実行方法: node src/test.js
 */

require("dotenv").config();
const { ROUTES } = require("../config/routes");
const { fetchAllTraffic } = require("./traffic");
const { sendTrafficEmail, formatEmailText } = require("./mailer");

async function test() {
  console.log("🧪 テスト実行モード\n");

  // テキスト出力のみ（メール送信なし）でテストする場合は DRY_RUN=true
  const dryRun = process.env.DRY_RUN === "true";

  if (!process.env.HERE_API_KEY || process.env.HERE_API_KEY === "your_here_api_key_here") {
    console.log("⚠️  HERE_API_KEY が未設定のため、モックデータでテストします\n");
    useMockData(dryRun);
    return;
  }

  try {
    console.log("📡 交通情報を取得中...");
    const trafficData = await fetchAllTraffic(ROUTES);

    console.log("\n📧 メール本文プレビュー:");
    console.log("─".repeat(50));
    console.log(formatEmailText(trafficData));
    console.log("─".repeat(50));

    if (!dryRun && process.env.SENDGRID_API_KEY && process.env.TO_EMAILS) {
      const recipients = process.env.TO_EMAILS.split(",").map((e) => e.trim());
      console.log(`\n📤 メール送信中 → ${recipients.join(", ")}`);
      await sendTrafficEmail(recipients, trafficData);
    } else {
      console.log("\n✅ DRY RUNモード: メール送信はスキップしました");
      console.log("   実際に送信するには DRY_RUN=false を設定してください");
    }
  } catch (err) {
    console.error("❌ エラー:", err.message);
  }
}

function useMockData(dryRun) {
  const mockData = [
    {
      routeName: "東名高速",
      direction: "下り（東京→名古屋）",
      hasCongestion: true,
      totalNormalMinutes: 180,
      totalEstimatedMinutes: 220,
      totalDelayMinutes: 40,
      segments: [
        { from: "東京IC", to: "横浜町田IC", normalMinutes: 20, estimatedMinutes: 20, delayMinutes: 0, congestionLevel: "none", isCongested: false },
        { from: "横浜町田IC", to: "厚木IC", normalMinutes: 12, estimatedMinutes: 28, delayMinutes: 16, congestionLevel: "congested", isCongested: true },
        { from: "厚木IC", to: "御殿場JCT", normalMinutes: 35, estimatedMinutes: 47, delayMinutes: 12, congestionLevel: "slow", isCongested: true },
        { from: "御殿場JCT", to: "富士IC", normalMinutes: 17, estimatedMinutes: 17, delayMinutes: 0, congestionLevel: "none", isCongested: false },
        { from: "富士IC", to: "静岡IC", normalMinutes: 22, estimatedMinutes: 22, delayMinutes: 0, congestionLevel: "none", isCongested: false },
        { from: "静岡IC", to: "浜松IC", normalMinutes: 40, estimatedMinutes: 52, delayMinutes: 12, congestionLevel: "slow", isCongested: true },
        { from: "浜松IC", to: "豊川IC", normalMinutes: 25, estimatedMinutes: 25, delayMinutes: 0, congestionLevel: "none", isCongested: false },
        { from: "豊川IC", to: "名古屋IC", normalMinutes: 29, estimatedMinutes: 29, delayMinutes: 0, congestionLevel: "none", isCongested: false },
      ],
    },
    {
      routeName: "中央道",
      direction: "下り（調布→名古屋）",
      hasCongestion: false,
      totalNormalMinutes: 253,
      totalEstimatedMinutes: 253,
      totalDelayMinutes: 0,
      segments: [
        { from: "調布IC", to: "八王子IC", normalMinutes: 22, estimatedMinutes: 22, delayMinutes: 0, congestionLevel: "none", isCongested: false },
        { from: "八王子IC", to: "大月JCT", normalMinutes: 30, estimatedMinutes: 30, delayMinutes: 0, congestionLevel: "none", isCongested: false },
        { from: "大月JCT", to: "甲府昭和IC", normalMinutes: 32, estimatedMinutes: 32, delayMinutes: 0, congestionLevel: "none", isCongested: false },
        { from: "甲府昭和IC", to: "諏訪IC", normalMinutes: 42, estimatedMinutes: 42, delayMinutes: 0, congestionLevel: "none", isCongested: false },
        { from: "諏訪IC", to: "伊那IC", normalMinutes: 22, estimatedMinutes: 22, delayMinutes: 0, congestionLevel: "none", isCongested: false },
        { from: "伊那IC", to: "飯田IC", normalMinutes: 35, estimatedMinutes: 35, delayMinutes: 0, congestionLevel: "none", isCongested: false },
        { from: "飯田IC", to: "中津川IC", normalMinutes: 30, estimatedMinutes: 30, delayMinutes: 0, congestionLevel: "none", isCongested: false },
        { from: "中津川IC", to: "小牧JCT", normalMinutes: 40, estimatedMinutes: 40, delayMinutes: 0, congestionLevel: "none", isCongested: false },
      ],
    },
    {
      routeName: "圏央道",
      direction: "（関連区間）",
      hasCongestion: false,
      totalNormalMinutes: 62,
      totalEstimatedMinutes: 62,
      totalDelayMinutes: 0,
      segments: [
        { from: "海老名JCT", to: "相模原愛川IC", normalMinutes: 11, estimatedMinutes: 11, delayMinutes: 0, congestionLevel: "none", isCongested: false },
        { from: "相模原愛川IC", to: "八王子JCT", normalMinutes: 16, estimatedMinutes: 16, delayMinutes: 0, congestionLevel: "none", isCongested: false },
        { from: "八王子JCT", to: "狭山日高IC", normalMinutes: 25, estimatedMinutes: 25, delayMinutes: 0, congestionLevel: "none", isCongested: false },
        { from: "狭山日高IC", to: "鶴ヶ島JCT", normalMinutes: 10, estimatedMinutes: 10, delayMinutes: 0, congestionLevel: "none", isCongested: false },
      ],
    },
  ];

  const { formatEmailText } = require("./mailer");
  console.log("📧 モックデータでのメール本文プレビュー:");
  console.log("─".repeat(50));
  console.log(formatEmailText(mockData));
  console.log("─".repeat(50));
  console.log("\n✅ モックテスト完了");
}

test().catch(console.error);
