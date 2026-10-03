import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { commonError } from '@/lib/commonErrors';
import { useT } from '@/lib/i18n';

/**
 * منفّذ التمارين — يدعم الأنواع الأربعة الموجودة في الأسبوع الأول.
 *
 * قاعدة أمنية: التصحيح على الخادم دائماً.
 * الواجهة لا تعرف الإجابة الصحيحة قبل المحاولة، ولا يمكن
 * استخراجها من الـ props لأن Exercise::$hidden يحجبها.
 *
 * منهج الكتاب: الإجابة تُكشف بعد محاولتين فاشلتين لا فوراً —
 * المحاولة الثانية هي التي تُرسّخ التعلّم.
 */

export interface ExerciseData {
  id: number;
  type: 'fill_blank' | 'multiple_choice' | 'true_false' | 'correct_error';
  prompt: string;
  payload: Record<string, any> | null;
  points: number;
  exercise_no: number | null;
  /** ما يُدرّبه هذا التمرين — يُعرض بدل ترقيم الكتاب */
  focus_ar?: string | null;
  /** رقم الخطأ من العشرين، إن كان يقابل خطأً بعينه */
  error_no?: number | null;
}

interface Result {
  correct: boolean;
  attempt_no: number;
  explanation: string | null;
  reveal: string | null;
}

interface Props {
  /** يُبلّغ الموضع إلى الأعلى ويُخفي الشريط الداخلي */
  onProgress?: (done: number, total: number) => void;
  exercises: ExerciseData[];
  onFinish?: (score: number, total: number) => void;
}

/**
 * تعليمة لكل نوع.
 *
 * المتعلّم المبتدئ لا يستنتج المطلوب من شكل الحقل: هل يكتب الكلمة
 * الناقصة أم الجملة كاملة؟ قول ذلك صريحاً يوفّر محاولة مهدرة.
 */
const INSTRUCTIONS: Record<ExerciseData['type'], string> = {
  fill_blank: 'أكمل الفراغ بالكلمة الصحيحة',
  correct_error: 'أعد كتابة الجملة كاملة بعد تصحيح الخطأ',
  multiple_choice: 'اختر إجابة واحدة',
  true_false: 'اقرأ الجملة — هل تطابق ما ورد في الحوار؟',
};

