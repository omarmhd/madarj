<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * جنس كل متحدث في الحوار — خريطة اسم ← f / m.
 *
 * لماذا عمود واحد على الحوار لا عمود على كل سطر:
 * المتحدث ثابت داخل الحوار، فتكرار جنسه في كل سطر تكرار بلا فائدة.
 *
 * ولماذا في المحتوى لا في الكود: أسماء المتحدثين تتغيّر كل أسبوع،
 * و24 أسبوعاً تعني عشرات الأسماء. قائمة أسماء في React ستتعفّن.
 *
 * تستخدمه الواجهة لاختيار صوت أنثوي أو ذكوري من Web Speech API.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dialogues', function (Blueprint $table) {
            // مثال: {"SARA":"f","OMAR":"m"}
            $table->json('speaker_genders')->nullable()->after('situation_ar');
        });
    }

    public function down(): void
    {
        Schema::table('dialogues', function (Blueprint $table) {
            $table->dropColumn('speaker_genders');
        });
    }
};
