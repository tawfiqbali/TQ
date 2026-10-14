/**
 * QURAN INTERNATIONAL INSTITUTE (QIT) – MANAGEMENT PORTAL BACK END (JSON API)
 *
 * The React admin panel talks to this script over HTTPS. Data stays in the
 * same Google Sheet as before (Teachers, Students, SalaryPayments,
 * StudentReports).
 *
 * Deploy: Extensions → Apps Script → paste this file → Deploy → New deployment
 *   → type "Web app" → Execute as: Me → Who has access: Anyone → Deploy.
 * Copy the Web app URL into Netlify as VITE_PORTAL_API_URL and redeploy the site.
 *
 * Roles are checked HERE, on Google's server, for every request:
 *   super  – everything
 *   junior – students, progress reports, enrolling teachers and students;
 *            no salary payments, no bank/account details, no salary edits.
 */

// Executive (Super Admin) emails – keep the same as src/lib/auth.js.
// Junior Admins: any Gmail address, with the junior password.
const SUPER_ADMIN_EMAILS = ['gmmuhit1632@gmail.com', 'qitoffice.info@gmail.com'];
const MAX_JUNIOR_FAILS_PER_HOUR = 30; // across ALL emails, since any Gmail may try

const DEFAULT_PASSWORD = 'admin5050'; // Super Admins – change with setAdminPassword()
const DEFAULT_JUNIOR_PASSWORD = '1010'; // Junior Admins – change with setJuniorPassword()
const MAX_FAILED_LOGINS = 5; // then that email is locked for 15 minutes
const SALARY_PIN = '2020';
const SESSION_TTL_SEC = 14400; // 4 hours

/* ============================ HTTP ============================ */

function doGet() {
  return json({ ok: true, service: 'QIT Management Portal API' });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const handler = ACTIONS[body.action];
    if (!handler) return json({ error: 'Unknown action' });
    return json(handler(body));
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ============================ AUTH ============================ */

function hashString(str) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  return digest.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function isSuperEmail(email) {
  return SUPER_ADMIN_EMAILS.indexOf(String(email || '').trim().toLowerCase()) !== -1;
}
function isGmail(email) {
  return /^[a-z0-9](?:[a-z0-9.+_-]{0,62}[a-z0-9])?@(?:gmail|googlemail)\.com$/i.test(String(email || '').trim());
}
// The role asked for (Executive or Junior tab) must fit the email
function roleFor(email, requested) {
  if (requested === 'junior') return isGmail(email) ? 'junior' : '';
  return isSuperEmail(email) ? 'super' : '';
}

function storedHash(role) {
  const key = role === 'junior' ? 'PORTAL_JUNIOR_PWD_HASH' : 'PORTAL_PWD_HASH';
  const props = PropertiesService.getScriptProperties();
  let h = props.getProperty(key);
  if (!h) {
    h = hashString(role === 'junior' ? DEFAULT_JUNIOR_PASSWORD : DEFAULT_PASSWORD);
    props.setProperty(key, h);
  }
  return h;
}

// Run once from the Apps Script editor to change a password, e.g.
// setAdminPassword('MyNewPassword') or setJuniorPassword('NewJuniorPassword').
// Set the same password for the website too (README section 2).
function setAdminPassword(newPassword) {
  PropertiesService.getScriptProperties().setProperty('PORTAL_PWD_HASH', hashString(String(newPassword)));
}
function setJuniorPassword(newPassword) {
  PropertiesService.getScriptProperties().setProperty('PORTAL_JUNIOR_PWD_HASH', hashString(String(newPassword)));
}

function sessionRole(token) {
  if (!token) return '';
  return CacheService.getScriptCache().get('AUTH_SESS_' + token) || '';
}

function requireRole(body, needSuper) {
  const role = sessionRole(body.token);
  if (!role) throw new Error('Unauthorized');
  if (needSuper && role !== 'super') throw new Error('Only a Super Admin can do this.');
  return role;
}

function login(body) {
  const role = roleFor(body.email, body.role === 'junior' ? 'junior' : 'super');
  if (!role) return { success: false, message: body.role === 'junior' ? 'Junior Admin sign-in needs a Gmail address.' : 'This email does not have Executive access.' };
  // Short passwords are easy to guess, so repeated failures lock the email
  const cache = CacheService.getScriptCache();
  const failKey = 'FAILS_' + String(body.email).trim().toLowerCase();
  const fails = Number(cache.get(failKey)) || 0;
  if (fails >= MAX_FAILED_LOGINS) return { success: false, message: 'Too many wrong passwords. Try again in 15 minutes.' };
  // Anyone can try the junior password with a fresh Gmail address, so junior
  // failures are also counted together and pause junior sign-in for an hour.
  const juniorFails = Number(cache.get('JUNIOR_FAILS')) || 0;
  if (role === 'junior' && juniorFails >= MAX_JUNIOR_FAILS_PER_HOUR) return { success: false, message: 'Junior Admin sign-in is paused for a while after many wrong passwords.' };
  if (hashString(String(body.password || '')) !== storedHash(role)) {
    cache.put(failKey, String(fails + 1), 900);
    if (role === 'junior') cache.put('JUNIOR_FAILS', String(juniorFails + 1), 3600);
    return { success: false, message: 'Invalid password. Access denied.' };
  }
  cache.remove(failKey);
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('AUTH_SESS_' + token, role, SESSION_TTL_SEC);
  return { success: true, token: token, role: role };
}

function logout(body) {
  if (body.token) CacheService.getScriptCache().remove('AUTH_SESS_' + body.token);
  return true;
}

// No longer used by the website (the Salary Directory is protected by the
// Super Admin sign-in); kept so older copies of the site keep working.
function verifySalaryDirectoryAccess(body) {
  requireRole(body, true);
  return String(body.payload).trim() === SALARY_PIN ? { success: true } : { success: false, message: 'Incorrect Salary Security PIN.' };
}

/* ============================ SHEETS ============================ */

const HEADERS = {
  Teachers: ['Teacher ID', 'Teacher Name', 'Category', 'WhatsApp', 'Payment Method', 'Account Number', 'Salary Type', 'Package Amount', 'Status', 'Email', 'Join Date', 'Bank Name', 'Branch Name', 'Department'],
  Students: ['Student ID', 'Student Name', 'Student Phone', 'Teacher ID', 'Monthly Fee', 'Teacher Cut', 'Guardian Name', 'Guardian Phone', 'Course', 'Status', 'Enrollment Date', 'Class Time', 'Class Days'],
  SalaryPayments: ['Payment ID', 'Teacher ID', 'Month', 'Year', 'Amount Paid', 'Date Paid'],
  StudentReports: ['Report ID', 'Student ID', 'Student Name', 'Teacher ID', 'Month', 'Year', 'Report Type', 'Overall Score', 'Created Date', 'Payload JSON'],
};

function sheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS[name]);
  // Older sheets: add headers for columns added later (e.g. Teachers → Department)
  else if (sh.getLastColumn() < HEADERS[name].length) {
    const have = sh.getLastColumn();
    sh.getRange(1, have + 1, 1, HEADERS[name].length - have).setValues([HEADERS[name].slice(have)]);
  }
  return sh;
}

