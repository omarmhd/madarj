<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * مدّة وصول — مدفوعة أو ممنوحة.
 */
class Subscription extends Model
{
    protected $fillable = [
        'user_id', 'plan_id', 'starts_on', 'ends_on',
        'is_free', 'paid', 'currency', 'note', 'created_by',
    ];

    protected $casts = [
        'starts_on' => 'date',
        'ends_on'   => 'date',
        'is_free'   => 'boolean',
        'paid'      => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * السارية اليوم.
     *
     * الحدّان داخلان: من اشترى اليوم يدخل اليوم، ومن تنتهي مدّته
     * اليوم يُكملها. والتاريخ لا الوقت — فلا يُقطع على أحدٍ نصفُ يوم
     * لأنّ الساعة تجاوزت منتصف الليل في منطقةٍ أخرى.
     *
     * ── ولماذا `whereDate` لا مقارنة مباشرة ───────────────
     * العمود `date`، لكنّ SQLite يكتب ما يُعطى: `2026-09-11 00:00:00`.
     * ومقارنة ذلك نصّيّاً بـ`2026-09-11` تفشل — الأطول أكبر — فكان
     * الاشتراك الذي يبدأ **اليوم** لا يُفعّل، ويعمل ما بدأ أمس.
     *
     * وأخبث ما فيه أنّه لا يظهر في Postgres: هناك العمود تاريخٌ
     * حقيقيّ فالمقارنة تصحّ. أي يعمل في الإنتاج ويفشل في التطوير —
     * وهذا يُنتج «عندي يعمل» في الاتجاه المعاكس. و`whereDate` يستخرج
     * التاريخ في المحرّكين معاً.
     */
    public function scopeActive(Builder $query, ?string $on = null): Builder
    {
        $day = $on ?? now()->toDateString();

        return $query->whereDate('starts_on', '<=', $day)
            ->whereDate('ends_on', '>=', $day);
    }
}
