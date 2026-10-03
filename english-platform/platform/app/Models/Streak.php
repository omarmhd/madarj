<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * السلسلة اليومية.
 *
 * قاعدة الكتاب: "يوم فائت ليس فشلاً. يومان فائتان خطر."
 * لذلك نسمح بفجوة يوم واحد (grace_days) دون كسر السلسلة.
 */
class Streak extends Model
{
    protected $fillable = [
        'user_id', 'current', 'longest', 'last_active_on', 'grace_days',
    ];

    protected $casts = [
        'last_active_on' => 'date',
        'current'        => 'integer',
        'longest'        => 'integer',
        'grace_days'     => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * تسجيل نشاط اليوم وتحديث السلسلة.
     *
     * @param  Carbon  $today  تاريخ اليوم بتوقيت المستخدم
     */
    public function recordActivity(Carbon $today): void
    {
        $today = $today->copy()->startOfDay();

        // نشاط مسجَّل اليوم بالفعل — لا شيء يتغيّر
        if ($this->last_active_on?->isSameDay($today)) {
            return;
        }

        $gap = $this->last_active_on
            ? (int) $this->last_active_on->diffInDays($today)
            : null;

        if ($gap === null) {
            // أول نشاط على الإطلاق
            $this->current = 1;
        } elseif ($gap === 1) {
            // يوم متتالٍ — السلسلة تستمر
            $this->current++;
        } elseif ($gap === 2 && $this->grace_days > 0) {
            // فجوة يوم واحد — نستهلك يوم النعمة ولا نكسر السلسلة
            $this->current++;
            $this->grace_days--;
        } else {
            // فجوة يومين فأكثر — السلسلة تنكسر وتعود النعمة
            $this->current = 1;
            $this->grace_days = 1;
        }

        $this->longest = max($this->longest, $this->current);
        $this->last_active_on = $today;
        $this->save();
    }

    /** هل السلسلة في خطر؟ (لم ينشط اليوم وأمس كان آخر نشاط) */
    public function isAtRisk(Carbon $today): bool
    {
        if (! $this->last_active_on) {
            return false;
        }

        return (int) $this->last_active_on->diffInDays($today->copy()->startOfDay()) >= 1;
    }
}
