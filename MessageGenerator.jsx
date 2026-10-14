import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardCheck, Copy, Inbox, MessageSquareText, Send, Smartphone, Wand2 } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';
import { useToast } from '../components/ui/Toast';
import AdminPageHeader from './components/AdminPageHeader';

/**
 * Student assignment messages.
 * - Every booking from the website (trial form or Buy Course) is drafted
 *   automatically here as an assignment message ("New bookings").
 * - Every field is optional; only filled fields go into the message.
 * - Teacher category "Others" leaves the category out of the heading
 *   ("New Student Assignment"); all the student details are still included.
 * - "Generate & Send" copies the message and opens the Student Group QIT
 *   WhatsApp group, where you paste and send. (WhatsApp does not let a
 *   website choose the sending account or post into a group by itself.)
 */
const SENDER = '+880 1403-291872';
const GROUP_LINK = 'https://chat.whatsapp.com/EQ0kFWnBGgCFjRlubw81UT?s=cl&p=i&mlu=4&ilr=4';
const CATEGORIES = [
  { key: 're', label: 'Re. Teachers' },
  { key: 'ma', label: 'Ma. Teachers' },
  { key: 'fe', label: 'Fe. Teachers' },
  { key: 'others', label: 'Others' },
];
const FIELDS = [
  { key: 'student', label: 'Student name', icon: '👤' },
  { key: 'country', label: 'Country', icon: '🌍' },
  { key: 'course', label: 'Course details', icon: '📚' },
  { key: 'time', label: 'Class time', icon: '🕒' },
  { key: 'date', label: 'Date', icon: '📅', type: 'date' },
  { key: 'duration', label: 'Duration', icon: '⏱', placeholder: 'e.g. 45 minutes' },
  { key: 'days', label: 'Days / week', icon: '🗓', placeholder: 'e.g. 5 days' },
  { key: 'payment', label: 'Monthly payment', icon: '💳', placeholder: 'e.g. BDT 4,000' },
  { key: 'notes', label: 'Notes', icon: '📝', textarea: true },
];
const EMPTY = Object.fromEntries(FIELDS.map((f) => [f.key, '']));
const ONLY_TITLE = 'New Student Assignment';

function formatDate(v) {
  if (!v) return '';
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
const isoDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : '');

// Turn a website booking into form values
function fromBooking(q) {
  const buy = String(q.message || '').startsWith('Buy Course');
  const payment = buy ? String(q.message).split('Monthly payment:')[1]?.trim() || '' : '';
  const planMatch = String(q.course || '').match(/(\d+\s*[–-]\s*\d+|\d+)\s*days a week/i);
  const notes = [
    q.teacher && `Preferred teacher: ${q.teacher}`,
    q.medium && `Medium: ${q.medium}`,
    q.platform && `Platform: ${q.platform}`,
    q.phone && `WhatsApp: ${q.phone}`,
    !buy && q.message,
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    ...EMPTY,
    student: buy ? '' : q.name || '',
    country: q.country || '',
    course: q.course || '',
    time: q.preferredTime || '',
    date: isoDate(q.classDate),
    days: planMatch ? `${planMatch[1]} days` : '',
    payment,
    notes,
  };
}

