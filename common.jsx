import { useEffect, useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { usePortal } from '../PortalContext';
import { BD_BANKS, CATEGORIES, DEPARTMENTS, PAYMENT_METHODS, joinPhones, splitPhones } from '../lib/constants';
import Combobox from '../components/Combobox';

// Open pop-ups, newest last: Esc closes only the one on top
const openModals = [];

export function PortalModal({ children, onClose, className = '', labelledBy }) {
  useEffect(() => {
    const token = {};
    openModals.push(token);
    const onKey = (e) => e.key === 'Escape' && openModals[openModals.length - 1] === token && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      openModals.splice(openModals.indexOf(token), 1);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="qit-portal qit-portal-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-card ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>
  );
}

export function EditIconButton({ onClick, label }) {
  return (
    <button type="button" className="btn-icon-edit" title={label} aria-label={label} onClick={onClick}>
      <Pencil className="h-4 w-4" />
    </button>
  );
}

// Options for a "pick a teacher" dropdown, grouped by panel
export function teacherOptions(teachers, { none = '-- Unassigned --' } = {}) {
  const out = none ? [{ value: '', label: none }] : [];
  CATEGORIES.forEach((c) =>
    teachers
      .filter((t) => t.category === c.value)
      .forEach((t) => out.push({ value: t.id, group: c.label, label: `${t.name} (${t.id})${t.salaryType === 'Package' ? ' [Fixed Salary]' : ''}` })),
  );
  return out;
}

// One input per WhatsApp number, with + / × buttons
export function PhoneListInput({ value, onChange, compact = false }) {
  const list = value.length ? value : [''];
  const setAt = (i, v) => onChange(list.map((x, j) => (j === i ? v : x)));
  return (
    <div className={`phone-list ${compact ? 'compact' : ''}`}>
      {list.map((p, i) => (
        <div key={i} className="phone-row">
          <input
            className="m-input"
            inputMode="tel"
            placeholder={i === 0 ? 'WhatsApp number' : `WhatsApp number ${i + 1}`}
            value={p}
            onChange={(e) => setAt(i, e.target.value)}
            aria-label={`WhatsApp number ${i + 1}`}
          />
          {list.length > 1 && (
            <button type="button" className="phone-remove" onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label={`Remove number ${i + 1}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      <button type="button" className="phone-add" onClick={() => onChange([...list, ''])}>
        <Plus className="h-3.5 w-3.5" /> Add number
      </button>
    </div>
  );
}

export function EditStudentModal({ student, onClose }) {
  const { db, updateStudent, deleteStudent, isSuper } = usePortal();
  const [v, setV] = useState({
    name: student.name,
    phones: splitPhones(student.phone),
    classTime: student.classTime || '',
    teacherId: student.teacherId || '',
    fee: student.fee,
    cut: student.cut,
  });
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const save = () => {
    updateStudent({
      id: student.id,
      name: v.name.trim() || 'Unnamed Student',
      phone: joinPhones(v.phones),
      classTime: v.classTime.trim(),
      teacherId: v.teacherId,
      fee: Number(v.fee) || 0,
      // Junior Admins never see or change the teacher's share
      ...(isSuper ? { cut: Number(v.cut) || 0 } : {}),
    });
    onClose();
  };
  const remove = () => {
    if (!window.confirm(`Delete student ${student.name}? This cannot be undone.`)) return;
    deleteStudent(student.id);
    onClose();
  };
  return (
    <PortalModal onClose={onClose} labelledBy="edit-student-title">
      <div className="mb-4 flex items-center justify-between">
        <h3 id="edit-student-title" className="text-lg font-extrabold">Edit Student</h3>
        <span className="id-tag">{student.id}</span>
      </div>
      <div className="form-group"><label>Student Full Name</label><input className="m-input" value={v.name} onChange={set('name')} /></div>
      <div className="form-group"><label>WhatsApp Number(s)</label><PhoneListInput value={v.phones} onChange={(phones) => setV((x) => ({ ...x, phones }))} /></div>
      <div className="form-group"><label>Class Time</label><input className="m-input" value={v.classTime} onChange={set('classTime')} /></div>
      <div className="form-group">
        <label>Assigned Teacher</label>
        <Combobox value={v.teacherId} onChange={(teacherId) => setV((x) => ({ ...x, teacherId }))} options={teacherOptions(db.teachers)} aria-label="Assigned teacher" />
      </div>
      <div className={isSuper ? 'grid grid-cols-2 gap-3' : ''}>
        <div className="form-group"><label>Monthly Tuition (BDT)</label><input type="number" min="0" className="m-input in-fee" value={v.fee} onChange={set('fee')} /></div>
        {isSuper && <div className="form-group"><label>Teacher Share Cut (BDT)</label><input type="number" min="0" className="m-input in-cut" value={v.cut} onChange={set('cut')} /></div>}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <button type="button" className="btn-danger" onClick={remove}>Delete</button>
        <div className="flex gap-2">
          <button type="button" className="btn-teal" onClick={save}>Save</button>
          <button type="button" className="btn-muted" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </PortalModal>
  );
}

export const SALARY_TYPES = [
  { value: 'Per-Student', label: 'Per-Student' },
  { value: 'Package', label: 'Fixed Salary' },
];

export function EditTeacherModal({ teacher, onClose, onDeleted }) {
  const { db, updateTeacher, deleteTeacher } = usePortal();
  const [v, setV] = useState({
    name: teacher.name,
    category: teacher.category,
    department: teacher.department || '',
    salaryType: teacher.salaryType || 'Per-Student',
    packageAmount: teacher.packageAmount || 0,
    whatsapp: teacher.whatsapp === 'N/A' ? '' : teacher.whatsapp || '',
    method: teacher.method || 'Bank',
    bankName: teacher.bankName || '',
    branchName: teacher.branchName || '',
    account: teacher.account === 'N/A' ? '' : teacher.account || '',
  });
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const pick = (k) => (value) => setV((x) => ({ ...x, [k]: value }));
  const isBank = v.method === 'Bank';
  const save = () => {
    if (!v.name.trim()) return;
    updateTeacher({
      id: teacher.id,
      name: v.name.trim(),
      category: v.category,
      department: v.department,
      salaryType: v.salaryType,
      packageAmount: v.salaryType === 'Package' ? Number(v.packageAmount) || 0 : 0,
      whatsapp: v.whatsapp.trim() || 'N/A',
      method: v.method,
      bankName: isBank ? v.bankName : '',
      branchName: isBank ? v.branchName.trim() : '',
      account: v.account.trim() || 'N/A',
    });
    onClose();
  };
  const remove = () => {
    if (db.students.some((s) => s.teacherId === teacher.id)) {
      window.alert("Reassign or remove this teacher's students first.");
      return;
    }
    if (!window.confirm(`Delete teacher ${teacher.name}?`)) return;
    deleteTeacher(teacher.id);
    onClose();
    onDeleted?.();
  };
  return (
    <PortalModal onClose={onClose} labelledBy="edit-teacher-title">
      <div className="mb-4 flex items-center justify-between">
        <h3 id="edit-teacher-title" className="text-lg font-extrabold">Edit Teacher</h3>
        <span className="id-tag">{teacher.id}</span>
      </div>
      <div className="form-group"><label>Teacher Full Name</label><input className="m-input" value={v.name} onChange={set('name')} required /></div>
      <div className="form-group">
        <label>Panel Category</label>
        <Combobox value={v.category} onChange={pick('category')} options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} aria-label="Panel category" />
      </div>
      <div className="form-group">
        <label>Department</label>
        <Combobox value={v.department} onChange={pick('department')} options={[{ value: '', label: '-- Not set --' }, ...DEPARTMENTS]} aria-label="Department" />
      </div>
      <div className="form-group">
        <label>Salary Model</label>
        <Combobox value={v.salaryType} onChange={pick('salaryType')} options={SALARY_TYPES} aria-label="Salary model" />
      </div>
      {v.salaryType === 'Package' && (
        <div className="form-group"><label>Fixed Salary Amount (BDT)</label><input type="number" min="0" className="m-input in-cut" value={v.packageAmount} onChange={set('packageAmount')} /></div>
      )}
      <div className="form-group"><label>WhatsApp Contact</label><input className="m-input" value={v.whatsapp} onChange={set('whatsapp')} /></div>
      <div className="form-group">
        <label>Payment Method</label>
        <Combobox value={v.method} onChange={pick('method')} options={PAYMENT_METHODS} aria-label="Payment method" />
      </div>
      {isBank && (
        <>
          <div className="form-group">
            <label>Bank Name</label>
            <Combobox value={v.bankName} onChange={pick('bankName')} options={BD_BANKS} placeholder="Type to search banks…" aria-label="Bank name" />
          </div>
          <div className="form-group"><label>Branch Name</label><input className="m-input" placeholder="e.g. Mirpur Branch" value={v.branchName} onChange={set('branchName')} /></div>
        </>
      )}
      <div className="form-group"><label>Account Number / Ref</label><input className="m-input" value={v.account} onChange={set('account')} /></div>
      <div className="mt-5 flex items-center justify-between">
        <button type="button" className="btn-danger" onClick={remove}>Delete</button>
        <div className="flex gap-2">
          <button type="button" className="btn-teal" onClick={save}>Save</button>
          <button type="button" className="btn-muted" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </PortalModal>
  );
}
