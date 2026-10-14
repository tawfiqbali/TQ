// Shared lists and text for the Management Portal (ported from the Apps Script portal)

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const YEARS = ['2026', '2027', '2028', '2029', '2030'];

export const CATEGORIES = [
  { value: 'Residential', label: 'Residential', short: 'Residential' },
  { value: 'Non-Residential Male', label: 'Non-Residential ( Male )', short: 'Non-Res. Male' },
  { value: 'Non-Residential Female', label: 'Non-Residential ( Female )', short: 'Non-Res. Female' },
];

// Teaching department shown as a tag on each teacher card
export const DEPARTMENTS = ['Bangla Dept.', 'English Dept.'];

export const PAYMENT_METHODS = ['Bank', 'Bkash', 'Nagad', 'Upay', 'Cash', 'Other'];

export const BD_BANKS = [
  'AB Bank', 'Agrani Bank', 'Al-Arafah Islami Bank', 'Bank Asia', 'BRAC Bank', 'City Bank', 'Dhaka Bank', 'Dutch-Bangla Bank',
  'Eastern Bank (EBL)', 'Exim Bank', 'First Security Islami Bank', 'HSBC Bangladesh', 'IFIC Bank', 'Islami Bank Bangladesh',
  'Jamuna Bank', 'Janata Bank', 'Mercantile Bank', 'Midland Bank', 'Modhumoti Bank', 'Mutual Trust Bank', 'National Bank',
  'NCC Bank', 'NRB Bank', 'One Bank', 'Prime Bank', 'Pubali Bank', 'Rupali Bank', 'Shahjalal Islami Bank', 'Social Islami Bank',
  'Sonali Bank', 'Southeast Bank', 'Standard Bank', 'Standard Chartered', 'Trust Bank (Nagad)', 'United Commercial Bank (UCB)',
  'Uttara Bank', 'Other',
];

// CEO signature used on printed dossiers
export const CEO_SIGNATURE_URL = 'https://drive.google.com/thumbnail?id=1xK-yKIX9wduPb0qoxLZDxRc4fETUo10B&sz=w1000';

export function toBengaliNumerals(str) {
  if (str === null || str === undefined) return '';
  const d = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => d[+w]);
}

export function detectCountryFromPhone(phone, isBn) {
  if (!phone) return isBn ? 'অনির্ধারিত' : 'Unspecified';
  const p = phone.replace(/[\s\-()]/g, '');
  const table = [
    [['+880', '880', '01'], 'বাংলাদেশ (Bangladesh)', 'Bangladesh'],
    [['+1', '1'], 'যুক্তরাষ্ট্র / কানাডা (USA/Canada)', 'USA / Canada'],
    [['+44'], 'যুক্তরাজ্য (United Kingdom)', 'United Kingdom'],
    [['+966'], 'সৌদি আরব (Saudi Arabia)', 'Saudi Arabia'],
    [['+971'], 'সংযুক্ত আরব আমিরাত (UAE)', 'United Arab Emirates'],
    [['+974'], 'কাতার (Qatar)', 'Qatar'],
    [['+968'], 'ওমান (Oman)', 'Oman'],
    [['+965'], 'কুয়েত (Kuwait)', 'Kuwait'],
    [['+60'], 'মালয়েশিয়া (Malaysia)', 'Malaysia'],
    [['+65'], 'সিঙ্গাপুর (Singapore)', 'Singapore'],
    [['+39'], 'ইতালি (Italy)', 'Italy'],
    [['+49'], 'জার্মানি (Germany)', 'Germany'],
    [['+61'], 'অস্ট্রেলিয়া (Australia)', 'Australia'],
  ];
  for (const [prefixes, bn, en] of table) if (prefixes.some((x) => p.startsWith(x))) return isBn ? bn : en;
  return isBn ? 'আন্তর্জাতিক (International)' : 'International';
}

