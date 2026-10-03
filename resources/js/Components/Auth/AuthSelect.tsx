/**
 * A labelled dropdown on an authentication screen.
 *
 * ── Why options arrive from the server ──────────────────────
 * The country list, the levels, the goals — each one is also a
 * validation rule. Restating them in TypeScript means two lists
 * that drift, and the drift shows up as a rejected form the user
 * cannot fix. So the server sends both the labels and the values,
 * and this only renders them.
 *
 * ── Why no empty first option ───────────────────────────────
 * A select that starts blank is a required field disguised as an
 * optional one. Every one of these starts on a real answer, and
 * the label says so.
 */
export default function AuthSelect({
  id,
  label,
  value,
  options,
  error,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  error?: string;
  onChange: (v: string) => void;
  /** One line under the field, for when the label cannot say enough */
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>

      <select
        id={id}
        name={id}
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 w-full rounded-xl border-slate-200 text-sm shadow-sm
                    focus:border-violet-400 focus:ring-violet-400
                    ${error ? 'border-rose-300' : ''}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
