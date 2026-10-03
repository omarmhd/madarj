<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * حركة واحدة من حركات المتدرّب.
 *
 * لا يُنشأ صفّاً صفّاً: المتحكّم يُدخل الدفعة كلها بـ`insert` واحد،
 * لأن ثلاثين حدثاً تعني ثلاثين رحلة إلى القاعدة لو مررنا بـEloquent.
 */
class LearningEvent extends Model
{
    use HasFactory;

    /** لا `updated_at` — السجلّ يُكتب ولا يُعدَّل أبداً */
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'week_number', 'day_number',
        'type', 'ref', 'value', 'meta', 'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'meta'        => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeForUser($q, int $userId)
    {
        return $q->where('user_id', $userId);
    }
}
