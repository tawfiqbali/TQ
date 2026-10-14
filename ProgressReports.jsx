import { useEffect, useMemo, useRef, useState } from 'react';
import { usePortal } from '../PortalContext';
import { GRADES, SKILL_OPTIONS, MONTHS, currentMonthName, translateText, yearsWith } from '../lib/constants';
import { usePortalContent } from '../lib/portalContent';
import Combobox from '../components/Combobox';
import { findMatchingStudent, parseTeacherMessages } from '../lib/whatsappParser';
import { DOSSIER_CSS, DOSSIER_PRINT_CSS } from '../dossier.css.js';
import Dossier from './Dossier';
import { PortalModal } from './common';

const LABELS = {
  EN: {
    student: 'Select Student', audience: 'Report Audience', template: 'Greeting Template', greeting: 'Customized Greeting Message',
    attended: 'Classes Attended', total: 'Total Classes', rate: 'Attendance Rate', grade: 'Overall Grade Score', header: 'QURANIC STUDY EVALUATION',
    tajweed: 'Tajweed & Pronunciation', hifz: 'Memorization / Hifz Progress', murajaah: "Muraja'ah Discipline", fluency: 'Noorani Qaida / Fluency',
    achievements: 'Key Achievements', goals: 'Next Development Goals', remarks: "Teacher's Certified Remarks", period: 'Report Period',
  },
  BN: {
    student: 'শিক্ষার্থী নির্বাচন করুন', audience: 'প্রতিবেদনের প্রাপক', template: 'শুভেচ্ছা বার্তার ধরণ', greeting: 'কাস্টমাইজড শুভেচ্ছা বার্তা',
    attended: 'উপস্থিত ক্লাস', total: 'মোট ক্লাস', rate: 'উপস্থিতির হার', grade: 'সার্বিক মূল্যায়ন', header: 'কুরআনিক শিক্ষা ও দক্ষতার সার্বিক অগ্রগতি',
    tajweed: 'তাজবীদ ও মাখরাজ', hifz: 'হিফজ / মুখস্থের নির্ভুলতা', murajaah: 'মুরাওয়াহা (রিভিশন) ধারাবাহিকতা', fluency: 'তিলাওয়াত ও কায়দা পাঠের গতি',
    achievements: 'বিশেষ অর্জন ও অগ্রগতি', goals: 'পরবর্তী উন্নয়ন লক্ষ্যমাত্রা', remarks: 'শিক্ষকের বিশেষ মন্তব্য ও দিকনির্দেশনা', period: 'প্রতিবেদনের মাস',
  },
};

// What a teacher's "study status" (from WhatsApp) sets on the form
const LEVEL_PRESETS = {
  excellent: { overallScore: GRADES[0], tajweed: SKILL_OPTIONS.tajweed[0], hifz: SKILL_OPTIONS.hifz[0], murajaah: SKILL_OPTIONS.murajaah[0], fluency: SKILL_OPTIONS.fluency[0] },
  veryGood: { overallScore: GRADES[1], tajweed: SKILL_OPTIONS.tajweed[1], hifz: SKILL_OPTIONS.hifz[0], murajaah: SKILL_OPTIONS.murajaah[0], fluency: SKILL_OPTIONS.fluency[0] },
  good: { overallScore: GRADES[2], tajweed: SKILL_OPTIONS.tajweed[1], hifz: SKILL_OPTIONS.hifz[1], murajaah: SKILL_OPTIONS.murajaah[1], fluency: SKILL_OPTIONS.fluency[1] },
  average: { overallScore: GRADES[3], tajweed: SKILL_OPTIONS.tajweed[2], hifz: SKILL_OPTIONS.hifz[1], murajaah: SKILL_OPTIONS.murajaah[1], fluency: SKILL_OPTIONS.fluency[1] },
  weak: { overallScore: GRADES[4], tajweed: SKILL_OPTIONS.tajweed[3], hifz: SKILL_OPTIONS.hifz[2], murajaah: SKILL_OPTIONS.murajaah[2], fluency: SKILL_OPTIONS.fluency[2] },
};
const LEVEL_NAMES = { excellent: 'Excellent', veryGood: 'Very good', good: 'Good', average: 'Average', weak: 'Needs improvement' };

