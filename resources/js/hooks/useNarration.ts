import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Playing one recorded narration, and knowing where in it we are.
 *
 * ── One file per story, and what that costs ─────────────────
 * A file per sentence would make the sync free — the file playing is
 * the line. One file per story does not know where it is in the text,
 * so the sentence starts come with it as seconds. That is what the
 * `.vtt` beside the audio carries: a standard subtitle file, made by
 * the same step that generates the audio and fixable by hand when a
 * second drifts.
 *
 * ── Why the highlight follows time, not a counter ───────────
 * Playback is not a queue: the learner can drag the position, the
 * browser can stall on a slow connection, and a rate change stretches
 * everything. Counting sentences would drift away from the sound
 * within a minute. Asking the element where it actually is cannot.
 *
 * ── Speed without chipmunks ─────────────────────────────────
 * `preservesPitch` keeps a voice human at 0.6×. Without it, slowing a
 * recording drops the pitch and the narrator becomes a cartoon — the
 * opposite of the reason for recording a person at all.
 */

export interface Narration {
  url: string;
  /** بداية كل جملة بالثواني، بترتيب الجمل */
  cues: number[];
}

export function useNarration() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cuesRef = useRef<number[]>([]);
  const doneRef = useRef<(() => void) | null>(null);

  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState<number | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
    setAt(null);
  }, []);

  /* Leaving the page must not leave a voice talking to an empty room */
  useEffect(() => () => {
    audioRef.current?.pause();
  }, []);

  /** The sentence a moment belongs to: the last cue at or before it */
  const lineAt = (seconds: number, cues: number[]) => {
    let i = 0;
    while (i + 1 < cues.length && cues[i + 1] <= seconds) i++;
    return i;
  };

  const play = useCallback(
    (
      narration: Narration,
      opts: { from?: number; rate?: number; onDone?: () => void } = {},
    ) => {
      const { from = 0, rate = 1, onDone } = opts;

      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      cuesRef.current = narration.cues;
      doneRef.current = onDone ?? null;

      if (audio.src !== new URL(narration.url, window.location.origin).href) {
        audio.src = narration.url;
      }

      audio.playbackRate = rate;

      // الاسم يختلف بين المتصفّحات، والثلاثة آمنة
      const anyAudio = audio as HTMLAudioElement & {
        preservesPitch?: boolean;
        mozPreservesPitch?: boolean;
        webkitPreservesPitch?: boolean;
      };
      anyAudio.preservesPitch = true;
      anyAudio.mozPreservesPitch = true;
      anyAudio.webkitPreservesPitch = true;

      audio.ontimeupdate = () => {
        setAt(lineAt(audio.currentTime, cuesRef.current));
      };

      audio.onended = () => {
        setPlaying(false);
        setAt(null);
        doneRef.current?.();
      };

      /*
       * ملفٌّ لا يُحمَّل لا يُسقط الشاشة.
       *
       * القصّة كلّها معروضة نصّاً، والسرد زيادة عليها — فالفشل يوقف
       * الصوت ويترك القارئ يُكمل بعينه.
       */
      audio.onerror = () => {
        setPlaying(false);
        setAt(null);
      };

      audio.currentTime = narration.cues[from] ?? 0;
      setAt(from);
      setPlaying(true);

      void audio.play().catch(() => {
        setPlaying(false);
        setAt(null);
      });
    },
    [],
  );

  return { play, stop, playing, at };
}