function rows(name, width) {
  const sh = sheet(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, Math.max(width, sh.getLastColumn())).getValues();
}

function today() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// Next sequential ID such as QIT-T007, based on the highest existing number
function nextId(prefix, existing) {
  let max = 0;
  existing.forEach(function (id) {
    const n = Number(String(id).replace(/\D/g, '')) || 0;
    if (n > max) max = n;
  });
  return function () {
    max += 1;
    return prefix + ('000' + max).slice(-3);
  };
}

function findRow(name, id) {
  const sh = sheet(name);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) if (String(values[i][0]) === String(id)) return { sh: sh, row: i + 1, values: values[i] };
  return null;
}

/* ============================ READ ============================ */

function getInitialData(body) {
  const role = sessionRole(body.token);
  if (!role) return { authenticated: false };
  const isSuper = role === 'super';

  const teachers = rows('Teachers', 14).map(function (r) {
    return {
      id: String(r[0]), name: String(r[1]), category: String(r[2]), whatsapp: String(r[3] || 'N/A'), method: String(r[4]),
      account: isSuper ? String(r[5]) : '', salaryType: r[6] ? String(r[6]) : 'Per-Student', packageAmount: Number(r[7]) || 0,
      status: String(r[8] || 'Active'), bankName: isSuper ? String(r[11] || '') : '', branchName: isSuper ? String(r[12] || '') : '',
      department: String(r[13] || ''),
    };
  });
  const students = rows('Students', 13).map(function (r) {
    return {
      id: String(r[0]), name: String(r[1]), phone: String(r[2] || 'N/A'), teacherId: String(r[3]), fee: Number(r[4]) || 0,
      cut: isSuper ? Number(r[5]) || 0 : 0, // Teacher Share: Super Admins only
      guardianName: String(r[6] || 'N/A'), course: String(r[8] || 'Quran & Tajweed'),
      classTime: String(r[11] || ''), classDays: String(r[12] || ''),
    };
  });
  const payments = isSuper
    ? rows('SalaryPayments', 6).map(function (r) {
        return { id: String(r[0]), teacherId: String(r[1]), month: String(r[2]), year: String(r[3]), amount: Number(r[4]) || 0, date: String(r[5]) };
      })
    : [];
  const reports = rows('StudentReports', 10)
    .reverse()
    .slice(0, 200)
    .map(function (r) {
      return { id: String(r[0]), studentId: String(r[1]), studentName: String(r[2]), month: String(r[4]), year: String(r[5]), reportType: String(r[6]), overallScore: String(r[7]), createdDate: String(r[8]) };
    });

  return { authenticated: true, role: role, teachers: teachers, students: students, payments: payments, reports: reports };
}

