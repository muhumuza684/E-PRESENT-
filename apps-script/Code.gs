// E-Presence: QR attendance. Backend for Google Sheets + Apps Script.
// Tabs (created automatically):
//   Sessions:   session_id | name | pin | ask_regno | email | host_key | created_at | closes_at | is_open
//   Attendance: session_id | reg_no | name | device_id | time | status
const TZ = 'Africa/Kampala';
const SESSION_HOURS = 6;
const TABS_ = {
  Sessions: ['session_id', 'name', 'pin', 'ask_regno', 'email', 'host_key', 'created_at', 'closes_at', 'is_open'],
  Attendance: ['session_id', 'reg_no', 'name', 'device_id', 'time', 'status']
};

const sheet_ = n => SpreadsheetApp.getActive().getSheetByName(n);
const rows_ = n => sheet_(n).getDataRange().getValues().slice(1); // data row i = sheet row i+2
const isTrue_ = v => String(v).toUpperCase() === 'TRUE';
const same_ = (a, b) => String(a).trim() === String(b).trim();
const clean_ = (v, n) => String(v == null ? '' : v).trim().replace(/^[=+\-@]+/, '').slice(0, n);
const out_ = t => ContentService.createTextOutput(typeof t === 'string' ? t : JSON.stringify(t));
const fmt_ = (d, f) => Utilities.formatDate(new Date(d), TZ, f);
const setText_ = (sh, r, c, v) => sh.getRange(r, c).setNumberFormat('@').setValue(v);  // keeps leading zeros

