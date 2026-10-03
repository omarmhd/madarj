/**
 * تفضيلات المتدرّب — تُشارك مع كل صفحة من HandleInertiaRequests.
 *
 * تُختار مرة في /setup وتُطبَّق في كل شاشة فيها نصّ إنجليزي:
 * الصوت والسرعة في النطق، والوضع في الألوان، والترجمة في العرض.
 */
export interface Prefs {
  voice: 'f' | 'm' | 'c';
  rate: number;
  theme: 'light' | 'dark' | 'system';
  locale: 'ar' | 'en';
  /** هل تُعرض ترجمة المحتوى العربية؟ */
  showTranslation: boolean;
}

/** الافتراضي حين لا تصل التفضيلات (صفحات ما قبل التسجيل) */
export const DEFAULT_PREFS: Prefs = {
  voice: 'f',
  rate: 0.8,
  theme: 'light',
  locale: 'ar',
  showTranslation: true,
};
