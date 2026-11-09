import { useEffect, useRef } from 'react';

/**
 * Move on by itself after a RIGHT answer — and only then.
 *
 * A right answer needs no press: 3 seconds to hear the word and see the
 * tick. A miss is different. It is the moment the learner must read why,
 * and a timer that takes the correction away before it is read wastes
 * the one lesson in the item. So after a miss the screen waits, with a
 * button (MissNext) for when the learner is ready.
 */
export const AUTO_RIGHT_MS = 3000;
export const AUTO_REVEAL_MS = 5000;
export const AUTO_RETRY_MS = 1500;

export function useAutoAdvance(active: boolean, ms: number, go: () => void) {
  // The latest callback, without restarting the timer when it changes
  const fn = useRef(go);
  fn.current = go;

  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => fn.current(), ms);
    return () => window.clearTimeout(id);
  }, [active, ms]);
}

/**
 * The way on after a miss: try again, or the next item.
 * Focused on mount, so Enter works as it did with the timer.
 */
export function MissNext({ label, onClick }: { label: string; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);

  return (
    <button
      ref={ref}
      onClick={onClick}
      className="mt-4 min-h-12 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      {label}
    </button>
  );
}

/** A thin bar that empties over `ms` — keyed so it restarts per answer */
export function Countdown({ ms, tone = 'violet' }: { ms: number; tone?: 'violet' | 'emerald' | 'rose' }) {
  const color = { violet: 'bg-violet-500', emerald: 'bg-emerald-500', rose: 'bg-rose-400' }[tone];

  return (
    <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
      <div className={`countdown h-full rounded-full ${color}`} style={{ animationDuration: `${ms}ms` }} />
    </div>
  );
}
