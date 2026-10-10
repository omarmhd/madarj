import { useState, ReactNode } from 'react';
import BrandMark from '@/Components/BrandMark';
import Bdi from '@/Components/Bdi';
import MemoryLauncher from '@/Components/Memory/MemoryLauncher';
import { Link, usePage } from '@inertiajs/react';
import { useT } from '@/lib/i18n';
import { BookOpen, ChartNoAxesColumn, ClipboardCheck, Crosshair, Lock, Flame, LogOut, Play, Settings2, UserRound } from 'lucide-react';

/**
 * شريط التنقّل المشترك.
 *
 * ثمانون بالمئة من المتدرّبين على الموبايل، فالتنقّل مبنيّ للإبهام:
 *
 *   على الموبايل  — شريط **سفليّ** بأربع تبويبات كبيرة، لأن أعلى
 *                   الشاشة أبعد ما يكون عن الإبهام. وأعلى الشاشة
 *                   يحمل سطراً رقيقاً للهوية والسلسلة فقط.
 *   على الحاسوب   — شريط علويّ واحد كالمعتاد.
 *
 * وكل تبويب يحمل أيقونة **ونصّاً**: الأيقونة وحدها تخمين، والمتدرّب
 * المبتدئ لا يخمّن — يتوقّف.
 *
 * ── عقد الهيكل ─────────────────────────────────────────────
 * كل صفحة تحمل هذا الشريط تلتزم بثلاثة:
 *
 *   1. عرض الحاويات `max-w-4xl` — الرأس والمتن وأي شريط ملتصق.
 *   2. أي شريط ملتصق داخل الصفحة يبدأ من `top-11 sm:top-14 z-30` —
 *      لأن الشريط العلويّ `h-11` على الموبايل و`h-14` على الحاسوب.
 *   3. حاوية الصفحة تنتهي بـ`pb-28 sm:pb-20` — وإلا اختفى آخر
 *      محتواها تحت الشريط السفليّ.
 * ───────────────────────────────────────────────────────────
 */

interface Tab {
  href: string;
  label: string;
  icon: ReactNode;
  /** يُطابق بداية المسار لتحديد النشط */
  match: string;
  /** The subscription feature behind this tab, if any */
  feature?: string;
}

