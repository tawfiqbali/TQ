/**
 * Management Portal data layer.
 *
 * LIVE mode: set VITE_PORTAL_API_URL to your Google Apps Script web-app URL
 * (see /portal-backend/Code.gs). Data lives in your Google Sheet, and the
 * script checks every request: Junior Admins cannot read salary payments or
 * bank details, or change salaries, whatever the browser does.
 *
 * DEMO mode (no URL set): everything is saved in this browser only, so you
 * can try the portal straight away. Nothing is shared between computers.
 */

const API_URL = (import.meta.env.VITE_PORTAL_API_URL || '').trim();
export const portalMode = API_URL ? 'live' : 'demo';

import { nextTeacherIds, seedTeachersFor } from './teacherSeed';

const SESSION_KEY = 'qit-portal:session';
const DEMO_KEY = 'qit-portal:demo-db:v1';

/* ---------------- session ---------------- */
export function getPortalSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}
function setPortalSession(s) {
  if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else sessionStorage.removeItem(SESSION_KEY);
}

/* ---------------- live transport ---------------- */
async function call(action, body = {}) {
  // text/plain avoids a CORS pre-flight, which Apps Script cannot answer
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: getPortalSession()?.token, ...body }),
  });
  if (!res.ok) throw new Error(`Portal server responded ${res.status}`);
  const data = await res.json();
  if (data && data.error) {
    if (data.error === 'Unauthorized') setPortalSession(null);
    throw new Error(data.error);
  }
  return data;
}

/* ---------------- demo store ---------------- */
const emptyDb = () => ({ teachers: [], students: [], payments: [], reports: [] });
function readDemo() {
  try {
    return { ...emptyDb(), ...JSON.parse(localStorage.getItem(DEMO_KEY)) };
  } catch {
    return emptyDb();
  }
}
function writeDemo(db) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(db));
}
const nextId = (prefix, list) => {
  const max = list.reduce((m, x) => Math.max(m, Number(String(x.id).replace(/\D/g, '')) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
};
const stripForJunior = (db) => ({
  ...db,
  payments: [],
  // Teacher Share (the teacher's cut of each student's fee) is salary data
  students: db.students.map((s) => ({ ...s, cut: 0 })),
  teachers: db.teachers.map(({ account, bankName, branchName, ...t }) => ({ ...t, account: '', bankName: '', branchName: '' })),
});

/* ---------------- public API ---------------- */
// role: 'super' or 'junior' – the tab the admin signed in with
export async function portalLogin(email, password, role) {
  if (portalMode === 'demo') {
    if (role !== 'super' && role !== 'junior') throw new Error('Unknown role.');
    setPortalSession({ token: 'demo', role, email });
    return { role };
  }
  const res = await call('login', { email, password, role });
  if (!res.success) throw new Error(res.message || 'Sign-in to the portal failed.');
  setPortalSession({ token: res.token, role: res.role, email });
  return res;
}

export async function portalLogout() {
  if (portalMode === 'live') await call('logout').catch(() => {});
  setPortalSession(null);
}

export async function loadPortalData() {
  if (portalMode === 'live') return call('getInitialData');
  const db = readDemo();
  return getPortalSession()?.role === 'super' ? db : stripForJunior(db);
}

const requireSuper = () => {
  if (getPortalSession()?.role !== 'super') throw new Error('Only a Super Admin can do this.');
};

// Each mutation mirrors a function in Code.gs
export const portalApi = {
  async addTeachers(list) {
    if (portalMode === 'live') return call('addMultipleTeachers', { payload: list });
    const db = readDemo();
    const ids = nextTeacherIds(db.teachers, list.length);
    const saved = list.map((t, i) => {
      const row = { ...t, id: ids[i] };
      db.teachers.push(row);
      return row;
    });
    writeDemo(db);
    return saved;
  },
  async addStudents(payload) {
    if (portalMode === 'live') return call('addMultipleStudents', { payload });
    const db = readDemo();
    const junior = getPortalSession()?.role !== 'super';
    if (junior) payload = { ...payload, teacherUpdates: [] };
    const saved = payload.students.map((s) => {
      const row = { ...s, ...(junior ? { cut: 0 } : {}), id: nextId('QIT-S', db.students) };
      db.students.push(row);
      return row;
    });
    (payload.teacherUpdates || []).forEach((u) => {
      const t = db.teachers.find((x) => x.id === u.id);
      if (t) Object.assign(t, { salaryType: 'Package', packageAmount: u.packageAmount });
    });
    writeDemo(db);
    return saved;
  },
  // Adds the starting teacher directory (only names not already present)
  async seedTeachers() {
    if (portalMode === 'live') return call('seedTeachers');
    const db = readDemo();
    const rows = seedTeachersFor(db.teachers);
    db.teachers.push(...rows);
    writeDemo(db);
    return rows;
  },
  async updateTeacher(data) {
    if (portalMode === 'live') return call('updateTeacherDetails', { payload: data });
    requireSuper();
    const db = readDemo();
    const t = db.teachers.find((x) => x.id === data.id);
    if (t) Object.assign(t, data);
    writeDemo(db);
    return true;
  },
  async deleteTeacher(id) {
    if (portalMode === 'live') return call('deleteTeacher', { payload: id });
    requireSuper();
    const db = readDemo();
    db.teachers = db.teachers.filter((t) => t.id !== id);
    writeDemo(db);
    return true;
  },
  async updateStudent(data) {
    if (portalMode === 'live') return call('updateStudentDetails', { payload: data });
    if (getPortalSession()?.role !== 'super') delete data.cut; // juniors can't change the share
    const db = readDemo();
    const s = db.students.find((x) => x.id === data.id);
    if (s) Object.assign(s, data);
    writeDemo(db);
    return true;
  },
  async deleteStudent(id) {
    if (portalMode === 'live') return call('deleteStudent', { payload: id });
    const db = readDemo();
    db.students = db.students.filter((s) => s.id !== id);
    writeDemo(db);
    return true;
  },
  async recordPayment(p) {
    if (portalMode === 'live') return call('recordSalaryPayment', { payload: p });
    requireSuper();
    const db = readDemo();
    db.payments.push(p);
    writeDemo(db);
    return p;
  },
  async cancelPayment(id) {
    if (portalMode === 'live') return call('cancelSalaryPayment', { payload: id });
    requireSuper();
    const db = readDemo();
    db.payments = db.payments.filter((p) => p.id !== id);
    writeDemo(db);
    return true;
  },
  async saveReport(report) {
    if (portalMode === 'live') return call('saveStudentProgressReport', { payload: report });
    const db = readDemo();
    const row = {
      id: `REP-${Date.now().toString(36).toUpperCase()}`,
      studentId: report.studentId,
      studentName: report.studentName,
      month: report.month,
      year: report.year,
      reportType: report.reportType,
      overallScore: report.overallScore,
      createdDate: new Date().toISOString().slice(0, 10),
    };
    db.reports.unshift(row);
    writeDemo(db);
    return { success: true, reportId: row.id };
  },
};
