import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Pencil, RotateCcw, Save, Search } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';
import { useToast } from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import AdminPageHeader from './components/AdminPageHeader';
import usePageTitle from '../hooks/usePageTitle';
import { COURSE_THEMES } from '../components/shared/CourseCard';
import { builtInBangladeshRule, countryName, countryOptions, currencyForCountry, formatPriceRange, loadRates, roundNicely } from '../lib/currency';

/**
 * Pricing & currency
 * - Every country gets automatic prices: the USD base price converted to its
 *   currency at today's rate (rounded). The currency follows the country.
 * - Bangladesh has built-in fixed BDT prices.
 * - Pick any country to see its automatic prices and type a custom price for
 *   any plan. Saving stores those custom prices for that country only; empty
 *   boxes stay automatic. "Reset" removes the custom prices again.
 */
const clone = (v) => JSON.parse(JSON.stringify(v));
const num = (v) => (v === '' || v == null ? '' : Number(v));
const CodeBadge = ({ code }) => (
  <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md bg-pine-900 px-1.5 text-[11px] font-bold tracking-wider text-white">{code}</span>
);

// Custom-price slots for every plan of every course
function slotsFor(rule, courses) {
  const prices = {};
  courses.forEach((c) => {
    const own = rule?.prices?.[c.id] || [];
    prices[c.id] = (c.plans || []).map((_, i) => ({ min: own[i]?.min ?? '', max: own[i]?.max ?? '' }));
  });
  return prices;
}
const countCustom = (rule) => Object.values(rule?.prices || {}).flat().filter((p) => p && p.min !== '' && p.min != null).length;