const initial = (portal, lang = 'BN') => ({
  lang,
  studentId: '',
  reportType: 'Guardian',
  template: '1',
  greeting: portal.report[lang].greetings.Guardian[1],
  attended: 22,
  total: 24,
  overallScore: 'Outstanding (Grade A+)',
  tajweed: 'Excellent (90-100%)',
  hifz: 'Consistent & Accurate',
  murajaah: 'Daily & Thorough',
  fluency: 'High Fluency',
  month: currentMonthName(),
  year: String(new Date().getFullYear()),
  ...portal.report[lang].defaults,
});

export default function ProgressReports() {
  const { db, saveReport } = usePortal();
  const { value: portal } = usePortalContent();
  const [r, setR] = useState(() => initial(portal));
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState([]);
  const [manual, setManual] = useState({});
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);
  const formTop = useRef(null);
  const dossierRef = useRef(null);
  const t = LABELS[r.lang];
  const set = (k) => (e) => setR((x) => ({ ...x, [k]: e.target.value }));

  // Default to the first student once the roster loads
  useEffect(() => {
    if (!r.studentId && db.students.length) setR((x) => ({ ...x, studentId: db.students[0].id }));
  }, [db.students, r.studentId]);

  // Greeting follows language, audience and template (and resets per student)
  useEffect(() => {
    setR((x) => ({ ...x, greeting: portal.report[x.lang].greetings[x.reportType][x.template] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.lang, r.reportType, r.template, r.studentId]);

  const changeLang = (lang) => setR((x) => ({ ...x, lang, ...portal.report[lang].defaults }));

  const attPct = useMemo(() => {
    const tot = Number(r.total) || 1;
    return `${(((Number(r.attended) || 0) / tot) * 100).toFixed(1)}%`;
  }, [r.attended, r.total]);

  const student = db.students.find((s) => s.id === r.studentId);
  const teacher = student ? db.teachers.find((x) => x.id === student.teacherId) : null;
  const report = { ...r, attPct };

  /* ---- WhatsApp importer ---- */
  const detect = () => {
    if (!raw.trim()) return setNotice('Paste a WhatsApp report message first.');
    const list = parseTeacherMessages(raw);
    if (!list.length) return setNotice('Could not detect any report in that text — check the format.');
    setParsed(list);
    setManual({});
    setNotice(`Detected ${list.length} report(s) — review & apply below.`);
  };

  const apply = (p, matchedId) => {
    const studentId = matchedId || manual[p.rawText];
    if (!studentId) return setNotice('Pick a matching student for this report first.');
    setR((x) => {
      const bn = x.lang === 'BN';
      const taught = [p.subject, p.syllabus || p.lesson].filter(Boolean);
      const next = p.homework || (p.lesson && p.syllabus ? `${bn ? 'পরবর্তী সবক' : 'Continue from'}: ${p.lesson}` : '');
      const notes = [
        p.status && `${bn ? 'পড়ার অবস্থা' : 'Study status'}: ${p.status}`,
        p.remarks,
        p.missedReason && `${bn ? 'অনুপস্থিতির কারণ' : 'Reason for missed classes'}: ${p.missedReason}`,
      ].filter(Boolean);
      return {
        ...x,
        studentId,
        ...(p.finalTotal != null ? { total: p.finalTotal } : {}),
        ...(p.finalAttended != null ? { attended: p.finalAttended } : {}),
        ...(p.statusLevel ? LEVEL_PRESETS[p.statusLevel] : {}),
        ...(taught.length ? { achievements: taught.join(' — ') } : {}),
        ...(next ? { goals: next } : {}),
        ...(notes.length ? { remarks: notes.join('\n') } : {}),
      };
    });
    setNotice('Report data applied to the form below.');
    formTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ---- save & print ---- */
  const persist = async () => {
    if (saved || !student) return;
    const ok = await saveReport({ ...report, studentId: student.id, studentName: student.name, teacherId: student.teacherId, overallScore: r.overallScore });
    if (ok) setSaved(true);
  };

  const print = () => {
    const html = dossierRef.current?.outerHTML;
    if (!html) return;
    const w = window.open('', '_blank', 'width=950,height=900');
    if (!w) return window.alert('Allow pop-ups for this site to print the report.');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${student.name} – ${r.month} ${r.year}</title>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Barlow:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${DOSSIER_CSS}${DOSSIER_PRINT_CSS}</style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    // Give fonts and the signature image a moment to load
    setTimeout(() => {
      w.print();
      w.close();
    }, 900);
    persist();
  };

  const openPreview = () => {
    if (!student) return setNotice('Select a valid student first.');
    setSaved(false);
    setPreview(true);
  };

  // Searchable dropdown; option labels follow the report language
  const sel = (k, options) => (
    <Combobox value={r[k]} onChange={(v) => setR((x) => ({ ...x, [k]: v }))} options={options.map((o) => {
      const shown = portal.report[r.lang].ratings?.[o] || (r.lang === 'BN' ? translateText(o, true) : o);
      return { value: o, label: shown !== o ? `${shown} — ${o}` : o };
    })} aria-label={k} />
  );
  const studentOptions = db.students.map((s) => ({ value: s.id, label: `${s.name} (${s.id})` }));

  return (
    <div className={`box-card ${r.lang === 'BN' ? 'bn' : ''}`}>
      <div className="card-header-bar">
        <h2 className="card-title">Student progress report engine</h2>
        <label className="flex items-center gap-2 text-sm font-extrabold">
          Language / ভাষা:
          <Combobox variant="pill" value={r.lang} onChange={changeLang} options={[{ value: 'EN', label: 'English' }, { value: 'BN', label: 'বাংলা (Bangla)' }]} aria-label="Report language" />
        </label>
      </div>

      {/* WhatsApp raw message importer */}
      <div className="import-box">
        <div className="mb-3">
          <div className="text-[0.92rem] font-extrabold">📥 Paste Teacher's WhatsApp Report(s)</div>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            Paste one or more raw class-report messages (Bangla or English, any format) — the system detects the student, attendance and syllabus automatically.
          </div>
        </div>
        <textarea className="m-input bn" rows={7} style={{ fontWeight: 500, lineHeight: 1.5 }} placeholder="Paste the raw WhatsApp message(s) from teachers here..." value={raw} onChange={(e) => setRaw(e.target.value)} aria-label="WhatsApp report text" />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="btn-add-row" onClick={() => { setRaw(''); setParsed([]); setNotice(''); }}>Clear</button>
          <button type="button" className="btn-teal" onClick={detect}>🔍 Detect &amp; Parse</button>
        </div>
        {notice && <p className="mt-3 text-sm font-bold" role="status" style={{ color: 'var(--c-teal-mid)' }}>{notice}</p>}
        {parsed.length > 0 && (
          <div className="parsed-grid">
            {parsed.map((p, idx) => {
              const matched = findMatchingStudent(p.name, db.students);
              return (
                <div key={idx} className={`parsed-card ${matched ? 'matched' : 'unmatched'}`}>
                  <div className="mb-2 flex items-start justify-between gap-2 border-b pb-2" style={{ borderColor: '#EBF2F3' }}>
                    <strong>{p.name || '(Name not detected)'}</strong>
                    <span className={`match-badge ${matched ? 'yes' : 'no'}`}>{matched ? `✓ Matched: ${matched.name}` : '⚠ No roster match'}</span>
                  </div>
                  {(p.classTime || p.classGroup) && <div className="parsed-row"><b>Class:</b><span>{p.classTime || ''} {p.classGroup ? `(${p.classGroup})` : ''}</span></div>}
                  {p.subject && <div className="parsed-row"><b>Subject:</b><span>{p.subject}</span></div>}
                  {p.syllabus && <div className="parsed-row"><b>Taught:</b><span>{p.syllabus}</span></div>}
                  {p.lesson && <div className="parsed-row"><b>Lesson:</b><span>{p.lesson}</span></div>}
                  {(p.status || p.statusLevel) && (
                    <div className="parsed-row"><b>Status:</b><span>{p.status || '—'}{p.statusLevel && <span className={`level-chip ${p.statusLevel}`}>{LEVEL_NAMES[p.statusLevel]}</span>}</span></div>
                  )}
                  <div className="parsed-row">
                    <b>Attendance:</b>
                    <span>
                      {p.finalAttended ?? '—'} present / {p.finalTotal ?? '—'} total{p.finalMissed != null ? ` • ${p.finalMissed} absent` : ''}
                      {p.attendancePct != null ? ` • ${p.attendancePct}%` : ''}
                    </span>
                  </div>
                  {p.homework && <div className="parsed-row"><b>Next:</b><span>{p.homework}</span></div>}
                  {p.missedReason && <div className="parsed-row"><b>Reason:</b><span>{p.missedReason}</span></div>}
                  {!matched && (
                    <div className="mt-2">
                      <Combobox value={manual[p.rawText] || ''} onChange={(v) => setManual((m) => ({ ...m, [p.rawText]: v }))} options={studentOptions} placeholder="Type to find the student…" aria-label="Pick student" />
                    </div>
                  )}
                  <button type="button" className="btn-teal mt-3" style={{ padding: '6px 12px', fontSize: '0.78rem' }} onClick={() => apply(p, matched?.id)}>
                    Apply to Report Form →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report form */}
      <div ref={formTop} className="grid gap-4 md:grid-cols-3">
        <div className="form-group">
          <label>{t.student}</label>
          <Combobox value={r.studentId} onChange={(v) => setR((x) => ({ ...x, studentId: v }))} options={studentOptions} placeholder={db.students.length ? 'Type a name or ID…' : 'No students yet'} aria-label="Student" />
        </div>
        <div className="form-group">
          <label>{t.audience}</label>
          <Combobox value={r.reportType} onChange={(v) => setR((x) => ({ ...x, reportType: v }))} options={[{ value: 'Guardian', label: 'Guardian Report (অভিভাবক)' }, { value: 'Student', label: 'Student Report (শিক্ষার্থী)' }]} aria-label="Report audience" />
        </div>
        <div className="form-group">
          <label>{t.template}</label>
          <Combobox value={r.template} onChange={(v) => setR((x) => ({ ...x, template: v }))} options={['1', '2', '3'].map((v) => ({ value: v, label: `Template ${v}` }))} aria-label="Greeting template" />
        </div>
      </div>

      <div className="form-group">
        <label>{t.greeting}</label>
        <textarea className="m-input" rows={6} style={{ fontSize: '0.96rem', lineHeight: 1.65, fontWeight: 500 }} value={r.greeting} onChange={set('greeting')} />
      </div>

      <div className="my-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="form-group"><label>{t.attended}</label><input type="number" min="0" className="m-input" value={r.attended} onChange={set('attended')} /></div>
        <div className="form-group"><label>{t.total}</label><input type="number" min="1" className="m-input" value={r.total} onChange={set('total')} /></div>
        <div className="form-group"><label>{t.rate}</label><input className="m-input" readOnly value={attPct} style={{ background: '#F1F5F9', color: '#0F766E' }} /></div>
        <div className="form-group"><label>{t.grade}</label>{sel('overallScore', GRADES)}</div>
        <div className="form-group"><label>{t.period}</label>{sel('month', MONTHS)}</div>
        <div className="form-group"><label>&nbsp;</label>{sel('year', yearsWith(r.year))}</div>
      </div>

      <div className="card-header-bar"><h3 className="card-title" style={{ fontSize: '0.95rem' }}>{t.header}</h3></div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="form-group"><label>{t.tajweed}</label>{sel('tajweed', SKILL_OPTIONS.tajweed)}</div>
        <div className="form-group"><label>{t.hifz}</label>{sel('hifz', SKILL_OPTIONS.hifz)}</div>
        <div className="form-group"><label>{t.murajaah}</label>{sel('murajaah', SKILL_OPTIONS.murajaah)}</div>
        <div className="form-group"><label>{t.fluency}</label>{sel('fluency', SKILL_OPTIONS.fluency)}</div>
        <div className="form-group"><label>{t.achievements}</label><input className="m-input" value={r.achievements} onChange={set('achievements')} /></div>
        <div className="form-group"><label>{t.goals}</label><input className="m-input" value={r.goals} onChange={set('goals')} /></div>
      </div>
      <div className="form-group">
        <label>{t.remarks}</label>
        <textarea className="m-input" rows={3} style={{ border: '2px solid var(--c-teal-dark)', fontWeight: 500 }} value={r.remarks} onChange={set('remarks')} />
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn-teal" onClick={openPreview} disabled={!student}>Preview Progress Report</button>
      </div>

      {preview && student && (
        <PortalModal onClose={() => setPreview(false)} className="report" labelledBy="dossier-title">
          <style>{DOSSIER_CSS}</style>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--c-box-border)' }}>
            <h3 id="dossier-title" className="text-lg font-extrabold">Academic Dossier Preview</h3>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-outline-sm" onClick={persist} disabled={saved}>{saved ? '✓ Saved to records' : 'Save to records'}</button>
              <button type="button" className="btn-teal" onClick={print}>Print / Save PDF</button>
              <button type="button" className="btn-muted" onClick={() => setPreview(false)}>Close</button>
            </div>
          </div>
          {/* Grey desk behind the A4 pages; scrolls sideways on small screens */}
          <div style={{ background: '#E6EEEE', padding: 20, borderRadius: 12, overflowX: 'auto' }}>
            <Dossier ref={dossierRef} r={report} student={student} teacher={teacher} portal={portal} />
          </div>
        </PortalModal>
      )}
    </div>
  );
}
