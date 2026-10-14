import { forwardRef, useMemo, useRef, useState } from 'react';
import { FileBadge, Printer, RefreshCw } from 'lucide-react';
import { useSiteData } from '../../../context/SiteDataContext';
import { MONTHS, fmt, yearsWith } from '../lib/constants';
import { fillText, usePortalContent } from '../lib/portalContent';
import Combobox from '../components/Combobox';
import { PortalModal } from './common';

/**
 * Salary certificate on the QIT letterhead, with the parts of the institute's
 * official salary certificate: "To Whom It May Concern", certification text,
 * numbered salary & allowances table, gross salary, deductions, net paid,
 * amount in words, festival-bonus line, good wishes, Head of Accounts sign-off,
 * contact block (bottom left) and authorised signature (bottom right).
 *
 *   - Opened from a teacher's workspace (Salary Directory → teacher →
 *     "Generate Salary Certificate").
 *   - Name, month and disbursed amount come from the portal; the joining date is
 *     typed in (remembered per teacher in this browser).
 *   - Every sentence and figure can be edited before printing / saving as PDF.
 *   - Default wording: Portal Contents → Salary certificate.
 *
 * Images in public/assets/ (swap the files, keep the names; transparent PNG):
 *   qit-logo.png       QIT logo with wordmark (top left)
 *   qit-mark.png       QIT icon (faded watermark)
 *   seal.png           official round seal (top right)
 *   jubayer-sign.png   Jubayer Hossain's signature (bottom right)
 */
export const LOGO_SRC = '/assets/qit-logo.png';
export const MARK_SRC = '/assets/qit-mark.png';
export const SEAL_SRC = '/assets/seal.png';
export const SIGNATURE_SRC = '/assets/jubayer-sign.png';

/* ---------------- Salary breakdown ----------------
   The disbursed amount is the NET PAID. Gross = net + deductions
   (Employee Welfare Fund, Stamp Duty).
   Basic salary: 17,000 → 13,000 · 15,000 → 12,000 · 18,000 → 14,000
   (any other amount: about 78%, rounded to the nearest 100).
   The rest of the gross is shared out: House Rent 50%, Medical 20%,
   Transport 13%, Tiffin 7% (each rounded to the nearest 10), Education 0,
   Special Benefits = whatever is left, so the rows always add up exactly. */
const BASIC_RULES = { 17000: 13000, 15000: 12000, 18000: 14000 };
export function salaryBreakdown(netInput, deductions = 0) {
  const net = Math.max(0, Math.round(Number(netInput) || 0));
  const gross = net + Math.max(0, Math.round(Number(deductions) || 0));
  const basic = Math.min(gross, BASIC_RULES[net] ?? Math.round((net * 0.78) / 100) * 100);
  const rest = gross - basic;
  const r10 = (x) => Math.round(x / 10) * 10;
  const houseRent = r10(rest * 0.5);
  const medical = r10(rest * 0.2);
  const transport = r10(rest * 0.13);
  const tiffin = r10(rest * 0.07);
  const special = rest - houseRent - medical - transport - tiffin;
  return { basic, houseRent, medical, education: 0, transport, tiffin, special, gross, net };
}

