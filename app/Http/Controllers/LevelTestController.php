<?php

namespace App\Http\Controllers;

use App\Models\Exercise;
use App\Models\LevelTest;
use App\Models\LevelTestAttempt;
use App\Models\User;
use App\Services\ProgressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Level tests — the real test at the end of each module.
 *
 * ── Why it replaced the self-check ──────────────────────────
 * The week's self-check was a list of "I can…" boxes the learner
 * ticked for themselves, and the review weeks waited on a score that
 * nothing in the interface ever sent. A level is a claim; this makes
 * the claim something tested rather than declared.
 *
 * ── Modelled on international exams ─────────────────────────
 * Cambridge A2 Key / B1 Preliminary task styles in five sections —
 * listening, reading, grammar, vocabulary, writing — a fixed time,
 * listening played at most twice, and a pass at 60% (`WeekGate`).
 *
 * ── The server decides everything ───────────────────────────
 * Answers never reach the browser (§4.4); the deadline is kept here,
 * not by the page's clock; and a pass is recorded through
 * `recordTestScore`, the only thing that opens the next module.
 *
 * ── Leaving the tab ─────────────────────────────────────────
 * Counted, shown, never punished. The audience is adults studying
 * for themselves: the warning says "don't cheat yourself", and the
 * count appears on their result — it does not cancel the test.
 */
class LevelTestController extends Controller
{
    /** Hours before a failed test can be sat again — time to study the weak section, not to memorise */
    public const RETRY_HOURS = 24;

    public function __construct(protected ProgressService $progress) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        $attempts = LevelTestAttempt::where('user_id', $user->id)
            ->whereNotNull('submitted_at')
            ->orderByDesc('id')
            ->get()
            ->groupBy('level_test_id');

