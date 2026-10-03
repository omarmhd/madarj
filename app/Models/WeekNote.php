<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * إجابات المتدرّب على استمارة في أسبوع.
 *
 * لا تصحيح ولا درجة: الأسئلة عن نفسه — كم تكلّمت، وما أصعب
 * لحظة، ومتى درسك القادم. دور الخادم الحفظ وحده.
 */
class WeekNote extends Model
{
    /** الاستمارات المعروفة — لئلا يمتلئ الجدول بنوع مكتوب خطأً */
    public const KINDS = ['conversation'];

    protected $fillable = ['user_id', 'week_id', 'kind', 'answers'];

    protected $casts = ['answers' => 'array'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function week(): BelongsTo
    {
        return $this->belongsTo(Week::class);
    }
}
