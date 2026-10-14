// v179: sends new teacher alerts to their phones (Web Push).
//
// Netlify -> Site configuration -> Environment variables needs:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  (the phone-notification key pair)
//   PUSH_SECRET                          (the same text as in the database:
//                                         select public.set_push_secret('...');)
// Optional: VAPID_SUBJECT (default mailto:qitoffice.info@gmail.com)
import webpush from 'web-push';
import { alertText } from '../../src/lib/alertText.js';

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || 'https://jigbsunxutjgxxehjeuy.supabase.co').trim();
const SUPABASE_ANON = (process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppZ2JzdW54dXRqZ3h4ZWhqZXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNDY2MjksImV4cCI6MjEwNTcyMjYyOX0.8emn2Oqqv6IWPsWWafy0_cjs9tazi2xRcMpOYpnyevA').trim();

export const publicKey = () => (process.env.VAPID_PUBLIC_KEY || '').trim();
export const ready = () => Boolean(publicKey() && (process.env.VAPID_PRIVATE_KEY || '').trim() && (process.env.PUSH_SECRET || '').trim());
// v189: which Netlify settings are missing (names only, never values)
export const missing = () => ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'PUSH_SECRET'].filter((k) => !(process.env[k] || '').trim());
const vapid = (push) => push.setVapidDetails((process.env.VAPID_SUBJECT || 'mailto:qitoffice.info@gmail.com').trim(), publicKey(), process.env.VAPID_PRIVATE_KEY.trim());
const errInfo = (e, endpoint) => ({ status: e?.statusCode || 0, host: (() => { try { return new URL(endpoint).host; } catch { return ''; } })(), body: String(e?.body || e?.message || '').slice(0, 160) });

/** v189: the office test — sends one test notification to the presser's devices and reports each result. */
export async function sendTest(id, { f = fetch, push = webpush } = {}) {
  if (!ready()) return { ok: false, reason: 'not set up', missing: missing() };
  const secret = process.env.PUSH_SECRET.trim();
  let a;
  try {
    a = await rpc('push_test_take', { p_secret: secret, p_id: Number(id) }, f);
  } catch (e) {
    return { ok: false, reason: /Not allowed/i.test(String(e.message)) ? 'secret mismatch' : 'database', detail: String(e.message).slice(0, 200) };
  }
  if (!a) return { ok: false, reason: 'no test' };
  vapid(push);
  const payload = JSON.stringify({ title: a.title, body: short(a.body), url: a.url || '/admin/portal', tag: `qit-alert-${a.id}` });
  const results = await Promise.all((a.subs || []).map((raw) => {
    const { qitLang, ...sub } = raw || {};
    return push.sendNotification(sub, payload, { TTL: 600, urgency: 'high' })
      .then(() => ({ ok: true, host: errInfo({}, sub.endpoint).host }))
      .catch((e) => ({ ok: false, ...errInfo(e, sub.endpoint), endpoint: sub.endpoint }));
  }));
  const dead = results.filter((r) => !r.ok && (r.status === 404 || r.status === 410)).map((r) => r.endpoint);
  if (dead.length) await rpc('push_drop', { p_secret: secret, p_endpoints: dead }, f).catch(() => null);
  return { ok: true, devices: results.length, sent: results.filter((r) => r.ok).length, errors: results.filter((r) => !r.ok).map(({ endpoint, ...r }) => r), removed: dead.length };
}

async function rpc(name, args, f) {
  const r = await f(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON, authorization: `Bearer ${SUPABASE_ANON}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${name}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// a phone shows only a few lines; the full text is in the dashboard
const short = (b) => { const x = String(b || '').replace(/\s+/g, ' ').trim(); return x.length > 300 ? `${x.slice(0, 297)}…` : x; };

/** Take the new alerts from the database and send each one to the teacher's phones. */
export async function sendPending({ f = fetch, push = webpush } = {}) {
  if (!ready()) return { ok: false, reason: 'not set up' };
  const secret = process.env.PUSH_SECRET.trim();
  vapid(push);
  let sent = 0;
  const errors = [];
  let failed = 0;
  const dead = new Set();
  for (let round = 0; round < 5; round += 1) {
    const alerts = await rpc('push_take', { p_secret: secret, p_limit: 200 }, f);
    if (!Array.isArray(alerts) || !alerts.length) break;
    const jobs = [];
    for (const a of alerts) {
      for (const raw of a.subs || []) {
        if (!raw?.endpoint || dead.has(raw.endpoint)) continue;
        // each phone gets the language its dashboard is set to
        const { qitLang, ...sub } = raw;
        const txt = alertText(a, qitLang);
        const payload = JSON.stringify({ title: (txt.title || 'QIT').slice(0, 140), body: short(txt.body), url: a.url || '/teacher', tag: `qit-alert-${a.id}` });
        jobs.push(push.sendNotification(sub, payload, { TTL: 60 * 60 * 24, urgency: 'high' })
          .then(() => { sent += 1; })
          .catch((e) => { failed += 1; if (errors.length < 5) errors.push(errInfo(e, sub.endpoint)); if (e?.statusCode === 404 || e?.statusCode === 410) dead.add(sub.endpoint); }));
      }
    }
    await Promise.all(jobs);
    if (alerts.length < 200) break;
  }
  if (dead.size) await rpc('push_drop', { p_secret: secret, p_endpoints: [...dead] }, f).catch(() => null);
  return { ok: true, sent, failed, removed: dead.size, errors };
}
