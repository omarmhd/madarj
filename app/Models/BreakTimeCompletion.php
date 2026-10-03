<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * نشاط وقت استراحة أنجزه المتدرّب.
 *
 * يُحتسب ولا يُلزم: عدّاده يظهر، ولا يقفل يوماً ولا يكسر سلسلة.
 */
class BreakTimeCompletion extends Model
{
    /** الأنشطة المعروفة — تطابق مفاتيح payload في قسم الاستراحة */
    public const ITEMS = ['song', 'watch', 'story', 'channel'];

    protected $fillable = ['user_id', 'week_id', 'item_key', 'note', 'completed_at'];

    protected $casts = ['completed_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function week(): BelongsTo
    {
        return $this->belongsTo(Week::class);
    }

    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }
}
