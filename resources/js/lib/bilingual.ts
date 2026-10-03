import { usePage } from '@inertiajs/react';

/**
 * اختيار اللغة الأساس، والاتجاه الذي يتبعها.
 *
 * ── القاعدة ─────────────────────────────────────────────────
 * الخادم يرسل الاسمين دائماً (`focus_ar` و`focus_en`)، والواجهة
 * تختار. فتغيير التفضيل لا يحتاج إعادة توليد ولا استيراداً —
 * الحقلان موجودان في الـprops في كل الأحوال.
 *
 * ── ولماذا الثانوي معروض أيضاً ───────────────────────────────
 * المتدرّب العربي يحتاج «Routine Verbs» ليجدها في الكتاب وفي
 * أي مصدر إنجليزي، والمتعلّم الذي اختار الإنجليزية أساساً ما زال
 * عربياً ويحتاج «أفعال الروتين اليومي» ليفهم بسرعة. فالأساس بارز
 * والثانوي بجانبه أخفت.
 */

export type Locale = 'ar' | 'en';

export function useLocale(): Locale {
  const { props } = usePage();
  const l = ((props as any).prefs?.locale ?? 'ar') as string;

  return l === 'en' ? 'en' : 'ar';
}

/** اتجاه الصفحة بحسب اللغة الأساس */
export function dirOf(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'en' ? 'ltr' : 'rtl';
}

/** حقل ثنائي: يعيد الأساس والثانوي مرتّبين */
export function pick(
  locale: Locale,
  ar: string | null | undefined,
  en: string | null | undefined,
): { primary: string; secondary: string | null } {
  const a = (ar ?? '').trim();
  const e = (en ?? '').trim();

  const primary = locale === 'en' ? e || a : a || e;
  const secondary = locale === 'en' ? (a && a !== primary ? a : null) : e && e !== primary ? e : null;

  return { primary, secondary };
}

/**
 * الاتجاه المناسب لنصّ بعينه.
 *
 * سطر إنجليزي داخل صفحة عربية يجب أن يُعرض `ltr` وإن كانت الصفحة
 * `rtl` — وإلا انتقلت علامات الترقيم إلى الطرف الخطأ.
 */
export function dirFor(text: string | null | undefined): 'rtl' | 'ltr' {
  return /[؀-ۿ]/.test(text ?? '') ? 'rtl' : 'ltr';
}
