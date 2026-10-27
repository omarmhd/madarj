import { Link } from '@inertiajs/react';
import { ArrowLeft, Award, ClipboardCheck } from 'lucide-react';
import { useT } from '@/lib/i18n';

/**
 * The unit is done: its level test is next.
 *
 * Shown where a review week ends — its last day's finish card and its
 * week page — because a learner who finishes week 6 and sees only
 * "the week is complete" does not know the next unit opens with a test.
 */
export interface UnitTest {
  slug: string;
  level: string;
  minutes: number;
  passed: boolean;
}

export default function UnitTestCall({ test }: { test: UnitTest }) {
  const tr = useT();

  if (test.passed) {
    return (
      <Link
        href="/certificates"
        className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-start ring-1 ring-amber-200 transition hover:ring-amber-300"
      >
        <Award aria-hidden size={26} className="shrink-0 text-amber-600" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-amber-900">{tr('اجتزت اختبار')} <span dir="ltr">{test.level}</span></span>
          <span className="block text-sm text-amber-800">{tr('شهادتك في «شهاداتي».')}</span>
        </span>
        <ArrowLeft aria-hidden size={18} className="shrink-0 text-amber-700" />
      </Link>
    );
  }

  return (
    <div className="rounded-2xl bg-violet-600 p-5 text-white shadow-lg">
      <p className="flex items-center gap-2 text-sm font-semibold text-violet-100">
        <ClipboardCheck aria-hidden size={17} /> {tr('أنهيت أسابيع الوحدة')}
      </p>
      <p className="mt-1 text-xl font-bold">
        {tr('حان اختبار')} <span dir="ltr">{test.level}</span>
      </p>
      <p className="mt-1 text-sm leading-relaxed text-violet-100">
        {tr(':n دقيقة. تنجح بـ60% فتنفتح لك الوحدة التالية وتحصل على شهادة المستوى.', { n: test.minutes })}
      </p>
      <Link
        href="/tests"
        className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white text-base font-semibold text-violet-700 transition hover:bg-violet-50"
      >
        {tr('اذهب إلى الاختبار')} <ArrowLeft aria-hidden size={17} />
      </Link>
    </div>
  );
}
