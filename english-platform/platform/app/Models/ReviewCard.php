<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * بطاقة تكرار متباعد — خوارزمية FSRS.
 *
 * الحسابات نفسها تجري في المتصفح عبر مكتبة ts-fsrs،
 * والخادم يحفظ النتيجة فقط. السبب: توفير حمل الخادم،
 * ولأن المستخدم قد يراجع بلا إنترنت ثم يزامن.
 */
class ReviewCard extends Model
{
    protected $fillable = [
        'user_id', 'vocabulary_id', 'due_at', 'stability', 'difficulty',
        'reps', 'lapses', 'state', 'last_reviewed_at',
    ];

    protected $casts = [
        'due_at'           => 'datetime',
        'last_reviewed_at' => 'datetime',
        'stability'        => 'float',
        'difficulty'       => 'float',
        'reps'             => 'integer',
        'lapses'           => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function vocabulary(): BelongsTo
    {
        return $this->belongsTo(Vocabulary::class);
    }

    /** البطاقات المستحقة الآن — الاستعلام الأشيع في النظام */
    public function scopeDue(Builder $query): Builder
    {
        return $query->where('due_at', '<=', now());
    }

    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    /** البطاقات الجديدة التي لم تُراجع بعد */
    public function scopeNew(Builder $query): Builder
    {
        return $query->where('state', 'new');
    }
}
