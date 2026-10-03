<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * تسجيل المستخدم في الدورة — صف واحد لكل مستخدم.
 *
 * فُصل عن جدول users بدل إضافة أعمدة إليه، لسببين:
 *   1. users يخص الهوية، وهذا يخص التعلّم — فصل المسؤوليات
 *   2. يسمح مستقبلاً بأكثر من تسجيل لنفس المستخدم (إعادة الدورة مثلاً)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // A = ساعة يومياً · B = ساعتان
            $table->enum('track', ['A', 'B'])->default('A');

            // تاريخ البدء — منه يُحسب "أين يجب أن يكون اليوم"
            $table->date('started_on');

            // موضعه الحالي — يُحدَّث عند إتمام كل يوم
            $table->unsignedTinyInteger('current_week')->default(1);
            $table->unsignedTinyInteger('current_day')->default(1);

            // ضروري لحساب "اليوم" بشكل صحيح لمستخدم في منطقة زمنية أخرى
            $table->string('timezone', 64)->default('UTC');

            // هل أنهى الدورة؟
            $table->timestamp('completed_at')->nullable();

            $table->timestamps();
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('enrollments');
    }
};
