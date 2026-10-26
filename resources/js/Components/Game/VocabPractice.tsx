import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, PenLine, Quote } from 'lucide-react';
import SpellInput, { SpellMarks } from '@/Components/Game/SpellInput';
import { useMySpeech } from '@/hooks/useSpeech';
import { arrowPrompt, checkSpelling, formsOf, type SpellResult } from '@/lib/spelling';
import { useAutoAdvance, Countdown, AUTO_RIGHT_MS, AUTO_REVEAL_MS, AUTO_RETRY_MS } from '@/lib/autoAdvance';
import { useT } from '@/lib/i18n';
import { reportMiss } from '@/lib/wordMisses';
import type { Word } from '@/Components/Game/Flashcards';

/**
 * Practise the words just studied — required, not optional.
 *
 * The word list ended with an optional "test yourself", so a learner
 * could read five words and walk on. Now each batch ends with two
 * rounds the day waits for:
 *
 *   1. recall   — the Arabic, type the English (two attempts; a miss
 *                 comes back at the end of the round)
 *   2. sentence — the word's own example with a gap where it goes,
 *                 so the word is met in use, not only spelled
 *
 * Words without an example sentence skip round 2; a batch with none
 * ends after round 1.
 */

type Phase = 'recall' | 'sentence' | 'done';

interface Item {
  word: Word;
  /** The example with the word blanked, for round 2 */
  gap?: { before: string; after: string; answer: string };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The written usage sentence first; the book's example only when it holds the word */
function gapOf(w: Word): Item['gap'] {
  const pairs: [string | null | undefined, string | null | undefined][] = [
    [w.sentence, w.target],
    [w.example, w.word],
  ];
  for (const [text, target] of pairs) {
    if (!text || !target) continue;
    // Letter boundaries that know accents: `\b` treats é as a non-letter, so "café" never matched
    const m = text.match(new RegExp(`(?<![\\p{L}\\p{N}])${esc(target)}(?![\\p{L}\\p{N}])`, 'iu'));
    if (m && m.index !== undefined) {
      return { before: text.slice(0, m.index), after: text.slice(m.index + m[0].length), answer: m[0] };
    }
  }
  return undefined;
}

export default function VocabPractice({ words, onComplete }: { words: Word[]; onComplete?: () => void }) {
  const tr = useT();
  const { say } = useMySpeech();

  const withGap = useMemo(() => words.map((w) => ({ word: w, gap: gapOf(w) })), [words]);

  const [phase, setPhase] = useState<Phase>('recall');
  const [queue, setQueue] = useState<Item[]>(withGap);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<SpellResult | null>(null);
  const [requeued, setRequeued] = useState<Set<number>>(new Set());
  const input = useRef<HTMLInputElement>(null);

  const current = queue[index];

  // A new prompt (next word, second try, next round) keeps the cursor in the field
  useEffect(() => {
    if (!result) input.current?.focus({ preventScroll: true });
  }, [index, phase, result]);
  /** Set when the answer is checked: right, or the second miss */
  const [final, setFinal] = useState(false);

  const advance = () => {
    setTyped('');
    setResult(null);
    setAttempt(0);
    setFinal(false);

    if (index + 1 < queue.length) {
      setIndex((i) => i + 1);
      return;
    }

    // Round 1 over → round 2 with the words that have a sentence
    if (phase === 'recall') {
      const sentences = withGap.filter((x) => x.gap);
      if (sentences.length > 0) {
        setPhase('sentence');
        setQueue(sentences);
        setIndex(0);
        setRequeued(new Set());
        return;
      }
    }

    setPhase('done');
    onComplete?.();
  };

  const retry = () => {
    setResult(null);
    setTyped('');
    input.current?.focus();
  };

  // Right → on in 3s; first miss → second try; second miss → read it, then on
  useAutoAdvance(
    result !== null,
    result?.verdict === 'right' ? AUTO_RIGHT_MS : final ? AUTO_REVEAL_MS : AUTO_RETRY_MS,
    () => (final ? advance() : retry()),
  );

  const check = () => {
    if (!current || !typed.trim() || result) return;
    const answer = phase === 'sentence' && current.gap ? current.gap.answer : current.word.word;
    const r = checkSpelling(typed, answer);
    setResult(r);

    if (r.verdict === 'right') {
      setFinal(true);
      say(phase === 'sentence' && current.gap ? current.gap.before + current.gap.answer + current.gap.after : formsOf(current.word.word)[0]);
      return;
    }

    if (attempt === 0) {
      setAttempt(1);
      setFinal(false);
      return;
    }

    setFinal(true);
    reportMiss(current.word.word, 'practice');

    // Second miss: show it, and bring the word back once at the end of the round
    say(formsOf(current.word.word)[0]);
    if (!requeued.has(current.word.id)) {
      setRequeued((s) => new Set(s).add(current.word.id));
      setQueue((q) => [...q, current]);
    }
  };

  // The first-miss result is cleared by retry(); keep the attempt count across it
  if (phase === 'done') {
    return (
      <div className="rounded-2xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-200">
        <Check aria-hidden size={28} className="mx-auto text-emerald-600" />
        <p className="mt-2 font-semibold text-emerald-900">{tr('تمرّنت على كلمات هذه الدفعة')}</p>
      </div>
    );
  }

  if (!current) return null;

  const tone = !result ? 'idle' : result.verdict === 'right' ? 'right' : result.verdict === 'close' ? 'close' : 'wrong';

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold text-violet-800">
          {phase === 'recall' ? <PenLine aria-hidden size={18} /> : <Quote aria-hidden size={18} />}
          {phase === 'recall' ? tr('اختبر نفسك: اكتبها بالإنجليزية') : tr('الكلمة في جملة: أكمل الفراغ')}
        </p>
        <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-semibold text-violet-800">
          {index + 1} {tr('من')} {queue.length}
        </span>
      </div>

      <div className="rounded-xl bg-slate-50 p-5 text-center">
        <p className="text-2xl font-bold text-slate-900">{current.word.arabic}</p>
        {/* An arrow entry asks for its new form: "work → ?" */}
        {phase === 'recall' && arrowPrompt(current.word.word) && (
          <p className="mt-2 font-mono text-lg font-semibold text-violet-700" dir="ltr">{arrowPrompt(current.word.word)}</p>
        )}

        {phase === 'sentence' && current.gap && (
          <p className="mt-4 text-xl leading-relaxed text-slate-800" dir="ltr">
            {current.gap.before}
            <span className={`mx-1 inline-block min-w-24 border-b-2 px-2 font-bold ${
              result?.verdict === 'right' ? 'border-emerald-500 text-emerald-700' : 'border-violet-400 text-violet-700'
            }`}>
              {result?.verdict === 'right' || final ? current.gap.answer : ' '}
            </span>
            {current.gap.after}
          </p>
        )}
        {phase === 'sentence' && current.word.sentence_ar && current.word.sentence && (
          <p className="mt-2 text-sm text-slate-500">{current.word.sentence_ar}</p>
        )}
        {/* How the word is used — after the answer, when the learner can take it in */}
        {result && final && current.word.usage_ar && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900">
            {current.word.usage_ar}
          </p>
        )}

