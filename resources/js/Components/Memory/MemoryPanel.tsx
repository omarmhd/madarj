import { X } from 'lucide-react';
import { Suspense, lazy, memo, useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Listen from '@/Components/Listen';
import { useT } from '@/lib/i18n';
import type { MemoryCounts, MemoryWord } from './types';

/**
 * الذاكرة — ما يُعرض داخل اللوحة الجانبية.
 *
 * ── ما هو ──────────────────────────────────────────────────
 * الكتاب يعطي ألفي كلمة، والحياة تعطي غيرها: كلمة في اجتماع،
 * وأخرى في مسلسل، وثالثة في لافتة. وهذه هي التي تُنسى — لأن لا
 * مكان لها. فهذا مكانها.
 *
 * ── وما لا يفعله ──────────────────────────────────────────
 * لا يقفل يوماً، ولا يكسر سلسلة، ولا يدخل في نسبة التقدّم. من
 * تركه لم يخسر شيئاً، ومن استعمله ربح.
 *
 * ── ولماذا يُحمَّل هنا لا في الصفحة ────────────────────────
 * هذا الملفّ حزمةٌ مستقلّة لا تُنزَّل إلا عند فتح اللوحة، والطلب
 * يقع عند التركيب لا قبله. فمن لم يفتح الذاكرة لم يدفع ثمنه.
 */

const MemoryReview = lazy(() => import('./MemoryReview'));

/** عدسة — SVG خالص: أيقونةٌ واحدة لا تستحقّ مكتبة */
function Glass() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12.8 12.8 17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * إبراز موضع المطابقة.
 *
 * القائمة تُرجع خمسين صفّاً، والعين لا تعرف **لماذا** ظهر كلٌّ منها.
 * فتلوين الحروف المطابقة يجيب عن ذلك بلا سطر شرح — ويُظهر أن
 * المطابقة قد تكون في المعنى لا في الكلمة.
 *
 * أول موضع يكفي: البحث في كلمة واحدة لا في نصّ، وطلب كل المواضع
 * يعني تكراراً في كل صفّ بلا فائدة.
 */
function Mark({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>;

  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded bg-violet-100 px-0.5 text-violet-900">
        {text.slice(at, at + needle.length)}
      </mark>
      {text.slice(at + needle.length)}
    </>
  );
}

/** شارة مصدر المعنى — ترجمةٌ آلية يجب أن يُعرَف أنها آلية */
const SOURCE: Record<MemoryWord['source'], { label: string; tone: string } | null> = {
  course: { label: 'من الكتاب', tone: 'bg-emerald-50 text-emerald-700' },
  auto: { label: 'ترجمة آلية', tone: 'bg-amber-50 text-amber-700' },
  manual: null,
};

/**
 * صفّ كلمة.
 *
 * مُغلَّف بـ`memo` لأن كل إضافة تُعيد رسم القائمة، وصفوفها لا
 * تتغيّر — والذاكرة قد يبلغ مئتي صفّ.
 */
const Row = memo(function Row({
  word,
  needle,
  onDelete,
}: {
  word: MemoryWord;
  /** ما يُبحث عنه — لإبرازه في موضعه */
  needle: string;
  onDelete: (id: number) => void;
}) {
  const tr = useT();

  // المعنى قابل للتصحيح في مكانه: ترجمة الآلة تخطئ، ومن رآها
  // خاطئة يجب أن يصلحها حيث يراها لا في شاشة أخرى
  const [editing, setEditing] = useState(false);
  const [meaning, setMeaning] = useState(word.translation ?? '');
  const [source, setSource] = useState(word.source);

  const badge = SOURCE[source];

  const save = () => {
    const text = meaning.trim();
    setEditing(false);

    if (!text || text === (word.translation ?? '')) {
      setMeaning(word.translation ?? '');
      return;
    }

    setSource('manual');
    axios.patch(`/memory/${word.id}`, { translation: text });
  };

  return (
    <div className="folio-rule group flex items-center gap-3 border-b px-3 py-2.5">
      <Listen text={word.term} size="sm" />

      <span className="min-w-0 flex-1">
        <span className="block truncate font-entry text-xl leading-tight text-slate-900" dir="ltr">
          <Mark text={word.term} needle={needle} />
        </span>

        <span className="mt-0.5 flex items-center gap-1.5">
          {editing ? (
            <input
              autoFocus
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') {
                  setMeaning(word.translation ?? '');
                  setEditing(false);
                }
              }}
              maxLength={191}
              aria-label={tr('المعنى (اختياري)')}
              className="w-full rounded-md border-slate-200 px-2 py-0.5 text-xs
                         focus:border-violet-400 focus:ring-violet-400"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="truncate text-start text-xs text-slate-600
                         underline-offset-2 hover:underline"
            >
              {meaning ? (
                <Mark text={meaning} needle={needle} />
              ) : (
                tr('بلا معنى — اضغط لتكتبه')
              )}
            </button>
          )}

          {!editing && badge && (
            <span className={`shrink-0 rounded px-1.5 py-px text-xs ${badge.tone}`}>
              {tr(badge.label)}
            </span>
          )}
        </span>
      </span>

      <button
        onClick={() => onDelete(word.id)}
        aria-label={tr('احذف')}
        className="shrink-0 rounded-lg px-2 py-1 text-slate-300 transition
                   hover:bg-slate-100 hover:text-rose-600 focus:text-rose-600"
      >
        <X aria-hidden size={16} />
      </button>
    </div>
  );
});

