import GuestLayout from '@/Layouts/GuestLayout';
import AuthCard, { AuthButton, AuthNote } from '@/Components/Auth/AuthCard';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import { useT } from '@/lib/i18n';

/**
 * Waiting on the verification link.
 *
 * ── Say where to look, and what to do if it is not there ────
 * The two things a person on this screen needs are the folder to
 * check and the button to try again. Breeze gave a paragraph and
 * buried both. Sign out sits here too, because somebody who typed
 * the wrong address is otherwise stuck on this page forever.
 */
export default function VerifyEmail({ status }: { status?: string }) {
  const tr = useT();
  const { post, processing } = useForm({});

  const submit: FormEventHandler = (e) => {
    e.preventDefault();
    post(route('verification.send'));
  };

  return (
    <GuestLayout>
      <Head title={tr('توثيق البريد')} />

      <AuthCard
        title={tr('بقيت خطوة واحدة')}
        hint={tr('أرسلنا رابطاً إلى بريدك، اضغط عليه لتفعيل حسابك. وإن لم تجده، فابحث في مجلّد الرسائل غير المرغوبة (Spam).')}
      >
        {status === 'verification-link-sent' && (
          <AuthNote tone="ok">{tr('أرسلنا لك رابطاً جديداً الآن.')}</AuthNote>
        )}

        <form onSubmit={submit} className="mt-5">
          <AuthButton processing={processing}>
            {processing ? tr('جارٍ الإرسال…') : tr('أرسل الرابط مرة أخرى')}
          </AuthButton>
        </form>
      </AuthCard>

      {/* A wrong address would otherwise trap them on this screen */}
      <p className="mt-4 text-center text-sm text-slate-600">
        {tr('البريد خاطئ؟')}{' '}
        <Link
          href={route('logout')}
          method="post"
          as="button"
          className="font-medium folio-accent underline-offset-2 hover:underline"
        >
          {tr('اخرج وسجّل من جديد')}
        </Link>
      </p>
    </GuestLayout>
  );
}
