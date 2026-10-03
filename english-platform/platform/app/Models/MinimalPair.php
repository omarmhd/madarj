<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * زوج تمييز صوتي — يغذّي لعبة الاستماع.
 *
 * اللعبة تنطق إحدى الكلمتين عبر Web Speech API في المتصفح،
 * فلا نحتاج تخزين أي ملف صوتي.
 */
class MinimalPair extends Model
{
    protected $fillable = [
        'week_id', 'group_label', 'ipa', 'word_a', 'word_b', 'position',
    ];

    public function week(): BelongsTo
    {
        return $this->belongsTo(Week::class);
    }

    /** الكلمتان كمصفوفة — تسهّل العشوائية في الواجهة */
    public function getWordsAttribute(): array
    {
        return [$this->word_a, $this->word_b];
    }
}
