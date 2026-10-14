/**
 * Editable text for the printed documents of the Management Portal:
 *   - report:      the two-page progress report (English + Bangla)
 *   - layout:      which report blocks are shown
 *   - certificate: the salary certificate (English)
 *
 * These are only the DEFAULTS. Admins change them in the portal's
 * "Portal Contents" tab; the saved copy lives in the website content
 * (content.site.portalContent, synced to the cloud) and is merged over these
 * defaults, so a new field added here later always has a value.
 *
 * Placeholders such as {page}, {total}, {email}, {phone}, {name}, {month},
 * {year}, {amount}, {amountWords}, {joiningDate}, {designation}, {he}, {his},
 * {him} are filled in when the document is made.
 */
import { useSiteData } from '../../../context/SiteDataContext';
import { BANGLA_MAP, GRADES, GREETINGS, REPORT_DEFAULTS, SKILL_OPTIONS } from './constants';

const RATING_VALUES = [...GRADES, ...Object.values(SKILL_OPTIONS).flat()];
const ratingLabels = (bn) => Object.fromEntries(RATING_VALUES.map((v) => [v, bn ? BANGLA_MAP[v] || v : v]));

export const DEFAULT_PORTAL_CONTENT = {
  report: {
    EN: {
      orgName: 'Quran International Institute',
      orgSubtitle: 'Online Quran & Islamic Studies Academy',
      docTitle: 'Progress Report',
      metaReference: 'Reference',
      metaPeriod: 'Report period',
      metaIssued: 'Issued',
      metaPreparedFor: 'Prepared for',
      audienceGuardian: 'Guardian',
      audienceStudent: 'Student',
      secDetails: 'Student & class details',
      fStudentName: 'Student name',
      fStudentId: 'Student ID',
      fWhatsapp: 'WhatsApp',
      fCountry: 'Country',
      fTeacher: 'Class teacher',
      fDepartment: 'Department',
      fPanel: 'Panel',
      fClassTime: 'Class time',
      notAssigned: 'Not assigned',
      secAttendance: 'Attendance summary',
      kScheduled: 'Scheduled',
      kAttended: 'Attended',
      kMissed: 'Missed',
      kRate: 'Attendance rate',
      noteExcellent: 'Excellent attendance',
      noteGood: 'Good attendance',
      noteLow: 'Attendance needs improvement',
      secEvaluation: 'Quranic learning evaluation',
      colArea: 'Area',
      colRating: 'Rating',
      colLevel: 'Level',
      skillTajweed: 'Tajweed & Makharij',
      skillHifz: 'Memorisation accuracy',
      skillMurajaah: "Muraja'ah (revision)",
      skillFluency: 'Fluency & reading',
      overallGrade: 'Overall grade',
      achievements: 'Key achievements',
      goals: 'Next goals',
      remarks: "Teacher's remarks",
      secGrading: 'Grading key',
      teacherRole: 'Class teacher',
      ceoTitle: 'Chief Executive Officer',
      ceoOrg: 'Quran International Institute',
      sealText: 'Academic Board',
      footerText: '{email}  •  {phone}',
      pageLabel: 'Page {page} of {total}',
      greetings: GREETINGS.EN,
      defaults: REPORT_DEFAULTS.EN,
      ratings: ratingLabels(false),
    },
    BN: {
      orgName: 'Quran International Institute',
      orgSubtitle: 'অনলাইন কুরআন ও ইসলামিক শিক্ষা প্রতিষ্ঠান',
      docTitle: 'অগ্রগতি প্রতিবেদন',
      metaReference: 'রেফারেন্স',
      metaPeriod: 'প্রতিবেদনের মাস',
      metaIssued: 'প্রকাশের তারিখ',
      metaPreparedFor: 'প্রাপক',
      audienceGuardian: 'অভিভাবক',
      audienceStudent: 'শিক্ষার্থী',
      secDetails: 'শিক্ষার্থী ও ক্লাসের তথ্য',
      fStudentName: 'শিক্ষার্থীর নাম',
      fStudentId: 'শিক্ষার্থী আইডি',
      fWhatsapp: 'হোয়াটসঅ্যাপ',
      fCountry: 'দেশ',
      fTeacher: 'শিক্ষক',
      fDepartment: 'বিভাগ',
      fPanel: 'প্যানেল',
      fClassTime: 'ক্লাসের সময়',
      notAssigned: 'নির্ধারিত নয়',
      secAttendance: 'উপস্থিতির সারসংক্ষেপ',
      kScheduled: 'মোট ক্লাস',
      kAttended: 'উপস্থিত',
      kMissed: 'অনুপস্থিত',
      kRate: 'উপস্থিতির হার',
      noteExcellent: 'চমৎকার নিয়মিত উপস্থিতি',
      noteGood: 'সন্তোষজনক উপস্থিতি',
      noteLow: 'উপস্থিতি বাড়ানো প্রয়োজন',
      secEvaluation: 'কুরআন শিক্ষার মূল্যায়ন',
      colArea: 'বিষয়',
      colRating: 'মূল্যায়ন',
      colLevel: 'স্তর',
      skillTajweed: 'তাজবীদ ও মাখরাজ',
      skillHifz: 'হিফজ / মুখস্থের নির্ভুলতা',
      skillMurajaah: 'মুরাওয়াহা (রিভিশন)',
      skillFluency: 'তিলাওয়াত ও পাঠের গতি',
      overallGrade: 'সার্বিক মূল্যায়ন',
      achievements: 'বিশেষ অর্জন ও অগ্রগতি',
      goals: 'পরবর্তী লক্ষ্য',
      remarks: 'শিক্ষকের মন্তব্য',
      secGrading: 'গ্রেডিং নির্দেশিকা',
      teacherRole: 'শ্রেণি শিক্ষক',
      ceoTitle: 'প্রধান নির্বাহী কর্মকর্তা',
      ceoOrg: 'Quran International Institute',
      sealText: 'একাডেমিক বোর্ড',
      footerText: '{email}  •  {phone}',
      pageLabel: 'পৃষ্ঠা {page} / {total}',
      greetings: GREETINGS.BN,
      defaults: REPORT_DEFAULTS.BN,
      ratings: ratingLabels(true),
    },
  },
  layout: {
    showReference: true,
    showLetter: true,
    showAttendanceBar: true,
    showLevelBars: true,
    showGradingKey: true,
    showSeal: true,
    showTeacherSignature: true,
  },
  // Salary certificate: QIT letterhead design with the parts and wording of
  // the institute's official salary certificate. **double stars** = bold.
  certificate: {
    orgName: 'Quran International Institute',
    address: '9/15 Junayed Complex,\nDelta Mor, Uttar Rajashon, Savar – 1340, Dhaka',
    docLabel: 'Salary Certificate',
    title: 'To Whom It May Concern',
    designation: 'Quran Teacher',
    body1:
      'This is to certify that **{printName}** has been working as **{designation}** at Quran International Institute since {joiningDate}. {He} is a permanent employee at **Quran International Institute**. We are issuing this letter on the specific request of the employee without accepting any liability on behalf of this letter.',
    body2: '{His} present salary and allowances are as follows:',
    closing: 'In addition, {he} is entitled to receive festival bonus (equal to two months basic pay per year).\n\nI wish {him} every success in life.',
    colNo: '#',
    colItem: 'Particulars',
    colAmount: 'Amount (BDT)',
    basicLabel: 'Basic Salary',
    houseRentLabel: 'House Rent Allowance',
    medicalLabel: 'Medical Allowance',
    educationLabel: 'Education Allowance',
    transportLabel: 'Transport Allowance',
    tiffinLabel: 'Tiffin Allowance',
    specialLabel: 'Special Benefits',
    grossLabel: 'Gross Salary',
    welfareLabel: 'Deduction of Employee Welfare Fund',
    welfareAmount: 100,
    stampLabel: 'Stamp Duty',
    stampAmount: 10,
    netLabel: 'Net Paid',
    wordsLabel: 'In Word',
    signName: '(Jubayer Hossain)',
    signTitle: 'Head of Accounts',
    contactBlock: 'Quran International Institute\nPhone: {phone}\nE-mail: {email}',
    signatureLabel: 'Authorized Signature',
    refPrefix: 'QIT/HR/SC',
  },
};

// Deep merge: saved values override defaults, nested objects are merged
export function mergeContent(base, saved) {
  if (saved == null) return base;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return saved;
  const out = { ...base };
  Object.keys(saved).forEach((k) => {
    out[k] = k in base ? mergeContent(base[k], saved[k]) : saved[k];
  });
  return out;
}

// The effective portal content (defaults + what the admin saved)
export function usePortalContent() {
  const { content, updateSite } = useSiteData();
  const saved = content?.site?.portalContent;
  const value = mergeContent(DEFAULT_PORTAL_CONTENT, saved);
  const save = (next) => updateSite('portalContent', next);
  return { value, saved, save };
}

// "Hello {name}" + { name: 'Ali' } → "Hello Ali"
export const fillText = (text, vars = {}) => String(text ?? '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
