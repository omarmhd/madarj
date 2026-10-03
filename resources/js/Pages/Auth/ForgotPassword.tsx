import GuestLayout from '@/Layouts/GuestLayout';
import AuthCard, { AuthButton, AuthNote } from '@/Components/Auth/AuthCard';
import AuthField from '@/Components/Auth/AuthField';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import { useT } from '@/lib/i18n';

/**
 * Ask for a reset link.
 *
 * ── Say what will arrive, and where ─────────────────────────
 * Breeze's copy was a paragraph explaining the concept of a reset
 * link. A learner who is locked out does not need the concept —
 * they need to know an email is coming and that it expires. So the
 * hint is one line, and the success banner names the inbox to
 * check rather than saying "done".
 */
export default function ForgotPassword({ status }: { status?: string }) {
  const tr = useT();

  const { data, setData, post, processing, errors } = useForm({ email: '' });

  const submit: FormEventHandler = (e) => {
    e.preventDefault();
    post(route('password.email'));
  };

  return (
    <GuestLayout>
      <Head title={tr('استعادة كلمة المرور')} />

      <AuthCard
        title={tr('نسيت كلمة المرور')}
        hint={tr('اكتب بريدك وسنرسل لك رابطاً لاختيار كلمة مرور جديدة. الرابط صالح لمدة ساعة فقط.')}
      >
        {status && <AuthNote tone="ok">{status}</AuthNote>}

        <form onSubmit={submit} className="mt-5 space-y-4">
          <AuthField
            id="email"
            type="email"
            label={tr('البريد الإلكتروني')}
            value={data.email}
            error={errors.email}
            onChange={(v) => setData('email', v)}
            autoComplete="username"
            placeholder="you@example.com"
            autoFocus
          />

          <AuthButton processing={processing}>
            {processing ? tr('جارٍ الإرسال…') : tr('أرسل الرابط')}
          </AuthButton>
        </form>
      </AuthCard>

      <p className="mt-4 text-center text-sm text-slate-600">
        <Link
          href={route('login')}
          className="font-medium folio-accent underline-offset-2 hover:underline"
        >
          {tr('العودة لتسجيل الدخول')}
        </Link>
      </p>
    </GuestLayout>
  );
}
