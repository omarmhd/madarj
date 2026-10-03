import { CalendarCheck, Delete, Trophy } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useMySpeech } from '@/hooks/useSpeech';
import { useT } from '@/lib/i18n';

/**
 * Word of the Day — Wordle, on the learner's own vocabulary.
 *
 * ── Why this game ───────────────────────────────────────────
 * §10's governing question is whether anyone comes back on day two.
 * Wordle's whole trick is one puzzle a day: it cannot be binged, so
 * the only way to play again is to come back tomorrow.
 *
 * ── Why the hint is Arabic ──────────────────────────────────
 * §2.4: Arabic first, English produced. The learner is shown the
 * meaning and has to build the word — spelling, not guessing.
 *
 * ── Who judges ──────────────────────────────────────────────
 * The server. The secret word never reaches the browser until the
 * day is over (§4.4), so every guess is a POST and the marks come
 * back with it.
 */

export interface WordleGuess {
  guess: string;
  /** 2 = right place, 1 = elsewhere in the word, 0 = absent */
  marks: number[];
}

export interface WordleState {
  length: number;
  tries: number;
  hint_ar: string;
  guesses: WordleGuess[];
  solved: boolean;
  over: boolean;
  answer: string | null;
}

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const TILE = ['bg-slate-400 text-white', 'bg-amber-500 text-white', 'bg-emerald-600 text-white'];