/* ---------------- Amount in words (Bangladeshi style: lakh / crore) ---------------- */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const upTo99 = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const upTo999 = (n) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : '', upTo99(n % 100)].filter(Boolean).join(' ');
export function amountInWords(value) {
  let n = Math.round(Number(value) || 0);
  if (n === 0) return 'Zero Taka Only';
  const parts = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${upTo999(crore)} Crore`);
  if (lakh) parts.push(`${upTo99(lakh)} Lakh`);
  if (thousand) parts.push(`${upTo99(thousand)} Thousand`);
  if (n) parts.push(upTo999(n));
  return `${parts.join(' ')} Taka Only`;
}

/* ---------------- Formatting helpers ---------------- */
const dotDate = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso || '';
};
// 2024-12-01 → "1st December, 2024" with a raised "st" (as on the official letters)
const ordinal = (n) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
function joiningParts(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (!iso || Number.isNaN(d.getTime())) return null;
  return { day: d.getDate(), suffix: ordinal(d.getDate()), rest: `${d.toLocaleString('en-GB', { month: 'long' })}, ${d.getFullYear()}` };
}
const money = (n) => (Number(n) ? `${fmt(n)}.00` : '-');
const pronouns = (female) =>
  female ? { he: 'she', He: 'She', his: 'her', His: 'Her', him: 'her' } : { he: 'he', He: 'He', his: 'his', His: 'His', him: 'him' };
const hideBrokenImage = (e) => {
  e.currentTarget.style.visibility = 'hidden';
};

// **bold** text, and ^^st^^ markers (raised ordinal of the joining date)
function Rich({ text }) {
  return String(text || '')
    .split(/(\*\*[^*]+\*\*|\^\^[a-z]{2}\^\^)/g)
    .map((part, i) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (/^\^\^[a-z]{2}\^\^$/.test(part)) return <sup key={i}>{part.slice(2, -2)}</sup>;
      return part;
    });
}
const paragraphs = (text) => String(text || '').split(/\n\s*\n/).filter((p) => p.trim());

/* ---------------- The printable page ---------------- */
export const CertificateDocument = forwardRef(function CertificateDocument({ d, texts }, ref) {
  const { content } = useSiteData();
  const contact = content?.site?.contact || {};
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const gross = d.earnings.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const net = gross - d.deductions.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const contactBlock = fillText(texts.contactBlock, { email: contact.email || '', phone: contact.phone || '' });
  return (
    <div ref={ref} className="qit-cert">
      <section className="c-page">
        <img className="c-watermark" src={`${origin}${MARK_SRC}`} alt="" aria-hidden="true" />
        <div className="c-top-rule" />

        <header className="c-head">
          <img className="c-logo" src={`${origin}${LOGO_SRC}`} alt="QIT" />
          <div className="c-org-block">
            <div className="c-org">{texts.orgName}</div>
            <div className="c-address">{texts.address}</div>
          </div>
          <img className="c-seal" src={`${origin}${SEAL_SRC}`} alt="Official seal" onError={hideBrokenImage} />
        </header>

        <div className="c-meta">
          <span>{d.refNo ? `Ref: ${d.refNo}` : ''}</span>
          <span>Date: {dotDate(d.issueDate)}</span>
        </div>

        {texts.docLabel && <div className="c-label">{texts.docLabel}</div>}
        <h1 className="c-title">{texts.title}</h1>

        <div className="c-body">
          {paragraphs(d.body1).map((p, i) => <p key={`a${i}`}><Rich text={p} /></p>)}
          {paragraphs(d.body2).map((p, i) => <p key={`b${i}`} className="c-lead"><Rich text={p} /></p>)}
        </div>

        <table className="c-table">
          <thead>
            <tr>
              <th className="no">{texts.colNo}</th>
              <th>{texts.colItem}</th>
              <th className="num">{texts.colAmount}</th>
            </tr>
          </thead>
          <tbody>
            {d.earnings.map((r, i) => (
              <tr key={r.key}><td className="no">{i + 1}</td><td>{r.label}</td><td className="num">{money(r.amount)}</td></tr>
            ))}
            <tr className="sub"><td className="no" /><td>{texts.grossLabel}</td><td className="num">{money(gross)}</td></tr>
            {d.deductions.map((r) => (
              <tr key={r.key} className="ded"><td className="no" /><td>{r.label}</td><td className="num">{money(r.amount)}</td></tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td className="no" /><td>{texts.netLabel}</td><td className="num">{money(net)}</td></tr>
          </tfoot>
        </table>
        <p className="c-words"><strong>{texts.wordsLabel}:</strong> {amountInWords(net)}</p>

        <div className="c-body">
          {paragraphs(d.closing).map((p, i) => <p key={`c${i}`}><Rich text={p} /></p>)}
        </div>

        <div className="c-signoff">
          <strong>{texts.signName}</strong>
          <span>{texts.signTitle}</span>
        </div>

        <footer className="c-bottom">
          <div className="c-contact">{contactBlock}</div>
          <div className="c-signature">
            <img src={`${origin}${SIGNATURE_SRC}`} alt="Signature" onError={hideBrokenImage} />
            <div className="c-line" />
            <span>{texts.signatureLabel}</span>
          </div>
        </footer>
      </section>
    </div>
  );
});

/* ---------------- Filling the editable fields ---------------- */
const deductionTotal = (texts) => (Number(texts.welfareAmount) || 0) + (Number(texts.stampAmount) || 0);
function buildEarnings(net, texts) {
  const b = salaryBreakdown(net, deductionTotal(texts));
  return [
    { key: 'basic', label: texts.basicLabel, amount: b.basic },
    { key: 'house', label: texts.houseRentLabel, amount: b.houseRent },
    { key: 'medical', label: texts.medicalLabel, amount: b.medical },
    { key: 'education', label: texts.educationLabel, amount: b.education },
    { key: 'transport', label: texts.transportLabel, amount: b.transport },
    { key: 'tiffin', label: texts.tiffinLabel, amount: b.tiffin },
    { key: 'special', label: texts.specialLabel, amount: b.special },
  ];
}
const buildDeductions = (texts) => [
  { key: 'welfare', label: texts.welfareLabel, amount: Number(texts.welfareAmount) || 0 },
  { key: 'stamp', label: texts.stampLabel, amount: Number(texts.stampAmount) || 0 },
];
function buildText(f, texts) {
  const j = joiningParts(f.joiningDate);
  const vars = {
    name: f.name,
    printName: f.printName,
    designation: f.designation,
    joiningDate: j ? `${j.day}^^${j.suffix}^^ ${j.rest}` : '[joining date]',
    month: f.month,
    year: f.year,
    amount: fmt(f.amount),
    amountWords: amountInWords(f.amount),
    ...pronouns(f.female),
  };
  return { body1: fillText(texts.body1, vars), body2: fillText(texts.body2, vars), closing: fillText(texts.closing, vars) };
}
const refFor = (texts, teacher, month, year) =>
  texts.refPrefix ? `${texts.refPrefix}/${String(teacher.id).replace(/[^A-Z0-9-]/gi, '')}/${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, '0')}` : '';
const joinKey = (id) => `qit-portal:joining-date:${id}`;
const printNameOf = (name, female) => `${female ? 'MS' : 'MR'} ${String(name || '').toUpperCase()}`;

// Sample used by the Portal Contents preview
function Sample({ texts, teacher }) {
  const month = MONTHS[(new Date().getMonth() + 11) % 12];
  const year = String(new Date().getFullYear());
  const f = { name: teacher.name, printName: printNameOf(teacher.name, false), designation: texts.designation, joiningDate: '2024-12-01', month, year, amount: 17000, female: false };
  const d = { ...buildText(f, texts), earnings: buildEarnings(17000, texts), deductions: buildDeductions(texts), refNo: refFor(texts, teacher, month, year), issueDate: new Date().toISOString().slice(0, 10) };
  return <CertificateDocument d={d} texts={texts} />;
}

/* ---------------- Dialog: edit, preview, print ---------------- */
export default function SalaryCertificate({ teacher, month: m0, year: y0, amount: a0, onClose }) {
  const { value: portal } = usePortalContent();
  const texts = portal.certificate;
  const docRef = useRef(null);

  const [f, setF] = useState(() => {
    let joiningDate = '';
    try {
      joiningDate = localStorage.getItem(joinKey(teacher.id)) || '';
    } catch {
      /* storage blocked */
    }
    const female = /female/i.test(teacher.category || '') || /^(ustadha|mst|mrs|ms|miss)\b/i.test(teacher.name);
    return {
      name: teacher.name,
      printName: printNameOf(teacher.name, female),
      designation: teacher.department ? `${texts.designation} (${teacher.department})` : texts.designation,
      joiningDate,
      month: m0,
      year: String(y0),
      amount: Number(a0) || 0,
      female,
      issueDate: new Date().toISOString().slice(0, 10),
    };
  });
  const [text, setText] = useState(() => buildText(f, texts));
  const [textEdited, setTextEdited] = useState(false);
  const [earnings, setEarnings] = useState(() => buildEarnings(f.amount, texts));
  const [deductions, setDeductions] = useState(() => buildDeductions(texts));
  const [refNo, setRefNo] = useState(() => refFor(texts, teacher, m0, y0));
  const [error, setError] = useState('');

  // Current deductions, so a recalculation keeps any amounts typed in
  const withDeductions = () => ({ ...texts, welfareAmount: deductions[0]?.amount, stampAmount: deductions[1]?.amount });

  const patch = (changes) => {
    const next = { ...f, ...changes };
    // "Name as printed" follows the name / MR-MS until it is edited by hand
    if (('female' in changes || 'name' in changes) && f.printName === printNameOf(f.name, f.female)) next.printName = printNameOf(next.name, next.female);
    setF(next);
    // Sentences follow the details until the admin edits them by hand
    if (!textEdited) setText(buildText(next, texts));
    if ('amount' in changes) setEarnings(buildEarnings(next.amount, withDeductions()));
    if ('month' in changes || 'year' in changes) setRefNo(refFor(texts, teacher, next.month, next.year));
    if ('joiningDate' in changes) {
      setError('');
      try {
        localStorage.setItem(joinKey(teacher.id), changes.joiningDate);
      } catch {
        /* ignore */
      }
    }
  };
  const recalc = () => setEarnings(buildEarnings(f.amount, withDeductions()));
  const refill = () => {
    setText(buildText(f, texts));
    setTextEdited(false);
  };
  const editText = (k, v) => {
    setTextEdited(true);
    setText((t) => ({ ...t, [k]: v }));
  };
  const editRow = (list, setList) => (i, key, v) => setList(list.map((x, j) => (j === i ? { ...x, [key]: key === 'amount' ? Number(v) || 0 : v } : x)));

  const gross = earnings.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const net = gross - deductions.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const mismatch = net !== Math.round(Number(f.amount) || 0);
  const d = useMemo(() => ({ ...text, earnings, deductions, refNo, issueDate: f.issueDate }), [text, earnings, deductions, refNo, f.issueDate]);

  const print = () => {
    if (!f.joiningDate) {
      setError('Enter the joining date first.');
      return;
    }
    const html = docRef.current?.outerHTML;
    if (!html) return;
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) {
      window.alert('Allow pop-ups for this site to print the certificate.');
      return;
    }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Salary Certificate – ${f.name} – ${f.month} ${f.year}</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800&family=Libre+Baskerville:wght@400;700&display=swap" rel="stylesheet">
<style>${CERT_CSS}${CERT_PRINT_CSS}</style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 900);
  };

  const input = (label, props, wide) => (
    <label className={`form-group ${wide ? 'col-span-2' : ''}`}>
      <span className="cert-label">{label}</span>
      <input className="m-input" {...props} />
    </label>
  );
  const rowEditor = (list, setList, prefix) =>
    list.map((r, i) => (
      <div key={r.key} className="cert-row">
        <input className="m-input" value={r.label} onChange={(e) => editRow(list, setList)(i, 'label', e.target.value)} aria-label={`${prefix} ${i + 1} label`} />
        <input className="m-input w-28" type="number" value={r.amount} onChange={(e) => editRow(list, setList)(i, 'amount', e.target.value)} aria-label={`${r.label} amount`} />
      </div>
    ));

  return (
    <PortalModal onClose={onClose} className="wide" labelledBy="cert-title">
      <style>{CERT_CSS}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--c-box-border)' }}>
        <h3 id="cert-title" className="inline-flex items-center gap-2 text-lg font-extrabold"><FileBadge className="h-5 w-5" /> Salary certificate — {teacher.name}</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-teal" onClick={print}><Printer className="h-4 w-4" /> Print / Save PDF</button>
          <button type="button" className="btn-muted" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="cert-layout">
        {/* ---- Editable details ---- */}
        <div className="cert-form">
          <div className="grid grid-cols-2 gap-x-3">
            {input('Name as printed', { value: f.printName, onChange: (e) => patch({ printName: e.target.value }) }, true)}
            {input('Designation', { value: f.designation, onChange: (e) => patch({ designation: e.target.value }) }, true)}
            <label className="form-group col-span-2">
              <span className="cert-label">Joining date <em>(required)</em></span>
              <input type="date" className={`m-input ${error ? 'is-error' : ''}`} value={f.joiningDate} onChange={(e) => patch({ joiningDate: e.target.value })} aria-invalid={Boolean(error)} />
              {error && <span className="cert-error" role="alert">{error}</span>}
            </label>
            <div className="form-group">
              <span className="cert-label">Salary month</span>
              <Combobox value={f.month} onChange={(v) => patch({ month: v })} options={MONTHS} aria-label="Certificate month" />
            </div>
            <div className="form-group">
              <span className="cert-label">Year</span>
              <Combobox value={f.year} onChange={(v) => patch({ year: v })} options={yearsWith(f.year)} aria-label="Certificate year" />
            </div>
            {input('Net paid / disbursed (BDT)', { type: 'number', min: 0, value: f.amount, onChange: (e) => patch({ amount: e.target.value }) })}
            {input('Certificate date', { type: 'date', value: f.issueDate, onChange: (e) => patch({ issueDate: e.target.value }) })}
            {input('Reference no. (optional)', { value: refNo, placeholder: 'Leave empty for none', onChange: (e) => setRefNo(e.target.value) }, true)}
            <div className="form-group col-span-2">
              <span className="cert-label">Refer to the teacher as</span>
              <div className="flex gap-2">
                {[['He / his (MR)', false], ['She / her (MS)', true]].map(([l, v]) => (
                  <button key={l} type="button" className={`dir-tab ${f.female === v ? 'active' : ''}`} onClick={() => patch({ female: v })}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="cert-sub">
            <span>Salary &amp; allowances</span>
            <button type="button" className="btn-outline-sm inline-flex items-center gap-1" onClick={recalc}><RefreshCw className="h-3 w-3" /> Recalculate</button>
          </div>
          {rowEditor(earnings, setEarnings, 'Earning')}
          <p className="cert-total">Gross salary: {fmt(gross)} BDT</p>
          <div className="cert-sub"><span>Deductions</span></div>
          {rowEditor(deductions, setDeductions, 'Deduction')}
          <p className={`cert-total ${mismatch ? 'bad' : ''}`}>
            Net paid: {fmt(net)} BDT {mismatch ? `— not equal to the disbursed ${fmt(f.amount)} BDT (press Recalculate)` : '✓ equals the disbursed amount'}
          </p>

          <div className="cert-sub">
            <span>Certificate text</span>
            <button type="button" className="btn-outline-sm inline-flex items-center gap-1" onClick={refill}><RefreshCw className="h-3 w-3" /> Refill from details</button>
          </div>
          <p className="cert-hint">Put **double stars** around words to make them bold. An empty line starts a new paragraph.</p>
          {[['body1', 'Main paragraph', 6], ['body2', 'Line before the table', 2], ['closing', 'Lines after the table', 4]].map(([k, l, rows]) => (
            <label key={k} className="form-group">
              <span className="cert-label">{l}</span>
              <textarea className="m-input" rows={rows} value={text[k]} onChange={(e) => editText(k, e.target.value)} />
            </label>
          ))}
        </div>

        {/* ---- Live preview ---- */}
        <div className="cert-preview">
          <CertificateDocument ref={docRef} d={d} texts={texts} />
        </div>
      </div>
    </PortalModal>
  );
}
SalaryCertificate.Sample = Sample;

/* ---------------- Styles (preview + print window) ---------------- */
export const CERT_CSS = `
.qit-cert{--ink:#12272A;--teal:#004D51;--gold:#C89A3C;--line:#D6E4E5;--muted:#5B7477;color:var(--ink);font-family:'Barlow',Bahnschrift,system-ui,sans-serif;font-size:13.5px;line-height:1.6}
.qit-cert *{box-sizing:border-box;margin:0;padding:0}
.qit-cert .c-page{position:relative;width:794px;min-height:1123px;margin:0 auto;background:#fff;padding:40px 54px 30px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08),0 12px 32px -12px rgba(0,35,38,.25);border-radius:4px}
.qit-cert .c-top-rule{position:absolute;left:0;right:0;top:0;height:8px;background:linear-gradient(90deg,var(--teal),#0F766E 70%,var(--gold))}
.qit-cert .c-watermark{position:absolute;left:50%;top:55%;width:320px;transform:translate(-50%,-50%);opacity:.13;pointer-events:none}
.qit-cert .c-head{position:relative;display:grid;grid-template-columns:170px 1fr 170px;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1.5px solid var(--teal)}
.qit-cert .c-head::after{content:'';position:absolute;left:0;right:0;bottom:-5px;height:1px;background:var(--gold)}
.qit-cert .c-logo{width:160px;height:auto;object-fit:contain}
.qit-cert .c-org-block{text-align:center}
.qit-cert .c-org{font-family:'Libre Baskerville',Georgia,serif;font-size:20px;font-weight:700;color:var(--teal);line-height:1.25}
.qit-cert .c-address{margin-top:5px;font-size:12.5px;color:var(--muted);line-height:1.5;white-space:pre-line}
.qit-cert .c-seal{justify-self:end;width:112px;height:112px;object-fit:contain}
.qit-cert .c-meta{position:relative;display:flex;justify-content:space-between;margin-top:12px;font-size:12px;font-weight:600;color:var(--muted)}
.qit-cert .c-label{position:relative;text-align:center;margin-top:14px;font-size:11px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:#8A6424}
.qit-cert .c-title{position:relative;text-align:center;font-family:'Libre Baskerville',Georgia,serif;font-size:21px;font-weight:700;color:var(--teal);margin:4px 0 14px}
.qit-cert .c-title::after{content:'';display:block;width:110px;height:2px;background:var(--gold);margin:8px auto 0}
.qit-cert .c-body{position:relative}
.qit-cert .c-body p{margin:0 0 9px;text-align:justify;font-size:14px;line-height:1.65}
.qit-cert .c-body p.c-lead{margin-top:4px;margin-bottom:8px;text-align:left}
.qit-cert .c-body strong{font-weight:700;color:#0B2E31}
.qit-cert sup{font-size:.65em;line-height:0;vertical-align:.55em}
.qit-cert .c-table{position:relative;width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px}
.qit-cert .c-table th{background:var(--teal);color:#fff;text-align:left;padding:7px 12px;font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
.qit-cert .c-table td{padding:4.5px 12px;border-bottom:1px solid var(--line);background:transparent}
.qit-cert .c-table .no{width:44px;text-align:center;color:var(--muted)}
.qit-cert .c-table .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;width:150px}
.qit-cert .c-table tr.sub td{font-weight:800;background:rgba(0,77,81,.05);border-top:1.5px solid var(--teal)}
.qit-cert .c-table tr.ded td{color:#4A5E61}
.qit-cert .c-table tfoot td{font-weight:800;font-size:14px;background:rgba(0,77,81,.08);border-top:2px solid var(--teal);border-bottom:2px solid var(--teal)}
.qit-cert .c-words{position:relative;margin:4px 0 10px;font-size:13.5px;font-weight:700}
.qit-cert .c-words strong{font-weight:800;color:var(--teal)}
.qit-cert .c-signoff{position:relative;display:flex;flex-direction:column;margin-top:6px;font-size:14px;line-height:1.5}
.qit-cert .c-signoff strong{font-weight:800}
.qit-cert .c-bottom{position:relative;display:flex;justify-content:space-between;align-items:flex-end;margin-top:auto;padding-top:12px;border-top:1px solid var(--line)}
.qit-cert .c-contact{white-space:pre-line;font-size:12.5px;line-height:1.55;color:var(--muted)}
.qit-cert .c-signature{display:flex;flex-direction:column;align-items:center;min-width:220px}
.qit-cert .c-signature img{height:64px;max-width:220px;object-fit:contain;margin-bottom:10px}
.qit-cert .c-line{width:210px;border-top:1.5px solid var(--ink);margin:4px 0 5px}
.qit-cert .c-signature span{font-size:13px;font-weight:700}
`;
export const CERT_PRINT_CSS = `
@page{size:A4 portrait;margin:0}
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
html,body{margin:0;background:#fff}
.qit-cert .c-page{width:210mm!important;height:297mm!important;min-height:0!important;padding:12mm 14mm 9mm!important;box-shadow:none!important;border-radius:0!important}
`;
