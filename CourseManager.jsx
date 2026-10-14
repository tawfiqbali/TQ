import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';
import { useToast } from '../components/ui/Toast';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { COURSE_THEMES } from '../components/shared/CourseCard';
import AdminPageHeader from './components/AdminPageHeader';
import RecordForm from './components/RecordForm';
import StatusBadge from './components/StatusBadge';
import { courseSchema, emptyCourse } from './schemas';
import { formatMoney } from '../lib/currency';

// "2–3 days a week: USD 35–40 · BDT 3,000–3,500" lines for the table
function planSummary(c, currency) {
  const money = (a, b, cur) => (b && b !== a ? `${formatMoney(a, cur)}–${Number(b).toLocaleString('en-US')}` : formatMoney(a, cur));
  return (c.plans ?? []).map((p) => ({ label: p.label, price: money(p.min, p.max, currency) }));
}

export default function CourseManager() {
  const { content, saveItem, deleteItem } = useSiteData();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null); // { record, isNew }
  const [deleting, setDeleting] = useState(null);
  const currency = content.site.settings.baseCurrency || 'USD';

  useEffect(() => {
    if (params.get('new') === '1') {
      setEditing({ record: emptyCourse(), isNew: true });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const courses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return content.courses.filter((c) => !q || `${c.title} ${c.subtitle ?? ''}`.toLowerCase().includes(q));
  }, [content.courses, query]);

  const run = async (promise, message) => {
    try {
      await promise;
      toast(message);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // The list and the website update instantly; saving finishes in the background
  const handleSave = (values) => {
    const { isNew, record } = editing;
    setEditing(null);
    saveItem('courses', { ...record, ...values })
      .then(() => toast(isNew ? 'Course added' : 'Course updated'))
      .catch((err) => toast(`Could not save: ${err.message}`, 'error'));
  };

  const actions = (c) => (
    <div className="flex items-center justify-end gap-1">
      <button
        className="icon-btn"
        onClick={() => run(saveItem('courses', { ...c, featured: !c.featured }), c.featured ? 'Removed from home page' : 'Shown on home page')}
        aria-label={c.featured ? `Remove ${c.title} from home page` : `Show ${c.title} on home page`}
        title={c.featured ? 'On home page' : 'Not on home page'}
      >
        <Star className={`h-4 w-4 ${c.featured ? 'fill-gold-500 text-gold-500' : ''}`} />
      </button>
      <button
        className="icon-btn"
        onClick={() => run(saveItem('courses', { ...c, published: !c.published }), c.published ? 'Course hidden' : 'Course published')}
        aria-label={c.published ? `Hide ${c.title}` : `Publish ${c.title}`}
        title={c.published ? 'Hide from website' : 'Publish'}
      >
        {c.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
      <button className="icon-btn" onClick={() => setEditing({ record: c, isNew: false })} aria-label={`Edit ${c.title}`} title="Edit">
        <Pencil className="h-4 w-4" />
      </button>
      <button className="icon-btn hover:bg-red-50 hover:text-red-700" onClick={() => setDeleting(c)} aria-label={`Delete ${c.title}`} title="Delete">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <>
      <AdminPageHeader
        title="Courses"
        description="Add, edit or remove courses. Changes appear on the website as soon as you save."
        actions={
          <button className="btn-primary" onClick={() => setEditing({ record: emptyCourse(), isNew: true })}>
            <Plus className="h-4 w-4" /> Add course
          </button>
        }
      />

      <label className="relative mb-5 block max-w-sm">
        <span className="sr-only">Search courses</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
        <input className="input pl-10" placeholder="Search courses" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      {courses.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-ink/70">{content.courses.length ? 'No courses match that search.' : 'No courses yet. Add your first course to show it on the website.'}</p>
          {!content.courses.length && (
            <button className="btn-primary mt-4" onClick={() => setEditing({ record: emptyCourse(), isNew: true })}>
              <Plus className="h-4 w-4" /> Add course
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="panel hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-pine-900/10 bg-pine-50/70 text-[11px] uppercase tracking-wider text-ink/55">
                <tr>
                  <th className="px-5 py-3 font-medium">Course</th>
                  <th className="px-5 py-3 font-medium">Class length</th>
                  <th className="px-5 py-3 font-medium">Plans (per month)</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c, i) => (
                  <tr
                    key={c.id}
                    className={`border-b border-pine-900/10 transition-colors hover:bg-pine-50 ${i % 2 ? 'bg-[#f6f9f7]' : 'bg-white'}`}
                    style={{ boxShadow: `inset 4px 0 0 rgb(${COURSE_THEMES[i % COURSE_THEMES.length].accent})` }}
                  >
                    <td className="px-5 py-4">
                      <p className="text-[15px] font-bold text-pine-950">{c.title}</p>
                      {c.subtitle && <p className="mt-0.5 text-xs uppercase tracking-wider text-ink/50">{c.subtitle}</p>}
                    </td>
                    <td className="px-5 py-4">
                      {c.classLength && <span className="rounded-full bg-gold-100 px-2.5 py-1 text-xs font-medium text-gold-700">{c.classLength}</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5">
                        {planSummary(c, currency).map((p) => (
                          <span key={p.label} className="inline-flex w-fit items-center gap-2 whitespace-nowrap rounded-lg border border-pine-900/10 bg-white px-2.5 py-1 text-xs">
                            <span className="text-ink/60">{p.label}</span>
                            <span className="font-semibold text-pine-950">{p.price}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={c.published ? 'published' : 'draft'} />
                    </td>
                    <td className="px-3 py-2">{actions(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {courses.map((c, i) => (
              <li key={c.id} className="panel p-4" style={{ boxShadow: `inset 4px 0 0 rgb(${COURSE_THEMES[i % COURSE_THEMES.length].accent})` }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-pine-950">{c.title}</p>
                    {c.classLength && <p className="mt-1 text-xs text-gold-700">{c.classLength}</p>}
                    <p className="mt-1 text-xs text-ink/60">{planSummary(c, currency).map((p) => `${p.label}: ${p.price}`).join(' · ')}</p>
                  </div>
                  <StatusBadge status={c.published ? 'published' : 'draft'} />
                </div>
                <div className="mt-2 border-t border-pine-900/10 pt-2">{actions(c)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.isNew ? 'Add course' : 'Edit course'}>
        {editing && (
          <RecordForm
            key={editing.record.id ?? 'new'}
            schema={courseSchema}
            initial={editing.record}
            onSubmit={handleSave}
            onCancel={() => setEditing(null)}
            submitLabel={editing.isNew ? 'Add course' : 'Save changes'}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this course?"
        message={`"${deleting?.title}" will be removed from the website. To hide it temporarily instead, unpublish it.`}
        confirmLabel="Delete course"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          await run(deleteItem('courses', deleting.id), 'Course deleted');
          setDeleting(null);
        }}
      />
    </>
  );
}
