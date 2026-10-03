import { Ear, RotateCcw, Timer, Trophy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMySpeech } from '@/hooks/useSpeech';
import { track } from '@/lib/tracker';
import { useT } from '@/lib/i18n';

/**
 * Echo — hear one word of a pair, tap which it was, faster each time.
 *
 * The same skill as the minimal-pair game in the lessons, taken out
 * of the lesson and put against a clock: discrimination has to
 * become a reflex before production can follow (§2.4, listening
 * before producing).
 *
 * ── One contrast per round ──────────────────────────────────
 * The learner chooses a group and the round stays inside it.
 * Mixing /ɪ/, /ʊ/ and /æ/ in one round is what §8.2 of the book
 * says makes the test impossible — so the game cannot do it.
 *
 * ── Three lives, not a clock ────────────────────────────────
 * Speech synthesis takes a variable moment to start, so a timer
 * would punish the browser rather than the ear. The round ends on
 * the third miss; the speed is in the gap between words, which
 * shrinks as the streak grows.
 */

export interface EchoGroup {
  label_en: string;
  label_ar: string | null;
  ipa: string | null;
  pairs: [string, string][];
}

const LIVES = 3;

type Phase = 'ready' | 'playing' | 'over';

interface Q {
  pair: [string, string];
  spoken: 0 | 1;
}

export default function Echo({
  groups,
  best = 0,
  onFinish,
}: {
  groups: EchoGroup[];
  best?: number;
  onFinish?: (score: number) => void;
}) {
  const tr = useT();
  const { say, supported } = useMySpeech();

  const [phase, setPhase] = useState<Phase>('ready');
  const [group, setGroup] = useState(0);
  const [q, setQ] = useState<Q | null>(null);
  const [lives, setLives] = useState(LIVES);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState<{ right: boolean; word: string } | null>(null);
  const [missed, setMissed] = useState<string[]>([]);

  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  const g = groups[group];

  const ask = useCallback(() => {
    const pair = g.pairs[Math.floor(Math.random() * g.pairs.length)];
    const spoken = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
    setQ({ pair, spoken });
    setFlash(null);
    say(pair[spoken]);
  }, [g, say]);

  useEffect(() => {
    if (phase === 'over') onFinish?.(score);
  }, [phase, score, onFinish]);

  if (!supported) return null;

  const start = () => {
    setLives(LIVES);
    setScore(0);
    setStreak(0);
    setMissed([]);
    setPhase('playing');
    ask();
  };

  const answer = (i: 0 | 1) => {
    if (!q || flash) return;

    const right = i === q.spoken;
    const word = q.pair[q.spoken];
    track('game_answer', 'echo:' + g.label_en, right ? 1 : 0);

    if (right) {
      setScore((s) => s + 10 + streak);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
      setMissed((m) => (m.includes(q.pair.join(' / ')) ? m : [...m, q.pair.join(' / ')]));
    }

    const livesLeft = right ? lives : lives - 1;
    setLives(livesLeft);
    setFlash({ right, word });

    // The gap shrinks with the streak: 1.2s down to 0.5s
    const gap = right ? Math.max(500, 1200 - streak * 70) : 1600;
    timer.current = window.setTimeout(() => {
      if (livesLeft <= 0) setPhase('over');
      else ask();
    }, gap);
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
            {record && (
              <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">
                {tr('رقم قياسي جديد! السابق :n', { n: best })}
              </p>
            )}
            {missed.length > 0 && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-start">
                <p className="text-sm font-semibold text-slate-800">{tr('الأزواج التي خلطت بينها')}</p>
                <ul dir="ltr" className="mt-1 flex flex-wrap gap-2">
                  {missed.map((m) => (
                    <li key={m} className="rounded-md bg-white px-2 py-0.5 text-sm text-slate-700 ring-1 ring-slate-200">
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            <Ear aria-hidden size={36} strokeWidth={1.5} className="mx-auto text-rose-600" />
            <h2 className="mt-3 text-lg font-bold text-slate-900">{tr('صدى')}</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-700">
              {tr('تسمع كلمة من كلمتين متشابهتين. اضغط التي سمعتها. ولك ثلاث محاولات خاطئة فقط.')}
            </p>
          </>
        )}

        {/* One contrast per round — the learner picks which */}
        <label className="mt-4 block text-start text-sm font-semibold text-slate-700">
          {tr('اختر الصوتين:')}
          <select
            value={group}
            onChange={(e) => setGroup(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border-slate-300 text-sm"
          >
            {groups.map((x, i) => (
              <option key={x.label_en} value={i}>
                {(x.label_ar ?? x.label_en) + (x.ipa ? '  ' + x.ipa : '')}
              </option>
            ))}
          </select>
        </label>

        {best > 0 && !record && (
          <p className="mt-4 text-sm font-semibold text-rose-700">{tr('أفضل نتيجة لك: :n', { n: best })}</p>
        )}

        <button
          onClick={start}
          className="mt-5 w-full rounded-xl bg-rose-600 py-3.5 text-sm font-semibold text-white transition hover:bg-rose-700"
        >
          {phase === 'over' ? tr('مرة أخرى') : tr('ابدأ')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <span aria-label={tr('المحاولات الباقية')} className="text-base">
          {'❤️'.repeat(lives) + '🤍'.repeat(LIVES - lives)}
        </span>
        <span className="text-sm text-slate-500" dir="ltr">{g.ipa}</span>
        <span className="text-sm font-bold tabular-nums text-slate-900">{score}</span>
      </div>

      <div className="grid min-h-24 place-items-center px-5 pt-6" aria-live="polite">
        {flash ? (
          <p className={`text-lg font-bold ${flash.right ? 'text-emerald-700' : 'text-rose-700'}`}>
            {flash.right ? '✓' : '✗'} <span dir="ltr">{flash.word}</span>
          </p>
        ) : (
          <button
            onClick={() => q && say(q.pair[q.spoken])}
            className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            <RotateCcw size={16} aria-hidden />
            {tr('أعد السماع')}
          </button>
        )}
      </div>

      <div dir="ltr" className="grid grid-cols-2 gap-3 p-5">
        {q?.pair.map((w, i) => (
          <button
            key={w + i}
            onClick={() => answer(i as 0 | 1)}
            disabled={!!flash}
            className="rounded-xl border-2 border-slate-200 bg-slate-50 py-5 text-xl font-bold
                       text-slate-900 transition hover:bg-slate-100 active:scale-[.98] disabled:opacity-50"
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}
