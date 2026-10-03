import { AlertTriangle, ArrowLeft, Award, ChevronDown, Lightbulb, RotateCcw } from 'lucide-react';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import AppNav from '@/Components/AppNav';
import { useLocale, dirOf } from '@/lib/bilingual';
import { useT } from '@/lib/i18n';

/**
 * A level test's result.
 *
 * A score alone says "pass" or "fail"; what makes the result worth
 * reading is the diagnosis under it — the weakest section, what to
 * study for it, and every mistake with its right answer.
 */

interface Mistake {
  prompt: string;
  given: string | null;
  correct: string | null;
}

interface SectionResult {
  key: string;
  title_ar: string;
  score: number;
  max: number;
  percent: number;
  advice_ar: string[];
  mistakes: Mistake[];
}

interface Result {
  id: number;
  test: { slug: string; level: string; title_ar: string; after_week: number };
  score: number;
  max: number;
  percent: number;
  passed: boolean;
  band: 'distinction' | 'merit' | 'pass' | 'below';
  pass_percent: number;
  minutes_used: number;
  focus_lost: number;
  sections: SectionResult[];
  weakest: string | null;
  retry_hours: number;
  placement: boolean;
  estimate: string | null;
}

/* Cambridge's own words for its bands, in plain Arabic */
const BANDS: Record<Result['band'], { ar: string; tone: string }> = {
  distinction: { ar: 'امتياز', tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  merit: { ar: 'جيد جداً', tone: 'bg-sky-50 text-sky-800 ring-sky-200' },
  pass: { ar: 'ناجح', tone: 'bg-violet-50 text-violet-800 ring-violet-200' },
  below: { ar: 'لم تصل بعد', tone: 'bg-rose-50 text-rose-800 ring-rose-200' },
};

export default function ResultPage({ result }: { result: Result }) {
  const tr = useT();
  const locale = useLocale();
  const [open, setOpen] = useState<string | null>(null);

  const weakest = result.sections.find((s) => s.key === result.weakest);
  const band = BANDS[result.band];

  return (
    <div dir={dirOf(locale)} className="min-h-screen bg-slate-50 pb-28 sm:pb-20">
      <Head title={tr('نتيجة الاختبار')} />
      <AppNav />

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {/* The verdict */}
        <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
          <Award aria-hidden size={40} strokeWidth={1.5} className={`mx-auto ${result.passed ? 'text-amber-500' : 'text-slate-400'}`} />
          <p className="mt-1 text-sm font-semibold text-slate-500">{result.test.title_ar}</p>
          <p className="mt-2 text-5xl font-bold tabular-nums text-slate-900">
            {result.percent}
            <span className="text-2xl text-slate-400">%</span>
          </p>
          <p className="mt-1 text-sm text-slate-500" dir="ltr">
            {result.score} / {result.max}
          </p>

          {result.placement ? (
            <>
            <p className="mx-auto mt-4 max-w-sm rounded-xl bg-violet-50 p-3 text-base font-semibold text-violet-800">
              {tr('مستواك التقريبيّ الآن: :level', { level: result.estimate ?? 'Pre-A1' })}
            </p>
            {/*
              A placement result must not read as a shortcut: whatever the
              estimate, everyone starts at week 1, because each week builds
              on the one before. Said here, where the temptation is.
            */}
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
              {tr('هذه النتيجة للمعرفة فقط، ولا تنقلك إلى مرحلة أعلى. الدورة تبدأ من الأسبوع الأول للجميع، لأن كل أسبوع مبنيّ على ما قبله. احفظ هذه النتيجة، وقارنها بنتيجتك بعد A1.')}
            </p>
            </>
          ) : (
            <>
              <p className={`mx-auto mt-4 w-fit rounded-full px-4 py-1.5 text-base font-bold ring-1 ${band.tone}`}>{tr(band.ar)}</p>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
                {result.passed
                  ? tr('نجحت في :level وانفتح لك المستوى التالي.', { level: result.test.level })
                  : tr('تحتاج :p% للنجاح. راجع أضعف قسم وأعد الاختبار بعد :h ساعة.', { p: result.pass_percent, h: result.retry_hours })}
              </p>
            </>
          )}

          <p className="mt-3 text-sm text-slate-500">{tr('استغرقت :n دقيقة', { n: result.minutes_used })}</p>
        </div>

        {/* The honesty note */}
        {result.focus_lost > 0 && (
          <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
            <AlertTriangle aria-hidden size={20} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-sm leading-relaxed text-amber-900">
              {tr('غادرت صفحة الاختبار :n مرّة. إن كنت بحثت عن إجابة فهذه النتيجة لا تمثّلك. لا تغشّ نفسك: أعده حين تكون جاهزاً.', { n: result.focus_lost })}
            </p>
          </div>
        )}

        {/* Section by section */}
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <p className="text-base font-bold text-slate-900">{tr('نتيجتك في كل قسم')}</p>
          <ul className="mt-3 space-y-3">
            {result.sections.map((s) => (
              <li key={s.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-800">{tr(s.title_ar)}</span>
                  <span className="tabular-nums text-slate-600" dir="ltr">
                    {s.score}/{s.max}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${s.percent >= 60 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${s.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* What to do next */}
        {weakest && (
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <p className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Lightbulb aria-hidden size={18} className="text-amber-500" />
              {tr('نصائح: أضعف قسم عندك هو :s', { s: tr(weakest.title_ar) })}
            </p>
            <ul className="mt-3 space-y-2">
              {weakest.advice_ar.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Every mistake, with the right answer */}
        <div className="rounded-2xl bg-white ring-1 ring-slate-200">
          <p className="px-5 pt-5 text-base font-bold text-slate-900">{tr('أخطاؤك والإجابات الصحيحة')}</p>
          <div className="divide-y divide-slate-100">
            {result.sections
              .filter((s) => s.mistakes.length > 0)
              .map((s) => (
                <div key={s.key}>
                  <button
                    onClick={() => setOpen(open === s.key ? null : s.key)}
                    className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-800"
                    aria-expanded={open === s.key}
                  >
                    {tr(':s — :n أخطاء', { s: tr(s.title_ar), n: s.mistakes.length })}
                    <ChevronDown aria-hidden size={18} className={`transition ${open === s.key ? 'rotate-180' : ''}`} />
                  </button>
                  {open === s.key && (
                    <ul className="space-y-2 px-5 pb-4">
                      {s.mistakes.map((m, i) => (
                        <li key={i} dir="ltr" className="rounded-xl bg-slate-50 p-3 text-sm">
                          <p className="text-slate-800">{m.prompt}</p>
                          <p className="mt-1 text-rose-700 line-through decoration-rose-300">{m.given ?? '—'}</p>
                          <p className="font-semibold text-emerald-800">{m.correct}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/tests" className="flex items-center gap-1.5 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
            <RotateCcw aria-hidden size={16} />
            {tr('الاختبارات')}
          </Link>
          {(result.passed || result.placement) && (
            <Link href="/dashboard" className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white">
              {tr('تابع الدراسة')}
              <ArrowLeft aria-hidden size={16} className="ltr:rotate-180" />
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
