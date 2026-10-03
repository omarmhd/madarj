<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * كلمة واحدة من مفردات الأسبوع.
 *
 * اسم الجدول محدد يدوياً لأن Laravel يجمع الكلمة
 * إلى "vocabularies" وهو غير صحيح لغوياً.
 */
class Vocabulary extends Model
{
    protected $table = 'vocabulary';

    protected $fillable = [
        'week_id', 'group',
        'group_label_ar', 'group_label_en', 'word', 'ipa', 'arabic', 'example', 'position',
    ];

    public function week(): BelongsTo
    {
        return $this->belongsTo(Week::class);
    }

    /** بطاقات المراجعة المرتبطة بهذه الكلمة عبر كل المستخدمين */
    public function reviewCards(): HasMany
    {
        return $this->hasMany(ReviewCard::class);
    }

    /**
     * رابط الاستماع في قاموس كامبريدج.
     * يُبنى برمجياً — لا نخزّنه لأنه مشتق من الكلمة.
     */
    public function getCambridgeUrlAttribute(): string
    {
        $slug = str_replace(' ', '-', strtolower($this->word));

        return "https://dictionary.cambridge.org/dictionary/english/{$slug}";
    }

    /** رابط YouGlish — سماع الكلمة داخل جمل حقيقية */
    public function getYouglishUrlAttribute(): string
    {
        return 'https://youglish.com/pronounce/'.urlencode(strtolower($this->word)).'/english';
    }
}
