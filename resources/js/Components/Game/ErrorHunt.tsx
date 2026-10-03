import { Crosshair, Timer, Trophy } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COMMON_ERRORS, type CommonError } from '@/lib/commonErrors';
import { track } from '@/lib/tracker';
import { useT } from '@/lib/i18n';

/**
 * Error Hunt — sixty seconds against the twenty mistakes.
 *
 * ── Why this game and not a word game ───────────────────────
 * §2.5 tracks twenty mistakes an Arabic speaker makes in English,
 * and §1 says every exercise in the course must serve one of them.
 * They are the difference between understandable and native, and
 * the only way they stop happening is for the judgement to become
 * automatic — which is a reflex, not a rule you recall.
 *
 * A drill teaches the rule. A timer teaches the reflex.
 *
 * ── Why it is a game and not a task ────────────────────────
 * §1 is explicit that this is a course, not a games app. So this
 * belongs to the Break Time family: it is counted and never
 * required — it closes no day, breaks no streak, and adds nothing
 * to the progress percentage. Somebody who never opens it has lost
 * nothing.
 *
 * What it buys instead is the day nobody plans to study. Thirty
 * seconds on a bus is a session, and §10's governing question —
 * does the learner come back on day two — is still unanswered.
 *
 * ── And it ends as a diagnosis ──────────────────────────────
 * A score alone is entertainment. The final screen names the
 * mistakes that actually caught them, with the rule for each, so a
 * round leaves something behind.
 */

const ROUND_SECONDS = 60;

/** Right answers needed to raise the multiplier one step */
const STREAK_STEP = 3;
const MAX_MULTIPLIER = 5;

/** How long the correction stays on screen after a miss */
const TEACH_MS = 1500;

interface Card {
  error: CommonError;
  /** Whether the sentence shown is the wrong one or the fixed one */
  broken: boolean;
  sentence: string;
}

