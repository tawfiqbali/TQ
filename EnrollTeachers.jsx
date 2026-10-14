import { useState } from 'react';
import { usePortal } from '../PortalContext';
import { BD_BANKS, CATEGORIES, DEPARTMENTS, PAYMENT_METHODS } from '../lib/constants';
import Combobox from '../components/Combobox';
import { SALARY_TYPES } from './common';

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c.value, label: c.short }));
const blank = () => ({ key: Math.random().toString(36).slice(2), name: '', category: 'Residential', department: '', salaryType: 'Per-Student', packageAmount: '', method: 'Bank', account: '', bankName: '', branchName: '' });

// Bulk teacher entry. IDs (QIT-T001…) are assigned by the server.
export default function EnrollTeachers() {
  const { addTeachers } = usePortal();
  const [rows, setRows] = useState([blank(), blank()]);
  const [busy, setBusy] = useState(false);
  const update = (key, field, value) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, [field]: value };
        if (field === 'salaryType' && value !== 'Package') next.packageAmount = '';
        if (field === 'method' && value !== 'Bank') Object.assign(next, { bankName: '', branchName: '' });
        return next;
      }),
    );

  const submit = async (e) => {
    e.preventDefault();
    const payload = rows
      .filter((r) => r.name.trim() || r.account.trim() || Number(r.packageAmount) > 0 || r.branchName.trim())
      .map((r, i) => ({
        id: `NEW-T${Date.now()}-${i}`,
        name: r.name.trim() || 'Unnamed Teacher',
        category: r.category,
        department: r.department,
        whatsapp: 'N/A',
        method: r.method,
        account: r.account.trim() || 'N/A',
        salaryType: r.salaryType,
        packageAmount: r.salaryType === 'Package' ? Number(r.packageAmount) || 0 : 0,
        bankName: r.method === 'Bank' ? r.bankName : '',
        branchName: r.method === 'Bank' ? r.branchName.trim() : '',
        status: 'Active',
      }));
    if (!payload.length) return;
    setBusy(true);
    await addTeachers(payload);
    setBusy(false);
    setRows([blank(), blank()]);
  };

  return (
    <div className="box-card">
      <div className="card-header-bar">
        <h2 className="card-title">Enroll teacher(s)</h2>
        <span className="text-sm font-bold" style={{ color: 'var(--c-teal-mid)' }}>Auto-generates sequential QIT ID</span>
      </div>
      <form onSubmit={submit}>
        <div className="table-wrap">
          <table className="dynamic-table" style={{ minWidth: 1180 }}>
            <thead>
              <tr><th>Teacher Full Name</th><th>Panel Category</th><th>Department</th><th>Salary Type</th><th>Fixed Salary</th><th>Method</th><th>Account/Mobile</th><th>Bank Name</th><th>Branch</th><th aria-label="Remove" /></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isBank = r.method === 'Bank';
                return (
                  <tr key={r.key}>
                    <td><input className="m-input" placeholder="Full Name" value={r.name} onChange={(e) => update(r.key, 'name', e.target.value)} aria-label="Teacher name" /></td>
                    <td><Combobox value={r.category} onChange={(v) => update(r.key, 'category', v)} options={CATEGORY_OPTIONS} aria-label="Category" /></td>
                    <td><Combobox value={r.department} onChange={(v) => update(r.key, 'department', v)} options={DEPARTMENTS} placeholder="Select dept." aria-label="Department" /></td>
                    <td><Combobox value={r.salaryType} onChange={(v) => update(r.key, 'salaryType', v)} options={SALARY_TYPES} aria-label="Salary type" /></td>
                    <td><input type="number" min="0" className="m-input in-cut" placeholder="0" disabled={r.salaryType !== 'Package'} value={r.packageAmount} onChange={(e) => update(r.key, 'packageAmount', e.target.value)} aria-label="Fixed salary" /></td>
                    <td><Combobox value={r.method} onChange={(v) => update(r.key, 'method', v)} options={PAYMENT_METHODS} aria-label="Payment method" /></td>
                    <td><input className="m-input" placeholder="Account / Ref" value={r.account} onChange={(e) => update(r.key, 'account', e.target.value)} aria-label="Account" /></td>
                    <td><Combobox disabled={!isBank} value={r.bankName} onChange={(v) => update(r.key, 'bankName', v)} options={BD_BANKS} placeholder="Search bank…" aria-label="Bank name" /></td>
                    <td><input className="m-input" placeholder="Branch" disabled={!isBank} value={r.branchName} onChange={(e) => update(r.key, 'branchName', e.target.value)} aria-label="Branch" /></td>
                    <td>
                      <button type="button" className="btn-del-row" aria-label="Remove row" onClick={() => (rows.length > 1 ? setRows(rows.filter((x) => x.key !== r.key)) : window.alert('At least one entry row is required.'))}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn-add-row" onClick={() => setRows([...rows, blank()])}>+ Add Another Teacher</button>
          <button type="submit" className="btn-teal" disabled={busy}>{busy ? 'Saving…' : 'Save All Teachers'}</button>
        </div>
      </form>
    </div>
  );
}
