// QIT AI assistant (Google Gemini) — runs on Netlify, never in the browser.
//
// The Gemini API key stays here on the server: set GEMINI_API_KEY in
// Netlify -> Site configuration -> Environment variables. Optional:
// GEMINI_MODEL to force one model id.
// Only signed-in Executives and Junior Admins can call it: the caller's
// Supabase session is checked before anything is sent to Gemini.

// Public values (the same ones the website itself uses)
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || 'https://jigbsunxutjgxxehjeuy.supabase.co').trim();
const SUPABASE_ANON = (process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppZ2JzdW54dXRqZ3h4ZWhqZXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNDY2MjksImV4cCI6MjEwNTcyMjYyOX0.8emn2Oqqv6IWPsWWafy0_cjs9tazi2xRcMpOYpnyevA').trim();
const API = 'https://generativelanguage.googleapis.com/v1beta';
// Tried in order; a model that does not exist or is over its quota is skipped
const PREFERRED = ['gemini-pro-latest', 'gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-2.5-flash'];
// v160: quick answers first (Flash models answer in a few seconds; Pro only if they fail)
const FAST = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-pro-latest', 'gemini-2.5-pro'];
const MAX_IN = 700000; // the assistant sends the office records with a question

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function whoIs(token, f = fetch) {
  if (!token) return null;
  const h = { apikey: SUPABASE_ANON, authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const u = await f(`${SUPABASE_URL}/auth/v1/user`, { headers: h });
  if (!u.ok) return null;
  const a = await f(`${SUPABASE_URL}/rest/v1/rpc/my_access`, { method: 'POST', headers: h, body: '{}' });
  if (!a.ok) return null;
  const access = await a.json();
  return ['super', 'junior'].includes(access?.role) ? access : null;
}

async function listModels(key, f) {
  const r = await f(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  if (!r.ok) return [];
  const d = await r.json();
  const ok = (d.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => String(m.name).replace(/^models\//, ''))
    .filter((n) => /^gemini/.test(n) && !/(image|tts|audio|embedding|live|vision|robotics|computer)/.test(n));
  const rank = (n) => (/pro/.test(n) ? 0 : /flash-lite/.test(n) ? 2 : 1);
  return ok.sort((a, b) => rank(a) - rank(b) || b.localeCompare(a, undefined, { numeric: true }));
}

export async function generate({ key, system, messages, wantJson, forced, quality = false }, f = fetch) {
  const body = {
    contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.text || '') }] })),
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: { temperature: 0.6, maxOutputTokens: 4096, ...(wantJson ? { responseMimeType: 'application/json' } : {}) },
  };
  let last = 'No Gemini model answered.';
  const tryList = async (list) => {
    for (const model of list) {
      // the key travels in a header (works for both the older AIza… keys and the newer AQ.… keys)
      const r = await f(`${API}/models/${model}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
      if (r.ok) {
        const d = await r.json();
        const text = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
        if (text) return { text, model };
        last = d.promptFeedback?.blockReason ? `Gemini declined this request (${d.promptFeedback.blockReason}).` : 'Gemini returned an empty answer.';
        continue;
      }
      const e = await r.json().catch(() => ({}));
      last = e.error?.message || `Gemini error ${r.status}`;
      if ([400, 401, 403].includes(r.status) && /API key|unauthenticated|credential/i.test(last)) throw new Error('The Gemini API key is not valid. Check GEMINI_API_KEY in Netlify.');
      if (![400, 403, 404, 429, 500, 503].includes(r.status)) break;
    }
    return null;
  };
  const order = quality ? PREFERRED : FAST;
  const first = await tryList(forced ? [forced] : order);
  if (first) return first;
  const found = (await listModels(key, f)).filter((m) => !order.includes(m)).slice(0, 4);
  const second = found.length ? await tryList(found) : null;
  if (second) return second;
  throw new Error(last);
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) return json(503, { error: 'not_configured', message: 'The AI assistant is not switched on yet: add GEMINI_API_KEY in Netlify.' });
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const access = await whoIs(token).catch(() => null);
  if (!access) return json(401, { error: 'not_allowed', message: 'Sign in as an Executive or Junior Admin to use the AI assistant.' });
  let input;
  try { input = await req.json(); } catch { return json(400, { error: 'bad_request' }); }
  const messages = (Array.isArray(input.messages) ? input.messages : []).filter((m) => m && typeof m.text === 'string' && m.text.trim()).slice(-12);
  if (!messages.length) return json(400, { error: 'bad_request', message: 'Nothing to answer.' });
  if (JSON.stringify(messages).length + String(input.system || '').length > MAX_IN) return json(413, { error: 'too_long', message: 'That is too long for one request. Shorten it and try again.' });
  try {
    const out = await generate({ key, system: String(input.system || ''), messages, wantJson: Boolean(input.json), forced: (process.env.GEMINI_MODEL || '').trim(), quality: Boolean(input.quality) });
    return json(200, out);
  } catch (e) {
    return json(502, { error: 'ai_failed', message: e.message || 'The AI did not answer. Try again.' });
  }
};
