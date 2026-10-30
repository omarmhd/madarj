<?php

namespace Tests\Unit;

use App\Models\Exercise;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Text answers: what counts as the same answer.
 *
 * Contractions and the " / " between blanks are spelling, not English —
 * a learner who writes "have not finished" for "haven't finished" knows
 * the grammar, and was being told otherwise.
 */
class ExerciseCheckTest extends TestCase
{
    public static function answers(): array
    {
        return [
            'full form for a contraction'  => [["haven't finished"], 'have not finished', true],
            'contraction for a full form'  => [['have not finished'], "haven't finished", true],
            'blanks without spaces'        => [['Have / eaten'], 'have/eaten', true],
            "a blank that starts with 'll" => [['rains / will stay'], "rains / 'll stay", true],
            "'s as has"                    => [['She has gone'], "She's gone.", true],
            "'s as is"                     => [['She is a doctor'], "She's a doctor", true],
            "'d as would"                  => [['I would go'], "I'd go", true],
            "won't"                        => [["I won't go"], 'I will not go', true],
            "can't as cannot"              => [["I can't swim"], 'I cannot swim', true],
            "can't as can not"             => [["I can't swim"], 'I can not swim', true],
            'possessive stays'             => [["Ahmed's car is red"], "Ahmed's car is red", true],
            'another word'                 => [['gone'], 'been', false],
            'the missing -s'               => [['He works here'], 'He work here', false],
            'the other tense'              => [['I have seen it'], 'I saw it', false],
        ];
    }

    #[DataProvider('answers')]
    public function test_text_answers(array $accepted, string $given, bool $expected): void
    {
        $exercise = new Exercise(['type' => 'fill_blank', 'answer' => ['accepted' => $accepted]]);

        $this->assertSame($expected, $exercise->check($given));
    }
}
