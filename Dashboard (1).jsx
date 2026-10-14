import { useEffect, useMemo, useRef } from 'react';
import Chart from 'chart.js/auto';
import { usePortal } from '../PortalContext';
import { MONTHS, currentMonthName, fmt } from '../lib/constants';

function useChart(config) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return undefined;
    const chart = new Chart(ref.current, config);
    return () => chart.destroy();
  }, [config]);
  return ref;
}

const chartFont = { family: "Bahnschrift, 'Barlow', 'Hind Siliguri', sans-serif", weight: '700' };
const TEAL = ['#00373D', '#004D51', '#0F766E', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'];

// Financial overview (Super Admin only)
export default function Dashboard() {
  const { db } = usePortal();

  const stats = useMemo(() => {
    const totalStudents = db.students.length;
    const totalTeachers = db.teachers.length;
    const totalTuition = db.students.reduce((s, x) => s + (x.fee || 0), 0);
    const totalSalary = db.teachers.reduce((sum, t) => {
      if (t.salaryType === 'Package') return sum + (t.packageAmount || 0);
      return sum + db.students.filter((s) => s.teacherId === t.id).reduce((a, s) => a + (s.cut || 0), 0);
    }, 0);
    const month = currentMonthName();
    const year = String(new Date().getFullYear());
    const reported = new Set(db.reports.filter((r) => r.month === month && String(r.year) === year).map((r) => r.studentId));
    const paidThisMonth = db.payments.filter((p) => p.month === month && String(p.year) === year).reduce((s, p) => s + (p.amount || 0), 0);
    return {
      totalStudents,
      totalTeachers,
      totalTuition,
      totalSalary,
      net: totalTuition - totalSalary,
      reportedCount: reported.size,
      reportPct: totalStudents ? ((reported.size / totalStudents) * 100).toFixed(1) : '0',
      avgLoad: totalTeachers ? (totalStudents / totalTeachers).toFixed(1) : '0',
      paidThisMonth,
      payPct: totalSalary ? ((paidThisMonth / totalSalary) * 100).toFixed(1) : '0',
      year,
    };
  }, [db]);

  const revenueCfg = useMemo(
    () => ({
      type: 'doughnut',
      data: {
        labels: ['Faculty Salary', 'Institute Retention'],
        datasets: [{ data: [stats.totalSalary, Math.max(0, stats.net)], backgroundColor: ['#004D51', '#10B981'], borderColor: '#fff', borderWidth: 3, hoverOffset: 8 }],
      },
      options: {
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { font: chartFont, padding: 16, usePointStyle: true } },
          tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed.toLocaleString()} BDT` } },
        },
      },
    }),
    [stats.totalSalary, stats.net],
  );

  const categoryCfg = useMemo(() => {
    const count = (c) => db.teachers.filter((t) => t.category === c).length;
    return {
      type: 'bar',
      data: {
        labels: ['Residential', 'Non-Res. Male', 'Non-Res. Female'],
        datasets: [{ label: 'Teachers', data: [count('Residential'), count('Non-Residential Male'), count('Non-Residential Female')], backgroundColor: ['#00373D', '#0F766E', '#34D399'], borderRadius: 8, barThickness: 42 }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { font: chartFont, stepSize: 1 } }, x: { ticks: { font: chartFont }, grid: { display: false } } },
      },
    };
  }, [db.teachers]);

  const perTeacherCfg = useMemo(() => {
    const rows = db.teachers
      .map((t) => {
        const assigned = db.students.filter((s) => s.teacherId === t.id);
        return { name: t.name.length > 18 ? `${t.name.slice(0, 16)}…` : t.name, revenue: assigned.reduce((s, x) => s + x.fee, 0), count: assigned.length };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
    return {
      type: 'bar',
      data: { labels: rows.map((r) => r.name), datasets: [{ label: 'Tuition Revenue', data: rows.map((r) => r.revenue), backgroundColor: TEAL.slice(0, rows.length), borderRadius: 6, barThickness: 20 }] },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.parsed.x.toLocaleString()} BDT (${rows[c.dataIndex].count} students)` } } },
        scales: { x: { beginAtZero: true, ticks: { font: chartFont, callback: (v) => `${v / 1000}K` } }, y: { ticks: { font: chartFont }, grid: { display: false } } },
      },
    };
  }, [db.teachers, db.students]);

  const monthlyCfg = useMemo(() => {
    const totals = MONTHS.map((m) => db.payments.filter((p) => p.month === m && String(p.year) === stats.year).reduce((s, p) => s + (p.amount || 0), 0));
    const cur = new Date().getMonth();
    return {
      type: 'bar',
      data: { labels: MONTHS.map((m) => m.slice(0, 3)), datasets: [{ label: 'Disbursed', data: totals, backgroundColor: totals.map((_, i) => (i === cur ? '#D97706' : '#004D51')), borderRadius: 6, barThickness: 22 }] },
      options: {
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.parsed.y.toLocaleString()} BDT` } } },
        scales: { y: { beginAtZero: true, ticks: { font: chartFont, callback: (v) => `${v / 1000}K` } }, x: { ticks: { font: chartFont }, grid: { display: false } } },
      },
    };
  }, [db.payments, stats.year]);

  const r1 = useChart(revenueCfg);
  const r2 = useChart(categoryCfg);
  const r3 = useChart(perTeacherCfg);
  const r4 = useChart(monthlyCfg);

  return (
    <div className="box-card">
      <div className="card-header-bar">
        <h2 className="card-title">Management overview</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <div className="tile"><div className="tile-label">Total Students</div><div className="tile-value">{stats.totalStudents}</div></div>
        <div className="tile"><div className="tile-label">Active Faculty</div><div className="tile-value">{stats.totalTeachers}</div></div>
        <div className="tile" style={{ background: '#F0FDFA', borderColor: '#99F6E4' }}>
          <div className="tile-label" style={{ color: '#0F766E' }}>Tuition Volume</div>
          <div className="tile-value" style={{ color: '#0F766E' }}>{fmt(stats.totalTuition)} BDT</div>
        </div>
        <div className="tile" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <div className="tile-label" style={{ color: '#D97706' }}>Net Institute Retention</div>
          <div className="tile-value" style={{ color: '#D97706' }}>{fmt(stats.net)} BDT</div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="dash-stat" style={{ background: '#F0FDF4', borderColor: '#86EFAC' }}>
          <div className="tile-label" style={{ color: '#065F46' }}>📋 Report Completion</div>
          <div className="tile-value" style={{ color: '#166534', marginTop: 0 }}>{stats.reportPct}%</div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, stats.reportPct)}%`, background: 'linear-gradient(90deg,#10B981,#059669)' }} /></div>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{stats.reportedCount} / {stats.totalStudents} students reported this month</div>
        </div>
        <div className="dash-stat" style={{ background: '#EFF6FF', borderColor: '#93C5FD' }}>
          <div className="tile-label" style={{ color: '#1E40AF' }}>👨‍🏫 Avg. Teacher Load</div>
          <div className="tile-value" style={{ color: '#1D4ED8', marginTop: 0 }}>{stats.avgLoad}</div>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>students per teacher ({stats.totalStudents} total)</div>
        </div>
        <div className="dash-stat" style={{ background: '#F5F3FF', borderColor: '#C4B5FD' }}>
          <div className="tile-label" style={{ color: '#6D28D9' }}>💰 Total Salary Obligation</div>
          <div className="tile-value" style={{ color: '#7C3AED', marginTop: 0 }}>{fmt(stats.totalSalary)} BDT</div>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>faculty compensation this month</div>
        </div>
        <div className="dash-stat" style={{ background: '#FFF7ED', borderColor: '#FDBA74' }}>
          <div className="tile-label" style={{ color: '#C2410C' }}>📊 Payment Completion</div>
          <div className="tile-value" style={{ color: '#EA580C', marginTop: 0 }}>{stats.payPct}%</div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, stats.payPct)}%`, background: 'linear-gradient(90deg,#F59E0B,#D97706)' }} /></div>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{fmt(stats.paidThisMonth)} / {fmt(stats.totalSalary)} BDT disbursed</div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="chart-box"><div className="chart-title">Revenue Distribution</div><div className="mx-auto max-w-xs"><canvas ref={r1} /></div></div>
        <div className="chart-box"><div className="chart-title">Faculty Category Distribution</div><canvas ref={r2} /></div>
        <div className="chart-box"><div className="chart-title">Student Revenue Per Teacher (Top 8)</div><canvas ref={r3} /></div>
        <div className="chart-box"><div className="chart-title">Monthly Payment Trends</div><canvas ref={r4} /></div>
      </div>
    </div>
  );
}
