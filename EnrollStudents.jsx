import { useState } from 'react';
import { usePortal } from '../PortalContext';
import { joinPhones } from '../lib/constants';
import Combobox from '../components/Combobox';
import { PhoneListInput, teacherOptions } from './common';

const blank = () => ({ key: Math.random().toString(36).slice(2), name: '', phones: [''], classTime: '', teacherId: '', fee: '', cut: '', isPkg: false, pkgVal: 0 });

// Bulk student entry with teacher cut or fixed-salary mode. All fields optional.
export default function EnrollStudents() {
  const { db, addStudents, isSuper } = usePortal();
  const options = teacherOptions(db.teachers);
  const [rows, setRows] = useState([blank(), blank()]);
  const [busy, setBusy] = useState(false);
  const patch = (key, changes) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...changes } : r)));

  const onTeacher = (r, teacherId) => {
    const t = db.teachers.find((x) => x.id === teacherId);
    if (isSuper && t && t.salaryType === 'Package') patch(r.key, { teacherId, isPkg: true, pkgVal: t.packageAmount || 0, cut: '0' });
    else patch(r.key, { teacherId });
  };

  const togglePkg = (r) => {
    if (r.isPkg) return patch(r.key, { isPkg: false, pkgVal: 0, cut: '' });
    const t = db.teachers.find((x) => x.id === r.teacherId);
    const amount = t && t.salaryType === 'Package' ? t.packageAmount : t && t.category === 'Residential' ? 17000 : 15000;
    patch(r.key, { isPkg: true, pkgVal: amount, cut: '0' });
  };

  const pctOf = (r) => {
    if (r.isPkg) return { text: 'Fixed', cls: 'med' };
    const fee = Number(r.fee) || 0;
    const cut = Number(r.cut) || 0;
    if (!fee) return { text: '0.0%', cls: 'low' };
    const p = (cut / fee) * 100;
    return { text: `${p.toFixed(1)}%`, cls: p >= 50 ? 'high' : p >= 30 ? 'med' : 'low' };
  };

  const submit = async (e) => {
    e.preventDefault();
    const students = [];
    const teacherUpdates = [];
    rows.forEach((r, i) => {
      const fee = Number(r.fee) || 0;
      // Junior Admins don't set the teacher's share; a Super Admin adds it later
      const cut = !isSuper || r.isPkg ? 0 : Number(r.cut) || 0;
      const phone = joinPhones(r.phones);
      const empty = !r.name.trim() && phone === 'N/A' && !r.classTime.trim() && !r.teacherId && !fee && !cut && !r.isPkg;
      if (empty) return;
      students.push({
        id: `NEW-S${Date.now()}-${i}`,
        name: r.name.trim() || 'Unnamed Student',
        phone,
        teacherId: r.teacherId,
        fee,
        cut,
        course: 'Quran & Tajweed',
        status: 'Active',
        classTime: r.classTime.trim(),
      });
      if (isSuper && r.isPkg && r.teacherId && !teacherUpdates.some((u) => u.id === r.teacherId)) teacherUpdates.push({ id: r.teacherId, packageAmount: Number(r.pkgVal) || 0 });
    });
    if (!students.length) return;
    setBusy(true);
    await addStudents(students, teacherUpdates);
    setBusy(false);
    setRows([blank(), blank()]);
  };

  return (
    <div className="box-card">
      <div className="card-header-bar">
        <h2 className="card-title">Enroll student(s) &amp; assign salary cut</h2>
        <span className="text-sm font-bold" style={{ color: 'var(--c-teal-mid)' }}>
          {isSuper ? 'Assign Cut or Convert to Fixed Salary — all fields optional' : 'All fields optional'}
        </span>
      </div>
      <form onSubmit={submit}>
        <div className="table-wrap">
          <table className="dynamic-table" style={{ minWidth: isSuper ? 1240 : 1000 }}>
            <thead>
              <tr>
                <th>Student Full Name</th><th>WhatsApp Number(s)</th><th>Class Time</th><th>Assigned Teacher</th><th>Monthly Fee (BDT)</th>
                {isSuper && <><th>Teacher Cut / Model</th><th>Teacher %</th></>}
                <th aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = pctOf(r);
                return (
                  <tr key={r.key}>
                    <td style={{ minWidth: 180 }}><input className="m-input" placeholder="Student Name" value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} aria-label="Student name" /></td>
                    <td><PhoneListInput compact value={r.phones} onChange={(phones) => patch(r.key, { phones })} /></td>
                    <td style={{ minWidth: 170 }}><input className="m-input" placeholder="e.g. 5:00 PM - 6:00 PM" value={r.classTime} onChange={(e) => patch(r.key, { classTime: e.target.value })} aria-label="Class time" /></td>
                    <td style={{ minWidth: 220 }}><Combobox value={r.teacherId} onChange={(v) => onTeacher(r, v)} options={options} placeholder="Search teacher…" aria-label="Assigned teacher" /></td>
                    <td><input type="number" min="0" className="m-input in-fee" placeholder="0" value={r.fee} onChange={(e) => patch(r.key, { fee: e.target.value })} aria-label="Monthly fee" /></td>
                    {isSuper && <><td>
                      <div className="flex flex-col gap-1">
                        <input type="number" min="0" className="m-input in-cut" placeholder="0" disabled={r.isPkg} value={r.cut} onChange={(e) => patch(r.key, { cut: e.target.value })} aria-label="Teacher cut" />
                        <button type="button" className={`btn-pkg-toggle ${r.isPkg ? 'active' : ''}`} onClick={() => togglePkg(r)}>
                          {r.isPkg ? `Fixed Salary (${Number(r.pkgVal).toLocaleString()} BDT)` : '+ Fixed Salary Mode'}
                        </button>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className={`pct-tag ${pct.cls}`}>{pct.text}</span></td></>}
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
          <button type="button" className="btn-add-row" onClick={() => setRows([...rows, blank()])}>+ Add Another Student</button>
          <button type="submit" className="btn-teal" disabled={busy}>{busy ? 'Saving…' : 'Save All Students'}</button>
        </div>
      </form>
    </div>
  );
}