export default function MemoryPanel({
  onCounts,
}: {
  onCounts: (c: MemoryCounts) => void;
}) {
  const tr = useT();

  const [words, setWords] = useState<MemoryWord[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [counts, setCounts] = useState<MemoryCounts>({ total: 0, due: 0, fresh: 0 });
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [meaning, setMeaning] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const [searching, setSearching] = useState(false);

  const input = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  /** الرقم يصعد إلى الزرّ كي يبقى صادقاً بعد الإغلاق */
  const apply = useCallback(
    (c: MemoryCounts | null) => {
      if (!c) return;
      setCounts(c);
      onCounts(c);
    },
    [onCounts],
  );

  /**
   * الجلب الأول وكل بحث.
   *
   * البحث لا يُرسَل مع كل حرف: ربع ثانية من السكون أولاً. والكتابة
   * السريعة تُلغي ما قبلها، فست حروف تُرسِل طلباً واحداً لا ستّة.
   */
  useEffect(() => {
    let alive = true;
    const q = query.trim();

    if (q) setSearching(true);

    const id = window.setTimeout(
      () => {
        axios
          .get('/memory', { params: q ? { q } : {} })
          .then(({ data }) => {
            if (!alive) return;
            setWords(data.words);
            setNext(data.next);
            apply(data.counts);
          })
          .catch(() => alive && setWords([]))
          .finally(() => alive && setSearching(false));
      },
      q ? 250 : 0,
    );

    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [query, apply]);

  /** الدفعة التالية — تُطلب مرة واحدة ولو تكرّر النداء */
  const loadMore = useCallback(() => {
    if (next === null || loadingMore) return;

    setLoadingMore(true);
    const q = query.trim();

    axios
      .get('/memory', { params: { before: next, ...(q ? { q } : {}) } })
      .then(({ data }) => {
        setWords((list) => [...(list ?? []), ...data.words]);
        setNext(data.next);
      })
      .finally(() => setLoadingMore(false));
  }, [next, loadingMore, query]);

  /**
   * الجلب عند بلوغ آخر القائمة.
   *
   * `IntersectionObserver` على حارسٍ في ذيل اللائحة: لا مستمع تمرير
   * ولا حساب في كل إطار — المتصفّح يخبرنا حين يظهر الحارس فقط.
   */
  useEffect(() => {
    const el = sentinel.current;
    if (!el || next === null) return;

    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && loadMore(),
      { rootMargin: '200px' },
    );

    io.observe(el);

    return () => io.disconnect();
  }, [next, loadMore]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();

    const clean = term.trim();
    if (!clean || busy) return;

    setBusy(true);
    setError(null);

    try {
      const { data } = await axios.post('/memory', {
        term: clean,
        translation: meaning.trim() || null,
      });

      // الكلمة تظهر في رأس القائمة فوراً، ولا يُعاد جلب الذاكرة
      setWords((list) => [data.word, ...(list ?? []).filter((w) => w.id !== data.word.id)]);
      apply(data.counts);
      setTerm('');
      setMeaning('');
      input.current?.focus();
    } catch (err: any) {
      setError(
        err?.response?.data?.errors?.term?.[0] ?? tr('تعذّر الحفظ. حاول مرة أخرى.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = useCallback(
    (id: number) => {
      // الحذف متفائل: يختفي فوراً، والخادم يلحق
      setWords((list) => (list ?? []).filter((w) => w.id !== id));

      axios
        .delete(`/memory/${id}`)
        .then(({ data }) => apply(data.counts))
        .catch(() => axios.get('/memory').then(({ data }) => {
          setWords(data.words);
          apply(data.counts);
        }));
    },
    [apply],
  );

  const pending = counts.due + counts.fresh;

  if (reviewing) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <Suspense
          fallback={
            <p className="py-8 text-center text-sm text-slate-400">
              {tr('جارٍ التحميل…')}
            </p>
          }
        >
          <MemoryReview onDone={() => setReviewing(false)} onCounts={apply} />
        </Suspense>
      </div>
    );
  }

  return (
    <>
      {/* الإضافة — ثابتة في الأعلى، فهي أكثر ما يُفعل هنا */}
      <div className="border-b border-slate-200 bg-white px-4 pb-4">
        <form onSubmit={add} className="space-y-2">
          <input
            ref={input}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            dir="ltr"
            maxLength={64}
            placeholder={tr('كلمة إنجليزية…')}
            aria-label={tr('كلمة إنجليزية…')}
            className="w-full rounded-xl border-slate-200 text-sm placeholder:text-slate-400
                       focus:border-violet-400 focus:ring-violet-400"
          />

          <div className="flex gap-2">
            <input
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              maxLength={191}
              placeholder={tr('المعنى (اختياري)')}
              aria-label={tr('المعنى (اختياري)')}
              className="min-w-0 flex-1 rounded-xl border-slate-200 text-sm
                         placeholder:text-slate-400
                         focus:border-violet-400 focus:ring-violet-400"
            />

            <button
              type="submit"
              disabled={!term.trim() || busy}
              className="shrink-0 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white
                         transition hover:bg-slate-800
                         disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy ? tr('…') : tr('أضف')}
            </button>
          </div>
        </form>

        <p className="mt-2 text-xs text-slate-400">
          {tr('اتركه فارغاً ونبحث عن المعنى لك — من مفردات الكتاب أولاً.')}
        </p>

        {error && (
          <p className="mt-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">{error}</p>
        )}

        {pending > 0 && (
          <button
            onClick={() => setReviewing(true)}
            className="mt-3 w-full rounded-xl bg-violet-600 py-2.5 text-sm font-medium
                       text-white transition hover:bg-violet-700"
          >
            {tr('راجع :n كلمة', { n: pending })}
          </button>
        )}
      </div>

      {/* البحث — يظهر حين يصير الذاكرة أكبر من شاشة */}
      {/* البحث — يظهر حين تصير الذاكرة أكبر من شاشة */}
      {counts.total > 12 && (
        <div className="border-b border-slate-200 bg-white px-4 pb-3">
          {/*
            الحقل: رماديّ في السكون فلا يزاحم زرّ الإضافة، أبيضُ
            محفوفٌ بالنيليّ عند التركيز. والعدسة داخله لا فوقه —
            فيُقرأ أنه بحثٌ قبل قراءة نصّه.
          */}
          <div
            className="group relative flex items-center gap-2 rounded-xl bg-slate-100 px-3
                       ring-1 ring-transparent transition
                       focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-400"
          >
            <span
              className="shrink-0 text-slate-400 transition group-focus-within:text-violet-500"
              aria-hidden
            >
              <Glass />
            </span>

            <input
              ref={search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={64}
              placeholder={tr('ابحث في ذاكرتك…')}
              aria-label={tr('ابحث في ذاكرتك…')}
              className="min-w-0 flex-1 border-0 bg-transparent px-0 py-2.5 text-sm
                         text-slate-900 placeholder:text-slate-400
                         focus:ring-0"
            />

            {/* دوّارة صغيرة أثناء البحث: الحقل يقول إنه يعمل */}
            {searching && (
              <span
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full
                           border-2 border-violet-200 border-t-violet-500"
              />
            )}

            {query && !searching && (
              <button
                onClick={() => {
                  setQuery('');
                  search.current?.focus();
                }}
                aria-label={tr('امسح البحث')}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full
                           text-slate-400 transition
                           hover:bg-slate-200 hover:text-slate-700"
              >
                <X aria-hidden size={16} />
              </button>
            )}
          </div>

          {/* حصيلة البحث — سطرٌ واحد يظهر عند البحث وحده */}
          {query.trim() !== '' && words !== null && !searching && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              {words.length === 0 ? (
                <span className="text-slate-400">{tr('لا نتيجة')}</span>
              ) : (
                <>
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
                    {words.length}
                    {next ? '+' : ''}
                  </span>
                  {tr('من :total', { total: counts.total })}
                </>
              )}
            </p>
          )}
        </div>
      )}

      {/* الذاكرة */}
      <div className="flex-1 overflow-y-auto p-4">
        {words === null ? (
          <p className="py-8 text-center text-sm text-slate-400">{tr('جارٍ التحميل…')}</p>
        ) : words.length === 0 ? (
          <p className="rounded-xl bg-white p-5 text-center text-xs leading-relaxed text-slate-500 ring-1 ring-slate-200">
            {query.trim()
              ? tr('لا كلمة تطابق بحثك')
              : tr('لا شيء بعد. أضف أول كلمة سمعتها اليوم ولم تعرفها.')}
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-slate-400">
              {query.trim()
                ? tr(':n نتيجة', { n: words.length + (next ? '+' : '') })
                : tr(':total كلمة في ذاكرتك', { total: counts.total })}
            </p>

            {/* `memory-row` تمنح كل صفّ `content-visibility` فيتخطّى
                المتصفّح رسم ما هو خارج الشاشة — بلا مكتبة نوافذ */}
            <ul className="paper rounded">
              {words.map((w) => (
                <li key={w.id} className="memory-row">
                  <Row word={w} needle={query.trim()} onDelete={remove} />
                </li>
              ))}
            </ul>

            {/* الحارس: ظهوره يعني أن القارئ بلغ الذيل */}
            {next !== null && (
              <div ref={sentinel} className="py-4 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-lg bg-white px-4 py-2 text-xs text-slate-600
                             ring-1 ring-slate-200 transition hover:ring-slate-300
                             disabled:opacity-50"
                >
                  {loadingMore ? tr('جارٍ التحميل…') : tr('المزيد')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