export default function PricingManager() {
  usePageTitle('Pricing & currency');
  const { content, updateSite } = useSiteData();
  const toast = useToast();
  const courses = content.courses;
  const baseCurrency = content.site.settings?.baseCurrency || 'USD';
  const pricing = content.site.pricing || { rules: [] };
  const rules = pricing.rules || [];
  const options = useMemo(() => countryOptions(), []);

  const [rates, setRates] = useState(null);
  const [country, setCountry] = useState('BD');
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyCustom, setOnlyCustom] = useState(false);
  const editorRef = useRef(null);

  // Open a country in the editor (from the list) and bring the editor into view
  const openCountry = (code) => {
    setCountry(code);
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  useEffect(() => {
    loadRates(baseCurrency).then(setRates);
  }, [baseCurrency]);

  const currency = currencyForCountry(country, baseCurrency);
  const savedRule = rules.find((r) => r.country === country) || null;
  const isBD = country === 'BD';
  // Bangladesh's "automatic" price is its built-in BDT price
  const builtIn = useMemo(() => (isBD ? builtInBangladeshRule(courses) : null), [isBD, courses]);
  const rate = currency === baseCurrency ? 1 : rates?.[currency];

  const savedSlots = useMemo(() => slotsFor(savedRule, courses), [savedRule, courses]);

  // The price visitors get when no custom price is set
  const automatic = (c, p, i) => {
    if (builtIn) {
      const b = builtIn.prices[c.id]?.[i];
      if (b && b.min !== '') return { min: b.min, max: b.max, text: formatPriceRange(b.min, b.max, 'BDT') };
    }
    if (!rate) return { min: '', max: '', text: `${formatPriceRange(p.min, p.max, baseCurrency)} (no rate)` };
    const conv = (v) => (v === '' || v == null ? '' : roundNicely(Number(v) * rate));
    const min = conv(p.min);
    const max = conv(p.max ?? p.min);
    return { min, max, text: formatPriceRange(min, max, currency) };
  };

  // What the boxes start with: the custom price if there is one, otherwise
  // the automatic price, so every country can be edited straight away.
  const auto = (c, p, i) => automatic(c, p, i);
  const baseline = useMemo(() => {
    const d = {};
    courses.forEach((c) => {
      d[c.id] = (c.plans || []).map((p, i) => {
        const own = savedSlots[c.id]?.[i];
        if (own && own.min !== '') return { min: own.min, max: own.max === '' ? own.min : own.max };
        const a = auto(c, p, i);
        return { min: a.min, max: a.max === '' ? a.min : a.max };
      });
    });
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSlots, courses, rate, isBD, currency]);
  useEffect(() => {
    setDraft(baseline);
  }, [baseline]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  const persist = async (nextRules, message) => {
    setBusy(true);
    try {
      await updateSite('pricing', { ...pricing, rules: nextRules });
      toast(message);
    } catch (err) {
      toast(`Could not save: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    // Prices left at their automatic value stay automatic (they keep following
    // the exchange rate); changed prices are stored as this country's custom prices.
    const toStore = {};
    courses.forEach((c) => {
      toStore[c.id] = (c.plans || []).map((p, i) => {
        const v = draft[c.id]?.[i] || { min: '', max: '' };
        const a = auto(c, p, i);
        const aMax = a.max === '' ? a.min : a.max;
        const vMax = v.max === '' ? v.min : v.max;
        const wasCustom = savedSlots[c.id]?.[i]?.min !== '';
        if (v.min === '' || (!isBD && !wasCustom && v.min === a.min && vMax === aMax)) return { min: '', max: '' };
        return { min: v.min, max: vMax === v.min ? '' : vMax };
      });
    });
    const all = Object.values(toStore).flat();
    if (all.some((p) => (p.min !== '' && (!Number.isFinite(p.min) || p.min < 0)) || (p.max !== '' && p.min !== '' && p.max < p.min)))
      return toast('Use numbers of 0 or more, and "To" must not be below "From".', 'error');
    const hasAny = all.some((p) => p.min !== '');
    const others = rules.filter((r) => r.country !== country);
    if (!hasAny && !isBD) return persist(others, `${countryName(country)} uses automatic prices`);
    const rule = { id: country, country, currency, prices: toStore };
    await persist([...others, rule], `${countryName(country)} prices saved`);
  };

  const reset = async () => {
    setConfirmReset(false);
    const others = rules.filter((r) => r.country !== country);
    if (isBD) await persist([...others, builtInBangladeshRule(courses)], 'Bangladesh reset to the built-in BDT prices');
    else await persist(others, `${countryName(country)} reset to automatic prices`);
  };

  const setSlot = (courseId, i, key, value) =>
    setDraft((d) => {
      const n = clone(d);
      n[courseId][i][key] = num(value);
      return n;
    });

  const input = 'input px-2.5 py-2 text-right tabular-nums placeholder:italic placeholder:text-ink/30';

  return (
    <div>
      <AdminPageHeader
        title="Pricing & currency"
        description="Every country gets automatic prices converted from USD in its own currency. Choose a country to set custom prices for it. Bangladesh has fixed BDT prices."
      />

      {/* Country picker */}
      <section className="panel mb-6 grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <label className="label" htmlFor="pricing-country">
            Country
          </label>
          <select id="pricing-country" className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
            {options.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name} · {o.currency}
                {rules.some((r) => r.country === o.code) ? '  ★ custom' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-pine-50 px-4 py-2.5 text-sm">
          <span className="text-ink/60">Currency</span>
          <span className="font-bold text-pine-950">{currency}</span>
          <span className="text-xs text-ink/50">(automatic)</span>
          {rate && currency !== baseCurrency && !isBD && <span className="text-xs text-ink/50">· 1 {baseCurrency} = {rate.toFixed(2)}</span>}
        </div>
      </section>

      {/* Price editor for the chosen country */}
      <section ref={editorRef} className="panel scroll-mt-6 p-5">
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <CodeBadge code={country} />
          <h2 className="text-xl">
            <span className="text-ink/55">Editing</span> {countryName(country)}
          </h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${savedRule ? 'bg-gold-100 text-gold-700' : 'bg-pine-50 text-pine-800'}`}>
            {isBD ? 'Fixed BDT prices' : savedRule ? `${countCustom(savedRule)} custom price(s)` : 'Automatic prices'}
          </span>
        </div>
        <p className="mb-4 text-sm text-ink/60">
          The boxes show the prices {countryName(country)} visitors see now. Change any of them to set your own {currency} price, then click{' '}
          <strong>Save prices</strong>. Prices you don't change stay {isBD ? 'at the built-in BDT price' : 'automatic'}.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] overflow-hidden rounded-xl text-sm">
            <thead>
              <tr className="border-b border-pine-900/10 text-left text-xs uppercase tracking-wider text-ink/55">
                <th className="py-2 pr-3 font-medium">Course · plan</th>
                <th className="py-2 pr-3 font-medium">Base ({baseCurrency})</th>
                <th className="py-2 pr-3 font-medium">{isBD ? 'Built-in' : 'Automatic'}</th>
                <th className="w-32 py-2 pr-3 font-medium">Price from</th>
                <th className="w-32 py-2 pr-3 font-medium">Price to</th>
                <th className="py-2 font-medium">Visitors see</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c, ci) => {
                // Each course is its own block: a bold header row, then its plans,
                // with alternating background per course
                const zebra = ci % 2 ? 'bg-[#f6f9f7]' : 'bg-white';
                const stripe = { boxShadow: `inset 4px 0 0 rgb(${COURSE_THEMES[ci % COURSE_THEMES.length].accent})` };
                return [
                  <tr key={`${c.id}-head`} className={`${zebra} border-t-2 border-pine-900/10`} style={stripe}>
                    <td colSpan={6} className="px-4 pb-1 pt-3">
                      <span className="text-[15px] font-bold text-pine-950">{c.title}</span>
                      {c.classLength && <span className="ml-2 rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-medium text-gold-700">{c.classLength}</span>}
                    </td>
                  </tr>,
                  ...(c.plans || []).map((p, i) => {
                    const a = automatic(c, p, i);
                    const slot = draft[c.id]?.[i] || { min: '', max: '' };
                    const aMax = a.max === '' ? a.min : a.max;
                    const sMax = slot.max === '' ? slot.min : slot.max;
                    // Bangladesh: only prices that differ from the built-in BDT price count as custom
                    const custom = slot.min !== '' && (slot.min !== a.min || sMax !== aMax || (!isBD && savedSlots[c.id]?.[i]?.min !== ''));
                    const box = `${input} w-full ${custom ? 'price-box is-custom' : 'price-box'}`;
                    return (
                      <tr key={`${c.id}-${i}`} className={zebra} style={stripe}>
                        <td className="py-2 pl-7 pr-3 text-ink/70">{p.label}</td>
                        <td className="py-2 pr-3">
                          <span className="rounded-md bg-ink/5 px-2 py-1 text-xs text-ink/55">{formatPriceRange(p.min, p.max, baseCurrency)}</span>
                        </td>
                        <td className="py-2 pr-3 text-ink/60">{a.text}</td>
                        <td className="py-2 pr-3">
                          <input type="number" min="0" className={box} placeholder={String(a.min ?? '')} aria-label={`${c.title} ${p.label} price from`} value={slot.min} onChange={(e) => setSlot(c.id, i, 'min', e.target.value)} />
                        </td>
                        <td className="py-2 pr-3">
                          <input type="number" min="0" className={box} placeholder={String(a.max ?? '')} aria-label={`${c.title} ${p.label} price to`} value={slot.max} onChange={(e) => setSlot(c.id, i, 'max', e.target.value)} />
                        </td>
                        <td className={`py-2 pr-3 ${custom ? 'font-semibold text-gold-700' : 'text-ink/60'}`}>
                          {slot.min === '' ? a.text : custom ? `${formatPriceRange(slot.min, slot.max, currency)} ★` : a.text}
                        </td>
                      </tr>
                    );
                  }),
                ];
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn-ghost" onClick={() => setConfirmReset(true)} disabled={busy || (!savedRule && !isBD)}>
            <RotateCcw className="h-4 w-4" /> {isBD ? 'Reset to built-in BDT prices' : 'Reset to automatic'}
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn-outline" disabled={!dirty || busy} onClick={() => setDraft(baseline)}>
              Discard changes
            </button>
            <button type="button" className="btn-primary" disabled={!dirty || busy} onClick={save}>
              <Save className="h-4 w-4" /> {busy ? 'Saving…' : 'Save prices'}
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink/55">
          ★ = custom price. Clear a box to go back to the {isBD ? 'built-in BDT' : 'automatic'} price. Base USD prices are edited in Courses.
        </p>
      </section>

      {/* Pricing list: every country, automatic or custom, each with Edit */}
      <section className="panel mt-6 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg">
            <Globe2 className="h-5 w-5 text-pine-700" /> Pricing list · all countries ({options.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
              <input className="input w-56 py-2 pl-9" placeholder="Search country or currency" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search countries" />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input type="checkbox" checked={onlyCustom} onChange={(e) => setOnlyCustom(e.target.checked)} /> Custom only ({rules.length})
            </label>
          </div>
        </div>
        <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-pine-900/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#f4f8f6] text-left text-xs uppercase tracking-wider text-ink/55">
              <tr>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Currency</th>
                <th className="px-3 py-2 font-medium">Prices</th>
                <th className="px-3 py-2 font-medium">Example ({courses[0]?.title || 'first course'})</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {options
                .filter((o) => {
                  const q = query.trim().toLowerCase();
                  const custom = rules.some((r) => r.country === o.code);
                  return (!onlyCustom || custom) && (!q || o.name.toLowerCase().includes(q) || o.code.toLowerCase() === q || o.currency.toLowerCase().includes(q));
                })
                .map((o) => {
                  const r = rules.find((x) => x.country === o.code);
                  const c0 = courses[0];
                  const p0 = c0?.plans?.[0];
                  const own = r?.prices?.[c0?.id]?.[0];
                  const oRate = o.currency === baseCurrency ? 1 : rates?.[o.currency];
                  const conv = (v) => (v === '' || v == null ? '' : roundNicely(Number(v) * oRate));
                  const example = !p0
                    ? '—'
                    : own && own.min !== ''
                      ? formatPriceRange(own.min, own.max, o.currency)
                      : o.code === 'BD'
                        ? formatPriceRange(builtInBangladeshRule(courses).prices[c0.id]?.[0]?.min, builtInBangladeshRule(courses).prices[c0.id]?.[0]?.max, 'BDT')
                        : oRate
                          ? formatPriceRange(conv(p0.min), conv(p0.max ?? p0.min), o.currency)
                          : formatPriceRange(p0.min, p0.max, baseCurrency);
                  const status = o.code === 'BD' ? 'Fixed BDT' : r ? `Custom (${countCustom(r)})` : 'Automatic';
                  return (
                    <tr key={o.code} className={`border-t border-pine-900/5 ${o.code === country ? 'bg-pine-50' : ''}`}>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2.5">
                          <CodeBadge code={o.code} />
                          <span className="font-medium text-pine-950">{o.name}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-ink/70">{o.currency}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r || o.code === 'BD' ? 'bg-gold-100 text-gold-700' : 'bg-pine-50 text-pine-800'}`}>{status}</span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-ink/75">{example}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" className="btn-outline btn-sm" onClick={() => openCountry(o.code)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={confirmReset}
        title={isBD ? 'Reset Bangladesh prices?' : `Reset ${countryName(country)} to automatic prices?`}
        message={isBD ? 'The custom BDT prices are replaced with the built-in BDT prices.' : 'Its custom prices are removed. Visitors there see prices converted from USD.'}
        confirmLabel="Reset"
        onConfirm={reset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
