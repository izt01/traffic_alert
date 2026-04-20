/**
 * データベースモジュール (Railway PostgreSQL)
 * - 送信ログの保存・参照
 * - 受信者リストの管理
 */

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

/**
 * テーブルの初期化（初回起動時に自動作成）
 */
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS send_log (
        id SERIAL PRIMARY KEY,
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        recipient_count INTEGER,
        has_congestion BOOLEAN DEFAULT FALSE,
        summary TEXT,
        status TEXT DEFAULT 'success',
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS recipients (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("✅ DB初期化完了");
  } catch (err) {
    console.error("❌ DB初期化エラー:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 送信ログを記録
 */
async function logSend({ recipientCount, hasCongestion, summary, status = "success", errorMessage = null }) {
  try {
    await pool.query(
      `INSERT INTO send_log (recipient_count, has_congestion, summary, status, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [recipientCount, hasCongestion, summary, status, errorMessage]
    );
  } catch (err) {
    console.error("❌ ログ記録エラー:", err.message);
  }
}

/**
 * 直近の送信ログを取得
 */
async function getRecentLogs(limit = 10) {
  const result = await pool.query(
    `SELECT * FROM send_log ORDER BY sent_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * アクティブな受信者リストを取得
 * 環境変数 TO_EMAILS をベースにDBのリストとマージ
 */
async function getRecipients() {
  // 環境変数から取得（基本）
  const envEmails = (process.env.TO_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  try {
    const result = await pool.query(
      `SELECT email FROM recipients WHERE active = TRUE`
    );
    const dbEmails = result.rows.map((r) => r.email);

    // 重複排除してマージ
    const allEmails = [...new Set([...envEmails, ...dbEmails])];
    return allEmails;
  } catch {
    // DBが使えない場合は環境変数のみ
    return envEmails;
  }
}

module.exports = { initDB, logSend, getRecentLogs, getRecipients, pool };
