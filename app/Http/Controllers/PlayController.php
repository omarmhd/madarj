<?php

namespace App\Http\Controllers;

use App\Models\LearningEvent;
use App\Models\MinimalPair;
use App\Models\User;
use App\Models\Vocabulary;
use Illuminate\Support\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Play — the games that sit outside the study hour.
 *
 * ── Why this is its own screen ──────────────────────────────
 * §1 is explicit that this is a course, not a games app. So a game
 * does not appear among the day's tasks, where it would read as
 * work; it lives here, in the same family as Break Time: counted,
 * never required, closing no day and breaking no streak.
 *
 * ── Where a score is kept ───────────────────────────────────
 * In `learning_events`, not a new table. That log already answers
 * "what did this learner do", a score is one integer, and the
 * personal best is one indexed `MAX()` over `(user_id, type, ref)`.
 * A table for a toy is a table to migrate forever.
 */
class PlayController extends Controller
{
    /** The games on offer, by their event ref */
    public const GAMES = ['error_hunt', 'match_race', 'echo'];

    /** Wordle rules: five letters, six tries */
    public const WORD_LENGTH = 5;

    public const WORD_TRIES = 6;

    public function index(Request $request): Response
    {
        return Inertia::render('Play', [
            // Their own record. There is no leaderboard, by choice:
            // the audience is adults studying alone, and comparison
            // with strangers turns "I am improving" into "I look
            // like I am improving".
            'best' => fn () => $this->best($request->user()->id),

            // The three newer games draw only on what the learner has
            // already studied: a game that shows unknown words is a test.
            'wordle' => fn () => $this->wordleState($request->user()),
            'words'  => fn () => $this->studiedWords($request->user())
                ->inRandomOrder()->limit(60)->get(['id', 'word', 'arabic']),
            'pairs'  => fn () => $this->pairGroups($request->user()),

            /*
             * سجلّ الأخطاء العشرين — مرجع المتدرّب لا نتيجة لعبة.
             *
             * اللعبة كانت تُعلّم أربع ثوانٍ ثم تنسى: تعرض التصحيح عند
             * الخطأ، وتنتهي الجولة فيذهب كل شيء. والقائمة العشرون هي
             * عمود المنهج كلّه، فما يستحقّ الحفظ ليس النقاط بل أيّها
             * يُمسك به فعلاً.
             *
             * واستعلام واحد مجمَّع على الفهرس (user_id, type, ref).
             */
            'errors' => fn () => LearningEvent::where('user_id', $request->user()->id)
                ->where('type', 'game_answer')
                ->where('ref', 'like', 'error:%')
                ->selectRaw('ref')
                ->selectRaw('COUNT(*) AS tries')
                ->selectRaw('SUM(CASE WHEN value = 1 THEN 0 ELSE 1 END) AS misses')
                ->groupBy('ref')
                ->get()
                ->mapWithKeys(fn ($row) => [
                    (int) substr($row->ref, 6) => [
                        'tries'  => (int) $row->tries,
                        'misses' => (int) $row->misses,
                    ],
                ]),
        ]);
    }

    /**
     * Record a finished round.
     *
     * The score is stored as it comes: it buys nothing to protect —
     * it unlocks nothing, gates nothing, and is only ever compared
     * against the same learner's own previous rounds.
     */
    public function score(Request $request): JsonResponse
    {
        $data = $request->validate([
            'game'  => ['required', 'in:'.implode(',', self::GAMES)],
            'score' => ['required', 'integer', 'min:0', 'max:86400'],
        ]);

        $user = $request->user();

        LearningEvent::create([
            'user_id'     => $user->id,
            'type'        => 'game_score',
            'ref'         => $data['game'],
            'value'       => $data['score'],
            'occurred_at' => now(),
        ]);

        return response()->json(['best' => $this->best($user->id)]);
    }

    /** Best round per game — one grouped query, not one per game */
    protected function best(int $userId): array
    {
        return LearningEvent::where('user_id', $userId)
            ->where('type', 'game_score')
            ->selectRaw('ref, MAX(value) as best')
            ->groupBy('ref')
            ->pluck('best', 'ref')
            ->all();
    }

    /** The week the learner has reached — the ceiling for every game */
    protected function reachedWeek(User $user): int
    {
        return $user->enrollment?->current_week ?? 1;
    }

    protected function studiedWords(User $user)
    {
        $week = $this->reachedWeek($user);

        return Vocabulary::whereHas('week', fn ($q) => $q->where('number', '<=', $week));
    }

