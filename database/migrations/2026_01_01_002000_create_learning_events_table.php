<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * سجلّ حركات المتدرّب.
 *
 * ما الذي يستحقّ التسجيل؟ ليس كل نقرة — بل ما يجيب سؤالاً تعليمياً:
 *
 *   • أي كلمة أعاد سماعها خمس مرات؟   → صعبة عليه، تستحقّ تدريباً
 *   • كم استغرقت المهمة فعلاً؟         → الخطة تقول 25 دقيقة، والواقع؟
 *   • أين ترك اليوم ولم يُكمله؟        → أخطر رقم في المنصة
 *   • أي قسم فتحه ولم يبقَ فيه؟        → محتوى لا يعمل
 *
 * ── لماذا جدول منفصل عن التقدّم ──────────────────────────
 * `day_completions` و`exercise_attempts` **حقائق**: تُقرأ في كل صفحة،
 * ويُبنى عليها القفل والسلسلة، وفقدانها كارثة. أما هذه فـ**ملاحظات**:
 * تُكتب كثيراً وتُقرأ نادراً، وفقدان حدث منها لا يضرّ.
 *
 * فخلطهما يعني أن كتابة «ضغط زرّ استماع» تنافس قراءة «هل اليوم
 * مكتمل؟» على الجدول نفسه. الفصل يجعل الكتابة رخيصة والقراءة سريعة.
 *
 * ── لماذا بلا مفاتيح أجنبية على المحتوى ─────────────────
 * `ref` نصّ لا `exercise_id`. لأن المحتوى يُعاد استيراده، ولو ارتبط
 * السجلّ بمعرّف لَحُذف معه — وقد وقع هذا فعلاً مع بطاقات المراجعة.
 * السجلّ التاريخي يجب أن يبقى ولو زال ما يشير إليه.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // السياق — أين وقع الحدث
            $table->unsignedTinyInteger('week_number')->nullable();
            $table->unsignedTinyInteger('day_number')->nullable();

            // نوع الحدث: audio_play · task_open · task_done · card_flip …
            $table->string('type', 24);

            // ما وقع عليه: «word:sheep» · «vocab:family» · «exercise:12»
            $table->string('ref', 120)->nullable();

            // قيمة عددية بحسب النوع — مدّة بالثواني، أو رقم محاولة
            $table->unsignedInteger('value')->nullable();

            $table->json('meta')->nullable();

            // وقت وقوعه عند المتدرّب — قد يصل متأخّراً في دفعة
            $table->timestamp('occurred_at')->index();
            $table->timestamp('created_at')->nullable();

            /*
             * فهرسان فقط.
             *
             * جدول يُكتب فيه آلاف الصفوف يومياً يدفع ثمن كل فهرس عند
             * كل إدخال. وهذان يخدمان كل ما نسأله فعلاً: «حركات هذا
             * المتدرّب مرتّبة زمنياً» و«كل أحداث هذا النوع له».
             */
            $table->index(['user_id', 'occurred_at']);
            $table->index(['user_id', 'type', 'ref']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_events');
    }
};
