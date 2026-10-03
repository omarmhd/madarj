import type { ReactNode } from 'react';
import { CircleCheck, Mail, MessageCircle, Phone } from 'lucide-react';
import { Head, Link, usePage } from '@inertiajs/react';
import { useState } from 'react';
import axios from 'axios';
import AppNav from '@/Components/AppNav';
import { useLocale, dirOf } from '@/lib/bilingual';
import { useT } from '@/lib/i18n';

/**
 * The wall at the end of the free trial.
 *
 * ── What used to happen here ────────────────────────────────
 * A learner finished week one, the dashboard told them they were on
 * week two, they tapped it — and got a raw 403 reading "finish the
 * previous week first". Which was false: they had finished it. The
 * whole sales funnel was an error page telling the wrong story.
 *
 * ── Why it opens with what they did, not what they owe ──────
 * This screen meets somebody who has just finished a week of work.
 * Leading with a price treats that week as nothing. So it says what
 * they finished first, and the plans come after — the order is the
 * argument.
 *
 * ── It sells nothing; it asks to be called ──────────────────
 * Payment is manual by decision. So no card form, no "buy" — the
 * button raises a hand: this plan, this number, call me. And the
 * screen says what happens next and when, because a request with no
 * stated answer reads as a request that went nowhere.
 */

interface PlanRow {
  id: number;
  name_ar: string;
  months: number;
  price: string;
  note_ar: string | null;
  monthly: string | null;
}

interface Pending {
  id: number;
  contact_method: string;
  contact_value: string;
  status: string;
  created_at: string;
}

const METHODS: { value: string; label: string; icon: ReactNode }[] = [
  { value: 'whatsapp', label: 'واتساب', icon: <MessageCircle size={18} /> },
  { value: 'email', label: 'بريد إلكتروني', icon: <Mail size={18} /> },
  { value: 'call', label: 'اتصال هاتفي', icon: <Phone size={18} /> },
];

