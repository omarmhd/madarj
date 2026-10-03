<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * هل لهذه القصّة سرد بشريّ مسجَّل؟
 *
 * ── لماذا علَم لا مسار ─────────────────────────────────────
 * الملفّات باصطلاح ثابت: `public/audio/stories/<slug>/01.mp3` حتى
 * عدد جمل القصّة. فلا مسار يُخزَّن ولا يُحدَّث — والعلَم وحده يقول
 * للواجهة أيّ قارئٍ تستعمل.
 *
 * ── ولماذا يُضبط بالفحص لا باليد ───────────────────────────
 * `stories:import` يعدّ الملفّات ويطابقها بعدد الجمل. وعلَمٌ يُكتب
 * يدوياً يكذب أوّل ما يُحذف ملفّ.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            $table->boolean('has_audio')->default(false)->after('words');
        });
    }

    public function down(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            $table->dropColumn('has_audio');
        });
    }
};
