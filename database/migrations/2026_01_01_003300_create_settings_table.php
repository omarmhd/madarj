<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * إعدادات يضبطها المدير — لا ثوابت في الشفرة.
 *
 * ── لماذا جدول لا ملفّ إعداد ───────────────────────────────
 * `config/` يُقرأ من ملفّ يُنشر مع الشفرة: تغييره يعني نشرة جديدة.
 * وعدد أسابيع التجربة قرارٌ تسويقيّ يتغيّر في يوم — فمكانه لوحةٌ
 * يفتحها المدير، لا ملفٌّ ينتظر مبرمجاً.
 *
 * ── ومفتاح وقيمة لا عمود لكل إعداد ─────────────────────────
 * الإعدادات قليلة ومتفرّقة، وعمودٌ لكل واحد يعني هجرةً لكل قرار.
 * والقيمة نصّ يُفسَّر عند القراءة: عددٌ هنا وسطرٌ هناك.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->string('key', 60)->primary();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        // أسبوع واحد مجّاناً — كما في خطّة الإطلاق
        DB::table('settings')->insert([
            'key'        => 'trial_weeks',
            'value'      => '1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