        return Inertia::render('Tests/Index', [
            'tests' => LevelTest::orderBy('after_week')->get()->map(function (LevelTest $t) use ($user, $attempts) {
                $mine = $attempts->get($t->id, collect());

                return [
                    'slug'        => $t->slug,
                    'level'       => $t->level,
                    'title_ar'    => $t->title_ar,
                    'after_week'  => $t->after_week,
                    'minutes'     => $t->minutes,
                    'items'       => count($t->items()),
                    'available'   => $this->available($user, $t),
                    'passed'      => $mine->contains('passed', true),
                    'best'        => $mine->max(fn ($a) => $a->percent()),
                    'last_id'     => $mine->first()?->id,
                    'retry_at'    => $this->retryAt($user, $t)?->toIso8601String(),
                ];
            }),
            'current_week' => $user->enrollment?->current_week ?? 1,
        ]);
    }

    /** Start a sitting, or resume the one still open */
    public function start(Request $request, LevelTest $test): RedirectResponse
    {
        $user = $request->user();

        abort_unless($this->available($user, $test), 403);

        $open = LevelTestAttempt::where('user_id', $user->id)
            ->where('level_test_id', $test->id)
            ->whereNull('submitted_at')
            ->latest('id')
            ->first();

        if ($open && $open->isOpen()) {
            return redirect()->route('tests.attempt', $open);
        }

        // A sitting left to expire is graded on what it saved, then a new one may start
        if ($open) {
            $this->grade($open);
        }

        abort_if($this->retryAt($user, $test), 429);

        $attempt = LevelTestAttempt::create([
            'user_id'       => $user->id,
            'level_test_id' => $test->id,
            'started_at'    => now(),
            'deadline_at'   => now()->addMinutes($test->minutes),
            'answers'       => [],
        ]);

        return redirect()->route('tests.attempt', $attempt);
    }

    public function show(Request $request, LevelTestAttempt $attempt): Response
    {
        abort_unless($attempt->user_id === $request->user()->id, 404);

        // The clock ran out while they were away: grade what was saved
        if (! $attempt->submitted_at && ! $attempt->isOpen()) {
            $this->grade($attempt);
        }

        $test = $attempt->test;

        if ($attempt->submitted_at) {
            return Inertia::render('Tests/Result', ['result' => $this->result($attempt)]);
        }

        return Inertia::render('Tests/Take', [
            'attempt' => [
                'id'          => $attempt->id,
                'answers'     => (object) ($attempt->answers ?? []),
                'focus_lost'  => $attempt->focus_lost,
                // Seconds left by the server's clock, so a wrong phone clock changes nothing
                // Carbon 3 returns a float here; the clock needs whole seconds
                'seconds_left' => max(0, (int) floor(now()->diffInSeconds($attempt->deadline_at, false))),
            ],
            'test' => $test->toClientArray(),
        ]);
    }

    /** Autosave — a reload or a dropped connection loses nothing */
    public function save(Request $request, LevelTestAttempt $attempt): JsonResponse
    {
        $this->ownOpen($request, $attempt);

        $data = $request->validate(['answers' => ['present', 'array']]);

        $attempt->update(['answers' => $this->clean($attempt, $data['answers'])]);

        return response()->json(['ok' => true]);
    }

    /** The page lost focus — counted, never punished */
    public function focus(Request $request, LevelTestAttempt $attempt): JsonResponse
    {
        $this->ownOpen($request, $attempt);

        $attempt->increment('focus_lost');

        return response()->json(['focus_lost' => $attempt->focus_lost]);
    }

    public function submit(Request $request, LevelTestAttempt $attempt): RedirectResponse
    {
        abort_unless($attempt->user_id === $request->user()->id, 404);

        if (! $attempt->submitted_at) {
            // Answers sent after the deadline are ignored; the last autosave stands
            if ($attempt->isOpen()) {
                $data = $request->validate(['answers' => ['present', 'array']]);
                $attempt->answers = $this->clean($attempt, $data['answers']);
            }

            $this->grade($attempt);
        }

        return redirect()->route('tests.attempt', $attempt);
    }

    /* ───────────── Rules ───────────── */

    /** Open once the learner has reached the review week it gates — or already passed it */
    protected function available(User $user, LevelTest $test): bool
    {
        if ($user->is_admin || $this->progress->locksBypassed()) {
            return true;
        }

        return ($user->enrollment?->current_week ?? 1) >= $test->after_week
            || $user->enrollment?->completed_at !== null;
    }

    /** When a failed test may be sat again, or null if it may now */
    protected function retryAt(User $user, LevelTest $test)
    {
        $last = LevelTestAttempt::where('user_id', $user->id)
            ->where('level_test_id', $test->id)
            ->whereNotNull('submitted_at')
            ->latest('id')
            ->first();

        if (! $last || $last->passed || $user->is_admin) {
            return null;
        }

        $at = $last->submitted_at->copy()->addHours(self::RETRY_HOURS);

        return $at->isFuture() ? $at : null;
    }

    protected function ownOpen(Request $request, LevelTestAttempt $attempt): void
    {
        abort_unless($attempt->user_id === $request->user()->id, 404);
        abort_unless($attempt->isOpen(), 409);
    }

    /** Keep only answers to items in this test — nothing else is stored */
    protected function clean(LevelTestAttempt $attempt, array $answers): array
    {
        return array_intersect_key($answers, $attempt->test->items());
    }

    /**
     * Grade on the server with the exercises' own checker, so a level
     * test is as tolerant as a lesson: case, spaces, final
     * punctuation, apostrophe styles (§6.3).
     */
    protected function grade(LevelTestAttempt $attempt): void
    {
        $test = $attempt->test;
        $answers = $attempt->answers ?? [];
        $sections = [];
        $score = 0;
        $max = 0;

        foreach ($test->items() as $id => $item) {
            $points = $item['points'] ?? 1;
            $key = $item['section'];
            $sections[$key] ??= ['score' => 0, 'max' => 0, 'wrong' => []];
            $sections[$key]['max'] += $points;
            $max += $points;

            $given = $answers[$id] ?? null;
            $checker = new Exercise(['type' => $item['type'], 'answer' => $item['answer']]);
            $right = $given !== null && $given !== '' && $checker->check($given);

            if ($right) {
                $sections[$key]['score'] += $points;
                $score += $points;
            } else {
                $sections[$key]['wrong'][] = $id;
            }
        }

        $passed = $max > 0 && $score * 100 >= $test->pass_percent * $max;

        $attempt->update([
            'submitted_at' => now(),
            'score'        => $score,
            'max'          => $max,
            'sections'     => $sections,
            'passed'       => $passed,
        ]);

        // The only door to the next module (§4.6)
        if ($passed && $test->after_week > 0) {
            $this->progress->recordTestScore($attempt->user, $test->after_week, $score, $max);
        }
    }

    /** Everything the result page shows, answers included — the test is over */
    protected function result(LevelTestAttempt $attempt): array
    {
        $test = $attempt->test;
        $items = $test->items();
        $answers = $attempt->answers ?? [];
        $percent = $attempt->percent();

        $sections = collect($attempt->sections ?? [])->map(function ($s, $key) use ($test, $items, $answers) {
            $meta = $test->section($key);

            return [
                'key'      => $key,
                'title_ar' => $meta['title_ar'] ?? $key,
                'score'    => $s['score'],
                'max'      => $s['max'],
                'percent'  => $s['max'] ? (int) round($s['score'] * 100 / $s['max']) : 0,
                'advice_ar' => $meta['advice_ar'] ?? [],
                // What they got wrong, with the right answer — the test is over, nothing to protect
                'mistakes' => collect($s['wrong'])->map(fn ($id) => [
                    'prompt'  => $this->describe($items[$id]),
                    'given'   => isset($answers[$id]) && $answers[$id] !== '' ? $this->asText($items[$id], $answers[$id]) : null,
                    'correct' => $this->asText($items[$id], null),
                ])->values(),
            ];
        })->values();

        $weakest = $sections->sortBy('percent')->first();

        return [
            'id'         => $attempt->id,
            'test'       => ['slug' => $test->slug, 'level' => $test->level, 'title_ar' => $test->title_ar, 'after_week' => $test->after_week],
            'score'      => $attempt->score,
            'max'        => $attempt->max,
            'percent'    => $percent,
            'passed'     => $attempt->passed,
            'band'       => $this->band($percent),
            'pass_percent' => $test->pass_percent,
            // An expired sitting is graded when next opened, maybe days later — the time used ends at the deadline
            'minutes_used' => (int) ceil($attempt->started_at->diffInSeconds($attempt->submitted_at->min($attempt->deadline_at)) / 60),
            'focus_lost' => $attempt->focus_lost,
            'sections'   => $sections,
            'weakest'    => $weakest && $weakest['percent'] < 100 ? $weakest['key'] : null,
            'retry_hours' => self::RETRY_HOURS,
            'placement'  => $test->after_week === 0,
            'estimate'   => $test->after_week === 0 ? $this->estimate($items, $answers) : null,
        ];
    }

    /**
     * The placement test's verdict: the highest band answered at 60%
     * or better, climbing only while every band below it also held —
     * one lucky B1 item does not make a B1 learner.
     */
    protected function estimate(array $items, array $answers): string
    {
        $bands = [];

        foreach ($items as $id => $item) {
            $b = $item['band'] ?? 'A1';
            $bands[$b] ??= [0, 0];
            $bands[$b][1]++;

            $given = $answers[$id] ?? null;
            $checker = new Exercise(['type' => $item['type'], 'answer' => $item['answer']]);

            if ($given !== null && $given !== '' && $checker->check($given)) {
                $bands[$b][0]++;
            }
        }

        $reached = 'Pre-A1';

        foreach (['A1', 'A2', 'B1'] as $b) {
            [$right, $total] = $bands[$b] ?? [0, 0];

            if (! $total || $right * 100 < 60 * $total) {
                break;
            }

            $reached = $b;
        }

        return $reached;
    }

    /** Cambridge-style result bands */
    protected function band(int $percent): string
    {
        return match (true) {
            $percent >= 85 => 'distinction',
            $percent >= 75 => 'merit',
            $percent >= 60 => 'pass',
            default        => 'below',
        };
    }

    protected function describe(array $item): string
    {
        $p = $item['payload'] ?? [];

        return match ($item['type']) {
            'fill_blank'    => trim(($p['before'] ?? '').' ___ '.($p['after'] ?? '')),
            'correct_error' => $p['sentence'] ?? $item['prompt'],
            'order_words'   => implode(' / ', $p['words'] ?? []),
            default         => $item['prompt'] ?? '',
        };
    }

    /** An answer as text; null `$given` means the right one */
    protected function asText(array $item, mixed $given): ?string
    {
        $a = $item['answer'];
        $p = $item['payload'] ?? [];

        return match ($item['type']) {
            'multiple_choice' => $p['options'][(int) ($given ?? $a['correct'])] ?? null,
            'true_false'      => filter_var($given ?? $a['correct'], FILTER_VALIDATE_BOOLEAN) ? 'True' : 'False',
            'order_words'     => implode(' ', (array) ($given ?? $a['order'])),
            default           => (string) ($given ?? ($a['accepted'][0] ?? '')),
        };
    }
}
