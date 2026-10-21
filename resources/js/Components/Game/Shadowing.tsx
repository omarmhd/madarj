import { useEffect, useRef, useState } from 'react';
import { Check, Mic, Play, RotateCcw, Smartphone, Square, Volume2 } from 'lucide-react';
import Bdi from '@/Components/Bdi';
import { useMySpeech, type Gender } from '@/hooks/useSpeech';
import { useT } from '@/lib/i18n';

/**
 * اسمع وردّد — one short paragraph, heard and repeated, hands-free.
 *
 * ── Why it replaced the four-step shadowing ─────────────────
 * Shadowing proper — speaking over the voice — is hard for a beginner,
 * and the drill that carried it had four steps and a button for each
 * move. Learners found it tiring and confusing. Listen-and-repeat is
 * the right stage for this level, and it runs by itself: one press,
 * then each sentence is spoken, a pause sized to the sentence is left
 * for the learner to say it aloud, and the next one follows. Two
 * rounds: slower, then at normal speed. Recording on the phone is an
 * offer at the end, not a step.
 *
 * The paragraph still changes every day (the server picks it from the
 * week's dialogues and listening text).
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
  /** Called once both rounds have been heard and repeated */
  onComplete?: () => void;
}

const ROUNDS = 2;

/** Time to say a sentence back: about 0.55s a word, never under 2s */
const pauseFor = (en: string) => Math.max(2000, en.split(/\s+/).length * 550 + 900);

type Status = 'idle' | 'listen' | 'say' | 'done';

export default function Shadowing({ data, onProgress, onComplete }: Props) {
  const tr = useT();
  const { speakSequence, stop, supported, myRate } = useMySpeech();

  const [status, setStatus] = useState<Status>('idle');
  const [round, setRound] = useState(0);
  const [line, setLine] = useState(-1);
  const [pauseMs, setPauseMs] = useState(0);
  const [showAr, setShowAr] = useState(false);

  /** Bumped to cancel a running pass — every await checks it */
  const run = useRef(0);

  // On leaving: cancel the pass and silence the voice. Through a ref, so a
  // new `stop` identity on re-render cannot cancel a pass mid-way
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => () => { run.current++; stopRef.current(); }, []);

  useEffect(() => {
    onProgress?.(status === 'done' ? ROUNDS : round, ROUNDS);
  }, [round, status, onProgress]);

  /*
   * Speak one line — and never wait forever for it. A device with no
   * installed voice may never report the end of speech, which would
   * freeze the pass on its first sentence; a time limit sized to the
   * sentence lets it go on.
   */
  const say = (l: ShadowLine, rate: number) =>
    new Promise<void>((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      speakSequence([{ text: l.en, gender: l.gender }], { rate, onDone: finish });
      setTimeout(finish, Math.max(3500, l.en.split(/\s+/).length * 700 / rate));
    });
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const start = async () => {
    const id = ++run.current;
    const alive = () => run.current === id;

    for (let r = 0; r < ROUNDS; r++) {
      setRound(r);
      const rate = r === 0 ? myRate * 0.85 : myRate;

      for (let i = 0; i < data.lines.length; i++) {
        if (!alive()) return;
        setLine(i);
        setStatus('listen');
        await say(data.lines[i], rate);
        if (!alive()) return;

        const ms = pauseFor(data.lines[i].en);
        setPauseMs(ms);
        setStatus('say');
        await wait(ms);
      }
    }

    if (!alive()) return;
    setLine(-1);
    setStatus('done');
    onComplete?.();
  };

  const halt = () => {
    run.current++;
    stop();
    setStatus('idle');
    setLine(-1);
  };

  const running = status === 'listen' || status === 'say';

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-violet-50 p-4">
        <p className="font-semibold text-violet-900">{tr('اسمع وردّد')}</p>
        <p className="mt-1 text-sm leading-relaxed text-violet-900">
          {tr('تسمع كل جملة، ثم عندك وقت لتقولها بصوت عالٍ. لا تضغط شيئاً حتى تنتهي. جولتان: الأولى أبطأ.')}
        </p>
        <p className="mt-1.5 text-sm text-violet-700">
          {data.source_ar}
          {data.title_en && <> · <Bdi>{data.title_en}</Bdi></>}
        </p>
      </div>

      {/* The paragraph — the line in play is lit; when idle, a tap plays one line */}
      <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <div className="space-y-1" dir="ltr">
          {data.lines.map((l, i) => {
            const active = line === i;
            return (
              <button
                key={i}
                type="button"
                disabled={running || !supported}
                onClick={() => speakSequence([{ text: l.en, gender: l.gender }], { rate: myRate * 0.85 })}
                className={`block w-full rounded-lg px-2 py-1.5 text-start text-lg leading-relaxed transition ${
                  active
                    ? status === 'say'
                      ? 'bg-emerald-50 text-emerald-900 ring-2 ring-emerald-300'
                      : 'bg-violet-100 text-violet-900'
                    : 'text-slate-800 enabled:hover:bg-slate-50'
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

      {/* What is happening now */}
      {running && (
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">{tr('الجولة')} {round + 1} {tr('من')} {ROUNDS}</p>
          <p className={`mt-1 flex items-center justify-center gap-2 text-lg font-bold ${status === 'say' ? 'text-emerald-700' : 'text-violet-700'}`}>
            {status === 'say' ? <Mic aria-hidden size={20} /> : <Volume2 aria-hidden size={20} />}
            {status === 'say' ? tr('دورك: قلها الآن بصوت عالٍ') : tr('اسمع…')}
          </p>
          {status === 'say' && (
            <div key={`${round}-${line}`} className="mx-auto mt-3 h-1.5 max-w-xs overflow-hidden rounded-full bg-emerald-100">
              <div className="countdown h-full rounded-full bg-emerald-500" style={{ animationDuration: `${pauseMs}ms` }} />
            </div>
          )}
        </div>
      )}

      {status === 'done' && (
        <div className="rounded-xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-200">
          <p className="flex items-center justify-center gap-1.5 font-semibold text-emerald-900">
            <Check aria-hidden size={18} /> {tr('أحسنت. قلت الفقرة كاملة مرتين.')}
          </p>
          <p className="mt-1.5 flex items-center justify-center gap-1.5 text-sm text-emerald-800">
            <Smartphone aria-hidden size={15} />
            {tr('إن أردت: سجّلها مرة على جوالك واسمع نفسك.')}{' '}
            <Bdi><span className="font-mono">{data.save_as}</span></Bdi>
          </p>
        </div>
      )}

      {!supported ? (
        <button
          onClick={() => { setStatus('done'); onComplete?.(); }}
          className="min-h-12 w-full rounded-xl bg-violet-600 text-sm font-semibold text-white"
        >
          {tr('متصفّحك لا ينطق. اقرأ الفقرة بصوت عالٍ مرتين، ثم اضغط هنا')}
        </button>
      ) : running ? (
        <button
          onClick={halt}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-300"
        >
          <Square aria-hidden size={13} fill="currentColor" /> {tr('أوقف')}
        </button>
      ) : (
        <button
          onClick={start}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-base font-semibold text-white transition hover:bg-violet-700"
        >
          {status === 'done'
            ? <><RotateCcw aria-hidden size={16} /> {tr('أعدها مرة أخرى')}</>
            : <><Play aria-hidden size={16} fill="currentColor" /> {tr('ابدأ')}</>}
        </button>
      )}
    </div>
  );
}
