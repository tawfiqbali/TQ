import { lazy, Suspense, useEffect, useState } from 'react';
import { BookUser, FileText, LayoutGrid, Lock, PenLine, RefreshCw, UserPlus, Users, Wallet } from 'lucide-react';
import { PANELS, PortalProvider, usePortal } from './PortalContext';
// Charts (Chart.js) load only when a Super Admin opens the Dashboard tab
const Dashboard = lazy(() => import('./panels/Dashboard'));
import SalaryDirectory from './panels/SalaryDirectory';
import StudentRoster from './panels/StudentRoster';
import ProgressReports from './panels/ProgressReports';
import EnrollTeachers from './panels/EnrollTeachers';
import EnrollStudents from './panels/EnrollStudents';
// Text editor for reports and certificates, loaded when opened
const PortalContents = lazy(() => import('./panels/PortalContents'));
import './portal.css';

const ICONS = { dashboard: LayoutGrid, salary: Wallet, students: Users, reports: FileText, enrollTeacher: UserPlus, enrollStudent: BookUser, contents: PenLine };

function UnlockForm() {
  const { unlock, adminEmail } = usePortal();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await unlock(password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="box-card mx-auto max-w-md text-center">
      <div className="logo-badge mx-auto mb-4">QIT</div>
      <h2 className="text-xl font-extrabold">Unlock the Management Portal</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
        Signed in as <strong>{adminEmail}</strong>. Enter your admin password to connect to the portal records.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-3 text-left">
        <label className="p-label" htmlFor="portal-pw">Password</label>
        <input id="portal-pw" type="password" className="m-input" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
        <button className="btn-teal w-full justify-center" disabled={busy || !password}>
          <Lock className="h-4 w-4" /> {busy ? 'Connecting…' : 'Unlock system'}
        </button>
      </form>
    </div>
  );
}

function PortalShell() {
  const { status, error, load, isSuper, canOpen, mode } = usePortal();
  const [tab, setTab] = useState('');

  useEffect(() => {
    if (status === 'ready' && (!tab || !canOpen(tab))) setTab(isSuper ? 'dashboard' : 'students');
  }, [status, tab, canOpen, isSuper]);

  const visible = PANELS.filter((p) => canOpen(p.key));

  return (
    <div className="qit-portal">
      <header className="p-header">
        <div className="flex items-center gap-4">
          <div className="logo-badge">QIT</div>
          <div>
            <h1 className="text-xl font-extrabold sm:text-2xl" style={{ color: 'var(--c-teal-dark)' }}>
              Quran International Institute
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Unified Management System &amp; Financial Portal</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status === 'ready' && (
            <span className="id-tag" style={{ background: isSuper ? '#0F766E' : '#B45309' }}>
              {isSuper ? 'Super Admin / Executive' : 'Junior Admin'}
            </span>
          )}
          <span className="id-tag" style={{ background: mode === 'live' ? '#004D51' : '#64748B' }} title={mode === 'live' ? 'Connected to Google Sheets' : 'Demo data saved in this browser only'}>
            {mode === 'live' ? 'Google Sheets' : 'Demo mode'}
          </span>
          <button type="button" className="btn-outline-sm inline-flex items-center gap-1" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </header>

      {status === 'locked' && <UnlockForm />}
      {status === 'loading' && <div className="box-card text-center">Loading portal records…</div>}
      {status === 'error' && (
        <div className="box-card text-center">
          <p className="font-bold text-red-700">{error || 'Could not reach the portal server.'}</p>
          <button className="btn-teal mt-4" onClick={load}>Try again</button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <nav className="main-nav" aria-label="Management portal">
            {visible.map((p) => {
              const Icon = ICONS[p.key];
              return (
                <button key={p.key} type="button" className={`nav-btn ${tab === p.key ? 'active' : ''}`} onClick={() => setTab(p.key)} aria-current={tab === p.key}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {p.label}
                  
                </button>
              );
            })}
          </nav>
          {tab === 'dashboard' && canOpen('dashboard') && (
            <Suspense fallback={<div className="box-card text-center">Loading charts…</div>}>
              <Dashboard />
            </Suspense>
          )}
          {tab === 'salary' && canOpen('salary') && <SalaryDirectory />}
          {tab === 'students' && <StudentRoster onEnroll={() => setTab('enrollStudent')} />}
          {tab === 'reports' && <ProgressReports />}
          {tab === 'enrollTeacher' && <EnrollTeachers />}
          {tab === 'enrollStudent' && <EnrollStudents />}
          {tab === 'contents' && canOpen('contents') && (
            <Suspense fallback={<div className="box-card text-center">Loading…</div>}>
              <PortalContents />
            </Suspense>
          )}
        </>
      )}
    </div>
  );
}

// Bangla font for reports, loaded only when the portal is opened
function useBanglaFont() {
  useEffect(() => {
    const id = 'hind-siliguri-font';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }, []);
}

export default function ManagementPortal() {
  useBanglaFont();
  return (
    <PortalProvider>
      <PortalShell />
    </PortalProvider>
  );
}
