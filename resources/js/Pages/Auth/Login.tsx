import { Volume2 } from 'lucide-react';
import GuestLayout from '@/Layouts/GuestLayout';
import AuthCard, { AuthButton, AuthNote } from '@/Components/Auth/AuthCard';
import AuthField from '@/Components/Auth/AuthField';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import { useT } from '@/lib/i18n';
import { useSpeech } from '@/hooks/useSpeech';

/**
 * Sign in.
 *
 * ── Why it was rewritten ────────────────────────────────────
 * This was untouched Breeze scaffolding: English labels, a grey
 * palette, left-to-right, indigo focus rings — a screen from a
 * different product bolted onto the front door of an Arabic
 * course. It is also the only screen a returning learner sees
 * every single day, and the first one a new learner sees ever.
 *
 * ── Where the error goes ────────────────────────────────────
 * A wrong password is the most common event on this screen, so
 * the message sits above the form where it is read — not under a
 * field where it is missed. Breeze reports bad credentials on the
 * `email` key; that is an outcome of the attempt, not a fault in
 * the field, so it is not rendered as a field error.
 *
 * ── The greeting is a dictionary entry ──────────────────────
 * Headword, IPA, part of speech, gloss — the shape of every word
 * the learner meets in the book, with a button to hear it. The
 * first thing on the daily front door is a tiny lesson.
 */
export default function Login({
  status,
  canResetPassword,
}: {
  status?: string;
  canResetPassword: boolean;
}) {
  const tr = useT();
  const { speak, supported } = useSpeech();

  const { data, setData, post, processing, errors, reset } = useForm({
    email: '',
    password: '',
    remember: false as boolean,
  });

  const submit: FormEventHandler = (e) => {
    e.preventDefault();

    post(route('login'), {
      onFinish: () => reset('password'),
    });
  };

  return (
    <GuestLayout>
      <Head title={tr('تسجيل الدخول')} />

      <div dir="ltr" className="flex items-baseline justify-end gap-3">
        <span className="folio-ink font-entry text-4xl leading-none">welcome back</span>
        {supported && (
          <button
            type="button"
            onClick={() => speak('welcome back', { rate: 0.85 })}
            aria-label={tr('استمع')}
            className="folio-accent text-lg transition hover:scale-110"
          >
            <Volume2 size={20} />
          </button>
        )}
      </div>
      <p dir="ltr" className="folio-soft mt-2 text-right text-sm">
        /ˌwelkəm ˈbæk/ <span className="font-entry italic">phrase</span>
      </p>

      <AuthCard
        title={tr('أهلاً وسهلاً من جديد')}
        hint={tr('أكمل من حيث توقّفت — خطة اليوم بانتظارك.')}
      >
        {/* Shown after a password reset or a verification link */}
        {status && <AuthNote tone="ok">{status}</AuthNote>}

        {errors.email && <AuthNote tone="bad">{errors.email}</AuthNote>}

        <form onSubmit={submit} className="mt-6 space-y-6">
          <AuthField
            id="email"
            type="email"
            label={tr('البريد الإلكتروني')}
            value={data.email}
            onChange={(v) => setData('email', v)}
            autoComplete="username"
            placeholder="you@example.com"
            autoFocus
          />

          <AuthField
            id="password"
            type="password"
            label={tr('كلمة المرور')}
            value={data.password}
            error={errors.password}
            onChange={(v) => setData('password', v)}
            autoComplete="current-password"
            aside={
              canResetPassword ? (
                <Link
                  href={route('password.request')}
                  className="text-sm folio-accent underline-offset-2 hover:underline"
                >
                  {tr('نسيتها؟')}
                </Link>
              ) : null
            }
          />

          {/* A daily course on a personal phone — staying signed in is the norm */}
          <label className="folio-soft flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="remember"
              checked={data.remember}
              onChange={(e) => setData('remember', (e.target.checked || false) as false)}
              className="folio-check"
            />
            {tr('تذكّرني')}
          </label>

          <AuthButton processing={processing}>
            {processing ? tr('جارٍ التحقّق…') : tr('تسجيل الدخول')}
          </AuthButton>
        </form>
      </AuthCard>

      <p className="folio-soft mt-8 text-center text-sm">
        {tr('ليس لديك حساب؟')}{' '}
        <Link
          href={route('register')}
          className="font-medium folio-accent underline-offset-2 hover:underline"
        >
          {tr('ابدأ الأسبوع الأول')}
        </Link>
      </p>
    </GuestLayout>
  );
}
