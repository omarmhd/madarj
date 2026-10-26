import { Link } from '@inertiajs/react';
import { ArrowLeft, Check, Clock, Lock, LockOpen, Play, Trophy } from 'lucide-react';
import type { DayState } from '@/Components/DayCard';
import { cleanLabel } from '@/lib/labels';
import { pick, dirFor, type Locale } from '@/lib/bilingual';
import { useT } from '@/lib/i18n';

/**
 * The week as seven stops — the page's one job is to send you into today.
 *
 * The week page used to show today's tasks as a checklist, then the
 * seven days again as the same cards below it, each with its own
 * checklist: two ways into the same work, and a long page to scroll
 * before you knew where you were. Now a day is one tile — done, today,
 * or locked — and a tap opens its journey, where the work happens.
 */

interface Props {
  weekNumber: number;
  days: DayState[];
  /** The day to work on now, if any */
  today: DayState | null;
  multiplier: number;
  locale: Locale;
}

export default function WeekJourney({ weekNumber, days, today, multiplier, locale }: Props) {
  const tr = useT();
  const done = days.filter((d) => d.completed).length;
  const name = (d: DayState) => cleanLabel(pick(locale, d.focus_ar ?? d.focus, d.focus_en).primary);

  return (
    <div className="space-y-5">
      {/* Today, large: what it is, how long, and the one button */}
      {today ? (
        <Link
          href={`/week/${weekNumber}/day/${today.number}`}
          className="group block overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-violet-200 transition
                     hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center gap-4 p-5 sm:p-6">
            <span className="journey-current grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg">
              <span className="text-center leading-none">
                <span className="block text-xs font-medium opacity-80">{tr('يوم')}</span>
                <span className="block text-2xl font-bold">{today.number}</span>
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-violet-700">
                {today.percent > 0 ? tr('تابع من حيث توقّفت') : tr('درس اليوم')}
              </p>
              <p className="mt-0.5 text-lg font-bold leading-snug text-slate-900 sm:text-xl" dir={dirFor(name(today))}>
                {name(today)}
              </p>
              <p className="mt-1 flex items-center gap-3 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1"><Clock aria-hidden size={14} /> {today.minutes * multiplier} {tr('دقيقة')}</span>
                <span>{today.tasks.length} {tr('محطات')}</span>
              </p>
            </div>
          </div>
          {today.percent > 0 && (
            <div className="mx-5 mb-1 h-2 overflow-hidden rounded-full bg-violet-100 sm:mx-6">
              <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${today.percent}%` }} />
            </div>
          )}
          <div className="stamp m-4 flex min-h-12 items-center justify-center gap-2 text-base font-semibold sm:m-5">
            <Play aria-hidden size={17} />
            {today.percent > 0 ? tr('تابع اليوم') : tr('ابدأ اليوم')} {today.number}
            <ArrowLeft aria-hidden size={17} className="transition group-hover:-translate-x-1" />
          </div>
        </Link>
      ) : (
        <div className="rounded-3xl bg-emerald-50 p-6 text-center ring-1 ring-emerald-200">
          <Trophy aria-hidden size={36} strokeWidth={1.5} className="mx-auto text-emerald-600" />
          <p className="mt-2 text-lg font-bold text-emerald-900">{tr('أنهيت أيام هذا الأسبوع')}</p>
          <p className="mt-1 text-sm text-emerald-800">{tr('كل يوم يبقى مفتوحاً للمراجعة.')}</p>
        </div>
      )}

      {/* The seven days */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-slate-900">{tr('أيام الأسبوع')}</h2>
          <p className="text-sm text-slate-500">{done} {tr('من')} {days.length}</p>
        </div>

        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {days.map((d) => {
            const isToday = today?.number === d.number;
            const tile = (
              <>
                <span className="flex items-center justify-between">
                  {/* The number stays on a finished day — the check rides on its corner */}
                  <span
                    className={`relative grid h-10 w-10 place-items-center rounded-xl text-base font-bold ${
                      d.completed
                        ? 'bg-emerald-600 text-white'
                        : isToday
                          ? 'bg-violet-600 text-white'
                          : d.unlocked ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {d.number}
                    {d.completed && (
                      <span className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-emerald-600 shadow ring-1 ring-emerald-200">
                        <Check aria-label={tr('اكتمل')} size={13} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  {!d.unlocked && <Lock aria-label={tr('مقفل')} size={15} className="text-slate-300" />}
                  {d.unlocked && !d.completed && (
                    <span className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700">
                      <LockOpen aria-hidden size={13} /> {isToday ? tr('اليوم') : tr('مفتوح')}
                    </span>
                  )}
                </span>
                <span
                  className={`mt-3 line-clamp-2 text-sm font-semibold leading-snug ${d.unlocked ? 'text-slate-800' : 'text-slate-400'}`}
                  dir={dirFor(name(d))}
                >
                  {name(d)}
                </span>
                <span className="mt-auto pt-3">
                  {d.unlocked && !d.completed && d.percent > 0 ? (
                    <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-violet-500" style={{ width: `${d.percent}%` }} />
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">
                      {d.completed ? tr('اكتمل') : `${d.minutes * multiplier} ${tr('د')}`}
                    </span>
                  )}
                </span>
              </>
            );

            const base = 'flex min-h-36 flex-col rounded-2xl p-4 text-start transition';
            return (
              <li key={d.number}>
                {d.unlocked ? (
                  <Link
                    href={`/week/${weekNumber}/day/${d.number}`}
                    className={`${base} h-full bg-white ring-1 hover:-translate-y-0.5 hover:shadow-md ${
                      isToday ? 'ring-2 ring-violet-300' : d.completed ? 'ring-emerald-200' : 'ring-slate-200'
                    }`}
                  >
                    {tile}
                  </Link>
                ) : (
                  <div className={`${base} h-full bg-white/60 ring-1 ring-slate-100`} aria-disabled>
                    {tile}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
