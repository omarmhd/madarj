<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One sitting of a level test — progress family */
class LevelTestAttempt extends Model
{
    /** Seconds after the deadline a submit is still accepted — a slow phone, not extra time */
    public const GRACE_SECONDS = 90;

    protected $fillable = [
        'user_id', 'level_test_id', 'started_at', 'deadline_at', 'submitted_at',
        'answers', 'score', 'max', 'sections', 'focus_lost', 'passed',
    ];

    protected $casts = [
        'started_at'   => 'datetime',
        'deadline_at'  => 'datetime',
        'submitted_at' => 'datetime',
        'answers'      => 'array',
        'sections'     => 'array',
        'passed'       => 'boolean',
        'focus_lost'   => 'integer',
        'score'        => 'integer',
        'max'          => 'integer',
    ];

    public function test(): BelongsTo
    {
        return $this->belongsTo(LevelTest::class, 'level_test_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Still accepting answers: not submitted, and the clock (plus grace) not run out */
    public function isOpen(): bool
    {
        return $this->submitted_at === null
            && now()->lte($this->deadline_at->copy()->addSeconds(self::GRACE_SECONDS));
    }

    public function percent(): int
    {
        return $this->max ? (int) round($this->score * 100 / $this->max) : 0;
    }
}
