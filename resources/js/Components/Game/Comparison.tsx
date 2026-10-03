import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { getRecording, getWeekRecordings } from '@/lib/recordings';
import { useT } from '@/lib/i18n';

/**
 * The Big Comparison — listening to who you were.
 *
 * ── Why this screen matters more than a score ───────────────
 * The book calls it "the most important twenty minutes of the whole
 * module" and the course rests on it: twenty-four recordings, and the
 * claim that comparing them is stronger evidence than any badge. It
 * appears four times — weeks 6, 12, 18, 24 — and until now there was
 * nowhere in the platform to do it. The recordings were being made
 * and never heard again.
 *
 * ── Everything about the audio stays local ──────────────────
 * The files live in the learner's own browser by decision, so this
 * component reads them from IndexedDB and plays them there. Nothing
 * about the audio is sent anywhere. What reaches the server is the
 * numbers the learner wrote and the sentences they finished.
 *
 * ── A missing recording is not an error ─────────────────────
 * A learner may arrive here having skipped a week, cleared their
 * browser, or switched device — the files are local, so that is
 * expected rather than exceptional. The row for that week says so
 * plainly and the rest of the exercise still works: the measure
 * columns and the sentences do not depend on playback.
 */

interface Metric {
  label_en: string;
  label_ar: string;
  unit_ar: string | null;
  kind: 'number' | 'yesno';
}

export interface ComparisonPayload {
  intro_ar: string;
  weeks: number[];
  listen_ar: string;
  metrics: Metric[];
  stems_en: string[];
  closing_ar: string;
}

export interface ComparisonSaved {
  measures: Record<string, Record<string, number | boolean>>;
  sentences: Record<string, string>;
  saved_at: string;
}

type Found = { week: number; ref: string | null };

/*
 * What comes back is not always the shape it was sent in.
 *
 * The measures are keyed by index -- "0", "1", "2" -- and PHP's
 * json_encode collapses a map whose keys are sequential integers into
 * a JSON array. So a fully filled row returns as `[42, 9, 1]` while a
 * partly filled one returns as `{"2": 1}`. Reading `x["2"]` happens to
 * work on both, which is exactly why this would have gone unnoticed
 * until some later change trusted the declared type. Normalising once
 * on the way in costs nothing and makes the type true.
 */
function asMap<T>(value: unknown): Record<string, T> {
  if (value === null || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value)) as Record<string, T>;
}

