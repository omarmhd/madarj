<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ملخّص يومي مجمَّع — صفّ واحد لكل متدرّب في كل يوم.
 *
 * ── لماذا لا نحسب من السجلّ الخام مباشرة ──────────────────
 * لأن السؤال «كم دقيقة درست هذا الشهر؟» على جدول فيه مليون حدث يعني
 * مسحاً كاملاً في كل مرة يفتح فيها أحدهم لوحته. وهذا هو بالضبط ما
 * يجعل منصّات التعلّم تبطؤ بعد سنة من الإطلاق: البيانات لم تكبر
 * فجأة، بل الاستعلام كان يمسح منذ اليوم الأول ولم يظهر أثره.
 *
 * فالتجميع يقع **عند الكتابة** لا عند القراءة: كل دفعة أحداث تزيد
 * العدّادات هنا زيادةً ذرّية. اللوحة تقرأ ثلاثين صفّاً لا مليون حدث،
 * ويبقى الرقم صحيحاً مهما كبر السجلّ.
 *
 * ── ولماذا نبقي الخام إذن ─────────────────────────────────
 * لأن الملخّص يجيب ما سألناه، والخام يجيب ما لم نسأله بعد: «أي كلمة
 * أعاد سماعها أكثر من غيرها؟» سؤال لم يكن في بالنا حين صمّمنا
 * الجدول. الخام يُقصّ بعد تسعين يوماً، والملخّص يبقى للأبد.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_stats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // بتوقيت المتدرّب لا بتوقيت الخادم — «اليوم» عنده هو المعنيّ
            $table->date('on_date');

            // الدقائق الفعلية — الخطة تقول 60، وهذا ما حدث
            $table->unsignedSmallInteger('active_seconds')->default(0);

            $table->unsignedSmallInteger('audio_plays')->default(0);
            $table->unsignedSmallInteger('cards_reviewed')->default(0);
            $table->unsignedSmallInteger('exercises_tried')->default(0);
            $table->unsignedSmallInteger('tasks_done')->default(0);
            $table->unsignedSmallInteger('events')->default(0);

            $table->timestamps();

            // صفّ واحد لكل متدرّب في كل يوم — والفريد يمنع التكرار
            // عند وصول دفعتين متزامنتين
            $table->unique(['user_id', 'on_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_stats');
    }
};
