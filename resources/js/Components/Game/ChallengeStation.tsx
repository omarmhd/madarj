import { useCallback, useRef, useState } from 'react';
import axios from 'axios';
import { Trophy } from 'lucide-react';
import ErrorHunt from '@/Components/Game/ErrorHunt';
import MatchRace from '@/Components/Game/MatchRace';
import { useT } from '@/lib/i18n';

/**
 * تحدّي اليوم — one short round of a game, required, near the day's end.
 *
 * Small on purpose: a game you must play becomes a chore the moment it
 * is long. One round, on words and mistakes already met. The round is
 * saved through a lesson route (not /play), so it works even when a
 * trial has the games page switched off; the server checks it was
 * played before the station can be marked.
 */

export interface ChallengeData {
  game: 'match_race' | 'error_hunt';
  words: { id: number; word: string; arabic: string }[];
  best: number;
}

export default function ChallengeStation({ data, onDone }: { data: ChallengeData; onDone: () => void }) {
  const tr = useT();
  const [saved, setSaved] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  // The games fire onFinish from an effect on their own callback: a new
  // callback each render would post the same round again and again
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const finish = useCallback(async (score: number) => {
    setFailed(false);
    try {
      await axios.post('/day/challenge-score', { game: data.game, score });
      setSaved(score);
      doneRef.current();
    } catch {
      setFailed(true);
    }
  }, [data.game]);

  return (
    <div className="space-y-3">
      {data.game === 'match_race'
        ? <MatchRace words={data.words} best={data.best} onFinish={finish} />
        : <ErrorHunt best={data.best} onFinish={finish} />}

      {saved !== null && (
        <p className="leaf-in flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 text-sm font-semibold text-emerald-800">
          <Trophy aria-hidden size={16} /> {tr('أنهيت تحدّي اليوم')} · {saved}
        </p>
      )}
      {failed && <p className="text-center text-sm text-rose-700">{tr('لم تُحفظ الجولة. تحقّق من الاتصال والعب جولة أخرى.')}</p>}
    </div>
  );
}
