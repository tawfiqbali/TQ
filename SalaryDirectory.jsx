import { useMemo, useState } from 'react';
import { ArrowLeft, FileBadge, Monitor, Search, X } from 'lucide-react';
import { usePortal } from '../PortalContext';
import { CATEGORIES, MONTHS, currentMonthName, fmt, previousMonthOf, splitPhones, yearsWith } from '../lib/constants';
import Combobox from '../components/Combobox';
import { EditIconButton, EditStudentModal, EditTeacherModal, PortalModal } from './common';
import SalaryCertificate from './SalaryCertificate';

// The Salary Directory is only reachable by a Super Admin (checked by the
// portal and by the Apps Script), so it no longer asks for a separate PIN.

function MonthYear({ month, year, onMonth, onYear, label = 'Period' }) {
  return (
    <div className="filter-cluster">
      <span className="filter-label">{label}</span>
      <Combobox variant="pill" value={month} onChange={onMonth} options={MONTHS} aria-label={`${label} month`} />
      <Combobox variant="pill" className="qcb-year" value={year} onChange={onYear} options={yearsWith(year)} aria-label={`${label} year`} />
    </div>
  );
}
const PeriodPicker = MonthYear;

// Teacher department tag (Bangla Dept. / English Dept.)
function DeptTag({ department }) {
  if (!department) return <span className="dept-tag empty">No Department</span>;
  return <span className={`dept-tag ${/bangla/i.test(department) ? 'bn' : 'en'}`}>{department}</span>;
}

// Salary figures for one teacher in one month
function teacherFigures(t, db, month, year) {
  const assigned = db.students.filter((s) => s.teacherId === t.id);
  const tuition = assigned.reduce((a, s) => a + s.fee, 0);
  const isPkg = t.salaryType === 'Package';
  const salary = isPkg ? Number(t.packageAmount || 0) : assigned.reduce((a, s) => a + s.cut, 0);
  const payments = db.payments.filter((p) => p.teacherId === t.id && p.month === month && String(p.year) === String(year));
  const paid = payments.reduce((a, p) => a + p.amount, 0);
  return { assigned, tuition, isPkg, salary, payments, paid, due: salary - paid, sharePct: tuition > 0 ? ((salary / tuition) * 100).toFixed(1) : '0.0' };
}

function bankLine(t) {
  if (t.method === 'Bank' && t.bankName) return `Bank: ${t.bankName}${t.branchName ? ` (${t.branchName})` : ''} • Acc: ${t.account}`;
  return `Method: ${t.method} • Acc: ${t.account}`;
}

