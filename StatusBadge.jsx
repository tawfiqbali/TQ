const STYLES = {
  new: 'bg-gold-100 text-gold-700',
  contacted: 'bg-sky-50 text-sky-800',
  enrolled: 'bg-pine-100 text-pine-800',
  closed: 'bg-ink/5 text-ink/60',
  trial: 'bg-pine-50 text-pine-800',
  contact: 'bg-ink/5 text-ink/70',
  published: 'bg-pine-100 text-pine-800',
  draft: 'bg-ink/5 text-ink/60',
};
const LABELS = { trial: 'Free trial', contact: 'Message', published: 'Published', draft: 'Draft' };

export default function StatusBadge({ status }) {
  const label = LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status] ?? STYLES.closed}`}>{label}</span>;
}
