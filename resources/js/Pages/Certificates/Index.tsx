import { Head, Link } from '@inertiajs/react';
import { Award, ClipboardCheck, Lock } from 'lucide-react';
import AppNav from '@/Components/AppNav';
import AppFooter from '@/Components/AppFooter';
import { useLocale, dirOf } from '@/lib/bilingual';
import { useT } from '@/lib/i18n';

/**
 * شهاداتي — one certificate per level passed, and the ones still ahead.
 *
 * The four levels are always listed: an earned one opens its sheet, an
 * unearned one says what earns it. A shelf with gaps says "keep going"
 * better than an empty page.
 */

export interface CertificateRow {
  code: string;
  level: string;
  name: string;
  percent: number;
  issued_on: string;
  url: string;
}

const LEVELS = ['A1', 'A2', 'A2+', 'B1'];
const AFTER_WEEK: Record<string, number> = { A1: 6, A2: 12, 'A2+': 18, B1: 24 };

export default function CertificatesIndex({ certificates }: { certificates: CertificateRow[] }) {
  const tr = useT();
  const locale = useLocale();
  const byLevel = Object.fromEntries(certificates.map((c) => [c.level, c]));

  return (
    <div dir={dirOf(locale)} className="min-h-screen bg-slate-50 pb-28 sm:pb-0">
      <Head title={tr('شهاداتي')} />
      <AppNav />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Award aria-hidden size={26} className="text-amber-500" /> {tr('شهاداتي')}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr('شهادة لكل مستوى تجتاز اختباره بـ60% أو أكثر، باسمك وتوقيع المنصة ورمز تحقّق.')}
        </p>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {LEVELS.map((lvl) => {
            const c = byLevel[lvl];
            return (
              <li key={lvl}>
                {c ? (
                  <Link
                    href={`/certificates/${c.code}`}
                    className="group flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-200 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 border-double border-amber-300 bg-amber-50 text-xl font-bold text-amber-700" dir="ltr">
                      {lvl}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-slate-900">{tr('شهادة المستوى')} <span dir="ltr">{lvl}</span></span>
                      <span className="mt-0.5 block text-sm text-slate-500">
                        <span dir="ltr">{c.percent}%</span> · <span dir="ltr">{c.issued_on}</span>
                      </span>
                      <span className="mt-1 block font-mono text-xs text-slate-400" dir="ltr">{c.code}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-violet-700 group-hover:underline">{tr('افتحها')}</span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-4 rounded-2xl bg-white/60 p-5 ring-1 ring-slate-200">
                    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 border-dashed border-slate-200 text-xl font-bold text-slate-300" dir="ltr">
                      {lvl}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-bold text-slate-500">
                        <Lock aria-hidden size={14} /> {tr('شهادة المستوى')} <span dir="ltr">{lvl}</span>
                      </span>
                      <span className="mt-0.5 block text-sm text-slate-500">
                        {tr('اجتز اختبار المستوى بعد الأسبوع')} {AFTER_WEEK[lvl]}
                      </span>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <Link href="/tests" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:underline">
          <ClipboardCheck aria-hidden size={16} /> {tr('اختبارات المستوى')}
        </Link>
      </main>

      <AppFooter />
    </div>
  );
}
