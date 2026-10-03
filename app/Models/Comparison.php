<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ما قاسه المتدرّب وكتبه في المقارنة الكبرى.
 *
 * الكتاب يأمر بحفظ الصفحة، وقيمة التمرين في العودة إليها بعد ستة
 * أسابيع. فلا تقييم آلي هنا ولا درجة: الأرقام أرقامه، والجمل جمله.
 */
class Comparison extends Model
{
    protected $fillable = [
        'user_id', 'week_id', 'measures', 'sentences', 'completed_at',
    ];

    protected $casts = [
        'measures'     => 'array',
        'sentences'    => 'array',
        'completed_at' => 'datetime',
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
     * هل أُنجزت؟
     *
     * لا تُقاس بالامتلاء: الكتاب يطلب خمسة مقاييس وجملاً، ومن قاس
     * ثلاثة وكتب جملة قد أنجز التمرين — والعشرون دقيقة كانت في
     * السماع لا في تعبئة الحقول. فالمعيار أن يكون فيها شيء.
     */
    public function hasContent(): bool
    {
        $filled = collect($this->measures ?? [])
            ->flatMap(fn ($row) => array_values((array) $row))
            ->filter(fn ($v) => $v !== null && $v !== '')
            ->count();

        $written = collect($this->sentences ?? [])
            ->filter(fn ($v) => is_string($v) && trim($v) !== '')
            ->count();

        return $filled > 0 || $written > 0;
    }
}
