import { ChevronDown, ChevronUp, Mic } from 'lucide-react';
import { useState } from 'react';
import Listen from '@/Components/Listen';
import { useT } from '@/lib/i18n';

/**
 * ما يُقال قبل التسجيل.
 *
 * ── ما كان يحدث ─────────────────────────────────────────────
 * «سجّل 60–90 ثانية عن موضوع اليوم» ثم مسجّل فارغ. والمتدرّب لا
 * يعرف عمّ يتكلّم، فيضغط «سجّل» ثم يصمت، ثم يترك المهمّة.
 *
 * ── وما يحلّه هذا ──────────────────────────────────────────
 * ثلاثة أسئلة يجيب عنها الكتاب، تُعرض بترتيب الحاجة إليها:
 *
 *   ① **عمّ أتكلّم؟**  سطرٌ واحد صريح.
 *   ② **كيف أوزّع الوقت؟** جدول أجزاء بثوانيها — وهو ما يحوّل
 *      «دقيقتان» المخيفة إلى خمس قطع من عشرين ثانية.
 *   ③ **متى أكون قد أحسنت؟** جدول تقييم يُعطيه رقماً يقارنه بعد
 *      ستة أسابيع بنفسه.
 *
 * ── والنموذج مطويّ عمداً ───────────────────────────────────
 * قاعدة الكتاب: اقرأ النموذج، ثم **أبعِد الورقة** وسجّل من الذاكرة.
 * فلو بقي مفتوحاً أمام المسجّل لقرأه المتدرّب، والقراءة ليست تحدّثاً.
 */

export interface SpeakingPayload {
  task_ar: string;
  target_seconds: number;
  is_baseline?: boolean;
  title_en?: string | null;
  intro_ar?: string | null;
  cover_ar?: string[] | null;
  model_en?: string | null;
  outline?: {
    part_en: string;
    part_ar?: string | null;
    say_en?: string;
    seconds?: number | null;
  }[];
  rubric?: { label_en: string; label_ar?: string | null; levels: string[] }[];
  save_as?: string;
}

/** المدّة بصيغة تُترجَم: القالب مفتاح والرقم يُركَّب فيه */
const fmt = (tr: (t: string, v?: Record<string, string | number>) => string, s: number) =>
  s >= 60 ? tr(':n دقيقة', { n: Math.round(s / 60) }) : tr(':n ثانية', { n: s });

