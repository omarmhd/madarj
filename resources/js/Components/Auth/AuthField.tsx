import { ReactNode } from 'react';

/**
 * One labelled field on an authentication screen.
 *
 * ── The direction rule this exists to enforce ───────────────
 * The page reads right-to-left, but a credential does not. An
 * email typed into an RTL field renders its dots and its `@` in
 * the wrong places and the learner cannot proofread what they
 * typed — so every field here is `dir="ltr"` by default, and a
 * screen that needs otherwise says so.
 *
 * Passing the field through one component also means the focus
 * ring, the error colour and the label weight are decided once.
 */
export default function AuthField({
  id,
  label,
  type = 'text',
  value,
  error,
  onChange,
  autoComplete,
  placeholder,
  dir = 'ltr',
  autoFocus = false,
  readOnly = false,
  aside,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
  /** `rtl` only for fields that hold Arabic — a name, for instance */
  dir?: 'ltr' | 'rtl';
  autoFocus?: boolean;
  readOnly?: boolean;
  /** A link that belongs beside the label, such as "forgot it?" */
  aside?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="folio-soft block text-sm font-medium">
          {label}
        </label>
        {aside}
      </div>

      <input
        id={id}
        name={id}
        type={type}
        dir={dir}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        readOnly={readOnly}
        required
        onChange={(e) => onChange(e.target.value)}
        className={`folio-input mt-1 w-full text-base
                    ${readOnly ? 'opacity-60' : ''}
                    ${error ? 'is-error' : ''}`}
      />

      {error && <p className="mt-1.5 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
