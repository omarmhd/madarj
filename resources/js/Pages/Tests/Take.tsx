import { AlertTriangle, Clock, Volume2 } from 'lucide-react';
import { Head, router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useMySpeech } from '@/hooks/useSpeech';
import { useLocale, dirOf } from '@/lib/bilingual';
import { useT } from '@/lib/i18n';

/**
 * Sitting a level test.
 *
 * ── The clock is the server's ───────────────────────────────
 * `seconds_left` comes from the deadline stored on the attempt, so a
 * reload or a wrong phone clock gives no extra time. At zero the page
 * submits; if it never does, the server grades the last autosave.
 *
 * ── Leaving the page ───────────────────────────────────────
 * Hiding the tab or leaving the window is counted on the server and
 * answered with a warning — "don't cheat yourself" — not a penalty.
 *
 * ── Listening is played at most twice ───────────────────────
 * As in Cambridge exams. The text is never shown: it is spoken by the
 * browser (§4.3), so there is nothing to read instead of listening.
 */

type Answer = string | number | boolean | string[];

interface Item {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'correct_error' | 'order_words';
  prompt: string;
  payload: { options?: string[]; before?: string; after?: string; sentence?: string; words?: string[] };
}

interface Part {
  instructions_ar: string | null;
  passage: string | null;
  audio: { g: 'f' | 'm'; text: string }[] | null;
  items: Item[];
}

interface Section {
  key: string;
  title_ar: string;
  title_en: string;
  instructions_ar: string | null;
  parts: Part[];
}

interface Props {
  attempt: { id: number; answers: Record<string, Answer>; focus_lost: number; seconds_left: number };
  test: { slug: string; level: string; title_ar: string; minutes: number; sections: Section[] };
}

const MAX_PLAYS = 2;

