import { useCallback, useMemo, useState } from 'react';
import { useSpeech } from '@/hooks/useSpeech';

/**
 * لعبة التمييز الصوتي.
 *
 * المنطق مأخوذ من §8.2 في الكتاب حرفياً:
 *   - المجموعات منفصلة (لا نخلط /ɪ/ مع /ʊ/ مع /æ/)
 *   - المتصفح ينطق إحدى الكلمتين عشوائياً
 *   - المستخدم يضغط ما سمعه
 *   - الهدف 11 من 12
 *
 * لا يوجد ملف صوتي واحد على الخادم — Web Speech ينطق كل شيء.
 */

interface Pair {
  id: number;
  ipa: string | null;
  word_a: string;
  word_b: string;
}

interface Props {
  /** الأزواج مجمّعة حسب المجموعة كما في الكتاب */
  groups: Record<string, Pair[]>;
  /** الهدف المطلوب — من الكتاب: 11 من 12 */
  target?: number;
  onFinish?: (score: number, total: number) => void;
}

type Phase = 'idle' | 'playing' | 'answered' | 'done';

interface Question {
  pair: Pair;
  /** أي الكلمتين نُطقت فعلاً */
  spoken: 'a' | 'b';
  group: string;
}

export default function MinimalPairGame({ groups, target = 11, onFinish }: Props) {
  const { speak, speaking, supported } = useSpeech();

  // بناء قائمة الأسئلة: كل زوج سؤال واحد، مرتّبة بالمجموعات
  const questions = useMemo<Question[]>(() => {
    const list: Question[] = [];
    Object.entries(groups).forEach(([group, pairs]) => {
      pairs.forEach((pair) => {
        list.push({
          pair,
          // اختيار عشوائي أي كلمة تُنطق
          spoken: Math.random() < 0.5 ? 'a' : 'b',
          group,
        });
      });
    });
    return list;
  }, [groups]);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [picked, setPicked] = useState<'a' | 'b' | null>(null);
  const [correct, setCorrect] = useState(0);
  /** الأخطاء — تُعرض في النهاية ليعرف أي أزواج يحتاج تدريباً */
  const [missed, setMissed] = useState<Question[]>([]);

  const current = questions[index];
  const total = questions.length;

  /** نطق الكلمة المطلوبة */
  const play = useCallback(
    (rate = 0.8) => {
      if (!current) return;
      const word = current.spoken === 'a' ? current.pair.word_a : current.pair.word_b;
      speak(word, { rate });
      if (phase === 'idle') setPhase('playing');
    },
    [current, speak, phase],
  );

  const pick = (choice: 'a' | 'b') => {
    if (phase === 'answered' || phase === 'done') return;

    setPicked(choice);
    setPhase('answered');

    if (choice === current.spoken) {
      setCorrect((c) => c + 1);
    } else {
      setMissed((m) => [...m, current]);
    }
  };

  const next = () => {
    if (index + 1 >= total) {
      setPhase('done');
      onFinish?.(correct, total);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setPhase('idle');
  };

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setCorrect(0);
    setMissed([]);
    setPhase('idle');
  };

  /* ---------- المتصفح لا يدعم النطق ---------- */
  if (!supported) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center">
        <p className="font-semibold text-amber-900">
          متصفحك لا يدعم النطق الآلي
        </p>
        <p className="mt-2 text-sm text-amber-800">
          استخدم Chrome أو Edge أو Safari. أو اضغط روابط كامبريدج في جدول
          الأزواج للاستماع يدوياً.
        </p>
      </div>
    );
  }

  /* ---------- شاشة النتيجة ---------- */
  if (phase === 'done') {
    const passed = correct >= target;

    return (
      <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
        <div
          className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold ${
            passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {correct}/{total}
        </div>

        <h3 className="mt-6 text-xl font-bold">
          {passed ? 'أذنك تميّز الفرق' : 'تحتاج تدريباً أكثر'}
        </h3>

        <p className="mt-2 text-sm text-slate-600">
          {passed
            ? `الهدف كان ${target} من ${total} — وقد تجاوزته.`
            : `الهدف ${target} من ${total}. لا تنتقل للإنتاج قبل أن تصل إليه — الاستماع أولاً دائماً.`}
        </p>

        {missed.length > 0 && (
          <div className="mt-6 text-right">
            <p className="mb-3 text-sm font-semibold text-slate-700">
              الأزواج التي أخطأت فيها — درّبها عشر دقائق يومياً:
            </p>
            <div className="space-y-2">
              {missed.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2"
                >
                  <span className="font-mono text-sm text-slate-500" dir="ltr">
                    {m.pair.ipa}
                  </span>
                  <div className="flex gap-2" dir="ltr">
                    {[m.pair.word_a, m.pair.word_b].map((w) => (
                      <button
                        key={w}
                        onClick={() => speak(w, { rate: 0.7 })}
                        className="rounded-md bg-white px-3 py-1 text-sm font-medium
                                   shadow-sm ring-1 ring-slate-200 hover:bg-slate-100"
                      >
                        🔊 {w}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={restart}
          className="mt-6 rounded-lg bg-slate-900 px-6 py-2.5 font-medium text-white
                     hover:bg-slate-800"
        >
          أعد المحاولة
        </button>
      </div>
    );
  }

  /* ---------- شاشة اللعب ---------- */
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      {/* الرأس: التقدّم والمجموعة */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">{current.group}</p>
          <p className="font-mono text-sm text-teal-700" dir="ltr">
            {current.pair.ipa}
          </p>
        </div>
        <div className="text-sm text-slate-500">
          {index + 1} / {total}
          <span className="mr-3 font-semibold text-emerald-600">✓ {correct}</span>
        </div>
      </div>

      {/* شريط التقدّم */}
      <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-teal-500 transition-all duration-300"
          style={{ width: `${(index / total) * 100}%` }}
        />
      </div>

      {/* زر التشغيل */}
      <div className="mb-8 text-center">
        <button
          onClick={() => play(0.8)}
          disabled={speaking}
          className="mx-auto flex h-24 w-24 items-center justify-center rounded-full
                     bg-teal-600 text-white shadow-lg transition
                     hover:bg-teal-700 disabled:opacity-60"
          aria-label="استمع"
        >
          <span className="text-4xl">{speaking ? '🔉' : '🔊'}</span>
        </button>

        <p className="mt-3 text-sm text-slate-600">
          {phase === 'idle' ? 'اضغط للاستماع' : 'أي كلمة سمعت؟'}
        </p>

        {phase !== 'idle' && (
          <button
            onClick={() => play(0.6)}
            className="mt-2 text-xs text-slate-500 underline hover:text-slate-700"
          >
            أبطأ
          </button>
        )}
      </div>

      {/* الخياران */}
      <div className="grid grid-cols-2 gap-4" dir="ltr">
        {(['a', 'b'] as const).map((side) => {
          const word = side === 'a' ? current.pair.word_a : current.pair.word_b;
          const isPicked = picked === side;
          const isRight = current.spoken === side;
          const revealed = phase === 'answered';

          let style = 'border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50';
          if (revealed && isRight) style = 'border-emerald-500 bg-emerald-50';
          else if (revealed && isPicked) style = 'border-rose-400 bg-rose-50';
          else if (revealed) style = 'border-slate-200 bg-white opacity-50';

          return (
            <button
              key={side}
              onClick={() => pick(side)}
              disabled={phase === 'idle' || revealed}
              className={`rounded-xl border-2 px-4 py-6 text-xl font-semibold
                          transition disabled:cursor-not-allowed ${style}`}
            >
              {word}
              {revealed && isRight && <span className="mr-2 text-emerald-600">✓</span>}
            </button>
          );
        })}
      </div>

      {/* بعد الإجابة */}
      {phase === 'answered' && (
        <div className="mt-6 text-center">
          <p
            className={`mb-4 font-medium ${
              picked === current.spoken ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {picked === current.spoken
              ? 'صحيح'
              : `كانت «${current.spoken === 'a' ? current.pair.word_a : current.pair.word_b}»`}
          </p>

          {/* سماع الكلمتين متتاليتين — أهم لحظة تعليمية في اللعبة */}
          <div className="mb-4 flex justify-center gap-2" dir="ltr">
            <button
              onClick={() => {
                speak(current.pair.word_a, { rate: 0.65 });
                setTimeout(() => speak(current.pair.word_b, { rate: 0.65 }), 1100);
              }}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm hover:bg-slate-200"
            >
              🔊 اسمع الاثنتين متتاليتين
            </button>
          </div>

          <button
            onClick={next}
            className="rounded-lg bg-slate-900 px-8 py-2.5 font-medium text-white
                       hover:bg-slate-800"
          >
            {index + 1 >= total ? 'النتيجة' : 'التالي'}
          </button>
        </div>
      )}
    </div>
  );
}