// "Others" leaves the teacher category out of the heading; everything else stays
function buildMessage(values, category) {
  const lines = FIELDS.filter((f) => String(values[f.key]).trim()).map((f) => {
    const v = f.type === 'date' ? formatDate(values[f.key]) : String(values[f.key]).trim();
    return `${f.icon} *${f.label}:* ${v}`;
  });
  if (!lines.length) return '';
  const heading = category.key === 'others' ? `📌 *${ONLY_TITLE}*` : `📌 *${ONLY_TITLE} — ${category.label}*`;
  return [heading, '', ...lines, '', 'Quran International Institute (QIT)'].join('\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export default function MessageGenerator() {
  const toast = useToast();
  const { inquiries, updateInquiry } = useSiteData();
  const [values, setValues] = useState(EMPTY);
  const [category, setCategory] = useState('re');
  const [bookingId, setBookingId] = useState('');
  const [copied, setCopied] = useState(false);
  const cat = CATEGORIES.find((c) => c.key === category);
  const message = useMemo(() => buildMessage(values, cat), [values, cat]);

  // Website bookings not yet handled, newest first — each is a ready draft
  const bookings = useMemo(
    () => inquiries.filter((q) => q.type === 'trial' && q.status === 'new').sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 12),
    [inquiries],
  );

  // Automatically draft the newest booking when the page opens with an empty form
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (autoLoaded.current || !bookings.length) return;
    autoLoaded.current = true;
    setValues(fromBooking(bookings[0]));
    setBookingId(bookings[0].id);
  }, [bookings]);

  const loadBooking = (q) => {
    setValues(fromBooking(q));
    setBookingId(q.id);
    setCopied(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generateAndSend = async () => {
    if (!message) return toast('Fill in at least one field first.', 'error');
    // Open the group first (inside the click) so pop-up blockers allow it
    const win = window.open(GROUP_LINK, '_blank');
    if (win) win.opener = null;
    const ok = await copyText(message);
    setCopied(ok);
    toast(ok ? 'Message copied. Paste it in Student Group QIT and send.' : 'Could not copy automatically. Use the Copy button.', ok ? undefined : 'error');
    if (!win) toast('Allow pop-ups for this site so WhatsApp can open.', 'error');
    // The booking has now been assigned
    if (bookingId) updateInquiry(bookingId, { status: 'contacted' }).catch(() => {});
  };

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <div>
      <AdminPageHeader
        title="Student assignment message"
        description="Website bookings are drafted here automatically. Fill in or adjust any field (all optional), choose the teacher category, then send to Student Group QIT."
      />

      <div className="mb-6 flex gap-3 rounded-2xl border border-gold-300/60 bg-gold-100/50 p-4 text-sm text-ink/80">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-gold-700" />
        <p>
          Use this page on the phone or WhatsApp Web logged in as <strong>{SENDER}</strong>: WhatsApp sends from whichever account is logged in. The button copies
          the message and opens <strong>Student Group QIT</strong>; paste it there (Ctrl+V or long-press → Paste) and send.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel p-5">
          {bookingId && (
            <p className="mb-4 flex items-center gap-2 rounded-xl bg-pine-50 px-3 py-2 text-sm text-pine-900">
              <Wand2 className="h-4 w-4" /> Drafted from a website booking. Check it, then send.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.textarea ? 'sm:col-span-2' : ''}>
                <label className="label" htmlFor={`msg-${f.key}`}>
                  {f.label} <span className="font-normal text-ink/45">(optional)</span>
                </label>
                {f.textarea ? (
                  <textarea id={`msg-${f.key}`} rows={3} className="input" value={values[f.key]} onChange={set(f.key)} />
                ) : (
                  <input id={`msg-${f.key}`} type={f.type || 'text'} className="input" placeholder={f.placeholder} value={values[f.key]} onChange={set(f.key)} />
                )}
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="label" htmlFor="msg-category">
                Teacher category
              </label>
              <select id="msg-category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                    {c.key === 'others' ? ' (no teacher category in the message)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={generateAndSend}>
              <Send className="h-4 w-4" /> Generate &amp; Send Message
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setValues(EMPTY);
                setBookingId('');
              }}
            >
              Clear form
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="panel p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg">
                <MessageSquareText className="h-5 w-5 text-pine-700" /> Preview
              </h2>
              <button
                type="button"
                className="btn-outline btn-sm"
                disabled={!message}
                onClick={async () => {
                  const ok = await copyText(message);
                  setCopied(ok);
                  toast(ok ? 'Message copied' : 'Could not copy', ok ? undefined : 'error');
                }}
              >
                {copied ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy
              </button>
            </div>
            <pre className="min-h-[10rem] whitespace-pre-wrap rounded-xl bg-[#e7f7e1] p-4 font-sans text-sm leading-relaxed text-[#123]">
              {message || 'Your message appears here as you fill in the form.'}
            </pre>
          </div>

          <div className="panel p-5">
            <h2 className="flex items-center gap-2 text-lg">
              <Inbox className="h-5 w-5 text-pine-700" /> New bookings ({bookings.length})
            </h2>
            <p className="mt-1 text-xs text-ink/60">Trial requests and Buy Course clicks from the website, drafted automatically. Sending marks a booking as contacted.</p>
            {bookings.length ? (
              <ul className="mt-3 divide-y divide-pine-900/10">
                {bookings.map((q) => (
                  <li key={q.id} className={`flex items-center justify-between gap-3 py-2.5 ${q.id === bookingId ? 'rounded-lg bg-pine-50 px-2' : ''}`}>
                    <span className="min-w-0 text-sm">
                      <span className="block truncate font-semibold text-pine-950">{q.name || 'Website visitor'}</span>
                      <span className="block truncate text-ink/60">
                        {[q.course, q.country, new Date(q.createdAt).toLocaleDateString('en-GB')].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <button type="button" className="btn-outline btn-sm shrink-0" onClick={() => loadBooking(q)}>
                      {q.id === bookingId ? 'Loaded' : 'Use draft'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink/55">No new bookings right now.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