function doGet(e) {
  try { ensureTabs_(); } catch (err) { return out_('E-Presence is running, but tabs could not be created: ' + err); }
  const id = e && e.parameter && e.parameter.s;
  if (id) {
    const s = session_(id);
    return out_(s && isOpen_(s) ? { open: true, name: s[1], ask_regno: isTrue_(s[3]) } : { open: false });
  }
  return out_('E-Presence is running');
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    ensureTabs_();
    const d = JSON.parse(e.postData.contents), a = d.action;
    if (a === 'start') return out_(start_(d));
    if (a === 'live') return out_(live_(d, false));
    if (a === 'list') return out_(live_(d, true));
    if (a === 'setpin') return out_(setpin_(d));
    if (a === 'end') return out_(end_(d));
    if (a === 'manual') return out_(manual_(d));
    if (a === 'email') return out_(email_(d));
    return out_(scan_(d));
  } catch (err) {
    return out_('ERROR');
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// Creates missing tabs, keeps the Sheet timezone equal to the script's, and moves tabs from the
// old version (different columns) aside instead of deleting them. Never erases data.
function ensureTabs_() {
  const cache = CacheService.getScriptCache();
  if (cache.get('tabs_v4')) return;
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(Session.getScriptTimeZone());
  Object.keys(TABS_).forEach(n => {
    let sh = ss.getSheetByName(n);
    if (sh && String(sh.getDataRange().getValues()[0][1] || '') !== TABS_[n][1]) {
      sh.setName('Old ' + n + ' ' + fmt_(new Date(), 'yyyyMMdd-HHmm'));
      sh = null;
    }
    if (!sh) {
      sh = ss.insertSheet(n);
      sh.getRange(1, 1, 1, TABS_[n].length).setValues([TABS_[n]]);
      sh.setFrozenRows(1);
    }
  });
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
  cache.put('tabs_v4', '1', 21600);
}

const session_ = id => rows_('Sessions').find(r => same_(r[0], id)) || null;
const isOpen_ = s => isTrue_(s[8]) && new Date() < new Date(s[7]);
function hostSession_(d) { const s = session_(d.session_id); return s && same_(s[5], d.host_key) ? s : null; }
const validPin_ = p => /^[A-Za-z0-9]{3,10}$/.test(p);
const validEmail_ = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Lecturer starts a session. No account: the server returns a private host key that only the
// lecturer's browser keeps, and that is needed to see the list, change the PIN or end the session.
function start_(d) {
  const name = clean_(d.name, 80), pin = String(d.pin || '').trim();
  if (!name) return 'MISSING_INFO';
  if (!validPin_(pin)) return 'BAD_PIN_FORMAT';
  const cache = CacheService.getScriptCache(), n = Number(cache.get('starts') || 0);
  if (n >= 200) return 'BUSY';
  cache.put('starts', String(n + 1), 3600);
  const email = validEmail_(String(d.email || '').trim()) ? String(d.email).trim() : '';
  const id = Utilities.getUuid().replace(/-/g, '').slice(0, 12), key = Utilities.getUuid();
  const now = new Date(), sh = sheet_('Sessions');
  sh.appendRow([id, name, pin, d.ask_regno !== false, email, key, now, new Date(now.getTime() + SESSION_HOURS * 3600000), true]);
  setText_(sh, sh.getLastRow(), 3, pin);
  return { session_id: id, host_key: key };
}

function scan_(d) {
  const s = session_(d.session_id);
  if (!s || !isOpen_(s)) return 'NO_OPEN_SESSION';

  const cache = CacheService.getScriptCache(), sk = 'bad:' + s[0], dk = 'baddev:' + d.device_id;
  if (Number(cache.get(sk) || 0) >= 60 || Number(cache.get(dk) || 0) >= 5) return 'TOO_MANY';
  if (String(d.pin || '').trim().toLowerCase() !== String(s[2]).trim().toLowerCase()) {
    cache.put(sk, String(Number(cache.get(sk) || 0) + 1), 300);
    cache.put(dk, String(Number(cache.get(dk) || 0) + 1), 600);
    return 'BAD_PIN';
  }

  const askReg = isTrue_(s[3]);
  const name = clean_(d.name, 60), reg = askReg ? clean_(d.reg_no, 40) : '';
  if (!name || (askReg && !reg)) return 'MISSING_INFO';
  const key = (askReg ? reg : name).toLowerCase();

  const sh = sheet_('Attendance'), all = rows_('Attendance');
  if (all.some(r => r[0] === s[0] && String(askReg ? r[1] : r[2]).trim().toLowerCase() === key)) return 'ALREADY_MARKED';

  let status = 'PRESENT';
  all.forEach((r, i) => {            // two people on one phone: flag both for the lecturer to check
    if (r[0] === s[0] && r[3] === d.device_id && r[3] !== 'MANUAL') { sh.getRange(i + 2, 6).setValue('FLAGGED'); status = 'FLAGGED'; }
  });
  sh.appendRow([s[0], reg, name, d.device_id, new Date(), status]);
  if (reg) setText_(sh, sh.getLastRow(), 2, reg);
  return status === 'PRESENT' ? 'OK' : 'OK_FLAGGED';
}

function live_(d, withRows) {
  const s = hostSession_(d);
  if (!s) return 'BAD_SESSION';
  const att = rows_('Attendance').filter(r => r[0] === s[0]);
  const o = { name: s[1], pin: String(s[2]), ask_regno: isTrue_(s[3]), open: isOpen_(s), date: fmt_(s[6], 'yyyy-MM-dd'),
    count: att.length, flagged: att.filter(r => r[5] === 'FLAGGED').length };
  if (withRows) o.rows = att.map(r => ({ reg: String(r[1]), name: String(r[2]), time: fmt_(r[4], 'HH:mm'), status: r[5] }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return o;
}

function setpin_(d) {
  const s = hostSession_(d), pin = String(d.pin || '').trim();
  if (!s) return 'BAD_SESSION';
  if (!validPin_(pin)) return 'BAD_PIN_FORMAT';
  setText_(sheet_('Sessions'), rows_('Sessions').findIndex(r => r[0] === s[0]) + 2, 3, pin);
  return 'OK';
}

function end_(d) {
  const s = hostSession_(d);
  if (!s) return 'BAD_SESSION';
  sheet_('Sessions').getRange(rows_('Sessions').findIndex(r => r[0] === s[0]) + 2, 9).setValue(false);
  return 'OK';
}

// Add people who have no phone. Accepts rows pasted from Google Sheets (tab or comma separated):
// "Reg No <tab> Name" or "Name <tab> Reg No" or just a name. A cell with a digit and no spaces is the Reg No.
function manual_(d) {
  const s = hostSession_(d);
  if (!s) return 'BAD_SESSION';
  const sh = sheet_('Attendance'), all = rows_('Attendance').filter(r => r[0] === s[0]);
  const askReg = isTrue_(s[3]);
  let n = 0;
  (d.lines || []).forEach(line => {
    const cells = String(line).split(/\t|,/).map(c => clean_(c, 60)).filter(Boolean);
    if (!cells.length) return;
    let reg = '', name = cells[0];
    if (cells.length >= 2) {
      const isReg = c => /\d/.test(c) && !/\s/.test(c);
      if (isReg(cells[0]) && !isReg(cells[1])) { reg = cells[0]; name = cells[1]; }
      else if (isReg(cells[1]) && !isReg(cells[0])) { reg = cells[1]; name = cells[0]; }
      else { reg = cells[0]; name = cells[1]; }
    }
    const key = (askReg && reg ? reg : name).toLowerCase();
    if (all.some(r => String(askReg && reg ? r[1] : r[2]).trim().toLowerCase() === key)) return;
    sh.appendRow([s[0], reg, name, 'MANUAL', new Date(), 'MANUAL']);
    if (reg) setText_(sh, sh.getLastRow(), 2, reg);
    all.push([s[0], reg, name]);
    n++;
  });
  return 'ADDED:' + n;
}

function email_(d) {
  const s = hostSession_(d);
  if (!s) return 'BAD_SESSION';
  const to = validEmail_(String(d.email || '').trim()) ? String(d.email).trim() : String(s[4]).trim();
  if (!to) return 'NO_EMAIL';
  const rows = live_(d, true).rows, hasReg = rows.some(r => r.reg);
  const q = v => { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const head = hasReg ? ['Reg No', 'Name', 'Time', 'Status'] : ['Name', 'Time', 'Status'];
  const csv = [head].concat(rows.map(r => hasReg ? [r.reg, r.name, r.time, r.status] : [r.name, r.time, r.status]))
    .map(r => r.map(q).join(',')).join('\n');
  const date = fmt_(s[6], 'yyyy-MM-dd');
  MailApp.sendEmail(to, 'Attendance: ' + s[1] + ' (' + date + ')', rows.length + ' signed in. List attached.',
    { attachments: [Utilities.newBlob(csv, 'text/csv', String(s[1]).replace(/[^\w\- ]+/g, '') + '-' + date + '.csv')] });
  return 'SENT';
}

// Kept for the Apps Script editor: creates any missing tabs (never erases data).
function setupSheets() { ensureTabs_(); }
