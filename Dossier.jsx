import { forwardRef } from 'react';
import { useSiteData } from '../../../context/SiteDataContext';
import { CEO_SIGNATURE_URL, GRADES, detectCountryFromPhone, ratingScore, splitPhones, toBengaliNumerals, translateText } from '../lib/constants';
import { DEFAULT_PORTAL_CONTENT, fillText } from '../lib/portalContent';

/**
 * The printed progress report: two A4 pages.
 *   Page 1 — letterhead, report details, student & class details, letter to
 *            the guardian / student, attendance summary.
 *   Page 2 — skills evaluation with score bars, overall grade, achievements,
 *            next goals, teacher remarks, signatures.
 * The same markup is shown in the preview and sent to the print window, so
 * all styles live in dossier.css.js. Every word comes from `portal`
 * (Portal Contents tab → saved text, falling back to lib/portalContent.js).
 */
const Dossier = forwardRef(function Dossier({ r, student, teacher, portal = DEFAULT_PORTAL_CONTENT }, ref) {
  const { content } = useSiteData();
  const contact = content?.site?.contact || {};
  const isBn = r.lang === 'BN';
  const x = portal.report[isBn ? 'BN' : 'EN'];
  const show = portal.layout;
  const n = (v) => (isBn ? toBengaliNumerals(v) : v);
  // Rating / grade / category label as written in Portal Contents
  const T = (v) => x.ratings?.[v] || translateText(v, isBn);

  const total = Number(r.total) || 0;
  const attended = Math.min(total || Infinity, Number(r.attended) || 0);
  const missed = Math.max(0, total - attended);
  const pct = total ? Math.round((attended / total) * 1000) / 10 : 0;
  const phones = splitPhones(student.phone);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const monthIndex = String(new Date(`${r.month} 1, 2000`).getMonth() + 1).padStart(2, '0');
  const reference = `QIT-PR-${String(student.id).replace(/[^A-Z0-9]/gi, '')}-${r.year}${monthIndex}`;
  const issued = new Date().toLocaleDateString(isBn ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const attendanceNote = pct >= 90 ? x.noteExcellent : pct >= 75 ? x.noteGood : x.noteLow;

  const skills = [
    [x.skillTajweed, r.tajweed],
    [x.skillHifz, r.hifz],
    [x.skillMurajaah, r.murajaah],
    [x.skillFluency, r.fluency],
  ];

  const Letterhead = () => (
    <header className="d-head">
      <div className="d-brand">
        <img src={`${origin}/brand/logo-mark.png`} alt="" className="d-logo" />
        <div>
          <div className="d-org">{x.orgName}</div>
          <div className="d-org-sub">{x.orgSubtitle}</div>
        </div>
      </div>
      <div className="d-doc">
        <div className="d-doc-title">{x.docTitle}</div>
        <div className="d-doc-period">{T(r.month)} {n(r.year)}</div>
      </div>
    </header>
  );

  const Footer = ({ page }) => (
    <footer className="d-foot">
      <span>{fillText(x.footerText, { email: contact.email || '', phone: contact.phone || '' }).replace(/^\s*•\s*|\s*•\s*$/g, '')}</span>
      <span>{fillText(x.pageLabel, { page: n(page), total: n(2) })}</span>
    </footer>
  );

  return (
    <div ref={ref} className={`qit-dossier ${isBn ? 'bn' : ''}`}>
      {/* ---------------- Page 1 ---------------- */}
      <section className="d-page">
        <div className="d-body">
          <Letterhead />

          <div className={`d-meta ${show.showReference ? '' : 'no-ref'}`}>
            {show.showReference && <div><span>{x.metaReference}</span><strong>{reference}</strong></div>}
            <div><span>{x.metaPeriod}</span><strong>{T(r.month)} {n(r.year)}</strong></div>
            <div><span>{x.metaIssued}</span><strong>{issued}</strong></div>
            <div><span>{x.metaPreparedFor}</span><strong>{r.reportType === 'Student' ? x.audienceStudent : x.audienceGuardian}</strong></div>
          </div>

          <h3 className="d-section">{x.secDetails}</h3>
          <div className="d-info">
            <table>
              <tbody>
                <tr><th>{x.fStudentName}</th><td className="strong">{student.name}</td></tr>
                <tr><th>{x.fStudentId}</th><td>{student.id}</td></tr>
                <tr><th>{x.fWhatsapp}</th><td>{phones.length ? phones.map((p) => <div key={p}>{n(p)}</div>) : '—'}</td></tr>
                <tr><th>{x.fCountry}</th><td>{detectCountryFromPhone(phones[0], isBn)}</td></tr>
              </tbody>
            </table>
            <table>
              <tbody>
                <tr><th>{x.fTeacher}</th><td className="strong">{teacher ? teacher.name : student.teacherId || x.notAssigned}</td></tr>
                <tr><th>{x.fDepartment}</th><td>{teacher?.department ? T(teacher.department) : '—'}</td></tr>
                <tr><th>{x.fPanel}</th><td>{teacher ? T(teacher.category) : '—'}</td></tr>
                <tr><th>{x.fClassTime}</th><td>{student.classTime ? n(student.classTime) : '—'}</td></tr>
              </tbody>
            </table>
          </div>

          {show.showLetter && <div className="d-letter">{r.greeting}</div>}

          <h3 className="d-section">{x.secAttendance}</h3>
          <div className="d-att">
            <div className="d-kpi"><span>{x.kScheduled}</span><strong>{n(total)}</strong></div>
            <div className="d-kpi ok"><span>{x.kAttended}</span><strong>{n(attended)}</strong></div>
            <div className="d-kpi bad"><span>{x.kMissed}</span><strong>{n(missed)}</strong></div>
            <div className="d-kpi rate"><span>{x.kRate}</span><strong>{n(pct)}%</strong></div>
          </div>
          {show.showAttendanceBar && (
            <>
              <div className="d-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, pct)}%` }} /></div>
              <p className="d-bar-note">{attendanceNote}</p>
            </>
          )}
        </div>
        <Footer page={1} />
      </section>

      <hr className="page-break" />

      {/* ---------------- Page 2 ---------------- */}
      <section className="d-page">
        <div className="d-body">
          <Letterhead />

          <h3 className="d-section">{x.secEvaluation}</h3>
          <div className="d-eval">
            <table>
              <thead>
                <tr><th>{x.colArea}</th><th>{x.colRating}</th>{show.showLevelBars && <th className="w-bar">{x.colLevel}</th>}</tr>
              </thead>
              <tbody>
                {skills.map(([label, value]) => (
                  <tr key={label}>
                    <td className="strong">{label}</td>
                    <td>{T(value)}</td>
                    {show.showLevelBars && <td className="w-bar"><div className="d-mini"><i style={{ width: `${ratingScore(value)}%` }} /></div></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="d-grade">
              <span>{x.overallGrade}</span>
              <strong>{T(r.overallScore)}</strong>
            </div>
          </div>

          <div className="d-two">
            <div className="d-note good"><span>{x.achievements}</span><p>{r.achievements || '—'}</p></div>
            <div className="d-note next"><span>{x.goals}</span><p>{r.goals || '—'}</p></div>
          </div>

          <div className="d-remarks">
            <span>{x.remarks}</span>
            <p>{r.remarks || '—'}</p>
          </div>

          {show.showGradingKey && <h3 className="d-section">{x.secGrading}</h3>}
          {show.showGradingKey && <div className="d-key">
            {GRADES.map((g) => {
              const [label, code] = T(g).split(/\s*[(（]/);
              return (
                <div key={g} className={g === r.overallScore ? 'on' : ''}>
                  <strong>{(code || '').replace(/[)）]/g, '')}</strong>
                  <span>{label}</span>
                </div>
              );
            })}
          </div>}
        </div>

        <div>
          <div className="d-sign">
            {show.showTeacherSignature ? (
              <div className="d-sig">
                <div className="d-sig-space" />
                <div className="d-sig-line" />
                <strong>{teacher ? teacher.name : x.teacherRole}</strong>
                <span>{x.teacherRole}</span>
              </div>
            ) : <div />}
            {show.showSeal ? (
              <div className="d-seal" aria-hidden="true">
                <div>QIT</div>
                <span>{x.sealText}</span>
              </div>
            ) : <div />}
            <div className="d-sig">
              <img src={CEO_SIGNATURE_URL} alt="" className="d-sig-img" />
              <div className="d-sig-line" />
              <strong>{x.ceoTitle}</strong>
              <span>{x.ceoOrg}</span>
            </div>
          </div>
          <Footer page={2} />
        </div>
      </section>
    </div>
  );
});

export default Dossier;
