// E-Presence: QR attendance. Backend for Google Sheets + Apps Script.
// A lecturer creates a CLASS once (it gets a QR code that never changes, so it can be printed),
// then starts and ends SESSIONS under it. Tabs are created automatically:
//   Classes:    class_id | name | ask_regno | email | host_key | created_at
//   Sessions:   session_id | name | pin | ask_regno | email | host_key | created_at | closes_at | is_open | class_id
//   Attendance: session_id | reg_no | name | device_id | time | status
const TZ = 'Africa/Kampala';
const SESSION_HOURS = 6;
const TABS_ = {
  Classes: ['class_id', 'name', 'ask_regno', 'email', 'host_key', 'created_at', 'uni', 'logo', 'welcome', 'color'],
  Sessions: ['session_id', 'name', 'pin', 'ask_regno', 'email', 'host_key', 'created_at', 'closes_at', 'is_open', 'class_id'],
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
const validPin_ = p => /^[A-Za-z0-9]{3,10}$/.test(p);
const validEmail_ = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const newId_ = n => Utilities.getUuid().replace(/-/g, '').slice(0, n);

function doGet(e) {
  try { ensureTabs_(); } catch (err) { return out_('E-Presence is running, but tabs could not be created: ' + err); }
  const p = (e && e.parameter) || {};
  if (p['class']) {                            // permanent class QR (note: Google reserves ?c=, so we use ?class=)
    const c = class_(p['class']);
    if (!c) return out_({ open: false });
    const s = openOf_(c[0]);
    return out_({ open: !!s, name: c[1], title: s && String(s[1]).indexOf(c[1] + ' - ') === 0 ? String(s[1]).slice(c[1].length + 3) : '', ask_regno: isTrue_(c[2]),
      uni: String(c[6] || ''), logo: String(c[7] || ''), welcome: String(c[8] || ''), color: String(c[9] || '') });
  }
  if (p.s) {                                   // one-time session QR
    const s = session_(p.s);
    return out_(s ? { open: isOpen_(s), name: s[1], title: '', ask_regno: isTrue_(s[3]) } : { open: false });
  }
  return out_('E-Presence is running');
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    ensureTabs_();
    const d = JSON.parse(e.postData.contents), a = d.action;
    if (a === 'newclass') return out_(newclass_(d));
    if (a === 'brand') return out_(brand_(d));
    if (a === 'start') return out_(start_(d));
    if (a === 'live') return out_(live_(d));
    if (a === 'list') return out_(list_(d));
    if (a === 'semester') return out_(semester_(d));
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
  if (cache.get('tabs_v6')) return;
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
  const ses = ss.getSheetByName('Sessions');   // Sheets from the previous version have no class_id column
  if (!String(ses.getDataRange().getValues()[0][9] || '').trim()) ses.getRange(1, 10).setValue('class_id');
  const cl = ss.getSheetByName('Classes');      // branding columns added in v4
  if (!String(cl.getDataRange().getValues()[0][6] || '').trim()) cl.getRange(1, 7, 1, 4).setValues([['uni', 'logo', 'welcome', 'color']]);
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
  cache.put('tabs_v6', '1', 21600);
}

const class_ = id => rows_('Classes').find(r => same_(r[0], id)) || null;
const session_ = id => rows_('Sessions').find(r => same_(r[0], id)) || null;
const isOpen_ = s => isTrue_(s[8]) && new Date() < new Date(s[7]);
function hostClass_(d) { const c = class_(d.class_id); return c && same_(c[4], d.host_key) ? c : null; }
const sessionsOf_ = cid => rows_('Sessions').filter(r => same_(r[9], cid));
function openOf_(cid) {
  const all = sessionsOf_(cid);
  for (let i = all.length - 1; i >= 0; i--) if (isOpen_(all[i])) return all[i];
  return null;
}
// The session the lecturer means: the one asked for (if it is theirs), else the open one, else the newest.
function pick_(c, sid) {
  const all = sessionsOf_(c[0]);
  return all.find(r => sid && same_(r[0], sid)) || openOf_(c[0]) || all[all.length - 1] || null;
}

// Lecturer creates a class. No account: the server returns a private key that only the lecturer's
// browser keeps, and that is needed to start sessions, see lists, change the PIN or end a session.
function newclass_(d) {
  const name = clean_(d.name, 60);
  if (!name) return 'MISSING_INFO';
  const cache = CacheService.getScriptCache(), n = Number(cache.get('starts') || 0);
  if (n >= 200) return 'BUSY';
  cache.put('starts', String(n + 1), 3600);
  const email = validEmail_(String(d.email || '').trim()) ? String(d.email).trim() : '';
  const id = newId_(10), key = Utilities.getUuid();
  sheet_('Classes').appendRow([id, name, d.ask_regno !== false, email, key, new Date(), '', '', '', '']);
  brand_(Object.assign({}, d, { class_id: id, host_key: key }));
  return { class_id: id, host_key: key };
}

// Branding shown on students' phones (university, small logo, welcome line, colour). Saved with the class.
function brand_(d) {
  const c = hostClass_(d);
  if (!c) return 'BAD_SESSION';
  const logo = String(d.logo || ''), color = /^#[0-9a-fA-F]{6}$/.test(String(d.color || '')) ? d.color : '';
  const ok = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(logo) && logo.length < 45000;
  const i = rows_('Classes').findIndex(r => r[0] === c[0]) + 2;
  sheet_('Classes').getRange(i, 7, 1, 4).setNumberFormat('@').setValues([[clean_(d.uni, 80), ok ? logo : '', clean_(d.welcome, 80), color]]);
  return 'OK';
}

function start_(d) {
  const c = hostClass_(d), pin = String(d.pin || '').trim();
  if (!c) return 'BAD_SESSION';
  if (!validPin_(pin)) return 'BAD_PIN_FORMAT';
  const sh = sheet_('Sessions');
  rows_('Sessions').forEach((r, i) => { if (same_(r[9], c[0]) && isTrue_(r[8])) sh.getRange(i + 2, 9).setValue(false); });
  const title = clean_(d.title, 60), id = newId_(12), now = new Date();
  sh.appendRow([id, title ? c[1] + ' - ' + title : c[1], pin, isTrue_(c[2]), c[3], c[4], now,
    new Date(now.getTime() + SESSION_HOURS * 3600000), true, c[0]]);
  setText_(sh, sh.getLastRow(), 3, pin);
  return { session_id: id };
}

function scan_(d) {
  const s = d.class_id ? openOf_(d.class_id) : session_(d.session_id);
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

function live_(d) {
  const c = hostClass_(d);
  if (!c) return 'BAD_SESSION';
  const s = openOf_(c[0]);
  const att = s ? rows_('Attendance').filter(r => r[0] === s[0]) : [];
  return { class_name: c[1], ask_regno: isTrue_(c[2]), open: !!s, session_id: s ? s[0] : '', pin: s ? String(s[2]) : '',
    title: s && String(s[1]).indexOf(c[1] + ' - ') === 0 ? String(s[1]).slice(c[1].length + 3) : '',
    count: att.length, flagged: att.filter(r => r[5] === 'FLAGGED').length, sessions: sessionsOf_(c[0]).length };
}

// One session's list (newest by default) plus the list of all the class's sessions for a picker.
function list_(d) {
  const c = hostClass_(d);
  if (!c) return 'BAD_SESSION';
  const all = sessionsOf_(c[0]), ids = all.map(r => r[0]);
  const att = rows_('Attendance').filter(r => ids.indexOf(r[0]) >= 0);
  const sessions = all.map(r => ({ id: r[0], name: r[1], date: fmt_(r[6], 'yyyy-MM-dd'), time: fmt_(r[6], 'HH:mm'),
    count: att.filter(a => a[0] === r[0]).length, open: isOpen_(r) })).reverse();
  const s = pick_(c, d.session_id);
  const o = { class_name: c[1], ask_regno: isTrue_(c[2]), sessions, session_id: s ? s[0] : '', name: s ? s[1] : c[1],
    date: s ? fmt_(s[6], 'yyyy-MM-dd') : '', rows: [] };
  if (s) o.rows = att.filter(r => r[0] === s[0]).map(r => ({ reg: String(r[1]), name: String(r[2]), time: fmt_(r[4], 'HH:mm'), status: r[5] === 'FLAGGED' ? 'Check' : 'Present', method: r[3] === 'MANUAL' ? 'Added by hand' : 'Scanned' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return o;
}

// Whole-semester table: one row per person, one column per session (1 = signed in), oldest session first.
function semester_(d) {
  const c = hostClass_(d);
  if (!c) return 'BAD_SESSION';
  const all = sessionsOf_(c[0]), askReg = isTrue_(c[2]);
  const att = rows_('Attendance'), people = {}, order = [];
  all.forEach((s, col) => att.filter(r => r[0] === s[0]).forEach(r => {
    const k = String(askReg && r[1] ? r[1] : r[2]).trim().toLowerCase();
    if (!people[k]) { people[k] = { reg: String(r[1]), name: String(r[2]), marks: all.map(() => 0) }; order.push(k); }
    people[k].marks[col] = 1;
  }));
  return { class_name: c[1], ask_regno: askReg,
    sessions: all.map(s => ({ id: s[0], label: fmt_(s[6], 'yyyy-MM-dd') + (String(s[1]).indexOf(c[1] + ' - ') === 0 ? ' ' + String(s[1]).slice(c[1].length + 3) : '') })),
    people: order.map(k => people[k]).sort((a, b) => a.name.localeCompare(b.name)) };
}

function setpin_(d) {
  const c = hostClass_(d), pin = String(d.pin || '').trim();
  if (!c) return 'BAD_SESSION';
  if (!validPin_(pin)) return 'BAD_PIN_FORMAT';
  const s = openOf_(c[0]);
  if (!s) return 'NO_OPEN_SESSION';
  setText_(sheet_('Sessions'), rows_('Sessions').findIndex(r => r[0] === s[0]) + 2, 3, pin);
  return 'OK';
}

function end_(d) {
  const c = hostClass_(d);
  if (!c) return 'BAD_SESSION';
  const sh = sheet_('Sessions');
  rows_('Sessions').forEach((r, i) => { if (same_(r[9], c[0]) && isTrue_(r[8])) sh.getRange(i + 2, 9).setValue(false); });
  return 'OK';
}

// Add people who have no phone. Accepts rows pasted from Google Sheets (tab or comma separated):
// "Reg No <tab> Name" or "Name <tab> Reg No" or just a name. A cell with a digit and no spaces is the Reg No.
function manual_(d) {
  const c = hostClass_(d);
  if (!c) return 'BAD_SESSION';
  const s = pick_(c, d.session_id);
  if (!s) return 'NO_SESSION';
  const sh = sheet_('Attendance'), all = rows_('Attendance').filter(r => r[0] === s[0]);
  const askReg = isTrue_(c[2]);
  let n = 0;
  (d.lines || []).forEach(line => {
    const cells = String(line).split(/\t|,/).map(x => clean_(x, 60)).filter(Boolean);
    if (!cells.length) return;
    let reg = '', name = cells[0];
    if (cells.length >= 2) {
      const isReg = x => /\d/.test(x) && !/\s/.test(x);
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
  const c = hostClass_(d);
  if (!c) return 'BAD_SESSION';
  const to = validEmail_(String(d.email || '').trim()) ? String(d.email).trim() : String(c[3]).trim();
  if (!to) return 'NO_EMAIL';
  const l = list_(d);
  if (!l.session_id) return 'NO_SESSION';
  const rows = l.rows, hasReg = rows.some(r => r.reg);
  const q = v => { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const head = hasReg ? ['Reg No', 'Name', 'Time', 'Status', 'Method'] : ['Name', 'Time', 'Status', 'Method'];
  const csv = [head].concat(rows.map(r => hasReg ? [r.reg, r.name, r.time, r.status, r.method] : [r.name, r.time, r.status, r.method]))
    .map(r => r.map(q).join(',')).join('\n');
  MailApp.sendEmail(to, 'Attendance: ' + l.name + ' (' + l.date + ')', rows.length + ' signed in. List attached.',
    { attachments: [Utilities.newBlob(csv, 'text/csv', String(l.name).replace(/[^\w\- ]+/g, '') + '-' + l.date + '.csv')] });
  return 'SENT';
}

// Kept for the Apps Script editor: creates any missing tabs (never erases data).
function setupSheets() { ensureTabs_(); }
