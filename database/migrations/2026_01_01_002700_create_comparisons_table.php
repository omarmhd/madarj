<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * المقارنة الكبرى — ما قاسه المتدرّب في تسجيلاته.
 *
 * ── لماذا جدول لا حدث في السجلّ ─────────────────────────────
 * الكتاب يسمّي هذا التمرين «أهمّ عشرين دقيقة في الوحدة» ويأمر
 * صراحةً: «أكمل الجمل الثلاث واحفظ الصفحة». وقيمته كلها في أن
 * يُقرأ بعد ستة أسابيع ثم بعد اثني عشر — فما لا يُحفظ لا يُقارَن.
 *
 * و`learning_events` لا يصلح لهذا: مساره «لا يُبطئ المتدرّب أبداً»
 * فيبتلع الفشل صامتاً، وهو صحيح لنقرة استماع وخطأ لجملةٍ كتبها
 * المتدرّب عن نفسه بعد أن سمع صوته قبل ستة أشهر.
 *
 * ── أربع مرّات في الدورة لا أكثر ────────────────────────────
 * أسابيع 6 و12 و18 و24. فالجدول أربعة صفوف لكل متدرّب، ومفتاحه
 * الفريد (المتدرّب، الأسبوع) يجعل الحفظ تحديثاً لا تكراراً.
 *
 * ── من عائلة التقدّم ───────────────────────────────────────
 * لا يمسّه `content:import`. والقياسات والجمل في `json` لأن
 * عددها يختلف بحسب الأسبوع: خمسة مقاييس في السادس وستّة في
 * الرابع والعشرين، وثلاث جمل هناك وخمس هنا.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comparisons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('week_id')->constrained()->cascadeOnDelete();

            // القياسات: { "<رقم الأسبوع>": { "<رقم المقياس>": القيمة } }
            $table->json('measures')->nullable();

            // الجمل المكتملة، بترتيب ظهورها في القسم
            $table->json('sentences')->nullable();

            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            // صفٌّ واحد لكل أسبوع مراجعة — الحفظ تحديث
            $table->unique(['user_id', 'week_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comparisons');
    }
};
