import { useState } from 'react';
import axios from 'axios';

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
  minutes: number;
  ref: string | null;
}

export interface DayState {
  number: number;
  focus: string;
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
}

export default function DayCard({
  weekNumber,
  day,
  track,
  isCurrent,
  onDayCompleted,
  onOpenActivity,
}: Props) {
  const [tasksDone, setTasksDone] = useState(day.tasks_done);
  const [saving, setSaving] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(isCurrent);

  const doneCount = Object.values(tasksDone).filter(Boolean).length;
  const total = day.tasks.length;
  const percent = Math.round((doneCount / total) * 100);
  const isComplete = doneCount === total;

  // المسار B يضاعف الوقت — قاعدة الكتاب
  const multiplier = track === 'B' ? 2 : 1;

  const toggle = async (task: Task) => {
    if (!day.unlocked) return;

    const next = !tasksDone[String(task.order)];

    // تحديث متفائل — الواجهة تستجيب فوراً
    setTasksDone((prev) => ({ ...prev, [String(task.order)]: next }));
    setSaving(task.order);

    try {
      const { data } = await axios.post('/progress/task', {
        week: weekNumber,
        day: day.number,
        task: task.order,
        done: next,
      });

      setTasksDone(data.tasks_done);

      if (data.completed) {
        onDayCompleted?.(day.number);
      }
    } catch {
      // فشل الحفظ — نتراجع عن التحديث المتفائل
      setTasksDone((prev) => ({ ...prev, [String(task.order)]: !next }));
    } finally {
      setSaving(null);
    }
  };

  /* ---------- يوم مقفل ---------- */
  if (!day.unlocked) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full
                             bg-slate-200 text-sm text-slate-400">
              🔒
            </span>
            <div>
              <p className="font-semibold text-slate-400">اليوم {day.number}</p>
              <p className="text-xs text-slate-400">
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
        isCurrent ? 'border-teal-400 shadow-md ring-1 ring-teal-100' : 'border-slate-200'
      }`}
    >
      {/* الرأس */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between p-5 text-right"
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full
                        text-sm font-bold ${
              isComplete
                ? 'bg-emerald-100 text-emerald-700'
                : isCurrent
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isComplete ? '✓' : day.number}
          </span>

          <div>
            <p className="font-semibold text-slate-900">
              اليوم {day.number}
              {isCurrent && !isComplete && (
                <span className="mr-2 rounded-full bg-teal-50 px-2 py-0.5
                                 text-xs font-medium text-teal-700">
                  اليوم
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500" dir="ltr">
              {day.focus}
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
          <span className="text-slate-400">{expanded ? '▴' : '▾'}</span>
        </div>
      </button>

      {/* شريط التقدّم */}
      <div className="h-1 bg-slate-100">
        <div
          className={`h-full transition-all duration-300 ${
            isComplete ? 'bg-emerald-500' : 'bg-teal-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* المهام */}
      {expanded && (
        <div className="divide-y divide-slate-100">
          {day.tasks.map((task) => {
            const checked = tasksDone[String(task.order)] ?? false;
            const isSaving = saving === task.order;

            return (
              <div
                key={task.order}
                className={`flex items-center gap-3 px-5 py-3 transition ${
                  checked ? 'bg-emerald-50/40' : 'hover:bg-slate-50'
                }`}
              >
                {/* مربع التأشير */}
                <button
                  onClick={() => toggle(task)}
                  disabled={isSaving}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center
                              rounded-md border-2 transition ${
                    checked
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 bg-white hover:border-teal-500'
                  } ${isSaving ? 'opacity-50' : ''}`}
                  aria-label={`المهمة ${task.order}`}
                >
                  {checked && <span className="text-sm leading-none">✓</span>}
                </button>

                {/* النص */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${
                      checked ? 'text-slate-400 line-through' : 'text-slate-800'
                    }`}
                  >
                    {task.label}
                  </p>
                </div>

                {/* زر النشاط التفاعلي */}
                {task.ref && !checked && (
                  <button
                    onClick={() => onOpenActivity?.(task.ref!)}
                    className="shrink-0 rounded-md bg-teal-50 px-2.5 py-1
                               text-xs font-medium text-teal-700 hover:bg-teal-100"
                  >
                    ابدأ
                  </button>
                )}

                <span className="shrink-0 text-xs text-slate-400">
                  {task.minutes * multiplier}د
                </span>
              </div>
            );
          })}

          {/* رسالة الإكمال */}
          {isComplete && (
            <div className="bg-emerald-50 px-5 py-4 text-center">
              <p className="text-sm font-medium text-emerald-800">
                اكتمل اليوم {day.number}
                {day.number < 7 && ' — اليوم التالي مفتوح الآن'}
                {day.number === 7 && ' — أنهيت الأسبوع'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
