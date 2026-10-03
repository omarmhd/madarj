import { Link } from '@inertiajs/react';
import { PropsWithChildren } from 'react';
import BrandMark from '@/Components/BrandMark';
import { useT } from '@/lib/i18n';

/**
 * The frame around every unauthenticated screen.
 *
 * ── A page of the book, not a landing page ──────────────────
 * The previous frame was the generic split hero: a saturated
 * panel, blurred discs, an emoji list. It could have fronted any
 * product. This one borrows from the only thing that is ours —
 * the book: warm paper, ruled lines, a red margin, a folio in the
 * corner. The form is written on the page like an exercise.
 *
 * ── The staircase is the claim ──────────────────────────────
 * The name means "ascending stages". Twenty-four bars, one per
 * week, grouped by module, review weeks in the accent colour —
 * the whole course drawn in one glance, with no slogan to doubt.
 *
 * ── Colours live in CSS variables (`.folio` in app.css) ────
 * The dark-mode layer remaps Tailwind classes; arbitrary colours
 * would escape it. Variables let the page flip as one unit.
 */

const MODULES = [1, 2, 3, 4];
const REVIEW_WEEKS = new Set([6, 12, 18, 24]);

export function Staircase() {
  return (
    <div aria-hidden className="flex items-end gap-2 min-[360px]:gap-3" dir="ltr">
      {MODULES.map((m) => (
        <div key={m} className="flex items-end gap-0.5 min-[360px]:gap-1">
          {Array.from({ length: 6 }, (_, i) => {
            const week = (m - 1) * 6 + i + 1;
            return (
              <span
                key={week}
                className={`folio-step ${REVIEW_WEEKS.has(week) ? 'is-review' : ''}`}
                style={{
                  height: `${10 + week * 5}px`,
                  animationDelay: `${week * 35}ms`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Key to the staircase: each bar is a week, the red ones are test weeks */
export function ReviewLegend() {
  const tr = useT();

  return (
    <div className="folio-soft mt-3 space-y-1.5 text-sm leading-relaxed">
      <p className="flex items-center gap-2">
        <span className="folio-step inline-block !h-3 shrink-0" />
        {tr('كل عمود أسبوع من الدروس.')}
      </p>
      <p className="flex items-center gap-2">
        <span className="folio-step is-review inline-block !h-3 shrink-0" />
        {tr('العمود الأحمر أسبوع مراجعة: كل 5 أسابيع تراجع ما تعلّمته، ثم تختبر نفسك قبل أن تصعد.')}
      </p>
    </div>
  );
}

export default function Guest({ children }: PropsWithChildren) {
  const tr = useT();

  return (
    <div dir="rtl" className="folio min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-8 sm:py-8">
        {/* ═══════════ Running head ═══════════ */}
        <header className="flex items-center justify-between">
          <Link href="/" className="folio-ink inline-flex items-center gap-2.5">
            <BrandMark size={28} />
            <span className="text-xl font-bold">{tr('مَدارِج')}</span>
          </Link>
          <span className="folio-soft text-sm">{tr('الصفحة 1 من 754')}</span>
        </header>

        <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[1fr_26rem] lg:gap-16">
          {/* ═══════════ The course in one glance ═══════════ */}
          <section className="order-2 lg:order-1">
            <p className="folio-accent text-sm font-semibold">{tr('منصة متكاملة من A1 إلى B1')}</p>

            <h1 className="folio-ink mt-3 text-3xl font-bold leading-snug lg:text-5xl lg:leading-tight">
              {tr('درجة كل أسبوع،')}
              <br />
              {tr('حتى')} <span dir="ltr" className="font-entry italic">B1</span>
            </h1>

            <div className="mt-8 lg:mt-12">
              <Staircase />
              <div dir="ltr" className="folio-soft mt-2 flex justify-between font-entry text-lg italic">
                <span>A1</span>
                <span>B1</span>
              </div>
            </div>

            <dl className="folio-rule mt-6 grid max-w-md grid-cols-3 border-t pt-4">
              {[
                ['24', 'أسبوعاً'],
                ['168', 'يوم'],
                ['2000', 'كلمة'],
              ].map(([n, label]) => (
                <div key={label}>
                  <dt className="folio-ink font-entry text-3xl">{n}</dt>
                  <dd className="folio-soft text-sm">{tr(label)}</dd>
                </div>
              ))}
            </dl>
            {/*
              The legend says what the red bar means, not just which
              weeks are red: "review weeks 6 · 12 · 18 · 24" left the
              reader asking what a review week was.
            */}
            <ReviewLegend />

          </section>

          {/* ═══════════ The sheet ═══════════ */}
          <main className="order-1 lg:order-2">
            <div className="folio-sheet">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
