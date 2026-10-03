<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * خطط الاشتراك — يضبطها المدير كلّها.
 *
 * ── لماذا العملة في الخطّة لا في الإعدادات ─────────────────
 * «التحكّم كامل في لوحة الأدمن»: فخطّةٌ بالدولار وأخرى بالجنيه
 * جائزتان معاً، ولا يُفرض على المدير سعرٌ واحد لكل السوق. وعملةٌ
 * عامّة تعني تعديل الشفرة أوّل ما يُضاف سوق ثانٍ.
 *
 * ── والمدّة بالشهور لا بنصّ ────────────────────────────────
 * «سنة» و«ستّة أشهر» و«ثلاثة» كلّها عددُ شهور — والحساب يحتاج رقماً
 * ليجمعه إلى تاريخ. والنصّ يُكتب في `name_ar` للعرض.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();

            $table->string('name_ar', 80);

            // عدد الشهور — منه يُحسب تاريخ الانتهاء
            $table->unsignedSmallInteger('months');

            $table->decimal('price', 10, 2);
            $table->string('currency', 3)->default('USD');

            // سطر يظهر تحت السعر: «يوفّر شهرين» مثلاً
            $table->string('note_ar', 160)->nullable();

            // المعطَّلة تبقى للسجلّ ولا تُعرض على العميل
            $table->boolean('is_active')->default(true)->index();

            $table->unsignedSmallInteger('sort')->default(0);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
