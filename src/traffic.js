/**
 * HERE Traffic Flow API を使って渋滞情報を取得するモジュール
 *
 * HERE Traffic Flow API v7（正確なリアルタイム渋滞情報）
 * 無料枠: 月25万リクエスト
 * 想定使用量: 月2日×4時間×30分毎×3路線×8区間 ≈ 月384リクエスト → 余裕で無料枠内
 *
 * APIキー取得: https://developer.here.com/
 * ※クレカ登録が必要ですが、無料枠(25万req/月)内は課金されません
 */

const axios = require("axios");

const HERE_API_KEY = process.env.HERE_API_KEY;
const HERE_FLOW_URL = "https://data.traffic.hereapi.com/v7/flow";

/**
 * 速度比率から渋滞レベルを判定
 * ratio = 現在速度 / 自由流速度
 */
function speedRatioToCongestionLevel(ratio) {
  if (ratio >= 0.85) return "none";      // 順調
  if (ratio >= 0.60) return "slow";      // やや混雑
  if (ratio >= 0.35) return "congested"; // 渋滞
  return "heavy";                         // 激しい渋滞
}

/**
 * 渋滞レベルを日本語に変換
 */
function congestionLevelToJa(level) {
  return {
    none:      "渋滞なし",
    slow:      "やや混雑",
    congested: "渋滞",
    heavy:     "激しい渋滞",
    unknown:   "情報取得不可",
  }[level] || level;
}

/**
 * 1区間の交通情報を HERE API から取得
 */
async function fetchSegmentTraffic(segment) {
  const { origin, destination, normalMinutes, from, to, name } = segment;

  const padding = 0.015;
  const minLat = Math.min(origin.lat, destination.lat) - padding;
  const maxLat = Math.max(origin.lat, destination.lat) + padding;
  const minLng = Math.min(origin.lng, destination.lng) - padding;
  const maxLng = Math.max(origin.lng, destination.lng) + padding;

  try {
    const response = await axios.get(HERE_FLOW_URL, {
      params: {
        apiKey: HERE_API_KEY,
        in: `bbox:${minLng},${minLat},${maxLng},${maxLat}`,
        locationReferencing: "shape",
      },
      timeout: 12000,
    });

    const results = response.data?.results || [];
    if (results.length === 0) {
      return buildResult(segment, "unknown", null);
    }

    // 速度比率の収集
    const ratios = [];
    for (const r of results) {
      const cf = r.currentFlow;
      if (cf?.speedUncapped && cf?.freeFlow && cf.freeFlow > 0) {
        ratios.push(cf.speedUncapped / cf.freeFlow);
      }
    }

    if (ratios.length === 0) return buildResult(segment, "unknown", null);

    const minRatio = Math.min(...ratios);
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const congestionLevel = speedRatioToCongestionLevel(minRatio);
    const estimatedMinutes = Math.round(normalMinutes / Math.max(avgRatio, 0.15));
    const delayMinutes = Math.max(0, estimatedMinutes - normalMinutes);

    return {
      segmentName: name, from, to, normalMinutes,
      estimatedMinutes, delayMinutes,
      minSpeedRatio: Math.round(minRatio * 100),
      congestionLevel,
      isCongested: congestionLevel !== "none" && congestionLevel !== "unknown",
      dataPoints: ratios.length,
      error: false,
    };
  } catch (err) {
    console.error(`  ⚠️ [${name}] 取得エラー: ${err.message}`);
    return buildResult(segment, "unknown", err.message);
  }
}

function buildResult(segment, congestionLevel, errorMsg) {
  return {
    segmentName: segment.name, from: segment.from, to: segment.to,
    normalMinutes: segment.normalMinutes,
    estimatedMinutes: segment.normalMinutes,
    delayMinutes: 0,
    minSpeedRatio: null, congestionLevel,
    isCongested: false, dataPoints: 0,
    error: !!errorMsg, errorMessage: errorMsg,
  };
}

async function fetchRouteTraffic(route) {
  console.log(`  📡 ${route.name} を取得中...`);
  const segmentResults = [];
  for (const segment of route.segments) {
    segmentResults.push(await fetchSegmentTraffic(segment));
    await new Promise((r) => setTimeout(r, 300));
  }
  const hasCongestion = segmentResults.some((r) => r.isCongested);
  const totalNormal = segmentResults.reduce((s, r) => s + r.normalMinutes, 0);
  const totalEst = segmentResults.reduce((s, r) => s + r.estimatedMinutes, 0);
  return {
    routeId: route.id, routeName: route.name, direction: route.direction,
    segments: segmentResults, hasCongestion,
    totalNormalMinutes: totalNormal,
    totalEstimatedMinutes: totalEst,
    totalDelayMinutes: Math.max(0, totalEst - totalNormal),
  };
}

async function fetchAllTraffic(routes) {
  console.log("🚗 HERE APIから交通情報を取得...");
  const results = [];
  for (const route of routes) results.push(await fetchRouteTraffic(route));
  console.log("✅ 取得完了");
  return results;
}

module.exports = { fetchAllTraffic, fetchRouteTraffic, congestionLevelToJa };
