import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePage } from '@inertiajs/react';
import { useT } from '@/lib/i18n';
import type { MemoryCounts } from './types';
import { Brain, X } from 'lucide-react';
import type { MemoryAdded } from '@/lib/wordMisses';
import Bdi from '@/Components/Bdi';

/**
 * الذاكرة — الزرّ واللوحة الجانبية.
 *
 * ── لماذا زرّ لا بطاقة في الصفحة ────────────────────────────
 * اللوحة الرئيسية تجيب عن سؤال واحد: «ماذا أفعل الآن؟». وكل بطاقة
 * تُضاف إليها تُبعد الجواب سطراً. فالذاكرة ذاكرةٌ يُفتح عند الحاجة
 * لا لوحٌ معلّق: زرٌّ صغير عليه رقم، ولوحة تنزلق من الجانب.
 *
 * ── وما يكسبه هذا في الأداء ────────────────────────────────
 * **صفر.** لا استعلام، ولا شفرة، ولا بايت واحد يُنزَّل قبل الضغط:
 *
 *   الصفحة        →  الزرّ وحده (بضع مئات من البايتات)
 *   عند الضغط     →  لوحة الذاكرة + طلب `/memory`
 *   عند «راجع»    →  ts-fsrs وجلسة المراجعة
 *
 * ثلاث حزم لا واحدة، ولا يدفع أحدٌ ثمن ما لم يفتحه.
 *
 * ── وهو في كل صفحة ────────────────────────────────────────
 * الكلمة تصادف المتدرّب وهو في درسٍ أو في صفحة أسبوع، لا وهو في
 * اللوحة. فالزرّ يُركَّب في `AppNav` — الشريط الذي يظهر في كل صفحة
 * — لا في صفحة بعينها.
 *
 * ── والرقم عليه ───────────────────────────────────────────
 * من الـ props المشتركة: استعلامٌ واحد مفهرس يقول «ثلاث تنتظرك»،
 * يصل مع كل صفحة. وجُرّب تأجيله فكلّف طلب HTTP كاملاً لينقل مئتي
 * بايت — والقياس حكم.
 */

const MemoryPanel = lazy(() => import('./MemoryPanel'));

/**
 * `inline` puts the button in a bar instead of floating it: inside a
 * station the floating button sat over the content and the back button.
 */
export default function MemoryLauncher({ raised = true, inline = false }: { raised?: boolean; inline?: boolean }) {
  const tr = useT();
  const { props } = usePage();
  const shared = (props as any).memory as MemoryCounts | null | undefined;

  const [open, setOpen] = useState(false);
  const [live, setLive] = useState<MemoryCounts | undefined>(shared ?? undefined);

  // ما يصل من الخادم يغلب ما بقي من إغلاقٍ سابق
  useEffect(() => {
    if (shared) setLive(shared);
  }, [shared]);

  const close = useCallback(() => setOpen(false), []);

  /*
   * A word missed often joined the memory by itself (lib/wordMisses).
   * Said out loud, not slipped in: a word that appears in the notebook
   * unannounced reads as a bug, and one announced is a reason to review.
   */
  const [added, setAdded] = useState<MemoryAdded['word'] | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<MemoryAdded>).detail;
      if (d.counts) setLive(d.counts as MemoryCounts);
      setAdded(d.word);
    };
    window.addEventListener('memory:added', on);
    return () => window.removeEventListener('memory:added', on);
  }, []);
  useEffect(() => {
    if (!added) return;
    const t = window.setTimeout(() => setAdded(null), 8000);
    return () => window.clearTimeout(t);
  }, [added]);

  /**
   * ما دامت اللوحة مفتوحة: `Escape` يغلقها، وخلفيّة الصفحة لا
   * تتمرّر تحتها — وإلا ضاع موضع القراءة عند الإغلاق.
   */
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const pending = live ? live.due + live.fresh : 0;

  return (
    <>
      {/* الزرّ — فوق شريط التنقّل السفلي في الهاتف، لا تحته */}
      <button
        onClick={() => setOpen(true)}
        aria-label={tr('الذاكرة — كلماتك')}
        aria-expanded={open}
        className={inline
          ? 'relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200 transition hover:text-violet-700 hover:ring-violet-300'
          : `fixed end-4 z-40 flex items-center gap-2 rounded-full
                    bg-slate-900 py-3 ps-4 pe-3 text-white shadow-md
                    transition hover:bg-slate-800 active:scale-95
                    sm:bottom-6 sm:end-6 ${raised ? 'bottom-20' : 'bottom-4'}`}
        style={inline ? undefined : { marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Brain aria-hidden size={19} strokeWidth={1.75} />

        {!inline && (
          <span className="hidden text-sm font-medium sm:inline">
            {tr('الذاكرة')}
          </span>
        )}

        {pending > 0 && (
          <span
            className={inline
              ? 'absolute -end-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-violet-600 px-1 text-xs font-bold text-white'
              : `grid h-5 min-w-5 place-items-center rounded-full bg-white px-1
                       text-xs font-bold text-violet-700`}
          >
            {pending}
          </span>
        )}
      </button>

      {added && !open && createPortal(
        <div
          dir={document.documentElement.dir || 'rtl'}
          role="status"
          aria-live="polite"
          className="memory-toast fixed inset-x-0 top-3 z-[55] flex justify-center px-3"
          style={{ marginTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900 p-3 ps-4 text-white shadow-2xl">
            <Brain aria-hidden size={22} className="shrink-0 text-violet-300" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {tr('أضفنا')} <span className="font-bold"><Bdi>{added.term}</Bdi></span> {tr('إلى ذاكرتك')}
              </p>
              <p className="text-xs text-slate-300">{tr('أخطأت فيها أكثر من مرة. راجعها لتثبت.')}</p>
            </div>
            <button
              onClick={() => { setAdded(null); setOpen(true); }}
              className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              {tr('راجعها')}
            </button>
            <button onClick={() => setAdded(null)} aria-label={tr('إغلاق')} className="shrink-0 text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* In a portal: inside the focus bar, its blur pinned a fixed panel
          to the bar's own 64px, so the notebook opened as a strip */}
      {open && createPortal(
        <div dir={document.documentElement.dir || "rtl"} className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          {/* الغطاء — نقرةٌ عليه تغلق */}
          <button
            onClick={close}
            aria-label={tr('إغلاق')}
            className="flex-1 bg-slate-900/40 backdrop-blur-[1px]"
          />

          {/* اللوحة — من جهة نهاية السطر: يسار العربية ويمين الإنجليزية */}
          <aside
            className="memory-panel flex h-full w-full max-w-md flex-col bg-slate-50 shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
              <h2 className="flex items-center gap-2 font-bold text-slate-900">
                <Brain aria-hidden size={18} className="text-violet-600" />
                {tr('الذاكرة')}
              </h2>

              <button
                onClick={close}
                aria-label={tr('إغلاق')}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-400
                           transition hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </header>

            <Suspense
              fallback={
                <p className="p-6 text-center text-sm text-slate-400">
                  {tr('جارٍ التحميل…')}
                </p>
              }
            >
              <MemoryPanel onCounts={setLive} />
            </Suspense>
          </aside>
        </div>
      , document.body)}
    </>
  );
}
