// Editor for a course's plans: name and base (USD) price from–to.
// Country prices (e.g. BDT for Bangladesh) are set in Admin → Pricing & currency.
function PlansEditor({ id, value, onChange }) {
  const rows = Array.isArray(value) ? value : [];
  const update = (i, key, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  const num = (v) => (v === '' ? '' : Number(v));
  const cols = 'sm:grid-cols-[1fr_6rem_6rem_2.25rem]';
  return (
    <div id={id} className="space-y-2">
      <div className={`hidden gap-2 px-1 text-[11px] text-ink/55 sm:grid ${cols}`}>
        <span>Plan</span>
        <span>USD from</span>
        <span>USD to</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className={`grid grid-cols-2 gap-2 ${cols}`}>
          <input
            className="input col-span-2 sm:col-span-1"
            aria-label={`Plan ${i + 1} name`}
            placeholder="e.g. 2–3 days a week"
            value={r.label ?? ''}
            onChange={(e) => update(i, 'label', e.target.value)}
          />
          <input className="input px-2.5" type="number" min="0" aria-label={`Plan ${i + 1} USD price from`} value={r.min ?? ''} onChange={(e) => update(i, 'min', num(e.target.value))} />
          <input
            className="input px-2.5"
            type="number"
            min="0"
            aria-label={`Plan ${i + 1} USD price to`}
            placeholder="–"
            value={r.max === r.min ? '' : r.max ?? ''}
            onChange={(e) => update(i, 'max', num(e.target.value))}
          />
          <button
            type="button"
            className="icon-btn col-span-2 justify-self-end hover:bg-red-50 hover:text-red-700 sm:col-span-1"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            aria-label={`Remove plan ${i + 1}`}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn-outline btn-sm" onClick={() => onChange([...rows, { label: '', min: '', max: '' }])}>
        + Add plan
      </button>
    </div>
  );
}

export function Field({ field, value, onChange, error }) {
  const id = `field-${field.name}`;
  const span = field.half ? '' : 'sm:col-span-2';

  if (field.type === 'checkbox') {
    return (
      <label htmlFor={id} className={`flex cursor-pointer items-start gap-3 rounded-xl border border-pine-900/10 px-4 py-3 ${span || 'sm:col-span-2'}`}>
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded accent-pine-700"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-ink">{field.label}</span>
          {field.help && <span className="mt-0.5 block text-xs text-ink/55">{field.help}</span>}
        </span>
      </label>
    );
  }

  const common = {
    id,
    className: 'input',
    dir: field.dir,
    lang: field.lang,
    placeholder: field.placeholder,
    'aria-invalid': Boolean(error) || undefined,
    'aria-describedby': field.help || error ? `${id}-hint` : undefined,
  };

  let control;
  switch (field.type) {
    case 'plans':
      control = <PlansEditor id={id} value={value} onChange={onChange} />;
      break;
    case 'cards':
      control = <CardsEditor id={id} value={value} onChange={onChange} icons={field.icons || []} />;
      break;
    case 'textarea':
      control = <textarea {...common} rows={field.rows ?? 4} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'list':
      control = (
        <textarea
          {...common}
          rows={field.rows ?? 4}
          value={Array.isArray(value) ? value.join('\n') : value ?? ''}
          onChange={(e) => onChange(e.target.value.split('\n'))}
        />
      );
      break;
    case 'select':
      control = (
        <select
          {...common}
          value={value ?? ''}
          onChange={(e) => {
            const opt = field.options.find((o) => String(typeof o === 'object' ? o.value : o) === e.target.value);
            onChange(typeof opt === 'object' ? opt.value : e.target.value);
          }}
        >
          {field.options.map((o) => {
            const v = typeof o === 'object' ? o.value : o;
            const l = typeof o === 'object' ? o.label : o;
            return (
              <option key={v} value={v}>
                {l}
              </option>
            );
          })}
        </select>
      );
      break;
    case 'number':
      control = (
        <input
          {...common}
          type="number"
          min={field.min}
          step={field.step}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      );
      break;
    default:
      control = <input {...common} type={field.type || 'text'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <div className={span}>
      <label htmlFor={id} className="label">
        {field.label}
        {field.required && <span className="text-red-700"> *</span>}
      </label>
      {control}
      {(error || field.help) && (
        <p id={`${id}-hint`} className={`mt-1.5 text-xs ${error ? 'text-red-700' : 'text-ink/55'}`} role={error ? 'alert' : undefined}>
          {error || field.help}
        </p>
      )}
    </div>
  );
}

// Editor for a list of cards: icon, title and text per card
function CardsEditor({ id, value, onChange, icons }) {
  const rows = Array.isArray(value) ? value : [];
  const update = (i, key, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  const move = (i, d) => {
    const n = [...rows];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    onChange(n);
  };
  return (
    <div id={id} className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.id || i} className="rounded-2xl border border-pine-900/15 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-pine-700">Card {i + 1}</span>
            <span className="flex gap-1">
              <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move card ${i + 1} up`}>↑</button>
              <button type="button" className="icon-btn" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Move card ${i + 1} down`}>↓</button>
              <button type="button" className="icon-btn hover:bg-red-50 hover:text-red-700" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove card ${i + 1}`}>×</button>
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
            <input className="input font-semibold" aria-label={`Card ${i + 1} title`} placeholder="Title" value={r.title ?? ''} onChange={(e) => update(i, 'title', e.target.value)} />
            <select className="input" aria-label={`Card ${i + 1} icon`} value={r.icon ?? ''} onChange={(e) => update(i, 'icon', e.target.value)}>
              {icons.map((n) => (
                <option key={n} value={n}>
                  Icon: {n}
                </option>
              ))}
            </select>
            <textarea className="input sm:col-span-2" rows={2} aria-label={`Card ${i + 1} text`} placeholder="Text" value={r.description ?? ''} onChange={(e) => update(i, 'description', e.target.value)} />
          </div>
        </div>
      ))}
      <button type="button" className="btn-outline btn-sm" onClick={() => onChange([...rows, { id: `f${Date.now()}`, icon: icons[0] || 'Star', title: '', description: '' }])}>
        + Add card
      </button>
    </div>
  );
}

export function cleanValues(schema, values) {
  const out = { ...values };
  for (const f of schema) {
    const v = out[f.name];
    if (f.type === 'plans')
      out[f.name] = (Array.isArray(v) ? v : [])
        .filter((p) => String(p.label ?? '').trim() || p.min !== '')
        .map((p) => {
          const min = Number(p.min);
          const max = p.max === '' || p.max == null ? min : Number(p.max);
          const hasBdt = p.bdtMin !== '' && p.bdtMin != null;
          const bdtMin = hasBdt ? Number(p.bdtMin) : '';
          const bdtMax = !hasBdt ? '' : p.bdtMax === '' || p.bdtMax == null ? bdtMin : Number(p.bdtMax);
          return {
            label: String(p.label ?? '').trim(),
            min,
            max: Math.max(min, max),
            bdtMin,
            bdtMax: hasBdt ? Math.max(bdtMin, bdtMax) : '',
          };
        });
    else if (f.type === 'cards')
      out[f.name] = (Array.isArray(v) ? v : [])
        .map((c, i) => ({ id: c.id || `f${i + 1}`, icon: c.icon || 'Star', title: String(c.title ?? '').trim(), description: String(c.description ?? '').trim() }))
        .filter((c) => c.title || c.description);
    else if (f.type === 'list') out[f.name] = (Array.isArray(v) ? v : String(v ?? '').split('\n')).map((s) => s.trim()).filter(Boolean);
    else if (typeof v === 'string' && f.type !== 'textarea') out[f.name] = v.trim();
    else if (typeof v === 'string') out[f.name] = v.replace(/\s+$/, '');
  }
  return out;
}

export function validate(schema, values) {
  const errors = {};
  for (const f of schema) {
    const v = values[f.name];
    const empty = v === '' || v == null || (Array.isArray(v) && !v.length);
    if (f.required && empty) errors[f.name] = `Enter a ${f.label.toLowerCase()}.`;
    else if (f.type === 'number' && !empty && (Number.isNaN(Number(v)) || (f.min != null && Number(v) < f.min)))
      errors[f.name] = `Enter a number of ${f.min} or more.`;
    else if (f.type === 'plans' && !empty && v.some((p) => !p.label || !Number.isFinite(p.min) || p.min < 0))
      errors[f.name] = 'Give every plan a name and a price of 0 or more.';
    else if (f.type === 'email' && !empty && !/^\S+@\S+\.\S+$/.test(v)) errors[f.name] = 'Enter a complete email address.';
    else if (f.type === 'url' && !empty && !/^https?:\/\/\S+$/.test(v)) errors[f.name] = 'Enter a full address starting with https://';
  }
  return errors;
}
