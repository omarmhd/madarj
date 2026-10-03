import { useState } from 'react';
import { iso } from '@/lib/bidi';
import { usePage } from '@inertiajs/react';
import { useSpeech, prefToGender, prefRateFactor, type Gender, type VoicePref } from '@/hooks/useSpeech';
import { track } from '@/lib/tracker';

/**
 * زرّ الاستماع — الوحيد في المنصة.
 *
 * كانت ثلاثة مكوّنات مختلفة وسبعة عشر موضع نداء، وفيها خمس سرعات
 * مكتوبة يدوياً (0.55 · 0.65 · 0.7 · 0.8 · 0.85) تتجاهل ما اختاره
 * المتدرّب في التهيئة. فكان الزرّ نفسه يبدو مختلفاً ويتصرّف مختلفاً
 * في كل شاشة — والمتعلّم المبتدئ يقرأ ذلك الاختلاف كأنه أزرار مختلفة.
 *
 * هنا زرّ واحد بمظهر واحد وسلوك واحد:
 *   • السرعة والصوت من تفضيلات المتدرّب دائماً، إلا أن يُطلب غير ذلك
 *     صراحةً (سطر حوار لامرأة مثلاً).
 *   • `slow` تعني «أبطأ من سرعتك» لا سرعة ثابتة — فمن اختار 0.6
 *     يسمع أبطأ ممّن اختار 1.0، وهذا هو المقصود.
 *   • حالة «يُنطق الآن» ظاهرة: النطق الآلي يتأخّر أحياناً جزءاً من
 *     ثانية، وزرٌّ لا يستجيب يُضغط مرّتين فيُقطع أوّله.
 */

interface Props {
  /** النصّ الإنجليزي المنطوق */
  text: string;
  /** نصّ بجانب الأيقونة — بلا نصّ يكون أيقونة وحدها */
  label?: string;
  /** أبطأ من سرعة المتدرّب — للتمييز الصوتي وأول استماع */
  slow?: boolean;
  /** صوت محدّد يتجاوز التفضيل — لأسطر الحوار بحسب جنس المتحدّث */
  gender?: Gender;
  /** سرعة محدّدة تتجاوز التفضيل — يستخدمها شريط السرعة في الصفحة */
  rate?: number;
  size?: 'sm' | 'md' | 'lg';
  /** بارز: خلفية ملوّنة — لزرّ الاستماع الرئيسي في البطاقة */
  prominent?: boolean;
}

const SIZES = {
  sm: { box: 'h-8 w-8', icon: 'h-3.5 w-3.5', text: 'text-xs' },
  md: { box: 'h-10 w-10', icon: 'h-4 w-4', text: 'text-sm' },
  lg: { box: 'h-12 w-12', icon: 'h-5 w-5', text: 'text-base' },
};

export default function Listen({
  text,
  label,
  slow = false,
  gender,
  rate,
  size = 'md',
  prominent = false,
}: Props) {
  const { speak, supported } = useSpeech();
  const { props } = usePage();
  const [playing, setPlaying] = useState(false);

  // بلا دعم في المتصفح: يُخفى الزرّ بدل أن يُعرض معطّلاً في كل سطر
  if (!supported) return null;

  const prefs = ((props as any).prefs ?? {}) as { voice?: VoicePref; rate?: number };
  const pref = (prefs.voice ?? 'f') as VoicePref;
  const base = rate ?? (prefs.rate ?? 0.8) * prefRateFactor(pref);
  const finalRate = slow ? Math.max(0.4, base * 0.7) : base;
  const finalGender = gender ?? prefToGender(pref);

  const s = SIZES[size];

  const play = () => {
    setPlaying(true);
    // إعادة سماع كلمة بعينها مراراً أصدق إشارة على صعوبتها من أي اختبار
    track(slow ? 'audio_slow' : 'audio_play', text.slice(0, 80));
    speak(text, { rate: finalRate, gender: finalGender });
    // النطق الآلي لا يخبرنا متى ينتهي بدقّة في كل متصفح،
    // والوميض القصير يكفي ليعرف المتدرّب أن ضغطته وصلت
    window.setTimeout(() => setPlaying(false), Math.min(3000, 600 + text.length * 55));
  };

  const aria = slow ? `استمع ببطء إلى ${iso(text)}` : `استمع إلى ${iso(text)}`;

  /* بنصّ — زرّ ممتدّ */
  if (label) {
    return (
      <button
        onClick={play}
        aria-label={aria}
        className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5
                    font-medium transition active:scale-95 ${s.text} ${
                      prominent
                        ? 'bg-violet-600 text-white hover:bg-violet-700'
                        : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-violet-50 hover:text-violet-800 hover:ring-violet-200'
                    } ${playing ? 'ring-2 ring-violet-400' : ''}`}
      >
        <Icon className={s.icon} playing={playing} slow={slow} />
        {label}
      </button>
    );
  }

  /* بلا نصّ — أيقونة دائرية */
  return (
    <button
      onClick={play}
      aria-label={aria}
      title={aria}
      className={`grid shrink-0 place-items-center rounded-full transition active:scale-95
                  ${s.box} ${
                    prominent
                      ? 'bg-violet-600 text-white hover:bg-violet-700'
                      : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-violet-600 hover:text-white hover:ring-violet-600'
                  } ${playing ? 'ring-2 ring-violet-400' : ''}`}
    >
      <Icon className={s.icon} playing={playing} slow={slow} />
    </button>
  );
}

/** مكبّر صوت — بموجتين، وبموجة واحدة في الوضع البطيء */
function Icon({
  className,
  playing,
  slow,
}: {
  className: string;
  playing: boolean;
  slow: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`${className} ${playing ? 'animate-pulse' : ''}`}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      {/* الموجة الثانية تغيب في البطيء — فيُرى الفرق قبل أن يُسمع */}
      {!slow && <path d="M18.5 5.5a9 9 0 0 1 0 13" />}
    </svg>
  );
}