export const BANGLA_MAP = {
  January: 'জানুয়ারি', February: 'ফেব্রুয়ারি', March: 'মার্চ', April: 'এপ্রিল', May: 'মে', June: 'জুন', July: 'জুলাই',
  August: 'আগস্ট', September: 'সেপ্টেম্বর', October: 'অক্টোবর', November: 'নভেম্বর', December: 'ডিসেম্বর',
  'Excellent (90-100%)': 'অত্যন্ত ভালো মাশা আল্লাহ',
  'Very Good (80-89%)': 'ভালো মা শা আল্লাহ, চেষ্টা অব্যাহত রাখতে হবে ইন শা আল্লাহ',
  'Consistent & Accurate': 'ধারাবাহিক ও নির্ভুল',
  'Good Pace (Minor Hesitations)': 'সন্তোষজনক গতি (সামান্য জড়তা)',
  'Daily & Thorough': 'প্রতিদিন ও নিখুঁতভাবে',
  'Regular with Reminders': 'স্মরণ করিয়ে দিলে নিয়মিত',
  'High Fluency': 'পূর্ণ সাবলীল',
  'Good (70-79%)': 'ভালো, আরও অনুশীলন প্রয়োজন',
  'Needs Practice (below 70%)': 'নিয়মিত অনুশীলন প্রয়োজন',
  'Needs Revision': 'আরও রিভিশন প্রয়োজন',
  'Irregular': 'অনিয়মিত',
  'Needs Support': 'সহায়তা প্রয়োজন',
  'Outstanding (Grade A+)': 'অসাধারণ (গ্রেড এ+)',
  'Excellent (Grade A)': 'চমৎকার (গ্রেড এ)',
  'Very Good (Grade B+)': 'খুব ভালো (গ্রেড বি+)',
  'Good (Grade B)': 'ভালো (গ্রেড বি)',
  'Needs Improvement (Grade C)': 'উন্নতি প্রয়োজন (গ্রেড সি)',
  'Bangla Dept.': 'বাংলা বিভাগ',
  'English Dept.': 'ইংরেজি বিভাগ',
  'Steady Progression': 'ধারাবাহিক অগ্রগতি',
  Residential: 'আবাসিক (Residential)',
  'Non-Residential Male': 'অনাবাসিক ( পুরুষ ) [ Non-Residential ( Male ) ]',
  'Non-Residential Female': 'অনাবাসিক ( মহিলা ) [ Non-Residential ( Female ) ]',
};
export const translateText = (val, isBn) => (isBn ? BANGLA_MAP[val] || val : val);

