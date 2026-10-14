// v179: phone notifications for teachers.
// GET  -> { publicKey } so a phone can turn notifications on
// GET ?send=1 -> send now (called by the database itself, so nothing waits)
// POST -> sends any new alerts right away (the office website calls this
//         after each change; push-cron also runs it every minute)
import { missing, publicKey, ready, sendPending, sendTest } from '../lib/push.mjs';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export default async (req) => {
  // the database calls GET ?send=1 the moment a notification is added (v180)
  if (req.method === 'GET' && new URL(req.url).searchParams.get('send') !== '1') return json(200, { publicKey: publicKey(), ready: ready(), missing: missing() });
  if (req.method !== 'POST' && req.method !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    // v189: the office "Send a test notification" button: { testId }
    if (req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (body?.testId) return json(200, await sendTest(body.testId));
    }
    return json(200, await sendPending());
  } catch (e) {
    return json(500, { error: String(e?.message || e).slice(0, 300) });
  }
};
