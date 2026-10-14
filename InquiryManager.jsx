import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Eye, Mail, MessageCircle, Search, Trash2 } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';
import { useToast } from '../components/ui/Toast';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import AdminPageHeader from './components/AdminPageHeader';
import StatusBadge from './components/StatusBadge';
import { INQUIRY_STATUSES } from '../data/defaultContent';
import { downloadFile, formatDate, toCSV, whatsappLink } from '../lib/utils';

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function StatusSelect({ inquiry, onChange }) {
  return (
    <select
      className="input w-auto py-1.5 pr-8 text-xs"
      value={inquiry.status}
      onChange={(e) => onChange(inquiry, e.target.value)}
      aria-label={`Status for ${inquiry.name}`}
    >
      {INQUIRY_STATUSES.map((s) => (
        <option key={s} value={s}>
          {capitalise(s)}
        </option>
      ))}
    </select>
  );
}

function ContactLinks({ inquiry, name }) {
  const wa = whatsappLink(inquiry.phone, `Assalamu alaikum ${inquiry.name}, thank you for contacting ${name}.`);
  return (
    <div className="flex gap-1">
      {inquiry.email && (
        <a href={`mailto:${inquiry.email}?subject=${encodeURIComponent(`Your request to ${name}`)}`} className="icon-btn" aria-label={`Email ${inquiry.name}`} title="Email">
          <Mail className="h-4 w-4" />
        </a>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" className="icon-btn" aria-label={`WhatsApp ${inquiry.name}`} title="WhatsApp">
          <MessageCircle className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

export default function InquiryManager() {
  const { content, inquiries, updateInquiry, deleteInquiry, storageMode } = useSiteData();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'all';
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const brandName = content.site.brand.name;

  const counts = useMemo(() => {
    const c = { all: inquiries.length };
    INQUIRY_STATUSES.forEach((s) => (c[s] = inquiries.filter((i) => i.status === s).length));
    return c;
  }, [inquiries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inquiries.filter(
      (i) =>
        (status === 'all' || i.status === status) &&
        (type === 'all' || i.type === type) &&
        (!q || `${i.name} ${i.email} ${i.phone} ${i.country ?? ''} ${i.course} ${i.message}`.toLowerCase().includes(q)),
    );
  }, [inquiries, status, type, query]);

  const changeStatus = async (inquiry, next) => {
    try {
      await updateInquiry(inquiry.id, { status: next });
      setViewing((v) => (v?.id === inquiry.id ? { ...v, status: next } : v));
      toast(`Marked as ${next}`);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const exportCSV = () => {
    const csv = toCSV(filtered, [
      { label: 'Received', value: (r) => new Date(r.createdAt).toISOString() },
      { label: 'Type', value: 'type' },
      { label: 'Status', value: 'status' },
      { label: 'Name', value: 'name' },
      { label: 'Email', value: 'email' },
      { label: 'WhatsApp / phone', value: 'phone' },
      { label: 'Country', value: 'country' },
      { label: 'Course', value: 'course' },
      { label: 'Preferred time', value: 'preferredTime' },
      { label: 'Class date', value: 'classDate' },
      { label: 'Teacher', value: 'teacher' },
      { label: 'Medium', value: 'medium' },
      { label: 'Platform', value: 'platform' },
      { label: 'Message', value: 'message' },
    ]);
    downloadFile(`inquiries-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
  };

  return (
    <>
      <AdminPageHeader
        title="Inquiries"
        description="Free trial bookings and messages from the website. Update the status as you follow up."
        actions={
          <button className="btn-outline" onClick={exportCSV} disabled={!filtered.length}>
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {['all', ...INQUIRY_STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setParams(s === 'all' ? {} : { status: s }, { replace: true })}
              aria-pressed={status === s}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                status === s ? 'bg-pine-900 text-white' : 'border border-pine-900/15 bg-white text-ink/70 hover:text-pine-900'
              }`}
            >
              {s === 'all' ? 'All' : capitalise(s)} <span className="opacity-60">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className="input sm:w-40" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
            <option value="all">All types</option>
            <option value="trial">Free trials</option>
            <option value="contact">Messages</option>
          </select>
          <label className="relative block sm:w-64">
            <span className="sr-only">Search inquiries</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <input className="input pl-10" placeholder="Search name, email, course" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel p-10 text-center text-ink/70">
          {inquiries.length ? (
            'No inquiries match these filters.'
          ) : (
            <>
              <p>No inquiries yet. Requests from the free trial and contact forms appear here.</p>
              {storageMode === 'local' && <p className="mt-2 text-sm text-ink/55">Submit a test request on the website in this browser to see how it works.</p>}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="panel hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-pine-900/10 text-xs text-ink/55">
                <tr>
                  <th className="px-5 py-3 font-medium">Received</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Request</th>
                  <th className="px-5 py-3 font-medium">Schedule</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pine-900/10">
                {filtered.map((i) => (
                  <tr key={i.id} className={i.status === 'new' ? 'bg-gold-100/30' : 'hover:bg-paper'}>
                    <td className="whitespace-nowrap px-5 py-3.5 text-ink/65">{formatDate(i.createdAt, true)}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink">{i.name}</p>
                      <p className="text-xs text-ink/55">{[i.phone || i.email, i.country].filter(Boolean).join(' · ')}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={i.type} />
                      <p className="mt-1 text-xs text-ink/65">{i.course || (i.type === 'trial' ? 'Course not chosen' : '')}</p>
                    </td>
                    <td className="max-w-[14rem] px-5 py-3.5 text-xs text-ink/65">
                      {[i.classDate, i.preferredTime].filter(Boolean).join(', ') || '–'}
                      {i.platform && <span className="block text-ink/50">{[i.platform, i.teacher && `${i.teacher} teacher`, i.medium].filter(Boolean).join(' · ')}</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusSelect inquiry={i} onChange={changeStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end">
                        <ContactLinks inquiry={i} name={brandName} />
                        <button className="icon-btn" onClick={() => setViewing(i)} aria-label={`View details for ${i.name}`} title="View details">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="icon-btn hover:bg-red-50 hover:text-red-700" onClick={() => setDeleting(i)} aria-label={`Delete inquiry from ${i.name}`} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 lg:hidden">
            {filtered.map((i) => (
              <li key={i.id} className="panel p-4">
                <button className="w-full text-left" onClick={() => setViewing(i)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{i.name}</p>
                      <p className="text-xs text-ink/55">{formatDate(i.createdAt, true)}</p>
                    </div>
                    <StatusBadge status={i.type} />
                  </div>
                  {i.course && <p className="mt-2 text-sm text-ink/70">{i.course}</p>}
                </button>
                <div className="mt-3 flex items-center justify-between border-t border-pine-900/10 pt-3">
                  <StatusSelect inquiry={i} onChange={changeStatus} />
                  <ContactLinks inquiry={i} name={brandName} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.name ?? ''} description={viewing ? `Received ${formatDate(viewing.createdAt, true)}` : ''} size="md">
        {viewing && (
          <>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[
                ['Request', viewing.type === 'trial' ? 'Free trial' : 'Message'],
                ['Email', viewing.email],
                ['WhatsApp / phone', viewing.phone],
                ['Country', viewing.country],
                ['Course', viewing.course],
                ['Preferred class time', viewing.preferredTime],
                ['Class date', viewing.classDate],
                ['Preferred teacher', viewing.teacher],
                ['Class medium', viewing.medium],
                ['Preferred platform', viewing.platform],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-ink/55">{label}</dt>
                    <dd className="mt-0.5 break-words font-medium text-ink">{value}</dd>
                  </div>
                ))}
              {viewing.message && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-ink/55">Message</dt>
                  <dd className="mt-1 whitespace-pre-wrap rounded-xl bg-paper p-3.5 text-ink/85">{viewing.message}</dd>
                </div>
              )}
            </dl>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-pine-900/10 pt-5">
              <label className="flex items-center gap-2 text-sm text-ink/70">
                Status
                <StatusSelect inquiry={viewing} onChange={changeStatus} />
              </label>
              <ContactLinks inquiry={viewing} name={brandName} />
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this inquiry?"
        message={deleting ? `The request from ${deleting.name} will be permanently removed.` : ''}
        confirmLabel="Delete inquiry"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await deleteInquiry(deleting.id);
            toast('Inquiry deleted');
          } catch (err) {
            toast(err.message, 'error');
          }
          setDeleting(null);
        }}
      />
    </>
  );
}