function clock(s: number) {
  const m = Math.floor(s / 60);

  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function Take({ attempt, test }: Props) {
  const tr = useT();
  const locale = useLocale();
  const { speakSequence, myRate, stop } = useMySpeech();

  const [answers, setAnswers] = useState<Record<string, Answer>>(attempt.answers ?? {});
  const [left, setLeft] = useState(Math.max(0, Math.floor(attempt.seconds_left)));
  const [step, setStep] = useState(0);
  /*
   * Listening plays survive a reload — otherwise reloading the page
   * was a third, fourth, fifth listen. Session storage is enough: it
   * is a limit on this sitting, not progress (§7).
   */
  const playsKey = `test-plays-${attempt.id}`;
  const [plays, setPlaysState] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(playsKey) ?? '{}');
    } catch {
      return {};
    }
  });
  const setPlays = (update: (p: Record<string, number>) => Record<string, number>) =>
    setPlaysState((p) => {
      const next = update(p);
      try {
        sessionStorage.setItem(playsKey, JSON.stringify(next));
      } catch {
        // Private mode: the limit holds until a reload, which is acceptable
      }

      return next;
    });
  const [playing, setPlaying] = useState<string | null>(null);
  const [focusLost, setFocusLost] = useState(attempt.focus_lost);
  const [warn, setWarn] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const submitted = useRef(false);
  const away = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const latest = useRef(answers);
  latest.current = answers;

  const section = test.sections[step];
  const allItems = test.sections.flatMap((s) => s.parts.flatMap((p) => p.items));
  const answered = allItems.filter((i) => {
    const a = answers[i.id];

    return a !== undefined && a !== '' && !(Array.isArray(a) && a.length === 0);
  }).length;

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    stop();
    router.post(`/tests/attempt/${attempt.id}/submit`, { answers: latest.current });
  }, [attempt.id, stop]);

  /*
   * The clock counts down to a fixed deadline, not by subtracting one
   * per tick: browsers throttle timers in hidden tabs, and a counter
   * that only ticks fell minutes behind the server after a tab switch.
   */
  const deadline = useRef(Date.now() + Math.max(0, Math.floor(attempt.seconds_left)) * 1000);

  useEffect(() => {
    const tick = () => {
      const s = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) submit();
    };

    tick();
    const id = window.setInterval(tick, 1000);
    // Coming back to the tab corrects the clock at once, not on the next tick
    document.addEventListener('visibilitychange', tick);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [submit]);

  /* Autosave, a second and a half after the last change */
  const setAnswer = (id: string, value: Answer) => {
    setAnswers((a) => ({ ...a, [id]: value }));

    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      axios.post(`/tests/attempt/${attempt.id}/save`, { answers: latest.current }).catch(() => {});
    }, 1500);
  };

  /* Leaving the page: once per absence, not once per event */
  useEffect(() => {
    const leave = () => {
      if (away.current || submitted.current) return;
      away.current = true;
      axios
        .post(`/tests/attempt/${attempt.id}/focus`)
        .then(({ data }) => setFocusLost(data.focus_lost))
        .catch(() => setFocusLost((n) => n + 1));
    };
    const back = () => {
      if (!away.current) return;
      away.current = false;
      setWarn(true);
    };
    const onVisibility = () => (document.hidden ? leave() : back());

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', leave);
    window.addEventListener('focus', back);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', leave);
      window.removeEventListener('focus', back);
    };
  }, [attempt.id]);

  const play = (key: string, audio: Part['audio']) => {
    if (!audio || (plays[key] ?? 0) >= MAX_PLAYS || playing) return;
    setPlays((p) => ({ ...p, [key]: (p[key] ?? 0) + 1 }));
    setPlaying(key);
    speakSequence(
      audio.map((l) => ({ text: l.text, gender: l.g })),
      { rate: myRate, gapMs: 500, onDone: () => setPlaying(null) },
    );
  };

  const urgent = left <= 60;

  return (
    <div
      dir={dirOf(locale)}
      className="min-h-screen select-none bg-slate-50 pb-24"
      onCopy={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Head title={test.title_ar} />

      {/* Sticky bar: title, clock, progress */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <p className="truncate text-sm font-bold text-slate-900">{test.title_ar}</p>
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold tabular-nums ${
              urgent ? 'animate-pulse bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-800'
            }`}
            dir="ltr"
          >
            <Clock aria-hidden size={15} />
            {clock(left)}
          </span>
        </div>

        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2">
          {test.sections.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setStep(i)}
              className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                i === step ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tr(s.title_ar)}
            </button>
          ))}
        </div>

        {focusLost > 0 && (
          <p className="flex items-center justify-center gap-1.5 bg-amber-50 py-1.5 text-sm font-semibold text-amber-800">
            <AlertTriangle aria-hidden size={15} />
            {tr('غادرت صفحة الاختبار :n مرّة', { n: focusLost })}
          </p>
        )}
      </div>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {section.instructions_ar && (
          <p className="text-sm leading-relaxed text-slate-600">{section.instructions_ar}</p>
        )}

        {section.parts.map((part, pi) => {
          const key = `${section.key}-${pi}`;
          const used = plays[key] ?? 0;

          return (
            <div key={key} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
              {part.instructions_ar && <p className="text-sm font-semibold text-slate-800">{part.instructions_ar}</p>}

              {part.audio && (
                <button
                  onClick={() => play(key, part.audio)}
                  disabled={used >= MAX_PLAYS || !!playing}
                  className="flex items-center gap-2 rounded-xl bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800 ring-1 ring-violet-200 disabled:opacity-50"
                >
                  <Volume2 aria-hidden size={18} className={playing === key ? 'animate-pulse' : ''} />
                  {playing === key
                    ? tr('يُشغَّل الآن…')
                    : used >= MAX_PLAYS
                      ? tr('سمعته مرّتين')
                      : tr('استمع (:n من :max)', { n: used + 1, max: MAX_PLAYS })}
                </button>
              )}

              {part.passage && (
                <div dir="ltr" className="whitespace-pre-line rounded-xl bg-slate-50 p-4 text-base leading-relaxed text-slate-800">
                  {part.passage}
                </div>
              )}

              {part.items.map((item, ii) => (
                <Question
                  key={item.id}
                  n={ii + 1}
                  item={item}
                  value={answers[item.id]}
                  onChange={(v) => setAnswer(item.id, v)}
                />
              ))}
            </div>
          );
        })}

        <div className="flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
              {tr('السابق')}
            </button>
          )}
          {step < test.sections.length - 1 ? (
            <button
              onClick={() => {
                setStep(step + 1);
                window.scrollTo({ top: 0 });
              }}
              className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white"
            >
              {tr('القسم التالي')}
            </button>
          ) : (
            <button onClick={() => setConfirmSubmit(true)} className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white">
              {tr('سلّم الاختبار')}
            </button>
          )}
        </div>

        <p className="text-center text-sm text-slate-500">
          {tr('أجبت :a من :t', { a: answered, t: allItems.length })}
        </p>
      </main>

      {/* The warning on return */}
      {warn && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4" role="alertdialog" aria-modal>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <AlertTriangle aria-hidden size={40} className="mx-auto text-amber-500" />
            <p className="mt-3 text-lg font-bold text-slate-900">{tr('كشف غش — لا تغشّ نفسك')}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {tr('غادرت صفحة الاختبار. هذا الاختبار لك أنت، لا لنا: إن نجحت بمساعدة لن تفهم الدروس القادمة. سجّلنا ذلك وسيظهر في نتيجتك.')}
            </p>
            <p className="mt-2 text-sm font-semibold text-amber-700">{tr('عدد مرّات المغادرة: :n', { n: focusLost })}</p>
            <button onClick={() => setWarn(false)} className="mt-5 w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white">
              {tr('فهمت، أكمل بنفسي')}
            </button>
          </div>
        </div>
      )}

      {confirmSubmit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" role="dialog" aria-modal>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <p className="text-lg font-bold text-slate-900">{tr('تسليم الاختبار؟')}</p>
            <p className="mt-2 text-sm text-slate-600">
              {answered < allItems.length
                ? tr('بقي :n سؤالاً بلا إجابة. لا تستطيع التعديل بعد التسليم.', { n: allItems.length - answered })
                : tr('أجبت عن كل الأسئلة. لا تستطيع التعديل بعد التسليم.')}
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmSubmit(false)} className="flex-1 rounded-xl py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                {tr('رجوع')}
              </button>
              <button onClick={submit} className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white">
                {tr('سلّم')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── One question ───────────── */

function Question({
  n,
  item,
  value,
  onChange,
}: {
  n: number;
  item: Item;
  value: Answer | undefined;
  onChange: (v: Answer) => void;
}) {
  const tr = useT();
  const p = item.payload;

  const choice = (label: string, v: Answer, i: number) => (
    <button
      key={i}
      onClick={() => onChange(v)}
      dir="ltr"
      className={`w-full rounded-xl border-2 px-4 py-2.5 text-start text-base transition ${
        value === v ? 'border-violet-500 bg-violet-50 font-semibold text-violet-900' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
      <p dir="ltr" className="text-base font-semibold text-slate-900">
        <span className="me-2 text-slate-400">{n}.</span>
        {item.prompt}
      </p>

      <div className="mt-2.5 space-y-2">
        {item.type === 'multiple_choice' && (p.options ?? []).map((o, i) => choice(o, i, i))}

        {item.type === 'true_false' && (
          <div className="grid grid-cols-2 gap-2">
            {choice('True', true, 0)}
            {choice('False', false, 1)}
          </div>
        )}

        {item.type === 'fill_blank' && (
          <p dir="ltr" className="flex flex-wrap items-center gap-2 text-base text-slate-800">
            {p.before}
            <input
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="w-40 rounded-lg border-slate-300 py-1.5 text-base focus:border-violet-500 focus:ring-violet-500"
            />
            {p.after}
          </p>
        )}

        {item.type === 'correct_error' && (
          <>
            <p dir="ltr" className="text-base text-rose-700">{p.sentence}</p>
            <input
              dir="ltr"
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={tr('اكتب الجملة صحيحة')}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border-slate-300 text-base focus:border-violet-500 focus:ring-violet-500"
            />
          </>
        )}

        {item.type === 'order_words' && <OrderWords words={p.words ?? []} value={(value as string[]) ?? []} onChange={onChange} />}
      </div>
    </div>
  );
}

/** Tap a tile to place it; tap a placed word to send it back */
function OrderWords({ words, value, onChange }: { words: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const tr = useT();

  // Tiles by index, so a repeated word ("the", "the") is two tiles, not one
  const used = new Set<number>();
  const placed = value.map((w) => {
    const i = words.findIndex((x, j) => x === w && !used.has(j));
    used.add(i);

    return i;
  });

  return (
    <div dir="ltr">
      <div className="flex min-h-12 flex-wrap gap-1.5 rounded-xl border-2 border-dashed border-slate-300 p-2">
        {value.length === 0 && <span className="self-center px-1 text-sm text-slate-400">{tr('اضغط الكلمات بالترتيب')}</span>}
        {value.map((w, i) => (
          <button
            key={i}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-base font-semibold text-white"
          >
            {w}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {words.map((w, i) =>
          placed.includes(i) ? null : (
            <button
              key={i}
              onClick={() => onChange([...value, w])}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-base font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-200"
            >
              {w}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
