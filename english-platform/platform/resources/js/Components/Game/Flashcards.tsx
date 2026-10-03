import { useMemo, useState } from 'react';
import { useSpeech } from '@/hooks/useSpeech';

/**
 * بطاقات المفردات.
 *
 * تتبع منهج الكتاب في §"How to Test 500 Words":
 *   - يُعرض العربي أولاً، والإنجليزي مخفي
 *   - يقول الكلمة بصوت عالٍ خلال ثلاث ثوانٍ
 *   - يكشف ويقيّم نفسه
 *   - الكلمات المتعثّرة تُعاد في نهاية الجولة
 *
 * التقييم الذاتي هنا يغذّي لاحقاً خوارزمية FSRS.
 */

export interface Word {
  id: number;
  word: string;
  ipa: string | null;
  arabic: string;
  example: string | null;
  cambridge: string;
}

interface Props {
  words: Word[];
  groupLabel: string;
  onFinish?: (known: number[], unknown: number[]) => void;
}

export default function Flashcards({ words, groupLabel, onFinish }: Props) {
  const { speak } = useSpeech();

  const [queue, setQueue] = useState<Word[]>(() => words);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [known, setKnown] = useState<number[]>([]);
  const [unknown, setUnknown] = useState<number[]>([]);
  /** هل نحن في جولة إعادة الكلمات المتعثّرة؟ */
  const [isRetry, setIsRetry] = useState(false);

  const current = queue[index];
  const done = index >= queue.length;

  const reveal = () => {
    setRevealed(true);
    // ننطق الكلمة تلقائياً عند الكشف — الربط بين الشكل والصوت
    speak(current.word, { rate: 0.8 });
  };

  const rate = (didKnow: boolean) => {
    if (didKnow) {
      setKnown((k) => [...k, current.id]);
    } else {
      setUnknown((u) => [...u, current.id]);
    }

    setRevealed(false);
    setIndex((i) => i + 1);
  };

  /** إعادة الكلمات المتعثّرة — قاعدة الكتاب: أعد اختبار المعلَّمة فقط */
  const retryMissed = () => {
    const missed = words.filter((w) => unknown.includes(w.id));
    setQueue(missed);
    setIndex(0);
    setUnknown([]);
    setRevealed(false);
    setIsRetry(true);
  };

  const restart = () => {
    setQueue(words);
    setIndex(0);
    setKnown([]);
    setUnknown([]);
    setRevealed(false);
    setIsRetry(false);
  };

  /* ---------- النتيجة ---------- */
  if (done) {
    const total = queue.length;
    const score = total - unknown.length;
    const percent = Math.round((score / total) * 100);
    const passed = percent >= 80;   // هدف الكتاب: 80%

    return (
      <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
        <div
          className={`mx-auto flex h-24 w-24 items-center justify-center
                      rounded-full text-2xl font-bold ${
            passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {percent}%
        </div>

        <h3 className="mt-6 text-lg font-bold">
          {score} من {total}
        </h3>

        <p className="mt-2 text-sm text-slate-600">
          {passed
            ? 'تجاوزت هدف 80٪ — انتقل للمجموعة التالية.'
            : 'الهدف 80٪. أعد الكلمات المتعثّرة قبل أن تنتقل.'}
        </p>

        <div className="mt-6 flex justify-center gap-3">
          {unknown.length > 0 && (
            <button
              onClick={retryMissed}
              className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium
                         text-white hover:bg-teal-700"
            >
              أعد الكلمات المتعثّرة ({unknown.length})
            </button>
          )}
          <button
            onClick={restart}
            className="rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-medium
                       text-slate-700 hover:bg-slate-200"
          >
            من البداية
          </button>
        </div>
      </div>
    );
  }

  /* ---------- البطاقة ---------- */
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      {/* الرأس */}
      <div className="mb-5 flex items-center justify-between text-sm">
        <span className="text-slate-500">
          {groupLabel}
          {isRetry && (
            <span className="mr-2 rounded-full bg-amber-50 px-2 py-0.5
                             text-xs text-amber-700">
              إعادة
            </span>
          )}
        </span>
        <span className="text-slate-500">
          {index + 1} / {queue.length}
        </span>
      </div>

      <div className="mb-5 h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-teal-500 transition-all"
          style={{ width: `${(index / queue.length) * 100}%` }}
        />
      </div>

      {/* الوجه */}
      <div className="min-h-[220px] rounded-lg bg-slate-50 p-8 text-center">
        {/* العربية دائماً ظاهرة — الاتجاه من العربي للإنجليزي كما في الكتاب */}
        <p className="text-2xl font-bold text-slate-900">{current.arabic}</p>

        {!revealed ? (
          <div className="mt-10">
            <p className="text-sm text-slate-500">
              قل الكلمة بالإنجليزية بصوت عالٍ
            </p>
            <button
              onClick={reveal}
              className="mt-4 rounded-lg bg-slate-900 px-8 py-2.5 font-medium
                         text-white hover:bg-slate-800"
            >
              اكشف
            </button>
          </div>
        ) : (
          <div className="mt-6" dir="ltr">
            <p className="text-3xl font-bold text-teal-700">{current.word}</p>

            {current.ipa && (
              <p className="mt-2 font-mono text-lg tracking-wide text-teal-600">
                {current.ipa}
              </p>
            )}

            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => speak(current.word, { rate: 0.8 })}
                className="rounded-md bg-white px-3 py-1.5 text-sm shadow-sm
                           ring-1 ring-slate-200 hover:bg-slate-50"
              >
                🔊 استمع
              </button>
              <button
                onClick={() => speak(current.word, { rate: 0.55 })}
                className="rounded-md bg-white px-3 py-1.5 text-sm shadow-sm
                           ring-1 ring-slate-200 hover:bg-slate-50"
              >
                🐢 أبطأ
              </button>
              <a
                href={current.cambridge}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-white px-3 py-1.5 text-sm shadow-sm
                           ring-1 ring-slate-200 hover:bg-slate-50"
              >
                القاموس ↗
              </a>
            </div>

            {current.example && (
              <p className="mt-5 text-sm italic text-slate-600">
                {current.example}
              </p>
            )}
          </div>
        )}
      </div>

      {/* التقييم الذاتي */}
      {revealed && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => rate(false)}
            className="rounded-lg border-2 border-rose-200 bg-rose-50 py-3
                       font-medium text-rose-700 hover:bg-rose-100"
          >
            لم أعرفها
          </button>
          <button
            onClick={() => rate(true)}
            className="rounded-lg border-2 border-emerald-200 bg-emerald-50 py-3
                       font-medium text-emerald-700 hover:bg-emerald-100"
          >
            عرفتها
          </button>
        </div>
      )}
    </div>
  );
}
