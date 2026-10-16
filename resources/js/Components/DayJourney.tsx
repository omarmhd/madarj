import { ArrowLeft, Check, Clock, Flag, Lock, Sparkles } from 'lucide-react';
import type { TaskKind } from '@/lib/taskKinds';
import { useT } from '@/lib/i18n';

/**
 * The day as a journey — a winding road with one station per task.
 *
 * The day used to open straight onto task 1, a long column of cards:
 * the learner never saw the shape of the day, only the next box. The
 * map shows the whole day first — how far, what kind of work, where
 * you are — and the learner comes back to it after each task, so
 * progress is something you see move, not a percentage.
 *
 * The road is drawn, not imaged: stations sit on a zigzag of fixed row
 * height, and one SVG path curves through the same points. Order stays
 * strict — a station ahead of the current one is locked, as the day's
 * sequence is the book's (listen before you speak).
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

const ROW = 104;
/** Horizontal position of each station, in % of the width — the zigzag */
const XS = [50, 76, 50, 24];

export default function DayJourney({ dayNumber, stations, current, onOpen, finished }: Props) {
  const tr = useT();

  const total = stations.reduce((m, s) => m + s.minutes, 0);
  const left = stations.filter((s) => !s.done).reduce((m, s) => m + s.minutes, 0);
  const doneCount = stations.filter((s) => s.done).length;
  const allDone = doneCount === stations.length && stations.length > 0;

  const points = stations.map((_, i) => ({ x: XS[i % XS.length], y: i * ROW + 44 }));
  const height = Math.max(1, stations.length) * ROW + 72;

  // A smooth curve through the stations: each segment bends vertically
  const path = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = points[i - 1];
      const midY = (prev.y + p.y) / 2;
      return `C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
    })
    .join(' ');

  // The travelled part of the road ends at the current station
  const travelled = points.slice(0, Math.min(current, points.length - 1) + 1);
  const donePath = travelled
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = travelled[i - 1];
      const midY = (prev.y + p.y) / 2;
      return `C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
    })
    .join(' ');

  const next = stations[current];

  return (
    <div className="leaf-in space-y-5">
      {/* The day at a glance */}
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <p className="text-sm font-medium text-violet-700">{tr('رحلة اليوم')} {dayNumber}</p>
        <p className="mt-1 text-xl font-bold text-slate-900">
          {allDone
            ? tr('وصلت إلى نهاية الرحلة')
            : doneCount === 0
              ? tr(':n محطات اليوم. ابدأ من الأولى.', { n: stations.length })
              : tr('أنجزت :d من :n محطات. تابع.', { d: doneCount, n: stations.length })}
        </p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-violet-100">
          <div
            className="h-full rounded-full bg-violet-600 transition-all duration-700"
            style={{ width: `${stations.length ? (doneCount / stations.length) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
          <Clock aria-hidden size={14} />
          {allDone ? tr(':n دقيقة من العمل اليوم', { n: total }) : tr('بقي نحو :n دقيقة', { n: left })}
        </p>
      </div>

      {allDone && finished}

      {/* The road */}
      <div className="relative rounded-2xl bg-white px-2 ring-1 ring-slate-200" style={{ height }}>
        <svg
          aria-hidden
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
        >
          <path d={path} fill="none" style={{ stroke: 'rgb(var(--neutral-200))' }}
            strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" strokeDasharray="2 10" />
          {donePath && (
            <path d={donePath} fill="none" style={{ stroke: 'rgb(var(--accent-500))' }}
              strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        {stations.map((s, i) => {
          const p = points[i];
          const isCurrent = i === current && !allDone;
          const Icon = s.kind.Icon;

          return (
            <button
              key={s.order}
              type="button"
              onClick={() => s.reachable && onOpen(i)}
              disabled={!s.reachable}
              aria-label={s.name}
              aria-current={isCurrent ? 'step' : undefined}
              className="group absolute flex w-28 -translate-x-1/2 -translate-y-7 flex-col items-center text-center
                         disabled:cursor-not-allowed"
              // Left in % — the SVG uses the same numbers, so road and stations meet
              style={{ left: `${p.x}%`, top: p.y }}
            >
              {isCurrent && (
                <span className="mb-1 rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                  {tr('أنت هنا')}
                </span>
              )}

              <span
                className={`relative grid h-14 w-14 place-items-center rounded-full transition
                            group-enabled:group-hover:scale-105 ${
                              s.done
                                ? 'bg-emerald-600 text-white shadow-md'
                                : isCurrent
                                  ? 'bg-violet-600 text-white shadow-lg ring-4 ring-violet-200'
                                  : s.reachable
                                    ? 'bg-white text-violet-700 ring-2 ring-violet-300'
                                    : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200'
                            }`}
              >
                {isCurrent && (
                  <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-violet-400/30 motion-reduce:hidden" />
                )}
                {s.done ? <Check size={24} strokeWidth={2.5} /> : s.reachable ? <Icon size={22} /> : <Lock size={18} />}
              </span>

              <span className={`mt-1.5 text-sm font-semibold leading-tight ${s.reachable ? 'text-slate-800' : 'text-slate-400'}`}>
                {tr(s.kind.short)}
              </span>
              <span className="text-xs text-slate-400">{s.minutes} {tr('د')}</span>
            </button>
          );
        })}

        {/* The finish line */}
        <span
          aria-hidden
          className={`absolute -translate-x-1/2 ${allDone ? 'text-emerald-600' : 'text-slate-300'}`}
          style={{ left: `${points.length ? points[points.length - 1].x : 50}%`, bottom: 10 }}
        >
          <Flag size={18} />
        </span>
      </div>

      {/* The one action */}
      {!allDone && next && (
        <button
          onClick={() => onOpen(current)}
          className="stamp flex min-h-14 w-full items-center justify-center gap-2 text-base font-semibold"
        >
          {doneCount === 0 ? <Sparkles aria-hidden size={18} /> : null}
          {doneCount === 0 ? tr('ابدأ الرحلة:') : tr('المحطة التالية:')} {tr(next.kind.short)}
          <ArrowLeft aria-hidden size={18} />
        </button>
      )}
    </div>
  );
}
