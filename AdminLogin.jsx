import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Eye, EyeOff, Lock } from 'lucide-react';
import { hasSession, ROLES, signIn, usingDefaultPassword } from '../lib/auth';
import { portalLogin } from './portal/lib/api';
import { useSiteData } from '../context/SiteDataContext';

const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;
const LOCK_KEY = 'qii:login-lock'; // survives a page reload

const TABS = [
  { role: ROLES.SUPER, label: 'Executive', hint: 'Super Admins only. Full access to the website and the management portal.' },
  { role: ROLES.JUNIOR, label: 'Junior Admin', hint: 'Sign in with any Gmail address and the Junior Admin password. Opens Students, Progress Reports, Enroll Teacher and Enroll Student.' },
];

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { content } = useSiteData();
  const [role, setRole] = useState(ROLES.SUPER);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntilState] = useState(() => Number(localStorage.getItem(LOCK_KEY)) || 0);
  const setLockedUntil = (t) => {
    localStorage.setItem(LOCK_KEY, String(t));
    setLockedUntilState(t);
  };
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    document.title = `Admin sign-in | ${content.site.brand.name}`;
    hasSession().then((ok) => ok && navigate('/admin', { replace: true }));
  }, [navigate, content.site.brand.name]);

  useEffect(() => {
    if (lockedUntil <= Date.now()) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const locked = lockedUntil > now;

  const submit = async (e) => {
    e.preventDefault();
    if (locked || busy) return;
    setBusy(true);
    setError('');
    try {
      const signedInAs = await signIn({ email: email.trim(), password, role });
      // Also open the Management Portal session (Google Sheets back end).
      // If that server is unreachable the portal asks again when opened.
      await portalLogin(email.trim(), password, signedInAs).catch(() => {});
      const home = signedInAs === ROLES.SUPER ? location.state?.from || '/admin' : '/admin/portal';
      navigate(home, { replace: true });
    } catch (err) {
      const n = attempts + 1;
      if (n >= MAX_ATTEMPTS) {
        setAttempts(0);
        setLockedUntil(Date.now() + LOCK_MS);
        setNow(Date.now());
        setError('Too many attempts. Sign-in is paused for 60 seconds.');
      } else {
        setAttempts(n);
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="dot-grid flex min-h-screen items-center justify-center bg-pine-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl bg-white p-8 shadow-2xl">
          <img src="/brand/logo-full.png" alt="QIT" className="h-12 w-auto" />
          <h1 className="mt-6 text-2xl">Admin sign-in</h1>
          <p className="mt-1.5 text-sm text-ink/65">For QIT staff only.</p>

          <div role="tablist" aria-label="Sign in as" className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-pine-900/15 bg-pine-50 p-1">
            {TABS.map((t) => (
              <button
                key={t.role}
                type="button"
                role="tab"
                aria-selected={role === t.role}
                onClick={() => {
                  setRole(t.role);
                  setError('');
                }}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition ${role === t.role ? 'bg-pine-900 text-white shadow' : 'text-pine-900 hover:bg-white'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink/60">{TABS.find((t) => t.role === role).hint}</p>

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            {(
              <div>
                <label htmlFor="admin-email" className="label">
                  Email
                </label>
                <input id="admin-email" type="email" autoComplete="username" className="input" placeholder={role === ROLES.JUNIOR ? "yourname@gmail.com" : ""} value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            )}
            <div>
              <label htmlFor="admin-password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="input pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink/50 hover:text-ink"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                {locked ? `Too many attempts. Try again in ${Math.ceil((lockedUntil - now) / 1000)} seconds.` : error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full py-3" disabled={busy || locked || !password || !email}>
              <Lock className="h-4 w-4" />
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {usingDefaultPassword && (
            <div className="mt-6 flex gap-2.5 rounded-xl bg-gold-100 p-3.5 text-xs leading-relaxed text-gold-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p>
                The default password is active.
                {import.meta.env.DEV && (
                  <>
                    {' '}
                    
                  </>
                )}{' '}
                Set VITE_ADMIN_PASSWORD_HASH before publishing the site.
              </p>
            </div>
          )}
        </div>
        <Link to="/" className="mt-6 block text-center text-sm text-pine-100/80 hover:text-white">
          Back to the website
        </Link>
      </div>
    </main>
  );
}
