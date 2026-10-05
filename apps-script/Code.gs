const TZ = 'Africa/Kampala';

function doGet(e) {
  try { ensureTabs_(); } catch (err) { return ContentService.createTextOutput('E-Presence is running, but tabs could not be created: ' + err); }
  const course = e && e.parameter && e.parameter.course;
  if (course) return ContentService.createTextOutput(JSON.stringify({ title: titleFor_(course) }));
  return ContentService.createTextOutput('E-Presence is running');
}

// Title the lecturer gave the currently open session of a course ('' if none)
function titleFor_(course) {
  const all = rows_('Sessions'), now = new Date();
  for (let i = all.length - 1; i >= 0; i--) {
    const r = all[i];
    if (String(r[1]).trim() === String(course).trim() && isTrue_(r[6]) && now < new Date(r[5])) return String(r[8] || '');
  }
  return '';
}

// Creates any missing tab with its headers. Never clears or overwrites existing data.
const TABS_ = {
  Lecturers: ['lecturer_id', 'pin', 'email'],
  Students: ['student_no', 'name', 'pin'],
  Sessions: ['session_id', 'course', 'lat', 'lng', 'radius', 'closes_at', 'is_open', 'mode', 'title'],
  Attendance: ['session_id', 'student_no', 'name', 'device_id', 'time', 'status', 'distance', 'reason']
};
// Writes one row as plain text, so PINs and Reg Nos like 0123 keep their leading zero.
function putRow_(name, row) {
  const sh = sheet_(name);
  sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setNumberFormat('@').setValues([row]);
}

function ensureTabs_() {
  const cache = CacheService.getScriptCache();
  if (cache.get('tabs_v3')) return;
  const ss = SpreadsheetApp.getActive();
  // Dates read back wrong (hours off) if the Sheet's timezone differs from the script's, which
  // breaks session expiry. Keep them identical.
  ss.setSpreadsheetTimeZone(Session.getScriptTimeZone());
  Object.keys(TABS_).forEach(n => {
    if (ss.getSheetByName(n)) return;
    const sh = ss.insertSheet(n);
    if (n === 'Lecturers' || n === 'Students') sh.getRange('A:C').setNumberFormat('@');
    sh.getRange(1, 1, 1, TABS_[n].length).setValues([TABS_[n]]);
    sh.setFrozenRows(1);
  });
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
  const ses = ss.getSheetByName('Sessions');   // older Sheets have no title column yet
  if (!String(ses.getDataRange().getValues()[0][8] || '').trim()) ses.getRange(1, 9).setValue('title');
  cache.put('tabs_v3', '1', 21600);
}

// First-time setup: creates the first lecturer, and only while the Lecturers tab is empty.
function init_(d) {
  if (rows_('Lecturers').some(r => String(r[0]).trim())) return 'ALREADY_SETUP';
  const id = String(d.lecturer_id || '').trim(), pin = String(d.pin || '').trim(), email = String(d.email || '').trim();
  if (!id || !pin || /^[=+\-@]/.test(id) || /^[=+\-@]/.test(email)) return 'BAD_INPUT';
  putRow_('Lecturers', [id, pin, email]);
  return 'READY';
}

