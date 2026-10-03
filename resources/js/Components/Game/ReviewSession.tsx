import { Check, Sprout } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  // Grade = التقييمات الأربعة الصالحة فقط (Rating يشمل Manual غير المستخدم)
  type Grade,
} from 'ts-fsrs';
import Listen from '@/Components/Listen';
import { useSpeech } from '@/hooks/useSpeech';
import { useT } from '@/lib/i18n';

/**
 * مراجعة المفردات بالتكرار المتباعد — داخل المنصة.
 *
 * كانت خطة اليوم تحيل إلى Anki، أي مغادرة المنصة وتحميل ملفات
 * وإعدادها — وهو ما لن يفعله مبتدئ. كل شيء هنا الآن.
 *
 * توزيع العمل حسب `AGENTS.md`: الحساب في المتصفح بـ ts-fsrs،
 * والخادم يحفظ النتيجة فقط.
 *
 * الاتجاه عربي ← إنجليزي، وهو ما ينصّ عليه الكتاب:
 * الاتجاه المنتج لا المستقبِل. أن تتعرّف على الكلمة أسهل بكثير
 * من أن تنتجها، والهدف الإنتاج.
 */

interface ServerCard {
  id: number;
  word: string;
  ipa: string | null;
  arabic: string;
  example: string | null;
  group: string;
  state: 'new' | 'learning' | 'review' | 'relearning';
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  due_at: string | null;
  last_reviewed_at: string | null;
}

interface Counts {
  due: number;
  new: number;
  total: number;
}

interface Props {
  /** يُبلّغ الموضع إلى الأعلى ويُخفي الشريط الداخلي */
  onProgress?: (done: number, total: number) => void;
  weekNumber: number;
  /** اليوم الحالي — الخادم يزرع بطاقات ما قُدّم حتى هذا اليوم فقط */
  dayNumber?: number;
  /** يُنادى عند إنهاء الجلسة — لتأشير المهمة تلقائياً */
  onFinished?: () => void;
}

/* ترجمة حالة الخادم إلى ما تفهمه ts-fsrs والعكس */
const STATE_TO_FSRS: Record<ServerCard['state'], State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

const FSRS_TO_STATE: Record<number, ServerCard['state']> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

/**
 * زرّا التقييم.
 *
 * ── لماذا اثنان لا أربعة ────────────────────────────────────
 * كانت أربعة بمعايير مكتوبة («بعد تفكير طويل» و«بعد لحظة»)، وهي
 * تسأل المتعلّم أن يقيس زمن تذكّره ويصنّفه — قرارٌ لا يعرف أحد
 * جوابه بيقين، فيتوقّف عنده في كل بطاقة. وسؤالٌ يُطرح مئة مرة في
 * الجلسة يجب أن يُجاب بلا تفكير.
 *
 * والاثنان هما ما تعرضه بطاقات المفردات في بقية المنصة، فيتعلّم
 * المتدرّب حركة واحدة تصلح في كل مكان.
 *
 * ── وماذا يخسر FSRS ────────────────────────────────────────
 * لا شيء يُعتدّ به: Again وGood وحدهما يكفيان الخوارزمية لتضبط
 * الفواصل — وHard/Easy تحسينٌ يفترض تقديراً دقيقاً لن يعطيه
 * مبتدئ أصلاً، فيصير ضجيجاً لا إشارة.
 */
const GRADES: {
  rating: Grade;
  label: string;
  tone: string;
}[] = [
  {
    rating: Rating.Again,
    label: 'لم أعرفها',
    tone: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
  },
  {
    rating: Rating.Good,
    label: 'عرفتها',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  },
];