export default function Comparison({
  payload,
  saved,
  weekNumber,
}: {
  payload: ComparisonPayload;
  saved: ComparisonSaved | null;
  weekNumber: number;
}) {
  const tr = useT();

  const [found, setFound] = useState<Found[] | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [measures, setMeasures] = useState<Record<string, Record<string, number | boolean>>>(
    () =>
      Object.fromEntries(
        Object.entries(asMap<unknown>(saved?.measures)).map(([week, row]) => [
          week,
          asMap<number | boolean>(row),
        ]),
      ),
  );
  const [sentences, setSentences] = useState<Record<string, string>>(() =>
    asMap<string>(saved?.sentences),
  );
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  /* Which of the named weeks the learner actually has a recording for */
  useEffect(() => {
    let alive = true;

    (async () => {
      const rows = await Promise.all(
        payload.weeks.map(async (w) => {
          const list = await getWeekRecordings(w);

          // The newest take for that week is the one to compare
          const newest = list.sort((a, b) => b.createdAt - a.createdAt)[0];

          return { week: w, ref: newest?.ref ?? null };
        }),
      );

      if (alive) setFound(rows);
    })();

    return () => {
      alive = false;
    };
  }, [payload.weeks]);

  /* One object URL at a time, revoked when it is replaced or gone */
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      audioRef.current?.pause();
    },
    [],
  );

  const play = async (week: number, ref: string) => {
    const blob = await getRecording(ref);
    if (!blob) return;

    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;

    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.src = url;
    audio.onended = () => setPlaying(null);

    setPlaying(week);
    void audio.play();
  };

  const stop = () => {
    audioRef.current?.pause();
    setPlaying(null);
  };

  const setMeasure = (week: number, i: number, value: number | boolean | null) => {
    setMeasures((prev) => {
      const row = { ...(prev[String(week)] ?? {}) };

      if (value === null) delete row[String(i)];
      else row[String(i)] = value;

      return { ...prev, [String(week)]: row };
    });

    setState('idle');
  };

  const save = () => {
    setState('saving');

    // Optimistic: the learner may close the page, and a failed save
    // must not lose what is on screen
    axios
      .post(`/week/${weekNumber}/comparison`, { measures, sentences })
      .then(() => setState('saved'))
      .catch(() => setState('idle'));
  };

  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-violet-50/60 p-4 text-sm leading-relaxed text-violet-950 ring-1 ring-violet-100">
        {payload.intro_ar}
      </p>

      {/* ── Step one: hear them ──────────────────────────────── */}
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <StepHead n={1} title={tr('اسمع')} />

        <p className="mt-2 text-sm leading-relaxed text-slate-600">{payload.listen_ar}</p>

        <div className="mt-3 space-y-2">
          {found === null ? (
            <p className="text-sm text-slate-400">{tr('نبحث في تسجيلاتك…')}</p>
          ) : (
            found.map((row) => (
              <div
                key={row.week}
                className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
              >
                <span className="w-20 shrink-0 text-sm font-semibold text-slate-700">
                  {tr('أسبوع')} {row.week}
                </span>

                {row.ref ? (
                  <button
                    onClick={() => (playing === row.week ? stop() : play(row.week, row.ref!))}
                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white
                               transition hover:bg-violet-700"
                  >
                    {playing === row.week ? tr('أوقف') : tr('شغّل')}
                  </button>
                ) : (
                  <span className="text-sm leading-relaxed text-slate-500">
                    {tr('لا تسجيل محفوظ لهذا الأسبوع على هذا الجهاز')}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Step two: measure ────────────────────────────────── */}
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <StepHead n={2} title={tr('قِس')} />

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-1 pb-2 text-start font-medium text-slate-400">&nbsp;</th>
                {payload.weeks.map((w) => (
                  <th key={w} className="px-1 pb-2 text-center font-semibold text-slate-600">
                    {w}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {payload.metrics.map((m, i) => (
                <tr key={i}>
                  <td className="py-2 pe-2 align-middle leading-relaxed text-slate-700">
                    {m.label_ar}
                    {m.unit_ar && (
                      <span className="text-xs text-slate-400"> ({m.unit_ar})</span>
                    )}
                  </td>

                  {payload.weeks.map((w) => {
                    const value = measures[String(w)]?.[String(i)];

                    return (
                      <td key={w} className="px-1 py-1.5 align-middle">
                        {m.kind === 'yesno' ? (
                          <button
                            onClick={() =>
                              setMeasure(w, i, value === true ? false : value === false ? null : true)
                            }
                            className={`w-full rounded-lg py-2 text-xs font-semibold transition ${
                              value === true
                                ? 'bg-emerald-600 text-white'
                                : value === false
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {value === true ? tr('نعم') : value === false ? tr('لا') : '—'}
                          </button>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={typeof value === 'number' ? value : ''}
                            onChange={(e) =>
                              setMeasure(w, i, e.target.value === '' ? null : Number(e.target.value))
                            }
                            className="w-full rounded-lg border-slate-200 bg-slate-50 py-1.5 text-center
                                       text-sm focus:border-violet-400 focus:ring-violet-400"
                            dir="ltr"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Step three: write it down ────────────────────────── */}
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <StepHead n={3} title={tr('اكتبه')} />

        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {tr('أكمل الجمل بالإنجليزية. ستعود إليها في المراجعة القادمة.')}
        </p>

        <div className="mt-3 space-y-3">
          {payload.stems_en.map((stem, i) => (
            <div key={i}>
              <p className="text-sm font-medium text-slate-500" dir="ltr">
                {stem}
              </p>

              <textarea
                rows={2}
                value={sentences[String(i)] ?? ''}
                onChange={(e) => {
                  setSentences((prev) => ({ ...prev, [String(i)]: e.target.value }));
                  setState('idle');
                }}
                className="ruled mt-1 text-sm"
                dir="ltr"
              />
            </div>
          ))}
        </div>
      </section>

      <button
        onClick={save}
        disabled={state === 'saving'}
        className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white transition
                   hover:bg-violet-700 disabled:opacity-60"
      >
        {state === 'saving' ? tr('نحفظ…') : state === 'saved' ? tr('حُفظ') : tr('احفظ')}
      </button>

      <p className="rounded-xl border-s-4 border-violet-500 bg-violet-50/70 p-3 text-sm leading-relaxed text-violet-900">
        {payload.closing_ar}
      </p>
    </div>
  );
}

function StepHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid h-6 w-6 place-items-center rounded-lg bg-violet-100
                   text-xs font-bold text-violet-700"
      >
        {n}
      </span>
      <span className="font-semibold text-slate-900">{title}</span>
    </div>
  );
}
