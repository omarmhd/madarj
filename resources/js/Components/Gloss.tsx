import { useState } from 'react';
import { usePage } from '@inertiajs/react';
import { useT } from '@/lib/i18n';

/**
 * The Arabic translation of a line of content — shown, or one tap away.
 *
 * A setting of its own ("content translation"), apart from the interface
 * language: a beginner may want Arabic buttons and still hide the
 * dialogue's translation to listen harder. Hidden, it is not removed:
 * a stuck learner taps and sees it, for that line only.
 */
export default function Gloss({ ar, className = '' }: { ar: string | null | undefined; className?: string }) {
  const tr = useT();
  const show = ((usePage().props as any).prefs?.showTranslation ?? true) as boolean;
  const [open, setOpen] = useState(false);

  if (!ar) return null;
  if (show || open) return <p className={className}>{ar}</p>;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="mt-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-slate-200 transition hover:text-slate-600"
    >
      {tr('عرض الترجمة')}
    </button>
  );
}
