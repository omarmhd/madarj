<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * حقلان على المستخدم: من يدير، ومن له تجربة أطول.
 *
 * ── لماذا علَمٌ لا منظومة أدوار ─────────────────────────────
 * الموظّفون واحد أو اثنان. ومنظومة أدوار وصلاحيّات لأجل ذلك تُدخل
 * حزمةً وأربعة جداول لتجيب سؤالاً واحداً: «هل يفتح /admin؟».
 * وإن صار الفريق عشرةً بأدوارٍ مختلفة فوقتها تُبنى — لا قبله.
 *
 * ── والاستثناء الفرديّ عدد لا تاريخ ────────────────────────
 * «أعطِ هذا الشخص أربعة أسابيع مجّاناً» عددُ أسابيع لا مدّة زمنيّة:
 * من فتحه بعد شهرين يجدها كما هي. أمّا منحة المدّة («شهر مجّاناً»)
 * فاشتراكٌ بلا خطّة — وهي مسألة أخرى لها جدولها.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_admin')->default(false)->after('email_verified_at');

            // فارغ = يتبع الإعداد العامّ
            $table->unsignedTinyInteger('free_weeks')->nullable()->after('is_admin');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['is_admin', 'free_weeks']);
        });
    }
};