export default function AppNav() {
  const tr = useT();
  // بلا وسيط نوعي: PageProps يشترط user غير فارغ، والشريط قد يُعرض
  // في صفحة لم يُحمّل فيها المستخدم بعد
  const { url, props } = usePage();
  const [menuOpen, setMenuOpen] = useState(false);

  const user = (props as any).auth?.user as
    | { name: string; email: string }
    | undefined;

  // من الـ props المشتركة لا من الصفحة — لئلا تنسى صفحة شيئاً
  const nav = ((props as any).nav ?? {}) as {
    week?: number;
    day?: number;
    streak?: number;
  };
  const { week: resumeWeek, day: resumeDay, streak } = nav;

  // Trial / subscription status from the shared props: locked tabs get a lock
  const access = ((props as any).access ?? null) as {
    status: string;
    days_left: number | null;
    features: Record<string, boolean>;
  } | null;
  const locked = (f?: string) => !!f && access?.features?.[f] === false;

  /**
   * التبويبات الستّ. «ادرس الآن» أبرزها وهي الأهمّ: تفتح يوم
   * المتدرّب الحالي مباشرة، فلا يحتاج أن يتذكّر أين توقّف.
   */
  const TABS: Tab[] = [
    { href: '/dashboard', label: tr('تقدّمي'), icon: <ChartNoAxesColumn size={17} />, match: '/dashboard' },
    {
      href: resumeWeek ? `/week/${resumeWeek}/day/${resumeDay ?? 1}` : '/dashboard',
      label: tr('ادرس الآن'),
      icon: <Play size={17} />,
      match: '/week/',
      feature: 'lessons',
    },
    /*
     * The game earns a tab of its own.
     *
     * It first went in as a card on the dashboard, four sections
     * down — and a sixty-second game nobody can find is a game
     * nobody plays. Its whole value is the day the learner has no
     * intention of studying, which is precisely the day they never
     * scroll the dashboard.
     */
    // The level tests: the pre-test before day one, then one per module
    { href: '/tests', label: tr('اختبارات'), icon: <ClipboardCheck size={17} />, match: '/tests', feature: 'tests' },
    { href: '/play', label: tr('تسلية'), icon: <Crosshair size={17} />, match: '/play', feature: 'play' },
    /*
     * القصص تبويب لا بطاقة، للسبب نفسه الذي أعطى اللعبة تبويباً:
     * قيمتها في اليوم الذي لا نيّة فيه للدراسة، وهو اليوم الذي لا
     * يُفتح فيه شيء يحتاج بحثاً.
     */
    { href: '/stories', label: tr('قصص'), icon: <BookOpen size={17} />, match: '/stories', feature: 'stories' },
    { href: '/profile', label: tr('حسابي'), icon: <UserRound size={17} />, match: '/profile' },
  ];

  const isActive = (m: string) => url.startsWith(m);

  return (
    <>
      {/* ═══════════ أعلى الشاشة ═══════════ */}
      {/*
        The last three days of the trial are announced, not discovered:
        a learner who meets the wall without warning reads it as a
        trick, one who was told reads it as a deadline.
      */}
      {access?.status === 'trial' && access.days_left !== null && access.days_left <= 3 && (
        <Link
          href="/upgrade"
          className="block bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-900 hover:bg-amber-100"
        >
          {access.days_left <= 1
            ? tr('تنتهي تجربتك المجّانيّة اليوم — اشترك لتكمل')
            : access.days_left === 2
              ? tr('باقي يومان من تجربتك المجّانيّة — اشترك لتكمل')
              : tr('باقي :n أيام من تجربتك المجّانيّة — اشترك لتكمل', { n: access.days_left })}
        </Link>
      )}

      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-11 max-w-4xl items-center gap-2 px-4 sm:h-14">
          {/*
            The mark, not a placeholder.

            This was a violet tile reading `A1` beside the name
            «إنجليزيتك» — a level label standing in for a logo, and
            the wrong name besides. The three ascending steps are
            what «مَدارِج» means, and they carry the same identity
            here as on the sign-in screen.
          */}
          <Link
            href="/dashboard"
            aria-label={tr('مَدارِج')}
            className="flex shrink-0 items-center gap-2 text-violet-600"
          >
            <BrandMark size={24} className="sm:h-7 sm:w-7" />
            <span className="text-sm font-bold text-slate-900">{tr('مَدارِج')}</span>
          </Link>

          {/*
            روابط الحاسوب — مخفيّة على الموبايل، فالشريط السفليّ يتولّاها.

            وتُستثنى «حسابي» وحدها لأنّ للحاسوب قائمة حساب في الطرف.
            وكان الاستثناء مكتوباً `slice(0, 4)` حين كانت التبويبات
            خمساً — فلمّا أُضيفت «قصص» سقطت معها صامتةً. الرقم السحريّ
            يصمت، والقاعدة المكتوبة لا تصمت.
          */}
          <div className="hidden min-w-0 flex-1 gap-1 overflow-x-auto px-2 sm:flex">
            {TABS.filter((t) => t.match !== '/profile').map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm
                            transition ${
                              isActive(t.match)
                                ? 'bg-violet-50 font-medium text-violet-700'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
              >
                <span aria-hidden>{locked(t.feature) ? <Lock size={15} /> : t.icon}</span>
                {t.label === tr('ادرس الآن') && resumeWeek
                  ? `الأسبوع ${resumeWeek} · اليوم ${resumeDay ?? 1}`
                  : t.label}
              </Link>
            ))}
          </div>

          <div className="flex-1 sm:hidden" />

          {/* السلسلة — أقوى محفّز في المنصة، فلا تُخفى في أي شاشة */}
          {typeof streak === 'number' && (
            <span
              title={tr("سلسلة الأيام المتصلة")}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-2 py-1
                         text-sm font-semibold text-amber-700 sm:px-2.5 sm:py-1.5"
            >
              <Flame aria-hidden size={15} />
              {streak}
            </span>
          )}

          {/* قائمة الحساب — على الحاسوب فقط، والموبايل له تبويب «حسابي» */}
          <div className="relative hidden shrink-0 sm:block">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-sm
                         font-bold text-slate-700 transition hover:bg-slate-200"
              aria-label={tr("قائمة الحساب")}
            >
              {user?.name?.charAt(0)?.toUpperCase() ?? tr('؟')}
            </button>

            {menuOpen && (
              <>
                {/* طبقة الإغلاق — النقر خارج القائمة يغلقها */}
                <button
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
                />

                <div
                  className="absolute end-0 z-50 mt-2 w-56 overflow-hidden rounded-xl bg-white
                             shadow-lg ring-1 ring-slate-200"
                >
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      <Bdi>{user?.name}</Bdi>
                    </p>
                    <p className="truncate text-xs text-slate-500" dir="ltr">
                      {user?.email}
                    </p>
                  </div>

                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <UserRound aria-hidden size={15} />
                    {tr('ملفّي وتقدّمي')}
                  </Link>

                  <Link
                    href="/setup"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Settings2 aria-hidden size={15} />
                    {tr('الصوت والوضع والترجمة')}
                  </Link>

                  <Link
                    href="/logout"
                    method="post"
                    as="button"
                    className="block w-full border-t border-slate-100 px-4 py-2.5 text-start
                               text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut aria-hidden size={15} className="inline-block align-[-3px]" /> {tr('تسجيل الخروج')}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ═══════════ أسفل الشاشة — الموبايل ═══════════

           يختفي داخل صفحة اليوم: هناك شريط «التالي» يشغل هذا الموضع،
           وشريطان فوق بعضهما يأكلان ثلث شاشة الهاتف. والمتدرّب في
           درسٍ لا يتنقّل — يتقدّم؛ والعودة متاحة من شعار الأعلى.
      */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95
                   backdrop-blur sm:hidden`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-4xl">
          {TABS.map((t) => {
            const on = isActive(t.match);
            const isStudy = t.label === tr('ادرس الآن');

            return (
              <Link
                key={t.label}
                href={t.href}
                aria-current={on ? 'page' : undefined}
                // 64 بكسل ارتفاعاً: أصغر من ذلك يُخطئه الإبهام
                className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5
                            transition active:scale-95 ${
                              on ? 'text-violet-700' : 'text-slate-500'
                            }`}
              >
                <span
                  aria-hidden
                  // Narrower again at six tabs: a 320px screen gives
                  // each one 53px, and a 48px pill leaves no gutter
                  className={`grid h-8 w-10 place-items-center rounded-xl text-lg transition ${
                    on ? 'bg-violet-50' : ''
                  }`}
                >
                  {locked(t.feature) ? <Lock size={17} /> : t.icon}
                </span>
                {/* العناوين عربية: النقاط تُمحى دون 12 بكسل */}
                <span className={`text-xs ${on ? 'font-semibold' : ''}`}>
                  {isStudy && resumeWeek ? `اليوم ${resumeDay ?? 1}` : t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ═══════════ الذاكرة ═══════════
           زرٌّ عائم في كل صفحة: الكلمة تصادف المتدرّب في درسه لا في
           لوحته. وموضعه يعلو حين يوجد شريط تنقّل سفليّ، وينزل حين
           لا يوجد — فلا يغطّي أحدهما الآخر. */}
      {/* Locked in this trial: hidden, since every call behind it would be refused */}
      {user && !locked('memory') && <MemoryLauncher />}
    </>
  );
}
