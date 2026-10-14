import { useMemo, useState } from 'react';
import { Field, cleanValues, validate } from './Field';

/**
 * Generic schema-driven form.
 * - In a modal: pass onCancel.
 * - As an inline section editor: pass trackDirty; "Discard changes" resets.
 */
export default function RecordForm({ schema, initial, onSubmit, onCancel, submitLabel = 'Save', trackDirty = false }) {
  const [values, setValues] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(cleanValues(schema, values)) !== JSON.stringify(cleanValues(schema, baseline)),
    [schema, values, baseline],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleaned = cleanValues(schema, values);
    const errs = validate(schema, cleaned);
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await onSubmit(cleaned);
      if (trackDirty) {
        setValues(cleaned);
        setBaseline(cleaned);
      }
    } catch (err) {
      setFormError(err?.message || 'The change could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        {schema.map((f) => (
          <Field
            key={f.name}
            field={f}
            value={values[f.name]}
            error={errors[f.name]}
            onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
          />
        ))}
      </div>

      {formError && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {formError}
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center justify-end gap-3">
        {trackDirty && dirty && <span className="mr-auto text-sm text-gold-700">You have unsaved changes</span>}
        {onCancel ? (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        ) : (
          trackDirty && (
            <button
              type="button"
              className="btn-ghost"
              disabled={!dirty}
              onClick={() => {
                setValues(baseline);
                setErrors({});
              }}
            >
              Discard changes
            </button>
          )
        )}
        <button type="submit" className="btn-primary" disabled={saving || (trackDirty && !dirty)}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
