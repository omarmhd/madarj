import type { Mood } from '@/Components/Rafiq';

/**
 * ما يقوله رفيق عند كل إنجاز.
 *
 * ── قاعدتان في الصياغة ──────────────────────────────────────
 *
 * ① **جملة واحدة قصيرة.** المتدرّب أنهى للتوّ عملاً وهو متعب، ولا
 *    يقرأ فقرة. الكلمات المألوفة تصل، والطويلة تُتجاوَز.
 *
 * ② **رقم في كل رسالة.** «أحسنت» وحدها مجاملة تُقال لكل شيء،
 *    و«اليوم 16 من 168» حقيقة يراها المتدرّب فيصدّقها.
 *
 * ── ولماذا تتنوّع ───────────────────────────────────────────
 * العبارة الواحدة تتكرّر 168 مرة فتُقرأ كإشعار نظام. فتُختار من
 * مجموعة بحسب رقم اليوم — يتنوّع الظاهر، ويبقى ثابتاً لليوم نفسه
 * فلا يتغيّر عند إعادة التحميل.
 *
 * ── ولماذا قوالب لا نصّاً جاهزاً ────────────────────────────
 * لو بُني النصّ هنا بالأرقام لتعذّرت ترجمته: القاموس يطابق نصّاً
 * كاملاً، و«اليوم 16 من 168» تختلف في كل مرة. فتُعاد الجملة قالباً
 * ثابتاً (`اليوم :n من 168`) ومعه أرقامه — القالب يُترجَم والأرقام
 * تُركَّب بعده.
 */

export interface Milestone {
  day: number;
  week: number;
  module: number;
  days_total: number;
  first_ever: boolean;
  streak: number;
  longest_streak: number;
  streak_record: boolean;
  week_completed: boolean;
  module_completed: boolean;
}

export interface Celebration {
  mood: Mood;
  /** قالب عربي — يُترجَم ثم تُركَّب فيه المتغيّرات */
  title: string;
  body: string;
  vars: Record<string, string | number>;
}

/** عبارات اليوم — تتناوب فلا تُملّ */
const DAILY = [
  'أحسنت! يوم آخر في رصيدك',
  'خطوة جديدة إلى الأمام',
  'عمل ممتاز اليوم',
  'أنجزت يومك. استمرّ',
  'لم تتوقّف — وهذا هو المهمّ',
  'يوم مكتمل. أنت تتقدّم',
  'رائع! واصل غداً',
  'يومٌ آخر انتهى بنجاح',
];

const WEEKLY = [
  'أسبوع كامل! سبعة أيام بلا انقطاع',
  'أنهيت الأسبوع كلّه. عمل كبير',
  'سبعة من سبعة. أحسنت',
];

const LEVEL: Record<number, string> = { 6: 'A1', 12: 'A2', 18: 'A2+', 24: 'B1' };

const pick = (list: string[], seed: number) => list[seed % list.length];

export function celebrationFor(m: Milestone): Celebration {
  const vars = {
    n: m.days_total,
    left: 168 - m.days_total,
    week: m.week,
    module: m.module,
    streak: m.streak,
    level: LEVEL[m.week] ?? '',
  };

  /* ① نهاية وحدة — أكبر لحظة في الدورة */
  if (m.module_completed) {
    return {
      mood: 'proud',
      title: 'أنهيت الوحدة :module!',
      body: m.week === 24
        ? 'وصلت إلى B1. أربعة وعشرون أسبوعاً كاملة — استمع إلى تسجيلك الأول الآن.'
        : 'مستواك الآن :level. :week أسبوعاً خلفك.',
      vars,
    };
  }

  /* ② نهاية أسبوع */
  if (m.week_completed) {
    return {
      mood: 'proud',
      title: pick(WEEKLY, m.week),
      body: 'الأسبوع :week من 24 · بقي :left يوماً على B1.',
      vars,
    };
  }

  /* ③ أول يوم في حياته */
  if (m.first_ever) {
    return {
      mood: 'cheer',
      title: 'أنهيت يومك الأول!',
      body: 'أصعب يوم قد مضى. نراك غداً.',
      vars,
    };
  }

  /* ④ رقم قياسي في السلسلة */
  if (m.streak_record && m.streak >= 3) {
    return {
      mood: 'cheer',
      title: ':streak أيام متتالية!',
      body: 'أطول سلسلة لك حتى الآن. لا تكسرها.',
      vars,
    };
  }

  /* ⑤ اليوم العادي — يُحتفى به أيضاً */
  return {
    mood: m.streak >= 3 ? 'cheer' : 'happy',
    title: pick(DAILY, m.days_total),
    body: m.streak >= 2
      ? ':streak أيام متتالية · اليوم :n من 168'
      : 'اليوم :n من 168 · بقي :left',
    vars,
  };
}
