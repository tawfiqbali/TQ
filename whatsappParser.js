/**
 * WhatsApp class-report parser (Bangla or English). Pure functions: text in,
 * parsed reports out.
 *
 * How it reads a message:
 *  1. Splits a paste of several reports at each "Student Name:" / "শিক্ষার্থীর নাম:" line.
 *  2. Reads "Label: value" lines (also "Label - value", "Label = value", or the
 *     value on the next line). Each label is matched against English and
 *     Bangla synonyms (see FIELD_LABELS), so wording can vary.
 *  3. Reads free sentences too, e.g. "২০ দিনের মধ্যে ১৮ দিন ক্লাস করেছে",
 *     "attended 18 out of 20 classes", "বর্তমানে সূরা ইয়াসিন পড়ছে".
 *  4. Falls back to the original fixed-format patterns for anything missing.
 *
 * Output (per student): name, whatsapp, classTime, classGroup, subject,
 * syllabus (taught this month), lesson (current lesson / page / surah / para),
 * status (study status text), statusLevel (excellent | veryGood | good |
 * average | weak), homework, remarks, attendance (present / absent / total,
 * percent) and finalTotal / finalAttended / finalMissed.
 */

export function bengaliDigitsToArabic(str) {
  if (!str) return str;
  const map = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  return String(str).replace(/[০-৯]/g, (d) => map[d]);
}

function extractFirstNumber(text) {
  if (!text) return null;
  const match = bengaliDigitsToArabic(text).match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function normalizeRawMessage(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^[.\-_□▪️●○=*~]{3,}$/u.test(line))
    .join('\n');
}

