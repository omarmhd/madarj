import GuestLayout from '@/Layouts/GuestLayout';
import AuthCard, { AuthButton } from '@/Components/Auth/AuthCard';
import AuthField from '@/Components/Auth/AuthField';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import { useT } from '@/lib/i18n';

/**
 * Re-confirm the password before a sensitive action.
 *
 * Reached only from a guarded route — deleting the account, for
 * instance. The hint says why the question is being asked, because
 * a password prompt appearing without a reason reads as a bug.
 */
export default function ConfirmPassword() {
  const tr = useT();

  const { data, setData, post, processing, errors, reset } = useForm({
    password: '',
  });

  const submit: FormEventHandler = (e) => {
    e.preventDefault();

    post(route('password.confirm'), {
      onFinish: () => reset('password'),
    });
  };

  return (
    <GuestLayout>
      <Head title={tr('تأكيد كلمة المرور')} />

      <AuthCard
        title={tr('تأكيد هويتك')}
        hint={tr('هذه منطقة محميّة. اكتب كلمة المرور مرة أخرى للمتابعة.')}
      >
        <form onSubmit={submit} className="mt-5 space-y-4">
          <AuthField
            id="password"
            type="password"
            label={tr('كلمة المرور')}
            value={data.password}
            error={errors.password}
            onChange={(v) => setData('password', v)}
            autoComplete="current-password"
            autoFocus
          />

          <AuthButton processing={processing}>
            {processing ? tr('جارٍ التحقّق…') : tr('تأكيد')}
          </AuthButton>
        </form>
      </AuthCard>
    </GuestLayout>
  );
}
