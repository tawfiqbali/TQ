import { useEffect, useMemo, useState } from 'react';
import { Eye, RotateCcw, Save } from 'lucide-react';
import { useToast } from '../../../components/ui/Toast';
import { DEFAULT_PORTAL_CONTENT, usePortalContent } from '../lib/portalContent';
import { GRADES, SKILL_OPTIONS, currentMonthName } from '../lib/constants';
import { DOSSIER_CSS } from '../dossier.css.js';
import Dossier from './Dossier';
import SalaryCertificate, { CERT_CSS } from './SalaryCertificate';
import { PortalModal } from './common';

/**
 * "Portal Contents" tab (Super Admins): every word of the printed progress
 * report and salary certificate, editable without touching the code.
 * Saved with the website content (cloud), so all admins see the same text.
 */

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function set(obj, path, value) {
  const keys = path.split('.');
  const out = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = out;
  keys.slice(0, -1).forEach((k) => {
    cur[k] = { ...(cur[k] || {}) };
    cur = cur[k];
  });
  cur[keys[keys.length - 1]] = value;
  return out;
}

// [path suffix, label, type?] — type 'long' = textarea
const REPORT_GROUPS = [
  ['Letterhead & title', [['orgName', 'Institute name'], ['orgSubtitle', 'Line under the name'], ['docTitle', 'Document title']]],
  ['Report details strip', [['metaReference', 'Reference label'], ['metaPeriod', 'Period label'], ['metaIssued', 'Issued label'], ['metaPreparedFor', 'Prepared for label'], ['audienceGuardian', 'Guardian word'], ['audienceStudent', 'Student word']]],
  ['Student & class details', [['secDetails', 'Section heading'], ['fStudentName', 'Student name'], ['fStudentId', 'Student ID'], ['fWhatsapp', 'WhatsApp'], ['fCountry', 'Country'], ['fTeacher', 'Teacher'], ['fDepartment', 'Department'], ['fPanel', 'Panel'], ['fClassTime', 'Class time'], ['notAssigned', 'No teacher text']]],
  ['Attendance', [['secAttendance', 'Section heading'], ['kScheduled', 'Total classes'], ['kAttended', 'Attended'], ['kMissed', 'Missed'], ['kRate', 'Rate'], ['noteExcellent', 'Note: 90% or more'], ['noteGood', 'Note: 75–89%'], ['noteLow', 'Note: below 75%']]],
  ['Evaluation', [['secEvaluation', 'Section heading'], ['colArea', 'Column: area'], ['colRating', 'Column: rating'], ['colLevel', 'Column: level'], ['skillTajweed', 'Skill 1'], ['skillHifz', 'Skill 2'], ['skillMurajaah', 'Skill 3'], ['skillFluency', 'Skill 4'], ['overallGrade', 'Overall grade label']]],
  ['Achievements, goals & remarks', [['achievements', 'Achievements heading'], ['goals', 'Goals heading'], ['remarks', 'Remarks heading']]],
  ['Grades (grading key)', [['secGrading', 'Section heading'], ...GRADES.map((g) => [`ratings.${g}`, g])]],
  ['Skill rating descriptions', Object.values(SKILL_OPTIONS).flat().map((v) => [`ratings.${v}`, v])],
  ['Signatures & footer', [['teacherRole', 'Teacher signature title'], ['ceoTitle', 'CEO title'], ['ceoOrg', 'CEO organisation'], ['sealText', 'Seal text'], ['footerText', 'Footer ({email}, {phone})'], ['pageLabel', 'Page number ({page}, {total})']]],
  ['Greeting letters', ['Guardian', 'Student'].flatMap((a) => ['1', '2', '3'].map((n) => [`greetings.${a}.${n}`, `${a} report — template ${n}`, 'long']))],
  ['Default text for a new report', [['defaults.achievements', 'Achievements', 'long'], ['defaults.goals', 'Next goals', 'long'], ['defaults.remarks', "Teacher's remarks", 'long']]],
];

const LAYOUT_FIELDS = [
  ['showReference', 'Reference number in the details strip'],
  ['showLetter', 'Greeting letter on page 1'],
  ['showAttendanceBar', 'Attendance bar and note'],
  ['showLevelBars', 'Level bars in the evaluation table'],
  ['showGradingKey', 'Grading key on page 2'],
  ['showSeal', 'Round seal between the signatures'],
  ['showTeacherSignature', "Class teacher's signature line"],
];

