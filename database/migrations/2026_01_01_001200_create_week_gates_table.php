<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * أقفال الأسابيع.
 *
 * قاعدتان:
 *   1. الأسبوع n+1 لا يُفتح إلا بإتمام أيام الأسبوع n السبعة
 *   2. أسابيع المراجعة (6، 12، 18، 24) تشترط درجة دنيا في الاختبار
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('week_gates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('week_id')->constrained()->cascadeOnDelete();

            // متى فُتح هذا الأسبوع للمستخدم
            $table->timestamp('unlocked_at')->nullable();

            // نتيجة اختبار الأسبوع — لأسابيع المراجعة فقط
            $table->unsignedSmallInteger('test_score')->nullable();
            $table->unsignedSmallInteger('test_max')->nullable();

            // متى اجتاز الأسبوع بالكامل
            $table->timestamp('passed_at')->nullable();

            $table->timestamps();
            $table->unique(['user_id', 'week_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('week_gates');
    }
};
