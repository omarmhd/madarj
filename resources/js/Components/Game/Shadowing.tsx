import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Play, Smartphone, Square } from 'lucide-react';
import Bdi from '@/Components/Bdi';
import { useMySpeech, type Gender } from '@/hooks/useSpeech';
import { useT } from '@/lib/i18n';

/**
 * Shadowing — one short paragraph, spoken along with the voice.
 *
 * The book calls shadowing "the most effective exercise in this
 * chapter", and the platform had it as one line of instructions. Here
 * it is a drill in four steps:
 *
 *   1. listen while reading       — the text and its sound meet once
 *   2. sentence by sentence       — hear one, say it twice
 *   3. together                   — speak over the voice, five times
 *   4. record on your own phone   — the platform keeps no recording (§4.2)
 *
 * ── One button ──────────────────────────────────────────────
 * The first version had a button for every verb — play, slow, next
 * sentence, next step — and with the page's own Back and Done that was
 * six on one screen. A learner looking at six buttons is reading the
 * interface, not the English. Now each step has a single button whose
 * label says what happens next: play, then move on. The slow play is
 * not a choice but the first hearing of every sentence, and a sentence
 * is replayed by tapping the sentence itself.
 *
 * The paragraph changes every day (the server picks it from the week's
 * dialogues and listening text), so the daily speaking task stops
 * being the same 90-second introduction seven days running.
 */

export interface ShadowLine {
  en: string;
  speaker?: string | null;
  gender?: Gender;
}

export interface ShadowData {
  title_en: string | null;
  source_ar: string;
  lines: ShadowLine[];
  ar: string | null;
  save_as: string;
}

interface Props {
  data: ShadowData;
  onProgress?: (done: number, total: number) => void;
}

const STEPS = [
  { title: 'استمع وأنت تقرأ', text: 'اقرأ النص بعينك مع الصوت. لا تتكلّم بعد.' },
  { title: 'جملة بجملة', text: 'اسمع الجملة، ثم قلها بصوت عالٍ مرتين. قلّد السرعة والوقفات. اضغط أي جملة لتسمعها مرة أخرى.' },
  { title: 'تكلّم مع الصوت', text: 'تكلّم مع الصوت في نفس الوقت. لا تنتظر حتى ينتهي. 5 مرات: أول مرتين أبطأ قليلاً.' },
  { title: 'سجّل على جوالك', text: '' },
] as const;

const TOGETHER_TARGET = 5;

