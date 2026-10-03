<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * محاولات التمارين.
 *
 * نحفظ كل محاولة لا الأخيرة فقط، لأن عدد المحاولات
 * مؤشر تعليمي: تمرين احتاج أربع محاولات يعني أن المفهوم لم يترسّخ.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exercise_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('exercise_id')->constrained()->cascadeOnDelete();

            // ما أجاب به — بنيته تعتمد على نوع التمرين
            $table->json('response');

            $table->boolean('is_correct');

            // رقم المحاولة: 1، 2، 3...
            $table->unsignedTinyInteger('attempt_no')->default(1);

            $table->timestamps();

            $table->index(['user_id', 'exercise_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exercise_attempts');
    }
};