/** Fisher–Yates: a fresh order every round, so the answers can't be memorised */
function shuffled<T>(list: T[]): T[] {
  const out = [...list];

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

/**
 * A deck twice the length of the error list.
 *
 * Every mistake appears once broken and once fixed, so the answer
 * cannot be guessed from the sentence being familiar — only from
 * reading it.
 */
function buildDeck(): Card[] {
  const cards = COMMON_ERRORS.flatMap((error) => [
    { error, broken: true, sentence: error.wrong },
    { error, broken: false, sentence: error.right },
  ]);

  return shuffled(cards);
}

type Phase = 'ready' | 'playing' | 'over';

export default function ErrorHunt({
  best = 0,
  onFinish,
}: {
  /** Their own record, from the server — there is no leaderboard */
  best?: number;
  onFinish?: (score: number) => void;
}) {
  const tr = useT();

  const [phase, setPhase] = useState<Phase>('ready');
  const [deck, setDeck] = useState<Card[]>(() => buildDeck());
  const [at, setAt] = useState(0);
  const [left, setLeft] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hits, setHits] = useState(0);
  const [teach, setTeach] = useState<Card | null>(null);
  /** Which mistakes caught them — the diagnosis at the end */
  const [missed, setMissed] = useState<CommonError[]>([]);

  const teachTimer = useRef<number | null>(null);

  const card = deck[at % deck.length];
  const multiplier = Math.min(1 + Math.floor(streak / STREAK_STEP), MAX_MULTIPLIER);

  /* The clock. One interval, cleared on every exit path. */
  useEffect(() => {
    if (phase !== 'playing') return;

    const id = window.setInterval(() => {
      setLeft((s) => {
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

  /* Report the score once, when the round is actually over */
  useEffect(() => {
    if (phase === 'over') onFinish?.(score);
  }, [phase, score, onFinish]);

  useEffect(
    () => () => {
      if (teachTimer.current) window.clearTimeout(teachTimer.current);
    },
    [],
  );

  const start = () => {
    setDeck(buildDeck());
    setAt(0);
    setLeft(ROUND_SECONDS);
    setScore(0);
    setStreak(0);
    setHits(0);
    setMissed([]);
    setTeach(null);
    setPhase('playing');
  };

  const answer = useCallback(
    (saidBroken: boolean) => {
      if (phase !== 'playing' || teach) return;

      const right = saidBroken === card.broken;

      /*
       * Each answer is logged against the error it tests, not just
       * the round's final score.
       *
       * The twenty errors are the spine of the whole course, and the
       * game is the only place that asks about all of them in one
       * sitting. Without this the round teaches for four seconds and
       * forgets — with it, the learner ends up with a record of which
       * of the twenty actually catch them, which is the thing worth
       * keeping.
       */
      track('game_answer', 'error:' + String(card.error.no).padStart(2, '0'), right ? 1 : 0);

      if (right) {
        setScore((s) => s + 10 * multiplier);
        setStreak((s) => s + 1);
        setHits((h) => h + 1);
        setAt((i) => i + 1);

        return;
      }

      /*
       * A miss stops the clock's flow for a moment and shows the
       * correction. This is the only teaching this game does, and it
       * is the reason the round is worth playing rather than just
       * scoring — so it is not skippable.
       */
      setStreak(0);
      setMissed((m) => (m.some((e) => e.no === card.error.no) ? m : [...m, card.error]));
      setTeach(card);

      teachTimer.current = window.setTimeout(() => {
        setTeach(null);
        setAt((i) => i + 1);
      }, TEACH_MS);
    },
    [phase, teach, card, multiplier],
  );

  /* Keyboard for desktop: the arrows sit where the buttons do in RTL */
  useEffect(() => {
    if (phase !== 'playing') return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === '1') answer(false);
      if (e.key === 'ArrowLeft' || e.key === '2') answer(true);
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [phase, answer]);

  /* ───────────── Before the round ───────────── */
  if (phase === 'ready') {
    return (
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
        <Crosshair aria-hidden size={36} strokeWidth={1.5} className="mx-auto text-violet-600" />

        <h2 className="mt-3 text-lg font-bold text-slate-900">{tr('صيد الخطأ')}</h2>

        {/*
          Three lines, not one sentence.

          The rules used to be a single compound sentence in formal
          Arabic. A beginner reads that twice or skips it — and the
          screen exists to be understood in one pass. The reasoning
          stays here in the comment; the screen stays plain.
        */}
        <ol className="mx-auto mt-4 max-w-xs space-y-2 text-start">
          {[
            'تظهر لك جملة إنجليزية.',
            'اضغط «صحيحة» إن كانت سليمة، و«خاطئة» إن كان فيها خطأ.',
            'أمامك ستّون ثانية. وكلّ ثلاث إجابات صحيحة متتالية ترفع مضاعِف نقاطك.',
          ].map((line, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
              <span
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full
                           bg-violet-100 text-xs font-bold text-violet-700"
              >
                {i + 1}
              </span>
              <span className="leading-relaxed">{tr(line)}</span>
            </li>
          ))}
        </ol>

        <p className="mx-auto mt-4 max-w-sm rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          {tr('الجمل مأخوذة من عشرين خطأً يقع فيها المتحدّثون بالعربية. ومتى صارت ظاهرة لك لم تعد تقع فيها.')}
        </p>

        {best > 0 && (
          <p className="mt-4 text-sm font-semibold text-violet-700">
            {tr('أفضل نتيجة لك: :n', { n: best })}
          </p>
        )}

        <button
          onClick={start}
          className="mt-5 w-full rounded-xl bg-violet-600 py-3.5 text-sm font-semibold
                     text-white transition hover:bg-violet-700 active:scale-[.99]"
        >
          {tr('ابدأ')}
        </button>

        <p className="mt-3 text-xs text-slate-400">
          {tr('للتسلية فقط. لا يؤثّر على تقدّمك ولا على سلسلة أيامك.')}
        </p>
      </div>
    );
  }

  /* ───────────── After the round ───────────── */
  if (phase === 'over') {
    const record = score > best;

    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
          {record ? <Trophy aria-hidden size={36} strokeWidth={1.5} className="mx-auto text-amber-500" /> : <Timer aria-hidden size={36} strokeWidth={1.5} className="mx-auto text-slate-500" />}

          <p className="mt-2 text-4xl font-bold tabular-nums text-slate-900">{score}</p>

          <p className="mt-1 text-sm text-slate-500">
            {tr('أجبت :n إجابة صحيحة', { n: hits })}
          </p>

          {record ? (
            <p className="mt-3 rounded-xl bg-violet-50 p-3 text-sm font-semibold text-violet-800">
              {tr('رقم قياسي جديد! السابق :n', { n: best })}
            </p>
          ) : (
            best > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                {tr('أفضل نتيجة لك: :n', { n: best })}
              </p>
            )
          )}

          <button
            onClick={start}
            className="mt-5 w-full rounded-xl bg-violet-600 py-3.5 text-sm font-semibold
                       text-white transition hover:bg-violet-700"
          >
            {tr('مرة أخرى')}
          </button>
        </div>

        {/*
          The diagnosis. A score is entertainment; this is what makes
          the round worth having played.
        */}
        {missed.length > 0 && (
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <p className="text-sm font-bold text-slate-900">
              {tr('الأخطاء التي وقعت فيها')}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {tr('اقرأ قاعدة كل واحدة. هذه التي ستتكرّر معك.')}
            </p>

            <ul className="mt-3 space-y-2.5">
              {missed.map((e) => (
                <li key={e.no} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm" dir="ltr">
                    <span className="text-rose-700 line-through decoration-rose-300">
                      {e.wrong}
                    </span>
                    <span aria-hidden className="text-slate-400">→</span>
                    <span className="font-semibold text-emerald-800">{e.right}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    {tr(e.rule_ar)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  /* ───────────── The round ───────────── */
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200">
      {/* Clock, score, multiplier — the three numbers that matter */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <span
          className={`text-sm font-bold tabular-nums ${
            left <= 10 ? 'text-rose-600' : 'text-slate-700'
          }`}
        >
          {left}
          <span className="ms-1 text-xs font-normal text-slate-400">{tr('ث')}</span>
        </span>

        {multiplier > 1 && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
            ×{multiplier}
          </span>
        )}

        <span className="text-sm font-bold tabular-nums text-slate-900">{score}</span>
      </div>

      {/* The clock as a bar, so time is felt and not only read */}
      <div className="h-1 bg-slate-100">
        <div
          className={`h-full transition-[width] duration-1000 ease-linear ${
            left <= 10 ? 'bg-rose-500' : 'bg-violet-500'
          }`}
          style={{ width: `${(left / ROUND_SECONDS) * 100}%` }}
        />
      </div>

      {/* The sentence: English, so it reads left to right whatever the page does */}
      <div className="grid min-h-36 place-items-center px-5 py-8" aria-live="polite">
        {teach ? (
          <div className="text-center">
            <p className="text-sm text-rose-700 line-through decoration-rose-300" dir="ltr">
              {teach.error.wrong}
            </p>
            <p className="mt-1 text-lg font-bold text-emerald-800" dir="ltr">
              {teach.error.right}
            </p>
            <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-slate-600">
              {tr(teach.error.rule_ar)}
            </p>
          </div>
        ) : (
          <p
            className="text-center text-xl font-semibold leading-relaxed text-slate-900 sm:text-2xl"
            dir="ltr"
          >
            {card.sentence}
          </p>
        )}
      </div>

      {/* Both buttons in the thumb zone — 80% of learners are on a phone */}
      <div className="grid grid-cols-2 gap-3 p-5 pt-0">
        <button
          onClick={() => answer(false)}
          disabled={!!teach}
          className="rounded-xl border-2 border-emerald-200 bg-emerald-50 py-4 text-base
                     font-bold text-emerald-800 transition hover:bg-emerald-100
                     active:scale-[.98] disabled:opacity-40"
        >
          {tr('صحيحة')}
        </button>

        <button
          onClick={() => answer(true)}
          disabled={!!teach}
          className="rounded-xl border-2 border-rose-200 bg-rose-50 py-4 text-base
                     font-bold text-rose-800 transition hover:bg-rose-100
                     active:scale-[.98] disabled:opacity-40"
        >
          {tr('خاطئة')}
        </button>
      </div>
    </div>
  );
}
