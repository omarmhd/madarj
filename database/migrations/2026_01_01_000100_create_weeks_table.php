<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * جدول الأسابيع — 24 صفاً، واحد لكل فصل من الكتاب.
 *
 * هذا الجدول ثابت: يُملأ مرة واحدة عبر `php artisan content:import`
 * ولا يكتب فيه المستخدمون أبداً. لذلك يمكن تخزينه مؤقتاً بلا قلق.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weeks', function (Blueprint $table) {
            $table->id();

            // رقم الأسبوع 1..24 — هذا هو المفتاح المستخدم في الروابط /week/3
            // نستخدمه بدل id لأن إعادة الاستيراد قد تغيّر id لكن لا تغيّر الرقم
            $table->unsignedTinyInteger('number')->unique();

            // الوحدة 1..4
            $table->unsignedTinyInteger('module');

            $table->string('title_en');
            $table->string('title_ar');

            // أهداف الأسبوع: [{ "en": "...", "ar": "..." }, ...]
            $table->json('objectives');

            // رقم قسم النطق داخل الفصل (يختلف بين الفصول: 4 غالباً، 5 أحياناً)
            $table->unsignedTinyInteger('pron_section')->default(4);

            // أسابيع المراجعة (6، 12، 18، 24) بنيتها مختلفة: اختبار بدل محتوى جديد
            $table->boolean('is_review')->default(false);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weeks');
    }
};
