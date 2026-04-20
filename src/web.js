/**
 * スマホ対応 管理Web UI (Express)
 * - メールアドレス登録/削除
 * - 通知スケジュール設定（日程・時間帯・間隔）
 * - 送信ログ確認
 * - ADMIN_PASSWORD 環境変数でBasic認証
 */

const express = require("express");
const { getAllSchedules, upsertSchedule, deleteSchedule } = require("./scheduler");
const { getRecentLogs, pool } = require("./db");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── 簡易Basic認証 ────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return next();
  const auth = req.headers.authorization || "";
  const [, encoded] = auth.split(" ");
  if (!encoded) {
    res.set("WWW-Authenticate", 'Basic realm="Traffic Admin"');
    return res.status(401).send("認証が必要です");
  }
  const decoded = Buffer.from(encoded, "base64").toString();
  const pass = decoded.slice(decoded.indexOf(":") + 1);
  if (pass !== pw) {
    res.set("WWW-Authenticate", 'Basic realm="Traffic Admin"');
    return res.status(401).send("パスワードが違います");
  }
  next();
});

// ── HTML管理画面 ─────────────────────────────────
app.get("/", async (req, res) => {
  const schedules = await getAllSchedules().catch(() => []);
  const logs = await getRecentLogs(10).catch(() => []);

  // recipients テーブルから登録メール一覧
  let recipients = [];
  try {
    const r = await pool.query("SELECT * FROM recipients ORDER BY created_at DESC");
    recipients = r.rows;
  } catch {}

  const fmtDate = (d) => d ? String(d).slice(0, 10) : "—";
  const fmtTime = (h) => `${String(h).padStart(2,"0")}:00`;

  res.send(`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>渋滞情報通知 管理</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Oswald:wght@500;700&display=swap" rel="stylesheet">
<style>
:root {
  --navy: #0a1628;
  --navy2: #122040;
  --navy3: #1c2f55;
  --green: #00c853;
  --green2: #00a846;
  --amber: #ffab00;
  --red: #ff3d3d;
  --white: #f0f4ff;
  --muted: #7a8aaa;
  --border: rgba(255,255,255,0.08);
  --card: rgba(255,255,255,0.04);
  --r: 14px;
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html{background:var(--navy);color:var(--white);font-family:'BIZ UDPGothic',sans-serif;font-size:16px}
body{min-height:100vh;padding-bottom:100px}

/* ── HEADER ── */
.hdr{
  background:linear-gradient(160deg,var(--navy2) 0%,#0d1e3d 100%);
  padding:20px 20px 16px;
  border-bottom:1px solid var(--border);
  position:sticky;top:0;z-index:50;
  backdrop-filter:blur(10px);
}
.hdr-top{display:flex;align-items:center;gap:12px}
.hdr-icon{
  width:42px;height:42px;border-radius:10px;
  background:linear-gradient(135deg,var(--green),#00875a);
  display:flex;align-items:center;justify-content:center;
  font-size:22px;flex-shrink:0;
  box-shadow:0 4px 14px rgba(0,200,83,0.3);
}
.hdr-title{font-family:'Oswald',sans-serif;font-size:18px;letter-spacing:.04em;line-height:1.2}
.hdr-sub{font-size:11px;color:var(--muted);margin-top:2px}

/* STATUS PILLS */
.status-row{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
.pill{
  display:inline-flex;align-items:center;gap:6px;
  padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;
  background:rgba(255,255,255,0.06);border:1px solid var(--border);
}
.pill-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.pill-green .pill-dot{background:var(--green);box-shadow:0 0 6px var(--green)}
.pill-amber .pill-dot{background:var(--amber)}

/* ── TABS ── */
.tabs{
  display:flex;background:var(--navy2);
  border-bottom:1px solid var(--border);
  overflow-x:auto;scrollbar-width:none;
}
.tabs::-webkit-scrollbar{display:none}
.tab{
  flex:1;min-width:80px;padding:14px 8px;text-align:center;
  font-size:13px;font-weight:700;color:var(--muted);
  cursor:pointer;border:none;background:none;
  border-bottom:2px solid transparent;transition:.2s;white-space:nowrap;
}
.tab.active{color:var(--green);border-bottom-color:var(--green)}

/* ── SECTIONS ── */
.section{display:none;padding:20px 16px}
.section.active{display:block}

/* ── CARDS ── */
.card{
  background:var(--card);border:1px solid var(--border);
  border-radius:var(--r);padding:18px;margin-bottom:14px;
  position:relative;overflow:hidden;
}
.card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,var(--green),transparent);
  opacity:0;transition:.2s;
}
.card:focus-within::before{opacity:1}

.card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
.card-title{font-size:15px;font-weight:700;line-height:1.3}
.card-sub{font-size:12px;color:var(--muted);margin-top:3px}

/* ── FORM ELEMENTS ── */
.form-group{margin-bottom:16px}
label{display:block;font-size:11px;font-weight:700;color:var(--muted);
  text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px}
input[type=text],input[type=email],input[type=date],input[type=number],select,textarea{
  width:100%;background:rgba(255,255,255,0.06);
  border:1.5px solid rgba(255,255,255,0.12);
  border-radius:10px;padding:13px 14px;
  color:var(--white);font-size:16px;font-family:inherit;
  -webkit-appearance:none;appearance:none;
  transition:border-color .2s;
}
input:focus,select:focus,textarea:focus{
  outline:none;border-color:var(--green);
  background:rgba(0,200,83,0.06);
}
select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237a8aaa' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 14px center;
  padding-right:36px;}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}

/* Toggle Switch */
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:4px 0}
.toggle-label{font-size:14px;font-weight:700}
.toggle-sub{font-size:12px;color:var(--muted);margin-top:2px}
.toggle{position:relative;width:52px;height:28px;flex-shrink:0}
.toggle input{opacity:0;width:0;height:0}
.toggle-track{
  position:absolute;inset:0;border-radius:14px;
  background:rgba(255,255,255,0.12);cursor:pointer;transition:.25s;
}
.toggle input:checked + .toggle-track{background:var(--green)}
.toggle-track::after{
  content:'';position:absolute;
  top:4px;left:4px;width:20px;height:20px;
  border-radius:50%;background:white;
  transition:.25s;box-shadow:0 2px 6px rgba(0,0,0,0.3);
}
.toggle input:checked + .toggle-track::after{transform:translateX(24px)}

/* ── BUTTONS ── */
.btn{
  display:flex;align-items:center;justify-content:center;gap:8px;
  padding:15px 20px;border-radius:12px;font-size:15px;font-weight:700;
  font-family:inherit;border:none;cursor:pointer;width:100%;
  transition:all .18s;-webkit-appearance:none;
}
.btn-primary{background:linear-gradient(135deg,var(--green),var(--green2));color:#000;
  box-shadow:0 4px 16px rgba(0,200,83,0.3)}
.btn-primary:active{transform:scale(.97)}
.btn-ghost{background:rgba(255,255,255,0.06);color:var(--white);border:1.5px solid var(--border)}
.btn-danger{background:rgba(255,61,61,0.12);color:var(--red);border:1.5px solid rgba(255,61,61,0.2)}
.btn-sm{padding:9px 16px;font-size:13px;border-radius:9px;width:auto}

/* ── SCHEDULE CARDS ── */
.sched-card{
  background:var(--card);border:1px solid var(--border);
  border-radius:var(--r);padding:16px;margin-bottom:12px;
}
.sched-card.inactive{opacity:.45}
.sched-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.sched-name{font-size:15px;font-weight:700}
.sched-actions{display:flex;gap:8px}
.sched-meta{display:flex;flex-wrap:wrap;gap:8px}
.meta-chip{
  display:inline-flex;align-items:center;gap:5px;
  padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;
  background:rgba(255,255,255,0.07);border:1px solid var(--border);
}
.chip-green{background:rgba(0,200,83,0.12);border-color:rgba(0,200,83,0.2);color:var(--green)}
.chip-amber{background:rgba(255,171,0,0.12);border-color:rgba(255,171,0,0.2);color:var(--amber)}

/* ── EMAIL LIST ── */
.email-item{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 0;border-bottom:1px solid var(--border);gap:12px;
}
.email-item:last-child{border-bottom:none}
.email-addr{font-size:14px;word-break:break-all;flex:1}
.email-name{font-size:11px;color:var(--muted);margin-top:2px}
.btn-icon{
  width:36px;height:36px;border-radius:9px;
  background:rgba(255,61,61,0.1);border:1px solid rgba(255,61,61,0.2);
  color:var(--red);font-size:18px;display:flex;align-items:center;
  justify-content:center;cursor:pointer;flex-shrink:0;
}

/* ── LOG LIST ── */
.log-item{
  padding:12px 0;border-bottom:1px solid var(--border);
  display:flex;align-items:flex-start;gap:12px;
}
.log-item:last-child{border-bottom:none}
.log-dot{
  width:10px;height:10px;border-radius:50%;margin-top:5px;flex-shrink:0;
}
.log-ok .log-dot{background:var(--green)}
.log-err .log-dot{background:var(--red)}
.log-time{font-size:12px;color:var(--muted)}
.log-summary{font-size:13px;margin-top:3px;line-height:1.5}

/* ── DRAWER (modal) ── */
.drawer-bg{
  display:none;position:fixed;inset:0;
  background:rgba(0,0,0,0.65);z-index:200;
  backdrop-filter:blur(3px);
}
.drawer-bg.open{display:flex;align-items:flex-end}
.drawer{
  background:var(--navy2);width:100%;
  border-radius:20px 20px 0 0;
  max-height:92vh;overflow-y:auto;
  padding:0 20px 40px;
  animation:slideUp .25s ease;
}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.drawer-handle{
  width:40px;height:4px;border-radius:2px;
  background:rgba(255,255,255,0.2);
  margin:12px auto 20px;
}
.drawer-title{font-family:'Oswald',sans-serif;font-size:20px;margin-bottom:20px}

/* ── EMPTY STATE ── */
.empty{text-align:center;padding:48px 20px;color:var(--muted)}
.empty-icon{font-size:48px;margin-bottom:12px}
.empty-text{font-size:14px}

/* ── TOAST ── */
.toast{
  position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);
  background:var(--navy3);color:var(--white);
  padding:12px 24px;border-radius:12px;font-size:14px;font-weight:700;
  box-shadow:0 8px 32px rgba(0,0,0,0.4);opacity:0;
  transition:all .3s;z-index:999;white-space:nowrap;
  border:1px solid var(--border);
}
.toast.show{transform:translateX(-50%) translateY(0);opacity:1}
.toast.ok{border-color:rgba(0,200,83,0.4);color:var(--green)}
.toast.err{border-color:rgba(255,61,61,0.4);color:var(--red)}

/* ── FAB ── */
.fab{
  position:fixed;bottom:28px;right:20px;z-index:100;
  width:58px;height:58px;border-radius:18px;
  background:linear-gradient(135deg,var(--green),var(--green2));
  color:#000;font-size:28px;font-weight:700;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 6px 24px rgba(0,200,83,0.4);
  cursor:pointer;border:none;
  transition:transform .18s;
}
.fab:active{transform:scale(.93)}

/* PC対応 */
@media(min-width:640px){
  .hdr{padding:24px 32px 18px}
  .section{padding:28px 32px;max-width:700px;margin:0 auto}
  .tabs{justify-content:center}
  .tab{flex:none;padding:14px 24px;min-width:120px}
}
</style>
</head>
<body>

<!-- ── HEADER ── -->
<div class="hdr">
  <div class="hdr-top">
    <div class="hdr-icon">🚗</div>
    <div>
      <div class="hdr-title">渋滞情報 通知管理</div>
      <div class="hdr-sub">東名・中央道・圏央道</div>
    </div>
  </div>
  <div class="status-row">
    <div class="pill pill-green"><span class="pill-dot"></span>HERE API 接続中</div>
    <div class="pill pill-amber"><span class="pill-dot"></span>スケジュール ${schedules.filter(s=>s.active).length}件 有効</div>
  </div>
</div>

<!-- ── TABS ── -->
<div class="tabs">
  <button class="tab active" onclick="showTab('schedules',this)">📅 スケジュール</button>
  <button class="tab" onclick="showTab('emails',this)">📧 メール</button>
  <button class="tab" onclick="showTab('logs',this)">📋 ログ</button>
</div>

<!-- ═══════════════════════════════════
     TAB 1: スケジュール
═══════════════════════════════════ -->
<div id="tab-schedules" class="section active">
  <div style="margin-bottom:16px">
    <div style="font-size:12px;color:var(--muted);line-height:1.6">
      通知したい日程・時間帯・間隔を設定します。<br>
      複数のスケジュールを並行して設定できます。
    </div>
  </div>

  <div id="sched-list">
    ${schedules.length === 0 ? `
      <div class="empty">
        <div class="empty-icon">📭</div>
        <div class="empty-text">スケジュールがありません<br>右下の ＋ から追加してください</div>
      </div>
    ` : schedules.map(s => `
      <div class="sched-card ${s.active ? "" : "inactive"}" id="scard-${s.id}">
        <div class="sched-top">
          <div>
            <div class="sched-name">${esc(s.name)}</div>
          </div>
          <div class="sched-actions">
            <button class="btn btn-ghost btn-sm" onclick="openSchedDrawer(${s.id})">編集</button>
            <button class="btn btn-danger btn-sm" onclick="deleteSched(${s.id})">削除</button>
          </div>
        </div>
        <div class="sched-meta">
          ${s.active
            ? '<span class="meta-chip chip-green">✓ 有効</span>'
            : '<span class="meta-chip">✗ 無効</span>'}
          <span class="meta-chip">${fmtDate(s.date_from)} 〜 ${fmtDate(s.date_to)}</span>
          <span class="meta-chip">⏰ ${fmtTime(s.hour_from)} 〜 ${fmtTime(s.hour_to)}</span>
          <span class="meta-chip chip-amber">🔔 ${s.interval_minutes}分ごと</span>
        </div>
        ${s.recipients ? `<div style="font-size:12px;color:var(--muted);margin-top:8px">📧 ${esc(s.recipients)}</div>` : ""}
      </div>
    `).join("")}
  </div>
</div>

<!-- ═══════════════════════════════════
     TAB 2: メール受信者
═══════════════════════════════════ -->
<div id="tab-emails" class="section">
  <div class="card" style="margin-bottom:20px">
    <div class="card-title" style="margin-bottom:14px">➕ メールアドレスを追加</div>
    <div class="form-group">
      <label>メールアドレス</label>
      <input type="email" id="add-email" placeholder="you@example.com" autocomplete="email">
    </div>
    <div class="form-group">
      <label>名前（任意）</label>
      <input type="text" id="add-name" placeholder="例: 田中">
    </div>
    <button class="btn btn-primary" onclick="addEmail()">追加する</button>
  </div>

  <div style="font-size:13px;font-weight:700;color:var(--muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:.06em">
    登録済み (${recipients.length}件)
  </div>
  <div class="card">
    ${recipients.length === 0 ? `
      <div class="empty" style="padding:32px 0">
        <div class="empty-icon" style="font-size:36px">📭</div>
        <div class="empty-text">登録者なし</div>
      </div>
    ` : recipients.map(r => `
      <div class="email-item" id="eitem-${r.id}">
        <div style="flex:1">
          <div class="email-addr">${esc(r.email)}</div>
          ${r.name ? `<div class="email-name">${esc(r.name)}</div>` : ""}
        </div>
        <button class="btn-icon" onclick="removeEmail(${r.id})">×</button>
      </div>
    `).join("")}
  </div>
</div>

<!-- ═══════════════════════════════════
     TAB 3: 送信ログ
═══════════════════════════════════ -->
<div id="tab-logs" class="section">
  <div class="card">
    ${logs.length === 0 ? `
      <div class="empty" style="padding:32px 0">
        <div class="empty-icon" style="font-size:36px">📋</div>
        <div class="empty-text">まだ送信履歴がありません</div>
      </div>
    ` : logs.map(l => {
      const ok = l.status === "success";
      const t = new Date(l.sent_at).toLocaleString("ja-JP", {timeZone:"Asia/Tokyo", month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
      return `
        <div class="log-item ${ok ? "log-ok" : "log-err"}">
          <div class="log-dot"></div>
          <div style="flex:1">
            <div class="log-time">${t} ／ ${l.recipient_count || 0}名に送信</div>
            <div class="log-summary">
              ${l.has_congestion ? "⚠️ 渋滞あり" : "✅ 渋滞なし"} — ${esc(l.summary || "")}
            </div>
            ${!ok && l.error_message ? `<div style="font-size:11px;color:var(--red);margin-top:3px">${esc(l.error_message)}</div>` : ""}
          </div>
        </div>
      `;
    }).join("")}
  </div>
</div>

<!-- ── FAB ── -->
<button class="fab" id="fab" onclick="openSchedDrawer(null)" title="スケジュール追加">＋</button>

<!-- ═══════════════════════════════════
     DRAWER: スケジュール編集
═══════════════════════════════════ -->
<div class="drawer-bg" id="drawer-bg" onclick="closeDrawer(event)">
  <div class="drawer" id="drawer">
    <div class="drawer-handle"></div>
    <div class="drawer-title" id="drawer-title">スケジュール追加</div>

    <form id="sched-form" onsubmit="saveSched(event)">
      <input type="hidden" id="f-id">

      <div class="form-group">
        <label>スケジュール名 *</label>
        <input type="text" id="f-name" placeholder="例: GW渋滞チェック" required>
      </div>

      <div class="row2">
        <div class="form-group">
          <label>開始日</label>
          <input type="date" id="f-date-from">
        </div>
        <div class="form-group">
          <label>終了日</label>
          <input type="date" id="f-date-to">
        </div>
      </div>

      <div class="row2">
        <div class="form-group">
          <label>通知開始 時刻</label>
          <select id="f-hour-from">
            ${[...Array(24)].map((_,h) => `<option value="${h}" ${h===7?"selected":""}>${String(h).padStart(2,"0")}:00</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>通知終了 時刻</label>
          <select id="f-hour-to">
            ${[...Array(24)].map((_,h) => `<option value="${h}" ${h===22?"selected":""}>${String(h).padStart(2,"0")}:00</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>通知間隔</label>
        <select id="f-interval">
          <option value="30">30分ごと</option>
          <option value="60">1時間ごと</option>
          <option value="120">2時間ごと</option>
        </select>
      </div>

      <div class="form-group">
        <label>送信先メール（空欄＝「メール」タブの登録者全員）</label>
        <input type="text" id="f-recipients" placeholder="個別指定する場合: a@b.com, c@d.com">
      </div>

      <div class="form-group">
        <div class="toggle-row">
          <div>
            <div class="toggle-label">スケジュールを有効にする</div>
            <div class="toggle-sub">OFFにすると通知が止まります</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="f-active" checked>
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>

      <div style="display:flex;gap:12px;margin-top:8px">
        <button type="button" class="btn btn-ghost" onclick="closeDrawerDirect()">キャンセル</button>
        <button type="submit" class="btn btn-primary">💾 保存する</button>
      </div>
    </form>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
// ── タブ切り替え ──
function showTab(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
  // FABはスケジュールタブのみ表示
  document.getElementById('fab').style.display = id === 'schedules' ? '' : 'none';
}

// ── ドロワー ──
let currentSchedData = null;
const allSchedules = ${JSON.stringify(schedules)};

function openSchedDrawer(id) {
  const data = id ? allSchedules.find(s => s.id === id) : null;
  currentSchedData = data;
  document.getElementById('drawer-title').textContent = data ? 'スケジュール編集' : 'スケジュール追加';

  // フォームリセット
  document.getElementById('sched-form').reset();
  document.getElementById('f-id').value = '';

  if (data) {
    document.getElementById('f-id').value = data.id;
    document.getElementById('f-name').value = data.name || '';
    document.getElementById('f-date-from').value = data.date_from ? String(data.date_from).slice(0,10) : '';
    document.getElementById('f-date-to').value = data.date_to ? String(data.date_to).slice(0,10) : '';
    document.getElementById('f-hour-from').value = data.hour_from ?? 7;
    document.getElementById('f-hour-to').value = data.hour_to ?? 22;
    document.getElementById('f-interval').value = data.interval_minutes ?? 30;
    document.getElementById('f-recipients').value = data.recipients || '';
    document.getElementById('f-active').checked = data.active !== false;
  }
  document.getElementById('drawer-bg').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer(e) {
  if (e.target === document.getElementById('drawer-bg')) closeDrawerDirect();
}
function closeDrawerDirect() {
  document.getElementById('drawer-bg').classList.remove('open');
  document.body.style.overflow = '';
}

// ── スケジュール保存 ──
async function saveSched(e) {
  e.preventDefault();
  const body = {
    id: document.getElementById('f-id').value ? Number(document.getElementById('f-id').value) : undefined,
    name: document.getElementById('f-name').value,
    dateFrom: document.getElementById('f-date-from').value || null,
    dateTo: document.getElementById('f-date-to').value || null,
    hourFrom: Number(document.getElementById('f-hour-from').value),
    hourTo: Number(document.getElementById('f-hour-to').value),
    intervalMinutes: Number(document.getElementById('f-interval').value),
    recipients: document.getElementById('f-recipients').value.trim() || null,
    active: document.getElementById('f-active').checked,
  };
  const res = await fetch('/api/schedules', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body),
  });
  if (res.ok) { toast('保存しました ✓', 'ok'); closeDrawerDirect(); setTimeout(() => location.reload(), 700); }
  else toast('保存に失敗しました', 'err');
}

// ── スケジュール削除 ──
async function deleteSched(id) {
  if (!confirm('このスケジュールを削除しますか？')) return;
  const res = await fetch('/api/schedules/' + id, { method: 'DELETE' });
  if (res.ok) {
    document.getElementById('scard-' + id)?.remove();
    toast('削除しました', 'ok');
  } else toast('削除に失敗しました', 'err');
}

// ── メール追加 ──
async function addEmail() {
  const email = document.getElementById('add-email').value.trim();
  const name = document.getElementById('add-name').value.trim();
  if (!email) { toast('メールアドレスを入力してください', 'err'); return; }
  const res = await fetch('/api/recipients', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ email, name }),
  });
  if (res.ok) { toast('追加しました ✓', 'ok'); setTimeout(() => location.reload(), 700); }
  else {
    const d = await res.json().catch(() => ({}));
    toast(d.error || '追加に失敗しました', 'err');
  }
}

// ── メール削除 ──
async function removeEmail(id) {
  if (!confirm('このメールアドレスを削除しますか？')) return;
  const res = await fetch('/api/recipients/' + id, { method: 'DELETE' });
  if (res.ok) { document.getElementById('eitem-' + id)?.remove(); toast('削除しました', 'ok'); }
  else toast('削除に失敗しました', 'err');
}

// ── Toast ──
function toast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (type || '');
  setTimeout(() => t.className = 'toast', 2500);
}
</script>
</body>
</html>`);
});

// ── REST API ──────────────────────────────────────

// スケジュール一覧
app.get("/api/schedules", async (req, res) => {
  res.json(await getAllSchedules().catch(() => []));
});

// スケジュール作成/更新
app.post("/api/schedules", async (req, res) => {
  try { res.json(await upsertSchedule(req.body)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// スケジュール削除
app.delete("/api/schedules/:id", async (req, res) => {
  try { await deleteSchedule(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// 受信者一覧
app.get("/api/recipients", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM recipients ORDER BY created_at DESC");
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 受信者追加
app.post("/api/recipients", async (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: "email required" });
  try {
    const r = await pool.query(
      "INSERT INTO recipients (email, name) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET active=TRUE, name=COALESCE($2,recipients.name) RETURNING *",
      [email.trim(), name?.trim() || null]
    );
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 受信者削除
app.delete("/api/recipients/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM recipients WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// テスト送信（ブラウザから即テストできるエンドポイント）
app.get("/api/test-send", async (req, res) => {
  try {
    const { ROUTES } = require("../config/routes");
    const { fetchAllTraffic } = require("./traffic");
    const { sendTrafficEmail } = require("./mailer");
    const { getRecipients, logSend } = require("./db");

    // 送信先取得
    const recipients = await getRecipients();
    if (recipients.length === 0) {
      return res.json({ ok: false, message: "送信先メールアドレスが登録されていません。管理画面の「メール」タブから登録してください。" });
    }

    // 交通情報取得
    const trafficData = await fetchAllTraffic(ROUTES);

    // メール送信
    const result = await sendTrafficEmail(recipients, trafficData);

    await logSend({
      recipientCount: recipients.length,
      hasCongestion: trafficData.some(r => r.hasCongestion),
      summary: "[テスト送信] " + trafficData.map(r => `${r.routeName}:${r.hasCongestion ? "渋滞あり" : "なし"}`).join(" / "),
      status: result.success ? "success" : "mail_error",
      errorMessage: result.error || null,
    });

    if (result.success) {
      res.json({ ok: true, message: `✅ 送信成功！${recipients.join(", ")} に送りました。メールを確認してください。` });
    } else {
      res.json({ ok: false, message: `❌ 送信失敗: ${result.error}` });
    }
  } catch (err) {
    res.status(500).json({ ok: false, message: `❌ エラー: ${err.message}` });
  }
});

// ヘルスチェック
app.get("/health", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function startWebServer() {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`🌐 管理画面: http://localhost:${port}`));
}

module.exports = { startWebServer };
