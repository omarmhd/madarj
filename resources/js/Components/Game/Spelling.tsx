import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Ear, PenLine, RotateCcw, Volume2 } from 'lucide-react';
import Listen from '@/Components/Listen';
import Bdi from '@/Components/Bdi';
import SpellInput, { SpellMarks } from '@/Components/Game/SpellInput';
import { useMySpeech } from '@/hooks/useSpeech';
import { checkSpelling, normalize, vowelGaps, type SpellResult } from '@/lib/spelling';
import { useT } from '@/lib/i18n';

/**
 * Spelling drill — the learner writes the word, not just recognises it.
 *
 * The flashcards test whether a word comes to mind; nothing tested
 * whether it could be written, and a sentence is built from written
 * words. The rounds move from most support to least, the standard
 * recognise → recall order:
 *
 *   gaps       the word with its vowels blanked, Arabic and sound given
 *   dictation  sound only — the spelling must come from the ear
 *   recall     Arabic only — the word must come from memory
 *
 * Within a word, the book's rule holds: the answer appears after the
 * second attempt, not the first. A revealed word is then copied once
 * while looking at it (look–say–cover–write–check), and returns at
 * the end of the round.
 */

export interface SpellWord {
  id: number;
  word: string;
  arabic: string;
  ipa: string | null;
}

export type SpellRound = 'gaps' | 'dictation' | 'recall';

interface Props {
  words: SpellWord[];
  rounds: SpellRound[];
  onProgress?: (done: number, total: number) => void;
}

type Stage = 'intro' | 'ask' | 'right' | 'copy' | 'done';

