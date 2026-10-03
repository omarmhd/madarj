import { useState } from 'react';
import Listen from '@/Components/Listen';
import { useRecognition } from '@/hooks/useSpeech';
import { track } from '@/lib/tracker';
import { useT } from '@/lib/i18n';

/**
 * Pronunciation check — the browser writes down what it heard.
 *
 * ── The one thing a printed book cannot do ──────────────────
 * A learner can practise `three` for a week and never find out they
 * are saying `tree`. Nobody is listening. This is the whole reason the
 * hook was written: say the word, and if the browser types the other
 * word of the pair, the mouth did something the ear did not intend.
 * Zero audio files, zero server — the recogniser is in the browser.
 *
 * ── Why it comes after the listening round, never before ────
 * The book's rule is listening before production, and the discrimination
 * game already refuses to advance below its target. So this is offered
 * at the end of that game rather than beside it: being told your
 * pronunciation is wrong before your ear can hear the difference
 * teaches nothing and discourages plenty.
 *
 * ── Three readings, not one ─────────────────────────────────
 * The recogniser returns its best three guesses and a match against
 * any of them counts. Insisting on the top guess marks correct speech
 * wrong often enough to make the feature worse than nothing — and a
 * learner who is told they failed when they did not will stop.
 *
 * ── It checks, it does not grade ────────────────────────────
 * Nothing here unlocks or closes anything. Recognition mishears
 * accents, and a gate built on it would punish the wrong people.
 */

export interface SayItem {
  /** The word to produce */
  say: string;
  /** The other word of the pair — the mistake worth naming */
  against?: string | null;
  ipa?: string | null;
}

/** Lowercase, no punctuation, single spaces — for comparing only */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type Verdict =
  | { kind: 'ok'; heard: string }
  | { kind: 'confused'; heard: string; with: string }
  | { kind: 'other'; heard: string };

/**
 * What the browser heard, against what was asked for.
 *
 * Exported because it is the only part of this screen with a right
 * answer, and a check can run it without a microphone or a DOM.
 */
export function judge(alternatives: string[], item: SayItem): Verdict {
  const target = normalise(item.say);
  const other = item.against ? normalise(item.against) : null;

  const heard = alternatives.map(normalise).filter(Boolean);

  // A recogniser often returns a phrase; the word inside it counts
  const holds = (text: string, word: string) =>
    text === word || new RegExp('(^| )' + word + '( |$)').test(text);

  if (heard.some((h) => holds(h, target))) {
    return { kind: 'ok', heard: heard[0] ?? target };
  }

  if (other && heard.some((h) => holds(h, other))) {
    return { kind: 'confused', heard: heard[0], with: item.against as string };
  }

  return { kind: 'other', heard: heard[0] ?? '' };
}