export default function ReviewSession({ weekNumber, dayNumber, onFinished, onProgress}: Props) {
  const tr = useT();
  const [cards, setCards] = useState<ServerCard[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState(0);
  const [again, setAgain] = useState(0);

  const { speak, supported } = useSpeech();

  // مُجدول FSRS واحد للجلسة — الضبط الافتراضي مناسب تماماً
  const scheduler = useMemo(() => fsrs(generatorParameters({ enable_fuzz: true })), []);

  useEffect(() => {
    let alive = true;

    axios
      .get(`/week/${weekNumber}/review/due`, {
        params: dayNumber ? { day: dayNumber } : {},
      })
      .then(({ data }) => {
        if (!alive) return;
        setCards(data.cards);
        setCounts(data.counts);
      })
      .catch(() => alive && setError(tr('تعذّر جلب البطاقات. تحقّق من الاتصال.')))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [weekNumber, dayNumber]);

  const current = cards[index] ?? null;

  /** بناء بطاقة ts-fsrs من حالة الخادم */
  const toFsrsCard = useCallback((c: ServerCard): FsrsCard => {
    const empty = createEmptyCard(new Date());

    if (c.state === 'new') return empty;

    return {
      ...empty,
      due: c.due_at ? new Date(c.due_at) : new Date(),
      stability: c.stability,
      difficulty: c.difficulty,
      reps: c.reps,
      lapses: c.lapses,
      state: STATE_TO_FSRS[c.state],
      last_review: c.last_reviewed_at ? new Date(c.last_reviewed_at) : undefined,
    };
  }, []);

  const grade = async (rating: Grade) => {
    if (!current) return;

    // الحساب في المتصفح — الخادم يحفظ فقط
    const { card: next } = scheduler.next(toFsrsCard(current), new Date(), rating);

    setGraded((n) => n + 1);
    if (rating === Rating.Again) setAgain((n) => n + 1);

    // ننتقل فوراً ولا ننتظر الشبكة — المراجعة يجب أن تكون سريعة
    setRevealed(false);
    setIndex((i) => i + 1);

    try {
      await axios.post(`/review/${current.id}/grade`, {
        due_at: next.due.toISOString(),
        stability: next.stability,
        difficulty: next.difficulty,
        reps: next.reps,
        lapses: next.lapses,
        state: FSRS_TO_STATE[next.state],
      });
    } catch {
      // فشل الحفظ لا يوقف الجلسة — البطاقة تعود مستحقة لاحقاً
    }
  };

  /* ---------- الحالات ---------- */

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-slate-500">
        {tr('يجهّز بطاقات المراجعة…')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-rose-50 p-5 text-center text-sm text-rose-700 ring-1 ring-rose-200">
        {error}
      </div>
    );
  }

  if (cards.length === 0) {
    // فرق جوهري: من لم يتعلّم كلمة بعد ليس كمن راجع كل المستحق.
    // الرسالة نفسها للحالتين تُوهم بخلل حيث لا خلل.
    const nothingLearnedYet = (counts?.total ?? 0) === 0;

    return (
      <div className="rounded-xl bg-slate-50 p-6 text-center ring-1 ring-slate-200">
        <p className="text-2xl" aria-hidden>
          {nothingLearnedYet ? <Sprout size={36} strokeWidth={1.5} className="mx-auto" /> : <Check size={36} strokeWidth={1.5} className="mx-auto" />}
        </p>

        {nothingLearnedYet ? (
          <>
            <p className="mt-2 font-semibold text-slate-800">
              {tr('لا مفردات للمراجعة بعد')}
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-600">
              {tr('المراجعة تلي التعلّم. أول مجموعة مفردات تأتي في اليوم الثاني، وبعدها تجد هنا بطاقات كل صباح. أشّر هذه المهمة وانتقل.')}
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 font-semibold text-emerald-900">
              {tr('لا بطاقات مستحقة الآن')}
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-600">
              راجعت كل ما هو مستحق من {counts?.total} بطاقة. لا تراجع أكثر —
              التكرار المتباعد يعمل بأن تراجع قبل أن تنسى بقليل، لا كل يوم.
            </p>
          </>
        )}
      </div>
    );
  }

  /* ---------- انتهت الجلسة ---------- */
  if (!current) {
    return (
      <div className="rounded-xl bg-emerald-50 p-6 text-center ring-1 ring-emerald-200">
        <p className="text-2xl" aria-hidden>
          <Check aria-hidden size={16} />
        </p>
        <p className="mt-2 font-bold text-emerald-900">
          أنهيت {graded} بطاقة
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-emerald-800">
          {again === 0
            ? tr('بلا نسيان واحد. مواعيد المراجعة تباعدت.')
            : `${again} منها ستعود قريباً — وهذا مقصود، لا فشل.`}
        </p>

        {onFinished && (
          <button
            onClick={onFinished}
            className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium
                       text-white transition hover:bg-emerald-700"
          >
            {tr('أشّر المهمة كمنجزة')}
          </button>
        )}
      </div>
    );
  }

  const progress = (index / cards.length) * 100;

  return (
    <div className="space-y-4">
      {/* شريط الجلسة */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {index + 1} من {cards.length}
        </span>
        {counts && (
          <span>
            مستحقة {counts.due} · جديدة {counts.new}
          </span>
        )}
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* البطاقة — العربية أولاً، والإنجليزية هي المطلوب إنتاجه */}
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
        {current.state === 'new' && (
          <span className="mb-3 inline-block rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
            {tr('كلمة جديدة')}
          </span>
        )}

        <p className="text-2xl font-bold text-slate-900">{current.arabic}</p>

        {!revealed ? (
          <>
            <p className="mt-2 text-sm text-slate-500">{tr('ما هي بالإنجليزية؟')}</p>
            {/* قُلها قبل الكشف — من يكشف أولاً يتعرّف ولا ينتج */}
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-400">
              {tr('قلها في نفسك أولاً ثم اكشف')}
            </p>
            <button
              onClick={() => setRevealed(true)}
              className="mt-6 w-full rounded-xl bg-slate-900 py-3 font-semibold text-white
                         transition hover:bg-slate-800"
            >
              {tr('اكشف الإجابة')}
            </button>
          </>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-center gap-2">
                <p className="text-xl font-bold text-violet-700" dir="ltr">
                  {current.word}
                </p>
                <Listen text={current.word} size="sm" />
              </div>

              {current.ipa && (
                <p className="mt-1 font-mono text-xs text-slate-500" dir="ltr">
                  {current.ipa}
                </p>
              )}

              {current.example && (
                <p className="mt-3 text-sm leading-relaxed text-slate-600" dir="ltr">
                  {current.example}
                </p>
              )}
            </div>

            {/* زرّان لا أكثر — نفس حركة بطاقات المفردات */}
            <div className="grid grid-cols-2 gap-3">
              {GRADES.map((g) => (
                <button
                  key={g.rating}
                  onClick={() => grade(g.rating)}
                  className={`rounded-lg border-2 py-3 font-medium transition
                              active:scale-[.99] ${g.tone}`}
                >
                  {tr(g.label)}
                </button>
              ))}
            </div>

            <p className="text-xs leading-relaxed text-slate-400">
              {tr('«لم أعرفها» ليست فشلاً — هي ما يجعل الكلمة تعود إليك في الوقت المناسب.')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
