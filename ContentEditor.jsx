import { useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';
import { useToast } from '../components/ui/Toast';
import AdminPageHeader from './components/AdminPageHeader';
import RecordForm from './components/RecordForm';
import { siteSections } from './schemas';

export default function ContentEditor() {
  const { content, updateSite } = useSiteData();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const active = siteSections.find((s) => s.key === params.get('tab')) ?? siteSections[0];

  return (
    <>
      <AdminPageHeader
        title="Site content"
        description="Edit the words on your website without touching code."
        actions={
          <a href="/" target="_blank" rel="noreferrer" className="btn-outline">
            <ExternalLink className="h-4 w-4" /> View website
          </a>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="Content sections" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {siteSections.map((s) => (
            <button
              key={s.key}
              onClick={() => setParams({ tab: s.key }, { replace: true })}
              aria-current={active.key === s.key ? 'page' : undefined}
              className={`shrink-0 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                active.key === s.key ? 'bg-pine-900 text-white' : 'text-ink/70 hover:bg-pine-50 hover:text-pine-900'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <section className="panel p-6 sm:p-8">
          <h2 className="text-xl">{active.label}</h2>
          <p className="mb-6 mt-1 text-sm text-ink/60">{active.description}</p>
          <RecordForm
            key={active.key}
            schema={active.schema}
            initial={content.site[active.key]}
            trackDirty
            submitLabel="Save changes"
            onSubmit={(values) => {
              // Applied instantly; the save finishes in the background
              const label = active.label;
              updateSite(active.key, { ...content.site[active.key], ...values })
                .then(() => toast(`${label} saved`))
                .catch((err) => toast(`Could not save: ${err.message}`, 'error'));
            }}
          />
        </section>
      </div>
    </>
  );
}
