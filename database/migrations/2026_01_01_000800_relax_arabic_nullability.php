<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * جعل حقلين عربيين قابلين لـ null.
 *
 * السبب: الكتاب لا يحتوي هذين النصّين بالعربية إطلاقاً —
 *   dialogues.situation_ar  وصف موقف الحوار
 *   sections.title_ar       عنوان قسم الشرح
 *
 * وإلزامهما كان يمنع استيراد الأسابيع 3–24 كلها. والبديل السيئ
 * أن نكتب الإنجليزية في حقل عربي فيبدو مترجَماً وهو ليس كذلك،
 * أو أن نلفّق ترجمة — وكلاهما أسوأ من فراغ صريح.
 *
 * فالواجهة تسقط على الإنجليزية عند الفراغ، والترجمة تُضاف تدريجياً.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dialogues', function (Blueprint $table) {
            $table->text('situation_ar')->nullable()->change();
        });

        Schema::table('sections', function (Blueprint $table) {
            $table->string('title_ar')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('dialogues', function (Blueprint $table) {
            $table->text('situation_ar')->nullable(false)->change();
        });

        Schema::table('sections', function (Blueprint $table) {
            $table->string('title_ar')->nullable(false)->change();
        });
    }
};
