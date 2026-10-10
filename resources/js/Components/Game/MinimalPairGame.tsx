import { Check, Volume1, Volume2 } from 'lucide-react';
import { useEffect, useCallback, useMemo, useState } from 'react';
import Listen from '@/Components/Listen';
import { useMySpeech } from '@/hooks/useSpeech';
import { useT } from '@/lib/i18n';
import SayIt, { type SayItem } from '@/Components/Game/SayIt';
import MouthDiagram from '@/Components/Game/MouthDiagram';
import { soundsIn } from '@/lib/articulation';

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

/**
 * One sound contrast, named in the learner's language.
 *
 * The English heading is the book's; it stays as a secondary
 * label. `label_ar` is what the learner reads, and `hint_ar` is
 * what tells them which two sounds they are separating and how.
 */
export interface Group {
  label_ar: string | null;
  label_en: string;
  ipa: string | null;
  hint_ar: string | null;
  pairs: Pair[];
}

interface Props {
  /** يُبلّغ الموضع إلى الأعلى ويُخفي الشريط الداخلي */
  onProgress?: (done: number, total: number) => void;
  /** خطّة اليوم تقول «إنتاج» — فيُفتح فحص النطق مباشرةً */
  production?: boolean;
  /** المجموعات بترتيب تدريبها — لا تُخلط، كما في §8.2 */
  groups: Group[];
  /** الهدف المطلوب — من الكتاب: 11 من 12. Omitted, it scales to 11/12 of the questions */
  target?: number;
  onFinish?: (score: number, total: number) => void;
}

type Phase = 'idle' | 'playing' | 'answered' | 'done' | 'say';

interface Question {
  pair: Pair;
  /** أي الكلمتين نُطقت فعلاً */
  spoken: 'a' | 'b';
  /** المجموعة كاملة — منها اسمها العربي وسطر تدريبها */
  contrast: Group;
  group: string;
}

