<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A level test — content family, written by `level-tests:import`.
 *
 * `body` carries the answers, so it is hidden: the browser only ever
 * sees `toClientArray()` (§4.4).
 */
class LevelTest extends Model
{
    public const ALLOWED_TYPES = ['multiple_choice', 'true_false', 'fill_blank', 'correct_error', 'order_words'];

    protected $fillable = ['slug', 'level', 'after_week', 'title_ar', 'title_en', 'minutes', 'pass_percent', 'body'];

    protected $hidden = ['body'];

    protected $casts = [
        'body'         => 'array',
        'after_week'   => 'integer',
        'minutes'      => 'integer',
        'pass_percent' => 'integer',
    ];

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(LevelTestAttempt::class);
    }

    /** Every item, flattened and keyed by id, with its section — what grading walks */
    public function items(): array
    {
        $out = [];

        foreach ($this->body['sections'] as $section) {
            foreach ($section['parts'] as $part) {
                foreach ($part['items'] as $item) {
                    $out[$item['id']] = $item + ['section' => $section['key']];
                }
            }
        }

        return $out;
    }

    public function maxScore(): int
    {
        return array_sum(array_map(fn ($i) => $i['points'] ?? 1, $this->items()));
    }

    /**
     * The least every section must score, as a percent. A total alone
     * lets grammar and vocabulary carry a learner who cannot follow a
     * word of the listening — and the certificate would say otherwise.
     */
    public function sectionMin(): int
    {
        return (int) ($this->body['section_min_percent'] ?? 0);
    }

    /**
     * A week note the test waits for, e.g. ['week' => 6, 'kind' => 'conversation']:
     * speaking is not machine-graded, so the test asks for proof it happened.
     */
    public function requiredNote(): ?array
    {
        $r = $this->body['requires'] ?? null;

        return is_array($r) && isset($r['week'], $r['kind']) ? $r : null;
    }

    /**
     * The free-writing task, if the test has one. Not machine-graded:
     * the learner rates it against the rubric after submitting, and the
     * rating never counts toward the score or the pass.
     */
    public function freeWriting(): ?array
    {
        $w = $this->body['free_writing'] ?? null;

        return is_array($w) ? $w : null;
    }

    /** Words in a text, counted the same way as the page counts them */
    public static function wordCount(string $text): int
    {
        return count(preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY));
    }

    /** The section's study advice, for the diagnosis */
    public function section(string $key): ?array
    {
        return collect($this->body['sections'])->firstWhere('key', $key);
    }

    /**
     * The test as the browser may see it: no answers, and the word
     * tiles reshuffled so their order in the file is not a hint.
     */
    /** The voices the listening was generated with — part of each file's name (scripts/narrate-tests.py) */
    public const VOICE_SET = 'gb-jenny-alan';

    /**
     * The recorded listening for a part, if generated: the same name the
     * script gave it, from the voices and the lines. Changing a dialogue
     * changes the name, so a stale file is never played for new text.
     */
    public static function audioFor(?array $audio): ?string
    {
        if (! $audio) {
            return null;
        }
        $text = self::VOICE_SET."\n".implode("\n", array_map(fn ($l) => $l['g'].':'.$l['text'], $audio));
        $name = substr(sha1($text), 0, 16).'.mp3';

        return is_file(public_path('audio/tests/'.$name)) ? '/audio/tests/'.$name : null;
    }

    public function toClientArray(): array
    {
        $sections = array_map(fn ($s) => [
            'key'             => $s['key'],
            'title_ar'        => $s['title_ar'],
            'title_en'        => $s['title_en'],
            'instructions_ar' => $s['instructions_ar'] ?? null,
            'parts'           => array_map(fn ($p) => [
                'instructions_ar' => $p['instructions_ar'] ?? null,
                'passage'         => $p['passage'] ?? null,
                // A recording when there is one — and then the script stays here:
                // the text in the page could be read instead of listened to.
                // Without one, the lines go to the browser to speak, as before.
                'audio_url'       => self::audioFor($p['audio'] ?? null),
                'audio'           => self::audioFor($p['audio'] ?? null) ? null : ($p['audio'] ?? null),
                'items'           => array_map(function ($i) {
                    $payload = $i['payload'] ?? [];

                    if ($i['type'] === 'order_words') {
                        shuffle($payload['words']);
                    }

                    return [
                        'id'      => $i['id'],
                        'type'    => $i['type'],
                        'prompt'  => $i['prompt'] ?? '',
                        'payload' => (object) $payload,
                    ];
                }, $p['items']),
            ], $s['parts']),
        ], $this->body['sections']);

        return [
            'slug'         => $this->slug,
            'level'        => $this->level,
            'title_ar'     => $this->title_ar,
            'title_en'     => $this->title_en,
            'minutes'      => $this->minutes,
            'pass_percent' => $this->pass_percent,
            'tips_ar'      => $this->body['tips_ar'] ?? [],
            'sections'     => $sections,
            // The task only: the model answer and the rubric wait for the result
            'free_writing' => ($w = $this->freeWriting()) ? array_intersect_key($w, array_flip(
                ['title_ar', 'instructions_ar', 'task_en', 'task_ar', 'points', 'min_words', 'max_words'],
            )) : null,
        ];
    }
}
