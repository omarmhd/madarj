import { BookOpen, Check, ChevronLeft, Clock } from 'lucide-react';
import AppFooter from '@/Components/AppFooter';
import { useSpeechPrefs, setSpeechPrefs } from '@/lib/speechPrefs';
import { Head, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import AppNav from '@/Components/AppNav';
import Bdi from '@/Components/Bdi';
import StoryReader from '@/Components/Game/StoryReader';
import SpeechControls from '@/Components/SpeechControls';
import { useLocale, dirOf } from '@/lib/bilingual';
import { track } from '@/lib/tracker';
import { useT } from '@/lib/i18n';

/**
 * The library — short stories, read for pleasure, shelved by level.
 *
 * ── Why a course with a fixed daily plan has a bookshelf ────
 * The book's Break Time recommends a graded reader: easy text, read
 * in quantity, no dictionary. It is the one activity that builds
 * reading speed, and it was a recommendation with nothing to open.
 *
 * ── Why it looks unlike the rest of the platform ────────────
 * Every other screen is a task with a target and a tick. This one is
 * not work, and a violet progress bar over it would say it was. So it
 * is warm paper and wide margins — the room tells you what to do in
 * it before the words do.
 *
 * ── Shelved by level, opened at the learner's own ──────────
 * One flat list put a fable of ninety words beside one of two
 * hundred and seventy, with nothing to say which to read first.
 * Each story now carries the level it was graded at, the shelf
 * opens at the learner's level (from the week they are in), and
 * the level above is labelled as a stretch — not locked, because
 * reading slightly above your level is exactly how reading grows.
 *
 * ── And nothing here locks or counts ────────────────────────
 * Finishing a story marks it read, and that is all it does: no
 * streak, no percentage, no day closed. The moment a pleasure is
 * scored it stops being one.
 */

export interface StoryWord {
  en: string;
  ar: string;
}

export type StoryLevel = 'A1' | 'A2' | 'A2+' | 'B1' | 'B1+';

/** What each shelf assumes — the book's modules, in plain words */
const LEVELS: { id: StoryLevel; when: string; what: string }[] = [
  { id: 'A1', when: 'الأسابيع 1–6', what: 'المضارع البسيط وفعل to be' },
  { id: 'A2', when: 'الأسابيع 7–12', what: 'الماضي البسيط والمستقبل' },
  { id: 'A2+', when: 'الأسابيع 13–18', what: 'المضارع التامّ والأفعال الناقصة والشرط الأوّل' },
  { id: 'B1', when: 'الأسابيع 19–24', what: 'المبني للمجهول والماضي التامّ والكلام المنقول' },
  { id: 'B1+', when: 'بعد الدورة', what: 'قصص أطول بمرّتين ونصف، وجمل أطول وأعقد' },
];

export interface StoryData {
  slug: string;
  level: StoryLevel;
  title_en: string;
  title_ar: string;
  source_ar: string | null;
  minutes: number;
  why_ar: string | null;
  lines: string[];
  moral_en: string | null;
  moral_ar: string | null;
  words: StoryWord[];
  word_count: number;
  /** Who tells it — the story's choice, not the learner's */
  narrator: 'f' | 'm';
  /** السرد المسجَّل: ملفّ واحد وبدايات جمله — أو `null` فيُقرأ آلياً */
  audio: { url: string; cues: number[] } | null;
}

export default function Stories({
  stories = [],
  read = [],
  my_level = 'A2',
}: {
  stories?: StoryData[];
  read?: string[];
  my_level?: StoryLevel;
}) {
  const tr = useT();
  const locale = useLocale();

  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>(read);

  /*
   * السرعة تبدأ من تفضيل المتدرّب ثم تُعدَّل هنا.
   *
   * وكانت الصفحة بلا شريط أصلاً — والقارئ يقرأ بسرعة ثابتة في
   * الشفرة، فلا صوته الذي اختاره ولا سرعته.
   */
  const prefs = (usePage().props as { prefs?: { voice?: 'f' | 'm' | 'c'; rate?: number } }).prefs;
  // Only the speed is the learner's: each story has its own narrator
  const { voice, rate } = useSpeechPrefs(prefs ?? {});
  const setRate = (r: number) => setSpeechPrefs({ rate: r });

  const topRef = useRef<HTMLDivElement | null>(null);

  const story = stories.find((s) => s.slug === open) ?? null;

  // Only shelves that have stories; the learner's own, or the next one up
  const shelves = LEVELS.filter((l) => stories.some((s) => s.level === l.id));
  const order = LEVELS.map((l) => l.id);
  const mine = order.indexOf(my_level);
  const startShelf =
    shelves.find((l) => order.indexOf(l.id) >= mine)?.id ?? shelves[shelves.length - 1]?.id;
  const [shelf, setShelf] = useState<StoryLevel | undefined>(startShelf);
  const current = LEVELS.find((l) => l.id === shelf);
  const onShelf = stories.filter((s) => s.level === shelf);

  /* Opening a story scrolls back to its first line, so the reader
   * does not start halfway down the shelf it was chosen from */
  useEffect(() => {
    if (story) topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [story]);

  const markRead = (slug: string) => {
    if (done.includes(slug)) return;

    setDone((d) => [...d, slug]);
    track('story_read', slug);
  };

  // The first unread story on this shelf — a place to start, not an order
  const pick = onShelf.find((s) => !done.includes(s.slug)) ?? null;

  const controls = (
    <SpeechControls
      voice={voice}
      onVoice={() => {}}
      rate={rate}
      onRate={setRate}
      size="sm"
      voiceLocked={
        !story ? tr('لكل قصّة راويها')
          : story.narrator === 'f' ? tr('تحكيها امرأة') : tr('يحكيها رجل')
      }
    />
  );

  return (
    <div dir={dirOf(locale)} className="min-h-screen bg-[var(--paper)] pb-28 sm:pb-20">
      <Head title={story ? story.title_ar : tr('القصص')} />

      <AppNav />

      {/* The library's head — gone while reading, so the story has the screen */}
      {!story && (
        <header className="border-b border-slate-200 bg-[var(--tint)]">
          <div className="mx-auto max-w-4xl px-4 py-5 sm:py-8">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2.5 text-xl font-bold text-stone-800 sm:text-2xl">
                  <BookOpen aria-hidden size={22} className="shrink-0" />
                  {tr('القصص')}
                </h1>

                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-stone-600">
                  {tr('قصص قصيرة مرتّبة بحسب المستوى. اقرأها للمتعة لا للدرس: بلا قاموس، وبلا توقّف عند كل كلمة — ومن فاته معنى كلمة أكمل، فالقصّة تشرح نفسها.')}
                </p>
              </div>

              <p className="shrink-0 text-sm text-stone-500">
                <span className="font-entry text-2xl text-stone-800">{done.length}</span>{' '}
                {tr('من')} {stories.length} {tr('قرأتها')}
              </p>
            </div>
          </div>
        </header>
      )}

      <main ref={topRef} className="mx-auto max-w-4xl scroll-mt-14 px-4 py-5 sm:py-8">
        {story ? (
          /* Edge to edge on a phone: the margin rule already takes a
             column, and the page gutter would take another */
          <div className="-mx-4 sm:mx-0">
            <StoryReader
              story={story}
              rate={rate}
              isRead={done.includes(story.slug)}
              onFinish={() => markRead(story.slug)}
              onClose={() => setOpen(null)}
              controls={controls}
            />
          </div>
        ) : (
          <>
          {/* ============ The shelves ============ */}
          {/* One equal column per level — the row never scrolls or clips,
              down to a 320px phone */}
          <div
            role="tablist"
            className="grid gap-1.5 sm:gap-2"
            style={{ gridTemplateColumns: `repeat(${shelves.length}, minmax(0, 1fr))` }}
          >
            {shelves.map((l) => {
              const all = stories.filter((s) => s.level === l.id);
              const readHere = all.filter((s) => done.includes(s.slug)).length;
              const active = l.id === shelf;
              const isMine = l.id === my_level;
              const isStretch = order.indexOf(l.id) === mine + 1;

              return (
                <button
                  key={l.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setShelf(l.id)}
                  className={`flex min-w-0 flex-col items-center rounded-xl px-0.5 py-2 text-center ring-1
                              transition sm:py-3 ${
                    active
                      ? 'bg-stone-800 text-white ring-stone-800'
                      : 'bg-white text-stone-700 ring-amber-200/70 hover:ring-amber-300'
                  }`}
                >
                  <span dir="ltr" className="font-entry text-lg leading-none sm:text-2xl">{l.id}</span>
                  {/* Always a second line, so every tab is the same height */}
                  <span
                    className={`mt-1 max-w-full truncate text-xs font-medium ${
                      isMine
                        ? active ? 'text-amber-200' : 'text-violet-700'
                        : active ? 'text-stone-300' : 'text-stone-500'
                    }`}
                  >
                    {isMine ? tr('مستواك') : isStretch ? tr('تحدٍّ') : ' '}
                  </span>
                  <span className={`mt-0.5 text-xs ${active ? 'text-stone-300' : 'text-stone-500'}`}>
                    {readHere}/{all.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* No shelf at the learner's own level yet — say so, not pretend */}
          {!shelves.some((l) => l.id === my_level) && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
              {tr('لا قصص لمستواك')} <Bdi>{my_level}</Bdi> {tr('بعد — فتحنا لك أقرب مستوى إليه.')}
            </p>
          )}

          {current && (
            <p className="mb-4 mt-4 text-sm leading-relaxed text-stone-600 sm:mb-5">
              <span className="font-semibold text-stone-800">{tr(current.when)}</span>
              {' — '}
              {tr(current.what)}
            </p>
          )}

          <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {onShelf.map((s) => {
              const isRead = done.includes(s.slug);
              const isPick = s.slug === pick?.slug;

              return (
                <li key={s.slug} className={isPick ? 'sm:col-span-2 lg:col-span-3' : undefined}>
                  <button
                    onClick={() => setOpen(s.slug)}
                    className={`group flex h-full w-full flex-col rounded-2xl bg-white p-4 text-start ring-1
                                transition hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${
                      isPick ? 'ring-amber-300' : 'ring-amber-200/70'
                    }`}
                  >
                    {isPick && (
                      <span className="mb-2 text-xs font-semibold text-[var(--accent)]">
                        {tr('ابدأ بهذه')}
                      </span>
                    )}

                    <div className="flex items-start gap-2">
                      <span
                        className={`min-w-0 flex-1 font-bold text-stone-800 ${isPick ? 'text-lg sm:text-xl' : ''}`}
                      >
                        {s.title_ar}
                      </span>

                      {isRead && (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2
                                     py-0.5 text-xs font-medium text-emerald-700"
                        >
                          <Check aria-hidden size={12} />
                          {tr('قرأتها')}
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 font-entry text-sm italic text-stone-500" dir="ltr">
                      {s.title_en}
                    </p>

                    {s.why_ar && (
                      <p className="mt-2 text-sm leading-relaxed text-stone-600">{s.why_ar}</p>
                    )}

                    {/* A taste of the first line — the reason to open it */}
                    {s.lines[0] && (
                      <p
                        dir="ltr"
                        className={`mt-3 border-s-2 border-amber-200 ps-3 font-entry text-sm leading-relaxed
                                    text-stone-500 ${isPick ? 'line-clamp-3 sm:text-base' : 'line-clamp-2'}`}
                      >
                        {s.lines[0]}
                      </p>
                    )}

                    {/* mt-auto: the facts sit on the card's floor, level across a row */}
                    <div className="mt-auto flex items-center gap-2 pt-4">
                      <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock aria-hidden size={12} />
                          {s.minutes} {tr('دقيقة')}
                        </span>
                        <span aria-hidden>·</span>
                        <span>
                          {s.word_count} {tr('كلمة')}
                        </span>
                        {s.source_ar && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{s.source_ar}</span>
                          </>
                        )}
                      </p>

                      <ChevronLeft
                        aria-hidden
                        size={16}
                        className="shrink-0 text-stone-400 transition group-hover:text-stone-700
                                   [[dir=ltr]_&]:rotate-180"
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
