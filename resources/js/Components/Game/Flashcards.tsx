import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import Listen from '@/Components/Listen';
import SpellInput, { SpellMarks } from '@/Components/Game/SpellInput';
import { useMySpeech } from '@/hooks/useSpeech';
import { checkSpelling, type SpellResult } from '@/lib/spelling';
import { useT } from '@/lib/i18n';

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
 *
 * Typing the word is the main path: a card answered in the head is
 * graded by the learner's honesty, a typed one by its letters — and
 * the letters are what a sentence is built from. Self-grading stays
 * for a learner who reveals without typing.
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
  /** يُبلّغ الموضع إلى الأعلى ويُخفي الشريط الداخلي */
  onProgress?: (done: number, total: number) => void;
  words: Word[];
  groupLabel: string;
  onFinish?: (known: number[], unknown: number[]) => void;
}

export default function Flashcards({ words, groupLabel, onFinish, onProgress}: Props) {
  const tr = useT();
  const { say } = useMySpeech();

  const [queue, setQueue] = useState<Word[]>(() => words);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [known, setKnown] = useState<number[]>([]);
  const [unknown, setUnknown] = useState<number[]>([]);
  /** هل نحن في جولة إعادة الكلمات المتعثّرة؟ */
  const [isRetry, setIsRetry] = useState(false);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<SpellResult | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);

  const current = queue[index];
  const done = index >= queue.length;

  const reveal = () => {
    touched.current = true;
    setRevealed(true);
    // ننطق الكلمة تلقائياً عند الكشف — الربط بين الشكل والصوت
    say(current.word);
    if (typed.trim()) setResult(checkSpelling(typed, current.word));
  };

  const rate = (didKnow: boolean) => {
    if (didKnow) {
      setKnown((k) => [...k, current.id]);
    } else {
      setUnknown((u) => [...u, current.id]);
    }

    setRevealed(false);
    setTyped('');
    setResult(null);
    setIndex((i) => i + 1);
  };

  /** إعادة الكلمات المتعثّرة — قاعدة الكتاب: أعد اختبار المعلَّمة فقط */
  const retryMissed = () => {
    const missed = words.filter((w) => unknown.includes(w.id));
    setQueue(missed);
    setIndex(0);
    setUnknown([]);
    setRevealed(false);
    setTyped('');
    setResult(null);
    setIsRetry(true);
  };

  const restart = () => {
    setQueue(words);
    setIndex(0);
    setKnown([]);
    setUnknown([]);
    setRevealed(false);
    setTyped('');
    setResult(null);
    setIsRetry(false);
  };

  // Reports position to the parent's single progress bar. Must stay above
  // the early return below, or the result screen crashes React.
  useEffect(() => {
    onProgress?.(index, queue.length);
  }, [index, queue.length, onProgress]);

  // Keyboard flow: type, Enter to check, Enter for the next card.
  // Not on mount: focusing there opens the phone keyboard over a card
  // the learner has not looked at yet.
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current) return;
    if (revealed) nextBtn.current?.focus();
    else field.current?.focus({ preventScroll: true });
  }, [revealed, index]);

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
            ? tr('تجاوزت هدف 80٪ — انتقل للمجموعة التالية.')
            : tr('الهدف 80٪. أعد الكلمات المتعثّرة قبل أن تنتقل.')}
        </p>

        <div className="mt-6 flex justify-center gap-3">
          {unknown.length > 0 && (
            <button
              onClick={retryMissed}
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium
                         text-white hover:bg-violet-700"
            >
              أعد الكلمات المتعثّرة ({unknown.length})
            </button>
          )}
          <button
            onClick={restart}
            className="rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-medium
                       text-slate-700 hover:bg-slate-200"
          >
            {tr('من البداية')}
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
            <span className="me-2 rounded-full bg-amber-50 px-2 py-0.5
                             text-xs text-amber-700">
              {tr('إعادة')}
            </span>
          )}
        </span>
        <span className="text-slate-500">
          {index + 1} / {queue.length}
        </span>
      </div>

      {/* الشريط الداخلي يُخفى حين يحمله شريط الصفحة */}
      {!onProgress && (
        <div className="mb-5 h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-violet-500 transition-all"
            style={{ width: `${(index / queue.length) * 100}%` }}
          />
        </div>
      )}

      {/* الوجه */}
      <div className="min-h-[220px] rounded-lg bg-slate-50 p-8 text-center">
        {/* العربية دائماً ظاهرة — الاتجاه من العربي للإنجليزي كما في الكتاب */}
        <p className="text-2xl font-bold text-slate-900">{current.arabic}</p>

        {!revealed ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-slate-600">
              {tr('قلها بصوت عالٍ، ثم اكتبها بالإنجليزية')}
            </p>
            <SpellInput ref={field} value={typed} onChange={setTyped} onSubmit={reveal} />
            <button
              onClick={reveal}
              className="w-full rounded-xl bg-slate-900 py-3 font-medium text-white
                         transition hover:bg-slate-800"
            >
              {typed.trim() ? tr('تحقّق') : tr('لا أعرفها — اكشف')}
            </button>
          </div>
        ) : (
          <div className="mt-5" dir="ltr">
            {result && result.verdict !== 'right' ? (
              <SpellMarks marks={result.marks} />
            ) : (
              <p className="text-3xl font-bold text-violet-700">{current.word}</p>
            )}

            {current.ipa && (
              <p className="mt-2 font-mono text-lg text-violet-600">
                {current.ipa}
              </p>
            )}

            <div className="mt-4 flex justify-center gap-2">
              <Listen text={current.word} label={tr("استمع")} prominent />
              <Listen text={current.word} label={tr("أبطأ")} slow />
            </div>

            {current.example && (
              <p className="mt-5 text-sm italic text-slate-600">
                {current.example}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Typed: the letters decide, and say why */}
      {revealed && result && (
        <div
          className={`mt-4 rounded-xl p-4 text-sm leading-relaxed ${
            result.verdict === 'right'
              ? 'bg-emerald-50 text-emerald-800'
              : result.verdict === 'close'
                ? 'bg-amber-50 text-amber-900'
                : 'bg-rose-50 text-rose-800'
          }`}
        >
          <p className="flex items-center gap-1.5 font-semibold">
            {result.verdict === 'right' ? <Check aria-hidden size={16} /> : <X aria-hidden size={16} />}
            {result.verdict === 'right'
              ? tr('صحيحة')
              : result.verdict === 'close'
                ? tr('قريبة جداً — انظر إلى الحروف الملوّنة')
                : tr('ليست هي — انظر إلى الحروف الملوّنة')}
          </p>
          {(result.note || result.hint) && <p className="mt-1">{result.note ?? result.hint}</p>}
        </div>
      )}

      {revealed && result && (
        <button
          ref={nextBtn}
          onClick={() => rate(result.verdict === 'right')}
          className="mt-4 min-h-12 w-full rounded-xl bg-slate-900 font-semibold text-white
                     transition hover:bg-slate-800"
        >
          {tr('التالي')}
        </button>
      )}

      {/* التقييم الذاتي — لمن كشف بلا كتابة */}
      {revealed && !result && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => rate(false)}
            className="rounded-lg border-2 border-rose-200 bg-rose-50 py-3
                       font-medium text-rose-700 hover:bg-rose-100"
          >
            {tr('لم أعرفها')}
          </button>
          <button
            onClick={() => rate(true)}
            className="rounded-lg border-2 border-emerald-200 bg-emerald-50 py-3
                       font-medium text-emerald-700 hover:bg-emerald-100"
          >
            {tr('عرفتها')}
          </button>
        </div>
      )}
    </div>
  );
}
