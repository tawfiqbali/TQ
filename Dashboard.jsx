import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CloudUpload, Download, Inbox, Megaphone, PenLine, Plus, RotateCcw, Upload, UserCheck, CalendarPlus } from 'lucide-react';
import { clearBrowserOnlyData, readBrowserOnlyData } from '../lib/storage';
import { useSiteData } from '../context/SiteDataContext';
import { useToast } from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import AdminPageHeader from './components/AdminPageHeader';
import StatusBadge from './components/StatusBadge';
import { downloadFile, formatDate } from '../lib/utils';

function StatTile({ Icon, label, value, detail }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/65">{label}</p>
        <Icon className="h-5 w-5 text-gold-700" aria-hidden="true" />
      </div>
      <p className="mt-3 font-display text-4xl text-pine-900">{value}</p>
      <p className="mt-1 text-xs text-ink/55">{detail}</p>
    </div>
  );
}

export default function Dashboard() {
  const { content, inquiries, storageMode, importBackup, resetContent } = useSiteData();
  const toast = useToast();
  const fileRef = useRef(null);
  const [confirmReset, setConfirmReset] = useState(false);
  // Edits made in this browser before the cloud was connected
  const [browserData, setBrowserData] = useState(() => (storageMode === 'supabase' ? readBrowserOnlyData() : null));
  const [uploading, setUploading] = useState(false);

  const uploadBrowserData = async () => {
    setUploading(true);
    try {
      await importBackup({ content: browserData.content || content, inquiries: browserData.inquiries });
      clearBrowserOnlyData();
      setBrowserData(null);
      toast('Uploaded. Every visitor now sees this content.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const published = content.courses.filter((c) => c.published).length;
  const newCount = inquiries.filter((i) => i.status === 'new').length;
  const active = inquiries.filter((i) => ['new', 'contacted'].includes(i.status)).length;
  const enrolled = inquiries.filter((i) => i.status === 'enrolled').length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = inquiries.filter((i) => new Date(i.createdAt).getTime() > weekAgo).length;
  const recent = inquiries.slice(0, 5);

  const exportBackup = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`qii-backup-${stamp}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), content, inquiries }, null, 2), 'application/json');
    toast('Backup downloaded');
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await importBackup(JSON.parse(await file.text()));
      toast('Backup restored');
    } catch (err) {
      toast(err instanceof SyntaxError ? 'That file is not valid JSON.' : err.message, 'error');
    }
  };

  const quickActions = [
    { to: '/admin/courses?new=1', label: 'Add a course', Icon: Plus },
    { to: '/admin/content?tab=hero', label: 'Edit hero text', Icon: PenLine },
    { to: '/admin/content?tab=announcement', label: 'Update the announcement', Icon: Megaphone },
    { to: '/admin/inquiries?status=new', label: 'Reply to new inquiries', Icon: Inbox },
  ];

  return (
    <>
      <AdminPageHeader title="Dashboard" description="An overview of your courses and incoming student requests." />

      {browserData && (
        <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-pine-500/30 bg-pine-50 p-4 text-sm leading-relaxed text-pine-900 sm:flex-row sm:items-center sm:justify-between">
          <p>
            This browser still holds edits{browserData.inquiries.length ? ` and ${browserData.inquiries.length} inquiries` : ''} made before the cloud
            database was connected. Upload them once so every visitor sees them.
          </p>
          <div className="flex shrink-0 gap-2">
            <button className="btn-primary btn-sm" onClick={uploadBrowserData} disabled={uploading}>
              <CloudUpload className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload to cloud'}
            </button>
            <button className="btn-ghost btn-sm" onClick={() => { clearBrowserOnlyData(); setBrowserData(null); }}>
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile Icon={BookOpen} label="Total courses" value={content.courses.length} detail={`${published} published on the website`} />
        <StatTile Icon={Inbox} label="Active inquiries" value={active} detail={`${newCount} waiting for a first reply`} />
        <StatTile Icon={UserCheck} label="Registered students" value={enrolled} detail="Inquiries marked as enrolled" />
        <StatTile Icon={CalendarPlus} label="New this week" value={thisWeek} detail="Trial and contact requests" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg">Latest inquiries</h2>
            <Link to="/admin/inquiries" className="text-sm font-medium text-pine-700 hover:underline">
              View all
            </Link>
          </div>
          {recent.length ? (
            <ul className="mt-4 divide-y divide-pine-900/10">
              {recent.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{i.name}</p>
                    <p className="truncate text-xs text-ink/55">
                      {i.course || (i.type === 'trial' ? 'Course not chosen' : 'General message')}, {formatDate(i.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge status={i.type} />
                    <StatusBadge status={i.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-pine-50 p-5 text-sm text-ink/65">
              No inquiries yet. Requests from the free trial and contact forms appear here.
            </p>
          )}
        </section>

        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="text-lg">Quick actions</h2>
            <ul className="mt-4 space-y-1">
              {quickActions.map(({ to, label, Icon }) => (
                <li key={to}>
                  <Link to={to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink/80 hover:bg-pine-50 hover:text-pine-900">
                    <Icon className="h-4 w-4 text-pine-500" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-6">
            <h2 className="text-lg">Backup</h2>
            <p className="mt-1 text-sm text-ink/60">Download everything as a file, or restore from one.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={exportBackup} className="btn-outline btn-sm">
                <Download className="h-3.5 w-3.5" /> Download backup
              </button>
              <button onClick={() => fileRef.current?.click()} className="btn-outline btn-sm">
                <Upload className="h-3.5 w-3.5" /> Restore backup
              </button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
              <button onClick={() => setConfirmReset(true)} className="btn-ghost btn-sm text-red-700 hover:bg-red-50">
                <RotateCcw className="h-3.5 w-3.5" /> Reset content
              </button>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset all website content?"
        message="Courses, teachers, reviews and page text go back to the original sample content. Inquiries are kept. Download a backup first if you may want your changes back."
        confirmLabel="Reset content"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          try {
            await resetContent();
            toast('Content reset');
          } catch (err) {
            toast(err.message, 'error');
          }
          setConfirmReset(false);
        }}
      />
    </>
  );
}
