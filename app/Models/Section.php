<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * قسم شرح في أسبوع — قواعد أو نطق أو عبارات أو استماع أو قراءة
 * أو اختبار ذاتي.
 *
 * `payload` يختلف شكله بحسب `kind`، وهذا مقصود: القاسم المشترك
 * بين الأقسام هو موضعها في المنهج لا بنية محتواها.
 */
class Section extends Model
{
    public const KIND_GRAMMAR = 'grammar';
    public const KIND_PHONICS = 'phonics';
    public const KIND_PHRASES = 'phrases';
    public const KIND_LISTENING = 'listening';
    public const KIND_READING = 'reading';
    public const KIND_SELFCHECK = 'selfcheck';
    public const KIND_SPEAKING = 'speaking';
    public const KIND_SITUATIONS = 'situations';

    protected $fillable = [
        'week_id', 'kind', 'day_number', 'title_ar', 'title_en',
        'payload', 'position',
    ];

    protected $casts = [
        'payload'    => 'array',
        'day_number' => 'integer',
        'position'   => 'integer',
    ];

    public function week(): BelongsTo
    {
        return $this->belongsTo(Week::class);
    }

    public function scopeOfKind(Builder $query, string $kind): Builder
    {
        return $query->where('kind', $kind);
    }

    /** الشكل الذي يصل الواجهة */
    public function toClientArray(): array
    {
        return [
            'id'       => $this->id,
            'kind'     => $this->kind,
            'title_ar' => $this->title_ar,
            'title_en' => $this->title_en,
            'payload'  => $this->payload,
        ];
    }
}
