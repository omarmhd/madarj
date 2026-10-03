import { CalendarCheck, Crosshair, Ear, Gamepad2, Zap } from 'lucide-react';
import { Head, router } from '@inertiajs/react';
import { useCallback, useState } from 'react';
import axios from 'axios';
import AppNav from '@/Components/AppNav';
import ErrorHunt from '@/Components/Game/ErrorHunt';
import WordOfDay, { type WordleState } from '@/Components/Game/WordOfDay';
import MatchRace, { type RaceWord } from '@/Components/Game/MatchRace';
import Echo, { type EchoGroup } from '@/Components/Game/Echo';
import { useSpeech } from '@/hooks/useSpeech';
import ErrorLog, { type ErrorRecord } from '@/Components/Game/ErrorLog';
import { flush } from '@/lib/tracker';
import { useLocale, dirOf } from '@/lib/bilingual';
import { useT } from '@/lib/i18n';

/**
 * Play.
 *
 * ── What this screen is for ─────────────────────────────────
 * The day nobody plans to study. §1 keeps games out of the daily
 * plan — a course is not a games app — but a learner with thirty
 * spare seconds and no intention of opening a lesson is exactly
 * who §10's unanswered question is about: does anyone come back on
 * day two?
 *
 * So: counted, never required. Nothing here closes a day, breaks a
 * streak, or moves the progress percentage.
 */
export default function Play({
  best,
  errors,
  wordle,
  words,
  pairs,
}: {
  best?: Record<string, number>;
  errors?: Record<string, ErrorRecord>;
  wordle?: WordleState | null;
  words?: RaceWord[];
  pairs?: EchoGroup[];
}) {
  const tr = useT();
  const locale = useLocale();

  const [records, setRecords] = useState<Record<string, number>>(best ?? {});
  const { supported: canSpeak } = useSpeech();

  /*
   * One game on screen at a time, chosen from a row of tabs. A game
   * that has nothing to play with (no studied words yet, no speech in
   * this browser) is left out rather than shown broken.
   */
  const games = [
    wordle && { key: 'word_of_day', label: 'كلمة اليوم', icon: CalendarCheck },
    (words?.length ?? 0) >= 10 && { key: 'match_race', label: 'سباق الأزواج', icon: Zap },
    canSpeak && (pairs?.length ?? 0) > 0 && { key: 'echo', label: 'صدى', icon: Ear },
    { key: 'error_hunt', label: 'صيد الخطأ', icon: Crosshair },
  ].filter(Boolean) as { key: string; label: string; icon: typeof Zap }[];

  const [game, setGame] = useState(games[0].key);

  /**
   * Save the round, then trust the server's answer for the record.
   *
   * Stable identity: the game's own effect fires on the score, and a
   * fresh function each render would make it fire on every render.
   */
  const saveScore = useCallback((game: string, score: number) => {
    /*
     * السجلّ يُحدَّث عند انتهاء الجولة، لا عند إعادة تحميل الصفحة.
     *
     * إجابات الجولة تُجمَّع في المتصفّح وتُرسَل كل عشر ثوانٍ، و`errors`
     * تُحسب مرّة عند فتح الصفحة. فبلا هذين السطرين ينهي المتدرّب جولة
     * فيرى سجلّاً لا أثر لها فيه — ويظنّه معطّلاً وهو محقّ.
     *
     * فتُرسَل الدفعة أولاً، ثم يُطلب `errors` وحده: طلبٌ جزئيّ لا
     * يعيد بناء الصفحة ولا يقطع اللعبة.
     */
    if (game === 'error_hunt') void flush().then(() => router.reload({ only: ['errors'] }));

    axios
      .post('/play/score', { game, score })
      .then(({ data }) => data.best && setRecords(data.best))
      .catch(() => {
        // A lost score is not worth an error message. Keep the local
        // record so the next round still has something to beat.
        setRecords((r) => ({
          ...r,
          [game]: Math.max(r[game] ?? 0, score),
        }));
      });
  }, []);

  // Stable per game: each game's effect fires on its own onFinish
  const saveHunt = useCallback((n: number) => saveScore('error_hunt', n), [saveScore]);
  const saveRace = useCallback((n: number) => saveScore('match_race', n), [saveScore]);
  const saveEcho = useCallback((n: number) => saveScore('echo', n), [saveScore]);

  return (
    <div dir={dirOf(locale)} className="min-h-screen bg-slate-50 pb-28 sm:pb-20">
      <Head title={tr('للتسلية')} />

      <AppNav />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-5">
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Gamepad2 aria-hidden size={20} />
            {tr('للتسلية')}
          </h1>
          <p className="mt-1 max-w-lg text-xs leading-relaxed text-slate-500">
            {tr('العب وقت ما تحب. لا يؤثّر على تقدّمك ولا على سلسلة أيامك — ودقيقة هنا أفضل من يوم بلا إنجليزية.')}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={tr('الألعاب')}>
          {games.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setGame(key)}
              aria-pressed={game === key}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                game === key
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
              }`}
            >
              <Icon aria-hidden size={16} />
              {tr(label)}
            </button>
          ))}
        </nav>

        {game === 'word_of_day' && wordle && (
          <WordOfDay
            initial={wordle}
            // Reload the round with the record: the reload remounts the
            // game, and a stale `wordle` brought back the empty grid
            onDone={() => router.reload({ only: ['best', 'wordle'] })}
          />
        )}

        {game === 'match_race' && (
          <MatchRace words={words ?? []} best={records.match_race ?? 0} onFinish={saveRace} />
        )}

        {game === 'echo' && <Echo groups={pairs ?? []} best={records.echo ?? 0} onFinish={saveEcho} />}

        {game === 'error_hunt' && (
          <>
            <ErrorHunt best={records.error_hunt ?? 0} onFinish={saveHunt} />

            {/*
              The log sits under the game, not above it: the game is why
              they came, the log is what stays — read while the
              mistakes are still fresh.
            */}
            <ErrorLog records={errors ?? {}} />
          </>
        )}
      </main>
    </div>
  );
}