const ROUNDS: Record<SpellRound, { title: string; steps: string[] }> = {
  gaps: {
    title: 'أكمل الحروف الناقصة',
    steps: [
      'ترى الكلمة وفيها حروف ناقصة.',
      'الناقص هو حروف العلة: a e i o u.',
      'اكتب الكلمة كاملة.',
    ],
  },
  dictation: {
    title: 'إملاء: اسمع واكتب',
    steps: [
      'تسمع الكلمة ولا تراها.',
      'اكتب ما سمعت.',
      'تستطيع أن تسمعها مرة أخرى، أو ببطء.',
    ],
  },
  recall: {
    title: 'من الذاكرة',
    steps: [
      'ترى المعنى بالعربية فقط.',
      'اكتب الكلمة بالإنجليزية.',
      'إن أخطأت، تأخذ مساعدة صغيرة ومحاولة ثانية.',
    ],
  },
};

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Spelling({ words, rounds, onProgress }: Props) {
  const tr = useT();
  const { say, supported } = useMySpeech();

  const [roundIdx, setRoundIdx] = useState(0);
  const [queue, setQueue] = useState<SpellWord[]>(words);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('intro');
  const [typed, setTyped] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<SpellResult | null>(null);

  /** Words that needed the answer shown, by round — each returns once */
  const [requeued, setRequeued] = useState<Set<number>>(new Set());
  const [missed, setMissed] = useState<Map<number, SpellWord>>(new Map());
  const [asked, setAsked] = useState(0);
  const [solved, setSolved] = useState(0);
  const [extra, setExtra] = useState(0);
  /** Items planned before requeues — every word once per round, or the retry list */
  const [planned, setPlanned] = useState(words.length * rounds.length);

  const input = useRef<HTMLInputElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);

  const round = rounds[roundIdx];
  const current = queue[index];
  const total = planned + extra;

  useEffect(() => {
    onProgress?.(Math.min(asked, total), total);
  }, [asked, total, onProgress]);

  // The ear round starts by speaking: there is nothing else on screen
  useEffect(() => {
    if (stage === 'ask' && round === 'dictation' && current && attempt === 0) {
      say(current.word);
    }
    if (stage === 'ask') input.current?.focus();
    if (stage === 'right') nextBtn.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, index, roundIdx]);

  const gaps = useMemo(() => (current ? vowelGaps(current.word) : ''), [current]);

  if (words.length === 0) return null;

  const startRound = () => {
    setStage('ask');
  };

  const advance = () => {
    setTyped('');
    setAttempt(0);
    setResult(null);
    setAsked((n) => n + 1);

    if (index + 1 < queue.length) {
      setIndex((i) => i + 1);
      setStage('ask');
      return;
    }

    if (roundIdx + 1 < rounds.length) {
      setRoundIdx((r) => r + 1);
      setQueue(shuffle(words));
      setIndex(0);
      setRequeued(new Set());
      setStage('intro');
      return;
    }

    setStage('done');
  };

  const check = () => {
    if (!current || typed.trim() === '') return;

    const r = checkSpelling(typed, current.word);
    setResult(r);

    if (r.verdict === 'right') {
      setSolved((n) => n + 1);
      setStage('right');
      say(current.word);
      return;
    }

    if (attempt === 0) {
      setAttempt(1);
      input.current?.select();
      return;
    }

    // Second miss: show the word, have it copied, bring it back later
    setStage('copy');
    setTyped('');
    say(current.word);
    setMissed((m) => new Map(m).set(current.id, current));

    if (!requeued.has(current.id)) {
      setRequeued((s) => new Set(s).add(current.id));
      setQueue((q) => [...q, current]);
      setExtra((n) => n + 1);
    }
  };

  const checkCopy = () => {
    if (!current) return;
    if (normalize(typed) === normalize(current.word)) advance();
    else input.current?.select();
  };

  const retryMissed = () => {
    const list = [...missed.values()];
    setQueue(shuffle(list));
    setIndex(0);
    setMissed(new Map());
    setRequeued(new Set());
    setAsked(0);
    setSolved(0);
    setExtra(0);
    setPlanned(list.length);
    setTyped('');
    setAttempt(0);
    setResult(null);
    setRoundIdx(rounds.length - 1);
    setStage('ask');
  };

  /* ---------- done ---------- */
  if (stage === 'done') {
    const percent = asked > 0 ? Math.round((solved / asked) * 100) : 0;
    const hard = [...missed.values()];

    return (
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
        <div
          className={`mx-auto grid h-20 w-20 place-items-center rounded-full text-xl font-bold ${
            percent >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {percent}%
        </div>

        <p className="mt-4 font-bold text-slate-900">
          {tr('كتبت :n من :total صحيحة', { n: solved, total: asked })}
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-600">
          {percent >= 80
            ? tr('ممتاز. الهدف 80٪ وقد وصلت إليه.')
            : tr('الهدف 80٪. أعد الكلمات الصعبة مرة واحدة قبل أن تنتقل.')}
        </p>

        {hard.length > 0 && (
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-start">
            <p className="mb-2 text-sm font-semibold text-slate-800">
              {tr('كلمات تحتاج انتباهاً')}
            </p>
            <ul className="space-y-1.5">
              {hard.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-600">{w.arabic}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900" dir="ltr">{w.word}</span>
                    <Listen text={w.word} size="sm" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hard.length > 0 && (
          <button
            onClick={retryMissed}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5
                       text-sm font-medium text-white transition hover:bg-violet-700"
          >
            <RotateCcw aria-hidden size={15} />
            {tr('أعد الكلمات الصعبة')} ({hard.length})
          </button>
        )}
      </div>
    );
  }

  /* ---------- round intro ---------- */
  if (stage === 'intro') {
    const info = ROUNDS[round];

    return (
      <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
        <p className="text-xs font-medium text-violet-600">
          {tr('الجولة :n من :total', { n: roundIdx + 1, total: rounds.length })}
        </p>
        <p className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900">
          <PenLine aria-hidden size={18} className="text-violet-600" />
          {tr(info.title)}
        </p>

        <ol className="mt-4 space-y-2">
          {info.steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                {i + 1}
              </span>
              <span>{tr(s)}</span>
            </li>
          ))}
        </ol>

        {roundIdx === 0 && (
          <p className="mt-4 rounded-xl bg-violet-50 p-3 text-sm leading-relaxed text-violet-900">
            {tr('لماذا الكتابة؟ لأنك تبني الجملة من كلمات تعرف حروفها. من يعرف الكلمة بأذنه فقط يتوقّف عندما يكتب.')}
          </p>
        )}

        <button
          onClick={startRound}
          className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white
                     transition hover:bg-slate-800"
        >
          {tr('ابدأ')} · {queue.length} {tr('كلمة')}
        </button>
      </div>
    );
  }

  if (!current) return null;

  const tone =
    stage === 'right' ? 'right' : stage === 'copy' ? 'idle' : result && attempt > 0 ? 'wrong' : 'idle';

  /* ---------- one word ---------- */
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
      <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
        <span className="font-medium text-violet-700">{tr(ROUNDS[round].title)}</span>
        <span dir="ltr">
          {index + 1} / {queue.length}
        </span>
      </div>

      {/* The prompt — what the round gives as support */}
      <div className="rounded-xl bg-slate-50 p-5 text-center">
        {(round !== 'dictation' || stage !== 'ask') && (
          <p className="text-2xl font-bold text-slate-900">{current.arabic}</p>
        )}

        {round === 'gaps' && stage === 'ask' && (
          <div className="mt-4 flex flex-wrap justify-center gap-1" dir="ltr">
            {[...gaps].map((ch, i) =>
              ch === ' ' ? (
                <span key={i} className="w-3" />
              ) : (
                <span
                  key={i}
                  className={`grid h-11 w-9 place-items-center rounded-lg text-xl font-bold ${
                    ch === '_'
                      ? 'border-2 border-dashed border-violet-300 bg-white text-transparent'
                      : 'bg-white text-slate-800 ring-1 ring-slate-200'
                  }`}
                >
                  {ch === '_' ? '·' : ch}
                </span>
              ),
            )}
          </div>
        )}

        {round === 'dictation' && stage === 'ask' && (
          <div className="flex flex-col items-center gap-3">
            <Ear aria-hidden size={32} strokeWidth={1.5} className="text-violet-500" />
            <div className="flex gap-2">
              <button
                onClick={() => say(current.word)}
                disabled={!supported}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm
                           font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                <Volume2 aria-hidden size={16} /> {tr('اسمع')}
              </button>
              <button
                onClick={() => say(current.word, { slow: true })}
                disabled={!supported}
                className="rounded-xl bg-white px-4 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200
                           transition hover:ring-slate-300 disabled:opacity-50"
              >
                {tr('ببطء')}
              </button>
            </div>
            {!supported && (
              <p className="text-sm text-amber-700">
                {tr('متصفّحك لا ينطق الكلمات. هذا هو المعنى:')} {current.arabic}
              </p>
            )}
          </div>
        )}

        {/* Sound is support in the gap round from the start, and in recall after a miss */}
        {stage === 'ask' && (round === 'gaps' || (round === 'recall' && attempt > 0)) && (
          <div className="mt-3 flex justify-center">
            <Listen text={current.word} label={tr('اسمعها')} size="sm" />
          </div>
        )}

        {/* After a miss: what was right in the attempt, and the pattern behind it */}
        {stage === 'ask' && attempt > 0 && result && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-slate-500">{tr('ما كتبته:')}</p>
            <div className="flex justify-center">
              <SpellMarks marks={result.attemptMarks} size="md" />
            </div>
            <p className="text-sm leading-relaxed text-rose-700">
              {result.hint ??
                (round === 'recall'
                  ? tr('تبدأ بالحرف :first وفيها :n حروف. حاول مرة أخرى.', {
                      first: current.word.charAt(0),
                      n: current.word.replace(/[^a-z]/gi, '').length,
                    })
                  : tr('الحروف الحمراء ليست في مكانها. حاول مرة أخرى.'))}
            </p>
          </div>
        )}

        {/* Revealed: the word, with the letters that were missed in colour */}
        {(stage === 'right' || stage === 'copy') && result && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-center gap-2">
              {stage === 'right' ? (
                <p className="text-3xl font-bold text-emerald-700" dir="ltr">{current.word}</p>
              ) : (
                <SpellMarks marks={result.marks} />
              )}
              <Listen text={current.word} size="sm" />
            </div>
            {current.ipa && (
              <p className="font-mono text-sm text-slate-500" dir="ltr">{current.ipa}</p>
            )}
            {stage === 'right' && result.note && (
              <p className="text-sm text-amber-800">{result.note}</p>
            )}
            {stage === 'copy' && (
              <p className="text-sm leading-relaxed text-slate-700">
                {tr('انظر إلى الحروف الملوّنة. الآن اكتب الكلمة مرة واحدة وأنت تنظر إليها.')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* The answer */}
      <div className="mt-4 space-y-3">
        {stage === 'right' ? (
          <div className="flex items-center gap-3">
            <p className="flex flex-1 items-center gap-1.5 text-sm font-semibold text-emerald-700">
              <Check aria-hidden size={18} />
              {attempt === 0 ? tr('صحيحة من أول مرة') : tr('صحيحة في المحاولة الثانية')}
            </p>
            <button
              ref={nextBtn}
              onClick={advance}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-xl bg-slate-900 px-6 text-sm
                         font-semibold text-white transition hover:bg-slate-800"
            >
              {tr('التالي')} <ArrowLeft aria-hidden size={15} />
            </button>
          </div>
        ) : (
          <>
            <SpellInput
              ref={input}
              value={typed}
              onChange={setTyped}
              onSubmit={stage === 'copy' ? checkCopy : check}
              tone={tone}
            />
            <button
              onClick={stage === 'copy' ? checkCopy : check}
              disabled={typed.trim() === ''}
              className="min-h-12 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white
                         transition hover:bg-slate-800 disabled:opacity-40"
            >
              {stage === 'copy' ? tr('كتبتها') : tr('تحقّق')}
            </button>
          </>
        )}
      </div>

      {stage === 'ask' && attempt === 0 && round !== 'dictation' && (
        <p className="mt-3 text-center text-sm text-slate-400">
          {tr('المحاولة الأولى. عندك محاولتان قبل أن تظهر الكلمة.')}
        </p>
      )}

      {stage === 'copy' && (
        <p className="mt-3 text-center text-sm text-slate-400">
          <Bdi>{current.word}</Bdi> {tr('سترجع إليك في آخر الجولة.')}
        </p>
      )}
    </div>
  );
}
