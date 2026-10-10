import { BookOpen } from 'lucide-react';
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
  const [rate, setRate] = useState(prefs?.rate ?? 0.8);
  const [voice, setVoice] = useState<'f' | 'm' | 'c'>(prefs?.voice ?? 'f');

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

  return (
    <div dir={dirOf(locale)} className="min-h-screen bg-[var(--paper)] pb-28 sm:pb-20">
      <Head title={tr('القصص')} />

      <AppNav />

      <header className="border-b border-slate-200 bg-[var(--tint)]">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="flex items-center gap-2.5 text-xl font-bold text-stone-800">
            <BookOpen aria-hidden size={20} />
            {tr('القصص')}
          </h1>

          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-stone-600">
            {tr('قصص قصيرة مرتّبة بحسب المستوى. اقرأها للمتعة لا للدرس: بلا قاموس، وبلا توقّف عند كل كلمة — ومن فاته معنى كلمة أكمل، فالقصّة تشرح نفسها.')}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-stone-500">
              {done.length} {tr('من')} {stories.length} {tr('قرأتها')}
            </p>

            <SpeechControls
              voice={voice}
              onVoice={setVoice}
              rate={rate}
              onRate={setRate}
              size="sm"
              voiceLocked={story?.audio ? tr('صوت الراوي') : undefined}
            />
          </div>
        </div>
      </header>

      <main ref={topRef} className="mx-auto max-w-3xl px-4 py-6">
        {story ? (
          <StoryReader
            story={story}
            rate={rate}
            voice={voice}
            isRead={done.includes(story.slug)}
            onFinish={() => markRead(story.slug)}
            onClose={() => setOpen(null)}
          />
        ) : (
          <>
          {/* ============ The shelves ============ */}
          {/* One equal column per level — the row never scrolls or clips */}
          <div
            role="tablist"
            className="grid gap-2"
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
                  className={`flex flex-col items-center rounded-xl px-1 py-2.5 text-center ring-1 transition ${
                    active
                      ? 'bg-stone-800 text-white ring-stone-800'
                      : 'bg-white text-stone-700 ring-amber-200/70 hover:ring-amber-300'
                  }`}
                >
                  <span dir="ltr" className="text-xl font-bold leading-none">{l.id}</span>
                  {/* Always a second line, so every tab is the same height */}
                  <span
                    className={`mt-1 text-xs font-medium ${
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
            <p className="mb-4 mt-3 text-sm leading-relaxed text-stone-600">
              <span className="font-semibold text-stone-800">{tr(current.when)}</span>
              {' — '}
              {tr(current.what)}
            </p>
          )}

          <ul className="grid gap-3 sm:grid-cols-2">
            {onShelf.map((s) => {
              const isRead = done.includes(s.slug);

              return (
                <li key={s.slug}>
                  <button
                    onClick={() => setOpen(s.slug)}
                    className="h-full w-full rounded-2xl bg-white p-4 text-start ring-1 ring-amber-200/70
                               transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 font-bold text-stone-800">
                        {s.title_ar}
                      </span>

                      {isRead && (
                        <span
                          className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs
                                     font-medium text-emerald-700"
                        >
                          {tr('قرأتها')}
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 text-xs text-stone-400" dir="ltr">
                      {s.title_en}
                    </p>

                    {s.why_ar && (
                      <p className="mt-2 text-sm leading-relaxed text-stone-600">{s.why_ar}</p>
                    )}

                    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
                      <span>
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
                  </button>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </main>
    </div>
  );
}
