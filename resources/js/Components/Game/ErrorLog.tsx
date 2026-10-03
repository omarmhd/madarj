import { useState } from 'react';
import Listen from '@/Components/Listen';
import { COMMON_ERRORS } from '@/lib/commonErrors';
import { useT } from '@/lib/i18n';

/**
 * The twenty errors, and which of them actually catch you.
 *
 * ── Why a game needed a record ──────────────────────────────
 * Error Hunt shows the correction for four seconds and then the round
 * ends and takes it with it. But the twenty are the spine of the
 * course — every exercise in the book serves one of them — so the
 * worthwhile thing to keep is not the score, it is which of the
 * twenty a particular learner keeps getting wrong.
 *
 * ── A reference, not a scoreboard ───────────────────────────
 * All twenty are listed, including the ones never met, because this
 * is meant to be read when writing and not only after playing. What
 * the record changes is the *order*: the ones that trip this learner
 * come first, and the ones they have never got wrong sink. So the
 * page answers "what do I personally get wrong" without ever hiding
 * the rest.
 *
 * ── And the wrong form is shown, deliberately ───────────────
 * The book prints both, and that is the point: the learner recognises
 * their own sentence in the left column. It is struck through and
 * muted so it is never mistaken for the model, and only the correct
 * sentence can be played aloud.
 */

export interface ErrorRecord {
  tries: number;
  misses: number;
}

export default function ErrorLog({
  records,
}: {
  records: Record<string, ErrorRecord>;
}) {
  const tr = useT();
  const [openAll, setOpenAll] = useState(false);

  const rows = COMMON_ERRORS.map((error) => {
    const rec = records[String(error.no)] ?? { tries: 0, misses: 0 };

    return {
      error,
      ...rec,
      // Never met sorts last; among the met, the worst rate first,
      // and more attempts breaks the tie so a single slip does not
      // outrank a habit
      weight: rec.tries === 0 ? -1 : (rec.misses / rec.tries) * 100 + rec.misses,
    };
  }).sort((a, b) => b.weight - a.weight);

  const met = rows.filter((r) => r.tries > 0);
  const shown = openAll ? rows : rows.slice(0, Math.max(met.length, 5));

  const totalTries = met.reduce((n, r) => n + r.tries, 0);
  const totalMisses = met.reduce((n, r) => n + r.misses, 0);

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-slate-900">{tr('سجلّ أخطائك')}</p>

        {totalTries > 0 && (
          <p className="text-sm text-slate-500">
            {totalTries} {tr('محاولة')} · {totalMisses} {tr('خطأ')}
          </p>
        )}
      </div>

      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        {totalTries === 0
          ? tr('العشرون كلّها هنا. العب جولة، وسيتقدّم إلى الأعلى ما تُخطئ فيه أنت.')
          : tr('مرتّبة بحسبك أنت: ما يُمسك بك أولاً. وهي مرجع تعود إليه وأنت تكتب، لا نتيجة لعبة.')}
      </p>

      <ol className="mt-4 space-y-2">
        {shown.map(({ error, tries, misses }) => {
          const rate = tries ? Math.round((misses / tries) * 100) : 0;

          return (
            <li
              key={error.no}
              className={`rounded-xl p-3 ring-1 ${
                misses > 0 ? 'bg-rose-50/50 ring-rose-100' : 'bg-slate-50 ring-slate-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg
                              text-xs font-bold ${
                                misses > 0
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                >
                  {error.no}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-400 line-through" dir="ltr">
                    {error.wrong}
                  </p>

                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="min-w-0 flex-1 text-sm font-semibold text-slate-900" dir="ltr">
                      {error.right}
                    </p>
                    <Listen text={error.right} size="sm" />
                  </div>

                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {tr(error.rule_ar)}
                  </p>
                </div>

                <span className="shrink-0 text-xs">
                  {tries === 0 ? (
                    <span className="text-slate-400">{tr('لم تقابلها')}</span>
                  ) : (
                    <span
                      className={
                        misses === 0 ? 'font-medium text-emerald-600' : 'font-medium text-rose-600'
                      }
                    >
                      {misses}/{tries}
                      {misses > 0 && <span className="text-rose-400"> · {rate}%</span>}
                    </span>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {shown.length < rows.length && (
        <button
          onClick={() => setOpenAll(true)}
          className="mt-3 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700
                     transition hover:bg-slate-200"
        >
          {tr('أظهر العشرين كلّها')} ({rows.length - shown.length} {tr('أخرى')})
        </button>
      )}
    </section>
  );
}