export default function SayIt({
  items,
  title_ar,
}: {
  items: SayItem[];
  title_ar?: string;
}) {
  const tr = useT();
  const { listen, listening, supported } = useRecognition();

  const [at, setAt] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [said, setSaid] = useState(0);
  const [right, setRight] = useState(0);

  const item = items[at];

  /*
   * Firefox has no SpeechRecognition at all.
   *
   * The rule in this project is to check `supported` and hide the
   * feature rather than let a button do nothing — and to say why, so
   * it does not read as something broken.
   */
  if (!supported) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">{tr('فحص النطق')}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          {tr('متصفّحك لا يستطيع الإنصات. افتح الصفحة في كروم أو إيدج أو سفاري ليعمل هذا القسم.')}
        </p>
      </div>
    );
  }

  if (!item) return null;

  const hear = async () => {
    setVerdict(null);
    setProblem(null);

    try {
      const alternatives = await listen();
      const result = judge(alternatives, item);

      setVerdict(result);
      setSaid((n) => n + 1);
      if (result.kind === 'ok') setRight((n) => n + 1);

      track('say_check', item.say, result.kind === 'ok' ? 1 : 0, {
        heard: result.heard,
      });
    } catch (e) {
      /*
       * The two failures mean opposite things to the learner: a denied
       * microphone is something they fix once in the browser, and
       * silence is something they fix by speaking up. One message for
       * both would send half of them to the wrong place.
       */
      const code = String((e as Error).message);

      setProblem(
        code === 'not-allowed' || code === 'service-not-allowed'
          ? tr('المتصفّح منع الميكروفون. اسمح له ثم أعد المحاولة.')
          : code === 'no-speech'
            ? tr('لم نسمع شيئاً. اقترب من الميكروفون وقُلها بصوت عادي.')
            : tr('تعذّر الإنصات الآن. أعد المحاولة.'),
      );
    }
  };

  const next = () => {
    setVerdict(null);
    setProblem(null);
    setAt((i) => i + 1);
  };

  const done = at >= items.length - 1 && verdict !== null;

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        <p className="flex-1 font-semibold text-slate-900">
          {title_ar ?? tr('قُلها، ولنرَ ما يسمعه')}
        </p>

        <span className="text-xs text-slate-400" dir="ltr">
          {at + 1} / {items.length}
        </span>
      </div>

      <div className="mt-4 text-center">
        <p className="text-3xl font-bold text-slate-900" dir="ltr">
          {item.say}
        </p>

        {item.ipa && (
          <p className="mt-1 font-mono text-xs text-slate-400" dir="ltr">
            {item.ipa}
          </p>
        )}

        {/* The model first, always — listening before production */}
        <div className="mt-3 flex justify-center">
          <Listen text={item.say} label={tr('اسمعها أولاً')} size="sm" />
        </div>
      </div>

      {verdict === null ? (
        <button
          onClick={hear}
          disabled={listening}
          className="mt-5 w-full rounded-xl bg-violet-600 py-3.5 font-semibold text-white
                     transition hover:bg-violet-700 disabled:opacity-70"
        >
          {listening ? tr('نُنصت… قُلها الآن') : tr('اضغط ثم قُلها')}
        </button>
      ) : (
        <Result verdict={verdict} item={item} tr={tr} />
      )}

      {problem && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
          {problem}
        </p>
      )}

      {verdict !== null && (
        <button
          onClick={next}
          disabled={at >= items.length - 1}
          className="mt-2 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700
                     transition hover:bg-slate-200 disabled:opacity-50"
        >
          {tr('الكلمة التالية')}
        </button>
      )}

      {done && (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-center text-sm leading-relaxed text-slate-600">
          {tr('نطقت')} {said} {tr('وسمعها المتصفّح صحيحة')} {right}
          {'. '}
          {tr('هذا فحص لا درجة — لا يقفل شيئاً ولا يفتحه.')}
        </p>
      )}
    </div>
  );
}

/**
 * What to say back.
 *
 * The valuable case is the middle one: the browser typed the other
 * word of the pair, which names the mistake instead of just denying
 * the attempt. "Wrong" teaches nothing; "you said tree" is a lesson.
 */
function Result({
  verdict,
  item,
  tr,
}: {
  verdict: Verdict;
  item: SayItem;
  tr: (s: string) => string;
}) {
  if (verdict.kind === 'ok') {
    return (
      <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-100">
        <p className="font-semibold text-emerald-900">{tr('سمعها صحيحة')}</p>
        <p className="mt-1 text-xs text-emerald-700" dir="ltr">
          {verdict.heard}
        </p>
      </div>
    );
  }

  if (verdict.kind === 'confused') {
    return (
      <div className="mt-5 rounded-xl bg-rose-50 p-4 text-center ring-1 ring-rose-100">
        <p className="font-semibold text-rose-900">{tr('سمعها الكلمة الأخرى')}</p>

        <p className="mt-2 text-sm text-rose-800" dir="ltr">
          <span className="font-bold">{verdict.with}</span>
          <span className="mx-2 text-rose-400">≠</span>
          <span className="font-bold">{item.say}</span>
        </p>

        <p className="mt-2 text-sm leading-relaxed text-rose-700">
          {tr('اسمع النموذج مرّة أخرى، وانتبه إلى الفرق، ثم أعِدها.')}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl bg-amber-50 p-4 text-center ring-1 ring-amber-100">
      <p className="font-semibold text-amber-900">{tr('سمعها شيئاً آخر')}</p>

      {verdict.heard && (
        <p className="mt-1 text-xs text-amber-800" dir="ltr">
          {verdict.heard}
        </p>
      )}

      <p className="mt-2 text-sm leading-relaxed text-amber-700">
        {tr('قد يكون الميكروفون أو لهجتك لا الكلمة. أعِدها مرّة أو مرّتين قبل أن تحكم على نفسك.')}
      </p>
    </div>
  );
}