export const GREETINGS = {
  EN: {
    Guardian: {
      1: "Respected Guardian,\nAs-salamu alaykum wa rahmatullah. We express our profound appreciation for your continuous cooperation and support toward your child's education at Quran International Institute (QIT). It is our shared duty to nurture their spiritual and academic excellence, and we are honored to present this periodic evaluation of their progress.",
      2: "Respected Guardian,\nAs-salamu alaykum wa rahmatullah. Consistency in sacred Quranic learning brings immense barakah. We are pleased to report that your child continues to demonstrate positive engagement and dedication in their Quranic sessions under our faculty's guidance.",
      3: "Respected Guardian,\nAs-salamu alaykum wa rahmatullah. Mastery of Tajweed and regular Muraja'ah requires daily encouragement. We thank you for partnering with QIT and kindly request your gentle reinforcement of the focus areas highlighted in this dossier.",
    },
    Student: {
      1: 'Dear Student,\nAs-salamu alaykum wa rahmatullah. Congratulations on your persistent efforts, remarkable dedication, and commendable punctuality in your academic and Quranic studies this month at Quran International Institute (QIT)!\nLearning the Holy Quran is one of the highest honors and greatest blessings in this life. Every letter recited with sincerity and correct Tajweed brings immense reward and elevates your status. Your teachers are delighted with your consistency, and we encourage you to maintain your focus, strengthen your revision routines, and continue striving for excellence in the recitation of the Noble Quran.',
      2: "Dear Student,\nAs-salamu alaykum wa rahmatullah. We are immensely proud of your discipline and sincere attentiveness during class sessions under the guidance of your respected teachers at QIT.\nAlways remember that perseverance, attentive listening to Makharij, and daily Muraja'ah are the foundational pillars of Quranic mastery. Continue aiming for the highest standards of accuracy, keep your heart attached to the divine words, and set higher milestones for yourself every day.",
      3: 'Dear Student,\nAs-salamu alaykum wa rahmatullah. Every single step you take in improving your Tajweed, perfecting your Makharij, and committing sacred verses to memory is a priceless investment in your life.\nContinue your daily Quran recitation with love and sincerity, embrace your upcoming learning goals with confidence, and never hesitate to ask your teachers for guidance whenever you encounter difficult verses.',
    },
  },
  BN: {
    Guardian: {
      1: 'সম্মানিত অভিভাবক,\nআসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ। কুরআন ইন্টারন্যাশনাল ইনস্টিটিউট (QIT)-এ আপনার সন্তানের দ্বীনি ও একাডেমিক শিক্ষার প্রতি আপনার আন্তরিক সহযোগিতা ও সমর্থনের জন্য মোবারকবাদ জানাচ্ছি। সন্তানের বিশুদ্ধ কুরআন শিক্ষা ও চারিত্রিক বিকাশ নিশ্চিত করা আমাদের যৌথ আমানত। আমরা আনন্দের সাথে তার সার্বিক অগ্রগতির এই মূল্যায়ণ প্রতিবেদনটি আপনার সমীপে পেশ করছি।',
      2: 'সম্মানিত অভিভাবক,\nআসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ। পবিত্র কুরআন শিক্ষার ধারাবাহিকতা সন্তানের জীবনে অপার বরকত বয়ে আনে। আলহামদুলিল্লাহ, আপনার সন্তান ক্লাসে অত্যন্ত মনোযোগী এবং ওস্তাদদের দিকনির্দেশনায় প্রশংসনীয় অগ্রগতি প্রদর্শন করছে।',
      3: 'সম্মানিত অভিভাবক,\nআসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ। সহীহ মাখরাজ, তাজবীদ এবং দৈনন্দিন মুরাওয়াহা (রিভিশন)-এর জন্য পরিবার থেকেও সার্বক্ষণিক উৎসাহ আবশ্যক। উল্লেখিত লক্ষ্যসমূহ অর্জনে আপনার অনুপ্রেরণা কামনা করছি।',
    },
    Student: {
      1: 'স্নেহের শিক্ষার্থী,\nআসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ। কুরআন ইন্টারন্যাশনাল ইনস্টিটিউট (QIT)-এ এই মাসে আপনার নিরলস সাধনা, চমৎকার সময়ানুবর্তিতা এবং দ্বীনি শিক্ষার প্রতি গভীর নিষ্ঠার জন্য আন্তরিক মোবারকবাদ ও শুভেচ্ছা জানাচ্ছি।\nপবিত্র মহাগ্রন্থ আল-কুরআন শিক্ষা লাভ করা জীবনের অন্যতম শ্রেষ্ঠ নেয়ামত ও পরম সম্মান। প্রতিটি হরফ সঠিক মাখরাজ ও তাজবীদের সাথে তিলাওয়াত করা অসীম সওয়াব ও অন্তরের নূর বৃদ্ধির মাধ্যম। ওস্তাদগণ আপনার ধারাবাহিক মনোযোগ দেখে অত্যন্ত আনন্দিত। আপনার এই সুন্দর প্রচেষ্টা অব্যাহত থাকুক এবং নিয়মিত রিভিশনের মাধ্যমে প্রতিটি স্তর নিখুঁতভাবে অর্জন করুন।',
      2: 'স্নেহের শিক্ষার্থী,\nআসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ। ক্লাসে আপনার একাগ্রতা, ওস্তাদদের প্রতি সম্মান ও দ্বীনি শিক্ষার প্রতি গভীর অনুরাগ আমাদের মুগ্ধ করেছে।\nমনে রাখবেন, পবিত্র কুরআন তিলাওয়াত ও হিফজের ক্ষেত্রে অবিচল ধারাবাহিকতা, গভীর মনোযোগ এবং প্রতিদিনের পড়া প্রতিদিন রিভিশন করাই হলো সাফল্যের মূল চাবিকাঠি। সর্বদা তাজবীদের নির্ভুল প্রয়োগ বজায় রাখুন এবং মহান আল্লাহর সন্তুষ্টির উদ্দেশ্যে সর্বোচ্চ সুন্দরভাবে কুরআন তিলাওয়াত চালিয়ে যান।',
      3: 'স্নেহের শিক্ষার্থী,\nআসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ। বিশুদ্ধ তিলাওয়াত ও হিফজের প্রতিটি ধাপে আপনার এগিয়ে চলা আপনার ভবিষ্যৎ জীবনের অমূল্য পাথেয়।\nনিয়মিত কুরআন তিলাওয়াতের অভ্যাস ধরে রাখুন, নিজের পরবর্তী উন্নয়ন লক্ষ্যমাত্রা অর্জনে আত্মবিশ্বাসী হোন এবং পবিত্র কুরআনের আলোকে নিজের জীবন গড়ে তুলতে সচেষ্ট থাকুন। আমরা আপনার সার্বিক সফলতা ও উত্তরোত্তর সমৃদ্ধি কামনা করছি।',
    },
  },
};

