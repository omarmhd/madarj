<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ما يكتبه المتدرّب في استمارات الكتاب.
 *
 * ── لماذا جدول عامّ هنا وجدول خاصّ للمقارنة ─────────────────
 * الكتاب فيه استمارات عدّة بالشكل نفسه: أسئلة قصيرة وإجابات
 * قصيرة. مراجعة ما بعد المحادثة (12 §7.5) سبع أسئلة، وخطّة
 * الأشهر الستّة (24 §8.4) ثلاثة التزامات بتواريخها. كلّها
 * «سؤال وجواب»، فجدول واحد يسعها.
 *
 * والمقارنة الكبرى ليست منها: شكلها مصفوفة قياسات في أعمدة
 * أسابيع، لا قائمة أجوبة — فلها جدولها.
 *
 * ── المفتاح ثلاثيّ ─────────────────────────────────────────
 * (المتدرّب، الأسبوع، النوع) — فالأسبوع الثاني عشر يحمل
 * المقارنة والمراجعة معاً، والنوع هو ما يفرّق بينهما.
 *
 * ── من عائلة التقدّم ───────────────────────────────────────
 * لا يمسّه `content:import`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('week_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('week_id')->constrained()->cascadeOnDelete();

            // أيّ استمارة — `conversation` مثلاً
            $table->string('kind', 40);

            // { "<رقم السؤال>": "الجواب" } وقد يحمل مفاتيح مسمّاة
            $table->json('answers')->nullable();

            $table->timestamps();

            $table->unique(['user_id', 'week_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('week_notes');
    }
};
