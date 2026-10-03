import { usePage } from '@inertiajs/react';
import en from '@/lang/en.json';
import { isolate, strip } from '@/lib/bidi';

/**
 * ترجمة نصوص الواجهة.
 *
 * ── لماذا العربية هي المفتاح ────────────────────────────────
 * الشائع أن يُخترع مفتاح لكل نصّ: `t('day.finish')`. وهذا يفرض
 * قاموسين ويجعل الشفرة غير مقروءة — من يقرأ `t('day.finish')` لا
 * يعرف ماذا يقول الزرّ حتى يفتح ملفّ الترجمة.
 *
 * فالمفتاح هنا هو النصّ العربي نفسه: `t('أنهِ اليوم')`. ونتيجته
 * ثلاث فوائد:
 *   • الشفرة تبقى مقروءة كما كانت قبل الترجمة.
 *   • لا `ar.json` أصلاً — الوضع العربي يُعيد المفتاح كما هو.
 *   • نصّ بلا ترجمة يظهر بالعربية لا بمفتاح غامض، فالنقص يُرى
 *     ولا يكسر الشاشة.
 *
 * ── الثمن، وهو مقبول ────────────────────────────────────────
 * تعديل الصياغة العربية يُبطل الترجمة. وهذا مقبول لأن التعديل
 * نادر، ولأن السقوط إلى العربية أهون من نصّ إنجليزي صار خاطئاً.
 */

type Dict = Record<string, string>;

const DICTS: Record<string, Dict> = { en: en as Dict };

/**
 * الترجمة خارج المكوّنات — حين لا يتاح خطّاف.
 *
 * البحث يقع على النصّ **مجرّداً** من محارف الاتجاه: النصّ قد يأتي
 * من خصائص الخادم وقد مرّ بالعزل، ومفاتيح القاموس مكتوبة نظيفة —
 * فلو بحثنا بالنصّ المعزول لأخفقت كل مطابقة.
 */
export function translate(text: string, locale: string): string {
  const key = strip(text);

  if (locale === 'ar') return key;

  return DICTS[locale]?.[key] ?? key;
}

/**
 * خطّاف الترجمة.
 *
 * يُعيد دالة لا نصّاً، فيصحّ استعمالها داخل الحلقات والشروط.
 */
export function useT() {
  const { props } = usePage();
  const locale = ((props as any).prefs?.locale ?? 'ar') as string;

  return (text: string, vars?: Record<string, string | number>) => {
    let out = translate(text, locale);

    // متغيّرات داخل النصّ: «المهمة :n من :total»
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        out = out.replaceAll(':' + k, String(v));
      }
    }

    // والعزل آخر خطوة: بعد الترجمة وبعد تركيب الأرقام، وإلا عُزل
    // قالبٌ ثم دُسّ فيه رقمٌ خارج العزل
    return isolate(out);
  };
}
