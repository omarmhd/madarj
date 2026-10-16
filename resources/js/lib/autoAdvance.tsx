import { useEffect, useRef } from 'react';

/**
 * Move on by itself after an answer — no "Next" button.
 *
 * The learner asked for it: a button after every answer is a press that
 * teaches nothing. A correct answer waits 3 seconds (hear the word, see
 * the tick); a revealed correction waits longer, since that is the moment
 * that has to be read. The bar shows the time left, so the move is never
 * a surprise.
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

/** A thin bar that empties over `ms` — keyed so it restarts per answer */
export function Countdown({ ms, tone = 'violet' }: { ms: number; tone?: 'violet' | 'emerald' | 'rose' }) {
  const color = { violet: 'bg-violet-500', emerald: 'bg-emerald-500', rose: 'bg-rose-400' }[tone];

  return (
    <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
      <div className={`countdown h-full rounded-full ${color}`} style={{ animationDuration: `${ms}ms` }} />
    </div>
  );
}
