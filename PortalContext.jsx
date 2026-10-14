import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../components/ui/Toast';
import useAdminRole from '../../hooks/useAdminRole';
import { getPortalSession, loadPortalData, portalApi, portalLogin, portalLogout, portalMode } from './lib/api';

// Which portal panels each role may open
export const PANELS = [
  { key: 'dashboard', label: 'Dashboard', superOnly: true },
  { key: 'salary', label: 'Salary Directory', superOnly: true },
  { key: 'students', label: 'Students' },
  { key: 'reports', label: 'Progress Reports' },
  { key: 'enrollTeacher', label: 'Enroll Teacher' },
  { key: 'enrollStudent', label: 'Enroll Student' },
  { key: 'contents', label: 'Portal Contents', superOnly: true },
];

const PortalContext = createContext(null);
const EMPTY = { teachers: [], students: [], payments: [], reports: [] };

export function PortalProvider({ children }) {
  const toast = useToast();
  const { email: adminEmail, role: adminRole } = useAdminRole();
  const [session, setSession] = useState(getPortalSession);
  const [db, setDb] = useState(EMPTY);
  const [status, setStatus] = useState('loading'); // loading | locked | ready | error
  const [error, setError] = useState('');
  const dbRef = useRef(db);
  dbRef.current = db;

  const role = session?.role || '';
  const isSuper = role === 'super';
  const canOpen = useCallback((key) => {
    const p = PANELS.find((x) => x.key === key);
    return Boolean(p) && (!p.superOnly || isSuper);
  }, [isSuper]);

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const data = await loadPortalData();
      if (data && data.authenticated === false) {
        setSession(null);
        setStatus('locked');
        return;
      }
      let next = { ...EMPTY, ...data };
      // First time the portal has no teachers: load the starting directory
      if (!next.teachers.length) {
        try {
          await portalApi.seedTeachers();
          next = { ...EMPTY, ...(await loadPortalData()) };
        } catch {
          /* keep the empty list; teachers can still be added by hand */
        }
      }
      setDb(next);
      setStatus('ready');
    } catch (e) {
      if (!getPortalSession()) {
        setSession(null);
        setStatus('locked');
      } else {
        setError(e.message);
        setStatus('error');
      }
    }
  }, []);

  // A session for a different admin (e.g. after switching accounts) is dropped
  useEffect(() => {
    if (adminEmail === null) return;
    if (session && adminEmail && (session.email !== adminEmail || (adminRole && session.role !== adminRole))) {
      portalLogout();
      setSession(null);
      return;
    }
    if (session) load();
    else if (portalMode === 'demo' && adminEmail) {
      portalLogin(adminEmail, '', adminRole).then(() => setSession(getPortalSession())).catch((e) => {
        setError(e.message);
        setStatus('error');
      });
    } else setStatus('locked');
  }, [session, adminEmail, adminRole, load]);

  const unlock = useCallback(async (password) => {
    await portalLogin(adminEmail, password, adminRole);
    setSession(getPortalSession());
  }, [adminEmail, adminRole]);

  // Runs an optimistic local change, then the server call; on failure the
  // data is reloaded so the screen matches the sheet again.
  const run = useCallback(
    async (local, remote, okMsg, { reload = false } = {}) => {
      if (local) setDb((d) => local(d));
      try {
        const res = await remote();
        if (okMsg) toast(okMsg);
        if (reload && portalMode === 'live') await load();
        return res;
      } catch (e) {
        toast(e.message || 'Could not save. Please try again.', 'error');
        await load();
        return null;
      }
    },
    [toast, load],
  );

  const actions = useMemo(
    () => ({
      addTeachers: (rows) =>
        run(
          (d) => ({ ...d, teachers: [...d.teachers, ...rows] }),
          async () => {
            const saved = await portalApi.addTeachers(rows);
            if (portalMode === 'demo') setDb((d) => ({ ...d, teachers: [...d.teachers.filter((t) => !rows.includes(t)), ...saved] }));
            return saved;
          },
          `${rows.length} teacher(s) enrolled!`,
          { reload: true },
        ),
      addStudents: (students, teacherUpdates) =>
        run(
          (d) => ({
            ...d,
            students: [...d.students, ...students],
            teachers: d.teachers.map((t) => {
              const u = teacherUpdates.find((x) => x.id === t.id);
              return u ? { ...t, salaryType: 'Package', packageAmount: u.packageAmount } : t;
            }),
          }),
          async () => {
            const saved = await portalApi.addStudents({ students, teacherUpdates });
            if (portalMode === 'demo') setDb((d) => ({ ...d, students: [...d.students.filter((s) => !students.includes(s)), ...saved] }));
            return saved;
          },
          `${students.length} student(s) registered!`,
          { reload: true },
        ),
      updateTeacher: (data) =>
        run((d) => ({ ...d, teachers: d.teachers.map((t) => (t.id === data.id ? { ...t, ...data } : t)) }), () => portalApi.updateTeacher(data), 'Teacher updated!'),
      deleteTeacher: (id) =>
        run((d) => ({ ...d, teachers: d.teachers.filter((t) => t.id !== id) }), () => portalApi.deleteTeacher(id), 'Teacher deleted.'),
      updateStudent: (data) =>
        run((d) => ({ ...d, students: d.students.map((s) => (s.id === data.id ? { ...s, ...data } : s)) }), () => portalApi.updateStudent(data), 'Student updated!'),
      deleteStudent: (id) =>
        run((d) => ({ ...d, students: d.students.filter((s) => s.id !== id) }), () => portalApi.deleteStudent(id), 'Student deleted.'),
      recordPayment: (p) => run((d) => ({ ...d, payments: [...d.payments, p] }), () => portalApi.recordPayment(p), 'Payment disbursed!'),
      cancelPayment: (id) =>
        run((d) => ({ ...d, payments: d.payments.filter((p) => p.id !== id) }), () => portalApi.cancelPayment(id), 'Payment cancelled.'),
      saveReport: (report) =>
        run(
          (d) => ({
            ...d,
            reports: [
              { id: 'REP-new', studentId: report.studentId, studentName: report.studentName, month: report.month, year: report.year, reportType: report.reportType, overallScore: report.overallScore },
              ...d.reports,
            ],
          }),
          () => portalApi.saveReport(report),
          'Report saved to records.',
        ),
    }),
    [run],
  );

  const value = { db, status, error, role, isSuper, canOpen, load, unlock, adminEmail, mode: portalMode, ...actions };
  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used inside <PortalProvider>');
  return ctx;
}
