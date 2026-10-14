// v179: every minute, send any teacher alerts that are still waiting
// (in case the office page closed before it could send them).
import { sendPending } from '../lib/push.mjs';

export default async () => {
  try { await sendPending(); } catch { /* tried again next minute */ }
  return new Response('ok');
};

export const config = { schedule: '* * * * *' };
