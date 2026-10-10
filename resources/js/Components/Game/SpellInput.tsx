import { forwardRef } from 'react';
import { hasArabic, type Mark } from '@/lib/spelling';
import { useT } from '@/lib/i18n';

/**
 * A text field for typing one English word or phrase.
 *
 * The attributes are the point. A phone keyboard autocorrects and
 * autocapitalises by default, so a learner typing `doter` gets
 * `doctor` without ever knowing it was wrong — the drill would test
 * the keyboard, not the learner. `lang="en"` also asks the phone for
 * its English layout where it can.
 */
interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  tone?: 'idle' | 'right' | 'close' | 'wrong';
  placeholder?: string;
}

const TONES = {
  idle: 'border-slate-300 focus:border-violet-500',
  right: 'border-emerald-500 bg-emerald-50 text-emerald-800',
  close: 'border-amber-400 bg-amber-50 text-amber-900',
  wrong: 'border-rose-400 bg-rose-50 text-rose-800',
};

const SpellInput = forwardRef<HTMLInputElement, Props>(function SpellInput(
  { value, onChange, onSubmit, disabled, tone = 'idle', placeholder },
  ref,
) {
  const tr = useT();

  return (
    <div>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          }
        }}
        disabled={disabled}
        dir="ltr"
        lang="en"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="done"
        placeholder={placeholder ?? 'type here…'}
        className={`w-full rounded-xl border-2 bg-white px-4 py-3 text-center text-xl font-semibold
                    outline-none transition placeholder:text-base placeholder:font-normal
                    placeholder:text-slate-300 disabled:opacity-80 ${TONES[tone]}`}
      />

      {hasArabic(value) && (
        <p className="mt-2 text-sm text-amber-700">
          {tr('لوحة المفاتيح بالعربية. غيّرها إلى الإنجليزية.')}
        </p>
      )}
    </div>
  );
});

export default SpellInput;

/**
 * The correct word, with the letters the attempt missed in colour.
 *
 * Showing the right word whole is not enough: the learner reads it,
 * agrees, and repeats the same slip next time. Colouring the two
 * letters that were wrong says where to look.
 */
export function SpellMarks({ marks, size = 'lg' }: { marks: Mark[]; size?: 'md' | 'lg' }) {
  return (
    <p
      dir="ltr"
      className={`font-bold ${size === 'lg' ? 'text-3xl' : 'text-xl'}`}
    >
      {marks.map((m, i) => (
        <span
          key={i}
          className={
            m.ok
              ? 'text-slate-800'
              : 'rounded bg-rose-100 px-0.5 text-rose-600 underline decoration-2 underline-offset-4'
          }
        >
          {m.ch}
        </span>
      ))}
    </p>
  );
}
