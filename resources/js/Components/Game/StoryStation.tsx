import { useState } from 'react';
import axios from 'axios';
import { Check, Lightbulb } from 'lucide-react';
import StoryReader from '@/Components/Game/StoryReader';
import type { StoryData } from '@/Pages/Stories';
import type { VoicePref } from '@/hooks/useSpeech';
import { useT } from '@/lib/i18n';

/**
 * قصة اليوم — a story from the library, read inside the day.
 *
 * Days 3 and 6 read a story in place of the episode: reading and
 * watching take turns, and the day does not grow. Two things prove it
 * was read, and both are checked by the server: the moral, chosen from
 * three (the answer only after two tries, as everywhere in the book),
 * and one English sentence from the story — a line that caught the eye
 * is a line the learner went back to.
 */

export interface StoryStationData {
  day: number;
  story: StoryData;
  /** Three morals, one of them this story's — which one is never sent */
  morals: string[];
}

interface Props {
  weekNumber: number;
  data: StoryStationData;
  rate: number;
  voice: VoicePref;
  /** Everything saved for this week, by day — the save sends all of it back */
  saved: Record<string, string> | null;
  onSaved?: (sentence: string) => void;
}

export default function StoryStation({ weekNumber, data, rate, voice, saved, onSaved }: Props) {
  const tr = useT();
  const key = `day${data.day}`;

  const savedMoral = saved?.[`${key}_moral`] ?? '';
  const [chosen, setChosen] = useState<string | null>(null);
  const [right, setRight] = useState<string | null>(savedMoral || null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [text, setText] = useState(saved?.[key] ?? '');
  const [savedText, setSavedText] = useState(saved?.[key] ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const check = async (moral: string) => {
    if (right || checking || wrong.includes(moral)) return;
    setChosen(moral);
    setChecking(true);
    try {
      const { data: res } = await axios.post('/stories/check', {
        slug: data.story.slug, moral, attempt: wrong.length + 1,
      });
      if (res.correct) setRight(moral);
      else {
        setWrong((w) => [...w, moral]);
        if (res.answer) { setRevealed(res.answer); setRight(res.answer); }
      }
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  };

  const ready = !!right && /[A-Za-z]{2,}/.test(text);

  const save = async () => {
    if (!right) return;
    setSaving(true);
    setError(false);
    try {
      await axios.post(`/week/${weekNumber}/notes`, {
        kind: 'story',
        answers: { ...(saved ?? {}), [key]: text.trim(), [`${key}_moral`]: right },
      });
      setSavedText(text.trim());
      onSaved?.(text.trim());
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <StoryReader story={data.story} rate={rate} voice={voice} isRead={!!savedMoral} onFinish={() => {}} hideMoral />

      {/* The moral: the question the story answers */}
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
        <p className="flex items-center gap-2 font-semibold text-slate-900">
          <Lightbulb aria-hidden size={17} className="text-amber-500" /> {tr('ما عبرة القصة؟')}
        </p>
        <div className="mt-3 space-y-2">
          {data.morals.map((m) => {
            const isRight = right === m;
            const isWrong = wrong.includes(m);
            return (
              <button
                key={m}
                onClick={() => check(m)}
                disabled={!!right || isWrong || checking}
                className={`flex w-full items-start gap-2 rounded-xl px-4 py-3 text-start text-base leading-relaxed ring-1 transition ${
                  isRight
                    ? 'bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400'
                    : isWrong
                      ? 'bg-rose-50 text-rose-800 opacity-70 ring-rose-200'
                      : 'bg-white text-slate-800 ring-slate-200 hover:ring-violet-300'
                } ${checking && chosen === m ? 'animate-pulse' : ''}`}
              >
                {isRight && <Check aria-hidden size={18} className="mt-1 shrink-0 text-emerald-600" />}
                <span>{m}</span>
              </button>
            );
          })}
        </div>
        {wrong.length === 1 && !right && (
          <p className="mt-2 text-sm text-amber-800">{tr('ليست هذه. فكّر في نهاية القصة، وحاول مرة أخرى.')}</p>
        )}
        {revealed && (
          <p className="mt-2 text-sm text-slate-600">{tr('هذه هي العبرة. اقرأ نهاية القصة مرة أخرى وأنت تعرفها.')}</p>
        )}
      </div>

      {/* One sentence from the story, in English */}
      {right && (
        <div className="leaf-in rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
          <p className="font-semibold text-slate-900">{tr('جملة أعجبتك')}</p>
          <p className="mt-1 text-sm text-slate-600">{tr('انسخ من القصة جملة إنجليزية واحدة أعجبتك، أو اكتبها من ذاكرتك.')}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            dir="ltr"
            spellCheck={false}
            autoCorrect="off"
            className="ruled mt-3 w-full resize-y text-base"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{tr('القصة شرط لإنهاء اليوم.')}</p>
            {text.trim() !== savedText.trim() || right !== savedMoral ? (
              <button
                onClick={save}
                disabled={saving || !ready}
                className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {saving ? tr('يحفظ…') : tr('احفظ')}
              </button>
            ) : savedText ? (
              <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                <Check aria-hidden size={15} /> {tr('محفوظ')}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-700">{tr('لم يُحفظ. تحقّق من الاتصال وحاول مرة أخرى.')}</p>}
    </div>
  );
}
