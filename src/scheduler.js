/**
 * スケジュール管理モジュール
 *
 * スケジュール設定:
 *   - 有効期間（開始日〜終了日）
 *   - 通知時間帯（例: 7:00〜22:00）
 *   - 通知間隔（30分 / 1時間 / 2時間）
 *
 * DBテーブル: schedules
 */

const { pool } = require("./db");
const cron = require("node-cron");

/**
 * schedulesテーブルの初期化
 */
async function initScheduleTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schedules (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'デフォルト設定',
      active BOOLEAN DEFAULT TRUE,
      -- 有効期間
      date_from DATE,               -- NULL = 制限なし
      date_to DATE,                 -- NULL = 制限なし
      -- 通知時間帯（0〜23の整数）
      hour_from INTEGER DEFAULT 7,
      hour_to INTEGER DEFAULT 22,
      -- 通知間隔（分）: 30, 60, 120
      interval_minutes INTEGER DEFAULT 30,
      -- 送信先（NULLの場合は環境変数 TO_EMAILS を使用）
      recipients TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- デフォルトスケジュールが無ければ挿入
    INSERT INTO schedules (name, active, hour_from, hour_to, interval_minutes)
    SELECT 'デフォルト設定', TRUE, 7, 22, 30
    WHERE NOT EXISTS (SELECT 1 FROM schedules LIMIT 1);
  `);
  console.log("✅ スケジュールテーブル初期化完了");
}

/**
 * 現在アクティブなスケジュールを取得
 */
async function getActiveSchedules() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await pool.query(`
      SELECT * FROM schedules
      WHERE active = TRUE
        AND (date_from IS NULL OR date_from <= $1::DATE)
        AND (date_to IS NULL OR date_to >= $1::DATE)
      ORDER BY id
    `, [today]);
    return result.rows;
  } catch (err) {
    console.error("スケジュール取得エラー:", err.message);
    return [];
  }
}

/**
 * 全スケジュールを取得（管理画面用）
 */
async function getAllSchedules() {
  try {
    const result = await pool.query(`SELECT * FROM schedules ORDER BY id`);
    return result.rows;
  } catch {
    return [];
  }
}

/**
 * スケジュールを作成/更新
 */
async function upsertSchedule(data) {
  const {
    id,
    name,
    active,
    dateFrom,
    dateTo,
    hourFrom,
    hourTo,
    intervalMinutes,
    recipients,
  } = data;

  if (id) {
    // 更新
    const result = await pool.query(`
      UPDATE schedules SET
        name = $1,
        active = $2,
        date_from = $3,
        date_to = $4,
        hour_from = $5,
        hour_to = $6,
        interval_minutes = $7,
        recipients = $8,
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `, [name, active, dateFrom || null, dateTo || null, hourFrom, hourTo, intervalMinutes, recipients || null, id]);
    return result.rows[0];
  } else {
    // 新規作成
    const result = await pool.query(`
      INSERT INTO schedules (name, active, date_from, date_to, hour_from, hour_to, interval_minutes, recipients)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [name, active, dateFrom || null, dateTo || null, hourFrom, hourTo, intervalMinutes, recipients || null]);
    return result.rows[0];
  }
}

/**
 * スケジュールを削除
 */
async function deleteSchedule(id) {
  await pool.query(`DELETE FROM schedules WHERE id = $1`, [id]);
}

/**
 * 現在の時刻が、指定スケジュールの通知タイミングか判定
 * @param {Object} schedule - DBのスケジュール行
 * @param {Date} now - 現在時刻
 */
function shouldNotify(schedule, now) {
  const hour = now.getHours();
  const minute = now.getMinutes();

  // 時間帯チェック
  if (hour < schedule.hour_from || hour >= schedule.hour_to) return false;

  // 間隔チェック
  const interval = schedule.interval_minutes;
  if (interval < 60) {
    // 分単位: 30分ごとなど
    if (minute % interval !== 0) return false;
  } else {
    // 時間単位: 60分以上は minute=0 かつ hour が interval/60 の倍数
    const intervalHours = interval / 60;
    if (minute !== 0) return false;
    if (hour % intervalHours !== 0) return false;
  }

  return true;
}

/**
 * 現在時刻に対して、通知すべきスケジュールと送信先を返す
 * @returns {Array<{schedule, recipients}>}
 */
async function getNotifiableNow() {
  const now = new Date();
  const schedules = await getActiveSchedules();
  const results = [];

  for (const schedule of schedules) {
    if (!shouldNotify(schedule, now)) continue;

    // 送信先の解決
    let recipients = [];
    if (schedule.recipients) {
      recipients = schedule.recipients.split(",").map((e) => e.trim()).filter(Boolean);
    } else {
      recipients = (process.env.TO_EMAILS || "")
        .split(",").map((e) => e.trim()).filter(Boolean);
    }

    if (recipients.length > 0) {
      results.push({ schedule, recipients });
    }
  }

  return results;
}

module.exports = {
  initScheduleTable,
  getActiveSchedules,
  getAllSchedules,
  upsertSchedule,
  deleteSchedule,
  shouldNotify,
  getNotifiableNow,
};