export function splitIntoReportChunks(rawText) {
  const text = rawText.replace(/\r\n/g, '\n');
  const startPattern =
    /(?:^|\n)[^\S\n]*(?:\[[^\]\n]{4,40}\][^:\n]{0,40}:\s*)?(?:[০-৯\d]+\s*[.)]\s*)?[*_~]*(?:[\p{Extended_Pictographic}\uFE0F\u200d]\s*)*[*_~]*(?:(?:শিক্ষার্থীর|ছাত্রের|ছাত্রীর|স্টুডেন্টের)\s*নাম|Student'?s?\s*Name|Name\s*of\s*(?:the\s*)?Student|নাম|Name)[*_~]*\s*[:：\-–—=]/giu;
  const indices = [];
  let m;
  while ((m = startPattern.exec(text)) !== null) {
    indices.push(m.index);
    if (m.index === startPattern.lastIndex) startPattern.lastIndex++;
  }
  if (indices.length === 0) return [text];
  const chunks = [];
  for (let i = 0; i < indices.length; i++) {
    const end = i + 1 < indices.length ? indices[i + 1] : text.length;
    const chunk = text.slice(indices[i], end).trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

function legacyParse(rawChunk) {
  const chunk = normalizeRawMessage(rawChunk);
  const r = {
    name: null, classTime: null, classGroup: null, whatsapp: null, subject: null, syllabus: null,
    daysPerWeek: null, totalExpected: null, totalHeld: null, missed: null, missedReason: null, rawText: rawChunk.trim(),
  };
  const clean = (s) => s.replace(/[।.]+$/, '').trim();

  const nameMatch = chunk.match(/শিক্ষার্থীর\s*নাম\s*[:：]\s*([^\n।]+)/i) || chunk.match(/Student'?s?\s*Name\s*[:：]\s*([^\n]+)/i);
  if (nameMatch) r.name = clean(nameMatch[1]);
  const phoneMatch = chunk.match(/WhatsApp\s*(?:নম্বর|Number)\s*[:：]\s*([^\n]+)/i);
  if (phoneMatch) r.whatsapp = phoneMatch[1].trim();
  const timeMatch = chunk.match(/ক্লাস\s*টাইম\s*[:：]\s*([^\n।]+)/i) || chunk.match(/Class\s*Time\s*[:：]\s*([^\n]+)/i);
  if (timeMatch) r.classTime = clean(timeMatch[1]);
  const groupMatch = chunk.match(/(?:ক্লাস\s*গ্রুপের\s*নাম[^:：\n]*|Class\s*Group\s*Name[^:：\n]*)[:：]?\s*\n?\s*([^\n]+)/i);
  if (groupMatch && groupMatch[1] && !/^[:：]?\s*$/.test(groupMatch[1])) {
    r.classGroup = clean(groupMatch[1]);
    if (!r.classTime) {
      const tig = r.classGroup.match(/\b(\d{1,2}[:.]\d{2}\s*(?:AM|PM|am|pm)?)\b/);
      if (tig) r.classTime = tig[1];
    }
  }
  const subjectMatch = chunk.match(/বিষয়\s*[:：]\s*([^\n।]+)/i) || chunk.match(/Subject\s*[:：]\s*([^\n]+)/i);
  if (subjectMatch) r.subject = clean(subjectMatch[1]);
  const syl = chunk.match(
    /(?:এই মাসে যতটুকু পড়ানো হয়েছে|How much has been taught(?: this month)?)\s*[:：]?\s*\n?([\s\S]*?)(?=\n\s*(?:📅|উপস্থিতির হিসাব|Attendance Report|সপ্তাহে|How many days|$))/iu,
  );
  if (syl) {
    const s = syl[1]
      .split('\n')
      .map((l) => l.replace(/^[_\-•\s]+/, '').trim())
      .filter(Boolean)
      .join(' ');
    if (s) r.syllabus = clean(s);
  }
  const days =
    chunk.match(/সপ্তাহে\s*(?:কতদিন\s*ক্লাস\s*হয়)?\s*[:：]?\s*\.*\s*([০-৯0-9]+)\s*\.*\s*দিন/i) ||
    chunk.match(/সপ্তাহে\s*([০-৯0-9]+)\s*দিন/i) ||
    chunk.match(/(?:How many days of class are there a week|days of class.*week)\s*[:：]?\s*(\d+)/i);
  if (days) r.daysPerWeek = extractFirstNumber(days[1]);
  const expected =
    chunk.match(/এই মাসে মোট ক্লাস হওয়ার কথা ছিল\s*[:：]?\s*([০-৯0-9.\s]+?)\s*দিন/i) ||
    chunk.match(/Total classes were supposed to be held(?: this month)?\s*[:：]?\s*(\d+)/i);
  if (expected) r.totalExpected = extractFirstNumber(expected[1]);
  const held = chunk.match(/(?:মোট\s*)?ক্লাস\s*হয়েছে\s*[:：]?\s*([০-৯0-9.\s]+?)\s*(?:দিন|টি)/i) || chunk.match(/Classes actually held\s*[:：]?\s*(\d+)/i);
  if (held) r.totalHeld = extractFirstNumber(held[1]);
  const missed = chunk.match(/ক্লাস\s*হয়\s*নি\s*[:：]?\s*([০-৯0-9]+)\s*দিন/i) || chunk.match(/Classes not held\s*[:：]?\s*(\d+)/i);
  if (missed) r.missed = extractFirstNumber(missed[1]);
  const reason = chunk.match(/(?:যদি কোনো ক্লাস না হয়ে থাকে,?\s*তবে\s*কারণ|কারণ)\s*[:：]\s*([^\n]+)/i) || chunk.match(/Reason\s*[:：]\s*([^\n]+)/i);
  if (reason) r.missedReason = clean(reason[1]);

  let total = r.totalExpected;
  let attended = r.totalHeld;
  let miss = r.missed;
  if (total == null && attended != null && miss != null) total = attended + miss;
  else if (attended == null && total != null && miss != null) attended = total - miss;
  else if (miss == null && total != null && attended != null) miss = Math.max(0, total - attended);
  r.finalTotal = total;
  r.finalAttended = attended;
  r.finalMissed = miss;
  return r;
}

export function parseTeacherMessages(raw) {
  return splitIntoReportChunks(raw)
    .map(parseSingleReportChunk)
    .filter((p) => p.name || p.finalTotal != null || p.finalAttended != null || p.syllabus || p.lesson || p.status);
}

export function findMatchingStudent(name, students) {
  if (!name) return null;
  const clean = (s) => String(s).toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, '').trim();
  const target = clean(name);
  if (!target) return null;
  return (
    students.find((s) => clean(s.name) === target) ||
    students.find((s) => {
      const sc = clean(s.name);
      return sc && (sc.includes(target) || target.includes(sc));
    }) ||
    null
  );
}

/* ================= Upgraded parser ================= */

// Label synonyms, most specific first. Tested against the text before ":".
const FIELD_LABELS = [
  ['teacherName', /শিক্ষকের\s*নাম|শিক্ষিকার\s*নাম|উস্তাদ|ওস্তাদ|teacher'?s?\s*name|^teacher$|^ustadh?$/i],
  ['reason', /কারণ|reason|why/i],
  ['classGroup', /গ্রুপ|group/i],
  ['syllabus', /এই\s*মাসে\s*(?:যতটুকু|যা)|পড়ানো\s*হয়েছে|সিলেবাস|syllabus|how\s*much\s*has\s*been\s*taught|taught|covered|completed|শেষ\s*হয়েছে|সম্পন্ন/i],
  ['classTime', /ক্লাস\s*টাইম|ক্লাসের\s*সময়|^সময়$|class\s*time|^time$|timing|schedule\s*time/i],
  ['daysPerWeek', /সপ্তাহে|per\s*week|a\s*week|weekly|days?\s*of\s*class/i],
  ['total', /হওয়ার\s*কথা|হবার\s*কথা|supposed|scheduled|expected|মোট\s*ক্লাস(?!\s*(?:হয়েছে|করেছে|নিয়েছে|হয়))|মোট\s*দিন|total\s*(?:classes|days|sessions)?(?!\s*(?:held|attended|taken))/i],
  ['absent', /হয়\s*নি|হয়নি|অনুপস্থিত|গরহাজির|absent|missed|not\s*held|^মিস|ছুটি|^leave|^off\s*days?/i],
  ['attendance', /উপস্থিতির\s*হার|উপস্থিতি$|^উপস্থিতি\b|হাজিরা|attendance/i],
  ['present', /উপস্থিত|হাজির|present|attended|actually\s*held|held|হয়েছে|করেছে|নিয়েছে|taken|joined/i],
  ['whatsapp', /whats\s*app|হোয়াটস\s*অ্যাপ|হোয়াটসঅ্যাপ|ফোন|মোবাইল|phone|mobile|contact|নম্বর$/i],
  ['name', /(?:শিক্ষার্থীর|ছাত্রের|ছাত্রীর|স্টুডেন্টের)\s*নাম|student'?s?\s*name|name\s*of\s*(?:the\s*)?student|^নাম$|^name$|^student$/i],
  ['homework', /বাড়ির\s*কাজ|বাসার\s*কাজ|হোম\s*ওয়ার্ক|homework|home\s*work|assignment|next\s*(?:lesson|target|goal)|পরবর্তী\s*(?:সবক|পড়া|লক্ষ্য)|আগামী/i],
  ['lesson', /সবক|বর্তমান\s*পড়া|আজকের\s*পড়া|^পড়া$|পাঠ|lesson|current(?:ly)?|progress(?!\s*status)|অগ্রগতি|কোথায়|পৃষ্ঠা|page|পারা|para|juz|সূরা|surah|sura|আয়াত|ayah|ayat|কায়দা|qaida|দরস|chapter/i],
  ['status', /পড়ার\s*(?:অবস্থা|মান)|পড়াশোনার\s*(?:অবস্থা|মান)|অবস্থা|মূল্যায়ন|status|performance|condition|grade|level|মান$/i],
  ['remarks', /মন্তব্য|remarks?|comments?|note|feedback|পরামর্শ/i],
  ['subject', /বিষয়|কোর্স|subject|course|কিতাব|book/i],
];

// Fields whose name alone on a line is a section heading (not content)
const HEADING_FIELDS = new Set(['attendance', 'total', 'present', 'absent', 'daysPerWeek', 'reason', 'teacherName', 'whatsapp', 'classTime', 'name']);

const BN_DIGITS = /[০-৯]/g;
const toAscii = (s) => String(s ?? '').replace(BN_DIGITS, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d));
const stripDecor = (s) =>
  String(s ?? '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200d]/gu, ' ')
    .replace(/[*_~`]+/g, '')
    .replace(/^[\s•●○▪■□◆◇►▶➤➢→✓✔☑\-–—>#]+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
const tidy = (s) => stripDecor(s).replace(/^[:：\-–—=\s]+/, '').replace(/[।.,;\s]+$/u, '').trim();
const num = (s) => {
  const m = toAscii(s).match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

// WhatsApp export prefix: "[26/09/26, 5:10 PM] Name: " or "26/09/2026, 17:10 - Name: "
const stripChatPrefix = (line) =>
  line.replace(/^\[?\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s*\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*(?:[AaPp][Mm])?\]?\s*(?:-\s*)?[^:]{1,40}:\s*/, '');

function labelOf(label) {
  const l = stripDecor(toAscii(label)).toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').trim();
  if (!l || l.length > 70) return null;
  for (const [field, re] of FIELD_LABELS) if (re.test(l)) return field;
  return null;
}

// "Label: value" → [label, value]. A dash only separates when it has spaces
// around it ("Lesson - Juz 3"), so "১০-১৫" or "Al-Kahf" stay intact.
function splitLabel(line) {
  const body = line.replace(/^[\s•●○▪■□◆◇►▶➤➢→✓✔☑>#*_~]+|^[-–—]\s+/u, '');
  const m = body.match(/^(.{1,70}?)\s*(?:[:：=]|\s[-–—]{1,2}>?\s)\s*(.*)$/u);
  if (!m) return null;
  // "5:00 PM" style times are not labels
  if (/\d$/.test(toAscii(m[1])) && /^\d/.test(toAscii(m[2]))) return null;
  return [m[1], m[2]];
}

const LEVELS = [
  ['weak', /ভালো\s*না|ভাল\s*না|দুর্বল|খারাপ|অনিয়মিত|অমনোযোগী|মনোযোগী\s*না|উন্নতি\s*(?:প্রয়োজন|দরকার)|not\s*(?:good|well|regular)|poor|weak|irregular|needs?\s*(?:improvement|practice|attention)|struggl/i],
  ['excellent', /অসাধারণ|চমৎকার|অত্যন্ত\s*ভালো|খুবই\s*ভালো|দারুণ|excellent|outstanding|perfect|superb|brilliant|mash[a']?\s*allah|মা\s*শা\s*আল্লাহ|মাশাআল্লাহ/i],
  ['veryGood', /খুব\s*ভালো|অনেক\s*ভালো|very\s*good|great/i],
  ['good', /ভালো|ভাল|সন্তোষজনক|good|fine|satisfactory|well|regular|নিয়মিত/i],
  ['average', /মোটামুটি|মাঝারি|চলনসই|average|ok(?:ay)?\b|moderate|fair/i],
];
export function statusLevelOf(text) {
  if (!text) return null;
  const t = String(text);
  for (const [level, re] of LEVELS) if (re.test(t)) return level;
  return null;
}

function readAttendanceValue(r, value) {
  const v = toAscii(value);
  const frac = v.match(/(\d+)\s*(?:\/|out\s*of|of|এর\s*মধ্যে|মধ্যে)\s*(\d+)/i);
  if (frac) {
    r.present = Number(frac[1]);
    r.total = Number(frac[2]);
    return;
  }
  const pct = v.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) r.percent = Number(pct[1]);
  else if (num(v) != null) r.present = num(v);
}

// Sentences such as "২০ দিনের মধ্যে ১৮ দিন ক্লাস করেছে" or "absent for 2 days"
function readSentences(r, text) {
  const t = toAscii(text);
  const grab = (re, i = 1) => {
    const m = t.match(re);
    return m ? Number(m[i]) : null;
  };
  let m = t.match(/(\d+)\s*(?:দিনের|টি\s*ক্লাসের|ক্লাসের|টির)\s*মধ্যে\s*(\d+)/);
  if (m && r.total == null && r.present == null) {
    r.total = Number(m[1]);
    r.present = Number(m[2]);
  }
  m = t.match(/(?:attended|present(?:\s*(?:in|for))?|joined)\s*(\d+)\s*(?:out\s*of|of|\/)\s*(\d+)/i) || t.match(/(\d+)\s*(?:out\s*of|of|\/)\s*(\d+)\s*(?:classes|days|sessions)\s*(?:attended|present)?/i);
  if (m && r.present == null) {
    r.present = Number(m[1]);
    if (r.total == null) r.total = Number(m[2]);
  }
  if (r.present == null)
    r.present =
      grab(/(\d+)\s*(?:দিন|টি|টা)?\s*(?:ক্লাস\s*)?(?:করেছে|করেছেন|উপস্থিত\s*ছিল|উপস্থিত|হাজির)/) ??
      grab(/(?:উপস্থিত|হাজির)\s*(?:ছিল|ছিলেন)?\s*(\d+)/) ??
      grab(/(?:present|attended)\s*(?:for|in)?\s*(\d+)/i) ??
      grab(/(\d+)\s*(?:days?|classes|sessions)\s*(?:present|attended)/i);
  if (r.absent == null)
    r.absent =
      grab(/(\d+)\s*(?:দিন|টি|টা)?\s*(?:ক্লাস\s*)?(?:অনুপস্থিত|গরহাজির|মিস|ছুটি|হয়নি|হয়\s*নি)/) ??
      grab(/(?:অনুপস্থিত|গরহাজির|ছুটি)\s*(?:ছিল|ছিলেন|নিয়েছে)?\s*(\d+)/) ??
      grab(/(?:absent|missed|leave)\s*(?:for|in)?\s*(\d+)/i) ??
      grab(/(\d+)\s*(?:days?|classes|sessions)\s*(?:absent|missed|off)/i);
  if (r.total == null) r.total = grab(/(?:মোট|total)\s*(\d+)\s*(?:দিন|টি|days|classes)/i);
  if (r.daysPerWeek == null) r.daysPerWeek = grab(/সপ্তাহে\s*(\d+)\s*দিন/) ?? grab(/(\d+)\s*days?\s*(?:a|per)\s*week/i);

  if (!r.lesson) {
    const l =
      text.match(/(?:বর্তমানে|এখন|আজ)\s*([^।\n]*?(?:সূরা|পারা|পৃষ্ঠা|আয়াত|সবক|কায়দা|দরস|হরফ|অধ্যায়)[^।\n]*)/u) ||
      text.match(/(?:currently|now|today)\s+(?:at|on|reading|studying|learning|memori[sz]ing|doing)\s+([^.\n]+)/i);
    if (l) r.lesson = tidy(l[1]);
  }
  if (!r.syllabus) {
    const c = text.match(/(?:completed|finished|covered)\s+([^.\n]+)/i) || text.match(/([^।\n]*?)\s*(?:শেষ\s*করেছে|সম্পন্ন\s*করেছে|শেষ\s*হয়েছে)/u);
    if (c && tidy(c[1])) r.syllabus = tidy(c[1]);
  }
  if (!r.status) {
    const st =
      text.match(/(?:পড়ার|পড়াশোনার|তিলাওয়াতের|হিফজের)\s*(?:অবস্থা|মান)\s*(?:[:：\-]\s*)?([^।\n]+)/u) ||
      text.match(/(?:performance|progress|study\s*status|recitation)\s*(?:is|was|:)\s*([^.\n]+)/i);
    if (st) r.status = tidy(st[1]);
  }
}

export function parseSingleReportChunk(rawChunk) {
  const lines = rawChunk
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => stripChatPrefix(l.trim()))
    .filter((l) => l && !/^[.\-_□▪️●○=*~\s]{3,}$/u.test(l));

  const r = {
    name: null, teacherName: null, whatsapp: null, classTime: null, classGroup: null, subject: null, syllabus: null, lesson: null,
    status: null, homework: null, remarks: null, daysPerWeek: null, total: null, present: null, absent: null, percent: null,
    missedReason: null, rawText: rawChunk.trim(),
  };
  const texts = { syllabus: [], lesson: [], remarks: [], homework: [], status: [] };
  let current = null; // field collecting follow-on lines

  for (const line of lines) {
    const parts = splitLabel(line);
    const field = parts ? labelOf(parts[0]) : null;
    if (field) {
      const value = tidy(parts[1]);
      current = null;
      switch (field) {
        case 'name':
          if (!r.name && value) r.name = value.replace(/\s*\(.*$/, '').trim() || value;
          break;
        case 'teacherName':
          r.teacherName = value || r.teacherName;
          break;
        case 'total':
          if (num(value) != null) r.total = num(value);
          break;
        case 'present':
          if (num(value) != null) r.present = num(value);
          break;
        case 'absent':
          if (num(value) != null) r.absent = num(value);
          else if (value) r.missedReason = r.missedReason || value;
          break;
        case 'attendance':
          if (value) readAttendanceValue(r, value);
          break;
        case 'daysPerWeek':
          if (num(value) != null) r.daysPerWeek = num(value);
          break;
        case 'reason':
          if (value && !/^(?:নেই|না|none|n\/?a|nil|-)$/i.test(value)) r.missedReason = value;
          break;
        case 'lesson': {
          // Keep the label for page / surah / para lines: "Page 45", "সূরা ইয়াসিন ১-১০"
          const label = stripDecor(parts[0]);
          const keep = /page|পৃষ্ঠা|para|পারা|juz|surah|sura|সূরা|ayah|ayat|আয়াত|chapter|দরস|কায়দা|qaida/i.test(label);
          const text = keep && value ? `${label} ${value}` : value;
          if (text) texts.lesson.push(text);
          current = 'lesson';
          break;
        }
        case 'syllabus':
        case 'remarks':
        case 'homework':
        case 'status':
          if (value) texts[field].push(value);
          current = field;
          break;
        default:
          if (value && !r[field]) r[field] = value;
          if (!value && field === 'classGroup') current = 'classGroup';
      }
      continue;
    }
    // A heading such as "📅 উপস্থিতির হিসাব" ends the previous multi-line field
    if (!parts && HEADING_FIELDS.has(labelOf(line)) && !/\d/.test(toAscii(line))) {
      current = null;
      continue;
    }
    // Otherwise a line without a label continues the previous multi-line field
    const text = tidy(line);
    if (!text) continue;
    if (current === 'classGroup' && !r.classGroup) r.classGroup = text;
    else if (current && texts[current]) texts[current].push(text);
  }

  if (texts.syllabus.length) r.syllabus = texts.syllabus.join(' ');
  if (texts.lesson.length) r.lesson = texts.lesson.join(' • ');
  if (texts.remarks.length) r.remarks = texts.remarks.join(' ');
  if (texts.homework.length) r.homework = texts.homework.join(' ');
  if (texts.status.length) r.status = texts.status.join(' ');

  readSentences(r, rawChunk);

  // Anything still missing: the original fixed-format patterns
  const old = legacyParse(rawChunk);
  r.name = r.name || old.name;
  r.whatsapp = r.whatsapp || old.whatsapp;
  r.classTime = r.classTime || old.classTime;
  r.classGroup = r.classGroup || old.classGroup;
  r.subject = r.subject || old.subject;
  r.syllabus = r.syllabus || old.syllabus;
  r.daysPerWeek = r.daysPerWeek ?? old.daysPerWeek;
  r.total = r.total ?? old.totalExpected;
  r.present = r.present ?? old.totalHeld;
  r.absent = r.absent ?? old.missed;
  r.missedReason = r.missedReason || old.missedReason;
  if (r.classGroup && !r.classTime) {
    const tig = toAscii(r.classGroup).match(/\b(\d{1,2}[:.]\d{2}\s*(?:AM|PM|am|pm)?)/);
    if (tig) r.classTime = tig[1];
  }

  // Attendance: fill the missing number from the other two (or the %)
  let { total, present, absent } = r;
  if (total == null && present != null && absent != null) total = present + absent;
  else if (present == null && total != null && absent != null) present = Math.max(0, total - absent);
  else if (absent == null && total != null && present != null) absent = Math.max(0, total - present);
  else if (present == null && total != null && r.percent != null) {
    present = Math.round((total * r.percent) / 100);
    absent = total - present;
  }
  r.finalTotal = total ?? null;
  r.finalAttended = present ?? null;
  r.finalMissed = absent ?? null;
  r.attendancePct = total ? Math.round(((present ?? 0) / total) * 1000) / 10 : r.percent;

  r.statusLevel = statusLevelOf(r.status) || statusLevelOf(r.remarks);
  // Kept for older code that read these names
  r.totalExpected = r.total;
  r.totalHeld = r.present;
  r.missed = r.absent;
  return r;
}
