<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ما أنجزه المتدرّب من أنشطة وقت الاستراحة.
 *
 * جدول منفصل عن `day_completions` بقصد. الكتاب يضع هذا القسم خارج
 * ساعة الدراسة، ولو خلطناه بمهام اليوم لصار:
 *   - إجبارياً لفتح الغد
 *   - وكاسراً للسلسلة عند تركه
 * وكلاهما ينقض سببه: «هذا هو الجزء الذي لا يبدو عملاً، ولهذا
 * بالضبط هو الجزء الذي يستمرّ عليه الناس فعلاً».
 *
 * فالتأشير هنا **يُحتسب ولا يُلزم**: يُعرض عدّاده ولا يقفل شيئاً.
 *
 * ينتمي لعائلة التقدّم: يكتبه المستخدمون ولا يمسّه content:import.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('break_time_completions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('week_id')->constrained()->cascadeOnDelete();

            // مفتاح النشاط: song · watch · story · channel
            $table->string('item_key', 32);

            $table->timestamp('completed_at');
            $table->timestamps();

            // النشاط الواحد لا يُؤشَّر مرتين في الأسبوع نفسه
            $table->unique(['user_id', 'week_id', 'item_key']);
            $table->index(['user_id', 'week_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('break_time_completions');
    }
};
