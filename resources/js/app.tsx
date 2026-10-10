import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { useMemo, type ComponentType } from 'react';
import { isolateDeep } from '@/lib/bidi';

const appName = import.meta.env.VITE_APP_NAME || 'مَدارِج';

/**
 * تطبيق الوضع الليلي على عنصر الجذر.
 *
 * على الجذر لا على كل صفحة: الصنف يجب أن يسبق أول رسم وإلا رأى
 * المستخدم وميضاً أبيض قبل الوضع الليلي. و'system' يتبع الجهاز.
 */
function applyTheme(theme?: string) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

/**
 * تصحيح اتجاه النصّ المختلط قبل أن يصل إلى الصفحة.
 *
 * ── لماذا هنا ───────────────────────────────────────────────
 * المحتوى عربي فيه إنجليزي: «نسيان الـ s»، «bigger from»، «/iː/».
 * والمتصفّح يُخطئ في ترتيب هذه المقاطع فتهاجر النقطة ويتبدّل موضع
 * الحرف — والخطأ في **العرض** لا في النصّ المكتوب.
 *
 * وموضع الإصلاح الصحيح واحد: بين الخادم والصفحة. المصاب أكثر من
 * ألف حقل في اثنين وثلاثين اسم حقل مختلف، وإصلاحه في مواضع العرض
 * يعني مئات التعديلات تتكرّر مع كل مكوّن جديد. أما هنا فيمرّ كل
 * ما يصل من الخادم — الموجود والقادم — من مصفاة واحدة.
 *
 * والحساب يقع مرّة لكل زيارة لا مرّة لكل رسم: `useMemo` مربوطة
 * بمرجع الخصائص، وInertia يعطي مرجعاً جديداً عند كل انتقال.
 */
function withBidi<P extends object>(Page: ComponentType<P>) {
  const Wrapped = (props: P) => {
    const fixed = useMemo(() => isolateDeep(props), [props]);
    return <Page {...fixed} />;
  };

  Wrapped.displayName = `Bidi(${Page.displayName ?? Page.name ?? 'Page'})`;
  // التخطيطات الثابتة تُنقل كما هي وإلا فقدت الصفحة تخطيطها
  (Wrapped as any).layout = (Page as any).layout;

  return Wrapped;
}

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: async (name) => {
        const page: any = await resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        );

        return { ...page, default: withBidi(page.default) };
    },
    setup({ el, App, props }) {
        applyTheme((props.initialPage.props as any)?.prefs?.theme);

        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    // The identity colour the admin chose (printed into <head> as
    // --accent), with a short delay so fast visits do not flash a bar
    progress: {
        color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#b8432a',
        delay: 150,
    },
});
