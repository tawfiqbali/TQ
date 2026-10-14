import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';
import { useToast } from '../components/ui/Toast';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import AdminPageHeader from './components/AdminPageHeader';
import RecordForm from './components/RecordForm';
import {
  boardSchema,
  emptyBoardMember,
  emptyFaq,
  faqSchema,
  emptyInstructor,
  emptyTestimonial,
  instructorSchema,
  testimonialSchema,
} from './schemas';

const TIER_LABELS = { 1: 'Row 1 · Founders', 2: 'Row 2 · CEO', 3: 'Row 3 · Team' };

const COLLECTIONS = [
  {
    key: 'board',
    label: 'Board',
    singular: 'board member',
    schema: boardSchema,
    empty: emptyBoardMember,
    title: (r) => `${r.name} — ${r.role}`,
    subtitle: (r) => TIER_LABELS[r.tier] ?? '',
  },
  {
    key: 'instructors',
    label: 'Teachers',
    singular: 'teacher',
    schema: instructorSchema,
    empty: emptyInstructor,
    title: (r) => r.name,
    subtitle: (r) => r.title,
  },
  {
    key: 'testimonials',
    label: 'Reviews',
    singular: 'review',
    schema: testimonialSchema,
    empty: emptyTestimonial,
    title: (r) => `${r.name}${r.quoteBn?.trim() ? ' · বাংলা ✓' : ''}`,
    subtitle: (r) => `“${r.quote.slice(0, 90)}${r.quote.length > 90 ? '…' : ''}”`,
  },
  {
    key: 'faqs',
    label: 'FAQ',
    singular: 'question',
    schema: faqSchema,
    empty: emptyFaq,
    title: (r) => r.question,
    subtitle: (r) => r.answer,
  },
];

// Reviews tab: how fast the reviews scroll across the website
function SliderTimeSetting() {
  const { content, updateSite } = useSiteData();
  const toast = useToast();
  const section = content.site.testimonialsSection || {};
  const [value, setValue] = useState(String(section.scrollSeconds ?? 8));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 2 || n > 60) return toast('Enter a number of seconds between 2 and 60.', 'error');
    setBusy(true);
    try {
      await updateSite('testimonialsSection', { ...section, scrollSeconds: n });
      toast(`Each review now takes ${n} seconds to scroll past`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="panel mb-6 flex flex-wrap items-end gap-3 p-4">
      <div>
        <label className="label" htmlFor="review-slide-seconds">
          Scrolling speed (seconds per review)
        </label>
        <input id="review-slide-seconds" type="number" min="2" max="60" step="0.5" className="input w-32" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <button type="button" className="btn-primary" onClick={save} disabled={busy || Number(value) === Number(section.scrollSeconds ?? 8)}>
        {busy ? 'Saving…' : 'Save'}
      </button>
      <p className="w-full text-xs text-ink/55 sm:w-auto sm:flex-1">How many seconds each review takes to scroll across the website. Higher = slower. Default 8.</p>
    </div>
  );
}

export default function PeopleManager() {
  const { content, saveItem, deleteItem, moveItem } = useSiteData();
  const toast = useToast();
  const [tab, setTab] = useState(COLLECTIONS[0].key);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const col = COLLECTIONS.find((c) => c.key === tab);
  const items = content[col.key] ?? [];

  const run = async (promise, message) => {
    try {
      await promise;
      if (message) toast(message);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Teachers & reviews"
        description="Manage the teacher profiles, reviews and reasons to choose you. Use the arrows to set the display order."
        actions={
          <button className="btn-primary" onClick={() => setEditing({ record: col.empty(), isNew: true })}>
            <Plus className="h-4 w-4" /> Add {col.singular}
          </button>
        }
      />

      <div role="tablist" className="mb-6 inline-flex flex-wrap gap-1 rounded-full border border-pine-900/15 bg-white p-1">
        {COLLECTIONS.map((c) => (
          <button
            key={c.key}
            role="tab"
            aria-selected={tab === c.key}
            onClick={() => setTab(c.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${tab === c.key ? 'bg-pine-900 text-white' : 'text-ink/65 hover:text-pine-900'}`}
          >
            {c.label} <span className="opacity-60">({(content[c.key] ?? []).length})</span>
          </button>
        ))}
      </div>

      {tab === 'testimonials' && <SliderTimeSetting />}

      {items.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-ink/70">Nothing here yet. This section is hidden on the website until you add one.</p>
          <button className="btn-primary mt-4" onClick={() => setEditing({ record: col.empty(), isNew: true })}>
            <Plus className="h-4 w-4" /> Add {col.singular}
          </button>
        </div>
      ) : (
        <ul className="panel divide-y divide-pine-900/10">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{col.title(item)}</p>
                <p className="truncate text-sm text-ink/55">{col.subtitle(item)}</p>
              </div>
              <div className="flex shrink-0 items-center">
                <button className="icon-btn disabled:opacity-30" disabled={index === 0} onClick={() => run(moveItem(col.key, item.id, -1))} aria-label="Move up">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  className="icon-btn disabled:opacity-30"
                  disabled={index === items.length - 1}
                  onClick={() => run(moveItem(col.key, item.id, 1))}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button className="icon-btn" onClick={() => setEditing({ record: item, isNew: false })} aria-label={`Edit ${col.title(item)}`}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button className="icon-btn hover:bg-red-50 hover:text-red-700" onClick={() => setDeleting(item)} aria-label={`Delete ${col.title(item)}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.isNew ? `Add ${col.singular}` : `Edit ${col.singular}`}>
        {editing && (
          <RecordForm
            key={`${col.key}-${editing.record.id ?? 'new'}`}
            schema={col.schema}
            initial={editing.record}
            onCancel={() => setEditing(null)}
            submitLabel={editing.isNew ? `Add ${col.singular}` : 'Save changes'}
            onSubmit={(values) => {
              // Instant update; the save finishes in the background
              const { isNew, record } = editing;
              setEditing(null);
              saveItem(col.key, { ...record, ...values })
                .then(() => toast(isNew ? `${col.singular.charAt(0).toUpperCase() + col.singular.slice(1)} added` : 'Changes saved'))
                .catch((err) => toast(`Could not save: ${err.message}`, 'error'));
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete this ${col.singular}?`}
        message={deleting ? `"${col.title(deleting)}" will be removed from the website.` : ''}
        confirmLabel={`Delete ${col.singular}`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          await run(deleteItem(col.key, deleting.id), 'Deleted');
          setDeleting(null);
        }}
      />
    </>
  );
}
