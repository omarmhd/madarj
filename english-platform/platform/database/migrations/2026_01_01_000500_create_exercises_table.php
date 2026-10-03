<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * التمارين — الجدول الأهم في طبقة المحتوى.
 *
 * كل أنواع التمارين في جدول واحد. السبب:
 * الاستعلام دائماً "أعطني تمارين اليوم الرابع من الأسبوع الأول"
 * ولا يفرّق بين الأنواع. الاختلاف في العرض لا في التخزين.
 *
 * أعمدة payload و answer هي التي تختلف حسب النوع — انظر الأمثلة أدناه.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exercises', function (Blueprint $table) {
            $table->id();
            $table->foreignId('week_id')->constrained()->cascadeOnDelete();

            // رقم اليوم الذي يُعرض فيه هذا التمرين (لربطه بالخطة اليومية)
            $table->unsignedTinyInteger('day_number')->nullable();

            // رقم التمرين كما في الكتاب: "Exercise 5"
            $table->unsignedSmallInteger('exercise_no')->nullable();

            /**
             * أنواع التمارين المدعومة:
             *   fill_blank      ملء فراغ
             *   multiple_choice اختيار من متعدد
             *   true_false      صح أو خطأ
             *   correct_error   صحّح الخطأ
             *   match           توصيل
             *   order_words     رتّب الكلمات
             *   free_text       إجابة حرة (لا تُصحَّح آلياً)
             */
            $table->string('type', 20);

            $table->text('prompt');                  // نص السؤال
            $table->unsignedSmallInteger('position');

            /**
             * البيانات الإضافية — تختلف حسب النوع:
             *
             * fill_blank:      { "before": "She", "after": "(be) a teacher." }
             * multiple_choice: { "options": ["is", "are", "am"] }
             * true_false:      {}
             * correct_error:   { "sentence": "He work in a bank." }
             * match:           { "left": [...], "right": [...] }
             */
            $table->json('payload')->nullable();

            /**
             * الإجابة الصحيحة:
             *
             * fill_blank:      { "accepted": ["is"] }
             * multiple_choice: { "correct": 0 }
             * true_false:      { "correct": true }
             * correct_error:   { "accepted": ["He works in a bank."] }
             *
             * free_text لا يحتوي answer — يُقيَّم ذاتياً
             */
            $table->json('answer')->nullable();

            // شرح يظهر بعد الإجابة
            $table->text('explanation')->nullable();

            $table->unsignedTinyInteger('points')->default(1);

            $table->timestamps();
            $table->index(['week_id', 'day_number', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exercises');
    }
};
