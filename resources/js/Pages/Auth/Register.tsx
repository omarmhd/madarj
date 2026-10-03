import GuestLayout from '@/Layouts/GuestLayout';
import AuthCard, { AuthButton } from '@/Components/Auth/AuthCard';
import AuthField from '@/Components/Auth/AuthField';
import AuthSelect from '@/Components/Auth/AuthSelect';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import { useT } from '@/lib/i18n';

/**
 * Create an account and start week one.
 *
 * ── Five questions ──────────────────────────────────────────
 * This screen once asked ten. A long form on the way into a
 * 168-day course loses the people the course was built for, so it
 * now asks the name, the email, the WhatsApp number, and the two
 * answers day one cannot open without:
 *
 *   the country — infers the timezone, and the timezone decides
 *                 when a day rolls over and whether a streak
 *                 survives the night. One tap.
 *   the track   — one hour a day or two. This doubles every
 *                 duration across all 168 days, so it cannot be a
 *                 silent default. Two cards, one tap.
 *
 * Age, goal and how they heard about us are still worth knowing —
 * but on the profile screen, after the learner has committed, not
 * at the door.
 */

interface Option {
  value: string;
  label: string;
}

/** One hour a day or two — the answer that scales the whole plan */
const TRACKS = [
  { value: 'A', title: 'ساعة واحدة', note: 'المسار المعتاد' },
  { value: 'B', title: 'ساعتان', note: 'تقدّم أسرع' },
];

export default function Register({ countries }: { countries: Option[] }) {
  const tr = useT();

  const { data, setData, post, processing, errors, reset } = useForm({
    name: '',
    email: '',
    phone: '',
    country: countries[0]?.value ?? 'EG',
    track: 'A',
    password: '',
    password_confirmation: '',
  });

  const submit: FormEventHandler = (e) => {
    e.preventDefault();

    post(route('register'), {
      onFinish: () => reset('password', 'password_confirmation'),
    });
  };

  return (
    <GuestLayout>
      <Head title={tr('حساب جديد')} />

      <AuthCard
        title={tr('ابدأ الأسبوع الأول')}
        hint={tr('خمس خانات فقط، وبعدها يُفتح يومك الأول.')}
      >
        <form onSubmit={submit} className="mt-5 space-y-4">
          <AuthField
            id="name"
            label={tr('اسمك')}
            dir="rtl"
            value={data.name}
            error={errors.name}
            onChange={(v) => setData('name', v)}
            autoComplete="name"
            autoFocus
          />

          <AuthField
            id="email"
            type="email"
            label={tr('البريد الإلكتروني')}
            value={data.email}
            error={errors.email}
            onChange={(v) => setData('email', v)}
            autoComplete="username"
            placeholder="you@example.com"
          />

          {/*
            `dir="ltr"` and `type="tel"`: the number reads left to
            right like the email, and the phone keypad opens instead
            of the full keyboard on mobile — where most learners are.
          */}
          <AuthField
            id="phone"
            type="tel"
            label={tr('رقم الواتساب')}
            value={data.phone}
            error={errors.phone}
            onChange={(v) => setData('phone', v)}
            autoComplete="tel"
            placeholder="+962 79 123 4567"
          />

          <AuthSelect
            id="country"
            label={tr('الدولة')}
            value={data.country}
            options={countries}
            error={errors.country}
            onChange={(v) => setData('country', v)}
            hint={tr('لضبط توقيت يومك: متى يبدأ ومتى ينتهي')}
          />

          {/*
            Two cards rather than a dropdown: this is the answer the
            plan cannot default, and it deserves to be read, not
            scrolled past.
          */}
          <fieldset>
            <legend className="block text-sm font-medium text-slate-700">
              {tr('كم من الوقت تستطيع أن تخصّص كل يوم؟')}
            </legend>

            <div className="mt-2 grid grid-cols-2 gap-3">
              {TRACKS.map((o) => (
                <label
                  key={o.value}
                  className={`cursor-pointer rounded-xl border-2 p-3 text-center transition
                              ${
                                data.track === o.value
                                  ? 'border-violet-500 bg-violet-50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                >
                  <input
                    type="radio"
                    name="track"
                    value={o.value}
                    checked={data.track === o.value}
                    onChange={() => setData('track', o.value)}
                    className="sr-only"
                  />
                  <span className="block text-sm font-semibold text-slate-900">
                    {tr(o.title)}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {tr(o.note)}
                  </span>
                </label>
              ))}
            </div>

            {errors.track && (
              <p className="mt-1.5 text-xs text-rose-700">{errors.track}</p>
            )}
          </fieldset>

          <div className="space-y-4 border-t border-slate-100 pt-4">
            <AuthField
              id="password"
              type="password"
              label={tr('كلمة المرور')}
              value={data.password}
              error={errors.password}
              onChange={(v) => setData('password', v)}
              autoComplete="new-password"
            />

            <AuthField
              id="password_confirmation"
              type="password"
              label={tr('اكتب كلمة المرور مرة أخرى')}
              value={data.password_confirmation}
              error={errors.password_confirmation}
              onChange={(v) => setData('password_confirmation', v)}
              autoComplete="new-password"
            />

            <AuthButton processing={processing}>
              {processing ? tr('جارٍ الإنشاء…') : tr('أنشئ الحساب وابدأ')}
            </AuthButton>
          </div>
        </form>
      </AuthCard>

      <p className="mt-4 text-center text-sm text-slate-600">
        {tr('لديك حساب؟')}{' '}
        <Link
          href={route('login')}
          className="font-medium folio-accent underline-offset-2 hover:underline"
        >
          {tr('تسجيل الدخول')}
        </Link>
      </p>
    </GuestLayout>
  );
}
