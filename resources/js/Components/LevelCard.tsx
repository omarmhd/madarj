import { useT } from '@/lib/i18n';

/**
 * Where the learner is on the A1 → B1 ladder.
 *
 * ── Why the dashboard needed this ──────────────────────────
 * It said "Module 2" and "A1+ → A2" and left the learner to work out
 * which of the two they were standing on — while "what level am I?" is
 * the first thing anyone asks of a course that promises a level. So
 * the level is stated outright, and then shown as a position.
 *
 * ── The ladder runs left to right, in an RTL page ──────────
 * CEFR labels are Latin and the scale is universally drawn A1 on the
 * left. Left alone in an RTL page the bar would fill from the right
 * and the labels would reverse, so progress would appear to travel
 * backwards. The strip is `dir="ltr"` for that reason — the same fix
 * the module badge needed after it rendered "A2+ ← B1".
 *
 * ── The word count is counted, not estimated ───────────────
 * Review cards are seeded week by week as the learner reaches them,
 * so their number is what has actually been put in front of this
 * person, and the ones past `new` are what they have reviewed. No
 * figure here is inferred from the calendar.
 */

export interface LevelData {
  now: string;
  next: string;
  module: number;
  module_ar: string;
  scale: string[];
  at: number;
  percent: number;
  weeks_left: number;
  words_met: number;
  words_studied: number;
  words_goal: number;
}

export default function LevelCard({ level }: { level: LevelData }) {
  const tr = useT();

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
      <p className="text-sm font-medium text-violet-700">{tr('مستواك الآن')}</p>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-4xl font-bold text-slate-900" dir="ltr">
            {level.now}
          </p>
          {/* اسم الوحدة يُقرأ لا يُلمَح: أكبر وأدكن من سطر ثانويّ */}
          <p className="mt-1 text-base font-medium text-slate-800">
            الوحدة {level.module} — {level.module_ar}
          </p>
        </div>

        <p className="text-sm leading-relaxed text-slate-600">
          {tr('وتصل إلى')}{' '}
          <span className="font-bold text-violet-700" dir="ltr">
            {level.next}
          </span>{' '}
          {level.weeks_left === 0
            ? tr('بنهاية هذا الأسبوع')
            : `بعد ${level.weeks_left} ${level.weeks_left <= 10 ? 'أسابيع' : 'أسبوعاً'}`}
        </p>
      </div>

      {/* السلّم — خمس محطّات وموضعك عليها */}
      <div className="mt-5" dir="ltr">
        <div className="relative h-2 rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-violet-600 transition-all"
            style={{ width: `${Math.max(level.percent, 2)}%` }}
          />
          <span
            aria-hidden
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full
                       border-[3px] border-white bg-violet-600 shadow"
            style={{ left: `calc(${level.percent}% - 8px)` }}
          />
        </div>

        <div className="mt-2 flex justify-between">
          {level.scale.map((stop, i) => (
            <span
              key={stop}
              className={`text-xs ${
                i === level.at ? 'font-bold text-violet-700' : 'text-slate-400'
              }`}
            >
              {stop}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
        <span className="font-bold text-slate-900">{level.words_met}</span>{' '}
        {tr('كلمة قابلتك حتى الآن')}
        {level.words_studied > 0 && (
          <>
            {' · '}
            <span className="font-bold text-slate-900">{level.words_studied}</span>{' '}
            {tr('منها راجعتها')}
          </>
        )}
        {' — '}
        {tr('وهدف هذه الوحدة')} {level.words_goal} {tr('كلمة')}
      </p>
    </section>
  );
}
