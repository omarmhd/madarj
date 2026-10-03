import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Listen from '@/Components/Listen';
import { track } from '@/lib/tracker';
import { useT } from '@/lib/i18n';

/**
 * The review weeks' vocabulary test — section 2 of weeks 6, 12, 18.
 *
 * ── Why this is not the spaced review ───────────────────────
 * Every day of the review weeks already opens the FSRS session, and
 * that answers "what is due today". The book asks something else: can
 * you still produce these, and how fast — fifty words in five
 * minutes, eighty past forms in three, forty participles in two —
 * and it gates the next module on 80%. A learner who reached week 6
 * had no way to take that test at all.
 *
 * ── One screen, three prompts ──────────────────────────────
 * The list decides what is asked. Weeks 12 and 18 have a right
 * answer, so the word is said aloud and then revealed to check
 * against. Week 6 has none — the task is to say the word, its
 * meaning, and a sentence containing it — so there is nothing to
 * reveal and the learner is the only judge.
 *
 * ── Two buttons, and the clock does not stop you ────────────
 * Two buttons everywhere, as on every other card here. And the timer
 * counts up against the book's target rather than down to zero: a
 * test that cuts off mid-list turns a measurement into a punishment,
 * and the target is what the learner is aiming at, not a deadline.
 */

interface Word {
  prompt: string;
  answer: string | null;
  ipa: string | null;
  ours: boolean;
}

interface List {
  title_ar: string;
  title_en: string;
  task_ar: string;
  note_ar: string;
  minutes: number;
  ask: 'say' | 'past' | 'participle';
  words: Word[];
}

export interface WordTestPayload {
  span_ar: string;
  target_percent: number;
  seconds_per_word: number;
  method_ar: string[];
  gate_ar: string;
  list: List;
}

type Phase = 'idle' | 'running' | 'done';

export default function WordTest({ payload }: { payload: WordTestPayload }) {
  const tr = useT();
  const list = payload.list;

  const [phase, setPhase] = useState<Phase>('idle');
  const [queue, setQueue] = useState<Word[]>([]);
  const [at, setAt] = useState(0);
  const [shown, setShown] = useState(false);
  const [missed, setMissed] = useState<Word[]>([]);
  const [seconds, setSeconds] = useState(0);

  // The number asked in this round, kept because the queue is
  // consumed: a retest of eight words is scored out of eight
  const [asked, setAsked] = useState(0);
  const startedRef = useRef(0);

  /* The clock, running only while the test is */
  useEffect(() => {
    if (phase !== 'running') return;

    const id = window.setInterval(() => {
      setSeconds(Math.round((Date.now() - startedRef.current) / 1000));
    }, 1000);

    return () => window.clearInterval(id);
  }, [phase]);

  const target = list.minutes * 60;
  const over = seconds > target;
  const current = queue[at];

  const percent = asked ? Math.round(((asked - missed.length) / asked) * 100) : 0;
  const passed = percent >= payload.target_percent;

  const begin = (words: Word[]) => {
    setQueue(words);
    setAsked(words.length);
    setAt(0);
    setShown(false);
    setMissed([]);
    setSeconds(0);
    startedRef.current = Date.now();
    setPhase('running');
  };

  const judge = (said: boolean) => {
    const next = said ? missed : [...missed, current];
    if (!said) setMissed(next);

    if (at + 1 >= queue.length) {
      const score = Math.round(((queue.length - next.length) / queue.length) * 100);

      /*
       * Logged, not gated.
       *
       * The book gates the module on its whole test, of which this is
       * one part, so this score unlocks nothing. It goes to the event
       * log so the learner's own history keeps it — and the log is
       * allowed to lose an event, which is acceptable here only
       * because the result is on screen the moment it is earned.
       */
      // The week and day travel with every event from the page
      // context, so they are not repeated here
      track('word_test', list.ask, score, {
        total: queue.length,
        seconds: Math.round((Date.now() - startedRef.current) / 1000),
      });

      setPhase('done');
      return;
    }

    setAt(at + 1);
    setShown(false);
  };

  /* ── Before it starts ───────────────────────────────────── */
  if (phase === 'idle') {
    return (
      <div className="space-y-3">
        <Head list={list} />

        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <ol className="space-y-2 text-sm leading-relaxed text-slate-700">
            <Step n={1}>{tr('تظهر كلمة واحدة.')}</Step>
            <Step n={2}>{list.task_ar}</Step>
            <Step n={3}>
              {list.ask === 'say'
                ? tr('ثم تختار: قلتها أو لم أقُلها.')
                : tr('ثم تكشف الجواب وتقارنه بما قلته.')}
            </Step>
          </ol>

          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">
            {list.words.length} {tr('كلمة، والهدف')} {list.minutes} {tr('دقائق. الوقت يُحسب ولا يوقفك.')}
          </p>

          <button
            onClick={() => begin(list.words)}
            className="mt-4 w-full rounded-xl bg-violet-600 py-3 font-semibold text-white
                       transition hover:bg-violet-700"
          >
            {tr('ابدأ')}
          </button>
        </div>

        <Method payload={payload} tr={tr} />
      </div>
    );
  }

  /* ── After it ends ──────────────────────────────────────── */
  if (phase === 'done') {
    return (
      <div className="space-y-3">
        <Head list={list} />

        <div className="rounded-2xl bg-white p-5 text-center ring-1 ring-slate-200">
          <p
            className={`text-4xl font-bold ${passed ? 'text-emerald-600' : 'text-amber-600'}`}
            dir="ltr"
          >
            {percent}%
          </p>

          <p className="mt-1 text-sm text-slate-600">
            {tr('قلت')} {asked - missed.length} {tr('من')} {asked}
            {' · '}
            {mmss(seconds)} {tr('والهدف')} {mmss(target)}
          </p>

          <p
            className={`mt-3 rounded-lg p-3 text-sm leading-relaxed ${
              passed ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'
            }`}
          >
            {passed
              ? tr('بلغت الهدف. هذه الكلمات جاهزة عندك.')
              : payload.gate_ar}
          </p>

          {missed.length > 0 && (
            <div className="mt-4 text-start">
              <p className="text-sm font-semibold text-slate-700">
                {tr('لم تخرج منك')} ({missed.length})
              </p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {missed.map((w, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-800 ring-1 ring-rose-100"
                    dir="ltr"
                  >
                    {w.prompt}
                    {w.answer && <span className="text-rose-400"> → {w.answer}</span>}
                  </span>
                ))}
              </div>

              {/* The book's own next step: retest the marked words only */}
              <button
                onClick={() => begin(missed)}
                className="mt-4 w-full rounded-xl bg-violet-600 py-3 font-semibold text-white
                           transition hover:bg-violet-700"
              >
                {tr('أعِد الفائت وحده')} ({missed.length})
              </button>
            </div>
          )}

          <button
            onClick={() => begin(list.words)}
            className="mt-2 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700
                       transition hover:bg-slate-200"
          >
            {tr('أعِد القائمة كلها')}
          </button>
        </div>

        <Method payload={payload} tr={tr} />
      </div>
    );
  }

  /* ── While it runs ──────────────────────────────────────── */
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5 ring-1 ring-slate-200">
        <span className="text-xs font-medium text-slate-500" dir="ltr">
          {at + 1} / {queue.length}
        </span>

        <span
          className={`font-mono text-sm font-bold ${over ? 'text-amber-600' : 'text-slate-700'}`}
          dir="ltr"
        >
          {mmss(seconds)}
        </span>
      </div>

      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
        <p className="text-3xl font-bold text-slate-900" dir="ltr">
          {current.prompt}
        </p>

        {current.ipa && (
          <p className="mt-1 text-xs text-slate-400" dir="ltr">
            {current.ipa}
          </p>
        )}

        <div className="mt-3 flex justify-center">
          <Listen text={current.prompt} size="sm" />
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">{list.task_ar}</p>

        {/* Modes with a right answer: say it first, then check */}
        {current.answer && (
          <div className="mt-4">
            {shown ? (
              <p className="rounded-xl bg-violet-50 py-3 text-xl font-bold text-violet-900" dir="ltr">
                {current.answer}
              </p>
            ) : (
              <button
                onClick={() => setShown(true)}
                className="w-full rounded-xl bg-slate-100 py-3 font-medium text-slate-700
                           transition hover:bg-slate-200"
              >
                {tr('أظهر الجواب')}
              </button>
            )}
          </div>
        )}
      </div>

      {(!current.answer || shown) && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => judge(false)}
            className="rounded-xl bg-white py-3.5 font-semibold text-rose-700 ring-1 ring-rose-200
                       transition hover:bg-rose-50"
          >
            {tr('لم أقُلها')}
          </button>

          <button
            onClick={() => judge(true)}
            className="rounded-xl bg-emerald-600 py-3.5 font-semibold text-white
                       transition hover:bg-emerald-700"
          >
            {tr('قلتها')}
          </button>
        </div>
      )}
    </div>
  );
}

