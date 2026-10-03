import { Head, Link } from '@inertiajs/react';
import AppNav from '@/Components/AppNav';
import { useLocale, dirOf } from '@/lib/bilingual';
import { useT } from '@/lib/i18n';

/**
 * دليل الوسائط — كيف تحصل على الصوت.
 *
 * المنصة تنطق الكلمة والسطر بـ SpeechSynthesis، لكن نصّ استماع من
 * أربع فقرات يحتاج صوتاً متّصلاً بسرعة يتحكّم بها المتدرّب. الكتاب
 * يحلّ ذلك بأدوات مجانية، وقاعدته الصريحة: 0.8x أولاً ثم 1.0x أخيراً.
 */

interface Tool {
  name: string;
  url: string;
  why_ar: string;
  recommended?: boolean;
}

interface Method {
  number: number;
  title_ar: string;
  title_en: string;
  when_ar: string;
  steps_ar: string[];
  tools: Tool[];
  tip_ar: string | null;
}

interface Props {
  methods: Method[];
  cycle: string[];
  speedRule: string;
  intro_ar: string;
}

export default function Media({ methods, cycle, speedRule, intro_ar }: Props) {
  const tr = useT();
  const locale = useLocale();
  return (
    <div dir={dirOf(locale)} className="min-h-screen bg-slate-50 pb-28 sm:pb-20">
      <Head title={tr("دليل الوسائط — كيف تحصل على الصوت")} />

      <AppNav />

      <header className="relative overflow-hidden bg-violet-600">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-violet-400/25 blur-3xl"
        />

        <div className="relative mx-auto max-w-4xl px-4 py-5 sm:py-7">
          <Link
            href="/dashboard"
            className="text-xs text-violet-100/85 transition hover:text-white"
          >
            {tr('لوحة التقدّم')}
          </Link>
          <h1 className="mt-1.5 text-xl font-bold text-white sm:text-2xl">
            {tr('كيف تحصل على الصوت')}
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-violet-100/85 sm:text-sm">{intro_ar}</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        {/* قاعدة السرعة — أهم سطر في الصفحة */}
        <div className="rounded-2xl bg-violet-50 p-5 text-center ring-1 ring-violet-100">
          <p className="text-xs font-medium text-violet-600">{tr('قاعدة السرعة')}</p>
          <p className="mt-1.5 text-lg font-bold text-violet-900">{speedRule}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-violet-800/80">
            {tr('البطيء يجعلك تسمع الأصوات المنفصلة، والطبيعي يجعلك تسمع الكلام كما هو. تحتاج الاثنين بهذا الترتيب.')}
          </p>
        </div>

        {/* الطرق الأربع */}
        {methods.map((m) => (
          <section
            key={m.number}
            className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
          >
            <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/70 p-5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">
                {m.number}
              </span>
              <div className="min-w-0">
                <h2 className="font-bold text-slate-900">{m.title_ar}</h2>
                <p className="mt-0.5 text-xs text-slate-500" dir="ltr">
                  {m.title_en}
                </p>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <p className="text-sm leading-relaxed text-slate-700">{m.when_ar}</p>

              {m.steps_ar.length > 0 && (
                <ol className="space-y-2">
                  {m.steps_ar.map((step, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 rounded-lg bg-slate-50 p-3"
                    >
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="text-xs leading-relaxed text-slate-700">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              )}

              {/* الأدوات — كلها معروضة والموصى به موسوم */}
              {m.tools.length > 0 && (
                <div className="space-y-2">
                  {m.tools.map((t) => (
                    <div
                      key={t.name}
                      className={`rounded-xl p-4 ring-1 ${
                        t.recommended
                          ? 'bg-gradient-to-bl from-violet-50 to-white ring-violet-200'
                          : 'bg-white ring-slate-200'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          {t.recommended && (
                            <span className="mb-1.5 inline-block rounded-full bg-violet-600 px-2 py-0.5 text-xs font-medium text-white">
                              {tr('ابدأ من هنا')}
                            </span>
                          )}
                          <p className="font-semibold text-slate-900" dir="ltr">
                            {t.name}
                          </p>
                        </div>

                      </div>

                      <p className="mt-2 text-sm leading-relaxed text-slate-700">
                        {t.why_ar}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {m.tip_ar && (
                <p className="rounded-lg border-s-4 border-amber-400 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-900">
                  {m.tip_ar}
                </p>
              )}
            </div>
          </section>
        ))}

        {/* الدورة الرباعية */}
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="mb-1 font-bold text-slate-900">{tr('الدورة الرباعية للاستماع')}</h2>
          <p className="mb-4 text-xs text-slate-500">
            {tr('الترتيب ليس اقتراحاً — هو الطريقة نفسها')}
          </p>

          <ol className="space-y-2">
            {cycle.map((step, i) => (
              <li key={i} className="flex gap-2.5 rounded-lg bg-slate-50 p-3">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-xs leading-relaxed text-slate-700">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <p className="text-xs leading-relaxed text-slate-400">
          {tr('العناوين تتغيّر مع الوقت. لو لم يفتح رابط، ابحث عن الاسم — كل ما هنا يسهل إيجاده بالاسم، ولا يحتاج أي منها حساباً.')}
        </p>
      </main>
    </div>
  );
}