        {result && result.verdict !== 'right' && (
          <div className="mt-4">
            {final ? (
              <>
                <SpellMarks marks={result.marks} size="md" />
                <p className="mt-1 text-sm text-slate-600">{tr('انظر إلى الحروف الملوّنة. ستعود إليك في آخر الجولة.')}</p>
              </>
            ) : (
              <p className="text-sm text-rose-700">{result.hint ?? tr('ليست هي. حاول مرة أخرى.')}</p>
            )}
          </div>
        )}
        {result?.verdict === 'right' && (
          <p className="mt-3 flex items-center justify-center gap-1.5 font-semibold text-emerald-700">
            <Check aria-hidden size={18} /> {tr('صحيحة')}
          </p>
        )}
      </div>

      {/* The field stays mounted, so focus — and the phone keyboard — survive */}
      <div className="mt-4 space-y-3">
        <SpellInput ref={input} value={typed} onChange={setTyped} onSubmit={check} tone={tone} readOnly={!!result} />
        {!result && (
          <button
            onClick={check}
            disabled={!typed.trim()}
            className="min-h-12 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
          >
            {tr('تحقّق')}
          </button>
        )}
      </div>

      {result && (
        <div key={`${phase}-${index}-${attempt}`}>
          <Countdown ms={result.verdict === 'right' ? AUTO_RIGHT_MS : final ? AUTO_REVEAL_MS : AUTO_RETRY_MS}
            tone={result.verdict === 'right' ? 'emerald' : 'rose'} />
        </div>
      )}
    </div>
  );
}
