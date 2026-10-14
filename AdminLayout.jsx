import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Briefcase, Cloud, ExternalLink, HardDrive, Inbox, LayoutDashboard, LogOut, Menu, SquarePen, Users, X, Globe2, Send } from 'lucide-react';
import useAdminRole from '../hooks/useAdminRole';
import { SITE_VERSION } from '../version';
import { portalLogout } from './portal/lib/api';
import { useSiteData } from '../context/SiteDataContext';
import { signOut } from '../lib/auth';
import LogoMark from '../components/shared/LogoMark';

export default function AdminLayout() {
  const { content, inquiries, storageMode, refreshInquiries } = useSiteData();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const newCount = inquiries.filter((i) => i.status === 'new').length;

  const { email, isSuper } = useAdminRole();
  useEffect(() => {
    if (isSuper) refreshInquiries().catch(() => {}); // juniors never see inquiries
  }, [refreshInquiries, isSuper]);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.title = `Admin | ${content.site.brand.name}`;
  }, [pathname, content.site.brand.name]);

  const allNav = [
    { to: '/admin/portal', label: 'Management Portal', Icon: Briefcase },
    { to: '/admin', label: 'Website dashboard', Icon: LayoutDashboard, end: true, superOnly: true },
    { to: '/admin/courses', label: 'Courses', Icon: BookOpen, superOnly: true },
    { to: '/admin/pricing', label: 'Pricing & currency', Icon: Globe2, superOnly: true },
    { to: '/admin/assign', label: 'Assignment message', Icon: Send, superOnly: true },
    { to: '/admin/content', label: 'Site content', Icon: SquarePen, superOnly: true },
    { to: '/admin/people', label: 'Board, teachers & reviews', Icon: Users, superOnly: true },
    { to: '/admin/inquiries', label: 'Inquiries', Icon: Inbox, badge: newCount, superOnly: true },
  ];
  const nav = allNav.filter((n) => !n.superOnly || isSuper);

  const handleSignOut = async () => {
    await portalLogout();
    await signOut();
    navigate('/admin/login', { replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/admin" className="flex items-center gap-3 px-5 py-5">
        <LogoMark variant="white" className="h-10 w-8" />
        <span className="font-display leading-tight text-white">
          {content.site.brand.shortName || 'Admin'}
          <span className="block text-xs text-pine-100/60">{isSuper ? 'Super Admin' : email ? 'Junior Admin' : 'Admin panel'}</span>
        </span>
      </Link>
      <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Admin">
        {nav.map(({ to, label, Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-pine-800 text-white' : 'text-pine-100/75 hover:bg-pine-800/60 hover:text-white'
              }`
            }
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {badge > 0 && (
              <span className="rounded-full bg-gold-300 px-2 py-0.5 text-xs font-semibold text-pine-950" aria-label={`${badge} new`}>
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-pine-100/10 p-3">
        <p className="flex items-center gap-2 px-3 py-2 text-xs text-pine-100/60">
          {storageMode === 'supabase' ? <Cloud className="h-3.5 w-3.5" /> : <HardDrive className="h-3.5 w-3.5" />}
          {storageMode === 'supabase' ? 'Live – synced to the cloud' : 'Cloud not connected yet'} · v{SITE_VERSION}
        </p>
        <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-pine-100/75 hover:bg-pine-800/60 hover:text-white">
          <ExternalLink className="h-4 w-4" />
          View website
        </a>
        <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-pine-100/75 hover:bg-pine-800/60 hover:text-white">
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="dot-grid sticky top-0 hidden h-screen bg-pine-950 lg:block">{sidebar}</aside>

      <div className="flex items-center justify-between border-b border-pine-900/10 bg-white px-4 py-3 lg:hidden">
        <Link to="/admin" className="flex items-center gap-2 font-display text-pine-900">
          <LogoMark className="h-8 w-8" />
          Admin
        </Link>
        <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open admin menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-pine-950/60" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="dot-grid relative h-full w-72 bg-pine-950">
            <button className="absolute right-3 top-4 rounded-full p-2 text-pine-100/80 hover:text-white" onClick={() => setOpen(false)} aria-label="Close admin menu">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="min-w-0 px-4 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