function TeacherWorkspace({ teacherId, initialMonth, initialYear, onClose }) {
  const { db, recordPayment, cancelPayment } = usePortal();
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [editTeacher, setEditTeacher] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [certificate, setCertificate] = useState(null);
  const t = db.teachers.find((x) => x.id === teacherId);
  const f = t ? teacherFigures(t, db, month, year) : null;
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  // Month the salary is paid FOR: defaults to the month before the payment
  // date (paid on 1 Sep → August). The admin can still change it.
  const [target, setTarget] = useState(() => previousMonthOf(new Date()));
  const [targetTouched, setTargetTouched] = useState(false);
  const targetFigures = t ? teacherFigures(t, db, target.month, target.year) : null;
  const [amount, setAmount] = useState(() => (targetFigures && targetFigures.due > 0 ? targetFigures.due : ''));
  if (!t) return null;

  const onDate = (value) => {
    setDate(value);
    // Follow the payment date until the admin picks a month by hand
    if (!targetTouched && value) {
      const next = previousMonthOf(new Date(`${value}T12:00:00`));
      setTarget(next);
      const tf = teacherFigures(t, db, next.month, next.year);
      setAmount(tf.due > 0 ? tf.due : '');
    }
  };
  const onTarget = (patch) => {
    const next = { ...target, ...patch };
    setTarget(next);
    setTargetTouched(true);
    const tf = teacherFigures(t, db, next.month, next.year);
    setAmount(tf.due > 0 ? tf.due : '');
  };

  const disburse = () => {
    const amt = Number(amount) || 0;
    if (amt <= 0) return window.alert('Enter a valid disbursement amount.');
    if (!window.confirm(`Disburse ${fmt(amt)} BDT to ${t.name} as salary for ${target.month} ${target.year}?`)) return;
    recordPayment({ id: `PAY-${Date.now()}`, teacherId: t.id, amount: amt, date, month: target.month, year: target.year });
    setAmount('');
    // Show the ledger of the month that was just paid
    setMonth(target.month);
    setYear(target.year);
  };

  return (
    <PortalModal onClose={onClose} className="wide" labelledBy="ws-title">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--c-box-border)' }}>
        <button type="button" className="btn-teal" onClick={onClose}><ArrowLeft className="h-4 w-4" /> Close Workspace</button>
        <PeriodPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
      </div>

      <div className="tile mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="ws-title" className="text-xl font-extrabold">{t.name}</h2>
            <span className="id-tag">{t.id}</span>
            {f.isPkg ? <span className="fixed-tag">Fixed Salary: {fmt(f.salary)} BDT</span> : <span className="per-student-tag">Per-Student Rate</span>}
            <DeptTag department={t.department} />
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Category: <strong>{t.category}</strong> • WhatsApp: <strong>{t.whatsapp}</strong> • {bankLine(t)}
          </p>
        </div>
        <button type="button" className="btn-teal" onClick={() => setEditTeacher(true)}>Edit Teacher Details</button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="tile" style={{ background: '#fff' }}><div className="tile-label">Total Revenue ({f.assigned.length} Students)</div><div className="tile-value text-xl">{fmt(f.tuition)} BDT</div></div>
        <div className="tile"><div className="tile-label">{f.isPkg ? 'Fixed Salary' : 'Faculty Cut'} ({f.sharePct}%)</div><div className="tile-value text-xl">{fmt(f.salary)} BDT</div></div>
        <div className="tile" style={{ background: '#F0FDFA', borderColor: '#99F6E4' }}><div className="tile-label" style={{ color: '#0F766E' }}>Disbursed ({month})</div><div className="tile-value text-xl" style={{ color: '#0F766E' }}>{fmt(f.paid)} BDT</div></div>
        <div className="tile" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}><div className="tile-label" style={{ color: '#D97706' }}>Due Balance Remaining</div><div className="tile-value text-xl" style={{ color: '#D97706' }}>{fmt(f.due)} BDT</div></div>
      </div>

      <h3 className="mb-2 text-sm font-extrabold uppercase">Assigned Students Roster</h3>
      <div className="table-wrap mb-5">
        <table className="salary-table">
          <thead><tr><th>Student Info</th><th>Student Fee</th><th>Teacher Share</th><th>Teacher %</th><th>Institute Net</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
          <tbody>
            {f.assigned.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No enrolled students assigned to this teacher yet.</td></tr>}
            {f.assigned.map((s) => {
              const share = f.isPkg ? (f.tuition > 0 ? s.fee * (f.salary / f.tuition) : 0) : s.cut;
              const pct = f.isPkg ? Number(f.sharePct) : s.fee > 0 ? (s.cut / s.fee) * 100 : 0;
              const badge = pct >= 50 ? 'high' : pct >= 30 ? 'med' : 'low';
              return (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong><div className="text-xs" style={{ color: 'var(--text-muted)' }}>WhatsApp: <strong>{splitPhones(s.phone).join(', ') || 'N/A'}</strong> • ({s.id})</div></td>
                  <td>{fmt(s.fee)} BDT</td>
                  <td><strong>{fmt(share)} BDT</strong> {f.isPkg && <span className="text-xs" style={{ color: 'var(--c-teal-mid)' }}>(Fixed)</span>}</td>
                  <td><span className={`pct-tag ${badge}`}>{pct.toFixed(1)}%</span></td>
                  <td className="font-bold">{fmt(s.fee - share)} BDT</td>
                  <td style={{ textAlign: 'right' }}><EditIconButton label={`Edit ${s.name}`} onClick={() => setEditStudent(s)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="payout-bar">
        <div className="text-sm font-bold">
          <div>Salary for: <strong>{target.month} {target.year}</strong> • Due: <strong style={{ color: '#D97706' }}>{fmt(targetFigures.due)} BDT</strong></div>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Set automatically to the month before the payment date; change it if needed.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="payout-field"><span>Payment date</span><input type="date" value={date} onChange={(e) => onDate(e.target.value)} aria-label="Disbursement date" /></label>
          <label className="payout-field"><span>Salary month</span>
            <span className="flex gap-1.5">
              <Combobox variant="pill" value={target.month} onChange={(m) => onTarget({ month: m })} options={MONTHS} aria-label="Salary month" />
              <Combobox variant="pill" className="qcb-year" value={target.year} onChange={(y) => onTarget({ year: y })} options={yearsWith(target.year)} aria-label="Salary year" />
            </span>
          </label>
          <label className="payout-field"><span>Amount (BDT)</span><input type="number" placeholder="BDT" className="w-28" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" /></label>
          <button type="button" className="btn-teal self-end" onClick={disburse}>Disburse</button>
          <button
            type="button"
            className="btn-outline-sm self-end inline-flex items-center gap-1.5"
            style={{ padding: '9px 12px' }}
            onClick={() => {
              // The viewed month if it has payments, otherwise the salary month above
              const useViewed = f.paid > 0;
              const cm = useViewed ? { month, year } : target;
              const paid = teacherFigures(t, db, cm.month, cm.year).paid;
              setCertificate({ month: cm.month, year: cm.year, amount: paid > 0 ? paid : f.salary });
            }}
          >
            <FileBadge className="h-4 w-4" /> Generate Salary Certificate
          </button>
        </div>
      </div>

      <h3 className="mb-2 mt-6 text-sm font-extrabold uppercase">Disbursed Payment History</h3>
      <div className="table-wrap">
        <table className="salary-table">
          <thead><tr><th>Payment ID</th><th>Amount Paid</th><th>Disbursement Date</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {f.payments.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No disbursements recorded for {month} {year}.</td></tr>}
            {f.payments.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.id}</strong></td>
                <td><strong style={{ color: '#0F766E' }}>{fmt(p.amount)} BDT</strong></td>
                <td>{p.date}</td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button" className="btn-danger" style={{ padding: '5px 12px' }} onClick={() => window.confirm('Cancel this payment?') && cancelPayment(p.id)}>Cancel</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editTeacher && <EditTeacherModal teacher={t} onClose={() => setEditTeacher(false)} onDeleted={onClose} />}
      {certificate && <SalaryCertificate teacher={t} {...certificate} onClose={() => setCertificate(null)} />}
      {editStudent && <EditStudentModal student={editStudent} onClose={() => setEditStudent(null)} />}
    </PortalModal>
  );
}

export default function SalaryDirectory() {
  const { db } = usePortal();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('Residential');
  const [month, setMonth] = useState(currentMonthName());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [openId, setOpenId] = useState(null);
  const [editTeacher, setEditTeacher] = useState(null);

  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.value, db.teachers.filter((t) => t.category === c.value).length])), [db.teachers]);

  // Search within the open category tab: name, ID, department, WhatsApp, account
  const term = q.trim().toLowerCase();
  const inTab = db.teachers.filter((t) => t.category === category);
  const list = term ? inTab.filter((t) => `${t.name} ${t.id} ${t.department || ''} ${t.whatsapp} ${t.account} ${t.method}`.toLowerCase().includes(term)) : inTab;

  return (
    <div className="box-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b-2 pb-3" style={{ borderColor: 'var(--c-box-border)' }}>
        <div className="flex flex-wrap gap-2" role="tablist">
          {CATEGORIES.map((c) => (
            <button key={c.value} type="button" role="tab" aria-selected={category === c.value} className={`dir-tab ${category === c.value ? 'active' : ''}`} onClick={() => setCategory(c.value)}>
              {c.label} <span className="count">{counts[c.value]}</span>
            </button>
          ))}
        </div>
        <PeriodPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
      </div>

      <div className="dir-search mb-5">
        <Search className="dir-search-icon" aria-hidden="true" />
        <input
          type="search"
          className="m-input"
          placeholder={`Search teachers in ${CATEGORIES.find((c) => c.value === category)?.label} — name, ID, department, phone…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search teachers in this category"
        />
        {q && <button type="button" className="dir-search-clear" onClick={() => setQ('')} aria-label="Clear search"><X className="h-4 w-4" /></button>}
        {term && <span className="dir-search-count">{list.length} of {inTab.length}</span>}
      </div>

      {list.length === 0 && (
        <p className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
          {term ? `No teachers in ${category} match “${q.trim()}”.` : `No faculty listed in ${category}.`}
        </p>
      )}
      {list.map((t) => {
        const f = teacherFigures(t, db, month, year);
        return (
          <div
            key={t.id}
            className="teacher-card"
            role="button"
            tabIndex={0}
            onClick={() => setOpenId(t.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpenId(t.id))}
          >
            <div className="teacher-card-top">
              <div className="flex flex-wrap items-center gap-3">
                <span className="t-name">{t.name}</span>
                <span className="id-tag">{t.id}</span>
                <span className={f.isPkg ? 'fixed-tag' : 'per-student-tag'}>{f.isPkg ? 'Fixed Salary' : 'Per-Student'}</span>
                <DeptTag department={t.department} />
              </div>
              <div className="card-right">
              <div className="metrics-bar">
                <div className="metric-col"><div className="metric-val">{fmt(f.tuition)} BDT</div><div className="metric-lbl">Total Tuition ({f.assigned.length} Students)</div></div>
                <div className="metric-col"><div className="metric-val">{fmt(f.salary)} BDT</div><div className="metric-lbl">{f.isPkg ? 'Fixed Salary' : 'Faculty Cut'} ({f.sharePct}%)</div></div>
                <div className="metric-col"><div className="metric-val" style={{ color: '#0F766E' }}>{fmt(f.paid)} BDT</div><div className="metric-lbl">Disbursed</div></div>
                <div className="metric-col"><div className="metric-val" style={{ color: '#D97706' }}>{fmt(f.due)} BDT</div><div className="metric-lbl">Due Balance</div></div>
              </div>
              <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <EditIconButton label={`Edit ${t.name}`} onClick={() => setEditTeacher(t)} />
              </span>
              </div>
            </div>
            <div className="teacher-strip">
              <span>WhatsApp: <strong>{t.whatsapp}</strong> • {bankLine(t)}</span>
              <span className="inline-flex items-center gap-1.5"><Monitor className="h-3.5 w-3.5" /> Click to open full student list &amp; disburse →</span>
            </div>
          </div>
        );
      })}

      {openId && <TeacherWorkspace teacherId={openId} initialMonth={month} initialYear={year} onClose={() => setOpenId(null)} />}
      {editTeacher && <EditTeacherModal teacher={editTeacher} onClose={() => setEditTeacher(null)} />}
    </div>
  );
}
