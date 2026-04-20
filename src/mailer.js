/**
 * メール生成・送信モジュール (SendGrid)
 *
 * SendGrid無料枠: 月100通
 * 30分ごと送信 = 月約1,440通 → 無料枠超過
 * ※ SendGrid Essentialsプラン($19.95/月)または
 *   Gmail SMTPへの切り替えを検討してください
 *
 * 【Gmail SMTPへの切り替え方法】
 * 1. Googleアカウントで「アプリパスワード」を生成
 * 2. nodemailerをインストール: npm install nodemailer
 * 3. このファイルの sendEmail() を nodemailer版に変更
 */

const sgMail = require("@sendgrid/mail");
const { congestionLevelToJa } = require("./traffic");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * 渋滞情報をメール本文（テキスト）にフォーマット
 */
function formatEmailText(trafficData) {
  const now = new Date();
  const jst = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  let text = `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🚗 高速道路渋滞情報レポート\n`;
  text += `📅 ${jst} 時点の情報\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // 全体サマリー
  const anyRouteHasCongestion = trafficData.some((r) => r.hasCongestion);
  if (anyRouteHasCongestion) {
    text += `⚠️ 現在、渋滞が発生している区間があります\n\n`;
  } else {
    text += `✅ 全路線、現在渋滞はありません\n\n`;
  }

  // 各路線の詳細
  for (const route of trafficData) {
    text += `■ ${route.routeName}　${route.direction}\n`;
    text += `─────────────────────\n`;

    if (!route.hasCongestion) {
      text += `  渋滞：なし\n`;
      text += `  全区間所要時間：約${route.totalEstimatedMinutes}分（通常${route.totalNormalMinutes}分）\n\n`;
    } else {
      text += `  渋滞：あり ⚠️\n`;
      text += `  全区間所要時間：約${route.totalEstimatedMinutes}分（通常+${route.totalDelayMinutes}分遅れ）\n\n`;
    }

    // 区間ごとの詳細
    for (let i = 0; i < route.segments.length; i++) {
      const seg = route.segments[i];
      const num = `${i + 1}`;

      if (seg.error) {
        text += `  ${num}. ${seg.from}\n`;
        text += `     ↓ 情報取得できませんでした\n`;
        text += `  ${parseInt(num) + 1 <= route.segments.length ? "" : ""}`;
      } else {
        const statusIcon = seg.congestionLevel === "none" ? "✅" :
                           seg.congestionLevel === "slow" ? "🟡" :
                           seg.congestionLevel === "congested" ? "🔴" : "🚨";

        const timeInfo = seg.estimatedMinutes !== null
          ? `約${seg.estimatedMinutes}分（通常${seg.normalMinutes}分）`
          : `通常${seg.normalMinutes}分`;

        text += `  ${num}. ${seg.from}\n`;
        text += `     走行区間：${seg.from} → ${seg.to}\n`;
        text += `     状況：${statusIcon} ${congestionLevelToJa(seg.congestionLevel)}\n`;
        text += `     所要時間：${timeInfo}\n`;

        if (seg.isCongested && seg.delayMinutes > 0) {
          text += `     遅れ：+${seg.delayMinutes}分\n`;
        }
      }
    }

    // 最終地点
    const lastSeg = route.segments[route.segments.length - 1];
    text += `  ${route.segments.length + 1}. ${lastSeg.to}（終点）\n`;
    text += `\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `次回の情報は30分後にお届けします\n`;
  text += `配信停止: ${process.env.FROM_EMAIL}\n`;

  return text;
}

/**
 * 渋滞情報をHTML形式にフォーマット
 */
