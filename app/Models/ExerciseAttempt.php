<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExerciseAttempt extends Model
{
    protected $fillable = [
        'user_id', 'exercise_id', 'response', 'is_correct', 'attempt_no',
    ];

    protected $casts = [
        'response'   => 'array',
        'is_correct' => 'boolean',
        'attempt_no' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function exercise(): BelongsTo
    {
        return $this->belongsTo(Exercise::class);
    }
}
