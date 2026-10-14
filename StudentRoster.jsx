import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { usePortal } from '../PortalContext';
import { fmt, splitPhones } from '../lib/constants';
import { EditIconButton, EditStudentModal } from './common';

export default function StudentRoster({ onEnroll }) {
  const { db, isSuper } = usePortal();
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');
  const teacherName = (id) => db.teachers.find((t) => t.id === id)?.name || id || 'Unassigned';

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return db.students;
    return db.students.filter((s) => `${s.name} ${s.id} ${s.phone} ${teacherName(s.teacherId)}`.toLowerCase().includes(term));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.students, db.teachers, q]);

  return (
    <div className="box-card">
      <div className="card-header-bar">
        <h2 className="card-title">Student roster</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="roster-search">
            <span className="sr-only">Search students</span>
            <Search aria-hidden="true" />
            <input type="search" className="m-input" placeholder="Search name, ID, phone" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button type="button" className="btn-teal" onClick={onEnroll}>+ Enroll New</button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="salary-table" style={{ minWidth: isSuper ? 760 : 640 }}>
          <thead>
            <tr>
              <th>Student Profile</th><th>Class Time</th><th>Assigned Faculty</th><th>Monthly Tuition</th>
              {/* Teacher Share is salary information: Super Admins only */}
              {isSuper && <th>Teacher Share</th>}
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={isSuper ? 6 : 5} style={{ textAlign: 'center', padding: 18 }}>{db.students.length ? 'No students match your search.' : 'No students enrolled yet.'}</td></tr>}
            {rows.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong> ({s.id})<br />{splitPhones(s.phone).map((p) => <span key={p} className="block text-xs" style={{ color: 'var(--text-muted)' }}>{p}</span>)}</td>
                <td><strong>{s.classTime || '—'}</strong></td>
                <td>{teacherName(s.teacherId)}</td>
                <td><strong>{fmt(s.fee)} BDT</strong></td>
                {isSuper && <td><strong>{fmt(s.cut)} BDT</strong></td>}
                <td style={{ textAlign: 'right' }}><EditIconButton label={`Edit ${s.name}`} onClick={() => setEditing(s)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <EditStudentModal student={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
