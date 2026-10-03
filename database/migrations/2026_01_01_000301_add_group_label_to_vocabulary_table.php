<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * اسم المجموعة بالعربية.
 *
 * كان مكتوباً في الواجهة خريطةً من أربعة أسماء (`GROUP_LABELS`)، وفي
 * المحتوى سبع وسبعون مجموعة — فكان المتدرّب يرى عنواناً إنجليزياً خاماً
 * مثل «places_and_things_in_your_day» فوق بطاقاته العربية.
 *
 * والاسم محتوى لا واجهة: يأتي من عنوان القسم في الكتاب، ويتغيّر
 * بتغيّره. فمكانه هنا لا في ملفّ TSX.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vocabulary', function (Blueprint $table) {
            $table->string('group_label_ar')->nullable()->after('group');
        });
    }

    public function down(): void
    {
        Schema::table('vocabulary', function (Blueprint $table) {
            $table->dropColumn('group_label_ar');
        });
    }
};