const CERT_GROUPS = [
  ['Letterhead', [['orgName', 'Institute name'], ['address', 'Address (new line = Enter)', 'long'], ['refPrefix', 'Reference number prefix (empty = no reference)'], ['docLabel', 'Small label above the title (empty = none)']]],
  ['Title & text (**double stars** = bold)', [['title', 'Title'], ['designation', 'Default designation'], ['body1', 'Main paragraph', 'long'], ['body2', 'Line before the table', 'long'], ['closing', 'Lines after the table (empty line = new paragraph)', 'long']]],
  ['Salary table — earnings', [['colNo', 'Column: number'], ['colItem', 'Column: item'], ['colAmount', 'Column: amount'], ['basicLabel', '1'], ['houseRentLabel', '2'], ['medicalLabel', '3'], ['educationLabel', '4'], ['transportLabel', '5'], ['tiffinLabel', '6'], ['specialLabel', '7'], ['grossLabel', 'Gross total']]],
  ['Salary table — deductions & net', [['welfareLabel', 'Deduction 1'], ['welfareAmount', 'Deduction 1 default amount (BDT)'], ['stampLabel', 'Deduction 2'], ['stampAmount', 'Deduction 2 default amount (BDT)'], ['netLabel', 'Net paid'], ['wordsLabel', 'Amount-in-words label']]],
  ['Sign-off & contact', [['signName', 'Name'], ['signTitle', 'Title'], ['signatureLabel', 'Text under the signature line'], ['contactBlock', 'Contact block, bottom left ({phone}, {email})', 'long']]],
];

const TABS = [
  { key: 'EN', label: 'Progress report — English' },
  { key: 'BN', label: 'Progress report — বাংলা' },
  { key: 'layout', label: 'Report layout' },
  { key: 'certificate', label: 'Salary certificate' },
];

const SAMPLE_STUDENT = { id: 'QIT-S001', name: 'Abdullah Rahman', phone: '+8801711000000', classTime: '5:00 PM - 6:00 PM', teacherId: 'QIT-001' };
const SAMPLE_TEACHER = { id: 'QIT-001', name: 'Hafez Abdur Rahman', department: 'Bangla Dept.', category: 'Residential', salaryType: 'Package', packageAmount: 17000 };

function Field({ path, label, long, draft, onChange }) {
  const value = get(draft, path) ?? '';
  const changed = value !== get(DEFAULT_PORTAL_CONTENT, path);
  const id = `pc-${path.replace(/[^a-z0-9]/gi, '-')}`;
  const props = { id, className: 'm-input', value, onChange: (e) => onChange(path, e.target.value), lang: path.includes('.BN.') ? 'bn' : undefined };
  return (
    <div className={`form-group ${long ? 'md:col-span-2' : ''}`}>
      <label htmlFor={id} className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {changed && (
          <button type="button" className="pc-reset" onClick={() => onChange(path, get(DEFAULT_PORTAL_CONTENT, path))} title="Back to the default text">
            <RotateCcw className="h-3 w-3" /> Default
          </button>
        )}
      </label>
      {long ? <textarea rows={path.includes('greetings') ? 6 : 3} {...props} /> : <input {...props} />}
    </div>
  );
}

