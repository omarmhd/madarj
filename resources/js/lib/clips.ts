/**
 * Playing recorded lines — the dialogues' Piper files.
 *
 * One audio element for the whole page, so a new line always stops the
 * one before it, as the browser's speech does. And the same shape as
 * `speakSequence` (onLine, onDone, a stop function back), so a dialogue
 * plays its files or falls back to speech with the same code around it.
 */

let audio: HTMLAudioElement | null = null;
let token = 0;

function element(rate: number) {
  audio ??= new Audio();
  audio.playbackRate = rate;
  // A slowed recording keeps its pitch: a person, not a cartoon
  (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  return audio;
}

export function stopClips() {
  token++;
  audio?.pause();
}

/** One file, from the start */
export function playClip(url: string, rate = 1, onDone?: () => void) {
  playClips([url], { rate, onDone });
}

export function playClips(
  urls: string[],
  opts: { rate?: number; gapMs?: number; onLine?: (i: number) => void; onDone?: () => void } = {},
): () => void {
  const { rate = 1, gapMs = 400, onLine, onDone } = opts;
  const mine = ++token;
  const a = element(rate);

  const play = (i: number) => {
    if (mine !== token) return;
    if (i >= urls.length) {
      onDone?.();
      return;
    }

    onLine?.(i);
    a.src = urls[i];
    a.onended = () => window.setTimeout(() => play(i + 1), gapMs);
    // A file that fails to load ends the sequence instead of hanging on it
    a.onerror = () => mine === token && onDone?.();
    void a.play().catch(() => mine === token && onDone?.());
  };

  play(0);

  return () => {
    if (mine === token) stopClips();
  };
}
