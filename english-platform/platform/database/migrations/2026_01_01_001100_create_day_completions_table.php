<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * إتمام الأيام — قلب نظام الصرامة في المنصة.
 *
 * قاعدة القفل:
 *   اليوم رقم n+1 لا يُفتح إلا إذا وُجد صف لليوم n بـ completed_at غير فارغ.
 *
 * وجود صف بـ completed_at = null يعني: اليوم مفتوح، بدأه، لم يكمله بعد.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('day_completions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('week_id')->constrained()->cascadeOnDelete();

            $table->unsignedTinyInteger('day_number');   // 1..7

            /**
             * أي المهام الخمس أُنجزت:
             *   { "1": true, "2": true, "3": false, "4": false, "5": false }
             *
             * اليوم يُعتبر مكتملاً فقط عندما تصبح كلها true.
             */
            $table->json('tasks_done');

            // متى فتح اليوم لأول مرة
            $table->timestamp('started_at')->nullable();

            // متى اكتملت كل المهام — هذا ما يفتح اليوم التالي
            $table->timestamp('completed_at')->nullable();

            // الدقائق الفعلية من مؤقّت الواجهة
            $table->unsignedSmallInteger('minutes_spent')->default(0);

            $table->timestamps();

            // يستحيل تكرار نفس اليوم لنفس المستخدم
            $table->unique(['user_id', 'week_id', 'day_number']);

            // للوحة التقدّم: كل أيام المستخدم المكتملة
            $table->index(['user_id', 'completed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('day_completions');
    }
};