export default function PortalContents() {
  const toast = useToast();
  const { value, save } = usePortalContent();
  const [draft, setDraft] = useState(value);
  const [tab, setTab] = useState('EN');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // 'EN' | 'BN' | 'certificate'
  const savedJson = JSON.stringify(value);
  const dirty = JSON.stringify(draft) !== savedJson;

  // Pick up changes saved elsewhere (another admin / tab) when nothing is being edited
  useEffect(() => {
    if (!dirty) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedJson]);

  const change = (path, v) => setDraft((d) => set(d, path, v));

  const onSave = async () => {
    setBusy(true);
    try {
      await save(draft);
      toast('Portal contents saved. New reports and certificates use this text.');
    } catch (e) {
      toast(e.message || 'Could not save.', 'error');
    } finally {
      setBusy(false);
    }
  };
  const resetTab = () => {
    if (!window.confirm('Put every field on this tab back to the default text? (Nothing is saved until you press Save.)')) return;
    if (tab === 'EN' || tab === 'BN') change(`report.${tab}`, DEFAULT_PORTAL_CONTENT.report[tab]);
    else change(tab, DEFAULT_PORTAL_CONTENT[tab]);
  };

  const sampleReport = useMemo(() => {
    const lang = preview === 'BN' ? 'BN' : 'EN';
    const x = draft.report[lang];
    return {
      lang, reportType: 'Guardian', greeting: x.greetings.Guardian[1], attended: 18, total: 20, attPct: '90.0%',
      overallScore: GRADES[1], tajweed: SKILL_OPTIONS.tajweed[0], hifz: SKILL_OPTIONS.hifz[0], murajaah: SKILL_OPTIONS.murajaah[1], fluency: SKILL_OPTIONS.fluency[0],
      month: currentMonthName(), year: String(new Date().getFullYear()), ...x.defaults,
    };
  }, [draft, preview]);

  const groups = tab === 'EN' || tab === 'BN' ? REPORT_GROUPS : tab === 'certificate' ? CERT_GROUPS : null;
  const prefix = tab === 'EN' || tab === 'BN' ? `report.${tab}.` : 'certificate.';

  return (
    <div className="box-card">
      <div className="card-header-bar">
        <div>
          <h2 className="card-title">Portal contents</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Edit the wording of the printed progress report and salary certificate. Words in {'{curly brackets}'} are filled in automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <span className="pc-unsaved">Unsaved changes</span>}
          <button type="button" className="btn-outline-sm inline-flex items-center gap-1" onClick={() => setPreview(tab === 'certificate' ? 'certificate' : tab === 'BN' ? 'BN' : 'EN')}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          <button type="button" className="btn-teal" onClick={onSave} disabled={!dirty || busy}>
            <Save className="h-4 w-4" /> {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`dir-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
        <button type="button" className="btn-add-row ml-auto" onClick={resetTab}>
          <RotateCcw className="mr-1 inline h-3.5 w-3.5" /> Reset this tab
        </button>
      </div>

      {groups &&
        groups.map(([title, fields]) => (
          <fieldset key={title} className="pc-group">
            <legend>{title}</legend>
            <div className="grid gap-x-4 md:grid-cols-2">
              {fields.map(([k, label, type]) => (
                <Field key={k} path={prefix + k} label={label} long={type === 'long'} draft={draft} onChange={change} />
              ))}
            </div>
          </fieldset>
        ))}

      {tab === 'layout' && (
        <fieldset className="pc-group">
          <legend>Show on the progress report</legend>
          <div className="grid gap-2 md:grid-cols-2">
            {LAYOUT_FIELDS.map(([k, label]) => (
              <label key={k} className="pc-check">
                <input type="checkbox" checked={Boolean(draft.layout[k])} onChange={(e) => change(`layout.${k}`, e.target.checked)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-4 flex justify-end">
        <button type="button" className="btn-teal" onClick={onSave} disabled={!dirty || busy}>
          <Save className="h-4 w-4" /> {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {preview && preview !== 'certificate' && (
        <PortalModal onClose={() => setPreview(null)} className="report" labelledBy="pc-preview-title">
          <style>{DOSSIER_CSS}</style>
          <div className="mb-4 flex items-center justify-between">
            <h3 id="pc-preview-title" className="text-lg font-extrabold">Preview with sample data (not saved yet)</h3>
            <button type="button" className="btn-muted" onClick={() => setPreview(null)}>Close</button>
          </div>
          <div style={{ background: '#E6EEEE', padding: 20, borderRadius: 12, overflowX: 'auto' }}>
            <Dossier r={sampleReport} student={SAMPLE_STUDENT} teacher={SAMPLE_TEACHER} portal={draft} />
          </div>
        </PortalModal>
      )}
      {preview === 'certificate' && (
        <PortalModal onClose={() => setPreview(null)} className="report" labelledBy="pc-cert-title">
          <style>{CERT_CSS}</style>
          <div className="mb-4 flex items-center justify-between">
            <h3 id="pc-cert-title" className="text-lg font-extrabold">Certificate preview with sample data (not saved yet)</h3>
            <button type="button" className="btn-muted" onClick={() => setPreview(null)}>Close</button>
          </div>
          <div style={{ background: '#E6EEEE', padding: 20, borderRadius: 12, overflowX: 'auto' }}>
            <SalaryCertificate.Sample texts={draft.certificate} teacher={SAMPLE_TEACHER} />
          </div>
        </PortalModal>
      )}
    </div>
  );
}
