<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A level's certificate — progress family, issued on a passed level test.
 */
class Certificate extends Model
{
    protected $fillable = [
        'user_id', 'level_test_id', 'level_test_attempt_id',
        'code', 'level', 'name', 'percent', 'issued_at',
    ];

    protected $casts = [
        'issued_at' => 'datetime',
        'percent'   => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function test(): BelongsTo
    {
        return $this->belongsTo(LevelTest::class, 'level_test_id');
    }

    /**
     * Issue for a passed attempt — once per learner and level.
     *
     * The placement test (after_week 0) measures where a learner starts,
     * not what they finished, so it earns nothing.
     */
    public static function issueFor(LevelTestAttempt $attempt): ?self
    {
        $test = $attempt->test;
        if (! $attempt->passed || ! $test || $test->after_week === 0) {
            return null;
        }

        return self::firstOrCreate(
            ['user_id' => $attempt->user_id, 'level_test_id' => $test->id],
            [
                'level_test_attempt_id' => $attempt->id,
                'code'      => self::newCode(),
                'level'     => $test->level,
                'name'      => (string) $attempt->user?->name,
                'percent'   => $attempt->percent(),
                'issued_at' => $attempt->submitted_at ?? now(),
            ],
        );
    }

    /** Short, unambiguous, unguessable: no 0/O, 1/I/L */
    protected static function newCode(): string
    {
        $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        do {
            $code = 'MDJ-'.collect(range(1, 8))->map(fn () => $alphabet[random_int(0, strlen($alphabet) - 1)])->implode('');
        } while (self::where('code', $code)->exists());

        return $code;
    }

    public function url(): string
    {
        return url('/certificates/'.$this->code);
    }

    /** The QR, as inline SVG, pointing at the public check */
    public function qrSvg(): string
    {
        $options = new \chillerlan\QRCode\QROptions([
            'outputType'   => 'svg',
            'outputBase64' => false,
            'addQuietzone' => true,
            'quietzoneSize' => 1,
            'svgUseFillAttributes' => true,
        ]);

        return (new \chillerlan\QRCode\QRCode($options))->render($this->url());
    }

    public function toClientArray(bool $mine = false): array
    {
        return [
            'code'      => $this->code,
            'level'     => $this->level,
            'name'      => $this->name,
            'percent'   => $this->percent,
            'issued_on' => $this->issued_at->toDateString(),
            'url'       => $this->url(),
            'mine'      => $mine,
        ];
    }
}
