import { ArrowLeft, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AppNav from '@/Components/AppNav';
import { useSpeech, prefToGender, prefRateFactor, type VoicePref } from '@/hooks/useSpeech';
import { useT } from '@/lib/i18n';

/**
 * صفحة التهيئة — أربعة اختيارات قبل أول درس.
 *
 * كل اختيار **مسموع أو مرئي فوراً**: زرّ تجربة للصوت والسرعة،
 * ومعاينة للوضع الليلي، ونموذج سطر للترجمة. لأن الاختيار من وصف
 * مكتوب تخمين، ومن تجربة معرفة.
 */

interface Option {
  value: string | number;
  label_ar: string;
  hint_ar: string;
}

interface Props {
  current: {
    voice: string;
    speech_rate: number;
    theme: string;
    locale: string;
    done: boolean;
  };
  options: {
    voices: Option[];
    rates: Option[];
    themes: Option[];
    locales: Option[];
  };
}

/** مجموعة اختيار واحدة */
function Choice({
  title,
  note,
  options,
  value,
  onChange,
  onTry,
}: {
  title: string;
  note?: string;
  options: Option[];
  value: string | number;
  onChange: (v: any) => void;
  onTry?: (v: any) => void;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h2 className="font-bold text-slate-900">{title}</h2>
      {note && <p className="mt-1 text-xs leading-relaxed text-slate-500">{note}</p>}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const active = String(o.value) === String(value);

          return (
            <button
              key={String(o.value)}
              onClick={() => {
                onChange(o.value);
                onTry?.(o.value);
              }}
              className={`rounded-xl p-3.5 text-start ring-1 transition ${
                active
                  ? 'bg-violet-50 ring-2 ring-violet-500'
                  : 'bg-white ring-slate-200 hover:ring-slate-300'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">{o.label_ar}</span>
                {active && (
                  <span aria-hidden className="text-violet-600">
                    <Check aria-hidden size={16} />
                  </span>
                )}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                {o.hint_ar}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function Setup({ current, options }: Props) {
  const tr = useT();
  const [voice, setVoice] = useState(current.voice);
  const [rate, setRate] = useState(current.speech_rate);
  const [theme, setTheme] = useState(current.theme);
  const [locale, setLocale] = useState(current.locale);
  const [saving, setSaving] = useState(false);

  const { speak, supported, hasGenderedVoices } = useSpeech();

  /**
   * تطبيق الوضع على عنصر الجذر فور اختياره.
   *
   * المعاينة المحلية وحدها تكذب: يرى المستخدم خلفية الصفحة تتغيّر
   * ثم يجد بقية المنصة على حالها. الصنف على الجذر يريه الحقيقة.
   */
  useEffect(() => {
    const isDark =
      theme === 'dark' ||
      (theme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [theme]);

  /*
   * The sample sentence, from week-one vocabulary — one per voice.
   * A single sentence had the male voice introduce himself as Lina.
   * The child option speaks with the female voice, so it gets a
   * child's line rather than a teacher's.
   */
  const SAMPLE: Record<VoicePref, string> = {
    f: 'Good morning. My name is Lina and I am a teacher.',
    m: 'Good morning. My name is Adam and I am a teacher.',
    c: 'Hello! My name is Mia and I am a student.',
  };

  const tryVoice = (v: string, r = rate) => {
    // «طفل» ليس جنساً في Web Speech، والمحوّل يتولّى ذلك.
    // ونفس المحوّل الذي تستخدمه الدروس — فلا يختلف ما يسمعه هنا عمّا سيسمعه هناك
    const pref = v as VoicePref;
    speak(SAMPLE[pref] ?? SAMPLE.f, { rate: r * prefRateFactor(pref), gender: prefToGender(pref) });
  };

  const submit = () => {
    setSaving(true);
    router.post(
      '/setup',
      { voice, speech_rate: rate, theme, locale },
      { onFinish: () => setSaving(false) },
    );
  };

  const dark = theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div
      dir="rtl"
      className={`min-h-screen transition-colors ${dark ? 'bg-slate-900' : 'bg-slate-50'}`}
    >
      <Head title={tr("التهيئة")} />

      {current.done && <AppNav />}

      <header className="relative overflow-hidden bg-violet-600">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-violet-400/25 blur-3xl"
        />

        <div className="relative mx-auto max-w-4xl px-4 py-6 text-center sm:py-8">
          <p className="text-[11px] text-violet-100/85" dir="ltr">
            A1 → B1 · 24 weeks
          </p>
          <h1 className="mt-1.5 text-xl font-bold text-white sm:text-2xl">
            {current.done ? tr('إعداداتك') : tr('قبل أن تبدأ')}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-violet-100/85 sm:text-sm">
            {current.done
              ? tr('غيّر ما تشاء — يُطبَّق فوراً على كل الدروس.')
              : tr('أربعة اختيارات تحكم تجربتك كلها. جرّبها الآن، وتستطيع تغييرها لاحقاً في أي وقت.')}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        {!supported && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {tr('متصفحك لا يدعم النطق الآلي، فاختيار الصوت والسرعة لن يُسمَع هنا. استخدم Chrome أو Edge.')}
          </p>
        )}

        {supported && !hasGenderedVoices && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
            {tr('متصفحك يوفّر صوتاً إنجليزياً واحداً، فاختيار الصوت لن يُحدث فرقاً مسموعاً. تثبيت أصوات إنجليزية إضافية من إعدادات النظام يحلّه.')}
          </p>
        )}

        <Choice
          title={tr("الصوت")}
          note={tr("اضغط أي خيار لتسمعه فوراً — الاختيار من التجربة لا من الوصف.")}
          options={options.voices}
          value={voice}
          onChange={setVoice}
          onTry={(v) => tryVoice(v)}
        />

        <Choice
          title={tr("سرعة النطق")}
          note={tr("الكتاب يوصي 0.8 للاستماع الأول ثم 1.0 للأخير. وتستطيع تغييرها في كل درس.")}
          options={options.rates}
          value={rate}
          onChange={(v) => setRate(Number(v))}
          onTry={(v) => tryVoice(voice, Number(v))}
        />

        <Choice
          title={tr("الوضع")}
          note={tr("المعاينة تتغيّر فوراً في خلفية هذه الصفحة.")}
          options={options.themes}
          value={theme}
          onChange={setTheme}
        />

        <Choice
          title={tr("الترجمة")}
          options={options.locales}
          value={locale}
          onChange={setLocale}
        />

        {/* معاينة الترجمة — الفرق يُرى لا يُوصف */}
        <section
          className={`rounded-2xl p-5 ring-1 ${
            dark ? 'bg-slate-800 ring-slate-700' : 'bg-white ring-slate-200'
          }`}
        >
          <p className={`mb-3 text-xs font-semibold ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
            {tr('هكذا سيظهر سطر الحوار')}
          </p>

          <div
            className={`rounded-xl p-4 ${
              dark ? 'bg-rose-950/40 ring-1 ring-rose-900' : 'bg-rose-50 ring-1 ring-rose-100'
            }`}
          >
            <p className="text-[11px] font-bold text-rose-500" dir="ltr">
              LINA
            </p>
            <p
              className={`mt-1 text-sm leading-relaxed ${dark ? 'text-slate-100' : 'text-slate-900'}`}
              dir="ltr"
            >
              Good morning! Are you the new engineer?
            </p>
            {locale === 'ar' ? (
              <p className={`mt-1 text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                {tr('صباح الخير! هل أنت المهندس الجديد؟')}
              </p>
            ) : (
              <p className="mt-1 text-xs italic text-slate-400">
                {tr('(بلا ترجمة — يمكنك إظهارها في أي درس بزرّ واحد)')}
              </p>
            )}
          </div>
        </section>

        <button
          onClick={submit}
          disabled={saving}
          className="w-full rounded-xl bg-violet-600 py-4 font-semibold text-white
                     transition hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? tr('يحفظ…') : current.done ? tr('احفظ التغييرات') : <>{tr('ابدأ الدورة')} <ArrowLeft aria-hidden size={15} className="inline-block align-[-3px]" /></>}
        </button>

        <p className={`text-center text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          {tr('كل هذه الإعدادات قابلة للتغيير لاحقاً من هذه الصفحة نفسها.')}
        </p>
      </main>
    </div>
  );
}
