<?php

namespace Tests\Feature;

use App\Models\LevelTest;
use App\Models\LevelTestAttempt;
use App\Models\User;
use App\Models\Week;
use App\Models\WeekNote;
use App\Services\ProgressService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A total is not enough when the test sets a per-section minimum, and a
 * test that waits for a week note stays closed until the note exists.
 */
class LevelTestSectionMinTest extends TestCase
{
    use RefreshDatabase;

    /** Two sections: listening 2 items, grammar 8 items — grammar alone reaches 80% */
    private function makeTest(array $extra = []): LevelTest
    {
        $mc = fn (int $n) => array_map(fn ($i) => [
            'type' => 'multiple_choice', 'prompt' => "Q$i",
            'payload' => ['options' => ['a', 'b']], 'answer' => ['correct' => 0], 'points' => 1,
        ], range(1, $n));

        $sections = [];
        foreach (['listening' => 2, 'grammar' => 8] as $key => $n) {
            $items = $mc($n);
            foreach ($items as $i => &$item) {
                $item['id'] = "$key-1-".($i + 1);
            }
            $sections[] = ['key' => $key, 'title_ar' => $key, 'title_en' => $key, 'parts' => [['items' => $items]]];
        }

        return LevelTest::create([
            'slug' => 'a1', 'level' => 'A1', 'after_week' => 0 + ($extra['after_week'] ?? 6),
            'title_ar' => 'A1', 'title_en' => 'A1', 'minutes' => 30, 'pass_percent' => 60,
            'body' => ['tips_ar' => [], 'sections' => $sections] + $extra,
        ]);
    }

    /** A learner past setup, in the given week — what every lesson route expects */
    private function learner(int $week, bool $admin = false): User
    {
        Week::firstOrCreate(['number' => 1], ['module' => 1, 'title_en' => 'Week 1', 'title_ar' => 'الأسبوع 1', 'objectives' => [], 'pron_section' => 4, 'is_review' => false]);
        $user = User::factory()->create(['is_admin' => $admin]);
        app(ProgressService::class)->enroll($user, 'A', 'UTC')
            ->forceFill(['setup_done_at' => now(), 'current_week' => $week])->save();

        return $user->fresh();
    }

    /** Grammar all right, listening all wrong: 80% in total */
    private function submitGrammarOnly(User $user, LevelTest $test): LevelTestAttempt
    {
        $attempt = LevelTestAttempt::create([
            'user_id' => $user->id, 'level_test_id' => $test->id,
            'started_at' => now(), 'deadline_at' => now()->addMinutes(30),
        ]);

        $answers = ['listening-1-1' => 1, 'listening-1-2' => 1];
        foreach (range(1, 8) as $i) {
            $answers["grammar-1-$i"] = 0;
        }

        $this->actingAs($user)->post("/tests/attempt/{$attempt->id}/submit", ['answers' => $answers]);

        return $attempt->fresh();
    }

    public function test_a_section_under_the_minimum_fails_a_passing_total(): void
    {
        $attempt = $this->submitGrammarOnly($this->learner(6, true), $this->makeTest(['section_min_percent' => 40]));

        $this->assertSame(8, $attempt->score);
        $this->assertFalse($attempt->passed);
    }

    public function test_without_a_minimum_the_total_alone_decides(): void
    {
        $user = $this->learner(1, true);
        // Placement (after_week 0) never applies the minimum and needs no enrollment
        $attempt = $this->submitGrammarOnly($user, $this->makeTest(['after_week' => 0]));

        $this->assertTrue($attempt->passed);
    }

    public function test_a_required_note_keeps_the_test_closed_until_it_exists(): void
    {
        $test = $this->makeTest(['requires' => ['week' => 6, 'kind' => 'conversation']]);
        $user = $this->learner(6);

        $this->actingAs($user)->post("/tests/{$test->slug}/start")->assertForbidden();

        $week = Week::create(['number' => 6, 'module' => 1, 'title_en' => 'Review', 'title_ar' => 'مراجعة', 'objectives' => [], 'pron_section' => 4, 'is_review' => true]);
        // Choosing a plan alone is not proof
        $note = WeekNote::create(['user_id' => $user->id, 'week_id' => $week->id, 'kind' => 'conversation', 'answers' => ['plan' => '1']]);
        $this->actingAs($user)->post("/tests/{$test->slug}/start")->assertForbidden();

        $note->update(['answers' => ['plan' => '1', '1' => 'I said: My name is Hani.']]);

        $this->actingAs($user)->post("/tests/{$test->slug}/start")->assertRedirect();
    }
}