export const REPORT_DEFAULTS = {
  EN: {
    achievements: 'Successfully completed assigned Surahs with accurate Makharij.',
    goals: "Strengthen home Muraja'ah and master continuous Madd rules.",
    remarks: 'Demonstrates exemplary dedication, discipline, and sincere love for Quran recitation. Keep up the high consistency!',
  },
  BN: {
    achievements: 'মাখরাজের নিয়ম মেনে চমৎকারভাবে নতুন সূরা সম্পন্ন করেছে।',
    goals: 'বাসায় নিয়মিত মুরাওয়াহা (রিভিশন) বৃদ্ধি করা এবং মাদের নিয়ম নিখুঁত করা।',
    remarks: 'আলহামদুলিল্লাহ, শিক্ষার্থী ক্লাসে অত্যন্ত মনোযোগী, সময়ানুবর্তী এবং দ্বীনি শিক্ষার প্রতি একনিষ্ঠ। এই ধারাবাহিকতা অব্যাহত থাকুক।',
  },
};

/* ---------- Several WhatsApp numbers for one student ----------
   Stored in the sheet as one text: "+8801711…, +9665…". */
export const splitPhones = (text) =>
  (/^\s*n\/?a\s*$/i.test(String(text ?? '')) ? '' : String(text ?? ''))
    .split(/\s*[,;\n|]\s*/)
    .map((p) => p.trim())
    .filter((p) => p && p !== 'N/A');
export const joinPhones = (list) => {
  const clean = (list || []).map((p) => String(p).trim()).filter(Boolean);
  return clean.length ? clean.join(', ') : 'N/A';
};

/* ---------- Salary: which month a payment is for ----------
   Salaries are paid after the month ends, so a payment made on 1 September
   is for August (and one in January is for December of the previous year). */
export function previousMonthOf(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return { month: MONTHS[d.getMonth()], year: String(d.getFullYear()) };
}
// Year list that always contains the given year(s)
export const yearsWith = (...ys) => [...new Set([...YEARS, ...ys.map(String)])].sort();

// Rating options for each skill on the progress report, best first
export const SKILL_OPTIONS = {
  tajweed: ['Excellent (90-100%)', 'Very Good (80-89%)', 'Good (70-79%)', 'Needs Practice (below 70%)'],
  hifz: ['Consistent & Accurate', 'Good Pace (Minor Hesitations)', 'Needs Revision'],
  murajaah: ['Daily & Thorough', 'Regular with Reminders', 'Irregular'],
  fluency: ['High Fluency', 'Steady Progression', 'Needs Support'],
};
// Bar length (0-100) shown for a rating on the printed report
export function ratingScore(value) {
  for (const list of Object.values(SKILL_OPTIONS)) {
    const i = list.indexOf(value);
    if (i >= 0) return [95, 82, 68, 52][Math.round((i / Math.max(1, list.length - 1)) * 3)];
  }
  return 75;
}

export const GRADES = ['Outstanding (Grade A+)', 'Excellent (Grade A)', 'Very Good (Grade B+)', 'Good (Grade B)', 'Needs Improvement (Grade C)'];

export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();
export const currentMonthName = () => new Date().toLocaleString('en-US', { month: 'long' });