/* ============================ WRITE ============================ */

function addMultipleTeachers(body) {
  requireRole(body, false);
  const sh = sheet('Teachers');
  const next = nextId('QIT-', rows('Teachers', 1).map(function (r) { return r[0]; })); // Teacher IDs: QIT-001, QIT-002, …
  const saved = [];
  const out = (body.payload || []).map(function (t) {
    const id = next();
    saved.push(Object.assign({}, t, { id: id }));
    return [id, t.name, t.category, t.whatsapp || 'N/A', t.method, "'" + (t.account || 'N/A'), t.salaryType || 'Per-Student', Number(t.packageAmount) || 0, 'Active', 'N/A', today(), t.bankName || '', t.branchName || '', t.department || ''];
  });
  if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, 14).setValues(out);
  return saved;
}

function addMultipleStudents(body) {
  const isSuper = requireRole(body, false) === 'super';
  const payload = body.payload || {};
  const sh = sheet('Students');
  const next = nextId('QIT-S', rows('Students', 1).map(function (r) { return r[0]; }));
  const saved = [];
  const out = (payload.students || []).map(function (s) {
    const id = next();
    saved.push(Object.assign({}, s, { id: id }));
    return [id, s.name, "'" + (s.phone || 'N/A'), s.teacherId || '', Number(s.fee) || 0, isSuper ? Number(s.cut) || 0 : 0, 'N/A', "'N/A", s.course || 'Quran & Tajweed', 'Active', today(), s.classTime || '', ''];
  });
  if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, 13).setValues(out);
  // Students enrolled in "fixed salary" mode switch their teacher to a package
  (isSuper ? payload.teacherUpdates || [] : []).forEach(function (u) {
    const hit = findRow('Teachers', u.id);
    if (hit) hit.sh.getRange(hit.row, 7, 1, 2).setValues([['Package', Number(u.packageAmount) || 0]]);
  });
  return saved;
}

function updateTeacherDetails(body) {
  requireRole(body, true);
  const d = body.payload;
  const hit = findRow('Teachers', d.id);
  if (!hit) return false;
  const v = hit.values;
  hit.sh.getRange(hit.row, 2, 1, 13).setValues([[
    d.name, d.category, d.whatsapp, d.method, "'" + d.account, d.salaryType, Number(d.packageAmount) || 0,
    v[8] || 'Active', v[9] || 'N/A', v[10] || today(), d.bankName || '', d.branchName || '', d.department || '',
  ]]);
  return true;
}

function deleteTeacher(body) {
  requireRole(body, true);
  const hit = findRow('Teachers', body.payload);
  if (!hit) return false;
  hit.sh.deleteRow(hit.row);
  return true;
}

function updateStudentDetails(body) {
  const isSuper = requireRole(body, false) === 'super';
  const d = body.payload;
  const hit = findRow('Students', d.id);
  if (!hit) return false;
  const v = hit.values;
  hit.sh.getRange(hit.row, 2, 1, 12).setValues([[
    d.name, "'" + d.phone, d.teacherId, Number(d.fee) || 0, isSuper ? Number(d.cut) || 0 : Number(v[5]) || 0, // juniors keep the existing share v[6] || 'N/A', v[7] || 'N/A',
    v[8] || 'Quran & Tajweed', v[9] || 'Active', v[10] || '', d.classTime || '', v[12] || '',
  ]]);
  return true;
}

function deleteStudent(body) {
  requireRole(body, false);
  const hit = findRow('Students', body.payload);
  if (!hit) return false;
  hit.sh.deleteRow(hit.row);
  return true;
}

function recordSalaryPayment(body) {
  requireRole(body, true);
  const d = body.payload;
  const id = d.id || 'PAY-' + Utilities.getUuid().slice(0, 6).toUpperCase();
  const date = d.date || today();
  sheet('SalaryPayments').appendRow([id, d.teacherId, d.month, d.year, Number(d.amount) || 0, date]);
  return { id: id, teacherId: d.teacherId, month: d.month, year: d.year, amount: Number(d.amount) || 0, date: date };
}

function cancelSalaryPayment(body) {
  requireRole(body, true);
  const hit = findRow('SalaryPayments', body.payload);
  if (!hit) return false;
  hit.sh.deleteRow(hit.row);
  return true;
}

