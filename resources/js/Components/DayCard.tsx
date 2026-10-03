import { useState } from 'react';
import { Link } from '@inertiajs/react';
import axios from 'axios';
import { cleanLabel } from '@/lib/labels';
import { useLocale, pick, dirFor } from '@/lib/bilingual';
import { useT } from '@/lib/i18n';
import { Check, ChevronDown, ChevronUp, Lock } from 'lucide-react';

/**
 * بطاقة اليوم — قلب نظام الصرامة في الواجهة.
 *
 * مأخوذة من §"Your Seven Days" في الكتاب حرفياً:
 *   - خمس مهام بالدقائق
 *   - مربعات تأشير تحفظ على الخادم فوراً
 *   - اليوم التالي مقفل حتى تكتمل كل المهام
 *
 * ملاحظة معمارية: التأشير يُرسل للخادم مباشرة (optimistic update).
 * السبب: المستخدم قد يغلق الصفحة في أي لحظة، ولا يجوز أن يفقد تقدّمه.
 */

export interface Task {
  order: number;
  label: string;
  label_ar?: string;
  label_en?: string;
  minutes: number;
  ref: string | null;
}

export interface DayState {
  number: number;
  focus: string;
  focus_ar?: string;
  focus_en?: string;
  tasks: Task[];
  minutes: number;
  unlocked: boolean;
  tasks_done: Record<string, boolean>;
  percent: number;
  completed: boolean;
}

interface Props {
  weekNumber: number;
  day: DayState;
  track: 'A' | 'B';
  /** هل هذا هو اليوم الحالي للمستخدم؟ */
  isCurrent: boolean;
  /** يُنادى عند اكتمال اليوم ليحدّث الأب حالة القفل */
  onDayCompleted?: (dayNumber: number) => void;
  /** فتح مكوّن تفاعلي: لعبة، بطاقات، مسجّل… */
  onOpenActivity?: (ref: string) => void;
  /**
   * وصف ما يفتحه المرجع — «١٢ زوجاً صوتياً» أو «٢٠ كلمة».
   * يعرفه الأب لأنه يملك محتوى الأسبوع. بدونه تكون المهمة
   * عنواناً غامضاً لا يعرف المتدرّب ما ينتظره فيه.
   */
  describeRef?: (ref: string) => string | null;
  /** ابدأ مفتوحاً — لبطاقة «اليوم» البارزة */
  defaultExpanded?: boolean;
}

