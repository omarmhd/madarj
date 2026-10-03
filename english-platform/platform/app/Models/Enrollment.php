<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * تسجيل المستخدم في الدورة.
 *
 * هذا النموذج يجيب على سؤالين مهمين:
 *   1. أين هو الآن؟            (current_week / current_day)
 *   2. أين يجب أن يكون؟        (expectedDay)
 * والفرق بينهما هو "التأخّر" الذي تعرضه لوحة التقدّم.
 */
class Enrollment extends Model
{
    protected $fillable = [
        'user_id', 'track', 'started_on', 'current_week',
        'current_day', 'timezone', 'completed_at',
    ];

    protected $casts = [
        'started_on'   => 'date',
        'completed_at' => 'datetime',
        'current_week' => 'integer',
        'current_day'  => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** تاريخ اليوم بتوقيت المستخدم لا الخادم */
    public function today(): Carbon
    {
        return Carbon::now($this->timezone)->startOfDay();
    }

    /** عدد الأيام منذ البدء */
    public function daysSinceStart(): int
    {
        return (int) $this->started_on->diffInDays($this->today());
    }

    /**
     * اليوم الذي يجب أن يكون فيه لو التزم تماماً.
     * الأسبوع 1 اليوم 1 = يوم البدء نفسه.
     */
    public function expectedPosition(): array
    {
        $n = $this->daysSinceStart();          // 0-based
        $week = intdiv($n, 7) + 1;
        $day  = ($n % 7) + 1;

        return [
            'week' => min($week, 24),
            'day'  => $day,
        ];
    }

    /**
     * كم يوماً متأخر عن الجدول؟
     * موجب = متأخر · سالب = متقدّم · صفر = في الموعد
     */
    public function daysBehind(): int
    {
        $expected = $this->expectedPosition();
        $expectedAbs = ($expected['week'] - 1) * 7 + $expected['day'];
        $actualAbs   = ($this->current_week - 1) * 7 + $this->current_day;

        return $expectedAbs - $actualAbs;
    }

    /** رقم اليوم المطلق من بداية الدورة: 1..168 */
    public function absoluteDay(): int
    {
        return ($this->current_week - 1) * 7 + $this->current_day;
    }

    /** نسبة إتمام الدورة كلها */
    public function progressPercent(): float
    {
        return round(($this->absoluteDay() - 1) / 168 * 100, 1);
    }
}