function formatEmailHtml(trafficData) {
  const now = new Date();
  const jst = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  const anyRouteHasCongestion = trafficData.some((r) => r.hasCongestion);

  let html = `
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Hiragino Sans', 'Meiryo', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .header { background: #1a237e; color: white; padding: 20px; text-align: center; }
  .header h1 { margin: 0; font-size: 20px; }
  .header .time { font-size: 13px; opacity: 0.8; margin-top: 6px; }
  .summary { padding: 14px 20px; font-size: 15px; font-weight: bold;
    background: ${anyRouteHasCongestion ? "#fff3e0" : "#e8f5e9"};
    color: ${anyRouteHasCongestion ? "#e65100" : "#2e7d32"}; }
  .route-block { border-top: 3px solid #1a237e; margin: 0; padding: 16px 20px; }
  .route-title { font-size: 16px; font-weight: bold; color: #1a237e; margin-bottom: 4px; }
  .route-summary { font-size: 13px; color: #666; margin-bottom: 10px; }
  .segment { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid #eee; }
  .segment:last-child { border-bottom: none; }
  .seg-num { background: #1a237e; color: white; border-radius: 50%; width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; margin-top: 2px; }
  .seg-info { flex: 1; }
  .seg-name { font-weight: bold; font-size: 14px; }
  .seg-detail { font-size: 12px; color: #555; margin-top: 3px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; }
  .badge-none { background: #e8f5e9; color: #2e7d32; }
  .badge-slow { background: #fff9c4; color: #f57f17; }
  .badge-congested { background: #ffebee; color: #c62828; }
  .badge-heavy { background: #b71c1c; color: white; }
  .footer { background: #f5f5f5; padding: 14px 20px; text-align: center; font-size: 11px; color: #999; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🚗 高速道路渋滞情報</h1>
    <div class="time">📅 ${jst} 時点</div>
  </div>
  <div class="summary">
    ${anyRouteHasCongestion ? "⚠️ 渋滞が発生している区間があります" : "✅ 全路線、現在渋滞はありません"}
  </div>
`;

  for (const route of trafficData) {
    const routeSummary = route.hasCongestion
      ? `⚠️ 渋滞あり / 全区間 約${route.totalEstimatedMinutes}分（通常+${route.totalDelayMinutes}分）`
      : `✅ 渋滞なし / 全区間 約${route.totalEstimatedMinutes}分（通常${route.totalNormalMinutes}分）`;

    html += `
  <div class="route-block">
    <div class="route-title">■ ${route.routeName}　${route.direction}</div>
    <div class="route-summary">${routeSummary}</div>
`;

    for (let i = 0; i < route.segments.length; i++) {
      const seg = route.segments[i];
      const badgeClass = `badge-${seg.congestionLevel === "unknown" ? "none" : seg.congestionLevel}`;
      const label = congestionLevelToJa(seg.congestionLevel);
      const timeText = seg.estimatedMinutes !== null
        ? `所要時間 約${seg.estimatedMinutes}分（通常${seg.normalMinutes}分）${seg.isCongested && seg.delayMinutes > 0 ? ` ／ +${seg.delayMinutes}分遅れ` : ""}`
        : `通常${seg.normalMinutes}分`;

      html += `
    <div class="segment">
      <div class="seg-num">${i + 1}</div>
      <div class="seg-info">
        <div class="seg-name">${seg.from} → ${seg.to}</div>
        <div class="seg-detail">
          <span class="badge ${badgeClass}">${label}</span>
          &nbsp;${timeText}
        </div>
      </div>
    </div>`;
    }

    const lastSeg = route.segments[route.segments.length - 1];
    html += `
    <div class="segment">
      <div class="seg-num" style="background:#4caf50">${route.segments.length + 1}</div>
      <div class="seg-info">
        <div class="seg-name">${lastSeg.to}（終点）</div>
      </div>
    </div>
  </div>`;
  }

  html += `
  <div class="footer">
    次回の情報は30分後にお届けします<br>
    配信停止のご連絡は ${process.env.FROM_EMAIL} まで
  </div>
</div>
</body>
</html>`;

  return html;
}

/**
 * 件名を生成
 */
function buildSubject(trafficData) {
  const now = new Date();
  const jst = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  const anyRouteHasCongestion = trafficData.some((r) => r.hasCongestion);
  const congestedRoutes = trafficData
    .filter((r) => r.hasCongestion)
    .map((r) => r.routeName);

  if (anyRouteHasCongestion) {
    return `⚠️ [${jst}] 渋滞情報: ${congestedRoutes.join("・")} で渋滞発生`;
  }
  return `✅ [${jst}] 渋滞情報: 全路線渋滞なし`;
}

/**
 * メールを送信
 * @param {string[]} recipients - 送信先メールアドレスの配列
 * @param {Object[]} trafficData - fetchAllTraffic の結果
 */
async function sendTrafficEmail(recipients, trafficData) {
  if (!recipients || recipients.length === 0) {
    console.warn("⚠️ 送信先メールアドレスが設定されていません");
    return { success: false, error: "No recipients" };
  }

  const subject = buildSubject(trafficData);
  const textContent = formatEmailText(trafficData);
  const htmlContent = formatEmailHtml(trafficData);

  // SendGridは複数宛先を配列で指定可能
  const msg = {
    to: recipients,
    from: {
      email: process.env.FROM_EMAIL,
      name: process.env.FROM_NAME || "高速道路渋滞情報",
    },
    subject,
    text: textContent,
    html: htmlContent,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ メール送信完了 → ${recipients.length}名 (${recipients.join(", ")})`);
    console.log(`   件名: ${subject}`);
    return { success: true, subject };
  } catch (err) {
    const errorDetail = err.response?.body?.errors || err.message;
    console.error("❌ メール送信失敗:", JSON.stringify(errorDetail));
    return { success: false, error: JSON.stringify(errorDetail) };
  }
}

module.exports = { sendTrafficEmail, formatEmailText, buildSubject };
