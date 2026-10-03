<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * سجل تسجيل صوتي.
 *
 * الملف الصوتي نفسه ليس هنا — يبقى في IndexedDB عند المستخدم.
 * هذا الجدول يحفظ البيانات الوصفية فقط: الأسبوع، المدة، التقييم الذاتي.
 */
class Recording extends Model
{
    protected $fillable = [
        'user_id', 'week_number', 'duration_seconds',
        'self_score', 'self_score_max', 'local_ref', 'note', 'recorded_at',
    ];

    protected $casts = [
        'recorded_at'      => 'datetime',
        'week_number'      => 'integer',
        'duration_seconds' => 'integer',
        'self_score'       => 'integer',
        'self_score_max'   => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** المدة بصيغة 1:58 */
    public function getDurationLabelAttribute(): string
    {
        return sprintf('%d:%02d',
            intdiv($this->duration_seconds, 60),
            $this->duration_seconds % 60
        );
    }

    /** هل هذا أحد تسجيلات المقارنة الخمسة؟ (1، 6، 12، 18، 24) */
    public function isMilestone(): bool
    {
        return in_array($this->week_number, [1, 6, 12, 18, 24], true);
    }
}
