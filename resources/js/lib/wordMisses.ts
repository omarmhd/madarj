import axios from 'axios';

/**
 * A course word was missed: tell the server, which decides whether it
 * has been missed often enough to join the learner's memory (🧠).
 *
 * Fire and forget — a miss that fails to save is a lost hint, never a
 * stuck lesson. When the server does add the word, a `memory:added`
 * event goes out on window; the memory button listens, updates its
 * count, and tells the learner.
 */
export type MissSource = 'spelling' | 'practice' | 'review' | 'cards';

export interface MemoryAdded {
  word: { id: number; term: string; translation: string | null };
  counts?: { total: number; due: number; fresh: number };
}

export function reportMiss(word: string, source: MissSource): void {
  if (!word || !/[A-Za-z]/.test(word)) return;

  axios
    .post('/memory/miss', { word, source })
    .then(({ data }) => {
      if (data?.added) {
        window.dispatchEvent(new CustomEvent<MemoryAdded>('memory:added', {
          detail: { word: data.added, counts: data.counts },
        }));
      }
    })
    .catch(() => {});
}
