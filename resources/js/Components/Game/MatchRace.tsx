import { Timer, Trophy, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMySpeech } from '@/hooks/useSpeech';
import { useT } from '@/lib/i18n';

/**
 * Match Race — Duolingo's "Match Madness", on the learner's words.
 *
 * Five Arabic meanings, five English words, sixty seconds. Every pair
 * found is replaced at once, so the board never empties and the pace
 * is the game.
 *
 * Arabic is picked first and English second: §2.4's productive
 * direction, meaning → word.
 *
 * The words are already the learner's (they reach the flashcards as
 * props), so there is no hidden answer here and matching on the
 * client gives nothing away. Only the score goes to the server.
 */

export interface RaceWord {
  id: number;
  word: string;
  arabic: string;
}

const ROUND_SECONDS = 60;
const BOARD = 5;
const STREAK_STEP = 4;
const MAX_MULTIPLIER = 4;

function shuffled<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

/** Drop words whose meaning repeats — two identical Arabic tiles would make a right answer look wrong */
function dedupe(words: RaceWord[]): RaceWord[] {
  const seen = new Set<string>();

  return words.filter((w) => {
    const k = w.arabic.trim();
    if (seen.has(k) || seen.has('en:' + w.word)) return false;
    seen.add(k);
    seen.add('en:' + w.word);

    return true;
  });
}

type Phase = 'ready' | 'playing' | 'over';

export default function MatchRace({
  words,
  best = 0,
  onFinish,
}: {
  words: RaceWord[];
  best?: number;
  onFinish?: (score: number) => void;
}) {
  const tr = useT();
  const { say } = useMySpeech();

  const [phase, setPhase] = useState<Phase>('ready');
  const [deck, setDeck] = useState<RaceWord[]>([]);
  const [next, setNext] = useState(0);
  /** Two columns of slots; each slot holds a word id, the columns ordered independently */
  const [right, setRight] = useState<number[]>([]);
  const [left, setLeft] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);
  const [secs, setSecs] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hits, setHits] = useState(0);

  const byId = new Map(deck.map((w) => [w.id, w]));
  const multiplier = Math.min(1 + Math.floor(streak / STREAK_STEP), MAX_MULTIPLIER);

  useEffect(() => {
    if (phase !== 'playing') return;

    const id = window.setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          setPhase('over');

          return 0;
        }

        return s - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === 'over') onFinish?.(score);
  }, [phase, score, onFinish]);

  const start = () => {
    const d = shuffled(dedupe(words));
    const first = d.slice(0, BOARD).map((w) => w.id);

    setDeck(d);
    setNext(BOARD);
    setRight(shuffled(first));
    setLeft(shuffled(first));
    setPicked(null);
    setWrong(null);
    setSecs(ROUND_SECONDS);
    setScore(0);
    setStreak(0);
    setHits(0);
    setPhase('playing');
  };

  const pickEnglish = (id: number) => {
    if (picked === null) return;

    if (id !== picked) {
      setWrong(id);
      setStreak(0);
      window.setTimeout(() => setWrong(null), 350);

      return;
    }

    say(byId.get(id)!.word);
    setScore((s) => s + 10 * multiplier);
    setStreak((s) => s + 1);
    setHits((h) => h + 1);

    /*
     * The new pair lands in the two freed slots — but the same row on
     * both sides would hand over the answer, so the English side is
     * swapped with a random other slot.
     */
    // Skip anything still on the board once the deck wraps
    let n = next;
    while (right.includes(deck[n % deck.length].id) && deck[n % deck.length].id !== id) n++;
    const fresh = deck[n % deck.length].id;
    setNext(n + 1);
    setRight((r) => r.map((x) => (x === id ? fresh : x)));
    setLeft((l) => {
      const out = l.map((x) => (x === id ? fresh : x));
      const a = out.indexOf(fresh);
      const b = Math.floor(Math.random() * out.length);
      [out[a], out[b]] = [out[b], out[a]];

      return out;
    });
    setPicked(null);
  };

  if (phase !== 'playing') {
    const record = phase === 'over' && score > best;

    return (
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
        {phase === 'over' ? (
          <>
            {record ? (
              <Trophy aria-hidden size={36} strokeWidth={1.5} className="mx-auto text-amber-500" />
            ) : (
              <Timer aria-hidden size={36} strokeWidth={1.5} className="mx-auto text-slate-500" />
            )}
            <p className="mt-2 text-4xl font-bold tabular-nums text-slate-900">{score}</p>
            <p className="mt-1 text-sm text-slate-500">{tr('وصلت :n زوجاً', { n: hits })}</p>
            {record && (
              <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-800">
                {tr('رقم قياسي جديد! السابق :n', { n: best })}
              </p>
            )}
          </>
        ) : (
          <>
            <Zap aria-hidden size={36} strokeWidth={1.5} className="mx-auto text-sky-600" />
            <h2 className="mt-3 text-lg font-bold text-slate-900">{tr('سباق الأزواج')}</h2>
            <ol className="mx-auto mt-4 max-w-xs space-y-2 text-start">
              {[
                'اضغط المعنى العربي، ثم كلمته الإنجليزية.',
                'كل زوج تجده يحلّ مكانه زوج جديد.',
                'أمامك ستّون ثانية. وكل أربع إجابات متتالية ترفع نقاطك.',
              ].map((line, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{tr(line)}</span>
                </li>
              ))}
            </ol>
          </>
        )}

        {best > 0 && !record && (
          <p className="mt-4 text-sm font-semibold text-sky-700">{tr('أفضل نتيجة لك: :n', { n: best })}</p>
        )}

        <button
          onClick={start}
          className="mt-5 w-full rounded-xl bg-sky-600 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          {phase === 'over' ? tr('مرة أخرى') : tr('ابدأ')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <span className={`text-sm font-bold tabular-nums ${secs <= 10 ? 'text-rose-600' : 'text-slate-700'}`}>
          {secs}
          <span className="ms-1 text-sm font-normal text-slate-400">{tr('ث')}</span>
        </span>
        {multiplier > 1 && (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">×{multiplier}</span>
        )}
        <span className="text-sm font-bold tabular-nums text-slate-900">{score}</span>
      </div>

      <div className="h-1 bg-slate-100">
        <div
          className={`h-full transition-[width] duration-1000 ease-linear ${secs <= 10 ? 'bg-rose-500' : 'bg-sky-500'}`}
          style={{ width: `${(secs / ROUND_SECONDS) * 100}%` }}
        />
      </div>

      {/* In RTL the first column sits on the right: Arabic there, English on the left */}
      <div className="grid grid-cols-2 gap-3 p-5">
        <div className="space-y-2">
          {right.map((id) => (
            <button
              key={'ar' + id}
              onClick={() => setPicked(id)}
              className={`min-h-12 w-full rounded-xl border-2 px-2 py-2 text-base font-semibold transition ${
                picked === id
                  ? 'border-sky-500 bg-sky-50 text-sky-900'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
              }`}
            >
              {byId.get(id)?.arabic}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {left.map((id) => (
            <button
              key={'en' + id}
              onClick={() => pickEnglish(id)}
              disabled={picked === null}
              dir="ltr"
              className={`min-h-12 w-full rounded-xl border-2 px-2 py-2 text-base font-semibold transition disabled:opacity-60 ${
                wrong === id
                  ? 'border-rose-400 bg-rose-50 text-rose-800'
                  : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300'
              }`}
            >
              {byId.get(id)?.word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
