import { ArrowLeft, ArrowRight, Check, Gauge, Globe, Languages, Moon, Play, Volume2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Head, router } from '@inertiajs/react';
import AppNav from '@/Components/AppNav';
import { useSpeech, prefToGender, prefRateFactor, type VoicePref } from '@/hooks/useSpeech';
import { translate } from '@/lib/i18n';
import { isolate } from '@/lib/bidi';

/**
 * Settings — five choices, each one heard or seen at once.
 *
 * ── Two settings where there was one ───────────────────────
 * "Translation: English only" switched the interface to English and
 * hid the content's Arabic translation together. They are different
 * decisions: a beginner may want Arabic buttons and a dialogue with no
 * translation under it. So the interface language and the content
 * translation are chosen apart.
 *
 * ── The page speaks the language being chosen ──────────────
 * Its own labels, direction and options follow the language picked
 * here, before saving: choosing English shows what English looks like.
 * So this page translates with the chosen locale, not the saved one.
 */

interface Option {
  value: string | number;
  label_ar: string;
  hint_ar: string;
  label_en?: string;
  hint_en?: string;
}

interface Props {
  current: {
    voice: string;
    speech_rate: number;
    theme: string;
    locale: string;
    content_translation: number;
    done: boolean;
  };
  options: {
    voices: Option[];
    rates: Option[];
    themes: Option[];
    locales: Option[];
    translations: Option[];
  };
}

