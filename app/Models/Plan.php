<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * خطّة اشتراك — سعرٌ ومدّة يضبطهما المدير.
 */
class Plan extends Model
{
    protected $fillable = [
        'name_ar', 'months', 'price', 'currency', 'note_ar', 'is_active', 'sort',
    ];

    protected $casts = [
        'months'    => 'integer',
        'price'     => 'decimal:2',
        'is_active' => 'boolean',
        'sort'      => 'integer',
    ];

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /** ما يُعرض على العميل، بترتيب المدير */
    public function scopeOffered($query)
    {
        return $query->where('is_active', true)->orderBy('sort')->orderBy('months');
    }

    /**
     * السعر كما يُقرأ.
     *
     * العملة رمزٌ من ثلاثة أحرف في القاعدة — والعميل يقرأ اسمها،
     * والمبلغ بلا كسورٍ صفريّة: «١٢ دولاراً» لا «12.00 USD».
     */
    public function priceLabel(): string
    {
        $amount = rtrim(rtrim(number_format((float) $this->price, 2), '0'), '.');

        return $amount.' '.($this->currency === 'USD' ? 'دولار' : $this->currency);
    }
}
