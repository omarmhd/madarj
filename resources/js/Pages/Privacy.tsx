import { Head } from '@inertiajs/react';

/**
 * The privacy policy the app stores require, in plain Arabic.
 *
 * It says what the platform actually does, and nothing more: what is
 * stored, what never leaves the phone, and how to delete an account.
 * A store reviewer checks it against the app's permissions, so the
 * microphone and the reminder are named.
 */
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'ما نحفظه',
    body: [
      'اسمك وبريدك الإلكتروني وكلمة مرورك مشفّرة، لتسجيل الدخول.',
      'تقدّمك في الدورة: الأيام والمهام التي أنجزتها، وإجاباتك في التمارين، ونتائج اختبارات المستوى، والشهادات.',
      'ما تكتبه بنفسك في المنصة: الواجبات، والجمل، والكلمات التي تضيفها إلى ذاكرتك.',
    ],
  },
  {
    title: 'ما لا يغادر جهازك',
    body: [
      'تسجيلاتك الصوتية لا تُرفع إلى خوادمنا أبداً، وتبقى على جهازك.',
      'التذكير اليومي في التطبيق يُجدوَل على جوالك نفسه، بلا خدمة خارجية.',
    ],
  },
  {
    title: 'الميكروفون',
    body: [
      'يُطلب الميكروفون فقط في تمرين فحص النطق، حين تضغط لتقول الكلمة. وقد يمرّ صوتك بخدمة التعرّف على الكلام في جهازك أو متصفّحك (مثل Google في متصفّح Chrome) لتحويله إلى نصّ، ولا نحفظه نحن.',
    ],
  },
  {
    title: 'ما لا نفعله',
    body: [
      'لا إعلانات، ولا نبيع بياناتك، ولا نشاركها مع أحد لأغراض تسويقية.',
    ],
  },
  {
    title: 'حذف حسابك',
    body: [
      'تستطيع حذف حسابك وكل بياناته في أي وقت من صفحة «حسابي» في المنصة أو التطبيق.',
    ],
  },
];

export default function Privacy({ contact }: { contact?: string | null }) {
  return (
    <>
      <Head title="سياسة الخصوصية" />
      <main dir="rtl" className="mx-auto max-w-2xl px-4 py-10 leading-relaxed text-slate-800">
        <h1 className="text-2xl font-bold text-slate-900">سياسة الخصوصية</h1>
        {SECTIONS.map((s) => (
          <section key={s.title} className="mt-6">
            <h2 className="text-lg font-semibold text-slate-900">{s.title}</h2>
            <ul className="mt-2 list-disc space-y-1.5 ps-5 text-sm">
              {s.body.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </section>
        ))}
        {contact && (
          <p className="mt-8 text-sm text-slate-600">
            للتواصل في ما يخصّ الخصوصية: <span dir="ltr">{contact}</span>
          </p>
        )}
      </main>
    </>
  );
}
