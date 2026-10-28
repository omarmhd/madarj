import { useState } from 'react';
import axios from 'axios';
import { Check, ListOrdered, Lightbulb, PenLine, RotateCcw } from 'lucide-react';
import StoryReader from '@/Components/Game/StoryReader';
import type { StoryData } from '@/Pages/Stories';
import { useT } from '@/lib/i18n';

/**
 * قصة اليوم — a story from the library, read inside the day.
 *
 * Days 3 and 6 read a story in place of the episode: reading and
 * watching take turns, and the day does not grow. Then, in turn, each
 * opening the next, and every one judged by the server:
 *
 *   1. order the events — four of its sentences, shuffled (comprehension)
 *   2. the missing word — a glossed word out of its sentence (vocabulary)
 *   3. the moral, from three
 *   4. one English sentence from the story, written down
 *
 * The answer is shown after two tries, never on the first, as everywhere
 * in the book.
 */

export interface StoryStationData {
  day: number;
  week: number;
  story: StoryData;
  /** Three morals, one of them this story's — which one is never sent */
  morals: string[];
  /** Four of its sentences, shuffled; tokens, not positions */
  order: { token: string; text: string }[];
  /** A sentence with a glossed word out — the word stays on the server */
  gap: { before: string; after: string; hint: string | null; length: number } | null;
}

