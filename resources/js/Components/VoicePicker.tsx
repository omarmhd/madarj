import type { ReactNode } from 'react';
import { Mars, Venus } from 'lucide-react';
import axios from 'axios';
import type { VoicePref } from '@/hooks/useSpeech';
import { useT } from '@/lib/i18n';

/**
 * Which voice reads the English aloud.
 *
 * ── Why it belongs beside the speed, not in settings ────────
 * The voice was chosen once during setup and could not be changed
 * afterwards — setup locks itself when it is done. But it is a
 * preference discovered *while listening*, not before: ten minutes of
 * one voice is what makes somebody want the other. So it sits where
 * the listening happens, next to the speed control.
 *
 * ── And why this one saves while the speed does not ─────────
 * Speed is nudged for a hard passage and nudged back, so persisting
 * it would open every page at the setting of one passing moment. The
 * voice is a standing taste: picked once, expected to hold.
 *
 * ── Why it does not navigate ───────────────────────────────
 * It used to save with `router.patch`, which is an Inertia visit: the
 * server redirected back, the page was re-rendered, and the story the
 * learner had open closed itself and dropped them on the shelf.
 * Choosing a voice is not navigation and should not look like it.
 *
 * So the value is owned by the page, exactly as the speed already is,
 * and the write goes out on its own. The screen answers on the click
 * and the preference outlives the session — with nothing in between.
 */

const VOICES: { value: VoicePref; label_ar: string; icon: ReactNode }[] = [
  { value: 'f', label_ar: 'أنثى', icon: <Venus size={14} /> },
  { value: 'm', label_ar: 'ذكر', icon: <Mars size={14} /> },
];

export default function VoicePicker({
  voice,
  onChange,
  size = 'sm',
}: {
  voice: VoicePref;
  onChange: (voice: VoicePref) => void;
  /** `sm` for the day page's tight bar, `md` for the week page */
  size?: 'sm' | 'md';
}) {
  const tr = useT();

  const choose = (next: VoicePref) => {
    if (next === voice) return;

    onChange(next);

    // A failed write loses a preference, not work — and an error
    // message about a voice button would cost more than it saves
    void axios.patch('/profile/voice', { voice: next }).catch(() => {});
  };

  const small = size === 'sm';

  return (
    <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5" role="group"
         aria-label={tr('صوت النطق')}>
      {VOICES.map((v) => (
        <button
          key={v.value}
          onClick={() => choose(v.value)}
          aria-pressed={voice === v.value}
          title={`${tr('صوت النطق')} — ${tr(v.label_ar)}`}
          className={`rounded-md font-medium transition ${
            small ? 'min-h-7 px-2 text-xs' : 'min-h-8 px-3 text-sm'
          } ${
            voice === v.value
              ? 'bg-white text-violet-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span aria-hidden className="me-1 inline-flex align-[-2px]">{v.icon}</span>
          {tr(v.label_ar)}
        </button>
      ))}
    </div>
  );
}