/** One group of choices */
function Choice({
  icon, title, note, options, value, onChange, onTry, en, tr, cols = 3,
}: {
  icon: ReactNode;
  title: string;
  note?: string;
  options: Option[];
  value: string | number;
  onChange: (v: any) => void;
  onTry?: (v: any) => void;
  en: boolean;
  tr: (s: string) => string;
  cols?: 2 | 3;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">{icon}</span>
        <div className="min-w-0">
          <h2 className="font-bold text-slate-900">{title}</h2>
          {note && <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{note}</p>}
        </div>
      </div>

      <div className={`mt-4 grid gap-2 ${cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {options.map((o) => {
          const active = String(o.value) === String(value);
          const label = en ? o.label_en ?? o.label_ar : o.label_ar;
          const hint = en ? o.hint_en ?? o.hint_ar : o.hint_ar;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={active}
              onClick={() => {
                onChange(o.value);
                onTry?.(o.value);
              }}
              className={`rounded-xl p-3.5 text-start ring-1 transition ${
                active ? 'bg-violet-50 ring-2 ring-violet-500' : 'bg-white ring-slate-200 hover:ring-slate-300'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">{label}</span>
                {active ? (
                  <Check aria-hidden size={16} className="shrink-0 text-violet-600" />
                ) : onTry ? (
                  <Play aria-label={tr('اسمع')} size={14} className="shrink-0 text-slate-400" />
                ) : null}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">{hint}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function Setup({ current, options }: Props) {
  const [voice, setVoice] = useState(current.voice);
  const [rate, setRate] = useState(current.speech_rate);
  const [theme, setTheme] = useState(current.theme);
  const [locale, setLocale] = useState(current.locale);
  const [translation, setTranslation] = useState(current.content_translation ?? 1);
  const [saving, setSaving] = useState(false);

  const { speak, supported, hasGenderedVoices } = useSpeech();

  // This page speaks the language being chosen, before it is saved
  const en = locale === 'en';
  const tr = (s: string) => isolate(translate(s, locale));

  /* The theme on the root at once: a preview of the page alone would lie */
  useEffect(() => {
    const isDark = theme === 'dark'
      || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [theme]);

  /* One sample per voice — the male voice introduced himself as Lina once */
  const SAMPLE: Record<VoicePref, string> = {
    f: 'Good morning. My name is Lina and I am a teacher.',
    m: 'Good morning. My name is Adam and I am a teacher.',
    c: 'Hello! My name is Mia and I am a student.',
  };
  const tryVoice = (v: string, r = rate) => {
    const pref = v as VoicePref;
    speak(SAMPLE[pref] ?? SAMPLE.f, { rate: r * prefRateFactor(pref), gender: prefToGender(pref) });
  };

  const submit = () => {
    setSaving(true);
    router.post(
      '/setup',
      { voice, speech_rate: rate, theme, locale, content_translation: Boolean(Number(translation)) },
      { onFinish: () => setSaving(false) },
    );
  };

  const Next = en ? ArrowRight : ArrowLeft;

  return (
    <div dir={en ? 'ltr' : 'rtl'} className="min-h-screen bg-slate-50 pb-28">
      <Head title={tr('الإعدادات')} />

      {current.done && <AppNav />}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
          <p className="text-xs font-semibold text-violet-700" dir="ltr">A1 → B1 · 24 weeks</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {current.done ? tr('إعداداتك') : tr('قبل أن تبدأ')}
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">
            {current.done
              ? tr('غيّر ما تشاء — يُطبَّق فوراً على كل الدروس.')
              : tr('خمسة اختيارات تحكم تجربتك. جرّبها الآن، وتستطيع تغييرها لاحقاً في أي وقت.')}
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-4 px-4 py-6 lg:grid-cols-2">
        {!supported && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 lg:col-span-2">
            {tr('متصفحك لا يدعم النطق الآلي، فاختيار الصوت والسرعة لن يُسمَع هنا. استخدم Chrome أو Edge.')}
          </p>
        )}
        {supported && !hasGenderedVoices && (
          <p className="rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-600 ring-1 ring-slate-200 lg:col-span-2">
            {tr('متصفحك يوفّر صوتاً إنجليزياً واحداً، فاختيار الصوت لن يُحدث فرقاً مسموعاً. تثبيت أصوات إنجليزية إضافية من إعدادات النظام يحلّه.')}
          </p>
        )}

        <Choice icon={<Volume2 size={19} />} title={tr('صوت النطق')}
          note={tr('اضغط أي خيار لتسمعه فوراً — الاختيار من التجربة لا من الوصف.')}
          options={options.voices} value={voice} onChange={setVoice} onTry={(v) => tryVoice(v)} en={en} tr={tr} />

        <Choice icon={<Gauge size={19} />} title={tr('سرعة النطق')}
          note={tr('ننصح بسرعة 0.8 للاستماع الأول ثم 1.0 للأخير. وتستطيع تغييرها في كل درس.')}
          options={options.rates} value={rate} onChange={(v) => setRate(Number(v))} onTry={(v) => tryVoice(voice, Number(v))} en={en} tr={tr} />

        <Choice icon={<Globe size={19} />} title={tr('لغة الواجهة')}
          note={tr('لغة الأزرار والقوائم والرسائل. الدروس نفسها تبقى كما هي.')}
          options={options.locales} value={locale} onChange={setLocale} en={en} tr={tr} cols={2} />

        <Choice icon={<Languages size={19} />} title={tr('ترجمة المحتوى')}
          note={tr('الترجمة العربية تحت الحوارات والنماذج والشرح.')}
          options={options.translations} value={translation} onChange={(v) => setTranslation(Number(v))} en={en} tr={tr} cols={2} />

        <Choice icon={<Moon size={19} />} title={tr('الوضع')}
          note={tr('المعاينة تتغيّر فوراً في خلفية هذه الصفحة.')}
          options={options.themes} value={theme} onChange={setTheme} en={en} tr={tr} />

        {/* What a dialogue line looks like with these choices — seen, not described */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-700">{tr('هكذا سيظهر سطر الحوار')}</p>
          <div className="mt-3 rounded-2xl rounded-tr-sm bg-rose-50 px-4 py-3 ring-1 ring-rose-100">
            <p className="flex items-center gap-2 text-xs font-bold text-rose-700" dir="ltr">
              LINA
              <button type="button" onClick={() => tryVoice('f')} aria-label={tr('اسمع')}
                className="grid h-6 w-6 place-items-center rounded-full bg-white text-rose-600 ring-1 ring-rose-200">
                <Volume2 size={12} />
              </button>
            </p>
            <p className="mt-1 text-base leading-relaxed text-slate-900" dir="ltr">Good morning! Are you the new engineer?</p>
            {Number(translation) ? (
              <p className="mt-1 text-sm text-slate-500" dir="rtl">صباح الخير! هل أنت المهندس الجديد؟</p>
            ) : (
              <span className="mt-1 inline-block rounded-md px-1.5 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-slate-200">
                {tr('عرض الترجمة')}
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-400">{tr('كل هذه الإعدادات قابلة للتغيير لاحقاً من هذه الصفحة نفسها.')}</p>
        </section>
      </main>

      {/* Save, always within reach */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto max-w-4xl px-4 py-3">
          <button
            onClick={submit}
            disabled={saving}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? tr('يحفظ…') : current.done ? tr('احفظ التغييرات') : <>{tr('ابدأ الدورة')} <Next aria-hidden size={16} className="no-flip" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
