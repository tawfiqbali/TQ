import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

/**
 * Searchable dropdown used everywhere in the Management Portal instead of
 * <select>. Type to filter, Backspace to edit the search, ↑/↓ to move,
 * Enter to pick, Esc to close.
 *
 *   <Combobox value={id} onChange={setId} options={[{ value, label, group? }]} />
 *
 * `options` may also be plain strings. `variant`: 'field' (form inputs) or
 * 'pill' (the small period pickers). The list opens in a layer on top of the
 * page, so tables and pop-ups never cut it off.
 */
const norm = (o) => (typeof o === 'object' && o !== null ? { value: o.value, label: String(o.label ?? o.value), group: o.group } : { value: o, label: String(o) });
const fold = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

export default function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  variant = 'field',
  className = '',
  'aria-label': ariaLabel,
  id,
  emptyText = 'No matches',
}) {
  const list = useMemo(() => options.map(norm), [options]);
  const selected = list.find((o) => String(o.value) === String(value ?? ''));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState(false); // false = show the selected label
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const autoId = useId();
  const listId = `${id || autoId}-list`;

  const filtered = useMemo(() => {
    if (!typing || !query.trim()) return list;
    const q = fold(query.trim());
    return list.filter((o) => fold(o.label).includes(q) || fold(o.group || '').includes(q));
  }, [list, query, typing]);

  // Place the floating list under (or above) the input
  const place = () => {
    const r = inputRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < 240 && r.top > below;
    setRect({ left: r.left, width: Math.max(r.width, 200), top: up ? undefined : r.bottom + 4, bottom: up ? window.innerHeight - r.top + 4 : undefined, maxHeight: Math.min(300, (up ? r.top : below) - 12) });
  };
  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    const onMove = () => place();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open]);

  // Keep the highlighted option in view
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    const i = list.findIndex((o) => String(o.value) === String(value ?? ''));
    setActive(Math.max(0, i));
  };
  const close = () => {
    setOpen(false);
    setTyping(false);
    setQuery('');
  };
  const pick = (o) => {
    if (o) onChange?.(o.value);
    close(); // no match: keep the previous choice
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) return openList();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      if (open) {
        e.preventDefault();
        pick(filtered[active]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.stopPropagation(); // don't close the surrounding pop-up
        close();
      }
    } else if (e.key === 'Tab') {
      close();
    }
  };

  const shown = typing ? query : selected?.label ?? '';
  let lastGroup = null;

  return (
    <div className={`qcb qcb-${variant} ${disabled ? 'is-disabled' : ''} ${className}`}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={selected ? selected.label : placeholder}
        value={shown}
        onFocus={(e) => {
          openList();
          e.target.select();
        }}
        onClick={(e) => {
          if (open) return;
          openList();
          e.target.select(); // typing replaces the current choice
        }}
        onChange={(e) => {
          setTyping(true);
          setQuery(e.target.value);
          setActive(0);
          if (!open) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(close, 120)}
      />
      <ChevronDown className="qcb-chevron" aria-hidden="true" />
      {open &&
        rect &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="qcb-list"
            style={{ left: rect.left, width: rect.width, top: rect.top, bottom: rect.bottom, maxHeight: rect.maxHeight }}
            onMouseDown={(e) => e.preventDefault()} // keep focus in the input
          >
            {filtered.length === 0 && <li className="qcb-empty">{emptyText}</li>}
            {filtered.map((o, i) => {
              const header = o.group && o.group !== lastGroup ? o.group : null;
              lastGroup = o.group;
              return [
                header && (
                  <li key={`g-${header}`} className="qcb-group" role="presentation">
                    {header}
                  </li>
                ),
                <li
                  key={`${o.value}-${i}`}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={String(o.value) === String(value ?? '')}
                  className={`qcb-option ${i === active ? 'is-active' : ''} ${String(o.value) === String(value ?? '') ? 'is-selected' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                >
                  {o.label}
                </li>,
              ];
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}
