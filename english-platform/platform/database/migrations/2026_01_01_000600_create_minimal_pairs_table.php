<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * أزواج التمييز الصوتي — تغذّي لعبة الاستماع.
 *
 * اللعبة: المتصفح ينطق إحدى الكلمتين عشوائياً عبر Web Speech API،
 * والمستخدم يضغط ما سمعه. لا نحتاج أي ملف صوتي على الخادم.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('minimal_pairs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('week_id')->constrained()->cascadeOnDelete();

            // عنوان المجموعة: "short i against long ee"
            $table->string('group_label');

            // الرموز الصوتية: "/ɪ/ vs /iː/"
            $table->string('ipa', 40)->nullable();

            $table->string('word_a', 40);   // ship
            $table->string('word_b', 40);   // sheep

            $table->unsignedSmallInteger('position')->default(0);

            $table->timestamps();
            $table->index(['week_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('minimal_pairs');
    }
};
