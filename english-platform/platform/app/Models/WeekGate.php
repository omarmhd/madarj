<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * قفل الأسبوع.
 *
 * قاعدتان:
 *   1. الأسبوع n+1 لا يُفتح إلا بإتمام أيام الأسبوع n السبعة
 *   2. أسابيع المراجعة تشترط درجة دنيا في الاختبار
 */
class WeekGate extends Model
{
    /** الدرجة الدنيا للنجاح في اختبار أسبوع المراجعة — 60% */
    public const PASS_THRESHOLD = 0.60;

    protected $fillable = [
        'user_id', 'week_id', 'unlocked_at',
        'test_score', 'test_max', 'passed_at',
    ];

    protected $casts = [
        'unlocked_at' => 'datetime',
        'passed_at'   => 'datetime',
        'test_score'  => 'integer',
        'test_max'    => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function week(): BelongsTo
    {
        return $this->belongsTo(Week::class);
    }

    public function isUnlocked(): bool
    {
        return $this->unlocked_at !== null;
    }

    /** نسبة الاختبار المئوية */
    public function scorePercent(): ?float
    {
        if (! $this->test_score || ! $this->test_max) {
            return null;
        }

        return round($this->test_score / $this->test_max * 100, 1);
    }

    /** هل اجتاز اختبار هذا الأسبوع؟ */
    public function hasPassedTest(): bool
    {
        if (! $this->test_max) {
            return true;   // أسبوع بلا اختبار
        }

        return ($this->test_score / $this->test_max) >= self::PASS_THRESHOLD;
    }
}
