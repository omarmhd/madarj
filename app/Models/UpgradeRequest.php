<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * طلب ترقية — يرفع يده، ونحن نتواصل.
 */
class UpgradeRequest extends Model
{
    /** وسائل التواصل — وما ليس منها لا يُقبل */
    public const METHODS = [
        'whatsapp' => 'واتساب',
        'email'    => 'بريد إلكتروني',
        'call'     => 'اتصال هاتفي',
    ];

    /** الحالات الأربع، وكلٌّ منها يعني شيئاً مختلفاً */
    public const STATUSES = [
        'new'       => 'جديد',
        'contacted' => 'تواصلنا معه',
        'done'      => 'اكتمل',
        'declined'  => 'انصرف',
    ];

    protected $fillable = [
        'user_id', 'plan_id', 'contact_method', 'contact_value',
        'note', 'status', 'admin_note', 'handled_by', 'handled_at',
    ];

    protected $casts = ['handled_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    /** ما لم يُنظَر فيه بعد — أوّل ما يُفتح في اللوحة */
    public function scopeOpen($query)
    {
        return $query->whereIn('status', ['new', 'contacted']);
    }
}
