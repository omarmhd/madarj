import { AlertTriangle, ArrowLeft, Award, ChevronDown, Lightbulb, RotateCcw } from 'lucide-react';
import AppFooter from '@/Components/AppFooter';
import { Head, Link, router, usePage } from '@inertiajs/react';
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
  /** Under the test's per-section minimum — this alone fails the test */
  short?: boolean;
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
  /** The least each section must score; 0 when the test sets none */
  section_min: number;
  minutes_used: number;
  focus_lost: number;
  sections: SectionResult[];
  weakest: string | null;
  retry_hours: number;
  placement: boolean;
  estimate: string | null;
  /** The certificate this pass earned, if any */
  certificate: string | null;
  free_writing: WritingResult | null;
}

/** The free writing — rated by the learner, never part of the score */
interface WritingResult {
  title_ar: string;
  task_en: string;
  points: { en: string; ar: string }[];
  min_words: number;
  max_words: number;
  model_en: string;
  model_notes_ar: string[];
  before_rating_ar: string[];
  rubric: { key: string; title_ar: string; title_en: string; levels_ar: string[] }[];
  verdicts: { min: number; ar: string }[];
  text: string;
  words: number;
  self: { scores: Record<string, number>; total: number; max: number } | null;
}

function SelfAssess({ attemptId, w }: { attemptId: number; w: WritingResult }) {
  const tr = useT();
  const [scores, setScores] = useState<Record<string, number>>(w.self?.scores ?? {});
  const [saving, setSaving] = useState(false);
  const complete = w.rubric.every((c) => scores[c.key] !== undefined);
  const verdict = w.self ? [...w.verdicts].sort((a, b) => b.min - a.min).find((v) => w.self!.total >= v.min) : null;

  const save = () => {
    setSaving(true);
    router.post(`/tests/attempt/${attemptId}/self-assess`, { scores }, {
      preserveScroll: true,
      onFinish: () => setSaving(false),
    });
  };

  return (
    <div className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div>
        <p className="text-base font-bold text-slate-900">{tr('رسالتك — قيّمها بنفسك')}</p>
        <p className="mt-1 text-sm text-slate-600">{tr('لا تدخل في درجتك ولا في الشهادة. هي لك: لتعرف أين أنت من كتابة B1.')}</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-700">
          {tr('ما كتبته — :n كلمة', { n: w.words })}
          {w.words < w.min_words && <span className="ms-2 text-amber-700">{tr('(أقل من :min)', { min: w.min_words })}</span>}
        </p>
        <p dir="ltr" className="mt-1.5 whitespace-pre-line rounded-xl bg-slate-50 p-4 text-base leading-relaxed text-slate-800">
          {w.text.trim() || '—'}
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-700">{tr('نموذج إجابة')}</p>
        <p dir="ltr" className="mt-1.5 whitespace-pre-line rounded-xl bg-emerald-50 p-4 text-base leading-relaxed text-emerald-950">
          {w.model_en}
        </p>
        <ul className="mt-2 space-y-1">
          {w.model_notes_ar.map((n, i) => (
            <li key={i} className="text-sm leading-relaxed text-slate-600">• {n}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl bg-amber-50 p-3.5">
        <p className="text-sm font-semibold text-amber-900">{tr('قبل أن تقيّم')}</p>
        <ul className="mt-1 space-y-1">
          {w.before_rating_ar.map((n, i) => (
            <li key={i} className="text-sm leading-relaxed text-amber-900">• {n}</li>
          ))}
        </ul>
      </div>

      {w.rubric.map((c) => (
        <fieldset key={c.key}>
          <legend className="text-sm font-bold text-slate-900">{c.title_ar}</legend>
          <div className="mt-1.5 space-y-1.5">
            {c.levels_ar.map((l, i) => (
              <button
                key={i}
                onClick={() => setScores((s) => ({ ...s, [c.key]: i }))}
                aria-pressed={scores[c.key] === i}
                className={`flex w-full items-start gap-3 rounded-xl border-2 px-3 py-2 text-start text-sm transition ${
                  scores[c.key] === i ? 'border-violet-500 bg-violet-50 text-violet-900' : 'border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="font-bold tabular-nums">{i}</span>
                <span className="leading-relaxed">{l}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      <button
        onClick={save}
        disabled={!complete || saving}
        className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {w.self ? tr('احفظ التقييم من جديد') : tr('احفظ تقييمي')}
      </button>

      {w.self && (
        <div className="rounded-xl bg-violet-50 p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-violet-900" dir="ltr">
            {w.self.total} / {w.self.max}
          </p>
          {verdict && <p className="mt-1 text-sm leading-relaxed text-violet-900">{verdict.ar}</p>}
        </div>
      )}
    </div>
  );
}

/* Cambridge's own words for its bands, in plain Arabic */
const BANDS: Record<Result['band'], { ar: string; tone: string }> = {
  distinction: { ar: 'امتياز', tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  merit: { ar: 'جيد جداً', tone: 'bg-sky-50 text-sky-800 ring-sky-200' },
  pass: { ar: 'ناجح', tone: 'bg-violet-50 text-violet-800 ring-violet-200' },
  below: { ar: 'لم تصل بعد', tone: 'bg-rose-50 text-rose-800 ring-rose-200' },
};

/** The learner's next day, by number — one tap from a result to the lesson */
function NextDay() {
  const tr = useT();
  const nav = ((usePage().props as any).nav ?? {}) as { week?: number; day?: number };
  const href = nav.week ? `/week/${nav.week}/day/${nav.day ?? 1}` : '/dashboard';

  return (
    <Link href={href} className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white">
      {nav.week ? <>{tr('ابدأ الأسبوع')} {nav.week} · {tr('اليوم')} {nav.day ?? 1}</> : tr('تابع الدراسة')}
      <ArrowLeft aria-hidden size={16} className="ltr:rotate-180" />
    </Link>
  );
}

export default function ResultPage({ result }: { result: Result }) {
  const tr = useT();
  const locale = useLocale();
  const [open, setOpen] = useState<string | null>(null);

  const weakest = result.sections.find((s) => s.key === result.weakest);
  const band = BANDS[result.band];
  // Enough in total but a section below its floor: say which, or the fail reads as a bug
  const short = result.sections.filter((s) => s.short);
  const shortOnly = !result.passed && short.length > 0 && result.percent >= result.pass_percent;

  return (
    <div dir={dirOf(locale)} className="min-h-screen bg-slate-50 pb-28 sm:pb-0">
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
                  : shortOnly
                    ? tr('بلغت المجموع المطلوب، لكن كل قسم يحتاج :m% على الأقل، وقسم :s تحته. راجعه وأعد الاختبار بعد :h ساعة.', {
                        m: result.section_min,
                        s: short.map((s) => tr(s.title_ar)).join('، '),
                        h: result.retry_hours,
                      })
                    : tr('تحتاج :p% للنجاح. راجع أضعف قسم وأعد الاختبار بعد :h ساعة.', { p: result.pass_percent, h: result.retry_hours })}
              </p>
            </>
          )}

          <p className="mt-3 text-sm text-slate-500">{tr('استغرقت :n دقيقة', { n: result.minutes_used })}</p>

          {result.placement && (
            <div className="mt-5 flex justify-center"><NextDay /></div>
          )}

          {result.certificate && (
            <Link
              href={`/certificates/${result.certificate}`}
              className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-amber-600"
            >
              <Award aria-hidden size={19} /> {tr('شهادتك جاهزة — افتحها')}
            </Link>
          )}
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
                    className={`h-full rounded-full ${s.percent >= 60 && !s.short ? 'bg-emerald-500' : 'bg-rose-500'}`}
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

        {result.free_writing && <SelfAssess attemptId={result.id} w={result.free_writing} />}

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
          {(result.passed || result.placement) && <NextDay />}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
