/**
 * 우리 달력 — Google Sheets 백엔드 (Apps Script)
 *
 * 1) 아래 PASSWORD를 원하는 비밀번호로 바꾸세요. (아내분과 함께 쓸 비밀번호)
 * 2) 배포 → 새 배포 → 유형: 웹 앱
 *    - 실행 사용자: 나
 *    - 액세스 권한: 모든 사용자
 * 3) 나온 웹 앱 URL을 index.html의 API_URL에 붙여넣으세요.
 */
const PASSWORD = 'CHANGE-ME';

const SHEET_NAME = 'events';
const COLS = ['id','type','title','date','time','endTime','place','note','who','repeat','doneOn','createdAt','updatedAt'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // 날짜·시간이 자동 변환되지 않도록 전체를 텍스트 형식으로
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
    lock.releaseLock();
  }
}

/** 편집기에서 한 번 실행하면 시트가 만들어지고 권한 승인이 진행됩니다. */
function setup() {
  sheet_();
}
