import { Check, HelpCircle, Volume1, Volume2 } from 'lucide-react';
import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import Listen from '@/Components/Listen';
import { useMySpeech } from '@/hooks/useSpeech';
import { useT } from '@/lib/i18n';
import { useAutoAdvance, Countdown, AUTO_RIGHT_MS, AUTO_REVEAL_MS } from '@/lib/autoAdvance';
import SayIt, { type SayItem } from '@/Components/Game/SayIt';
import MouthDiagram from '@/Components/Game/MouthDiagram';
import { soundsIn } from '@/lib/articulation';

/**
 * لعبة التمييز الصوتي.
 *
 * المنطق مأخوذ من §8.2 في الكتاب حرفياً:
 *   - المجموعات منفصلة (لا نخلط /ɪ/ مع /ʊ/ مع /æ/)
 *   - المتصفح ينطق إحدى الكلمتين عشوائياً
 *   - المستخدم يضغط ما سمعه
 *   - الهدف 11 من 12
 *
 * لا يوجد ملف صوتي واحد على الخادم — Web Speech ينطق كل شيء.
 */

export interface PairGloss {
  word: string;
  arabic: string | null;
  example: string | null;
}

interface Pair {
  id: number;
  ipa: string | null;
  word_a: string;
  word_b: string;
  /** Meaning and a sentence for each word, a then b */
  gloss?: PairGloss[];
}

/**
 * One sound contrast, named in the learner's language.
 *
 * The English heading is the book's; it stays as a secondary
 * label. `label_ar` is what the learner reads, and `hint_ar` is
 * what tells them which two sounds they are separating and how.
 */
export interface Group {
  label_ar: string | null;
  label_en: string;
  ipa: string | null;
  hint_ar: string | null;
  pairs: Pair[];
}

interface Props {
  /** يُبلّغ الموضع إلى الأعلى ويُخفي الشريط الداخلي */
  onProgress?: (done: number, total: number) => void;
  /** خطّة اليوم تقول «إنتاج» — فيُفتح فحص النطق مباشرةً */
  production?: boolean;
  /** المجموعات بترتيب تدريبها — لا تُخلط، كما في §8.2 */
  groups: Group[];
  /** الهدف المطلوب — من الكتاب: 11 من 12. Omitted, it scales to 11/12 of the questions */
  target?: number;
  onFinish?: (score: number, total: number) => void;
}

type Phase = 'idle' | 'playing' | 'answered' | 'done' | 'say';

interface Question {
  pair: Pair;
  /** أي الكلمتين نُطقت فعلاً */
  spoken: 'a' | 'b';
  /** المجموعة كاملة — منها اسمها العربي وسطر تدريبها */
  contrast: Group;
  group: string;
}