export default function Shadowing({ data, onProgress }: Props) {
  const tr = useT();
  const { speakSequence, stop, supported, myRate } = useMySpeech();

  const [step, setStep] = useState(0);
  const [line, setLine] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);
  /** Has the current thing (the paragraph, or the current sentence) been heard? */
  const [heard, setHeard] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [showAr, setShowAr] = useState(false);
  const stopSeq = useRef<(() => void) | null>(null);

  useEffect(() => {
    onProgress?.(step, STEPS.length - 1);
  }, [step, onProgress]);

  useEffect(() => () => stopSeq.current?.(), []);

  const play = (from: number, to: number, rate: number, onDone?: () => void) => {
    stopSeq.current?.();
    stopSeq.current = speakSequence(
      data.lines.slice(from, to).map((l) => ({ text: l.en, gender: l.gender })),
      {
        rate,
        onLine: (i) => setPlaying(from + i),
        onDone: () => {
          setPlaying(null);
          onDone?.();
        },
      },
    );
  };

  const halt = () => {
    stopSeq.current?.();
    stopSeq.current = null;
    setPlaying(null);
    stop();
  };

  const goTo = (s: number) => {
    halt();
    setHeard(false);
    setStep(s);
  };

  const isPlaying = playing !== null;
  const last = data.lines.length - 1;
  const slow = myRate * 0.85;

  /*
   * The one button: what it says and what it does, by step.
   * Without speech in the browser, every step moves straight on —
   * the learner reads aloud instead.
   */
  let action: { label: string; icon: 'play' | 'stop' | 'next'; run: () => void } | null = null;

  if (isPlaying) {
    action = { label: tr('أوقف'), icon: 'stop', run: halt };
  } else if (step === 0) {
    action = heard || !supported
      ? { label: tr('التالي: جملة بجملة'), icon: 'next', run: () => goTo(1) }
      : { label: tr('شغّل الفقرة'), icon: 'play', run: () => play(0, data.lines.length, slow, () => setHeard(true)) };
  } else if (step === 1) {
    if (!heard && supported) {
      action = {
        label: tr('اسمع الجملة :n', { n: line + 1 }),
        icon: 'play',
        run: () => play(line, line + 1, slow, () => setHeard(true)),
      };
    } else if (line < last) {
      action = {
        label: tr('قلتها مرتين · الجملة :n', { n: line + 2 }),
        icon: 'next',
        run: () => { setLine((l) => l + 1); setHeard(false); },
      };
    } else {
      action = { label: tr('التالي: تكلّم مع الصوت'), icon: 'next', run: () => goTo(2) };
    }
  } else if (step === 2) {
    action = rounds >= TOGETHER_TARGET || !supported
      ? { label: tr('التالي: سجّل على جوالك'), icon: 'next', run: () => goTo(3) }
      : {
          label: tr('شغّل وتكلّم معه · :n من :total', { n: rounds + 1, total: TOGETHER_TARGET }),
          icon: 'play',
          run: () => play(0, data.lines.length, rounds < 2 ? slow : myRate, () => setRounds((r) => r + 1)),
        };
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {data.source_ar}
        {data.title_en && <> · <Bdi>{data.title_en}</Bdi></>}
      </p>

      {/* The four steps as a ladder — where you are, what is left. Tapping
          a step already passed goes back to it; nothing ahead opens early */}
      <ol className="grid grid-cols-4 gap-1.5">
        {STEPS.map((s, i) => (
          <li key={i}>
            <button
              onClick={() => i < step && goTo(i)}
              disabled={i >= step}
              className={`w-full rounded-lg px-1.5 py-2 text-center text-xs font-medium leading-snug transition ${
                i < step
                  ? 'bg-violet-700 text-white'
                  : i === step
                    ? 'bg-violet-100 text-violet-800 ring-1 ring-violet-300'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i < step ? <Check aria-hidden size={12} className="inline-block align-[-2px]" /> : `${i + 1}.`}{' '}
              {tr(s.title)}
            </button>
          </li>
        ))}
      </ol>

      {/* This step's instruction */}
      <div className="rounded-xl bg-violet-50 p-4">
        <p className="font-semibold text-violet-900">{tr(STEPS[step].title)}</p>

        {step < 3 ? (
          <p className="mt-1 text-sm leading-relaxed text-violet-900">{tr(STEPS[step].text)}</p>
        ) : (
          <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-violet-900">
            <li>1. {tr('افتح مسجّل الصوت في جوالك.')}</li>
            <li>2. {tr('اقرأ الفقرة مرة واحدة بلا توقّف. إن تعثّرت أكمل.')}</li>
            <li>3. {tr('اسمع تسجيلك، ثم اضغط أي جملة هنا لتسمعها وتقارن.')}</li>
            <li>
              4. {tr('احفظه باسم')} <Bdi><span className="font-mono font-semibold">{data.save_as}</span></Bdi>
            </li>
          </ol>
        )}

        {!supported && (
          <p className="mt-2 text-sm text-amber-800">
            {tr('متصفّحك لا ينطق النص. اقرأ الفقرة بصوت عالٍ ببطء بدلاً من ذلك.')}
          </p>
        )}
      </div>

      {/* The paragraph — every sentence replays on a tap */}
      <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <div className="space-y-1" dir="ltr">
          {data.lines.map((l, i) => {
            const current = step === 1 && line === i;
            const lit = playing === i || (current && playing === null);
            const dim = step === 1 && i > line;

            return (
              <button
                key={i}
                type="button"
                onClick={() => supported && play(i, i + 1, slow)}
                className={`block w-full rounded-lg px-2 py-1.5 text-start text-lg leading-relaxed transition ${
                  lit ? 'bg-violet-100 text-violet-900' : dim ? 'text-slate-300' : 'text-slate-800 hover:bg-slate-50'
                }`}
              >
                {l.speaker && <span className="me-2 text-sm font-bold text-slate-400">{l.speaker}:</span>}
                {l.en}
              </button>
            );
          })}
        </div>

        {data.ar && (
          <div className="mt-2 border-t border-slate-100 px-2 pt-2">
            <button onClick={() => setShowAr((v) => !v)} className="text-sm font-medium text-violet-700">
              {showAr ? tr('أخفِ الترجمة') : tr('اعرض الترجمة')}
            </button>
            {showAr && <p className="mt-2 text-sm leading-relaxed text-slate-600">{data.ar}</p>}
          </div>
        )}
      </div>

      {/* Step 3 shows how far along the five rounds are */}
      {step === 2 && supported && (
        <div className="flex items-center justify-center gap-1.5" aria-label={`${rounds}/${TOGETHER_TARGET}`}>
          {Array.from({ length: TOGETHER_TARGET }, (_, i) => (
            <span key={i} className={`h-2 w-8 rounded-full ${i < rounds ? 'bg-violet-600' : 'bg-slate-200'}`} />
          ))}
        </div>
      )}

      {/* The one button */}
      {action ? (
        <button
          onClick={action.run}
          className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold
                      transition active:scale-[.99] ${
                        action.icon === 'next'
                          ? 'bg-white text-violet-800 ring-2 ring-violet-300 hover:bg-violet-50'
                          : 'bg-violet-600 text-white hover:bg-violet-700'
                      }`}
        >
          {action.icon === 'play' && <Play aria-hidden size={15} fill="currentColor" />}
          {action.icon === 'stop' && <Square aria-hidden size={13} fill="currentColor" />}
          {action.label}
          {action.icon === 'next' && <ArrowLeft aria-hidden size={15} />}
        </button>
      ) : (
        <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <Smartphone aria-hidden size={16} />
          {tr('التسجيل يبقى في جوالك. حين تنتهي، اضغط «أنجزتها» في الأسفل.')}
        </p>
      )}
    </div>
  );
}
