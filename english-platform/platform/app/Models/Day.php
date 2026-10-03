<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * يوم واحد من خطة الأسبوع — بمهامه الخمس.
 */
class Day extends Model
{
    protected $fillable = ['week_id', 'number', 'focus', 'tasks'];

    protected $casts = [
        'tasks'  => 'array',
        'number' => 'integer',
    ];

    public function week(): BelongsTo
    {
        return $this->belongsTo(Week::class);
    }

    /** مجموع دقائق اليوم — لعرضه في بطاقة اليوم */
    public function totalMinutes(): int
    {
        return collect($this->tasks)->sum('minutes');
    }

    /**
     * دقائق المسار B — ضعف المسار A.
     * قاعدة الكتاب: نفس المهام بوقت مضاعف.
     */
    public function totalMinutesTrackB(): int
    {
        return $this->totalMinutes() * 2;
    }
}
