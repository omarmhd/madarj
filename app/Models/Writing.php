<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ما كتبه المتدرّب في مهمة الكتابة الأسبوعية (§9).
 *
 * لا يُصحَّح آلياً — الكتاب يجعل الكتابة الحرّة تقييماً ذاتياً
 * بعد مقارنة النص بنموذج الإجابة.
 */
class Writing extends Model
{
    protected $fillable = [
        'user_id', 'week_id', 'body', 'word_count', 'model_seen', 'self_score',
    ];

    protected $casts = [
        'word_count' => 'integer',
        'model_seen' => 'boolean',
        'self_score' => 'integer',
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
     * عدد الكلمات في نص إنجليزي.
     *
     * نحسبه على الخادم لا في المتصفح لأنه يُخزَّن،
     * ولأن الواجهة لا يُعتمد عليها في أي رقم يُحفظ.
     */
    public static function countWords(string $body): int
    {
        $trimmed = trim(preg_replace('/\s+/u', ' ', $body));

        return $trimmed === '' ? 0 : count(explode(' ', $trimmed));
    }

    /** هل بلغ الحدّ الأدنى المطلوب؟ */
    public function meetsMinimum(int $minWords): bool
    {
        return $this->word_count >= $minWords;
    }
}
