<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * أقسام الشرح — القواعد ورموز النطق والعبارات والاستماع والقراءة
 * والاختبار الذاتي.
 *
 * لماذا جدول واحد بعمود `kind` لا ستة جداول:
 * الأقسام تشترك في كل ما يهمّ الاستعلام — تنتمي لأسبوع، وتُسند ليوم،
 * ولها ترتيب وعنوان. ما يختلف هو شكل المحتوى فقط، وهذا ما يحمله
 * `payload`. ستة جداول تعني ستة نماذج وستة مسارات استيراد وستة
 * علاقات، مقابل صفر فائدة في الاستعلام.
 *
 * والأهم: الكتاب فيه أنواع أقسام أخرى في الأسابيع 2–24 (الشرح
 * النحوي المركّب، الملاحق، الأغاني). إضافة نوع جديد هنا سطر واحد
 * في `kind` بدل هجرة جديدة كل مرة.
 *
 * ينتمي لعائلة المحتوى: يكتبه `content:import` وحده، ولا يمسّه مستخدم.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('week_id')->constrained()->cascadeOnDelete();

            /**
             * نوع القسم — يحدّد شكل payload والمكوّن الذي يعرضه:
             *   grammar    قاعدة + مقارنة بالعربية + أخطاء شائعة
             *   phonics    رموز النطق بأمثلة مسموعة
             *   phrases    عبارات جاهزة للاستخدام الفوري
             *   listening  نص كامل + أسئلة + شادوينج
             *   reading    قصة + مسرد
             *   selfcheck  قائمة «أستطيع أن…» ينجح أو يعيد
             */
            $table->string('kind', 32)->index();

            // اليوم الذي يُدرَس فيه — null لقسم مرجعي على مستوى الأسبوع
            $table->unsignedTinyInteger('day_number')->nullable();

            $table->string('title_ar');
            $table->string('title_en')->nullable();

            // بنية المحتوى تختلف بحسب kind — موثّقة في AGENTS.md §6
            $table->jsonb('payload');

            $table->unsignedSmallInteger('position')->default(0);

            $table->timestamps();

            // الاستعلام الأشيع: أقسام هذا الأسبوع بهذا النوع
            $table->index(['week_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sections');
    }
};
