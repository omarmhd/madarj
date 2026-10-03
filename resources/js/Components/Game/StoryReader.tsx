import { ArrowRight, ChevronDown, ChevronUp, Mic } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useMySpeech, prefToGender, type VoicePref } from '@/hooks/useSpeech';
import { useNarration } from '@/hooks/useNarration';
import { useT } from '@/lib/i18n';
import type { StoryData } from '@/Pages/Stories';

/**
 * Reading a story, with the line being spoken lit up.
 *
 * ── Why the reader follows a line, not a paragraph ──────────
 * The point of reading aloud to a learner is that the eye and the ear
 * arrive together. A block of text read start to finish loses the eye
 * within two sentences; a lit line keeps them on the same word. It is
 * the same reason the book's listening sections are shadowed line by
 * line.
 *
 * ── Tapping a line starts from there ────────────────────────
 * A learner who missed a sentence wants that sentence, not the story
 * again from the top. Every line is its own button, and reading
 * continues from wherever it was tapped.
 *
 * ── The glossary sits under the story, not inside it ────────
 * The book's rule for extensive reading is: do not stop at every
 * word. Words underlined in the text invite exactly that stopping, so
 * the four hard words wait at the end for whoever wants them.
 *
 * ── A recorded narrator when there is one ───────────────────
 * A story with a human recording plays it; one without falls back to
 * the browser's voice. The screen is the same either way — the same
 * lit line, the same tap-a-line — because the learner did not choose
 * which stories were recorded first and should not be told about it
 * twice.
 *
 * ── And the moral is Arabic ─────────────────────────────────
 * The story is the English practice. The line that says why it was
 * worth reading is not practice — it is the point, and a point missed
 * is no point at all.
 */

