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

    /**
     * أرقام المهامّ كما هي في الخطة **الآن**.
     *
     * `tasks_done` يحتفظ بمفاتيح مهامّ حُذفت من الخطة لاحقاً. فالعدّ
     * عليها يعطي «خمسة من أربعة» — نسبةً تتجاوز المئة، ويوماً لا
     * يكتمل أبداً. والخطة هي المرجع لا السجلّ.
     */
    protected function currentOrders(): array
    {
        $day = $this->week
            ? Day::where('week_id', $this->week_id)->where('number', $this->day_number)->first()
            : null;

        return $day
            ? collect($day->tasks)->pluck('order')->map(fn ($o) => (string) $o)->all()
            : array_keys($this->tasks_done ?? []);
    }

    /** عدد المهام المنجزة — من المهامّ الموجودة */
    public function doneCount(): int
    {
        $done = $this->tasks_done ?? [];

        return count(array_filter($this->currentOrders(), fn ($o) => ($done[$o] ?? false) === true));
    }

    /** هل أُنجزت مهامّ اليوم كلها؟ */
    public function isComplete(): bool
    {
        $orders = $this->currentOrders();
        $done = $this->tasks_done ?? [];

        return count($orders) > 0
            && collect($orders)->every(fn ($o) => ($done[$o] ?? false) === true);
    }

    /** نسبة إتمام اليوم — لشريط التقدّم */
    public function percent(): int
    {
        $total = count($this->currentOrders());

        return $total === 0 ? 0 : (int) round($this->doneCount() / $total * 100);
    }
}
