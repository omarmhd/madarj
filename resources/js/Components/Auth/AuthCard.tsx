import { PropsWithChildren } from 'react';

/**
 * The card every authentication screen sits in.
 *
 * ── Why a shared card ───────────────────────────────────────
 * There are six of these screens — sign in, register, forgot,
 * reset, confirm, verify. Breeze gave each one its own ad-hoc
 * markup, so they drifted: different spacing, different button
 * colour, different heading weight. A learner who resets a
 * password should not feel they left the product.
 *
 * One card, one heading rhythm, one button. Each screen supplies
 * only its own words and fields.
 */
export default function AuthCard({
  title,
  hint,
  children,
}: PropsWithChildren<{
  title: string;
  /** One line under the title: what this screen is for */
  hint?: string;
}>) {
  return (
    <div>
      <h2 className="folio-ink text-xl font-bold">{title}</h2>

      {hint && <p className="folio-soft mt-1 text-sm leading-relaxed">{hint}</p>}

      {children}
    </div>
  );
}

/**
 * The primary action.
 *
 * Full width, because on a phone a button that is not full width
 * is a button the thumb has to aim at.
 */
export function AuthButton({
  processing,
  children,
}: PropsWithChildren<{ processing?: boolean }>) {
  return (
    <button
      type="submit"
      disabled={processing}
      className="stamp w-full py-3 text-base font-semibold"
    >
      {children}
    </button>
  );
}

/**
 * A banner above the form.
 *
 * `tone` carries meaning, not decoration: a failed sign-in and a
 * sent reset link are different events and must not look alike.
 */
export function AuthNote({
  tone = 'info',
  children,
}: PropsWithChildren<{ tone?: 'info' | 'ok' | 'bad' }>) {
  const skin = {
    info: 'bg-slate-50 text-slate-700',
    ok: 'bg-emerald-50 text-emerald-800',
    bad: 'bg-rose-50 text-rose-800',
  }[tone];

  return (
    <p className={`mt-4 rounded-xl p-3 text-sm leading-relaxed ${skin}`}>{children}</p>
  );
}
