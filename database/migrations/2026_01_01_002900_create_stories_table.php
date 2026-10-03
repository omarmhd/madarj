<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * القصص القصيرة — قراءة موسّعة خارج ساعة الدراسة.
 *
 * ── لماذا جدول مستقلّ لا قسم في أسبوع ──────────────────────
 * أقسام الأسابيع مربوطة بـ`week_id`، وهذه ليست لأسبوع: تُقرأ متى
 * شاء المتدرّب وبأيّ ترتيب. والكتاب نفسه يضع القراءة الموسّعة في
 * «وقت الاستراحة» خارج الساعة، ويوصي بالقارئ المُدرَّج.
 *
 * ── من عائلة المحتوى ───────────────────────────────────────
 * يكتبه `stories:import` وحده، ولا يمسّه المستخدمون. فيُخزَّن
 * مؤقتاً بلا انتهاء كسائر المحتوى (§4.1).
 *
 * ── الجمل مصفوفة لا نصّاً واحداً ───────────────────────────
 * القارئ ينطق جملةً جملة ويُبرز التي يقرؤها، وتقسيم النصّ في
 * المتصفّح بنقطةٍ وفاصلة يخطئ في «Mr.» و«U.S.» وأمثالهما. فالتقسيم
 * يقع مرّة عند الاستيراد لا في كل عرض.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stories', function (Blueprint $table) {
            $table->id();

            // معرّف ثابت في الرابط — لا `id` يتغيّر بإعادة الاستيراد
            $table->string('slug', 80)->unique();

            $table->string('title_en', 120);
            $table->string('title_ar', 120);

            // «من حكايات إيسوب» — ومن حقّ القارئ أن يعرف
            $table->string('source_ar', 120)->nullable();

            $table->unsignedTinyInteger('minutes')->default(2);

            // سطر يقول لماذا تستحقّ القراءة
            $table->text('why_ar')->nullable();

            $table->json('lines');

            $table->string('moral_en', 200)->nullable();
            $table->string('moral_ar', 200)->nullable();

            // مسرد: [{ en, ar }]
            $table->json('words')->nullable();

            // ترتيب العرض — من ترتيب الملفّ لا من `id`
            $table->unsignedSmallInteger('position')->default(0)->index();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stories');
    }
};