export default function ExerciseRunner({ exercises, onFinish, onProgress}: Props) {
  const tr = useT();
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState<any>('');
  const [result, setResult] = useState<Result | null>(null);
  const [checking, setChecking] = useState(false);
  const [score, setScore] = useState(0);
  /** التمارين التي صحّت من أول محاولة فقط تُحسب كاملة */
  const [firstTry, setFirstTry] = useState(0);
  /** مواضيع أخفق فيها — تُعرض في النتيجة بدل «راجع القسم النحوي» */
  const [missed, setMissed] = useState<string[]>([]);

  const current = exercises[index];
  const total = exercises.length;
  const done = index >= total;

  const check = async () => {
    if (value === '' || value === null) return;

    setChecking(true);
    try {
      const { data } = await axios.post<Result>(
        `/exercises/${current.id}/check`,
        { response: value },
      );

      setResult(data);

      if (data.correct) {
        setScore((s) => s + 1);
        if (data.attempt_no === 1) setFirstTry((f) => f + 1);
      } else if (data.attempt_no === 1 && current.focus_ar) {
        // نسجّل الموضوع مرة واحدة لكل تمرين، عند أول إخفاق
        setMissed((m) => (m.includes(current.focus_ar!) ? m : [...m, current.focus_ar!]));
      }
    } finally {
      setChecking(false);
    }
  };

  const retry = () => {
    setResult(null);
    setValue('');
  };

  const next = () => {
    if (index + 1 >= total) {
      onFinish?.(score, total);
    }
    setIndex((i) => i + 1);
    setValue('');
    setResult(null);
  };

  /* ---------- النتيجة ---------- */
  if (done) {
    const percent = Math.round((score / total) * 100);
    const missedFocus = missed;

    return (
      <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-24 w-24 items-center justify-center
                        rounded-full bg-violet-100 text-2xl font-bold text-violet-700">
          {percent}%
        </div>
        <h3 className="mt-6 text-lg font-bold">
          {score} من {total}
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          {firstTry} منها من المحاولة الأولى
        </p>

        {/* 80% هو الهدف لا 100% — قاعدة الكتاب */}
        <p
          className={`mt-3 text-sm font-medium ${
            percent >= 80 ? 'text-emerald-700' : 'text-amber-700'
          }`}
        >
          {percent >= 80
            ? tr('بلغت الهدف — 80% تكفي، والإصرار على الكمال يُوقف')
            : tr('الهدف 80%. أعد التمارين التي أخفقت فيها')}
        </p>

        {/* ما يحتاج مراجعة — بالموضوع لا برقم التمرين */}
        {missedFocus.length > 0 && (
          <div className="mt-5 text-start">
            <p className="mb-2 text-xs font-semibold text-slate-700">
              {tr('راجع هذه المواضيع:')}
            </p>
            <ul className="space-y-1.5">
              {missedFocus.map((f) => (
                <li
                  key={f}
                  className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
                >
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  /* ---------- التمرين ---------- */
  const answered = result !== null;
  const locked = answered && result.correct;
  const linkedError = commonError(current.error_no);

  // يُبلَّغ الأعلى بالموضع، فيعرضه في شريطه الواحد بدل شريط ثانٍ
  useEffect(() => {
    onProgress?.(index, total);
  }, [index, total, onProgress]);

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      {/* الموضوع أولاً — «تمرين 5» ترقيم كتاب لا يقول ما يُختبر فيه */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {current.focus_ar && (
              <p className="text-sm font-semibold text-slate-900">
                {current.focus_ar}
              </p>
            )}
            <p className="mt-0.5 text-xs text-slate-500">{tr(INSTRUCTIONS[current.type])}</p>
          </div>

          <span className="shrink-0 text-sm text-slate-500">
            {index + 1} / {total}
            <span className="me-3 font-semibold text-emerald-600"><Check aria-hidden size={15} className="inline-block align-[-3px]" /> {score}</span>
          </span>
        </div>

        {/* الخطأ المستهدف — يُعلن قبل المحاولة لا بعدها */}
        {linkedError && (
          <p className="mt-2 inline-block rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
            يعالج الخطأ {linkedError.no} من العشرين · {linkedError.rule_ar}
          </p>
        )}
      </div>

      {/* الشريط الداخلي يُخفى حين يحمله شريط الصفحة */}
      {!onProgress && (
        <div className="mb-5 h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-violet-500 transition-all"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
      )}

      {/* ============ حسب النوع ============ */}

      {current.type === 'fill_blank' && (
        <div>
          <p className="mb-4 text-lg" dir="ltr">
            <span>{current.payload?.before} </span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !answered && check()}
              disabled={locked}
              autoFocus
              className={`mx-1 w-28 rounded-md border-b-2 bg-slate-50 px-2 py-1
                          text-center font-semibold outline-none transition ${
                answered
                  ? result.correct
                    ? 'border-emerald-500 text-emerald-700'
                    : 'border-rose-400 text-rose-700'
                  : 'border-slate-300 focus:border-violet-500'
              }`}
              placeholder="…"
            />
            <span> {current.payload?.after}</span>
          </p>
        </div>
      )}

      {current.type === 'correct_error' && (
        <div>
          <p className="mb-3 text-sm text-slate-600">{current.prompt}</p>
          <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-lg
                        text-rose-900 line-through" dir="ltr">
            {current.payload?.sentence}
          </p>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !answered && check()}
            disabled={locked}
            autoFocus
            dir="ltr"
            className={`w-full rounded-lg border-2 px-4 py-3 outline-none transition ${
              answered
                ? result.correct
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-rose-400 bg-rose-50'
                : 'border-slate-200 focus:border-violet-500'
            }`}
            placeholder={tr("اكتب الجملة الصحيحة")}
          />
        </div>
      )}

      {current.type === 'multiple_choice' && (
        <div>
          <p className="mb-4 text-lg">{current.prompt}</p>
          <div className="space-y-2" dir="ltr">
            {(current.payload?.options ?? []).map((opt: string, i: number) => {
              const picked = value === i;
              let style = 'border-slate-200 hover:border-violet-400 hover:bg-violet-50';
              if (answered && picked) {
                style = result.correct
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-rose-400 bg-rose-50';
              } else if (answered) {
                style = 'border-slate-200 opacity-50';
              } else if (picked) {
                style = 'border-violet-500 bg-violet-50';
              }

              return (
                <button
                  key={i}
                  onClick={() => !answered && setValue(i)}
                  disabled={locked}
                  className={`w-full rounded-lg border-2 px-4 py-3 text-end
                              font-medium transition ${style}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {current.type === 'true_false' && (
        <div>
          <p className="mb-5 text-lg" dir="ltr">{current.prompt}</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: tr('صحيح'), val: true },
              { label: tr('خطأ'), val: false },
            ].map(({ label, val }) => {
              const picked = value === val;
              let style = 'border-slate-200 hover:border-violet-400 hover:bg-violet-50';
              if (answered && picked) {
                style = result.correct
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-rose-400 bg-rose-50';
              } else if (answered) {
                style = 'border-slate-200 opacity-50';
              } else if (picked) {
                style = 'border-violet-500 bg-violet-50';
              }

              return (
                <button
                  key={label}
                  onClick={() => !answered && setValue(val)}
                  disabled={locked}
                  className={`rounded-lg border-2 py-4 font-semibold transition ${style}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ التغذية الراجعة ============ */}

      {answered && (
        <div
          className={`mt-5 rounded-lg border-s-4 p-4 ${
            result.correct
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-rose-400 bg-rose-50'
          }`}
        >
          <p
            className={`font-semibold ${
              result.correct ? 'text-emerald-800' : 'text-rose-800'
            }`}
          >
            {result.correct ? tr('صحيح') : tr('ليست صحيحة')}
          </p>

          {result.explanation && (
            <p className="mt-1.5 text-sm text-slate-700">{result.explanation}</p>
          )}

          {/* أقوى لحظة تعليمية: أن يرى الصيغة التي كان يقولها
              بجانب الصيغة الصحيحة. تظهر عند الإخفاق فقط. */}
          {!result.correct && linkedError && (
            <div className="mt-3 space-y-1.5 rounded-lg bg-white/70 p-3" dir="ltr">
              <p className="text-sm text-rose-700 line-through decoration-rose-300">
                {linkedError.wrong}
              </p>
              <p className="text-sm font-semibold text-emerald-800">
                {linkedError.right}
              </p>
            </div>
          )}

          {/* الإجابة تُكشف بعد محاولتين فاشلتين — منهج الكتاب */}
          {result.reveal && (
            <p className="mt-2 text-sm" dir="ltr">
              <span className="text-slate-500">{tr('الإجابة:')} </span>
              <span className="font-semibold text-slate-900">{result.reveal}</span>
            </p>
          )}

          {!result.correct && !result.reveal && (
            <p className="mt-1.5 text-xs text-slate-500">
              {tr('حاول مرة أخرى — الإجابة تظهر بعد المحاولة الثانية')}
            </p>
          )}
        </div>
      )}

      {/* ============ الأزرار ============ */}

      <div className="mt-5 flex justify-end gap-2">
        {!answered && (
          <button
            onClick={check}
            disabled={checking || value === '' || value === null}
            className="rounded-lg bg-violet-600 px-6 py-2.5 font-medium text-white
                       hover:bg-violet-700 disabled:opacity-40"
          >
            {checking ? '…' : tr('تحقّق')}
          </button>
        )}

        {answered && !result.correct && (
          <button
            onClick={retry}
            className="rounded-lg bg-slate-100 px-5 py-2.5 font-medium
                       text-slate-700 hover:bg-slate-200"
          >
            {tr('حاول مرة أخرى')}
          </button>
        )}

        {answered && (
          <button
            onClick={next}
            className="rounded-lg bg-slate-900 px-6 py-2.5 font-medium text-white
                       hover:bg-slate-800"
          >
            {index + 1 >= total ? tr('النتيجة') : tr('التالي')}
          </button>
        )}
      </div>
    </div>
  );
}
