<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * اسم المجموعة بالإنجليزية — بجانب العربي.
 *
 * المنصة تعرض العنوانين معاً، وتقلب الأساس إذا اختار المتدرّب
 * الإنجليزية. فالاسمان محتوى متلازم، لا أحدهما أصل والآخر ترجمة.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vocabulary', function (Blueprint $table) {
            $table->string('group_label_en')->nullable()->after('group_label_ar');
        });
    }

    public function down(): void
    {
        Schema::table('vocabulary', function (Blueprint $table) {
            $table->dropColumn('group_label_en');
        });
    }
};