export default function MinimalPairGame({ groups, target: targetProp, onFinish, onProgress, production = false }: Props) {
  const tr = useT();
  const { say, speaking, supported } = useMySpeech();

  /*
   * The questions: every group asked as about twelve, in group order.
   *
   * A day now drills one contrast, and a contrast can have three
   * pairs — three questions is a guess, not a test. So each pair is
   * asked more than once until the group reaches about twelve (the
   * book's "11 of 12"), with the word spoken chosen afresh each time
   * and the order shuffled inside the group. Groups are never
   * shuffled into each other (§2.4).
   */
  const questions = useMemo<Question[]>(() => {
    const list: Question[] = [];
    groups.forEach((contrast) => {
      const n = contrast.pairs.length;
      const times = n === 0 ? 0 : Math.min(4, Math.max(1, Math.round(12 / n)));
      const own: Question[] = [];

      for (let t = 0; t < times; t++) {
        contrast.pairs.forEach((pair) => {
          own.push({
            pair,
            // اختيار عشوائي أي كلمة تُنطق
            spoken: Math.random() < 0.5 ? 'a' : 'b',
            contrast,
            group: contrast.label_ar ?? contrast.label_en,
          });
        });
      }

      for (let i = own.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [own[i], own[j]] = [own[j], own[i]];
      }

      list.push(...own);
    });
    return list;
  }, [groups]);

  const [index, setIndex] = useState(0);
  // The day's plan can send the learner straight to production
  const [phase, setPhase] = useState<Phase>(production ? 'say' : 'idle');
  const [picked, setPicked] = useState<'a' | 'b' | null>(null);
  const [correct, setCorrect] = useState(0);
  /** الأخطاء — تُعرض في النهاية ليعرف أي أزواج يحتاج تدريباً */
  const [missed, setMissed] = useState<Question[]>([]);

  const current = questions[index];
  const total = questions.length;
  const target = targetProp ?? Math.ceil((total * 11) / 12);

  /**
   * Report the position upward, so the page shows it in its single
   * bar instead of a second one.
   *
   * Declared here, above every early return: a hook placed after one
   * runs on some renders and not others, and React counts hooks —
   * `supported` flipping to false would then throw and blank the
   * screen rather than hide one feature.
   */
  useEffect(() => {
    onProgress?.(index, total);
  }, [index, total, onProgress]);

  /** نطق الكلمة المطلوبة */
  const play = useCallback(
    (rate?: number) => {
      if (!current) return;
      const word = current.spoken === 'a' ? current.pair.word_a : current.pair.word_b;
      say(word, { rate });
      if (phase === 'idle') setPhase('playing');
    },
    [current, say, phase],
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
          {tr('متصفحك لا يدعم النطق الآلي')}
        </p>
        <p className="mt-2 text-sm text-amber-800">
          {tr('استخدم Chrome أو Edge أو Safari. أو اضغط روابط كامبريدج في جدول الأزواج للاستماع يدوياً.')}
        </p>
      </div>
    );
  }

  /* ---------- فحص النطق ---------- */
  if (phase === 'say') {
    /*
     * What to practise saying, and in what order.
     *
     * The pairs they just failed to hear come first: those are the
     * contrasts their mouth is most likely to be merging too. Each
     * pair gives two items, because saying `ship` correctly proves
     * nothing about `sheep`. Capped, because a production drill of
     * twenty-four words is abandoned at the sixth.
     */
    const missedPairs = missed.map((m) => m.pair);
    const rest = questions.map((q) => q.pair).filter((p) => !missedPairs.includes(p));

    const items: SayItem[] = [];
    for (const pair of [...missedPairs, ...rest]) {
      items.push({ say: pair.word_a, against: pair.word_b, ipa: pair.ipa });
      items.push({ say: pair.word_b, against: pair.word_a, ipa: pair.ipa });
      if (items.length >= 8) break;
    }

    return (
      <div className="space-y-3">
        <SayIt items={items} />

        <button
          onClick={() => setPhase('done')}
          className="w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700
                     transition hover:bg-slate-200"
        >
          {tr('رجوع إلى النتيجة')}
        </button>
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
          {passed ? tr('أذنك تميّز الفرق') : tr('تحتاج تدريباً أكثر')}
        </h3>

        <p className="mt-2 text-sm text-slate-600">
          {passed
            ? `الهدف كان ${target} من ${total} — وقد تجاوزته.`
            : `الهدف ${target} من ${total}. لا تنتقل للإنتاج قبل أن تصل إليه — الاستماع أولاً دائماً.`}
        </p>

        {missed.length > 0 && (
          <div className="mt-6 text-start">
            <p className="mb-3 text-sm font-semibold text-slate-700">
              {tr('الأزواج التي أخطأت فيها — درّبها عشر دقائق يومياً:')}
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
                      <Listen key={w} text={w} label={w} size="sm" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {passed && (
          <button
            onClick={() => setPhase('say')}
            className="mt-6 w-full rounded-xl bg-violet-600 py-3 font-semibold text-white
                       transition hover:bg-violet-700"
          >
            {tr('الآن قُلها أنت — ولنرَ ما يسمعه المتصفّح')}
          </button>
        )}

        <button
          onClick={restart}
          className="mt-3 rounded-lg bg-slate-900 px-6 py-2.5 font-medium text-white
                     hover:bg-slate-800"
        >
          {tr('أعد المحاولة')}
        </button>
      </div>
    );
  }

  /* ---------- شاشة اللعب ---------- */
  /**
   * First question of its group.
   *
   * There the coaching line opens by itself; after it the line stays
   * folded — the learner reads the difference once and then drills it.
   */
  const firstOfGroup =
    index === 0 || questions[index - 1]?.contrast !== current?.contrast;

  // The two sounds being separated, read from "/ɪ/ vs /iː/" or the group title
  const mouths = soundsIn(current.contrast.ipa ?? current.contrast.label_en);

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      {/* الرأس: التقدّم والمجموعة */}
      <div className="mb-6 flex items-center justify-between">
        <div className="min-w-0">
          {/* اسم التمييز بالعربية أولاً — الإنجليزيّ عنوان الكتاب
              لا تعليمة، ومبتدئ اليوم الأول لا يقرؤه */}
          <p className="truncate font-semibold text-slate-900">
            {current.contrast.label_ar ?? current.contrast.label_en}
          </p>
          <p className="mt-0.5 font-mono text-xs text-violet-700" dir="ltr">
            {current.pair.ipa}
            {current.contrast.label_ar && (
              <span className="ms-2 font-sans text-slate-400">
                {current.contrast.label_en}
              </span>
            )}
          </p>
        </div>
        <div className="text-sm text-slate-500">
          {index + 1} / {total}
          <span className="me-3 font-semibold text-emerald-600"><Check aria-hidden size={15} className="inline-block align-[-3px]" /> {correct}</span>
        </div>
      </div>

      {/*
        سطر التدريب — قبل الاستماع لا بعده.

        الاسم يقول أيّ تمييزٍ هذا، وهذا السطر يقول ما الفرق وكيف
        تصنعه: أيّ صوتٍ عربيٍّ يقابله، والحركة الواحدة التي تُغيَّر.
        وبدونه يسمع المبتدئ صوتين متشابهين ويحزر.

        ويظهر عند أول سؤال في المجموعة، ويبقى مطويّاً بعده — فالقراءة
        مرّةٌ والتدريب اثنتا عشرة.
      */}
      {(current.contrast.hint_ar || mouths.length > 0) && (
        <details
          open={firstOfGroup}
          className="mb-5 rounded-xl bg-violet-50/70 ring-1 ring-violet-100"
        >
          <summary
            className="cursor-pointer list-none px-4 py-2.5 text-xs font-bold text-violet-900
                       marker:content-none"
          >
            {tr('ما الفرق بين الصوتين؟')}
          </summary>
          {current.contrast.hint_ar && (
            <p className="px-4 pb-3.5 text-xs leading-relaxed text-slate-700">
              {current.contrast.hint_ar}
            </p>
          )}
          {/* Drawn, not spoken: hearing the two words here would answer the question */}
          {mouths.length > 0 && (
            <div className="px-3 pb-3">
              <MouthDiagram sounds={mouths} />
            </div>
          )}
        </details>
      )}

      {/* الشريط الداخلي يُخفى حين يحمله شريط الصفحة */}
      {!onProgress && (
        <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-300"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
      )}

      {/* زر التشغيل */}
      <div className="mb-8 text-center">
        <button
          onClick={() => play(0.8)}
          disabled={speaking}
          className="mx-auto flex h-24 w-24 items-center justify-center rounded-full
                     bg-violet-600 text-white shadow-lg transition
                     hover:bg-violet-700 disabled:opacity-60"
          aria-label={tr("استمع")}
        >
          {speaking ? <Volume1 size={40} strokeWidth={1.5} /> : <Volume2 size={40} strokeWidth={1.5} />}
        </button>

        <p className="mt-3 text-sm text-slate-600">
          {phase === 'idle' ? tr('اضغط للاستماع') : tr('أي كلمة سمعت؟')}
        </p>

        {phase !== 'idle' && (
          <button
            onClick={() => play(0.6)}
            className="mt-2 text-xs text-slate-500 underline hover:text-slate-700"
          >
            {tr('أبطأ')}
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

          let style = 'border-slate-200 bg-white hover:border-violet-400 hover:bg-violet-50';
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
              {revealed && isRight && <span className="me-2 text-emerald-600"><Check aria-hidden size={16} /></span>}
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
              ? tr('صحيح')
              : `كانت «${current.spoken === 'a' ? current.pair.word_a : current.pair.word_b}»`}
          </p>

          {/* سماع الكلمتين متتاليتين — أهم لحظة تعليمية في اللعبة */}
          <div className="mb-4 flex justify-center gap-2" dir="ltr">
            <button
              onClick={() => {
                // ببطء ثم بفاصل: الأذن تحتاج صمتاً بين الصوتين لتقارن
                say(current.pair.word_a, { slow: true });
                setTimeout(() => say(current.pair.word_b, { slow: true }), 1100);
              }}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm hover:bg-slate-200"
            >
              <Volume2 aria-hidden size={15} className="inline-block align-[-3px]" /> {tr('اسمع الاثنتين متتاليتين')}
            </button>
          </div>

          <button
            onClick={next}
            className="rounded-lg bg-slate-900 px-8 py-2.5 font-medium text-white
                       hover:bg-slate-800"
          >
            {index + 1 >= total ? tr('النتيجة') : tr('التالي')}
          </button>
        </div>
      )}
    </div>
  );
}
