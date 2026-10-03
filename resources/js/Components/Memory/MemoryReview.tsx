import { PartyPopper, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs';
import Listen from '@/Components/Listen';
import { useT } from '@/lib/i18n';
import type { MemoryCounts, MemoryWord } from './types';

/**
 * مراجعة الذاكرة.
 *
 * ── لماذا في ملفّ منفصل ─────────────────────────────────────
 * لأنه يستورد ts-fsrs، ولا يحتاجها من فتح الذاكرة ليضيف كلمة. فهو
 * الحزمة الثالثة: لا تُنزَّل إلا حين يضغط «راجع».
 *
 * ── والتقييم زرّان ──────────────────────────────────────────
 * نفس زرّي بطاقات المفردات: «عرفتها» و«لم أعرفها». حركةٌ واحدة
 * يتعلّمها المتدرّب مرة وتصلح في كل مكان.
 *
 * ── والحساب في المتصفّح ────────────────────────────────────
 * كما تنصّ §4: ts-fsrs تحسب الموعد التالي، والخادم يخزّن النتيجة
 * ولا يعيد حسابها.
 */

const STATE_TO_FSRS: Record<MemoryWord['state'], State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

const FSRS_TO_STATE: Record<number, MemoryWord['state']> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const GRADES: { rating: Grade; label: string; tone: string }[] = [
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

function toFsrsCard(w: MemoryWord): FsrsCard {
  const card = createEmptyCard(w.due_at ? new Date(w.due_at) : new Date());

  return {
    ...card,
    due: w.due_at ? new Date(w.due_at) : new Date(),
    stability: w.stability,
    difficulty: w.difficulty,
    reps: w.reps,
    lapses: w.lapses,
    state: STATE_TO_FSRS[w.state],
    last_review: w.last_reviewed_at ? new Date(w.last_reviewed_at) : undefined,
  };
}

export default function MemoryReview({
  onDone,
  onCounts,
}: {
  onDone: () => void;
  onCounts: (c: MemoryCounts) => void;
}) {
  const tr = useT();
  const scheduler = useMemo(
    () => fsrs(generatorParameters({ enable_fuzz: true })),
    [],
  );

  const [words, setWords] = useState<MemoryWord[] | null>(null);
  const [at, setAt] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [again, setAgain] = useState(0);

  useEffect(() => {
    let alive = true;

    axios
      .get('/memory', { params: { mode: 'due' } })
      .then(({ data }) => {
        if (!alive) return;
        setWords(data.words);
        onCounts(data.counts);
      })
      .catch(() => alive && setWords([]));

    return () => {
      alive = false;
    };
  }, [onCounts]);

  const current = words?.[at];

  const grade = useCallback(
    (rating: Grade) => {
      if (!current) return;

      const { card: next } = scheduler.next(toFsrsCard(current), new Date(), rating);

      if (rating === Rating.Again) setAgain((n) => n + 1);

      // الحفظ لا يُنتظَر: البطاقة التالية تظهر فوراً والخادم يلحق
      axios
        .post(`/memory/${current.id}/grade`, {
          due_at: next.due.toISOString(),
          stability: next.stability,
          difficulty: next.difficulty,
          reps: next.reps,
          lapses: next.lapses,
          state: FSRS_TO_STATE[next.state],
        })
        .then(({ data }) => data.counts && onCounts(data.counts));

      setRevealed(false);
      setAt((i) => i + 1);
    },
    [current, scheduler, onCounts],
  );

  if (words === null) {
    return <p className="py-8 text-center text-sm text-slate-400">{tr('جارٍ التحميل…')}</p>;
  }

  /* انتهت الجلسة */
  if (!current) {
    const total = words.length;

    return (
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
        <PartyPopper aria-hidden size={32} strokeWidth={1.5} className="mx-auto text-violet-600" />
        <p className="mt-2 font-bold text-slate-900">
          {total === 0 ? tr('لا كلمة مستحقّة الآن') : tr('انتهت الجلسة')}
        </p>

        {total > 0 && (
          <p className="mt-1 text-sm text-slate-500">
            {tr('راجعت :n كلمة · :again تحتاج إعادة', { n: total, again })}
          </p>
        )}

        <button
          onClick={onDone}
          className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium
                     text-white transition hover:bg-slate-800"
        >
          {tr('تمّ')}
        </button>
      </div>
    );
  }

  const progress = (at / words.length) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{tr('كلمة :n من :total', { n: at + 1, total: words.length })}</span>
        <button onClick={onDone} className="hover:text-slate-800">
          {tr('إنهاء')} <X aria-hidden size={15} className="inline-block align-[-3px]" />
        </button>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
        {/* الوجه: المعنى العربي إن وُجد، وإلا الكلمة نفسها */}
        {current.translation ? (
          <p className="text-2xl font-bold text-slate-900">{current.translation}</p>
        ) : (
          <p className="text-2xl font-bold text-violet-700" dir="ltr">
            {current.term}
          </p>
        )}

        {!revealed ? (
          <>
            <p className="mt-2 text-sm text-slate-500">
              {current.translation ? tr('ما هي بالإنجليزية؟') : tr('ما معناها؟')}
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
                  {current.term}
                </p>
                <Listen text={current.term} size="sm" />
              </div>

              {current.translation && (
                <p className="mt-1 text-sm text-slate-600">{current.translation}</p>
              )}
            </div>

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
          </div>
        )}
      </div>
    </div>
  );
}
