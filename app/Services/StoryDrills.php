<?php

namespace App\Services;

use App\Models\Story;

/**
 * Two exercises made from a story's own text — no content to write.
 *
 *   order — four of its sentences, shuffled; put them in the order they
 *           happen. Comprehension: you cannot order what you did not follow.
 *   gap   — one of its sentences with a glossed word taken out; type it.
 *           The glossary's words are the story's new words, so this fixes
 *           them in the sentence they were met in.
 *
 * Both are built from a seed (learner, week, day, story), so the page and
 * the grading endpoint rebuild the same exercise without storing it. The
 * answers never reach the page: the sentences carry opaque tokens, not
 * their positions, and the missing word stays here (§4.4).
 */
class StoryDrills
{
    public const ORDER_SIZE = 4;

    public static function seed(int $userId, int $week, int $day, string $slug): int
    {
        return crc32(implode(':', ['drill', $userId, $week, $day, $slug]));
    }

    /** The order exercise, with its answer: tokens in story order */
    public static function order(Story $story, int $seed): array
    {
        $lines = collect($story->lines)->map(fn ($l, $i) => ['i' => $i, 'text' => trim($l)])
            // A sentence too short says nothing about the plot
            ->filter(fn ($l) => str_word_count($l['text']) >= 4)->values();

        $n = min(self::ORDER_SIZE, $lines->count());
        if ($n < 3) {
            return ['items' => [], 'answer' => []];
        }

        // Spread across the story, so the order is its plot, not one scene
        $picked = collect(range(0, $n - 1))
            ->map(fn ($k) => $lines[(int) round($k * ($lines->count() - 1) / ($n - 1))])
            ->unique('i')->values();

        $token = fn ($l) => substr(md5($seed.':'.$l['i']), 0, 10);
        $answer = $picked->map($token)->all();

        $shuffled = $picked->sortBy(fn ($l) => crc32($seed.'#'.$l['i']))->values();
        // Never hand it over already in order
        if ($shuffled->map($token)->all() === $answer) {
            $shuffled = $shuffled->reverse()->values();
        }

        return [
            'items'  => $shuffled->map(fn ($l) => ['token' => $token($l), 'text' => $l['text']])->all(),
            'answer' => $answer,
        ];
    }

    /** The gap exercise, with its answer: a glossed word in its own sentence */
    public static function gap(Story $story, int $seed): ?array
    {
        $lines = collect($story->lines)->values();
        $words = collect($story->words ?? [])
            ->filter(fn ($w) => ! empty($w['en']))
            ->sortBy(fn ($w) => crc32($seed.'@'.$w['en']))->values();

        foreach ($words as $w) {
            $en = trim($w['en']);
            $re = '/\b'.preg_quote($en, '/').'\b/i';
            foreach ($lines as $line) {
                if (preg_match($re, $line, $m, PREG_OFFSET_CAPTURE)) {
                    $at = $m[0][1];

                    return [
                        'before' => substr($line, 0, $at),
                        'after'  => substr($line, $at + strlen($m[0][0])),
                        'hint'   => $w['ar'] ?? null,
                        'length' => mb_strlen($m[0][0]),
                        'answer' => $m[0][0],
                    ];
                }
            }
        }

        // No glossed word in the text as written: the longest word of a middle line
        $line = $lines[(int) floor($lines->count() / 2)] ?? null;
        if (! $line || ! preg_match_all('/[A-Za-z]{5,}/', $line, $all, PREG_OFFSET_CAPTURE)) {
            return null;
        }
        $best = collect($all[0])->sortByDesc(fn ($x) => strlen($x[0]))->first();

        return [
            'before' => substr($line, 0, $best[1]),
            'after'  => substr($line, $best[1] + strlen($best[0])),
            'hint'   => null,
            'length' => strlen($best[0]),
            'answer' => $best[0],
        ];
    }

    /** Typed answers forgive case, spaces, end punctuation and apostrophe style */
    public static function same(string $typed, string $answer): bool
    {
        $norm = fn ($s) => trim(preg_replace('/\s+/', ' ', rtrim(str_replace(['’', '‘'], "'", mb_strtolower(trim($s))), '.,!?;:')));

        return $norm($typed) !== '' && $norm($typed) === $norm($answer);
    }
}
