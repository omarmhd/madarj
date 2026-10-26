import { ArrowLeft, Check, Clock, Flag, Lock, LockOpen, PartyPopper, Sparkles } from 'lucide-react';
import { TONES, type TaskKind } from '@/lib/taskKinds';
import { useT } from '@/lib/i18n';

/**
 * The day as a journey — one coloured station per task, on a path.
 *
 * The map shows the whole day first — how far, what kind of work, where
 * you are — and the learner comes back to it after each task, so
 * progress is something you see move.
 *
 * ── Why a path of cards, not a zigzag ───────────────────────
 * The first map was a zigzag of identical circles with a word under
 * each. On a phone the words were tiny, every station looked the same,
 * and the day still felt like a list in disguise. Now each station is
 * a card in its own colour — listening is not writing — with the one
 * line that says what it asks, and the path between them fills as the
 * day goes. Order stays strict: a station ahead of the current one is
 * locked, as the day's sequence is the book's (listen before you speak).
 */

export interface Station {
  order: number;
  name: string;
  minutes: number;
  kind: TaskKind;
  done: boolean;
  reachable: boolean;
}

interface Props {
  dayNumber: number;
  stations: Station[];
  current: number;
  onOpen: (index: number) => void;
  /** Shown when every station is done */
  finished?: React.ReactNode;
}

/** A word for where the learner is — encouragement that matches the moment */
function cheer(done: number, total: number): string {
  if (total === 0) return '';
  if (done === 0) return 'ابدأ بالمحطة الأولى. الخطوة الأولى أصعبها.';
  if (done === total) return 'أنهيت كل محطات اليوم.';
  if (total - done === 1) return 'بقيت محطة واحدة فقط.';
  if (done / total >= 0.5) return 'تجاوزت نصف الطريق. استمرّ.';
  return 'بداية جيّدة. المحطة التالية تنتظرك.';
}

function Ring({ value, total }: { value: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const part = total ? value / total : 0;
  return (
    <svg viewBox="0 0 64 64" className="h-20 w-20 shrink-0 -rotate-90" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" style={{ stroke: 'rgb(var(--neutral-200))' }} />
      <circle
        cx="32" cy="32" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
        style={{ stroke: 'rgb(var(--accent-500))', strokeDasharray: c, strokeDashoffset: c * (1 - part) }}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  );
}

export default function DayJourney({ dayNumber, stations, current, onOpen, finished }: Props) {
  const tr = useT();

  const total = stations.reduce((m, s) => m + s.minutes, 0);
  const left = stations.filter((s) => !s.done).reduce((m, s) => m + s.minutes, 0);
  const doneCount = stations.filter((s) => s.done).length;
  const allDone = doneCount === stations.length && stations.length > 0;
  const next = stations[current];

  return (
    <div className="leaf-in space-y-5">
      {/* The day at a glance: a ring that fills, and a word for the moment */}
      <div className="flex items-center gap-4 rounded-3xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
        <div className="relative">
          <Ring value={doneCount} total={stations.length} />
          <span className="absolute inset-0 grid place-items-center text-lg font-bold text-slate-900">
            {doneCount}/{stations.length}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-violet-700">{tr('رحلة اليوم')} {dayNumber}</p>
          <p className="mt-0.5 text-lg font-bold leading-snug text-slate-900 sm:text-xl">
            {tr(cheer(doneCount, stations.length))}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <Clock aria-hidden size={14} />
            {allDone ? tr(':n دقيقة من العمل اليوم', { n: total }) : tr('بقي نحو :n دقيقة', { n: left })}
          </p>
        </div>
      </div>

      {allDone && finished}

      {/* The one action, above the path: no scrolling to find it */}
      {!allDone && next && (
        <button
          onClick={() => onOpen(current)}
          className="stamp flex min-h-14 w-full items-center justify-center gap-2 px-4 text-base font-semibold"
        >
          {doneCount === 0 ? <Sparkles aria-hidden size={18} /> : null}
          <span className="truncate">
            {doneCount === 0 ? tr('ابدأ الرحلة:') : tr('المحطة التالية:')} {tr(next.kind.short)}
          </span>
          <ArrowLeft aria-hidden size={18} className="shrink-0" />
        </button>
      )}

      {/* The path */}
      <ol className="relative space-y-3">
        {stations.map((s, i) => {
          const isCurrent = i === current && !allDone;
          const tone = TONES[s.kind.tone];
          const Icon = s.kind.Icon;
          const last = i === stations.length - 1;

          return (
            <li key={s.order} className="relative ps-16">
              {/* The road to the next station — filled once this one is behind you */}
              {!last && (
                <span
                  aria-hidden
                  className={`absolute start-[1.65rem] top-14 -bottom-3 w-1 rounded-full ${s.done ? tone.bar : 'bg-slate-200'}`}
                />
              )}

              {/* The station mark */}
              <span
                aria-hidden
                className={`absolute start-0 top-1 grid h-14 w-14 place-items-center rounded-2xl transition ${
                  s.done
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : isCurrent
                      ? `${tone.solid} shadow-lg journey-current`
                      : s.reachable
                        ? `${tone.soft} ${tone.text}`
                        : 'bg-slate-100 text-slate-400'
                }`}
              >
                {/* Three states, three marks: done, open (where you are), closed */}
                {s.done ? <Check size={26} strokeWidth={2.5} /> : s.reachable ? <LockOpen size={22} /> : <Lock size={18} />}
              </span>

              <button
                type="button"
                onClick={() => s.reachable && onOpen(i)}
                disabled={!s.reachable}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex w-full items-center gap-3 rounded-2xl p-4 text-start transition
                            disabled:cursor-not-allowed ${
                              isCurrent
                                ? `bg-white shadow-md ring-2 ${tone.ring}`
                                : s.reachable
                                  ? 'bg-white ring-1 ring-slate-200 hover:-translate-y-0.5 hover:shadow-sm'
                                  : 'bg-white/60 ring-1 ring-slate-100'
                            }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`font-bold ${s.reachable ? 'text-slate-900' : 'text-slate-400'}`}>
                      {tr(s.kind.short)}
                    </span>
                    {isCurrent && (
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${tone.soft} ${tone.text}`}>
                        <Icon aria-hidden size={12} /> {tr('أنت هنا')}
                      </span>
                    )}
                    {s.done && <span className="text-xs font-semibold text-emerald-700">{tr('تمّت')}</span>}
                  </span>
                  <span className={`mt-0.5 block text-sm leading-relaxed ${s.reachable ? 'text-slate-600' : 'text-slate-400'}`}>
                    {tr(s.kind.purpose)}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium text-slate-400">{s.minutes} {tr('د')}</span>
              </button>
            </li>
          );
        })}

        {/* The finish line */}
        <li className="relative flex items-center gap-3 ps-16" aria-hidden>
          <span
            className={`absolute start-0 grid h-14 w-14 place-items-center rounded-2xl ${
              allDone ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}
          >
            {allDone ? <PartyPopper size={24} /> : <Flag size={20} />}
          </span>
          <span className={`py-4 text-sm font-semibold ${allDone ? 'text-emerald-700' : 'text-slate-400'}`}>
            {tr('نهاية اليوم')}
          </span>
        </li>
      </ol>
    </div>
  );
}