export default function SpeakingBrief({ speaking }: { speaking: SpeakingPayload }) {
  const tr = useT();
  const [openModel, setOpenModel] = useState(false);
  const [openRubric, setOpenRubric] = useState(false);

  const parts = speaking.outline ?? [];
  const rubric = speaking.rubric ?? [];

  return (
    <div className="space-y-3">
      {/* ① المهمّة — أبرز ما في الشاشة، لأنه أول ما يُسأل عنه */}
      <div className="rounded-2xl bg-gradient-to-bl from-violet-600 to-violet-500 p-5 text-white">
        <p className="text-xs font-medium text-violet-100">
          <Mic aria-hidden size={15} className="inline-block align-[-2px]" /> {tr('مهمّة التسجيل')}
          {speaking.is_baseline && (
            <span className="ms-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {tr('خط الأساس — تقارن به كل تسجيل بعده')}
            </span>
          )}
        </p>

        <p className="mt-2 text-lg font-bold leading-snug">{speaking.task_ar}</p>

        <p className="mt-2 text-xs text-violet-100">
          {fmt(tr, speaking.target_seconds)}
          {speaking.title_en && (
            <>
              {' · '}
              <span dir="ltr">{speaking.title_en}</span>
            </>
          )}
        </p>
      </div>

      {speaking.intro_ar && (
        <p className="rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-200">
          {speaking.intro_ar}
        </p>
      )}

      {/* ② التقسيم — «دقيقتان» تصير خمس قطع يعرف كل واحدة */}
      {parts.length > 0 && (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <p className="text-sm font-bold text-slate-900">
            {tr('قسّم وقتك هكذا')}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {tr('لا تحفظ النصّ — احفظ الترتيب وحده')}
          </p>

          <ol className="mt-3 space-y-2">
            {parts.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl bg-slate-50 p-3"
              >
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-lg
                             bg-violet-100 text-xs font-bold text-violet-700"
                >
                  {i + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">
                    {p.part_ar ?? <span dir="ltr">{p.part_en}</span>}
                  </span>
                  {p.say_en && (
                    <span
                      className="mt-0.5 block text-xs leading-relaxed text-slate-600"
                      dir="ltr"
                    >
                      {p.say_en}
                    </span>
                  )}
                </span>

                {p.seconds != null && (
                  <span className="shrink-0 text-xs font-semibold text-violet-600">
                    {p.seconds}
                    <span className="text-xs font-normal text-slate-400">
                      {' '}
                      {tr('ث')}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* أسابيع المراجعة: نقاط تُغطّى بلا توقيت */}
      {(speaking.cover_ar ?? []).length > 0 && (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <p className="text-sm font-bold text-slate-900">{tr('غطِّ هذه النقاط')}</p>
          <ul className="mt-3 space-y-1.5">
            {speaking.cover_ar!.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700">
                <span className="text-violet-400">•</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ③ النموذج — مطويّ، ويُغلق قبل التسجيل */}
      {speaking.model_en && (
        <div className="rounded-2xl bg-white ring-1 ring-slate-200">
          <button
            onClick={() => setOpenModel((v) => !v)}
            className="flex w-full items-center justify-between gap-3 p-4 text-start"
          >
            <span className="text-sm font-bold text-slate-900">
              {tr('اقرأ نموذجاً أولاً')}
            </span>
            <span className="text-xs text-slate-400">
              {openModel ? <>{tr('أغلق')} <ChevronUp aria-hidden size={15} className="inline-block align-[-3px]" /></> : <>{tr('افتح')} <ChevronDown aria-hidden size={15} className="inline-block align-[-3px]" /></>}
            </span>
          </button>

          {openModel && (
            <div className="border-t border-slate-100 p-4">
              <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                {tr('اقرأه بصوت مسموع مرّتين، ثم أغلقه وسجّل من ذاكرتك. القراءة ليست تحدّثاً.')}
              </p>

              {speaking.model_en.split('\n').map((line, i) => (
                <div key={i} className="mb-3 last:mb-0">
                  <p className="text-sm leading-loose text-slate-700" dir="ltr">
                    {/* «//» في الكتاب علامة وقفة طبيعية بين فكرتين */}
                    {line.split('//').map((piece, k, all) => (
                      <span key={k}>
                        {piece.trim()}
                        {k < all.length - 1 && (
                          <span className="mx-1 text-violet-400" title={tr('قف هنا')}>
                            ⏸
                          </span>
                        )}
                      </span>
                    ))}
                  </p>
                  <div className="mt-1">
                    <Listen text={line.replaceAll('//', ' ')} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ④ التقييم — رقمٌ يُقارَن، لا حكم */}
      {rubric.length > 0 && (
        <div className="rounded-2xl bg-white ring-1 ring-slate-200">
          <button
            onClick={() => setOpenRubric((v) => !v)}
            className="flex w-full items-center justify-between gap-3 p-4 text-start"
          >
            <span className="text-sm font-bold text-slate-900">
              {tr('كيف تقيّم نفسك بعد التسجيل')}
            </span>
            <span className="text-xs text-slate-400">
              {openRubric ? <>{tr('أغلق')} <ChevronUp aria-hidden size={15} className="inline-block align-[-3px]" /></> : <>{tr('افتح')} <ChevronDown aria-hidden size={15} className="inline-block align-[-3px]" /></>}
            </span>
          </button>

          {openRubric && (
            <div className="border-t border-slate-100 p-4">
              <p className="mb-3 text-xs leading-relaxed text-slate-500">
                {tr('استمع إلى تسجيلك وأعطِ نفسك درجة في كل سطر. الرقم ليس حكماً — هو ما ستقارنه بنفسك بعد ستة أسابيع.')}
              </p>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {rubric.map((r, i) => (
                      <tr key={i} className="align-top">
                        <th className="w-32 py-2 pe-3 text-start font-semibold text-slate-800">
                          {r.label_ar ?? <span dir="ltr">{r.label_en}</span>}
                          {r.label_ar && (
                            <span className="block font-normal text-[10px] text-slate-400" dir="ltr">
                              {r.label_en}
                            </span>
                          )}
                        </th>
                        {r.levels.map((lv, k) => (
                          <td
                            key={k}
                            className={`px-2 py-2 leading-relaxed ${
                              k === r.levels.length - 1
                                ? 'text-emerald-700'
                                : 'text-slate-500'
                            }`}
                            dir="ltr"
                          >
                            {lv}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