export default function WordOfDay({
  initial,
  onDone,
}: {
  initial: WordleState;
  onDone?: () => void;
}) {
  const tr = useT();
  const { say } = useMySpeech();

  const [state, setState] = useState(initial);

  // A fresh `initial` from the server (a reload) replaces the local copy
  useEffect(() => setState(initial), [initial]);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  /* Best mark each letter has earned so far — colours the keyboard */
  const keyMarks: Record<string, number> = {};
  state.guesses.forEach((g) =>
    g.guess.split('').forEach((ch, i) => {
      keyMarks[ch] = Math.max(keyMarks[ch] ?? -1, g.marks[i]);
    }),
  );

  const submit = useCallback(() => {
    if (busy || state.over) return;

    if (typed.length !== state.length) {
      setShake(true);
      window.setTimeout(() => setShake(false), 400);

      return;
    }

    setBusy(true);
    axios
      .post('/play/wordle', { guess: typed })
      .then(({ data }) => {
        setState(data.wordle);
        setTyped('');
        if (data.wordle.over) {
          if (data.wordle.answer) say(data.wordle.answer);
          onDone?.();
        }
      })
      .catch(() => {
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
      })
      .finally(() => setBusy(false));
  }, [busy, state, typed, say, onDone]);

  const press = useCallback(
    (key: string) => {
      if (state.over || busy) return;
      if (key === 'enter') return submit();
      if (key === 'back') return setTyped((t) => t.slice(0, -1));
      if (/^[a-z]$/.test(key)) setTyped((t) => (t.length < state.length ? t + key : t));
    },
    [state, busy, submit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Typing in the memory panel or any field is not a guess
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      if (e.key === 'Enter') press('enter');
      else if (e.key === 'Backspace') press('back');
      else press(e.key.toLowerCase());
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  const rows = Array.from({ length: state.tries }, (_, r) => {
    const done = state.guesses[r];
    if (done) return { letters: done.guess.split(''), marks: done.marks };
    if (r === state.guesses.length && !state.over) return { letters: typed.split(''), marks: null };

    return { letters: [] as string[], marks: null };
  });

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <CalendarCheck aria-hidden size={20} className="text-emerald-600" />
          {tr('كلمة اليوم')}
        </h2>
        <span className="text-sm text-slate-500">{tr('كلمة جديدة كل يوم')}</span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {tr('اكتب الكلمة الإنجليزية التي معناها:')}{' '}
        <span className="font-bold text-slate-900">{state.hint_ar}</span>
      </p>

      {/* The grid — English, so it reads left to right whatever the page does */}
      <div dir="ltr" className="mx-auto mt-4 grid w-fit gap-1.5">
        {rows.map((row, r) => (
          <div
            key={r}
            className={`flex gap-1.5 ${shake && r === state.guesses.length ? 'animate-pulse' : ''}`}
          >
            {Array.from({ length: state.length }, (_, i) => (
              <span
                key={i}
                className={`grid h-12 w-12 place-items-center rounded-lg text-xl font-bold uppercase ${
                  row.marks
                    ? TILE[row.marks[i]]
                    : row.letters[i]
                      ? 'border-2 border-slate-400 text-slate-900'
                      : 'border-2 border-slate-200'
                }`}
              >
                {row.letters[i] ?? ''}
              </span>
            ))}
          </div>
        ))}
      </div>

      {state.over ? (
        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-center">
          {state.solved && <Trophy aria-hidden size={28} className="mx-auto text-amber-500" />}
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {state.solved
              ? state.guesses.length === 1
                ? tr('أحسنت! وجدتها من المحاولة الأولى.')
                : tr('أحسنت! وجدتها في :n محاولات.', { n: state.guesses.length })
              : tr('لم تجدها هذه المرة. الكلمة:')}
          </p>
          {state.answer && (
            <button
              onClick={() => say(state.answer!)}
              dir="ltr"
              className="mt-1 text-2xl font-bold uppercase text-emerald-700 hover:underline"
            >
              {state.answer} 🔊
            </button>
          )}
          <p className="mt-2 text-sm text-slate-500">{tr('عُد غداً لكلمة جديدة.')}</p>
        </div>
      ) : (
        <div dir="ltr" className="mt-5 space-y-1.5">
          {ROWS.map((row, r) => (
            <div key={r} className="flex justify-center gap-1">
              {r === 2 && (
                <button
                  onClick={() => press('enter')}
                  disabled={busy}
                  className="rounded-md bg-emerald-600 px-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  Enter
                </button>
              )}
              {row.split('').map((k) => (
                <button
                  key={k}
                  onClick={() => press(k)}
                  className={`h-11 w-8 rounded-md text-sm font-bold uppercase sm:w-9 ${
                    keyMarks[k] === undefined ? 'bg-slate-100 text-slate-800' : TILE[keyMarks[k]]
                  }`}
                >
                  {k}
                </button>
              ))}
              {r === 2 && (
                <button
                  onClick={() => press('back')}
                  aria-label="Backspace"
                  className="grid w-10 place-items-center rounded-md bg-slate-100 text-slate-700"
                >
                  <Delete size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/*
        The colour key, shown with real tiles rather than described:
        a beginner matches a colour faster than they parse a sentence.
      */}
      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-800">{tr('بعد كل محاولة تتلوّن المربّعات:')}</p>
        <ul className="mt-2 space-y-2">
          {[
            { mark: 2, ch: 'a', text: 'الحرف صحيح وفي مكانه الصحيح.' },
            { mark: 1, ch: 'b', text: 'الحرف موجود في الكلمة، لكن انقله إلى مكان آخر.' },
            { mark: 0, ch: 'c', text: 'الحرف غير موجود في الكلمة أبداً.' },
          ].map((row) => (
            <li key={row.mark} className="flex items-center gap-2.5 text-sm text-slate-700">
              <span
                dir="ltr"
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-base font-bold uppercase ${TILE[row.mark]}`}
              >
                {row.ch}
              </span>
              <span className="leading-relaxed">{tr(row.text)}</span>
            </li>
          ))}
        </ul>

        {/*
          One worked example. The marks are what the server's
          PlayController::marks('speed', 'sheep') returns — [2,1,2,2,0].
        */}
        <div className="mt-3 border-t border-slate-200 pt-3">
          <p className="text-sm font-semibold text-slate-800">
            {tr('مثال: الكلمة المخفيّة')} <span dir="ltr" className="font-bold">SHEEP</span>{' '}
            {tr('وأنت كتبت')} <span dir="ltr" className="font-bold">SPEED</span>
          </p>
          <div dir="ltr" className="mt-2 flex gap-1.5">
            {[
              ['s', 2],
              ['p', 1],
              ['e', 2],
              ['e', 2],
              ['d', 0],
            ].map(([ch, m], i) => (
              <span
                key={i}
                className={`grid h-9 w-9 place-items-center rounded-md text-base font-bold uppercase ${TILE[m as number]}`}
              >
                {ch}
              </span>
            ))}
          </div>
          <ul className="mt-2 space-y-1 text-sm leading-relaxed text-slate-700">
            <li>
              <span dir="ltr" className="font-bold">S · E · E</span> {tr('أخضر: صحيحة وفي مكانها.')}
            </li>
            <li>
              <span dir="ltr" className="font-bold">P</span> {tr('برتقالي: موجود في SHEEP لكن مكانه في الآخر.')}
            </li>
            <li>
              <span dir="ltr" className="font-bold">D</span> {tr('رمادي: لا يوجد في SHEEP.')}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
