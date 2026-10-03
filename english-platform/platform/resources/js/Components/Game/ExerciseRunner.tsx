import { useState } from 'react';
import axios from 'axios';

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
}

interface Result {
  correct: boolean;
  attempt_no: number;
  explanation: string | null;
  reveal: string | null;
}

interface Props {
  exercises: ExerciseData[];
  onFinish?: (score: number, total: number) => void;
}

export default function ExerciseRunner({ exercises, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState<any>('');
  const [result, setResult] = useState<Result | null>(null);
  const [checking, setChecking] = useState(false);
  const [score, setScore] = useState(0);
  /** التمارين التي صحّت من أول محاولة فقط تُحسب كاملة */
  const [firstTry, setFirstTry] = useState(0);

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

    return (
      <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-24 w-24 items-center justify-center
                        rounded-full bg-teal-100 text-2xl font-bold text-teal-700">
          {percent}%
        </div>
        <h3 className="mt-6 text-lg font-bold">
          {score} من {total}
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          {firstTry} منها من المحاولة الأولى
        </p>
        {score < total && (
          <p className="mt-4 text-sm text-slate-500">
            راجع الشرح في القسم النحوي قبل أن تنتقل.
          </p>
        )}
      </div>
    );
  }

  /* ---------- التمرين ---------- */
  const answered = result !== null;
  const locked = answered && result.correct;

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="text-slate-500">
          {current.exercise_no ? `تمرين ${current.exercise_no}` : 'تمرين'}
        </span>
        <span className="text-slate-500">
          {index + 1} / {total}
          <span className="mr-3 font-semibold text-emerald-600">✓ {score}</span>
        </span>
      </div>

      <div className="mb-5 h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-teal-500 transition-all"
          style={{ width: `${(index / total) * 100}%` }}
        />
      </div>

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
                  : 'border-slate-300 focus:border-teal-500'
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
                : 'border-slate-200 focus:border-teal-500'
            }`}
            placeholder="اكتب الجملة الصحيحة"
          />
        </div>
      )}

      {current.type === 'multiple_choice' && (
        <div>
          <p className="mb-4 text-lg">{current.prompt}</p>
          <div className="space-y-2" dir="ltr">
            {(current.payload?.options ?? []).map((opt: string, i: number) => {
              const picked = value === i;
              let style = 'border-slate-200 hover:border-teal-400 hover:bg-teal-50';
              if (answered && picked) {
                style = result.correct
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-rose-400 bg-rose-50';
              } else if (answered) {
                style = 'border-slate-200 opacity-50';
              } else if (picked) {
                style = 'border-teal-500 bg-teal-50';
              }

              return (
                <button
                  key={i}
                  onClick={() => !answered && setValue(i)}
                  disabled={locked}
                  className={`w-full rounded-lg border-2 px-4 py-3 text-left
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
              { label: 'صحيح', val: true },
              { label: 'خطأ', val: false },
            ].map(({ label, val }) => {
              const picked = value === val;
              let style = 'border-slate-200 hover:border-teal-400 hover:bg-teal-50';
              if (answered && picked) {
                style = result.correct
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-rose-400 bg-rose-50';
              } else if (answered) {
                style = 'border-slate-200 opacity-50';
              } else if (picked) {
                style = 'border-teal-500 bg-teal-50';
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
          className={`mt-5 rounded-lg border-r-4 p-4 ${
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
            {result.correct ? 'صحيح' : 'ليست صحيحة'}
          </p>

          {result.explanation && (
            <p className="mt-1.5 text-sm text-slate-700">{result.explanation}</p>
          )}

          {/* الإجابة تُكشف بعد محاولتين فاشلتين — منهج الكتاب */}
          {result.reveal && (
            <p className="mt-2 text-sm" dir="ltr">
              <span className="text-slate-500">الإجابة: </span>
              <span className="font-semibold text-slate-900">{result.reveal}</span>
            </p>
          )}

          {!result.correct && !result.reveal && (
            <p className="mt-1.5 text-xs text-slate-500">
              حاول مرة أخرى — الإجابة تظهر بعد المحاولة الثانية
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
            className="rounded-lg bg-teal-600 px-6 py-2.5 font-medium text-white
                       hover:bg-teal-700 disabled:opacity-40"
          >
            {checking ? '…' : 'تحقّق'}
          </button>
        )}

        {answered && !result.correct && (
          <button
            onClick={retry}
            className="rounded-lg bg-slate-100 px-5 py-2.5 font-medium
                       text-slate-700 hover:bg-slate-200"
          >
            حاول مرة أخرى
          </button>
        )}

        {answered && (
          <button
            onClick={next}
            className="rounded-lg bg-slate-900 px-6 py-2.5 font-medium text-white
                       hover:bg-slate-800"
          >
            {index + 1 >= total ? 'النتيجة' : 'التالي'}
          </button>
        )}
      </div>
    </div>
  );
}