function doPost(e) {
  const out = t => ContentService.createTextOutput(t);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    ensureTabs_();
    const d = JSON.parse(e.postData.contents);
    if (d.action === 'init') return out(init_(d));
    if (d.action === 'start') return out(start_(d));
    if (d.action === 'manual') return out(manual_(d));
    if (d.action === 'list') return out(list_(d));
    if (d.action === 'email') return out(email_(d));
    return out(scan_(d));
  } catch (err) {
    return out('ERROR');
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

const sheet_ = n => SpreadsheetApp.getActive().getSheetByName(n);
const rows_ = n => sheet_(n).getDataRange().getValues().slice(1); // data row i = sheet row i+2
const isTrue_ = v => String(v).toUpperCase() === 'TRUE';

function lecturerOk_(d) {
  return rows_('Lecturers').some(r => String(r[0]).trim() === String(d.lecturer_id).trim() &&
                                      String(r[1]).trim() === String(d.pin).trim());
}

function haversine_(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = x => x * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
            Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function scan_(d) {
  const no = String(d.student_no).trim(), pin = String(d.pin).trim();
  let st = rows_('Students').find(r => String(r[0]).trim() === no);
  if (!st) {
    // First time: the student gives their name and the PIN they typed becomes their PIN.
    const name = String(d.name || '').trim().replace(/^[=+\-@]+/, '').slice(0, 60);
    if (!name) return 'NOT_REGISTERED';
    if (!/^\d{4}$/.test(pin)) return 'BAD_NEW_PIN';
    if (no.length < 3 || no.length > 40 || /^[=+\-@]/.test(no)) return 'NOT_REGISTERED';
    st = [no, name, pin];
    putRow_('Students', st);
  }

  const cache = CacheService.getScriptCache(), key = 'fail:' + no;
  const fails = Number(cache.get(key) || 0);
  if (fails >= 5) return 'LOCKED';
  if (String(st[2]).trim() !== pin) { cache.put(key, String(fails + 1), 600); return 'BAD_PIN'; }
  cache.remove(key);

  const now = new Date();
  const sessions = rows_('Sessions');
  let s = null;
  for (let i = sessions.length - 1; i >= 0; i--) {
    const r = sessions[i];
    if (String(r[1]).trim() === String(d.course).trim() && isTrue_(r[6]) && now < new Date(r[5])) { s = r; break; }
  }
  if (!s) return 'NO_OPEN_SESSION';

  const dist = haversine_(Number(d.lat), Number(d.lng), Number(s[2]), Number(s[3]));
  const slack = Math.min(Number(d.accuracy) || 0, 25);
  const outside = dist - slack > Number(s[4]);
  const mode = String(s[7] || 'flag');
  if (mode === 'strict' && outside) return 'OUT_OF_RANGE:' + Math.round(dist);

  let status = 'PRESENT', reason = '';
  if (mode !== 'capture' && outside) { status = 'FLAGGED'; reason = 'OUT_OF_RANGE'; }

  const sh = sheet_('Attendance');
  const att = rows_('Attendance');
  if (att.some(r => r[0] === s[0] && String(r[1]).trim() === no)) return 'ALREADY_MARKED';

  att.forEach((r, i) => {
    if (r[0] === s[0] && r[3] === d.device_id && r[3] !== 'MANUAL') {
      sh.getRange(i + 2, 6).setValue('FLAGGED');
      sh.getRange(i + 2, 8).setValue('SHARED_DEVICE');
      status = 'FLAGGED'; reason = 'SHARED_DEVICE';
    }
  });

  sh.appendRow([s[0], no, st[1], d.device_id, now, status, Math.round(dist), reason]);
  return status === 'PRESENT' ? 'OK' : 'OK_FLAGGED';
}

function start_(d) {
  if (!lecturerOk_(d)) return 'BAD_LECTURER';
  if (Number(d.accuracy) > 30) return 'WEAK_LOCATION';
  const clamp = (v, lo, hi, def) => { v = Number(v); return isNaN(v) || !v ? def : Math.min(hi, Math.max(lo, v)); };
  const radius = clamp(d.radius, 30, 100, 60);
  const minutes = clamp(d.minutes, 5, 120, 15);
  const mode = ['capture', 'flag', 'strict'].includes(d.mode) ? d.mode : 'flag';

  const sh = sheet_('Sessions');
  rows_('Sessions').forEach((r, i) => {
    if (String(r[1]).trim() === String(d.course).trim() && isTrue_(r[6])) sh.getRange(i + 2, 7).setValue(false);
  });
  const title = String(d.title || '').trim().replace(/^[=+\-@]+/, '').slice(0, 80);
  const id = Utilities.getUuid();
  sh.appendRow([id, d.course, d.lat, d.lng, radius, new Date(Date.now() + minutes * 60000), true, mode, title]);
  return 'STARTED:' + id;
}

function manual_(d) {
  if (!lecturerOk_(d)) return 'BAD_LECTURER';
  const sessions = rows_('Sessions');
  let s = sessions.find(r => String(r[1]).trim() === String(d.course).trim() &&
    Utilities.formatDate(new Date(r[5]), TZ, 'yyyy-MM-dd') === d.date);
  let sid;
  if (s) sid = s[0];
  else {
    sid = Utilities.getUuid();
    // Kampala is UTC+3, so this stays on the requested date in Africa/Kampala
    sheet_('Sessions').appendRow([sid, d.course, '', '', 0, new Date(d.date + 'T12:00:00+03:00'), false, 'manual']);
  }
  const students = rows_('Students');
  const att = rows_('Attendance');
  const sh = sheet_('Attendance');
  let n = 0;
  (d.student_nos || []).forEach(raw => {
    const no = String(raw).trim();
    const st = students.find(r => String(r[0]).trim() === no);
    if (!st) return;
    if (att.some(r => r[0] === sid && String(r[1]).trim() === no)) return;
    sh.appendRow([sid, no, st[1], 'MANUAL', new Date(), 'MANUAL', '', 'LECTURER_ADDED']);
    att.push([sid, no]);
    n++;
  });
  return 'ADDED:' + n;
}

// Lecturers tab: lecturer_id | pin | email
const day_ = x => Utilities.formatDate(new Date(x), TZ, 'yyyy-MM-dd');

// All sessions of a course on a date (a lecturer may restart a session after the window closes)
function sessionsOn_(course, date) {
  return rows_('Sessions').filter(r => String(r[1]).trim() === String(course).trim() && day_(r[5]) === date);
}

function listRows_(sessions) {
  const ids = new Set(sessions.map(x => x[0])), seen = new Set();
  return rows_('Attendance').filter(r => ids.has(r[0]))
    .filter(r => { const k = String(r[1]).trim(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map(r => ({ no: r[1], name: r[2], time: Utilities.formatDate(new Date(r[4]), TZ, 'HH:mm'), status: r[5] }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function list_(d) {
  if (!lecturerOk_(d)) return 'BAD_LECTURER';
  const s = sessionsOn_(d.course, d.date);
  const title = s.map(x => String(x[8] || '')).filter(Boolean).pop() || '';
  return JSON.stringify(s.length ? { found: true, date: d.date, title, rows: listRows_(s) } : { found: false });
}

function email_(d) {
  if (!lecturerOk_(d)) return 'BAD_LECTURER';
  const lec = rows_('Lecturers').find(r => String(r[0]).trim() === String(d.lecturer_id).trim());
  if (!lec || !String(lec[2]).trim()) return 'NO_EMAIL';
  const s = sessionsOn_(d.course, d.date);
  if (!s.length) return 'NO_SESSION';
  const q = v => { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const rows = listRows_(s);
  const csv = [['Student no', 'Name', 'Time', 'Status']].concat(rows.map(r => [r.no, r.name, r.time, r.status]))
    .map(r => r.map(q).join(',')).join('\n');
  const file = d.course + '-' + d.date + '.csv';
  const title = s.map(x => String(x[8] || '')).filter(Boolean).pop() || '';
  MailApp.sendEmail(String(lec[2]).trim(), 'Attendance ' + d.course + (title ? ' - ' + title : '') + ' ' + d.date,
    rows.length + ' students signed in. List attached.', { attachments: [Utilities.newBlob(csv, 'text/csv', file)] });
  return 'SENT';
}

// Kept for the Apps Script editor: creates any missing tabs (never erases data).
function setupSheets() { ensureTabs_(); }
