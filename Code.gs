/**
 * 우리 달력 — Google Sheets 백엔드 (Apps Script)
 *
 * 1) 아래 PASSWORD를 원하는 비밀번호로 바꾸세요. (아내분과 함께 쓸 비밀번호)
 * 2) 배포 → 새 배포 → 유형: 웹 앱
 *    - 실행 사용자: 나
 *    - 액세스 권한: 모든 사용자
 * 3) 나온 웹 앱 URL을 index.html의 API_URL에 붙여넣으세요.
 *
 * 푸시 알림 (선택): OneSignal → Settings → Keys & IDs 에서 복사해 넣으세요.
 *    코드를 바꾼 뒤에는 배포 → 배포 관리 → ✏️ → 버전: 새 버전 → 배포
 *    (처음 한 번은 "외부 서비스 연결" 권한 승인이 나옵니다)
 */
const PASSWORD = 'CHANGE-ME';
const ONESIGNAL_APP_ID = '';     // 예: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
const ONESIGNAL_REST_KEY = '';   // 예: 'os_v2_app_...'  (절대 다른 곳에 공유하지 마세요)
const SITE_URL = 'https://leejumpyo1.github.io/calendar/';

const SHEET_NAME = 'events';
const COLS = ['id','type','title','date','time','endTime','place','note','who','repeat','doneOn','createdAt','updatedAt','by'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // 날짜·시간이 자동 변환되지 않도록 전체를 텍스트 형식으로
    sh.getRange(1, 1, sh.getMaxRows(), COLS.length).setNumberFormat('@');
  } else if (sh.getLastColumn() < COLS.length) {
    // 새 열(by 등)이 생기면 머리글 추가
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold');
    sh.getRange(1, 1, sh.getMaxRows(), COLS.length).setNumberFormat('@');
  }
  return sh;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function authOk_(key) {
  return PASSWORD && PASSWORD !== 'CHANGE-ME' && String(key || '') === PASSWORD;
}

function readAll_() {
  const sh = sheet_();
  const n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  const rows = sh.getRange(2, 1, n, COLS.length).getDisplayValues();
  return rows.filter(r => r[0]).map(r => {
    const o = {};
    COLS.forEach((c, i) => o[c] = r[i]);
    try { o.doneOn = o.doneOn ? JSON.parse(o.doneOn) : {}; } catch (e) { o.doneOn = {}; }
    o.createdAt = Number(o.createdAt) || 0;
    o.updatedAt = Number(o.updatedAt) || 0;
    return o;
  });
}

function rowOf_(ev) {
  return COLS.map(c => {
    if (c === 'doneOn') return JSON.stringify(ev.doneOn || {});
    const v = ev[c];
    return v === undefined || v === null ? '' : String(v).slice(0, 5000);
  });
}

function findRow_(sh, id) {
  const n = sh.getLastRow() - 1;
  if (n <= 0) return -1;
  const ids = sh.getRange(2, 1, n, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) if (ids[i][0] === id) return i + 2;
  return -1;
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!authOk_(p.key)) return out_({ ok: false, error: 'auth' });
  return out_({ ok: true, events: readAll_() });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad_request' }); }
  if (!authOk_(body.key)) return out_({ ok: false, error: 'auth' });

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = sheet_();
    if (body.action === 'save' && body.event && body.event.id) {
      const row = rowOf_(body.event);
      const r = findRow_(sh, String(body.event.id));
      if (r > 0) {
        sh.getRange(r, 1, 1, COLS.length).setNumberFormat('@').setValues([row]);
      } else {
        const nr = sh.getLastRow() + 1;
        sh.getRange(nr, 1, 1, COLS.length).setNumberFormat('@').setValues([row]);
        lock.releaseLock();
        notifyNew_(body.event);
      }
      return out_({ ok: true });
    }
    if (body.action === 'delete' && body.id) {
      const r = findRow_(sh, String(body.id));
      if (r > 0) sh.deleteRow(r);
      return out_({ ok: true });
    }
    return out_({ ok: false, error: 'unknown_action' });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/* ---------- 푸시 알림 ---------- */
const WHO_ = { alex: '알렉스', wang: '왕경' };
const TYPE_ = { task: '할 일', meet: '약속', note: '메모' };
const DOW_ = ['일', '월', '화', '수', '목', '금', '토'];

function fmtWhen_(ev) {
  const p = String(ev.date || '').split('-').map(Number);
  if (p.length !== 3) return '';
  const d = new Date(p[0], p[1] - 1, p[2]);
  let s = p[1] + '월 ' + p[2] + '일 (' + DOW_[d.getDay()] + ')';
  if (ev.time) {
    const t = String(ev.time).split(':').map(Number);
    const h = t[0], m = t[1] || 0;
    s += ' ' + (h < 12 ? '오전 ' : '오후 ') + (h % 12 === 0 ? 12 : h % 12) + (m ? ':' + ('0' + m).slice(-2) : '시');
  }
  return s;
}

/** 상대방에게 "새 일정" 푸시를 보냅니다. 실패해도 저장에는 영향 없음. */
function notifyNew_(ev) {
  try {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_KEY) return;
    const by = ev.by;
    if (!WHO_[by]) return;
    const to = by === 'alex' ? 'wang' : 'alex';
    const title = WHO_[by] + '님이 ' + (TYPE_[ev.type] || '일정') + '을(를) 추가했어요';
    const body = [fmtWhen_(ev), ev.title].filter(String).join(' · ') + (ev.place ? '\n📍 ' + ev.place : '');
    UrlFetchApp.fetch('https://api.onesignal.com/notifications', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Key ' + ONESIGNAL_REST_KEY },
      payload: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        target_channel: 'push',
        include_aliases: { external_id: [to] },
        headings: { en: title, ko: title },
        contents: { en: body, ko: body },
        url: SITE_URL
      }),
      muteHttpExceptions: true
    });
  } catch (e) {
    console.error(e);
  }
}

/** 편집기에서 실행해 보면 알림 연결을 시험할 수 있어요 (알렉스 → 왕경 방향). */
function testPush() {
  notifyNew_({ by: 'alex', type: 'meet', title: '테스트 알림', date: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'), time: '12:00' });
}

/** 편집기에서 한 번 실행하면 시트가 만들어지고 권한 승인이 진행됩니다. */
function setup() {
  sheet_();
}
