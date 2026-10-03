import GuestLayout from '@/Layouts/GuestLayout';
import AuthCard, { AuthButton } from '@/Components/Auth/AuthCard';
import AuthField from '@/Components/Auth/AuthField';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import { useT } from '@/lib/i18n';

/**
 * Choose a new password.
 *
 * ── The email field is shown, not hidden ────────────────────
 * It arrives from the signed link and cannot be changed here, so
 * it is rendered read-only rather than as a hidden input. Somebody
 * who has two addresses needs to see which account they are about
 * to change — a hidden field makes that invisible until it is
 * already wrong.
 */
export default function ResetPassword({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const tr = useT();

  const { data, setData, post, processing, errors, reset } = useForm({
    token,
    email,
    password: '',
    password_confirmation: '',
  });

  const submit: FormEventHandler = (e) => {
    e.preventDefault();

    post(route('password.store'), {
      onFinish: () => reset('password', 'password_confirmation'),
    });
  };

  return (
    <GuestLayout>
      <Head title={tr('كلمة مرور جديدة')} />

      <AuthCard
        title={tr('اختر كلمة مرور جديدة')}
        hint={tr('ثم تدخل بها مباشرة وتكمل من حيث توقّفت.')}
      >
        <form onSubmit={submit} className="mt-5 space-y-4">
          {/* Which account this changes — visible, and not editable */}
          <AuthField
            id="email"
            type="email"
            label={tr('الحساب')}
            value={data.email}
            error={errors.email}
            onChange={(v) => setData('email', v)}
            readOnly
          />

          <AuthField
            id="password"
            type="password"
            label={tr('كلمة المرور الجديدة')}
            value={data.password}
            error={errors.password}
            onChange={(v) => setData('password', v)}
            autoComplete="new-password"
            autoFocus
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
            {processing ? tr('جارٍ الحفظ…') : tr('احفظ وادخل')}
          </AuthButton>
        </form>
      </AuthCard>
    </GuestLayout>
  );
}