export default function Upgrade({
  plans = [],
  pending = null,
  trialWeeks = 1,
  lockedWeek = null,
  feature = null,
  contact = { whatsapp: null, email: null },
}: {
  plans?: PlanRow[];
  pending?: Pending | null;
  trialWeeks?: number;
  lockedWeek?: number | null;
  feature?: string | null;
  contact?: { whatsapp: string | null; email: string | null };
}) {
  const tr = useT();
  const locale = useLocale();
  const access = (usePage().props as any).access as { status: string; renew: boolean } | null;
  const expired = access?.status === 'expired';

  const [planId, setPlanId] = useState<number | null>(plans[0]?.id ?? null);
  const [method, setMethod] = useState(contact.whatsapp ? 'whatsapp' : 'email');
  const [value, setValue] = useState(contact.whatsapp ?? contact.email ?? '');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const pick = (next: string) => {
    setMethod(next);

    // ما نعرفه عنه يُملأ، وما لا نعرفه يُترك له
    if (next === 'whatsapp' && contact.whatsapp) setValue(contact.whatsapp);
    else if (next === 'email' && contact.email) setValue(contact.email);
    else if (next === 'call' && contact.whatsapp) setValue(contact.whatsapp);
  };

  const send = () => {
    setState('sending');
    setError(null);

    axios
      .post('/upgrade', {
        plan_id: planId,
        contact_method: method,
        contact_value: value,
        note: note || null,
      })
      .then(() => setState('sent'))
      .catch((e) => {
        setState('idle');
        setError(e?.response?.data?.message ?? tr('تعذّر الإرسال. حاول مرة أخرى.'));
      });
  };

  const done = state === 'sent' || pending !== null;

  return (
    <div dir={dirOf(locale)} className="min-h-screen bg-slate-50 pb-28 sm:pb-20">
      <Head title={tr('الترقية')} />

      <AppNav />

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {/* ما أنجزه أولاً — فهو ما يجعل الباقي يستحقّ */}
        {/*
          Why they are here comes first, in one of four plain sentences:
          the subscription ended, the trial ended, a feature is locked,
          or the trial weeks are used up.
        */}
        <section className="rounded-2xl bg-violet-600 p-6 text-white">
          <p className="text-sm text-violet-100">
            {expired
              ? access?.renew
                ? tr('انتهى اشتراكك')
                : tr('انتهت فترتك التجريبيّة')
              : feature
                ? tr('هذه الميزة للمشتركين')
                : trialWeeks === 1
                  ? tr('أنهيت أسبوعك المجاني')
                  : `أنهيت ${trialWeeks} أسابيع مجانية`}
          </p>

          <h1 className="mt-2 text-2xl font-bold leading-snug sm:text-3xl">
            {expired
              ? access?.renew
                ? tr('جدّد اشتراكك وأكمل من حيث توقّفت')
                : tr('اشترك وأكمل من حيث توقّفت')
              : feature
                ? tr('«:f» تُفتح بالاشتراك', { f: feature })
                : lockedWeek
                  ? `الأسبوع ${lockedWeek} يبدأ من هنا`
                  : tr('أكمل الدورة كاملة')}
          </h1>

          {expired && (
            <p className="mt-2 text-sm font-semibold text-violet-50">
              {tr('تقدّمك محفوظ كما هو: كل يوم أنهيته وكل كلمة راجعتها بانتظارك.')}
            </p>
          )}

          <p className="mt-2 max-w-lg text-sm leading-relaxed text-violet-50">
            {tr('الدورة كاملة أربعة وعشرون أسبوعاً تنتهي بمستوى B1: ألفا كلمة، وأربعة أزمنة، ومحادثة تجريها بنفسك.')}
          </p>
        </section>

        {done ? (
          /*
           * وصل الطلب.
           *
           * ولا يُعرض النموذج ثانيةً: من ضغط الزرّ ينتظر جواباً لا
           * يريد أن يطلب مرّتين. والشاشة تقول متى يأتي الجواب —
           * فانتظارٌ بلا موعد يُقرأ إهمالاً.
           */
          <section className="rounded-2xl bg-white p-6 text-center ring-1 ring-emerald-200">
            <CircleCheck aria-hidden size={40} strokeWidth={1.5} className="mx-auto text-emerald-600" />

            <h2 className="mt-3 text-lg font-bold text-slate-900">{tr('وصلنا طلبك')}</h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
              {tr('سنتواصل معك خلال يوم عمل واحد لإتمام الاشتراك. ولا تحتاج أن ترسله مرة أخرى.')}
            </p>

            {pending && (
              <p className="mt-3 inline-block rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {METHODS.find((m) => m.value === pending.contact_method)?.label ?? pending.contact_method}
                {' · '}
                <span dir="ltr">{pending.contact_value}</span>
              </p>
            )}

            {/* After the trial nothing is open to review — the link would only bounce back here */}
            {!expired && (
              <div className="mt-5">
                <Link
                  href="/week/1"
                  className="text-sm font-medium text-violet-700 hover:underline"
                >
                  {tr('راجع أسبوعك الأول حتى نتواصل معك')}
                </Link>
              </div>
            )}
          </section>
        ) : (
          <>
            {/* الخطط */}
            <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
              <h2 className="font-semibold text-slate-900">{tr('اختر المدّة')}</h2>

              {plans.length === 0 ? (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
                  {tr('لم تُضبط الخطط بعد. اطلب الترقية وسنتواصل معك بالتفاصيل.')}
                </p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {plans.map((p) => {
                    const on = planId === p.id;

                    return (
                      <button
                        key={p.id}
                        onClick={() => setPlanId(p.id)}
                        aria-pressed={on}
                        className={`rounded-2xl p-4 text-start ring-1 transition ${
                          on
                            ? 'bg-violet-50 ring-2 ring-violet-500'
                            : 'bg-slate-50 ring-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <p className="font-bold text-slate-900">{p.name_ar}</p>

                        <p className="mt-1 text-2xl font-bold text-violet-700">{p.price}</p>

                        {p.monthly && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {tr('أي')} {p.monthly} {tr('في الشهر')}
                          </p>
                        )}

                        {p.note_ar && (
                          <p className="mt-2 inline-block rounded-md bg-white px-2 py-0.5 text-xs font-medium text-emerald-700">
                            {p.note_ar}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* كيف نتواصل */}
            <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
              <h2 className="font-semibold text-slate-900">{tr('كيف نتواصل معك؟')}</h2>

              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {tr('لا يوجد دفع في الموقع. نتواصل معك، ونتّفق، ثم نفتح لك الدورة.')}
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => pick(m.value)}
                    aria-pressed={method === m.value}
                    // Icon above label, both centred: the icon used to sit in a
                    // block span sized for an emoji and drifted to the corner
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-medium transition ring-1 ${
                      method === m.value
                        ? 'bg-violet-50 text-violet-800 ring-violet-300'
                        : 'bg-slate-50 text-slate-600 ring-transparent hover:bg-slate-100'
                    }`}
                  >
                    <span aria-hidden>{m.icon}</span>
                    {tr(m.label)}
                  </button>
                ))}
              </div>

              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                dir="ltr"
                placeholder={method === 'email' ? 'name@example.com' : '+20 …'}
                className="mt-3 w-full rounded-xl border-slate-200 bg-slate-50 text-sm
                           focus:border-violet-400 focus:ring-violet-400"
              />

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={tr('أي شيء تحب أن نعرفه (اختياري)')}
                className="mt-2 w-full rounded-xl border-slate-200 bg-slate-50 text-sm
                           focus:border-violet-400 focus:ring-violet-400"
              />

              {error && (
                <p className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>
              )}

              <button
                onClick={send}
                disabled={state === 'sending' || value.trim().length < 5}
                className="mt-4 w-full rounded-xl bg-violet-600 py-3.5 font-semibold text-white
                           transition hover:bg-violet-700 disabled:opacity-50"
              >
                {state === 'sending' ? tr('جارٍ الإرسال…') : tr('أريد الاشتراك — تواصلوا معي')}
              </button>

              <p className="mt-2 text-center text-xs text-slate-500">
                {tr('الضغط لا يخصم أي مبلغ. هو طلب تواصل فقط.')}
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