function saveStudentProgressReport(body) {
  requireRole(body, false);
  const r = body.payload;
  const id = 'REP-' + Utilities.getUuid().slice(0, 7).toUpperCase();
  sheet('StudentReports').appendRow([id, r.studentId, r.studentName, r.teacherId, r.month, r.year, r.reportType, r.overallScore, today(), JSON.stringify(r)]);
  return { success: true, reportId: id };
}


/* ============================ TEACHER DIRECTORY SEED ============================ */

// Starting teacher directory (same as src/admin/portal/lib/teacherSeed.js).
// The portal calls this automatically when the Teachers sheet is empty; it only
// adds names that are not there yet. You can also run seedTeacherDirectory()
// once from the Apps Script editor.
const TEACHER_SEED = {
  "Residential": [
    "Abu Bakar Siddique",
    "Mr. Ibrahim",
    "Mr. Atiqur Rahman",
    "Mr. Sibgatullah",
    "Mr. Masudur Rahman",
    "Mr. Sabbir Khan",
    "Mr. Munirul Islam",
    "Mr. Abdul Halim",
    "Mr. Said Anwar",
    "Mr. Khalid",
    "Mr. Mobarak",
    "Mr. Rumman",
    "Sabbir Ahmad",
    "Mr. Nasir",
    "Mr. Abu Sayeed"
  ],
  "Non-Residential Male": [
    "Mr. Rabbani",
    "Sifatullah Mishor",
    "Abu Sufian",
    "Sanaullah Markaz",
    "Mr. Riaz",
    "Osama Khan",
    "Rashedul Islam",
    "Ashiqur Rahman Markaz",
    "Mr. Hedayetullah",
    "Muaz bin Habib",
    "Mainul Islam (English)",
    "Kamrul Islam Azhari",
    "Abdur Rahman",
    "Abdullah Fahad",
    "Mir Muhammad",
    "Mr. Hamza",
    "Osama bin Saif",
    "Rafi Habib Azhari",
    "Alamin Sadi",
    "Rakin Muaz",
    "Ahmad Hasan",
    "Sheikh Al-Amin Azhari",
    "Hasan Mahmud Azhari",
    "Monirul Islam (IOM)",
    "Nayamul Islam",
    "Abdullah Tongi",
    "Haider Ali",
    "Mr. Imran",
    "Muinul Islam",
    "Junaid Ahmed",
    "Fayzur Rahman Azhari",
    "Shamim Ahmed",
    "Nahidul Islam"
  ],
  "Non-Residential Female": [
    "Sanjida Islam",
    "Afroza Sultana",
    "Umme Miqdad",
    "Mrs. Wasif",
    "Hure Jannat",
    "Antara Labiba",
    "Amatullah Surayya",
    "Sadia Khanam",
    "Habiba Islam",
    "Humaira Doctor",
    "Hafsa Sharif",
    "Sumaiya Sadi",
    "Hafeza Amatullah",
    "Hafeza Sumaiya Akter",
    "Nur Nahar",
    "Shanta Islam",
    "Habiba Sultana",
    "Maria Islam",
    "Umme Atika",
    "Sumaiya (Engr.)",
    "Amatullah Jannat",
    "Abrar Shah Jahan",
    "Sadia Mohib",
    "Taiyeba Anjam",
    "Umme Zakwan",
    "Humaira Khatun",
    "Female Examiner",
    "Female Admin"
  ]
};

function seedTeachers(body) {
  requireRole(body, false);
  return seedTeacherDirectory();
}

function seedTeacherDirectory() {
  const sh = sheet('Teachers');
  const existing = rows('Teachers', 2);
  const have = {};
  existing.forEach(function (r) { have[String(r[1]).trim().toLowerCase()] = true; });
  const next = nextId('QIT-', existing.map(function (r) { return r[0]; }));
  const out = [];
  Object.keys(TEACHER_SEED).forEach(function (category) {
    TEACHER_SEED[category].forEach(function (name) {
      if (have[name.toLowerCase()]) return;
      out.push([next(), name, category, 'N/A', 'Other', "'N/A", 'Per-Student', 0, 'Active', 'N/A', today(), '', '']);
    });
  });
  if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, 13).setValues(out);
  return { added: out.length };
}

const ACTIONS = {
  seedTeachers: seedTeachers,
  login: login,
  logout: logout,
  getInitialData: getInitialData,
  verifySalaryDirectoryAccess: verifySalaryDirectoryAccess,
  addMultipleTeachers: addMultipleTeachers,
  addMultipleStudents: addMultipleStudents,
  updateTeacherDetails: updateTeacherDetails,
  deleteTeacher: deleteTeacher,
  updateStudentDetails: updateStudentDetails,
  deleteStudent: deleteStudent,
  recordSalaryPayment: recordSalaryPayment,
  cancelSalaryPayment: cancelSalaryPayment,
  saveStudentProgressReport: saveStudentProgressReport,
};