/** Put the events in order: tap them in the order they happen */
function OrderDrill({ data, onSettled }: { data: StoryStationData; onSettled: () => void }) {
  const tr = useT();
  const [picked, setPicked] = useState<string[]>([]);
  const [tries, setTries] = useState(0);
  const [state, setState] = useState<'open' | 'wrong' | 'right' | 'shown'>('open');
  const [shown, setShown] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const text = (t: string) => data.order.find((o) => o.token === t)?.text ?? '';
  const done = state === 'right' || state === 'shown';

  const check = async () => {
    setBusy(true);
    try {
      const { data: res } = await axios.post('/stories/drill', {
        slug: data.story.slug, week: data.week, day: data.day, kind: 'order', answer: picked, attempt: tries + 1,
      });
      setTries((n) => n + 1);
      if (res.correct) { setState('right'); onSettled(); }
      else if (res.answer) { setShown(res.answer); setState('shown'); onSettled(); }
      else { setState('wrong'); setPicked([]); }
    } finally {
      setBusy(false);
    }
  };

  const list = shown ?? picked;

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
      <p className="flex items-center gap-2 font-semibold text-slate-900">
        <ListOrdered aria-hidden size={17} className="text-sky-600" /> {tr('رتّب الأحداث')}
      </p>
      <p className="mt-1 text-sm text-slate-600">{tr('اضغط الجمل بترتيب حدوثها في القصة.')}</p>

      {/* The order being built */}
      {list.length > 0 && (
        <ol className="mt-3 space-y-2" dir="ltr">
          {list.map((t, i) => (
            <li key={t} className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-base ring-1 ${
              state === 'right' ? 'bg-emerald-50 ring-emerald-300' : state === 'shown' ? 'bg-sky-50 ring-sky-200' : 'bg-violet-50 ring-violet-200'
            }`}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-slate-700">{i + 1}</span>
              <span className="text-slate-800">{text(t)}</span>
            </li>
          ))}
        </ol>
      )}

      {/* What is left to place */}
      {!done && (
        <div className="mt-3 space-y-2" dir="ltr">
          {data.order.filter((o) => !picked.includes(o.token)).map((o) => (
            <button
              key={o.token}
              onClick={() => { setPicked((p) => [...p, o.token]); setState('open'); }}
              className="block w-full rounded-xl bg-white px-3 py-2.5 text-start text-base text-slate-800 ring-1 ring-slate-200 transition hover:ring-violet-300 active:scale-[.99]"
            >
              {o.text}
            </button>
          ))}
        </div>
      )}

      {!done && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={check}
            disabled={busy || picked.length !== data.order.length}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            {tr('تحقّق')}
          </button>
          {picked.length > 0 && (
            <button onClick={() => setPicked([])} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
              <RotateCcw aria-hidden size={14} /> {tr('من جديد')}
            </button>
          )}
        </div>
      )}
      {state === 'wrong' && <p className="mt-2 text-sm text-amber-800">{tr('ليس هذا ترتيبها. اقرأ القصة مرة أخرى وحاول.')}</p>}
      {state === 'right' && <p className="mt-2 text-sm font-medium text-emerald-700">{tr('صحيح — هذا ترتيب القصة.')}</p>}
      {state === 'shown' && <p className="mt-2 text-sm text-slate-600">{tr('هذا ترتيبها الصحيح. اقرأها بهذا الترتيب.')}</p>}
    </div>
  );
}

/** The missing word: one glossed word, typed back into its sentence */
function GapDrill({ data, onSettled }: { data: StoryStationData; onSettled: () => void }) {
  const tr = useT();
  const gap = data.gap!;
  const [typed, setTyped] = useState('');
  const [tries, setTries] = useState(0);
  const [state, setState] = useState<'open' | 'wrong' | 'right' | 'shown'>('open');
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const done = state === 'right' || state === 'shown';

  const check = async () => {
    if (!typed.trim()) return;
    setBusy(true);
    try {
      const { data: res } = await axios.post('/stories/drill', {
        slug: data.story.slug, week: data.week, day: data.day, kind: 'gap', answer: typed, attempt: tries + 1,
      });
      setTries((n) => n + 1);
      if (res.correct) { setState('right'); onSettled(); }
      else if (res.answer) { setShown(res.answer); setState('shown'); onSettled(); }
      else setState('wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="leaf-in rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
      <p className="flex items-center gap-2 font-semibold text-slate-900">
        <PenLine aria-hidden size={17} className="text-teal-600" /> {tr('أكمل الكلمة الناقصة')}
      </p>
      {gap.hint && <p className="mt-1 text-sm text-slate-600">{tr('معناها:')} {gap.hint}</p>}

      <form
        onSubmit={(e) => { e.preventDefault(); if (!done) check(); }}
        className="mt-3 flex flex-wrap items-baseline gap-x-1.5 gap-y-2 text-lg leading-relaxed text-slate-800"
        dir="ltr"
      >
        <span>{gap.before}</span>
        {done ? (
          <span className={`rounded-lg px-2 font-semibold ${state === 'right' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>
            {state === 'right' ? typed.trim() : shown}
          </span>
        ) : (
          <input
            value={typed}
            onChange={(e) => { setTyped(e.target.value); if (state === 'wrong') setState('open'); }}
            size={Math.max(4, gap.length + 1)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="rounded-lg border-0 border-b-2 border-violet-400 bg-violet-50 px-2 py-0.5 text-center font-semibold focus:border-violet-600 focus:ring-0"
          />
        )}
        <span>{gap.after}</span>
      </form>

      {!done && (
        <button
          onClick={check}
          disabled={busy || !typed.trim()}
          className="mt-3 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          {tr('تحقّق')}
        </button>
      )}
      {state === 'wrong' && <p className="mt-2 text-sm text-amber-800">{tr('ليست هي. ابحث عن الجملة في القصة وحاول مرة أخرى.')}</p>}
      {state === 'right' && <p className="mt-2 text-sm font-medium text-emerald-700">{tr('صحيح!')}</p>}
      {state === 'shown' && <p className="mt-2 text-sm text-slate-600">{tr('هذه هي الكلمة. اكتبها في ذهنك مرة وأنت تقرأ الجملة.')}</p>}
    </div>
  );
}

interface Props {
  weekNumber: number;
  data: StoryStationData;
  rate: number;
  /** Everything saved for this week, by day — the save sends all of it back */
  saved: Record<string, string> | null;
  onSaved?: (sentence: string) => void;
}

export default function StoryStation({ weekNumber, data, rate, saved, onSaved }: Props) {
  const tr = useT();
  const key = `day${data.day}`;

  const savedMoral = saved?.[`${key}_moral`] ?? '';
  // Each exercise opens the next; a station already saved opens them all
  const [orderDone, setOrderDone] = useState(!!savedMoral || data.order.length === 0);
  const [gapDone, setGapDone] = useState(!!savedMoral || !data.gap);
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
      <StoryReader story={data.story} rate={rate} isRead={!!savedMoral} onFinish={() => {}} hideMoral />

      {data.order.length > 0 && !savedMoral && <OrderDrill data={data} onSettled={() => setOrderDone(true)} />}
      {orderDone && data.gap && !savedMoral && <GapDrill data={data} onSettled={() => setGapDone(true)} />}

      {/* The moral: the question the story answers */}
      {orderDone && gapDone && (
      <div className="leaf-in rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
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
      )}

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
