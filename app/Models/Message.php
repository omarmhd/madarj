<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ملاحظة أو رسالة من عميل — أو من زائرٍ لم يسجّل.
 */
class Message extends Model
{
    public const KINDS = [
        'feedback' => 'ملاحظة',
        'contact'  => 'تواصل',
        'bug'      => 'خطأ في المنصة',
    ];

    public const STATUSES = [
        'new'      => 'جديدة',
        'read'     => 'قُرئت',
        'answered' => 'أُجيبت',
        'closed'   => 'مغلقة',
    ];

    protected $fillable = [
        'user_id', 'name', 'email', 'kind', 'subject', 'body',
        'status', 'reply', 'answered_by', 'answered_at',
    ];

    protected $casts = ['answered_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function answerer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'answered_by');
    }

    /**
     * اسم المُرسل كما يُعرض.
     *
     * المسجَّل يُعرَف باسم حسابه، والزائر بما كتبه — ومن لم يكتب
     * شيئاً يُقال عنه «زائر» لا يُترك فراغاً في الجدول.
     */
    public function senderName(): string
    {
        return $this->user?->name ?? ($this->name ?: 'زائر');
    }

    public function scopeOpen($query)
    {
        return $query->whereIn('status', ['new', 'read']);
    }
}
