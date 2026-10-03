<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * الذاكرة — دفتر الكلمات الذي يكتبه المتدرّب بنفسه.
 *
 * ── لماذا جدول منفصل عن `review_cards` ──────────────────────
 * ذاك يربط بطاقةً بصفٍّ في `vocabulary`، أي بكلمة **من الكتاب**.
 * وكلمات كافي ليست من الكتاب: سمعها في عمله أو في مسلسل، ولا
 * وجود لها في المحتوى. فإدخالها هناك يعني إضافة صفوف إلى جدول
 * محتوى يكتبه `content:import` وحده — وهو ما تمنعه §4.1 صراحةً.
 *
 * فهذا الجدول من **عائلة التقدّم**: يكتبه المستخدمون، ولا يمسّه
 * الاستيراد، ويُحذف مع حساب صاحبه.
 *
 * ── ولماذا يحمل حقول FSRS نفسها ────────────────────────────
 * لأن كلمة الدفتر تُنسى كما تُنسى كلمة الكتاب. والحساب يقع في
 * المتصفّح بـts-fsrs كما في `review_cards` — والخادم يخزّن النتيجة
 * ولا يعيد حسابها.
 *
 * ينتمي لعائلة التقدّم: يكتبه المستخدمون ولا يمسّه content:import.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('memory_words', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // الكلمة الإنجليزية ومعناها العربي
            $table->string('term', 64);
            $table->string('translation', 191)->nullable();

            /**
             * من أين جاءت الترجمة:
             *   course — من مفردات الكتاب نفسه (الأدقّ والأرخص)
             *   auto   — من خدمة ترجمة خارجية
             *   manual — كتبها المتدرّب بيده
             *
             * يُعرض للمتدرّب: ترجمةٌ آلية يجب أن يعرف أنها آلية.
             */
            $table->string('source', 8)->default('manual');

            // ── حالة FSRS — يحسبها المتصفّح ويخزّنها الخادم ──
            $table->timestamp('due_at')->index();
            $table->float('stability')->default(0);
            $table->float('difficulty')->default(0);
            $table->unsignedSmallInteger('reps')->default(0);
            $table->unsignedSmallInteger('lapses')->default(0);
            $table->enum('state', ['new', 'learning', 'review', 'relearning'])
                  ->default('new');
            $table->timestamp('last_reviewed_at')->nullable();

            $table->timestamps();

            // الكلمة الواحدة لا تتكرّر في دفتر صاحبها
            $table->unique(['user_id', 'term']);

            // الفهرس الحرج: «ما المستحقّ الآن لهذا المتدرّب؟»
            $table->index(['user_id', 'due_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('memory_words');
    }
};
