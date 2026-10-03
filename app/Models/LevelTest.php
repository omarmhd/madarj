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

    /** The section's study advice, for the diagnosis */
    public function section(string $key): ?array
    {
        return collect($this->body['sections'])->firstWhere('key', $key);
    }

    /**
     * The test as the browser may see it: no answers, and the word
     * tiles reshuffled so their order in the file is not a hint.
     */
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
                'audio'           => $p['audio'] ?? null,
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
        ];
    }
}
