<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ما كتبه المتدرّب في مهمة الكتابة — صف واحد لكل مستخدم لكل أسبوع.
 *
 * ينتمي لعائلة التقدّم لا المحتوى: يكتبه المستخدمون،
 * فلا يُخزَّن مؤقتاً ولا يمسّه content:import.
 *
 * لماذا على الخادم لا في المتصفح: المتدرّب يعود لنصّه بعد أسابيع
 * ليقارن كتابته الأولى بالأخيرة — وهذا دليل التقدّم كما في التسجيلات.
 * وقاعدة المشروع: لا localStorage للتقدّم.
 *
 * self_score: تقييم ذاتي 1..5 بعد مقارنة النص بنموذج الإجابة.
 * الكتابة الحرّة لا تُصحَّح آلياً — الكتاب يجعلها تقييماً ذاتياً.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('writings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('week_id')->constrained()->cascadeOnDelete();

            $table->text('body');
            $table->unsignedSmallInteger('word_count')->default(0);

            // هل رأى نموذج الإجابة؟ الكشف قبل المحاولة يفقد المهمة قيمتها
            $table->boolean('model_seen')->default(false);
            $table->unsignedTinyInteger('self_score')->nullable();

            $table->timestamps();

            // صف واحد لكل مستخدم لكل أسبوع — التحديث لا التكرار
            $table->unique(['user_id', 'week_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('writings');
    }
};
