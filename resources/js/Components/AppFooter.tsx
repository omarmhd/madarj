import { Link, usePage } from '@inertiajs/react';
import BrandMark from '@/Components/BrandMark';
import { useT } from '@/lib/i18n';

/**
 * The footer — on every page that carries the nav, under its content.
 *
 * Short on purpose: who we are in one line, the pages people look for
 * at the bottom of a site (certificates, tests, account, subscription),
 * and the year. On a phone the tab bar sits over the screen's foot, so
 * the page keeps its bottom padding and the footer ends above the bar.
 */
export default function AppFooter() {
  const tr = useT();
  const { props } = usePage();
  const nav = ((props as any).nav ?? {}) as { week?: number; day?: number };
  const study = nav.week ? `/week/${nav.week}/day/${nav.day ?? 1}` : '/dashboard';

  const groups: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: tr('الدراسة'),
      links: [
        { href: study, label: tr('ادرس الآن') },
        { href: '/dashboard', label: tr('تقدّمي') },
        { href: '/tests', label: tr('اختبارات المستوى') },
        { href: '/certificates', label: tr('شهاداتي') },
      ],
    },
    {
      title: tr('خارج ساعة الدراسة'),
      links: [
        { href: '/stories', label: tr('قصص') },
        { href: '/play', label: tr('تسلية') },
      ],
    },
    {
      title: tr('حسابك'),
      links: [
        { href: '/profile', label: tr('حسابي') },
        { href: '/setup', label: tr('الصوت والوضع والترجمة') },
        { href: '/upgrade', label: tr('الاشتراك') },
      ],
    },
  ];

  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:gap-8">
          {/* Full width on a phone; the three link groups share the row under it */}
          <div className="col-span-3 sm:col-span-1">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-violet-600">
              <BrandMark size={26} />
              <span className="text-base font-bold text-slate-900">{tr('مَدارِج')}</span>
            </Link>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
              {tr('من A1 إلى B1 في 24 أسبوعاً — خطة يومية واضحة، لمن يتكلّم العربية.')}
            </p>
          </div>

          {groups.map((g) => (
            <nav key={g.title} aria-label={g.title}>
              <p className="text-xs font-semibold text-slate-900 sm:text-sm">{g.title}</p>
              <ul className="mt-2 space-y-1.5">
                {g.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="text-xs leading-relaxed text-slate-500 transition hover:text-violet-700 sm:text-sm">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-8 border-t border-slate-100 pt-4 text-xs text-slate-400">
          © {new Date().getFullYear()} {tr('مَدارِج')} · {tr('جميع الحقوق محفوظة')}
        </p>
      </div>
    </footer>
  );
}
