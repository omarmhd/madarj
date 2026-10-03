import { Mic } from 'lucide-react';
import VoicePicker from '@/Components/VoicePicker';
import type { VoicePref } from '@/hooks/useSpeech';
import { useT } from '@/lib/i18n';

/**
 * Who reads, and how fast.
 *
 * ── Why this is one component and not three copies ──────────
 * The speed buttons were written inline on the week page and again on
 * the day page, with their own copy of the speeds. When the stories
 * page arrived it had neither — and nobody noticed, because nothing
 * fails when a control is simply absent. The third screen forgot
 * because the first two had never agreed to remember.
 *
 * ── The speeds are the book's, not round numbers ────────────
 * 0.8 for a first listen and 1.0 for the last is the rule in "Getting
 * the Sound"; 0.6 exists for the sounds a learner cannot hear yet.
 *
 * ── When the voice is not ours to change ────────────────────
 * A story with a recorded narration has one narrator, and generating
 * a second set of files for the other voice would double the library
 * for a choice nobody asked for. So on those screens the voice
 * buttons are told to stand down and say why — a control that
 * silently does nothing teaches the learner to distrust the others.
 *
 * ── Speed is local, voice is saved ──────────────────────────
 * Speed is nudged for one hard passage and nudged back, so keeping it
 * would open every page at the setting of a passing moment. Voice is
 * a standing taste, so `VoicePicker` writes it.
 */

export const SPEEDS: { value: number; label_ar: string }[] = [
  { value: 0.6, label_ar: 'بطيء جداً' },
  { value: 0.8, label_ar: 'أول استماع' },
  { value: 1, label_ar: 'طبيعي' },
];

export default function SpeechControls({
  voice,
  onVoice,
  rate,
  onRate,
  size = 'sm',
  label,
  voiceLocked,
}: {
  voice: VoicePref;
  onVoice: (voice: VoicePref) => void;
  rate: number;
  onRate: (rate: number) => void;
  /** سببُ تعذّر تغيير الصوت — يحلّ محلّ الأزرار حين يُمرَّر */
  voiceLocked?: string;
  /** `sm` for a tight bar, `md` where there is room */
  size?: 'sm' | 'md';
  /** نصّ يسبق الأزرار — يُترك حيث المكان ضيّق */
  label?: string;
}) {
  const tr = useT();
  const small = size === 'sm';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {voiceLocked ? (
        <span
          className={`flex items-center gap-1.5 rounded-lg bg-stone-100 px-2.5 py-1
                      text-stone-600 ${small ? 'min-h-7 text-xs' : 'min-h-8 text-sm'}`}
        >
          <Mic aria-hidden size={15} />
          {voiceLocked}
        </span>
      ) : (
        <VoicePicker voice={voice} onChange={onVoice} size={size} />
      )}

      {label && (
        <span className={`text-slate-500 ${small ? 'text-xs' : 'text-sm'}`}>{label}</span>
      )}

      <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5" role="group"
           aria-label={tr('سرعة النطق')}>
        {SPEEDS.map((s) => (
          <button
            key={s.value}
            onClick={() => onRate(s.value)}
            aria-pressed={rate === s.value}
            title={`${tr('سرعة النطق')} — ${tr(s.label_ar)}`}
            className={`rounded-md font-medium transition ${
              small ? 'min-h-7 px-2 text-xs' : 'min-h-8 px-3 text-sm'
            } ${
              rate === s.value
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {s.value}×
          </button>
        ))}
      </div>
    </div>
  );
}
