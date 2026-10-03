import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import Rafiq from '@/Components/Rafiq';
import type { Celebration } from '@/lib/milestones';
import { useT } from '@/lib/i18n';

/**
 * ظهور رفيق.
 *
 * ── ثلاث قواعد تحكم السلوك ──────────────────────────────────
 *
 * ① **لا يحجب.** بطاقة تنزلق من الأسفل، لا نافذة تُطفئ الصفحة.
 *    المتدرّب أنهى للتوّ عملاً ويريد أن يرى نتيجته، لا أن يُطالَب
 *    بإغلاق شيء قبل أن يراها.
 *
 * ② **يمكن تجاهله.** يختفي وحده بعد عشر ثوانٍ، ولا يمنع نقرة.
 *    والاحتفال الذي يجب أن تُغلقه يصير عائقاً بعد ثالث مرة.
 *
 * ③ **يحترم من يكره الحركة.** `prefers-reduced-motion` يُلغي
 *    الانزلاق ويُبقي البطاقة — الرسالة هي المقصودة لا الحركة.
 */
export default function Celebrate({
  celebration,
  onClose,
}: {
  celebration: Celebration | null;
  onClose: () => void;
}) {
  const tr = useT();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!celebration) return;

    // إطار واحد قبل الإظهار — وإلا وقعت الحركة قبل أن يُركَّب العنصر
    const raf = requestAnimationFrame(() => setShown(true));
    const hide = window.setTimeout(() => setShown(false), 10_000);
    const gone = window.setTimeout(onClose, 10_400);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hide);
      window.clearTimeout(gone);
    };
  }, [celebration, onClose]);

  if (!celebration) return null;

  return (
    <div
      // فوق شريط الأدوات وتحت النوافذ — لا يزاحم ولا يختفي
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl
                    ring-1 ring-slate-200 transition-all duration-500
                    motion-reduce:transition-none ${
                      shown
                        ? 'translate-y-0 opacity-100'
                        : 'translate-y-6 opacity-0 motion-reduce:translate-y-0'
                    }`}
      >
        <div className="flex items-start gap-3">
          <Rafiq mood={celebration.mood} size={60} />

          <div className="min-w-0 flex-1">
            {/* القالب يُترجَم أولاً ثم تُركَّب الأرقام فيه */}
            <p className="font-bold text-slate-900">
              {tr(celebration.title, celebration.vars)}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {tr(celebration.body, celebration.vars)}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label={tr('إغلاق')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400
                       transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X aria-hidden size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
