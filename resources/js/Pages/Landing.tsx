import { Head, Link } from '@inertiajs/react';
import { useEffect, type ReactNode } from 'react';
import { BookOpen, Brain, Gamepad2, Popcorn } from 'lucide-react';
import BrandMark from '@/Components/BrandMark';
import { ReviewLegend, Staircase } from '@/Layouts/GuestLayout';
import { useT } from '@/lib/i18n';

/**
 * The front door — what a stranger sees at the bare domain.
 *
 * ── Same paper as the login page ────────────────────────────
 * Warm sheet, red margin, ink and the stamp button: the visitor who
 * clicks "start" should land on a page that looks like the one they
 * just read, not cross into another product.
 *
 * ── Written, not designed ───────────────────────────────────
 * One idea per block, in short sentences a beginner reads once:
 * you have started English before; this time there is a plan, a book
 * written for Arabic speakers, and one hour a day. The proof is
 * shown rather than claimed — a real mistake from the book's list of
 * twenty, crossed out and corrected.
 *
 * No feature grid, no testimonials we do not have, no numbers we
 * cannot stand behind: the three figures are the course itself.
 */

interface Plan {
  name_ar: string;
  months: number;
  price: string;
  note_ar: string | null;
}

/* The admin-editable text (App\Support\LandingCopy), already merged with defaults */
interface Copy {
  eyebrow: string;
  title_1: string;
  title_2: string;
  title_accent: string;
  subtitle: string;
  cta: string;
  trial_note: string;
  name_meaning: string;
  closing_title: string;
  closing_text: string;
  faq: { q: string; a: string }[];
}

interface TestRow {
  level: string;
  after_week: number;
  minutes: number;
  items: number;
}

interface SampleDay {
  focus: string;
  tasks: { order: number; label: string; minutes: number }[];
}

/* The four modules, as the book defines them (CLAUDE.md §2.2) */
const MODULES = [
  { n: 1, level: 'A1', weeks: '1–6', words: 500, ar: 'الأصوات، والمضارع البسيط، وفعل to be' },
  { n: 2, level: 'A2', weeks: '7–12', words: 1000, ar: 'الماضي، والمستقبل، والمقارنة' },
  { n: 3, level: 'A2+', weeks: '13–18', words: 1500, ar: 'المضارع التام، والأفعال الناقصة، والشرط، وكيف تقول رأيك' },
  { n: 4, level: 'B1', weeks: '19–24', words: 2000, ar: 'المبني للمجهول، والسرد، والشرط الثاني، والأفعال المركّبة' },
];

/* The top menu: anchor → label */
const SECTIONS: [string, string][] = [
  ['how', 'كيف تعمل المنصة'],
  ['content', 'المحتوى'],
  ['features', 'المميزات'],
  ['tests', 'الاختبارات'],
  ['price', 'السعر'],
  ['faq', 'أسئلة شائعة'],
];

/* One feature card: icon, title, two sentences, and a small real sample */
function Feature({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children?: ReactNode }) {
  const tr = useT();

  return (
    <article className="paper flex flex-col rounded p-6">
      <span className="folio-accent">{icon}</span>
      <h3 className="folio-ink mt-3 text-xl font-bold">{tr(title)}</h3>
      <p className="folio-soft mt-2 flex-1 text-base leading-relaxed">{tr(text)}</p>
      {children && <div className="folio-rule mt-4 border-t pt-4">{children}</div>}
    </article>
  );
}

/* A heading for each block, so the page reads like a short chapter */
function Heading({ kicker, title, id }: { kicker: string; title: string; id?: string }) {
  const tr = useT();

  return (
    <div id={id} className="mb-6 scroll-mt-32">
      <p className="folio-accent text-sm font-semibold">{tr(kicker)}</p>
      <h2 className="folio-ink mt-1 text-2xl font-bold sm:text-3xl">{tr(title)}</h2>
    </div>
  );
}

