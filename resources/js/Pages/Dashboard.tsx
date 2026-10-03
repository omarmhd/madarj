import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import AppNav from '@/Components/AppNav';
import { useLocale, dirOf } from '@/lib/bilingual';
import { useT } from '@/lib/i18n';
import LevelCard, { type LevelData } from '@/Components/LevelCard';
import { ArrowLeft, BookOpen, CalendarCheck, Check, ChevronDown, ChevronLeft, ClipboardCheck, Flame, Gamepad2, Headphones, Lock, Mountain, Target } from 'lucide-react';

/** One tile style for everything optional, so the group reads as one */
const TILE =
  'flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300';

/**
 * لوحة التقدّم — نقطة الدخول.
 *
 * تجيب على أربعة أسئلة بترتيب الأهمية:
 *   1. ماذا أفعل الآن؟          ← بطاقة «تابع من هنا» أولاً وأكبر
 *   2. أين أنا من الطريق؟       ← الوحدات الأربع والمستويات
 *   3. هل أنا في الموعد؟        ← الفرق بين موضعي وما يجب أن يكون
 *   4. ما الذي أنجزته؟          ← السلسلة والأيام والنسبة
 *
 * تعرض الأسابيع الأربعة والعشرين كلها، حتى ما لم يُدخل محتواه.
 * إخفاء ما بعد الأسبوع الجاري يجعل الدورة تبدو بلا نهاية معلومة،
 * ورؤية الطريق كاملاً هي نفسها محفّز.
 */

interface WeekRow {
  number: number;
  module: number;
  title_en: string | null;
  title_ar: string | null;
  is_review: boolean;
  has_content: boolean;
  unlocked: boolean;
  days_done: number;
}

interface Module {
  number: number;
  weeks: [number, number];
  title_ar: string;
  title_en: string;
  from: string;
  to: string;
  words: number;
}

interface Stats {
  track: 'A' | 'B';
  current_week: number;
  current_day: number;
  expected_week: number;
  expected_day: number;
  days_behind: number;
  days_done: number;
  days_total: number;
  percent: number;
  streak: number;
  longest_streak: number;
  streak_at_risk: boolean;
  started_on: string;
}

/** نشاط وقت الاستراحة المقرّر لليوم — تذكير لا مهمة */
interface BreakToday {
  week_number: number;
  day_number: number;
  book_day_ar: string | null;
  activity_ar: string;
  minutes: number;
  total: number;
  link: { label: string; url: string | null; note_ar: string | null; note_en: string | null } | null;
  item_key: string | null;
  item_done: boolean;
  item_label_ar: string | null;
}

/**
 * The end of the entitlement, named by the server.
 *
 * Not inferred from `unlocked` being false: a week can be shut because
 * it was not earned or because it was not bought, and those need two
 * different sentences. Null while the learner is still inside what
 * they own.
 */
interface Wall {
  week: number;
  trial: number;
  pending: boolean;
}

interface Props {
  stats: Stats;
  level?: LevelData | null;
  weeks: WeekRow[];
  modules: Module[];
  milestones: Record<string, string>;
  breakToday: BreakToday | null;
  wall?: Wall | null;
}

