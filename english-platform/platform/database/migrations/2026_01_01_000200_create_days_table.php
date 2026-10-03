<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * أيام الأسبوع — 7 صفوف لكل أسبوع (168 صفاً إجمالاً).
 *
 * هذا الجدول هو أساس الصرامة الزمنية في المنصة:
 * كل صف يمثل يوماً واحداً بمهامه الخمس المحددة.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('days', function (Blueprint $table) {
            $table->id();

            $table->foreignId('week_id')->constrained()->cascadeOnDelete();

            // رقم اليوم داخل الأسبوع 1..7
            $table->unsignedTinyInteger('number');

            // ملخص اليوم — مثال: "§2.1 Family + §8.2 Hearing the vowels"
            $table->string('focus');

            /**
             * المهام الخمس لهذا اليوم:
             * [
             *   { "order": 1, "label": "Vocabulary review — Anki", "minutes": 10, "ref": null },
             *   { "order": 2, "label": "§2.1 Family", "minutes": 25, "ref": "vocab:family" },
             *   ...
             * ]
             *
             * مخزّنة كـ JSON وليست جدولاً منفصلاً لأنها تُقرأ دائماً
             * كمجموعة كاملة، ولا يُستعلم عن مهمة منفردة أبداً.
             */
            $table->json('tasks');

            $table->timestamps();

            // لا يمكن أن يتكرر اليوم داخل نفس الأسبوع
            $table->unique(['week_id', 'number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('days');
    }
};
