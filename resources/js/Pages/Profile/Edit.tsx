import {
  ChartNoAxesColumn,
  ChevronLeft,
  CircleCheck,
  Clock,
  CreditCard,
  Lock,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppNav from '@/Components/AppNav';
import { useLocale, dirOf } from '@/lib/bilingual';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import { useT } from '@/lib/i18n';

/**
 * The learner's account.
 *
 * ── Why a side menu ─────────────────────────────────────────
 * It was one long page — statistics, course settings, account forms
 * and the delete button stacked in a column — and the one question
 * people open their account to answer, "am I subscribed, and until
 * when?", was not on it at all. Now each concern has its own panel,
 * the subscription first: a side menu on a wide screen, a row of
 * tabs on a phone, and the panel kept in the URL hash so a link
 * (e.g. from the upgrade page) can open it directly.
 */

interface Stats {
  track: 'A' | 'B';
  current_week: number;
  current_day: number;
  days_done: number;
  days_total: number;
  percent: number;
  streak: number;
  longest_streak: number;
  started_on: string;
}

interface Learning {
  words_seen: number;
  words_learned: number;
  exercises_done: number;
  attempts_total: number;
  recordings: number;
  writings: number;
}

interface Behaviour {
  minutes_total: number;
  minutes_7d: number;
  audio_plays: number;
  active_days: number;
  hardest_words: { word: string; plays: number }[];
}

interface SubRow {
  id: number;
  plan: string | null;
  starts_on: string;
  ends_on: string;
  is_free: boolean;
  paid: string | null;
  state: 'active' | 'ended' | 'upcoming';
  days_left: number;
}

interface RequestRow {
  id: number;
  plan: string | null;
  method: string;
  contact: string;
  status: 'new' | 'contacted' | 'done' | 'declined';
  status_ar: string;
  created_at: string;
  handled_at: string | null;
}

interface Subscription {
  access: { status: 'admin' | 'subscribed' | 'trial' | 'expired'; days_left: number | null; renew: boolean };
  current: SubRow | null;
  trial: {
    days: number;
    weeks: number;
    ends_on: string | null;
    started_on: string;
    features: { label: string; open: boolean }[];
  };
  history: SubRow[];
  requests: RequestRow[];
}

interface Props {
  mustVerifyEmail: boolean;
  status?: string;
  stats: Stats;
  enrollment: { track: 'A' | 'B'; timezone: string; started_on: string } | null;
  learning: Learning;
  behaviour?: Behaviour;
  timezones: string[];
  subscription: Subscription;
}

type Panel = 'subscription' | 'progress' | 'course' | 'account' | 'danger';

const PANELS: { key: Panel; label: string; icon: ReactNode }[] = [
  { key: 'subscription', label: 'اشتراكي', icon: <CreditCard size={17} /> },
  { key: 'progress', label: 'تقدّمي', icon: <ChartNoAxesColumn size={17} /> },
  { key: 'course', label: 'إعدادات الدورة', icon: <SlidersHorizontal size={17} /> },
  { key: 'account', label: 'بيانات الحساب', icon: <UserRound size={17} /> },
  { key: 'danger', label: 'حذف الحساب', icon: <ShieldAlert size={17} /> },
];

/** One number with its label */
function Stat({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-600">{label}</p>
      {hint && <p className="mt-1 text-sm leading-relaxed text-slate-400">{hint}</p>}
    </div>
  );
}

/** A label/value row in a details list */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900">{children}</dd>
    </div>
  );
}

const REQUEST_TONE: Record<RequestRow['status'], string> = {
  new: 'bg-sky-50 text-sky-800 ring-sky-200',
  contacted: 'bg-amber-50 text-amber-800 ring-amber-200',
  done: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  declined: 'bg-slate-100 text-slate-600 ring-slate-200',
};

/*
 * The admin's statuses are written about the learner ("we contacted
 * him"); the learner reads them about themselves.
 */
const REQUEST_LABEL: Record<RequestRow['status'], string> = {
  new: 'قيد المراجعة',
  contacted: 'تواصلنا معك',
  done: 'تمّ التفعيل',
  declined: 'أُغلق الطلب',
};