    /**
     * Minimal pairs grouped by contrast, one group per round on the
     * client. Groups are never mixed (§2.4): /ɪ/ against /iː/ is a
     * game, /ɪ/ against /ʊ/ against /æ/ is noise.
     */
    protected function pairGroups(User $user)
    {
        $week = $this->reachedWeek($user);

        return MinimalPair::whereHas('week', fn ($q) => $q->where('number', '<=', $week))
            ->get()
            ->groupBy('group_label')
            ->map(fn ($items, $label) => [
                'label_en' => $label,
                'label_ar' => $items->first()->group_label_ar,
                'ipa'      => $items->first()->ipa,
                'pairs'    => $items->map(fn ($p) => [$p->word_a, $p->word_b])->values(),
            ])
            ->filter(fn ($g) => count($g['pairs']) >= 3)
            ->values();
    }

    /* ───────────── Word of the day ───────────── */

    /** "Today" in the learner's own timezone, so the word turns over at their midnight */
    protected function today(User $user): string
    {
        return Carbon::now($user->enrollment?->timezone ?? 'UTC')->toDateString();
    }

    /**
     * Today's secret word, chosen on the server and never sent until
     * the round is over — the same rule as `$hidden` on exercises.
     *
     * Deterministic by (user, date): a reload gives the same word,
     * and nothing needs to be stored to remember it.
     */
    protected function secretWord(User $user): ?Vocabulary
    {
        $pool = $this->studiedWords($user)
            ->whereRaw('LENGTH(word) = ?', [self::WORD_LENGTH])
            ->orderBy('id')
            ->get(['id', 'word', 'arabic'])
            ->filter(fn ($v) => preg_match('/^[a-z]+$/i', $v->word))
            ->values();

        if ($pool->isEmpty()) {
            return null;
        }

        return $pool[crc32($user->id.'|'.$this->today($user)) % $pool->count()];
    }

    protected function todaysGuesses(User $user)
    {
        return LearningEvent::where('user_id', $user->id)
            ->where('type', 'wordle_guess')
            ->where('ref', $this->today($user))
            ->orderBy('id')
            ->get(['meta'])
            ->map(fn ($e) => $e->meta);
    }

    protected function wordleState(User $user): ?array
    {
        $secret = $this->secretWord($user);

        if (! $secret) {
            return null;
        }

        $word = strtolower($secret->word);
        $guesses = $this->todaysGuesses($user);
        $solved = $guesses->contains(fn ($g) => $g['guess'] === $word);
        $over = $solved || $guesses->count() >= self::WORD_TRIES;

        return [
            'length'  => self::WORD_LENGTH,
            'tries'   => self::WORD_TRIES,
            'hint_ar' => $secret->arabic,
            'guesses' => $guesses->values(),
            'solved'  => $solved,
            'over'    => $over,
            // Revealed only once there is nothing left to guess
            'answer'  => $over ? $word : null,
        ];
    }

    /**
     * Mark one guess: 2 = right place, 1 = in the word elsewhere,
     * 0 = absent. Two passes, so a doubled letter is not credited
     * more times than the secret holds it.
     */
    public static function marks(string $guess, string $secret): array
    {
        $marks = array_fill(0, strlen($guess), 0);
        $left = [];

        foreach (str_split($secret) as $i => $ch) {
            if ($guess[$i] === $ch) {
                $marks[$i] = 2;
            } else {
                $left[$ch] = ($left[$ch] ?? 0) + 1;
            }
        }

        foreach (str_split($guess) as $i => $ch) {
            if ($marks[$i] === 0 && ($left[$ch] ?? 0) > 0) {
                $marks[$i] = 1;
                $left[$ch]--;
            }
        }

        return $marks;
    }

    /**
     * One Wordle guess, judged here: the secret never reaches the
     * browser, so the browser cannot be the judge (§4.4).
     */
    public function guess(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'guess' => ['required', 'string', 'size:'.self::WORD_LENGTH, 'regex:/^[a-zA-Z]+$/'],
        ]);

        $state = $this->wordleState($user);

        abort_if(! $state || $state['over'], 422);

        $secret = strtolower($this->secretWord($user)->word);
        $guess = strtolower($data['guess']);

        LearningEvent::create([
            'user_id'     => $user->id,
            'type'        => 'wordle_guess',
            'ref'         => $this->today($user),
            'value'       => $guess === $secret ? 1 : 0,
            'meta'        => ['guess' => $guess, 'marks' => self::marks($guess, $secret)],
            'occurred_at' => now(),
        ]);

        $state = $this->wordleState($user);

        // A finished day is a round: fewer tries, higher score (6..1, 0 on a miss)
        if ($state['over']) {
            LearningEvent::create([
                'user_id'     => $user->id,
                'type'        => 'game_score',
                'ref'         => 'word_of_day',
                'value'       => $state['solved'] ? self::WORD_TRIES + 1 - count($state['guesses']) : 0,
                'occurred_at' => now(),
            ]);
        }

        return response()->json(['wordle' => $state]);
    }
}