/** mm:ss — a bare number of seconds is unreadable past a minute */
function mmss(s: number): string {
  return String(Math.floor(s / 60)) + ':' + String(s % 60).padStart(2, '0');
}

function Head({ list }: { list: List }) {
  return (
    <div className="rounded-2xl bg-violet-50/60 p-4 ring-1 ring-violet-100">
      <p className="font-semibold text-violet-950">{list.title_ar}</p>

      <p className="mt-0.5 text-xs text-violet-400" dir="ltr">
        {list.title_en}
      </p>

      <p className="mt-1.5 text-sm leading-relaxed text-violet-900">{list.note_ar}</p>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md
                   bg-violet-100 text-xs font-bold text-violet-700"
      >
        {n}
      </span>
      <span className="flex-1">{children}</span>
    </li>
  );
}

/**
 * The other test, section 2.2.
 *
 * It runs over the weeks' own vocabulary cards rather than on this
 * screen, so it is written out as instructions and folded away — it
 * is read once, not worked through here.
 */
function Method({
  payload,
  tr,
}: {
  payload: WordTestPayload;
  tr: (s: string) => string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 p-4 text-start transition hover:bg-slate-50"
      >
        <span className="flex-1 text-sm font-semibold text-slate-800">
          {tr('واختبار كل كلمات')} {payload.span_ar}
        </span>
        <span aria-hidden className="text-slate-400">
          {open ? <ChevronUp aria-hidden size={16} /> : <ChevronDown aria-hidden size={16} />}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4">
          <ol className="space-y-2 text-sm leading-relaxed text-slate-700">
            {payload.method_ar.map((step, i) => (
              <Step key={i} n={i + 1}>
                {step}
              </Step>
            ))}
          </ol>

          <p className="mt-3 rounded-lg border-s-4 border-amber-400 bg-amber-50/70 p-3 text-sm leading-relaxed text-amber-900">
            {payload.gate_ar}
          </p>
        </div>
      )}
    </div>
  );
}
