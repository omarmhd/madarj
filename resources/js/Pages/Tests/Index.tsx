import { CheckCircle2, ClipboardCheck, Clock, Lock, X } from 'lucide-react';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import AppNav from '@/Components/AppNav';
import { useLocale, dirOf } from '@/lib/bilingual';
import { useT } from '@/lib/i18n';

/**
 * The tests menu: the pre-test, then one test after each module.
 *
 * The pre-test is always open and decides nothing — it is the "before"
 * that the A1 test is later compared with, like the baseline
 * recording. The module tests open when the learner reaches the review
 * week they gate, and a pass is what opens the next module.
 */

interface TestRow {
  slug: string;
  level: string;
  title_ar: string;
  after_week: number;
  minutes: number;
  items: number;
  available: boolean;
  passed: boolean;
  best: number | null;
  last_id: number | null;
  retry_at: string | null;
}

const TIPS = [
  'اختر وقتاً هادئاً لا يقاطعك فيه أحد، فالوقت لا يتوقّف بعد البدء.',
  'اقرأ السؤال قبل أن تسمع أو تقرأ النصّ.',
  'تسمع كل تسجيل مرّتين فقط، كما في الاختبارات الدولية.',
  'لا تترك سؤالاً فارغاً. إن لم تعرف فاختر أقرب جواب.',
  'لا تفتح مترجماً ولا تبويباً آخر. سيظهر ذلك في نتيجتك، والخاسر أنت.',
];

export default function Index({ tests, current_week }: { tests: TestRow[]; current_week: number }) {
  const tr = useT();
  const locale = useLocale();
  const [confirm, setConfirm] = useState<TestRow | null>(null);

  const label = (t: TestRow) =>
    t.after_week === 0 ? tr('اختبار قبل البدء') : tr('اختبار بعد :level', { level: t.level });

  return (
    <div dir={dirOf(locale)} className="min-h-screen bg-slate-50 pb-28 sm:pb-20">
      <Head title={tr('الاختبارات')} />
      <AppNav />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-5">
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <ClipboardCheck aria-hidden size={20} />
            {tr('الاختبارات')}
          </h1>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-slate-500">
            {tr('اختبار حقيقيّ بوقت محدّد في نهاية كل مستوى، على طريقة اختبارات كامبريدج. تنجح بـ60% فينفتح لك المستوى التالي.')}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-3 px-4 py-6">
        {tests.map((t) => {
          const waiting = t.retry_at && new Date(t.retry_at) > new Date();

          return (
            <div key={t.slug} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold text-slate-900">{label(t)}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock aria-hidden size={14} />
                      {tr(':n دقيقة', { n: t.minutes })}
                    </span>
                    <span>{tr(':n سؤالاً', { n: t.items })}</span>
                    {t.best !== null && <span>{tr('أفضل نتيجة: :n%', { n: t.best })}</span>}
                  </p>
                </div>

                {t.passed && t.after_week > 0 && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 aria-hidden size={15} />
                    {tr('ناجح')}
                  </span>
                )}
              </div>

              {t.after_week === 0 && (
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {tr('يقيس مستواك اليوم، للمعرفة فقط. لا ينقلك إلى مرحلة أعلى: الجميع يبدأ من الأسبوع الأول. وبعد A1 تقارن نتيجتك به وترى كم تقدّمت.')}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {!t.available ? (
                  <p className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Lock aria-hidden size={15} />
                    {tr('يُفتح حين تصل إلى الأسبوع :w. أنت الآن في الأسبوع :c.', { w: t.after_week, c: current_week })}
                  </p>
                ) : waiting ? (
                  <p className="text-sm text-amber-700">
                    {tr('تستطيع الإعادة بعد :time. راجع أضعف قسم في نتيجتك حتى ذلك الحين.', {
                      time: new Date(t.retry_at!).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit' }),
                    })}
                  </p>
                ) : (
                  <button
                    onClick={() => setConfirm(t)}
                    className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    {t.last_id ? tr('أعد الاختبار') : tr('ابدأ الاختبار')}
                  </button>
                )}

                {t.last_id && (
                  <Link
                    href={`/tests/attempt/${t.last_id}`}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50"
                  >
                    {tr('آخر نتيجة')}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </main>

      {/* Tips before starting — the clock starts on the button, not before */}
      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" role="dialog" aria-modal>
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900">{label(confirm)}</h2>
              <button onClick={() => setConfirm(null)} aria-label={tr('إغلاق')} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <p className="mt-1 text-sm text-slate-600">
              {tr(':n دقيقة · :q سؤالاً · خمسة أقسام: استماع، قراءة، قواعد، مفردات، كتابة', { n: confirm.minutes, q: confirm.items })}
            </p>

            {confirm.after_week === 0 && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
                {tr('تذكير: هذا الاختبار للمعرفة فقط. مهما كانت نتيجتك، ستبدأ الدورة من الأسبوع الأول.')}
              </p>
            )}

            <p className="mt-4 text-sm font-bold text-slate-900">{tr('نصائح قبل أن تبدأ')}</p>
            <ul className="mt-2 space-y-2">
              {TIPS.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                  <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                  {tr(tip)}
                </li>
              ))}
            </ul>

            <button
              onClick={() => router.post(`/tests/${confirm.slug}/start`)}
              className="mt-6 w-full rounded-xl bg-violet-600 py-3.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              {tr('أنا جاهز، ابدأ الوقت')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
