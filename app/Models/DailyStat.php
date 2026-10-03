<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ملخّص يوم واحد لمتدرّب واحد.
 *
 * يُزاد ذرّياً بـ`increment` لا بقراءة ثم كتابة — فدفعتان تصلان في
 * اللحظة نفسها لا تُلغي إحداهما الأخرى.
 */
class DailyStat extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'on_date', 'active_seconds', 'audio_plays',
        'cards_reviewed', 'exercises_tried', 'tasks_done', 'events',
    ];

    /*
     * `on_date` نصّ `Y-m-d` لا كائن تاريخ.
     *
     * التحويل إلى `date` يجعل الكتابة تخزّن «2026-09-05 00:00:00»
     * والقراءة تبحث عن «2026-09-05»، فلا يتطابقان: يظنّ الصفّ غير
     * موجود فيحاول إدخاله فيصطدم بالمفتاح الفريد. والنصّ المجرّد
     * يجعل الطرفين صيغة واحدة.
     */
    protected function casts(): array
    {
        return [];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
