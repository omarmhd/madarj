<?php

namespace App\Console\Commands;

use App\Models\LevelTest;
use Illuminate\Console\Command;

/**
 * Import the level tests from `content/level-tests/*.json`.
 *
 * Refuses rather than guesses, like `stories:import`: a test that is
 * half imported is sat as if it were whole, and a wrong answer key is
 * a learner held back for nothing. So every item is checked against
 * the shape its type needs before anything is written.
 *
 * Item ids are assigned here (`grammar-2-3`), not authored, so the
 * file stays easy to edit and an id can never be duplicated.
 */
class ImportLevelTests extends Command
{
    protected $signature = 'level-tests:import';

    protected $description = 'Import the level tests from content/level-tests/*.json';

    /** File name → URL slug; the level "A2+" cannot be a slug as is */
    protected function slugFor(string $level): string
    {
        return strtolower(str_replace('+', 'plus', $level));
    }

    public function handle(): int
    {
        $files = glob(base_path('content/level-tests/*.json'));
        sort($files);

        if (! $files) {
            $this->error('No files in content/level-tests/');

            return self::FAILURE;
        }

        foreach ($files as $file) {
            $name = basename($file);
            $data = json_decode(file_get_contents($file), true);

            if (! is_array($data)) {
                $this->error("$name: invalid JSON");

                return self::FAILURE;
            }

            /*
             * Names the owner asked never to appear in content. Checked
             * on the raw file, without word boundaries: in JSON a name
             * after a line break is stored as `\nSara`, which `\bSara`
             * misses — that is how one slipped through once. «عمر» is
             * not listed because it also means "age".
             */
            if (preg_match('/omar|sarah?|سارة|ساره/iu', file_get_contents($file), $m)) {
                $this->error("$name: banned name «{$m[0]}» — use a neutral name");

                return self::FAILURE;
            }

            foreach (['level', 'after_week', 'title_ar', 'title_en', 'minutes', 'sections'] as $key) {
                // after_week 0 is the placement test, so test presence, not truth
                if (! isset($data[$key]) || $data[$key] === '' || $data[$key] === []) {
                    $this->error("$name: missing $key");

                    return self::FAILURE;
                }
            }

            $count = 0;

            foreach ($data['sections'] as $s => &$section) {
                // No `?? []` here: it would iterate a copy and the ids would never be written
                $section['parts'] ??= [];
                foreach ($section['parts'] as $p => &$part) {
                    $part['items'] ??= [];
                    foreach ($part['items'] as $i => &$item) {
                        $where = "$name {$section['key']} part ".($p + 1).' item '.($i + 1);

                        if ($error = $this->invalid($item)) {
                            $this->error("$where: $error");

                            return self::FAILURE;
                        }

                        $item['id'] = $section['key'].'-'.($p + 1).'-'.($i + 1);
                        $item['points'] = $item['points'] ?? 1;
                        $count++;
                    }
                }
            }
            unset($section, $part, $item);

            LevelTest::updateOrCreate(
                ['slug' => $this->slugFor($data['level'])],
                [
                    'level'        => $data['level'],
                    'after_week'   => $data['after_week'],
                    'title_ar'     => $data['title_ar'],
                    'title_en'     => $data['title_en'],
                    'minutes'      => $data['minutes'],
                    'pass_percent' => $data['pass_percent'] ?? 60,
                    'body'         => [
                        'modeled_on' => $data['modeled_on'] ?? null,
                        'tips_ar'    => $data['tips_ar'] ?? [],
                        'sections'   => $data['sections'],
                    ],
                ],
            );

            $this->info("$name: {$data['level']} — $count items, {$data['minutes']} min");
        }

        return self::SUCCESS;
    }

    /** Why an item cannot be graded, or null */
    protected function invalid(array $item): ?string
    {
        $type = $item['type'] ?? null;
        $payload = $item['payload'] ?? [];
        $answer = $item['answer'] ?? [];

        if (! in_array($type, LevelTest::ALLOWED_TYPES, true)) {
            return "type '$type' not allowed";
        }

        return match ($type) {
            'multiple_choice' => (! isset($answer['correct']) || ! isset($payload['options'][$answer['correct']]))
                ? 'correct index out of range' : null,
            'true_false'      => ! is_bool($answer['correct'] ?? null) ? 'answer.correct must be boolean' : null,
            'fill_blank', 'correct_error' => empty($answer['accepted']) ? 'no accepted answers' : null,
            'order_words'     => (function () use ($payload, $answer) {
                $a = $payload['words'] ?? [];
                $b = $answer['order'] ?? [];
                sort($a);
                sort($b);

                return ($a && $a === $b) ? null : 'words and order differ';
            })(),
        };
    }
}