export default function MinimalPairGame({ groups, target: targetProp, onFinish, onProgress, production = false }: Props) {
  const tr = useT();
  const { say, speaking, supported } = useMySpeech();

  /*
   * The questions: every group asked as about twelve, in group order.
   *
   * A day now drills one contrast, and a contrast can have three
   * pairs — three questions is a guess, not a test. So each pair is
   * asked more than once until the group reaches about twelve (the
   * book's "11 of 12"), with the word spoken chosen afresh each time
   * and the order shuffled inside the group. Groups are never
   * shuffled into each other (§2.4).
   */
  const questions = useMemo<Question[]>(() => {
    const list: Question[] = [];
    groups.forEach((contrast) => {
      const n = contrast.pairs.length;
      const times = n === 0 ? 0 : Math.min(4, Math.max(1, Math.round(12 / n)));
      const own: Question[] = [];

      for (let t = 0; t < times; t++) {
        contrast.pairs.forEach((pair) => {
          own.push({
            pair,
            // اختيار عشوائي أي كلمة تُنطق
            spoken: Math.random() < 0.5 ? 'a' : 'b',
            contrast,
            group: contrast.label_ar ?? contrast.label_en,
          });
        });
      }

      for (let i = own.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [own[i], own[j]] = [own[j], own[i]];
      }

      list.push(...own);
    });
    return list;
  }, [groups]);

  const [index, setIndex] = useState(0);
  // The day's plan can send the learner straight to production
  const [phase, setPhase] = useState<Phase>(production ? 'say' : 'idle');
  const [picked, setPicked] = useState<'a' | 'b' | null>(null);
  const [hintOpen, setHintOpen] = useState<boolean | null>(null);
  const [correct, setCorrect] = useState(0);
  /** الأخطاء — تُعرض في النهاية ليعرف أي أزواج يحتاج تدريباً */
  const [missed, setMissed] = useState<Question[]>([]);

  const current = questions[index];
  const total = questions.length;
  const target = targetProp ?? Math.ceil((total * 11) / 12);

  /**
   * Report the position upward, so the page shows it in its single
   * bar instead of a second one.
   *
   * Declared here, above every early return: a hook placed after one
   * runs on some renders and not others, and React counts hooks —
   * `supported` flipping to false would then throw and blank the
   * screen rather than hide one feature.
   */
  useEffect(() => {
    onProgress?.(index, total);
  }, [index, total, onProgress]);

  /** نطق الكلمة المطلوبة */
  const play = useCallback(
    (rate?: number) => {
      if (!current) return;
      const word = current.spoken === 'a' ? current.pair.word_a : current.pair.word_b;
      say(word, { rate });
      if (phase === 'idle') setPhase('playing');
    },
    [current, say, phase],
  );

  const pick = (choice: 'a' | 'b') => {
    if (phase === 'answered' || phase === 'done') return;

    setPicked(choice);
    setPhase('answered');

    if (choice === current.spoken) {
      setCorrect((c) => c + 1);
    } else {
      setMissed((m) => [...m, current]);
    }
  };

  // Moves on by itself — right in 3s, wrong in 5s to hear the pair again
  const autoMs = picked !== null && current && picked === current.spoken ? AUTO_RIGHT_MS : AUTO_REVEAL_MS;
  const nextRef = useRef<() => void>();

  // From the second question on, the word plays by itself — the first
  // tap gave the browser permission, and tapping "listen" twelve times
  // was work with no learning in it
  useEffect(() => {
    if (index > 0 && phase === 'idle' && current) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  useAutoAdvance(phase === 'answered', autoMs, () => nextRef.current?.());

  const next = () => {
    if (index + 1 >= total) {
      setPhase('done');
      onFinish?.(correct, total);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setPhase('idle');
  };
  nextRef.current = next;

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setCorrect(0);
    setMissed([]);
    setPhase('idle');
  };

  /* ---------- المتصفح لا يدعم النطق ---------- */
  if (!supported) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center">
        <p className="font-semibold text-amber-900">
          {tr('متصفحك لا يدعم النطق الآلي')}
        </p>
        <p className="mt-2 text-sm text-amber-800">
          {tr('استخدم Chrome أو Edge أو Safari. أو اضغط روابط كامبريدج في جدول الأزواج للاستماع يدوياً.')}
        </p>
        {/* The browser's limit is not the learner's: without this the day stops here */}
        <button
          onClick={() => onFinish?.(0, 0)}
          className="mt-4 rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-amber-900 ring-1 ring-amber-300
                     transition hover:bg-amber-100"
        >
          {tr('تابع يومك')}
        </button>
      </div>
    );
  }

  /* ---------- فحص النطق ---------- */
  if (phase === 'say') {
    /*
     * What to practise saying, and in what order.
     *
     * The pairs they just failed to hear come first: those are the
     * contrasts their mouth is most likely to be merging too. Each
     * pair gives two items, because saying `ship` correctly proves
     * nothing about `sheep`. Capped, because a production drill of
     * twenty-four words is abandoned at the sixth.
     */
    const missedPairs = missed.map((m) => m.pair);
    const rest = questions.map((q) => q.pair).filter((p) => !missedPairs.includes(p));

    const items: SayItem[] = [];
    for (const pair of [...missedPairs, ...rest]) {
      items.push({ say: pair.word_a, against: pair.word_b, ipa: pair.ipa });
      items.push({ say: pair.word_b, against: pair.word_a, ipa: pair.ipa });
      if (items.length >= 8) break;
    }

    return (
      <div className="space-y-3">
        <SayIt items={items} />

        <button
          onClick={() => {
            // A production-only step (`pron:production`) opens here and has
            // no other end — without this its "Next" never appeared
            if (production) onFinish?.(correct, total);
            setPhase('done');
          }}
          className="w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700
                     transition hover:bg-slate-200"
        >
          {tr('رجوع إلى النتيجة')}
        </button>
      </div>
    );
  }

  /* ---------- شاشة النتيجة ---------- */
  if (phase === 'done') {
    const passed = correct >= target;

    return (
      <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
        <div
          className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold ${
            passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {correct}/{total}
        </div>

        <h3 className="mt-6 text-xl font-bold">
          {passed ? tr('أذنك تميّز الفرق') : tr('تحتاج تدريباً أكثر')}
        </h3>

        <p className="mt-2 text-sm text-slate-600">
          {passed
            ? tr('الهدف كان :t من :n — وقد تجاوزته.', { t: target, n: total })
            : tr('الهدف :t من :n. لا تنتقل للإنتاج قبل أن تصل إليه — الاستماع أولاً دائماً.', { t: target, n: total })}
        </p>

        {missed.length > 0 && (
          <div className="mt-6 text-start">
            <p className="mb-3 text-sm font-semibold text-slate-700">
              {tr('الأزواج التي أخطأت فيها — درّبها عشر دقائق يومياً:')}
            </p>
            <div className="space-y-2">
              {missed.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2"
                >
                  <span className="font-mono text-sm text-slate-500" dir="ltr">
                    {m.pair.ipa}
                  </span>
                  <div className="flex gap-2" dir="ltr">
                    {[m.pair.word_a, m.pair.word_b].map((w) => (
                      <Listen key={w} text={w} label={w} size="sm" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {passed && (
          <button
            onClick={() => setPhase('say')}
            className="mt-6 w-full rounded-xl bg-violet-600 py-3 font-semibold text-white
                       transition hover:bg-violet-700"
          >
            {tr('الآن قُلها أنت — ولنرَ ما يسمعه المتصفّح')}
          </button>
        )}

        <button
          onClick={restart}
          className="mt-3 rounded-lg bg-slate-900 px-6 py-2.5 font-medium text-white
                     hover:bg-slate-800"
        >
          {tr('أعد المحاولة')}
        </button>
      </div>
    );
  }

  /* ---------- شاشة اللعب ---------- */
  /**
   * First question of its group.
   *
   * There the coaching line opens by itself; after it the line stays
   * folded — the learner reads the difference once and then drills it.
   */
  const firstOfGroup =
    index === 0 || questions[index - 1]?.contrast !== current?.contrast;

  // The two sounds being separated, read from "/ɪ/ vs /iː/" or the group title
  const mouths = soundsIn(current.contrast.ipa ?? current.contrast.label_en);
  const hasHint = !!current.contrast.hint_ar || mouths.length > 0;
  // Closed by default: the pairs were just heard, and the drawing pushed the game off-screen
  const showHint = hintOpen ?? false;
  const right = picked === current.spoken;

  return (
    <div>
      {/* One line: the contrast, and where you are */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {current.contrast.label_ar ?? current.contrast.label_en}
          </p>
          <p className="mt-0.5 font-mono text-sm text-violet-700" dir="ltr">{current.pair.ipa}</p>
        </div>
        <span className="shrink-0 rounded-full bg-violet-50 px-3 py-1 text-sm font-semibold text-violet-800">
          {tr('السؤال')} {index + 1} {tr('من')} {total}
        </span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, k) => (
          <span key={k} className={`h-1 flex-1 rounded-full ${k < index ? 'bg-violet-500' : k === index ? 'bg-violet-300' : 'bg-slate-200'}`} />
        ))}
      </div>

      {/* The difference — a small button, open by itself only on a group's first question */}
      {hasHint && (
        <div className="mt-3">
          <button
            onClick={() => setHintOpen(!showHint)}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
          >
            <HelpCircle aria-hidden size={15} /> {tr('ما الفرق؟')}
          </button>
          {showHint && (
            <div className="mt-2 rounded-xl bg-violet-50/70 p-3">
              {current.contrast.hint_ar && (
                <p className="text-sm leading-relaxed text-slate-700">{current.contrast.hint_ar}</p>
              )}
              {/* Drawn, not spoken: hearing the two words here would answer the question */}
              {mouths.length > 0 && <div className="mt-2"><MouthDiagram sounds={mouths} /></div>}
            </div>
          )}
        </div>
      )}

      {/* Listen */}
      <div className="my-6 flex items-center justify-center gap-3">
        <button
          onClick={() => play(0.8)}
          disabled={speaking}
          aria-label={tr('استمع')}
          className={`relative grid h-16 w-16 place-items-center rounded-full bg-violet-600 text-white shadow-md transition
                      hover:bg-violet-700 active:scale-95 ${speaking ? 'ring-8 ring-violet-200' : ''}`}
        >
          {speaking ? <Volume1 size={28} /> : <Volume2 size={28} />}
        </button>
        <div className="text-start">
          <p className="text-base font-semibold text-slate-800">
            {phase === 'idle' ? tr('اضغط واستمع') : tr('أي كلمة سمعت؟')}
          </p>
          {phase !== 'idle' && (
            <button onClick={() => play(0.6)} className="mt-0.5 text-sm font-medium text-violet-700 underline">
              {tr('أبطأ')}
            </button>
          )}
        </div>
      </div>

      {/* The two words */}
      <div className="grid grid-cols-2 gap-3" dir="ltr">
        {(['a', 'b'] as const).map((side) => {
          const word = side === 'a' ? current.pair.word_a : current.pair.word_b;
          const isPicked = picked === side;
          const isRight = current.spoken === side;
          const revealed = phase === 'answered';

          let style = 'bg-white ring-1 ring-slate-200 hover:ring-2 hover:ring-violet-400';
          if (revealed && isRight) style = 'bg-emerald-50 ring-2 ring-emerald-500 text-emerald-800';
          else if (revealed && isPicked) style = 'bg-rose-50 ring-2 ring-rose-400 text-rose-800';
          else if (revealed) style = 'bg-white ring-1 ring-slate-200 opacity-40';

          return (
            <button
              key={side}
              onClick={() => pick(side)}
              disabled={phase === 'idle' || revealed}
              className={`flex min-h-20 flex-col items-center justify-center rounded-2xl py-2 transition
                          active:scale-[.98] disabled:cursor-not-allowed ${style}`}
            >
              <span className="flex items-center gap-2 text-2xl font-bold">
                {word}
                {revealed && isRight && <Check aria-hidden size={20} className="text-emerald-600" />}
              </span>
              {/* The meaning gives nothing away: it does not say which word was spoken */}
              {current.pair.gloss?.[side === 'a' ? 0 : 1]?.arabic && (
                <span className="mt-0.5 text-sm font-normal text-slate-500" dir="rtl">
                  {current.pair.gloss[side === 'a' ? 0 : 1].arabic}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* After the answer: one line, then the time bar */}
      {phase === 'answered' && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className={`font-semibold ${right ? 'text-emerald-700' : 'text-rose-700'}`}>
              {right ? tr('صحيح') : tr('كانت «:w»', { w: current.spoken === 'a' ? current.pair.word_a : current.pair.word_b })}
            </p>
            {/* The two words in turn — the moment the ear learns the difference */}
            <button
              onClick={() => {
                say(current.pair.word_a, { slow: true });
                setTimeout(() => say(current.pair.word_b, { slow: true }), 1100);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              <Volume2 aria-hidden size={15} /> {tr('اسمع الاثنتين')}
            </button>
          </div>
          {(() => {
            const g = current.pair.gloss?.[current.spoken === 'a' ? 0 : 1];
            return g?.example ? (
              <button
                onClick={() => say(g.example!, { slow: true })}
                className="mt-3 flex w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-start text-base text-slate-800 hover:bg-slate-100"
                dir="ltr"
              >
                <Volume2 aria-hidden size={15} className="shrink-0 text-violet-600" /> {g.example}
              </button>
            ) : null;
          })()}
          <div key={index}>
            <Countdown ms={autoMs} tone={right ? 'emerald' : 'rose'} />
          </div>
        </div>
      )}
    </div>
  );
}
