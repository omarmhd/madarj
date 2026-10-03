<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * كلمة في دفتر «الذاكرة».
 *
 * كلمة كتبها المتدرّب بنفسه لأنها صادفته خارج الكتاب. حالتها في
 * التكرار المتباعد تُحسب في المتصفّح وتُخزَّن هنا.
 */
class MemoryWord extends Model
{
    /** مصادر الترجمة — تُعرض للمتدرّب فيعرف ما يثق به */
    public const SOURCES = ['course', 'auto', 'manual'];

    protected $fillable = [
        'user_id', 'term', 'translation', 'source',
        'due_at', 'stability', 'difficulty', 'reps', 'lapses',
        'state', 'last_reviewed_at',
    ];

    protected $casts = [
        'due_at'           => 'datetime',
        'last_reviewed_at' => 'datetime',
        'stability'        => 'float',
        'difficulty'       => 'float',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    /** المستحقّ الآن — بطاقة حان موعدها */
    public function scopeDue(Builder $query): Builder
    {
        return $query->where('due_at', '<=', now());
    }

    /** لم تُراجَع بعد */
    public function scopeFresh(Builder $query): Builder
    {
        return $query->where('state', 'new');
    }

    /** الشكل الذي يصل الواجهة — حالة FSRS كاملة ليحسب عليها المتصفّح */
    public function toClientArray(): array
    {
        return [
            'id'          => $this->id,
            'term'        => $this->term,
            'translation' => $this->translation,
            'source'      => $this->source,
            'state'       => $this->state,
            'stability'   => $this->stability,
            'difficulty'  => $this->difficulty,
            'reps'        => $this->reps,
            'lapses'      => $this->lapses,
            'due_at'      => $this->due_at?->toIso8601String(),
            'last_reviewed_at' => $this->last_reviewed_at?->toIso8601String(),
        ];
    }
}