/** حلقة تقدّم — أوضح من شريط في رأس مزدحم */
function Ring({ percent, label }: { percent: number; label: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * c;

  return (
    <div className="relative grid h-20 w-20 shrink-0 place-items-center sm:h-24 sm:w-24">
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90 sm:h-24 sm:w-24">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-base font-bold leading-none text-white sm:text-lg">
          {Math.round(percent)}%
        </p>
        <p className="mt-0.5 text-xs text-violet-100/80">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard({
  stats,
  level,
  weeks,
  modules,
  milestones,
  breakToday,
  wall = null,
  dueTest = null,
}: Props & { dueTest?: { slug: string; level: string; placement: boolean; minutes: number } | null }) {
  const tr = useT();
  const locale = useLocale();
  /** الأسبوع الذي يتابع منه: الجاري إن كان محتواه موجوداً، وإلا آخر مفتوح */
  const resume =
    weeks.find((w) => w.number === stats.current_week && w.unlocked) ??
    weeks.filter((w) => w.unlocked).at(-1) ??
    null;

  /*
   * Only the current module opens by default. Showing all four
   * listed eighteen locked weeks the learner cannot act on — the
   * dashboard ran to four screens, the useful part on the first.
   */
  const [openModules, setOpenModules] = useState<Set<number>>(new Set());
  const toggleModule = (n: number) =>
    setOpenModules((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });

  const currentModule = modules.find(
    (m) => stats.current_week >= m.weeks[0] && stats.current_week <= m.weeks[1],
  );

  /** حالة الالتزام بالجدول — الفرق بين موضعه وما يجب أن يكون */
  const behind = stats.days_behind;
  const scheduleTone =
    behind > 3 ? 'rose' : behind > 0 ? 'amber' : 'emerald';
  const scheduleText =
    behind > 0
      ? `متأخّر ${behind} ${behind === 1 ? tr('يوماً') : tr('أيام')}`
      : behind < 0
        ? `متقدّم ${Math.abs(behind)} ${Math.abs(behind) === 1 ? tr('يوماً') : tr('أيام')}`
        : tr('في الموعد تماماً');

  const contentWeeks = weeks.filter((w) => w.has_content).length;

  return (
    <div dir={dirOf(locale)} className="min-h-screen bg-slate-50 pb-28 sm:pb-20">
      <Head title={tr("لوحة التقدّم")} />

      <AppNav />

      {/*
        ============ الرأس ============

        كان لوحاً أخضر داكناً بنصّ أبيض. وثلاث علل فيه: الأخضر هوية
        الإنجاز في المنصة كلها («تمّ»، «صحيح») فلوحٌ أخضر فوق كل شيء
        يُفقد الأخضر معناه؛ والنصّ الأبيض على تدرّج يُثقل الشاشة أول
        ما تُفتح؛ وعلى الموبايل يأكل نصف الشاشة قبل أن يرى المتدرّب
        «تابع من هنا».

        فصار سطحاً أبيض بلمسة نيليّة خفيفة: النيلي للتقدّم — لا يعني
        «تمّ» ولا «خطأ» في أي مكان آخر — والأرقام بطاقات فاتحة بنفس
        لغة بقية الصفحة، فلم يبقَ الرأس كتلة غريبة عنها.
      */}
      <header className="book-head relative overflow-hidden">
        {/* توهّج خفيف يعطي عمقاً بلا صور ولا وزن */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-violet-400/25 blur-3xl"
        />

        <div className="relative mx-auto max-w-4xl px-4 py-5 sm:py-7">
          {/* على الموبايل: الحلقة إلى جانب العنوان لا تحته — أوفر للشاشة */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-violet-100/85">
                <span className="rounded-md bg-white/20 px-1.5 py-0.5 font-medium text-white">
                  مسار {stats.track}
                </span>
                <span dir="ltr" className="font-medium">A1 → B1</span>
                <span aria-hidden>·</span>
                <span>{tr('24 أسبوعاً')}</span>
              </p>

              <h1 className="mt-1.5 text-lg font-bold leading-snug text-white sm:text-2xl">
                {currentModule
                  ? `الوحدة ${currentModule.number} — ${currentModule.title_ar}`
                  : tr('الدورة')}
              </h1>

              <p className="mt-1 text-xs text-violet-100/80 sm:text-sm">
                {currentModule && (
                  <>
                    <span dir="ltr" className="font-medium text-violet-50">
                      {currentModule.from} → {currentModule.to}
                    </span>
                    <span aria-hidden> · </span>
                  </>
                )}
                بدأت في {stats.started_on}
              </p>
            </div>

            <Ring percent={stats.percent} label={tr("من الدورة")} />
          </div>

          {/* الأرقام — بنفس لغة بطاقات الصفحة لا بلوحٍ ملوّن */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-4 sm:gap-3">
            {[
              {
                v: stats.streak,
                l: tr('سلسلة'),
                extra: stats.streak_at_risk ? tr('في خطر') : null,
                icon: <Flame size={14} />,
              },
              { v: `${stats.current_week}/24`, l: tr('الأسبوع'), icon: <BookOpen size={14} /> },
              { v: `${stats.days_done}/${stats.days_total}`, l: tr('أيام منجزة'), icon: <CalendarCheck size={14} /> },
              { v: stats.longest_streak, l: tr('أطول سلسلة'), icon: <Mountain size={14} /> },
            ].map((x, i) => (
              <div
                key={i}
                className="rounded-xl bg-white/15 px-3 py-2.5 ring-1 ring-white/20 backdrop-blur"
              >
                <p className="flex items-baseline gap-1.5">
                  <span aria-hidden className="opacity-70">
                    {x.icon}
                  </span>
                  <span className="text-lg font-bold text-white sm:text-xl">{x.v}</span>
                </p>
                <p className="mt-0.5 text-xs text-violet-100/80">{x.l}</p>
                {x.extra && (
                  <p className="mt-0.5 text-xs font-medium text-amber-200">{x.extra}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {/* ============ Today — one primary action, never two ============ */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">{tr('اليوم')}</h2>

        {wall ? (
          /*
           * Reached the end of the free weeks.
           *
           * The resume card used to fall back to the last week they
           * could open — which is the week they just finished — and
           * invited them to redo it, with nothing saying why. So the
           * same slot, first and largest, carries the reason and the
           * one action that clears it.
           */
          <section className="overflow-hidden rounded-2xl bg-slate-900 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-violet-100">
                  {wall.trial === 1
                    ? tr('أتممتَ أسبوعك المجّانيّ')
                    : `أتممتَ ${wall.trial} أسابيع مجّانيّة`}
                </p>

                <h2 className="mt-1 text-lg font-bold">
                  الأسبوع {wall.week} يحتاج اشتراكاً
                </h2>

                <p className="mt-0.5 text-sm leading-relaxed text-violet-50">
                  {wall.pending
                    ? tr('طلبك وصلنا — سنتواصل معك خلال يوم عمل.')
                    : tr('بقيّة الدورة ثلاثة وعشرون أسبوعاً تنتهي بمستوى B1.')}
                </p>
              </div>

              <Link
                href="/upgrade"
                className="shrink-0 rounded-xl bg-white px-6 py-3 font-semibold text-violet-700
                           transition hover:bg-violet-50 active:scale-[.98]"
              >
                {wall.pending ? tr('حالة طلبك') : <>{tr('اشترك للمتابعة')} <ArrowLeft aria-hidden size={15} className="inline-block align-[-3px]" /></>}
              </Link>
            </div>

            {/* وأسبوعه الأول يبقى مفتوحاً — المراجعة خيرٌ من الانتظار */}
            {resume && (
              <div className="border-t border-violet-500/40 bg-violet-700/40 px-6 py-3">
                <Link
                  href={`/week/${resume.number}/day/1`}
                  className="text-sm leading-relaxed text-violet-50 hover:underline"
                >
                  {tr('وريثما نتواصل: راجع الأسبوع')} {resume.number} — {resume.title_ar}
                </Link>
              </div>
            )}
          </section>
        ) : dueTest ? (
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-violet-300">
            <div className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-700">
                  <ClipboardCheck aria-hidden size={16} />
                  {dueTest.placement ? tr('اختبار قبل البدء') : tr('اختبار المستوى')}
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {dueTest.placement
                    ? tr('ابدأ باختبار قبل البدء')
                    : tr('أنهيت :level! حان وقت الاختبار', { level: dueTest.level })}
                </h2>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                  {dueTest.placement
                    ? tr(':n دقيقة تعرف بها مستواك اليوم، لتقارنه بنفسك لاحقاً.', { n: dueTest.minutes })
                    : tr('اختبار حقيقيّ في :n دقيقة. تنجح بـ60% فينفتح لك المستوى التالي.', { n: dueTest.minutes })}
                </p>
              </div>

              <Link
                href="/tests"
                className="stamp shrink-0 px-6 py-3 font-semibold transition hover:bg-violet-700 active:scale-[.98]"
              >
                {tr('ابدأ الاختبار')} <ArrowLeft aria-hidden size={15} className="inline-block align-[-3px]" />
              </Link>
            </div>

            {resume && (
              <div className="border-t border-slate-100 bg-slate-50 px-6 py-3">
                <Link
                  href={`/week/${resume.number}/day/${resume.number === stats.current_week ? stats.current_day : 1}`}
                  className="text-sm text-slate-600 hover:text-violet-700 hover:underline"
                >
                  {dueTest.placement
                    ? tr('أو ابدأ الأسبوع الأول مباشرة')
                    : tr('أو تابع الأسبوع :n', { n: resume.number })}
                </Link>
              </div>
            )}
          </section>
        ) : resume ? (
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-violet-700">{tr('تابع من هنا')}</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  الأسبوع {resume.number} · اليوم{' '}
                  {resume.number === stats.current_week ? stats.current_day : 1}
                </h2>
                <p className="mt-0.5 truncate text-sm text-slate-600">
                  {resume.title_ar}
                </p>
              </div>

              <Link
                href={`/week/${resume.number}/day/${
                  resume.number === stats.current_week ? stats.current_day : 1
                }`}
                className="stamp shrink-0 px-6 py-3 font-semibold
                           transition hover:bg-violet-700 active:scale-[.98]"
              >
                {tr('ابدأ اليوم')} <ArrowLeft aria-hidden size={15} className="inline-block align-[-3px]" />
              </Link>
            </div>

            {/* حالة الجدول */}
            <div
              className={`border-t px-6 py-3 ${
                scheduleTone === 'emerald'
                  ? 'border-emerald-100 bg-emerald-50/60'
                  : scheduleTone === 'amber'
                    ? 'border-amber-100 bg-amber-50/60'
                    : 'border-rose-100 bg-rose-50/60'
              }`}
            >
              <p
                className={`text-sm leading-relaxed ${
                  scheduleTone === 'emerald'
                    ? 'text-emerald-900'
                    : scheduleTone === 'amber'
                      ? 'text-amber-900'
                      : 'text-rose-900'
                }`}
              >
                <strong>{scheduleText}</strong>
                {' — '}
                موضعك: الأسبوع {stats.current_week} اليوم {stats.current_day} · وبحسب
                الجدول: الأسبوع {stats.expected_week} اليوم {stats.expected_day}.
                {behind > 0 && tr(' يوم فائت ليس فشلاً — واصل من حيث توقّفت.')}
              </p>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
            <p className="text-sm text-slate-600">
              {tr('لا يوجد أسبوع مفتوح. تحقّق من أن المحتوى مستورد.')}
            </p>
          </section>
        )}
        </section>

        {level && <LevelCard level={level} />}

        {/*
          ============ Outside the study hour ============
          Break Time, the games and the stories are one family —
          counted, never required — so they sit together, as equal
          tiles, under one heading that says so. Before, each had its
          own colour and size and read as three unrelated interruptions
          between the level card and the course path.
        */}
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">{tr('خارج ساعة الدراسة')}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{tr('اختياريّ: يُحتسب ولا يُلزم، ولا يكسر سلسلتك.')}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {breakToday && (
              <Link href={`/week/${breakToday.week_number}#library`} className={`${TILE} sm:col-span-2`}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-fuchsia-50 text-fuchsia-600">
                  <Headphones aria-hidden size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-fuchsia-700">
                    {tr('وقت الاستراحة اليوم')}
                  </span>
                  <span className="mt-0.5 block truncate font-semibold text-slate-900">
                    {breakToday.item_label_ar ?? breakToday.activity_ar}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    {tr(':n دقيقة', { n: breakToday.minutes })}
                  </span>
                </span>
                <ChevronLeft aria-hidden size={18} className="shrink-0 text-slate-400" />
              </Link>
            )}

            <Link href="/play" className={TILE}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <Gamepad2 aria-hidden size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">{tr('للتسلية')}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-slate-500">
                  {tr('كلمة اليوم وثلاث ألعاب قصيرة')}
                </span>
              </span>
              <ChevronLeft aria-hidden size={18} className="shrink-0 text-slate-400" />
            </Link>

            <Link href="/stories" className={TILE}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600">
                <BookOpen aria-hidden size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">{tr('قصص')}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-slate-500">
                  {tr('قراءة مسموعة بمستواك')}
                </span>
              </span>
              <ChevronLeft aria-hidden size={18} className="shrink-0 text-slate-400" />
            </Link>
          </div>
        </section>

        {/* ============ الطريق: أربع وحدات ============ */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold text-slate-900">{tr('الطريق كاملاً')}</h2>
            <p className="text-xs text-slate-500">
              {contentWeeks} من 24 أسبوعاً محتواه جاهز
            </p>
          </div>

          {modules.map((m) => {
            const rows = weeks.filter((w) => w.module === m.number);
            const done = rows.filter((w) => w.days_done >= 7).length;
            const isCurrent = currentModule?.number === m.number;
            const isOpen = isCurrent || openModules.has(m.number);

            return (
              <div
                key={m.number}
                className={`overflow-hidden rounded-2xl bg-white ring-1 transition ${
                  isCurrent ? 'ring-violet-300 shadow-sm' : 'ring-slate-200'
                }`}
              >
                {/* رأس الوحدة */}
                <button
                  type="button"
                  onClick={() => !isCurrent && toggleModule(m.number)}
                  aria-expanded={isOpen}
                  className={`flex w-full flex-wrap items-center justify-between gap-3 bg-slate-50/70 px-5 py-3.5 text-start ${
                    isOpen ? 'border-b border-slate-100' : ''
                  } ${isCurrent ? 'cursor-default' : 'transition hover:bg-slate-100/70'}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">
                      الوحدة {m.number} — {m.title_ar}
                      {isCurrent && (
                        <span className="ms-2 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                          {tr('أنت هنا')}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 hidden text-xs text-slate-500 sm:block" dir="ltr">
                      {m.title_en} · weeks {m.weeks[0]}–{m.weeks[1]}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {/*
                      اتجاه السهم لا يُترك لترتيب النصّ.
                      الشارة بلا `dir` تُحلّ في سياق RTL، فيصير موضع
                      المستويين وموضع السهم رهن الخوارزمية لا القصد —
                      وقُرئت «A2+ ← B1» أي أنّ B1 يؤدّي إلى A2+. وهي
                      هنا كما في رأس الصفحة: سياق لاتينيّ وسهم يمين.
                    */}
                    <span
                      dir="ltr"
                      className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200"
                    >
                      {m.from} → {m.to}
                    </span>
                    <span className="text-xs text-slate-500">{m.words} كلمة</span>
                    <span className="text-xs font-medium text-slate-600">{done}/6</span>
                    {!isCurrent && (
                      <ChevronDown
                        aria-hidden
                        size={16}
                        className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    )}
                  </div>
                </button>

                {/* أسابيع الوحدة */}
                {isOpen && (
                <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((w) => {
                    const complete = w.days_done >= 7;
                    const isNow = w.number === stats.current_week;
                    const milestone = milestones[String(w.number)];

                    /* ثلاث حالات متمايزة، وخلطها يُربك:
                       بلا محتوى · مقفل · مفتوح */
                    if (!w.has_content) {
                      return (
                        <div
                          key={w.number}
                          className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-400">
                              الأسبوع {w.number}
                            </span>
                            {w.is_review && (
                              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-500">
                                {tr('مراجعة')}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {tr('المحتوى لم يُدخل بعد')}
                          </p>
                          {milestone && (
                            <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400"><Target aria-hidden size={11} /> {milestone}</p>
                          )}
                        </div>
                      );
                    }

                    /*
                     * Two reasons a week is shut, two sentences.
                     *
                     * Every locked tile used to read "finish week N-1
                     * first". For a learner past the free trial that is
                     * false — they did finish it — and it hides the one
                     * thing that would open the week. So a week beyond
                     * the entitlement says so, and leads to /upgrade.
                     */
                    if (!w.unlocked && wall && w.number >= wall.week) {
                      return (
                        <Link
                          key={w.number}
                          href="/upgrade"
                          className="group rounded-xl bg-white p-3.5 ring-1 ring-slate-200
                                     transition hover:ring-slate-300"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-700">
                              الأسبوع {w.number}
                            </span>
                            <Lock aria-hidden size={14} className="text-slate-400" />
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-500">{w.title_ar}</p>
                          <p className="mt-1 text-xs font-medium text-slate-500 transition group-hover:text-violet-700">
                            {tr('يحتاج اشتراكاً')} <ArrowLeft aria-hidden size={15} className="inline-block align-[-3px]" />
                          </p>
                        </Link>
                      );
                    }

                    if (!w.unlocked) {
                      return (
                        <div
                          key={w.number}
                          className="rounded-xl bg-slate-100/70 p-3.5"
                          title={`أكمل الأسبوع ${w.number - 1} أولاً`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-500">
                              الأسبوع {w.number}
                            </span>
                            <Lock aria-hidden size={14} className="text-slate-400" />
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500">{w.title_ar}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            أكمل الأسبوع {w.number - 1} أولاً
                          </p>
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={w.number}
                        href={`/week/${w.number}`}
                        className={`group rounded-xl p-3.5 ring-1 transition hover:shadow-md ${
                          complete
                            ? 'bg-emerald-50 ring-emerald-200'
                            : isNow
                              ? 'bg-violet-50 ring-violet-300'
                              : 'bg-white ring-slate-200 hover:ring-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            الأسبوع {w.number}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {w.is_review && (
                              <span className="rounded bg-slate-900 px-1.5 py-0.5 text-xs font-medium text-white">
                                {tr('مراجعة')}
                              </span>
                            )}
                            {complete && (
                              <Check aria-hidden size={16} className="text-emerald-600" />
                            )}
                          </div>
                        </div>

                        <p className="mt-1 truncate text-xs text-slate-600">{w.title_ar}</p>

                        {/* شريط الأيام السبعة */}
                        <div className="mt-2.5 flex gap-0.5">
                          {Array.from({ length: 7 }).map((_, i) => (
                            <span
                              key={i}
                              className={`h-1 flex-1 rounded-full ${
                                i < w.days_done ? 'bg-violet-700' : 'bg-slate-200'
                              }`}
                            />
                          ))}
                        </div>

                        <p className="mt-1.5 text-xs text-slate-400">
                          {w.days_done}/7 أيام
                        </p>

                        {milestone && (
                          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-slate-600">
                            <Target aria-hidden size={11} /> {milestone}
                          </p>
                        )}
                      </Link>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })}
        </section>

        {/* ============ قاعدة الكتاب ============ */}
        <p className="rounded-xl border-s-4 border-slate-300 bg-white p-4 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-200">
          <strong>{tr('80% هو الهدف لا 100%.')}</strong> {tr('من يصرّ على الكمال يتوقّف. ويوم فائت ليس فشلاً — السلسلة تسامح فجوة يوم واحد.')}
        </p>
      </main>
    </div>
  );
}
