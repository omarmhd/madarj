<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * بطاقات التكرار المتباعد — خوارزمية FSRS.
 *
 * صف واحد لكل (مستخدم، كلمة). تُنشأ البطاقات تلقائياً عندما
 * يفتح المستخدم مجموعة مفردات لأول مرة.
 *
 * نستخدم FSRS لا SM-2 لأنه أدق في التنبؤ بموعد النسيان،
 * ولأن مكتبة ts-fsrs جاهزة وتعمل في المتصفح مباشرة.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('review_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vocabulary_id')->constrained('vocabulary')->cascadeOnDelete();

            /**
             * الموعد المستحق للمراجعة — أهم عمود في الجدول كله.
             * الاستعلام اليومي: "بطاقات هذا المستخدم المستحقة الآن"
             */
            $table->timestamp('due_at')->index();

            // متغيرات FSRS
            $table->float('stability')->default(0);      // مدة بقاء الأثر
            $table->float('difficulty')->default(0);     // صعوبة البطاقة لهذا المستخدم
            $table->unsignedSmallInteger('reps')->default(0);    // عدد المراجعات
            $table->unsignedSmallInteger('lapses')->default(0);  // عدد مرات النسيان

            // حالة البطاقة في دورة FSRS
            $table->enum('state', ['new', 'learning', 'review', 'relearning'])
                  ->default('new');

            $table->timestamp('last_reviewed_at')->nullable();

            $table->timestamps();

            // البطاقة الواحدة لا تتكرر لنفس المستخدم
            $table->unique(['user_id', 'vocabulary_id']);

            // الفهرس الحرج: جلب المستحق لمستخدم معيّن
            $table->index(['user_id', 'due_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_cards');
    }
};
