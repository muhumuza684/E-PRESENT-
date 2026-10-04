const TZ = 'Africa/Kampala';

function doGet() { return ContentService.createTextOutput('E-Presence is running'); }

function doPost(e) {
  const out = t => ContentService.createTextOutput(t);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse(e.postData.contents);
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
  const st = rows_('Students').find(r => String(r[0]).trim() === no);
  if (!st) return 'NOT_REGISTERED';

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
  const id = Utilities.getUuid();
  sh.appendRow([id, d.course, d.lat, d.lng, radius, new Date(Date.now() + minutes * 60000), true, mode]);
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
  return JSON.stringify(s.length ? { found: true, date: d.date, rows: listRows_(s) } : { found: false });
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
  MailApp.sendEmail(String(lec[2]).trim(), 'Attendance ' + d.course + ' ' + d.date,
    rows.length + ' students signed in. List attached.', { attachments: [Utilities.newBlob(csv, 'text/csv', file)] });
  return 'SENT';
}

function setupSheets() {
  const ss = SpreadsheetApp.getActive();
  const tabs = {
    Lecturers: [['lecturer_id', 'pin', 'email'], ['L001', '1234', 'you@example.com']],
    Students: [['student_no', 'name', 'pin'], ['2024/BSE/001/PS', 'Test Student', '1111']],
    Sessions: [['session_id', 'course', 'lat', 'lng', 'radius', 'closes_at', 'is_open', 'mode']],
    Attendance: [['session_id', 'student_no', 'name', 'device_id', 'time', 'status', 'distance', 'reason']]
  };
  Object.keys(tabs).forEach(n => {
    const sh = ss.getSheetByName(n) || ss.insertSheet(n);
    sh.clear();
    const v = tabs[n];
    if (n === 'Lecturers' || n === 'Students') sh.getRange('A:C').setNumberFormat('@');
    sh.getRange(1, 1, v.length, v[0].length).setValues(v);
    sh.setFrozenRows(1);
  });
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
}
