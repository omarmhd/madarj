<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * الأسبوع — الوحدة الرئيسية للمحتوى.
 *
 * ملاحظة مهمة: نستخدم `number` لا `id` في الروابط.
 * لذلك getRouteKeyName ترجع number ليعمل /week/3 تلقائياً.
 */
class Week extends Model
{
    protected $fillable = [
        'number', 'module', 'title_en', 'title_ar',
        'objectives', 'pron_section', 'is_review',
    ];

    protected $casts = [
        'objectives'   => 'array',
        'is_review'    => 'boolean',
        'module'       => 'integer',
        'number'       => 'integer',
        'pron_section' => 'integer',
    ];

    /** الروابط تستخدم رقم الأسبوع: /week/3 */
    public function getRouteKeyName(): string
    {
        return 'number';
    }

    public function days(): HasMany
    {
        return $this->hasMany(Day::class)->orderBy('number');
    }

    public function vocabulary(): HasMany
    {
        return $this->hasMany(Vocabulary::class)->orderBy('position');
    }

    public function dialogues(): HasMany
    {
        return $this->hasMany(Dialogue::class)->orderBy('number');
    }

    public function exercises(): HasMany
    {
        return $this->hasMany(Exercise::class)->orderBy('position');
    }

    public function minimalPairs(): HasMany
    {
        return $this->hasMany(MinimalPair::class)->orderBy('position');
    }

    /**
     * المفردات مجمّعة حسب المجموعة — للعرض في جداول منفصلة.
     * ['family' => Collection, 'numbers' => Collection, ...]
     */
    public function vocabularyByGroup()
    {
        return $this->vocabulary->groupBy('group');
    }

    /** أزواج التمييز الصوتي مجمّعة — لعرضها كمجموعات في اللعبة */
    public function pairsByGroup()
    {
        return $this->minimalPairs->groupBy('group_label');
    }
}