export default function StoryReader({
  story,
  rate,
  voice,
  isRead,
  onFinish,
  onClose,
}: {
  story: StoryData;
  /** سرعة القراءة — من شريط الصفحة لا ثابتة في الشفرة */
  rate: number;
  /** الصوت المختار — ومن الشريط نفسه، فيسري أثره فوراً */
  voice: VoicePref;
  isRead: boolean;
  onFinish: () => void;
  onClose: () => void;
}) {
  const tr = useT();
  const { speakSequence, stop: stopSpeech, speaking, supported } = useMySpeech();
  const narration = useNarration();

  /* السرد البشريّ لا يحتاج محرّك نطق، فهو متاح حتى في فَيَرفُكس */
  const human = story.audio;
  const canRead = human !== null || supported;
  const reading = human ? narration.playing : speaking;

  const [at, setAt] = useState<number | null>(null);
  const [showWords, setShowWords] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);

  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /* السطر المضاء: من موضع الصوت الحقيقيّ إن كان مسجَّلاً، ومن
   * تسلسل النطق الآليّ إن لم يكن */
  const lit = human ? narration.at : at;

  /* Leaving the page in the middle of a story must not leave a voice
   * talking to an empty room */
  useEffect(() => () => stopSpeech(), [stopSpeech]);

  /* Keep the lit line on screen while it reads itself */
  useEffect(() => {
    if (lit === null) return;
    lineRefs.current[lit ?? 0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [lit]);

  const readFrom = (from: number) => {
    stopSpeech();
    narration.stop();

    if (human) {
      narration.play(human, {
        from,
        rate,
        onDone: () => {
          setReachedEnd(true);
          onFinish();
        },
      });

      return;
    }

    /*
     * الصوت والسرعة يُمرَّران صراحةً.
     *
     * `speakSequence` خام: تأخذ سرعتها الافتراضية (0.85) وتختار
     * الصوت بحسب `gender` كل سطر — وهي في الحوارات لمتحدّثين
     * اثنين. وقصّة بلا متحدّثَين تُقرأ بأيّ صوت وبسرعة لا يملكها
     * المتدرّب، فيبدو اختياره في الشريط بلا أثر.
     */
    speakSequence(
      story.lines.slice(from).map((text) => ({ text, gender: prefToGender(voice) })),
      {
        rate,
        gapMs: 500,
        onLine: (i) => setAt(from + i),
        onDone: () => {
          setAt(null);
          setReachedEnd(true);
          onFinish();
        },
      },
    );
  };

  const halt = () => {
    stopSpeech();
    narration.stop();
    setAt(null);
  };

  return (
    <article className="paper rounded p-5 sm:p-7">
      <button
        onClick={onClose}
        className="text-sm font-medium text-stone-500 transition hover:text-stone-800"
      >
        <ArrowRight aria-hidden size={15} className="inline-block align-[-3px]" /> {tr('رجوع إلى القصص')}
      </button>

      <header className="mt-4">
        <h2 className="text-2xl font-bold text-stone-900">{story.title_ar}</h2>

        <p className="mt-0.5 font-entry text-xl italic text-stone-500" dir="ltr">
          {story.title_en}
        </p>

        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
          {story.source_ar && <span>{story.source_ar}</span>}
          <span aria-hidden>·</span>
          <span>
            {story.word_count} {tr('كلمة')}
          </span>
          {isRead && (
            <>
              <span aria-hidden>·</span>
              <span className="text-emerald-600">{tr('قرأتها')}</span>
            </>
          )}
        </p>
      </header>

      {canRead ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => (reading ? halt() : readFrom(0))}
            className="rounded-xl bg-stone-800 px-5 py-2.5 text-sm font-semibold text-white
                       transition hover:bg-stone-700"
          >
            {reading ? tr('أوقف') : tr('اقرأ لي القصّة')}
          </button>

          <span className="text-sm leading-relaxed text-stone-500">
            {tr('أو اضغط أيّ سطر ليقرأ من عنده.')}
          </span>

          {human && (
            <span
              className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
              title={tr('سرد بشريّ مسجَّل')}
            >
              <Mic aria-hidden size={14} className="inline-block align-[-2px]" /> {tr('صوت بشريّ')}
            </span>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          {tr('متصفّحك لا ينطق. اقرأ بعينك — والقصّة تعمل بلا صوت.')}
        </p>
      )}

      {/* The text, written on the page's rules — one sentence per
          button, the line being read lit. `ruled-text` spaces the rules
          at the text's own line height, so a wrapped sentence still
          sits on them. */}
      <div className="ruled-text mt-6" dir="ltr">
        {story.lines.map((line, i) => (
          <button
            key={i}
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            onClick={() => readFrom(i)}
            // Inline, because `text-lg` carries its own line height
            style={{ lineHeight: 'var(--line)' }}
            className={`block w-full px-2 text-start text-lg transition sm:text-xl ${
                          lit === i
                            ? 'bg-amber-100 text-stone-900'
                            : 'text-stone-700 hover:bg-amber-50'
                        }`}
          >
            {line}
          </button>
        ))}
      </div>

      {/* المغزى — بالعربية، فهو سبب القراءة لا تدريبها */}
      {story.moral_ar && (
        <div className="mt-6 rounded-xl border-s-4 border-amber-500 bg-amber-50/70 p-4">
          <p className="text-base font-medium leading-relaxed text-amber-950">
            {story.moral_ar}
          </p>

          {story.moral_en && (
            <p className="mt-1.5 text-sm text-amber-700" dir="ltr">
              {story.moral_en}
            </p>
          )}
        </div>
      )}

      {/* المسرد — مطويّ، فالقاعدة ألّا تقف عند كل كلمة */}
      {story.words.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-stone-200">
          <button
            onClick={() => setShowWords((v) => !v)}
            aria-expanded={showWords}
            className="flex w-full items-center gap-2 bg-stone-50 px-4 py-3 text-start
                       transition hover:bg-stone-100"
          >
            <span className="flex-1 text-sm font-semibold text-stone-700">
              {tr('كلمات قد تقف عندها')} ({story.words.length})
            </span>
            <span aria-hidden className="text-stone-400">
              {showWords ? <ChevronUp aria-hidden size={16} /> : <ChevronDown aria-hidden size={16} />}
            </span>
          </button>

          {showWords && (
            <ul className="divide-y divide-stone-100">
              {story.words.map((w, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 text-sm font-medium text-stone-800" dir="ltr">
                    {w.en}
                  </span>
                  <span className="text-sm text-stone-600">{w.ar}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {reachedEnd && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-center text-sm text-emerald-800">
          {tr('انتهت. اقرأها مرّة أخرى بعد أسبوع — ستجدها أسهل، وهذا هو الدليل.')}
        </p>
      )}
    </article>
  );
}
