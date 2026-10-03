<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * الحوارات وأسطرها — حواران لكل أسبوع.
 *
 * الأسطر في جدول منفصل لأن عددها متغيّر (12 إلى 20 سطراً)
 * ولأننا نحتاج ترقيمها وعرضها سطراً سطراً مع إمكانية
 * إخفاء العمود الإنجليزي في تمرين "أنتج من العربية".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dialogues', function (Blueprint $table) {
            $table->id();
            $table->foreignId('week_id')->constrained()->cascadeOnDelete();

            $table->unsignedTinyInteger('number');      // 1 أو 2
            $table->string('title');                    // "Meeting Someone New"
            $table->text('situation_en');               // وصف الموقف
            $table->text('situation_ar');

            $table->timestamps();
            $table->unique(['week_id', 'number']);
        });

        Schema::create('dialogue_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dialogue_id')->constrained()->cascadeOnDelete();

            $table->unsignedSmallInteger('position');   // ترتيب السطر
            $table->string('speaker', 30);              // SARA / OMAR
            $table->text('en');
            $table->text('ar');

            $table->timestamps();
            $table->index(['dialogue_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dialogue_lines');
        Schema::dropIfExists('dialogues');
    }
};