export default function DayCard({
  weekNumber,
  day,
  track,
  isCurrent,
  onDayCompleted,
  onOpenActivity,
  describeRef,
  defaultExpanded,
}: Props) {
  const tr = useT();
  const locale = useLocale();
  const dayName = pick(locale, day.focus_ar ?? day.focus, day.focus_en);
  const taskName = (t: Task) => pick(locale, t.label_ar ?? t.label, t.label_en);

  const [tasksDone, setTasksDone] = useState(day.tasks_done);
  const [expanded, setExpanded] = useState(defaultExpanded ?? isCurrent);

  // المهامّ الموجودة لا المفاتيح المخزَّنة — خطة قديمة تترك مفاتيح ميتة
  const doneCount = day.tasks.filter((t) => tasksDone[String(t.order)]).length;
  const total = day.tasks.length;
  const percent = Math.round((doneCount / total) * 100);
  const isComplete = doneCount === total;

  // المسار B يضاعف الوقت — قاعدة الكتاب
  const multiplier = track === 'B' ? 2 : 1;

  /* ---------- يوم مقفل ---------- */
  if (!day.unlocked) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full
                             bg-slate-200 text-sm text-slate-400">
              <Lock aria-hidden size={15} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-400">اليوم {day.number}</p>
              {/* موضوع اليوم يظهر وإن كان مقفلاً — معرفة ما ينتظره تحفّز */}
              <p className="truncate text-xs text-slate-400" dir="ltr">
                {dayName.primary}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                أكمل اليوم {day.number - 1} أولاً
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-400">
            {day.minutes * multiplier} دقيقة
          </span>
        </div>
      </div>
    );
  }

  /* ---------- يوم مفتوح ---------- */
  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white transition ${
        isCurrent ? 'border-violet-400 shadow-md ring-1 ring-violet-100' : 'border-slate-200'
      }`}
    >
      {/* الرأس */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between p-5 text-start"
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full
                        text-sm font-bold ${
              isComplete
                ? 'bg-emerald-100 text-emerald-700'
                : isCurrent
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isComplete ? <Check size={16} /> : day.number}
          </span>

          <div>
            <p className="font-semibold text-slate-900">
              اليوم {day.number}
              {isCurrent && !isComplete && (
                <span className="me-2 rounded-full bg-violet-50 px-2 py-0.5
                                 text-xs font-medium text-violet-700">
                  {tr('اليوم')}
                </span>
              )}
              {isComplete && (
                <span className="me-2 rounded-full bg-emerald-50 px-2 py-0.5
                                 text-xs font-medium text-emerald-700">
                  {tr('مكتمل · افتحه للمراجعة')}
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500" dir="ltr">
              {dayName.primary}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {doneCount}/{total}
          </span>
          <span className="text-xs text-slate-400">
            {day.minutes * multiplier}د
          </span>
          <span className="text-slate-400">{expanded ? <ChevronUp aria-hidden size={16} /> : <ChevronDown aria-hidden size={16} />}</span>
        </div>
      </button>

      {/* شريط التقدّم */}
      <div className="h-1 bg-slate-100">
        <div
          className={`h-full transition-all duration-300 ${
            isComplete ? 'bg-emerald-500' : 'bg-violet-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* المهام */}
      {expanded && (
        <div className="divide-y divide-slate-100">
          {/* الدخول إلى صفحة اليوم — حيث المحتوى التعليمي معروض بترتيب المهام */}
          <div className="bg-slate-50/70 p-4">
            <Link
              href={`/week/${weekNumber}/day/${day.number}`}
              className={`block w-full rounded-xl py-3 text-center text-sm font-semibold
                          transition ${
                            isComplete
                              ? 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300'
                              : 'bg-violet-600 text-white hover:bg-violet-700'
                          }`}
            >
              {isComplete
                ? tr('افتح اليوم للمراجعة')
                : doneCount > 0
                  ? tr('أكمل اليوم')
                  : tr('ابدأ اليوم — المحتوى ثم المهام')}
            </Link>
          </div>

          {day.tasks.map((task) => {
            const checked = tasksDone[String(task.order)] ?? false;
            const description = task.ref ? describeRef?.(task.ref) : null;

            return (
              <div
                key={task.order}
                className={`flex items-center gap-3 px-5 py-3 transition ${
                  checked ? 'bg-violet-50/40' : 'hover:bg-slate-50'
                }`}
              >
                {/*
                  علامة حالة لا مربّع تأشير.
                  
                  كان مربّعاً يُضغط، وهذا يفتح باباً لا نريده: أن يُعلن
                  المتدرّب إنجاز مهمّة لم يفتحها. والإنجاز يُكتسب من
                  داخل المهمّة نفسها — تنهي التمارين فتُؤشَّر، لا
                  تؤشّرها لتنتهي. فبقيت العلامة خبراً ولم تعد زرّاً.
                */}
                <span
                  aria-hidden
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-sm
                              transition ${
                                checked
                                  ? 'bg-violet-700 text-white'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                >
                  {checked ? <Check size={15} /> : task.order}
                </span>

                {/* النص + ما يفتحه */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${
                      checked ? 'text-slate-400 line-through' : 'text-slate-800'
                    }`}
                  >
                    {taskName(task).primary}
                  </p>
                  {taskName(task).secondary && (
                    <p className="hidden text-xs text-slate-400 sm:block" dir={dirFor(taskName(task).secondary!)}>
                      {taskName(task).secondary}
                    </p>
                  )}

                  {/* وصف المحتوى — يعرف ما ينتظره قبل أن ينقر */}
                  {description ? (
                    <p className="mt-0.5 text-xs text-slate-400">{description}</p>
                  ) : (
                    !task.ref && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {tr('خارج المنصة — أنجزها ثم أشّرها')}
                      </p>
                    )
                  )}
                </div>

                {/* زر النشاط — يظهر دائماً.
                    كان يختفي عند التأشير فيمنع المراجعة، وهذا خطأ:
                    المتدرّب يعود للتمرين والحوار مرات قبل أن يرسخ. */}
                {task.ref && (
                  <button
                    onClick={() => onOpenActivity?.(task.ref!)}
                    className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition
                                ${
                                  checked
                                    ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                                }`}
                  >
                    {checked ? tr('راجع') : tr('ابدأ')}
                  </button>
                )}

                <span className="shrink-0 text-xs text-slate-400">
                  {task.minutes * multiplier}د
                </span>
              </div>
            );
          })}

          {/* رسالة الإكمال — والمراجعة تبقى مفتوحة بعدها */}
          {isComplete && (
            <div className="bg-emerald-50 px-5 py-4 text-center">
              <p className="text-sm font-medium text-emerald-800">
                اكتمل اليوم {day.number}
                {day.number < 7 && tr(' — اليوم التالي مفتوح الآن')}
                {day.number === 7 && tr(' — أنهيت الأسبوع')}
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                {tr('كل نشاط أعلاه يبقى متاحاً — اضغط «راجع» متى شئت')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