const SUB_STATE: Record<SubRow['state'], { ar: string; tone: string }> = {
  active: { ar: 'فعّال', tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  upcoming: { ar: 'يبدأ لاحقاً', tone: 'bg-sky-50 text-sky-800 ring-sky-200' },
  ended: { ar: 'منتهٍ', tone: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

export default function Edit({
  mustVerifyEmail,
  status,
  stats,
  enrollment,
  learning,
  behaviour,
  timezones,
  subscription,
}: Props) {
  const tr = useT();
  const locale = useLocale();

  const [panel, setPanel] = useState<Panel>(() => {
    const h = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    return (PANELS.some((p) => p.key === h) ? h : 'subscription') as Panel;
  });

  // The open panel lives in the hash: a link can open it, and Back works
  useEffect(() => {
    if (window.location.hash.slice(1) !== panel) history.replaceState(null, '', '#' + panel);
  }, [panel]);

  // A saved account form comes back on the account panel, not the first one
  useEffect(() => {
    if (status === 'profile-updated' || status === 'verification-link-sent') setPanel('account');
  }, [status]);

  const [track, setTrack] = useState(enrollment?.track ?? 'A');
  const [timezone, setTimezone] = useState(enrollment?.timezone ?? 'UTC');
  const [savingCourse, setSavingCourse] = useState(false);

  const saveCourse = () => {
    setSavingCourse(true);
    router.patch('/profile/course', { track, timezone }, { onFinish: () => setSavingCourse(false), preserveScroll: true });
  };

  const courseChanged = track !== enrollment?.track || timezone !== enrollment?.timezone;

  const sub = subscription;
  const st = sub.access.status;
  const openRequest = sub.requests.find((r) => r.status === 'new' || r.status === 'contacted');

  return (
    <div dir={dirOf(locale)} className="min-h-screen bg-slate-50 pb-28 sm:pb-20">
      <Head title={tr('حسابي')} />

      <AppNav />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <h1 className="text-xl font-bold text-slate-900">{tr('حسابي')}</h1>
          <p className="mt-1 text-sm text-slate-500">
            بدأت في {stats.started_on} · مسار {stats.track}
            {stats.track === 'A' ? tr(' (ساعة يومياً)') : tr(' (ساعتان يومياً)')}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 lg:grid lg:grid-cols-[220px_1fr] lg:gap-6">
        {/* Side menu on a wide screen, a scrolling row of tabs on a phone */}
        <nav aria-label={tr('أقسام الحساب')} className="mb-5 lg:mb-0">
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-20 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-2xl lg:bg-white lg:p-2 lg:ring-1 lg:ring-slate-200">
            {PANELS.map((p) => (
              <li key={p.key} className="shrink-0">
                <button
                  onClick={() => setPanel(p.key)}
                  aria-current={panel === p.key ? 'page' : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                    panel === p.key
                      ? 'bg-violet-600 text-white lg:bg-violet-50 lg:text-violet-800'
                      : p.key === 'danger'
                        ? 'bg-white text-rose-700 ring-1 ring-slate-200 hover:bg-rose-50 lg:ring-0'
                        : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 lg:ring-0'
                  }`}
                >
                  <span aria-hidden>{p.icon}</span>
                  {tr(p.label)}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 space-y-5">
          {/* ═════════════ My subscription ═════════════ */}
          {panel === 'subscription' && (
            <>
              {/* Where they stand, in one card */}
              <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">{tr('حالتك الآن')}</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {st === 'subscribed'
                        ? tr('مشترك')
                        : st === 'trial'
                          ? tr('في الفترة التجريبيّة')
                          : st === 'admin'
                            ? tr('مدير — كل شيء مفتوح')
                            : sub.access.renew
                              ? tr('انتهى اشتراكك')
                              : tr('انتهت فترتك التجريبيّة')}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${
                      st === 'subscribed' || st === 'admin'
                        ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                        : st === 'trial'
                          ? 'bg-amber-50 text-amber-800 ring-amber-200'
                          : 'bg-rose-50 text-rose-800 ring-rose-200'
                    }`}
                  >
                    {st === 'subscribed' || st === 'admin' ? tr('فعّال') : st === 'trial' ? tr('تجربة') : tr('منتهٍ')}
                  </span>
                </div>

                <dl className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                  {sub.current ? (
                    <>
                      <Row label={tr('الخطّة')}>{sub.current.plan ?? (sub.current.is_free ? tr('اشتراك ممنوح') : '—')}</Row>
                      <Row label={tr('بدأ في')}>{sub.current.starts_on}</Row>
                      <Row label={tr('ينتهي في')}>{sub.current.ends_on}</Row>
                      <Row label={tr('الأيام الباقية')}>
                        <span className={sub.current.days_left <= 7 ? 'text-amber-700' : ''}>
                          {tr(':n يوماً', { n: sub.current.days_left })}
                        </span>
                      </Row>
                    </>
                  ) : st === 'trial' ? (
                    <>
                      <Row label={tr('بدأت التجربة في')}>{sub.trial.started_on}</Row>
                      <Row label={tr('تنتهي في')}>{sub.trial.ends_on ?? tr('بلا حدّ زمنيّ')}</Row>
                      {sub.access.days_left !== null && (
                        <Row label={tr('الأيام الباقية')}>
                          <span className={sub.access.days_left <= 3 ? 'text-amber-700' : ''}>
                            {tr(':n يوماً', { n: sub.access.days_left })}
                          </span>
                        </Row>
                      )}
                      <Row label={tr('أسابيع الدروس المفتوحة')}>{tr(':n من 24', { n: sub.trial.weeks })}</Row>
                    </>
                  ) : st === 'expired' ? (
                    <Row label={tr('تقدّمك')}>{tr('محفوظ كما هو')}</Row>
                  ) : null}
                </dl>

                {/* The way forward, when there is one to take */}
                {(st === 'trial' || st === 'expired' || (sub.current && sub.current.days_left <= 7)) && (
                  <Link
                    href="/upgrade"
                    className="mt-4 block rounded-xl bg-violet-600 py-3 text-center text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    {st === 'subscribed' || sub.access.renew ? tr('جدّد اشتراكك') : tr('اشترك الآن')}
                  </Link>
                )}
              </section>

              {/* What the trial includes — so a lock is never a surprise */}
              {st === 'trial' && (
                <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                  <h2 className="font-bold text-slate-900">{tr('ما تشمله تجربتك')}</h2>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {sub.trial.features.map((f) => (
                      <li key={f.label} className="flex items-center gap-2 text-sm">
                        {f.open ? (
                          <CircleCheck aria-hidden size={17} className="shrink-0 text-emerald-600" />
                        ) : (
                          <Lock aria-hidden size={16} className="shrink-0 text-slate-400" />
                        )}
                        <span className={f.open ? 'text-slate-800' : 'text-slate-500'}>
                          {tr(f.label)}
                          {!f.open && <span className="ms-1 text-slate-400">{tr('(للمشتركين)')}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Their requests, and what became of each */}
              <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                <h2 className="font-bold text-slate-900">{tr('طلبات الاشتراك')}</h2>

                {openRequest && (
                  <p className="mt-2 flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-sm leading-relaxed text-sky-900">
                    <Clock aria-hidden size={17} className="mt-0.5 shrink-0" />
                    {openRequest.status === 'new'
                      ? tr('طلبك وصلنا ولم يُفعَّل بعد. سنتواصل معك خلال يوم عمل.')
                      : tr('تواصلنا معك بشأن طلبك، ويُفعَّل الاشتراك بعد إتمام الدفع.')}
                  </p>
                )}

                {sub.requests.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">{tr('لم ترسل طلب اشتراك بعد.')}</p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {sub.requests.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{r.plan ?? tr('بلا خطّة محدّدة')}</p>
                          <p className="mt-0.5 text-sm text-slate-500">
                            {r.created_at} · {r.method}: <span dir="ltr">{r.contact}</span>
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ${REQUEST_TONE[r.status]}`}>
                          {tr(REQUEST_LABEL[r.status])}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Every subscription they have had */}
              {sub.history.length > 0 && (
                <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                  <h2 className="font-bold text-slate-900">{tr('سجلّ اشتراكاتك')}</h2>
                  <ul className="mt-3 divide-y divide-slate-100">
                    {sub.history.map((h) => (
                      <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {h.plan ?? (h.is_free ? tr('اشتراك ممنوح') : tr('اشتراك'))}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-500">
                            {h.starts_on} ← {h.ends_on}
                            {h.is_free ? ` · ${tr('مجّانيّ')}` : h.paid ? ` · ${h.paid}` : ''}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ${SUB_STATE[h.state].tone}`}>
                          {tr(SUB_STATE[h.state].ar)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {/* ═════════════ My progress ═════════════ */}
          {panel === 'progress' && (
            <>
              <section>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat value={`${stats.days_done}/${stats.days_total}`} label={tr('أيام منجزة')} hint={`${stats.percent}% من الدورة`} />
                  <Stat value={stats.streak} label={tr('سلسلة حالية')} hint={`الأطول: ${stats.longest_streak}`} />
                  <Stat value={`${stats.current_week}/24`} label={tr('الأسبوع')} hint={`اليوم ${stats.current_day}`} />
                  <Stat value={learning.words_learned} label={tr('كلمة تعرفها')} hint={`من ${learning.words_seen} بطاقة`} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat value={learning.exercises_done} label={tr('تمريناً أصبته')} hint={`${learning.attempts_total} محاولة إجمالاً`} />
                  <Stat value={learning.recordings} label={tr('تسجيلاً')} hint={tr('محفوظة في متصفحك')} />
                  <Stat value={learning.writings} label={tr('نصّاً كتبته')} />
                </div>
              </section>

              {/* What the activity log says and the progress table does not */}
              {behaviour && behaviour.active_days > 0 && (
                <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                  <h2 className="font-bold text-slate-900">{tr('وقتك الفعلي')}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    {tr('نحسب الوقت الذي تعمل فيه فعلاً. التبويب المفتوح وأنت بعيد عنه لا يُعدّ دراسة.')}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat value={behaviour.minutes_total} label={tr('دقيقة إجمالاً')} />
                    <Stat value={behaviour.minutes_7d} label={tr('دقيقة هذا الأسبوع')} />
                    <Stat value={behaviour.active_days} label={tr('يوماً نشطاً')} />
                    <Stat value={behaviour.audio_plays} label={tr('مرة استمعت')} />
                  </div>

                  {behaviour.hardest_words.length > 0 && (
                    <div className="mt-5">
                      <p className="text-sm font-semibold text-slate-800">{tr('الكلمات التي أعدت سماعها أكثر')}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-500">
                        {tr('إعادة السماع أصدق مؤشّر على الصعوبة من أي اختبار — هذه هي التي تستحقّ دقائقك القادمة.')}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {behaviour.hardest_words.map((w) => (
                          <span key={w.word} className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm ring-1 ring-amber-200">
                            <span className="font-medium text-amber-900" dir="ltr">{w.word}</span>
                            <span className="text-sm text-amber-700">×{w.plays}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          {/* ═════════════ Course settings ═════════════ */}
          {panel === 'course' && (
            <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
              <h2 className="font-bold text-slate-900">{tr('إعدادات الدورة')}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {tr('المسار يحدّد وقت اليوم، والمنطقة الزمنية تحدّد متى يبدأ «اليوم» عندك — وعليها يُحسب القفل والسلسلة.')}
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">{tr('المسار')}</label>
                  <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                    {[
                      { v: 'A', t: tr('المسار A'), h: tr('ساعة يومياً') },
                      { v: 'B', t: tr('المسار B'), h: tr('ساعتان يومياً — الوقت يُضاعف') },
                    ].map((o) => (
                      <button
                        key={o.v}
                        onClick={() => setTrack(o.v as 'A' | 'B')}
                        className={`rounded-xl p-3 text-start ring-1 transition ${
                          track === o.v ? 'bg-violet-50 ring-2 ring-violet-500' : 'bg-white ring-slate-200 hover:ring-slate-300'
                        }`}
                      >
                        <span className="block text-sm font-semibold text-slate-900">{o.t}</span>
                        <span className="mt-0.5 block text-sm text-slate-500">{o.h}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="timezone" className="text-sm font-medium text-slate-700">
                    {tr('المنطقة الزمنية')}
                  </label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    dir="ltr"
                    className="mt-1.5 w-full rounded-xl border-slate-200 text-sm focus:border-violet-500 focus:ring-violet-500"
                  >
                    {timezones.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {courseChanged && (
                  <button
                    onClick={saveCourse}
                    disabled={savingCourse}
                    className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                  >
                    {savingCourse ? tr('يحفظ…') : tr('احفظ إعدادات الدورة')}
                  </button>
                )}
              </div>

              <Link
                href="/setup"
                className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-200 transition hover:ring-slate-300"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">
                    <Settings2 aria-hidden size={15} className="inline-block align-[-2px]" /> {tr('الصوت والسرعة والوضع والترجمة')}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-500">{tr('إعدادات التجربة — في صفحة التهيئة')}</span>
                </span>
                <ChevronLeft aria-hidden size={16} className="shrink-0 text-slate-400" />
              </Link>
            </section>
          )}

          {/* ═════════════ Account details ═════════════ */}
          {panel === 'account' && (
            <>
              {status === 'profile-updated' && (
                <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">{tr('حُفظت التغييرات.')}</p>
              )}
              <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                <UpdateProfileInformationForm mustVerifyEmail={mustVerifyEmail} status={status} className="max-w-xl" />
              </div>
              <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                <UpdatePasswordForm className="max-w-xl" />
              </div>
            </>
          )}

          {/* ═════════════ Delete account ═════════════ */}
          {panel === 'danger' && (
            <section className="rounded-2xl bg-white p-5 ring-1 ring-rose-200">
              <h2 className="font-bold text-rose-800">{tr('حذف الحساب')}</h2>
              <p className="mb-4 mt-1 text-sm leading-relaxed text-slate-600">
                {tr('يُحذف تقدّمك كله: الأيام والسلسلة والبطاقات والتسجيلات والنصوص. ولا رجعة.')}
              </p>
              <DeleteUserForm className="max-w-xl" />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
