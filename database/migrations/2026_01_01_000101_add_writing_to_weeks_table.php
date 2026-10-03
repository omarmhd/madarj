<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * مهمة الكتابة — §9 في كل فصل من الكتاب.
 *
 * بنيتها في الكتاب ثابتة: مهمة + قوالب جمل + نموذج إجابة.
 * القوالب هي جوهر القسم — المبتدئ لا يستطيع الكتابة من الصفر،
 * فيُعطى هيكل الجملة ويملأ ما ينقص.
 *
 * عمود json على weeks لا جدول منفصل: مهمة واحدة لكل أسبوع،
 * ونفس نمط objectives الموجود أصلاً.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('weeks', function (Blueprint $table) {
            $table->json('writing')->nullable()->after('objectives');
        });
    }

    public function down(): void
    {
        Schema::table('weeks', function (Blueprint $table) {
            $table->dropColumn('writing');
        });
    }
};
