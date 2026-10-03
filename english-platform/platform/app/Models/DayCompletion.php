<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * إتمام يوم واحد — قلب نظام الصرامة.
 *
 * الحالات الثلاث:
 *   لا يوجد صف                      -> اليوم لم يُفتح بعد
 *   صف بـ completed_at = null       -> مفتوح، بدأه، لم يكمله
 *   صف بـ completed_at غير فارغ     -> مكتمل، واليوم التالي مفتوح
 */
class DayCompletion extends Model
{
    protected $fillable = [
        'user_id', 'week_id', 'day_number',
        'tasks_done', 'started_at', 'completed_at', 'minutes_spent',
    ];

    protected $casts = [
        'tasks_done'    => 'array',
        'started_at'    => 'datetime',
        'completed_at'  => 'datetime',
        'day_number'    => 'integer',
        'minutes_spent' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function week(): BelongsTo
    {
        return $this->belongsTo(Week::class);
    }

    /** عدد المهام المنجزة */
    public function doneCount(): int
    {
        return collect($this->tasks_done)->filter()->count();
    }

    /** هل أُنجزت كل المهام الخمس؟ */
    public function isComplete(): bool
    {
        $tasks = $this->tasks_done ?? [];

        return count($tasks) > 0
            && collect($tasks)->every(fn ($done) => $done === true);
    }

    /** نسبة إتمام اليوم — لشريط التقدّم */
    public function percent(): int
    {
        $total = count($this->tasks_done ?? []);

        return $total === 0 ? 0 : (int) round($this->doneCount() / $total * 100);
    }
}