export default function Landing({
  trialWeeks = 1,
  trialDays = 0,
  plans = [],
  sampleDay = null,
  tests = [],
  storiesCount = 60,
  copy,
  whatsapp = null,
}: {
  copy: Copy;
  whatsapp?: string | null;
  storiesCount?: number;
  tests?: TestRow[];
  trialWeeks?: number;
  trialDays?: number;
  plans?: Plan[];
  sampleDay?: SampleDay | null;
}) {
  const tr = useT();

  // The menu jumps between sections: glide there, unless the reader asked for less motion
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = document.documentElement;
    root.style.scrollBehavior = 'smooth';

    return () => {
      root.style.scrollBehavior = '';
    };
  }, []);

  const dayMinutes = (sampleDay?.tasks ?? []).reduce((a, t) => a + t.minutes, 0);

  const start = (
    <Link href="/register" className="stamp inline-block px-7 py-3.5 text-base font-semibold">
      {copy.cta}
    </Link>
  );

  return (
    <div dir="rtl" className="folio min-h-screen">
      <Head title={tr('مَدارِج — الإنجليزية خطوة بخطوة')} />

      <div className="mx-auto max-w-5xl px-4 sm:px-8">
        {/*
          ═══════════ Top menu ═══════════
          Sticky, so the way to sign up and the map of the page stay in
          reach on a long scroll. On a phone the section links drop to a
          scrolling row under the logo instead of hiding behind a button.
        */}
        <header className="sticky top-0 z-30 -mx-4 border-b border-[var(--rule)] bg-[var(--paper)]/95 px-4 backdrop-blur sm:-mx-8 sm:px-8">
          <div className="flex items-center justify-between gap-4 py-4">
          <Link href="/" className="folio-ink inline-flex shrink-0 items-center gap-2.5">
            <BrandMark size={28} />
            <span className="text-xl font-bold">{tr('مَدارِج')}</span>
          </Link>

          <nav aria-label={tr('أقسام الصفحة')} className="hidden items-center gap-1 lg:flex">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="folio-soft rounded px-3 py-2 text-sm font-semibold hover:text-[var(--ink)]">
                {tr(label)}
              </a>
            ))}
          </nav>

          <nav className="flex shrink-0 items-center gap-2 sm:gap-4">
            <Link href="/login" className="folio-ink rounded px-3 py-2 text-sm font-semibold hover:underline">
              {tr('تسجيل الدخول')}
            </Link>
            <Link href="/register" className="stamp hidden px-4 py-2 text-sm font-semibold sm:inline-block">
              {tr('حساب جديد')}
            </Link>
          </nav>
          </div>

          {/* Phones and tablets: the same links as a scrolling row */}
          <nav aria-label={tr('أقسام الصفحة')} className="-mx-1 flex gap-1 overflow-x-auto pb-3 lg:hidden">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="folio-soft shrink-0 rounded px-3 py-1.5 text-sm font-semibold ring-1 ring-[var(--rule)]">
                {tr(label)}
              </a>
            ))}
          </nav>
        </header>

        {/* ═══════════ Hero ═══════════ */}
        <section className="grid items-end gap-10 pb-16 pt-8 lg:grid-cols-[1fr_auto] lg:pt-16">
          <div>
            {/* The positioning, said first and plainly: what it is, how far it goes */}
            <p className="folio-accent text-base font-semibold">{copy.eyebrow}</p>

            <h1 className="folio-ink mt-4 text-4xl font-bold leading-snug sm:text-5xl sm:leading-tight">
              {copy.title_1}
              <br />
              {copy.title_2} <span className="folio-accent">{copy.title_accent}</span>
            </h1>

            <p className="folio-soft mt-5 max-w-xl text-lg leading-relaxed">
              {copy.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-5">
              {start}
              <Link href="/login" className="folio-ink text-base font-semibold hover:underline">
                {tr('لديّ حساب')}
              </Link>
            </div>

            {trialWeeks > 0 && copy.trial_note && <p className="folio-soft mt-4 text-sm">{copy.trial_note}</p>}
          </div>

          <div className="lg:pb-2">
            <Staircase />
            <div dir="ltr" className="folio-soft mt-2 flex justify-between font-entry text-lg italic">
              <span>A1</span>
              <span>B1</span>
            </div>
            <div className="max-w-xs">
              <ReviewLegend />
            </div>
          </div>
        </section>

        {/* ═══════════ The name, as a dictionary entry ═══════════ */}
        <section className="folio-rule border-y py-8">
          <p className="folio-ink text-2xl font-bold">
            {tr('مَدارِج')}{' '}
            <span className="folio-soft text-base font-normal">{tr('(جمع مَدْرَج)')}</span>
          </p>
          <p className="folio-ink mt-2 max-w-2xl text-lg leading-relaxed">
            {copy.name_meaning}
          </p>
        </section>

        {/*
          ═══════════ Why it works this time ═══════════
          Three promises, each answering a reason people quit before:
          "I keep making the same mistakes", "I never know what to study",
          "I can't tell if I'm improving". A headline that promises, two
          plain sentences, and a small proof the eye catches first.
        */}
        <section className="py-16">
          <Heading kicker="الفرق" title="ما الفرق هذه المرة؟" />

          <div className="grid gap-5 md:grid-cols-3">
            {/* 1 — written for Arabic speakers, shown by a real mistake */}
            <article className="paper flex flex-col rounded p-6">
              <p className="folio-accent text-sm font-semibold">{tr('1 · صُمّمت لك أنت')}</p>
              <h3 className="folio-ink mt-2 text-xl font-bold leading-snug">{tr('أخيراً، دورة تفهم سبب أخطائك')}</h3>
              <p className="folio-soft mt-2 flex-1 text-base leading-relaxed">
                {tr('مبنية على كتاب كُتب خصيصاً للمتحدثين بالعربية. يعرف الأخطاء العشرين التي نقع فيها جميعاً، ويصحّحها معك واحداً بعد الآخر حتى تختفي من كلامك.')}
              </p>
              <div className="folio-rule mt-4 border-t pt-4 text-sm">
                <p className="folio-soft">{tr('ستتوقف عن قول:')}</p>
                <p dir="ltr" className="folio-soft text-end text-base line-through decoration-[var(--accent)] decoration-2">I have 30 years.</p>
                <p className="folio-soft mt-2">{tr('وتقول بكل ثقة:')}</p>
                <p dir="ltr" className="folio-ink text-end text-base font-semibold">I am 30 years old.</p>
              </div>
            </article>

            {/* 2 — a plan, not a library */}
            <article className="paper flex flex-col rounded p-6">
              <p className="folio-accent text-sm font-semibold">{tr('2 · خطة، لا مكتبة')}</p>
              <h3 className="folio-ink mt-2 text-xl font-bold leading-snug">{tr('افتح المنصة، وابدأ فوراً')}</h3>
              <p className="folio-soft mt-2 flex-1 text-base leading-relaxed">
                {tr('لا بحث، ولا حيرة، ولا عشرات الفيديوهات. مهام يومك جاهزة ومرتّبة، تنهيها في ساعة فيُفتح لك اليوم التالي. يوماً بعد يوم تتقدّم، دون أن تسأل: من أين أبدأ؟')}
              </p>
              <ul className="folio-rule mt-4 space-y-1.5 border-t pt-4 text-sm">
                <li className="folio-soft flex items-center gap-2"><span className="folio-accent font-bold">✓</span>{tr('اليوم 1 · تمّ')}</li>
                <li className="folio-soft flex items-center gap-2"><span className="folio-accent font-bold">✓</span>{tr('اليوم 2 · تمّ')}</li>
                <li className="folio-ink flex items-center gap-2 font-semibold"><span aria-hidden>←</span>{tr('اليوم 3 · ينتظرك الآن')}</li>
              </ul>
            </article>

            {/* 3 — listening first, your voice as proof */}
            <article className="paper flex flex-col rounded p-6">
              <p className="folio-accent text-sm font-semibold">{tr('3 · تسمع أولاً، ثم تتكلم')}</p>
              <h3 className="folio-ink mt-2 text-xl font-bold leading-snug">{tr('بعد 24 أسبوعاً، ستسمع الفرق بنفسك')}</h3>
              <p className="folio-soft mt-2 flex-1 text-base leading-relaxed">
                {tr('تسمع كل كلمة قبل أن تنطقها، وتسجّل صوتك كل أسبوع. وفي النهاية تضع تسجيلك الأول بجانب الأخير… وتبتسم.')}
              </p>
              <div className="folio-rule mt-4 space-y-2 border-t pt-4 text-sm">
                <p className="folio-soft flex items-center justify-between gap-3">
                  <span>{tr('تسجيلك في الأسبوع 1')}</span>
                  <span aria-hidden className="tracking-tight opacity-60" dir="ltr">▮▯▮▯▯▮▯</span>
                </p>
                <p className="folio-ink flex items-center justify-between gap-3 font-semibold">
                  <span>{tr('تسجيلك في الأسبوع 24')}</span>
                  <span aria-hidden className="folio-accent tracking-tight" dir="ltr">▮▮▮▮▮▮▮</span>
                </p>
              </div>
            </article>
          </div>
        </section>

        {/* ═══════════ How it runs, start to finish ═══════════ */}
        <section className="folio-rule border-t py-16">
          <Heading id="how" kicker="الطريق" title="كيف تعمل المنصة؟" />
          <ol className="space-y-6">
            {[
              {
                t: 'اختبار قبل البداية (اختياري)',
                d: 'في 30 دقيقة تعرف مستواك الحالي. الاختبار للمعرفة فقط ولا ينقلك إلى مرحلة أعلى: الجميع يبدأ من الأسبوع الأول، لأن كل أسبوع مبني على ما قبله.',
              },
              {
                t: 'خطة كل يوم',
                d: 'تفتح المنصة فتجد مهام يومك مرتّبة: نطق، وكلمات، وقاعدة، وحوار، وتمرين. وعندما تنهيها يُفتح لك اليوم التالي.',
              },
              {
                t: 'تسجيل صوتك كل أسبوع',
                d: 'تتكلّم دقيقة أو أكثر عن موضوع الأسبوع وتحفظ التسجيل. يبقى على جهازك أنت، ولا يُرفع إلى أي مكان.',
              },
              {
                t: 'أسبوع مراجعة واختبار كل 5 أسابيع',
                d: 'في الأسابيع 6 و12 و18 و24 تراجع ما تعلّمته، ثم تدخل اختباراً حقيقياً بوقت محدّد على طريقة اختبارات كامبريدج. تنجح بـ60% فتنتقل إلى الوحدة التالية.',
              },
              {
                t: 'مستوى B1 بعد 24 أسبوعاً',
                d: 'تفهم الحديث اليومي، وتحكي ما حدث معك، وتكتب رسالة، وتعبّر عن رأيك بجمل صحيحة.',
              },
            ].map((s, i) => (
              <li key={s.t} className="flex gap-4">
                <span className="folio-ink grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-current font-entry text-lg">
                  {i + 1}
                </span>
                <div>
                  <p className="folio-ink text-lg font-bold">{tr(s.t)}</p>
                  <p className="folio-soft mt-1 max-w-2xl text-base leading-relaxed">{tr(s.d)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ═══════════ A real day, as the learner will see it ═══════════ */}
        {sampleDay && sampleDay.tasks.length > 0 && (
          <section className="folio-rule border-t py-16">
            <Heading kicker="يوم حقيقي" title="هذا يومك الأول، كما هو" />
            <div className="paper max-w-2xl rounded p-6">
              <p className="folio-soft text-sm">
                {tr('الأسبوع 1 · اليوم 1')} · {sampleDay.focus}
              </p>
              <ul className="mt-4 space-y-3">
                {sampleDay.tasks.map((t) => (
                  <li key={t.order} className="folio-rule flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
                    <span className="folio-ink text-base">{t.label}</span>
                    <span className="folio-soft shrink-0 text-sm">{tr(':n دقيقة', { n: t.minutes })}</span>
                  </li>
                ))}
              </ul>
              <p className="folio-ink mt-4 text-base font-semibold">
                {tr('المجموع: :n دقيقة', { n: dayMinutes })}
              </p>
            </div>
          </section>
        )}

        {/* ═══════════ What the four modules teach ═══════════ */}
        <section className="folio-rule border-t py-16">
          <Heading id="content" kicker="المحتوى" title="ماذا ستتعلّم؟" />
          <div className="grid gap-4 sm:grid-cols-2">
            {MODULES.map((m) => (
              <div key={m.n} className="paper rounded p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="folio-ink text-lg font-bold">{tr('الوحدة :n', { n: m.n })}</p>
                  <span dir="ltr" className="folio-accent font-entry text-2xl italic">{m.level}</span>
                </div>
                <p className="folio-soft text-sm">
                  {tr('الأسابيع')} <span dir="ltr">{m.weeks}</span> · {tr(':n كلمة', { n: m.words })}
                </p>
                <p className="folio-ink mt-3 text-base leading-relaxed">{tr(m.ar)}</p>
              </div>
            ))}
          </div>

        </section>

        {/*
          ═══════════ Beyond the daily hour ═══════════
          The three features learners use outside the plan. Each card
          says what it does in one or two sentences and shows a small
          real sample — a story title, the game names, a saved word —
          so the claim can be pictured, not just read.
        */}
        <section className="folio-rule border-t py-16">
          <Heading id="features" kicker="المميزات" title="خارج أوقات المذاكرة؟ وجدنا لك الحل" />
          <p className="folio-soft -mt-3 mb-6 max-w-2xl text-lg leading-relaxed">
            {tr('حتى لا يضيع وقتك، رتّبنا لك كل شيء: ماذا تشاهد، وماذا تلعب، وماذا تقرأ.')}
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Break Time (§12 of every chapter): songs, films and stories for days off */}
            <Feature
              icon={<Popcorn size={22} />}
              title="خطة للإجازة وأوقات الفراغ"
              text="أغانٍ وأفلام وقصص نختارها لك كل أسبوع، ونرافقك فيها من الألف إلى الياء: ماذا تشاهد، وماذا تلاحظ، وماذا تقول بعدها. تتعلّم وأنت تستمتع."
            >
              <ol className="folio-ink space-y-1 text-sm">
                <li>{tr('1. شاهد المقطع أو استمع إلى الأغنية.')}</li>
                <li>{tr('2. التقط الكلمات التي تعرفها.')}</li>
                <li>{tr('3. أجب عن سؤال قصير بجملة من عندك.')}</li>
              </ol>
            </Feature>

            <Feature
              icon={<Brain size={22} />}
              title="الذاكرة: كلماتك أنت"
              text="صادفت كلمة في فيلم أو أغنية؟ اكتبها في دفترك من أي صفحة، وستظهر لك ترجمتها. ثم تراجعها في الوقت المناسب حتى تثبت في ذاكرتك."
            >
              <p dir="ltr" className="text-base">
                <span className="folio-ink font-semibold">journey</span>
                <span className="folio-soft"> — </span>
                <span className="folio-soft" dir="rtl">{tr('رحلة')}</span>
              </p>
            </Feature>

            <Feature
              icon={<Gamepad2 size={22} />}
              title="التسلية: ألعاب قصيرة"
              text="دقيقة واحدة تكفي. ألعاب مبنية على كلماتك وأخطائك أنت، لا تؤثّر على تقدّمك، لكنها تشجّعك على العودة كل يوم."
            >
              <ul className="folio-ink space-y-1 text-sm">
                <li>{tr('كلمة اليوم: لغز جديد كل يوم')}</li>
                <li>{tr('سباق الأزواج: 60 ثانية')}</li>
                <li>{tr('صدى: تمييز الأصوات بالسمع')}</li>
                <li>{tr('صيد الخطأ: الأخطاء العشرون')}</li>
              </ul>
            </Feature>

            <Feature
              icon={<BookOpen size={22} />}
              title="القصص: قراءة مسموعة"
              text={tr(':n قصة من حكايات العالم، مكتوبة على قدر مستواك. تقرأ وتستمع، وتضغط على أي جملة لتسمعها وحدها.', { n: storiesCount })}
            >
              <p className="folio-soft text-sm">
                {tr('من حكايات إيسوب، وألف ليلة وليلة، وكليلة ودمنة، وجحا، وأندرسن.')}
              </p>
            </Feature>
          </div>
        </section>

        {/*
          ═══════════ A real test at every level ═══════════
          Read from the level_tests table, so the minutes and question
          counts on this page are the ones the learner will sit.
        */}
        {tests.length > 0 && (
          <section className="folio-rule border-t py-16">
            <Heading id="tests" kicker="الاختبارات" title="اختبار حقيقي في نهاية كل مستوى" />

            <p className="folio-ink max-w-2xl text-lg leading-relaxed">
              {tr('لا تنتقل إلى المستوى التالي لأنك أنهيت الأيام، بل لأنك نجحت. كل اختبار مبني على طريقة اختبارات كامبريدج العالمية، ومعايير الإطار الأوروبي للغات.')}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {tests.map((t) => (
                <div key={t.level} className="paper rounded p-4">
                  <p className="folio-soft text-sm">
                    {t.after_week === 0 ? tr('قبل البداية') : tr('بعد الأسبوع :w', { w: t.after_week })}
                  </p>
                  <p dir="ltr" className="folio-accent mt-1 text-end font-entry text-3xl italic">
                    {t.after_week === 0 ? 'A1–B1' : t.level}
                  </p>
                  <p className="folio-soft mt-2 text-sm">
                    {tr(':m دقيقة · :q سؤالاً', { m: t.minutes, q: t.items })}
                  </p>
                </div>
              ))}
            </div>

            <ul className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
              {[
                'خمسة أقسام: استماع، وقراءة، وقواعد، ومفردات، وكتابة.',
                'وقت محدّد يحسبه الخادم، لا يتوقف ولا يُعاد.',
                'تسمع كل تسجيل مرتين فقط، كما في الاختبار الحقيقي.',
                'التصحيح على الخادم، فلا أحد يرى الإجابات قبلك.',
                'تنجح بـ60%، وتعرف تقديرك: امتياز، أو جيد جداً، أو ناجح.',
                'تعرف أضعف قسم عندك، ومعه نصائح لما تراجعه.',
              ].map((x) => (
                <li key={x} className="folio-ink flex gap-2 text-base leading-relaxed">
                  <span className="folio-accent font-bold">✓</span>
                  {tr(x)}
                </li>
              ))}
            </ul>

            <p className="folio-soft mt-6 max-w-2xl text-sm leading-relaxed">
              {tr('اختبار ما قبل البداية للمعرفة فقط: يعطيك مستواك الحالي، والدورة تبدأ من الأسبوع الأول للجميع.')}
            </p>
          </section>
        )}

        {/* ═══════════ Price — from the admin panel, never typed here ═══════════ */}
        {(plans.length > 0 || trialDays > 0 || trialWeeks > 0) && (
          <section className="folio-rule border-t py-16">
            <Heading id="price" kicker="السعر" title="ابدأ مجاناً، ثم اختر مدّتك" />

            {(trialDays > 0 || trialWeeks > 0) && (
              <p className="folio-ink mb-6 max-w-2xl text-lg leading-relaxed">
                {trialWeeks === 1
                  ? tr('الأسبوع الأول كاملاً مجاناً: 7 أيام من الدروس تجرّب فيها الدورة بنفسك، بلا بطاقة دفع.')
                  : trialWeeks > 1
                    ? tr('أول :w أسابيع مجاناً، بلا بطاقة دفع.', { w: trialWeeks })
                    : tr('عندك :d أيام مجانية تجرّب فيها الدورة بنفسك، بلا بطاقة دفع.', { d: trialDays })}
              </p>
            )}

            {plans.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {plans.map((p) => (
                  <div key={p.name_ar} className="paper rounded p-6">
                    <p className="folio-ink text-lg font-bold">{p.name_ar}</p>
                    <p className="folio-accent mt-1 text-3xl font-bold">{p.price}</p>
                    {p.note_ar && <p className="folio-soft mt-2 text-sm leading-relaxed">{p.note_ar}</p>}
                  </div>
                ))}
              </div>
            )}

            <p className="folio-soft mt-4 text-sm">{tr('لا يوجد دفع داخل الموقع: ترسل طلبك، ونتواصل معك لإتمام الاشتراك.')}</p>
          </section>
        )}

        {/* ═══════════ Who it is for ═══════════ */}
        <section className="folio-rule grid gap-6 border-t py-16 md:grid-cols-2">
          <div>
            <Heading kicker="لمن؟" title="هذه الدورة لك لو…" />
            <ul className="space-y-3">
              {[
                'تبدأ من الصفر، أو تعرف كلمات متفرّقة بلا أساس.',
                'تتكلّم العربية، وتريد شرحاً يفهم طريقة تفكيرك.',
                'تستطيع أن تخصّص ساعة كل يوم.',
                'تريد أن تتكلّم وتكتب، لا أن تحفظ قوائم كلمات فقط.',
              ].map((x) => (
                <li key={x} className="folio-ink flex gap-2 text-base leading-relaxed">
                  <span className="folio-accent font-bold">✓</span>
                  {tr(x)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Heading kicker="بصراحة" title="وليست لك لو…" />
            <ul className="space-y-3">
              {[
                'تبحث عن لعبة تفتحها دقيقة متى شئت.',
                'مستواك فوق B1 وتريد التحضير لاختبار مثل IELTS.',
                'تنتظر نتيجة بلا تدريب يومي.',
              ].map((x) => (
                <li key={x} className="folio-soft flex gap-2 text-base leading-relaxed">
                  <span className="font-bold">✗</span>
                  {tr(x)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ═══════════ Questions ═══════════ */}
        <section className="folio-rule border-t py-16">
          <Heading id="faq" kicker="أسئلة" title="أسئلة يسألها الناس قبل أن يبدؤوا" />
          <div className="max-w-3xl divide-y divide-[var(--rule)]">
            {copy.faq.map(({ q, a }) => (
              <details key={q} className="group py-4">
                <summary className="folio-ink flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                  {q}
                  <span aria-hidden className="folio-accent text-2xl transition group-open:rotate-45">+</span>
                </summary>
                <p className="folio-soft mt-2 text-base leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ═══════════ The course in three numbers ═══════════ */}
        <section className="folio-rule border-t py-10">
          <dl className="grid max-w-xl grid-cols-3">
            {[
              ['24', 'أسبوعاً'],
              ['1', 'ساعة في اليوم'],
              ['2000', 'كلمة'],
            ].map(([n, label]) => (
              <div key={label}>
                <dt className="folio-ink font-entry text-4xl">{n}</dt>
                <dd className="folio-soft mt-1 text-sm">{tr(label)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ═══════════ Closing ═══════════ */}
        <section className="pb-20 pt-10 text-center">
          <h2 className="folio-ink text-3xl font-bold leading-snug sm:text-4xl">{copy.closing_title}</h2>
          <p className="folio-soft mx-auto mt-3 max-w-md text-lg leading-relaxed">
            {copy.closing_text}
          </p>
          <div className="mt-8">{start}</div>
        </section>

        <footer className="folio-rule folio-soft border-t py-6 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2">
              <BrandMark size={18} />
              {tr('مَدارِج')}
            </span>
            <span>{tr('من A1 إلى B1 في 24 أسبوعاً')}</span>
          </div>
          <p className="mt-3 text-center">
            © {new Date().getFullYear()} {tr('مَدارِج. جميع الحقوق محفوظة.')}
          </p>
        </footer>
      </div>

      {/*
        WhatsApp support, from the admin panel (صفحة الهبوط). Fixed to
        the left — the free corner in an RTL page — and hidden when no
        number is set, rather than linking to nowhere.
      */}
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={tr('تواصل معنا على واتساب')}
          className="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-95"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <svg aria-hidden viewBox="0 0 32 32" width="22" height="22" fill="currentColor">
            <path d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.6l-.4-.2-3.8 1.2 1.2-3.7-.3-.4c-1.2-1.8-1.8-3.8-1.8-5.9C5 9.9 9.9 5.2 16 5.2s11 4.7 11 10.6-4.9 10.6-11 10.6zm6-7.9c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.7-1.6-1-.9-1.7-2-1.9-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.6.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.1 1.4 3.3c.2.2 2.4 3.6 5.7 5 .8.3 1.4.5 1.9.7.8.2 1.5.2 2.1.1.6-.1 2-.8 2.2-1.6.3-.8.3-1.4.2-1.6-.1-.1-.3-.2-.6-.3z" />
          </svg>
          <span className="hidden sm:inline">{tr('الدعم الفني')}</span>
        </a>
      )}
    </div>
  );
}
