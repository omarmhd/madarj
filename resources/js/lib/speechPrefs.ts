import { useSyncExternalStore } from 'react';
import axios from 'axios';
import type { VoicePref } from '@/hooks/useSpeech';

/**
 * The voice and speed the learner picked — one value for the whole app.
 *
 * ── The bug this fixes ──────────────────────────────────────
 * The ♀/♂ buttons changed a copy of the setting held by the page, while
 * the activities inside it (sounds, spelling, review, cards) read the
 * saved preference from the server through `useMySpeech`. So switching
 * to the male voice changed the page's own buttons and nothing else: the
 * drills kept speaking in the female voice.
 *
 * Now a change goes here: every speaker reads it at once, and it is saved
 * to the account, so the next page opens with it too.
 */
type Choice = { voice?: VoicePref; rate?: number };

let chosen: Choice = {};
const listeners = new Set<() => void>();
let timer: number | undefined;

function emit() {
  listeners.forEach((l) => l());
}

export function setSpeechPrefs(next: Choice): void {
  chosen = { ...chosen, ...next };
  emit();

  // Saved once the learner stops tapping — one request, not one per tap
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    axios.post('/prefs/speech', chosen).catch(() => {});
  }, 600);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The learner's choice in this session, over what the page was rendered with */
export function useSpeechPrefs(server: { voice?: VoicePref; rate?: number }): { voice: VoicePref; rate: number } {
  const c = useSyncExternalStore(subscribe, () => chosen, () => chosen);
  return {
    voice: (c.voice ?? server.voice ?? 'f') as VoicePref,
    rate: c.rate ?? server.rate ?? 0.8,
  };
}
