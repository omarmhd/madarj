<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * سجل التسجيلات الصوتية.
 *
 * قرار معماري مهم: الملف الصوتي نفسه لا يُرفع إلى الخادم.
 * يبقى في IndexedDB داخل متصفح المستخدم، وهذا الجدول يحفظ
 * البيانات الوصفية فقط.
 *
 * الأسباب الثلاثة:
 *   1. التكلفة — 24 تسجيلاً × ألف مستخدم = عشرات الجيجابايت
 *   2. الخصوصية — لن نحتفظ بتسجيلات صوتية لآلاف الأشخاص
 *   3. لا حاجة — قيمة التسجيل في أن يسمعه هو، لا نحن
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recordings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->unsignedTinyInteger('week_number');   // 1..24
            $table->unsignedSmallInteger('duration_seconds');

            // تقييمه الذاتي حسب جدول المعايير في الكتاب
            $table->unsignedTinyInteger('self_score')->nullable();
            $table->unsignedTinyInteger('self_score_max')->nullable();

            // مفتاح الملف في IndexedDB عند المستخدم — ليس مساراً على الخادم
            $table->string('local_ref', 64);

            // ملاحظة يكتبها لنفسه
            $table->text('note')->nullable();

            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->index(['user_id', 'week_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recordings');
    }
};
