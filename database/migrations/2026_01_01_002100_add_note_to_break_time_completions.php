<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ما التقطه المتدرّب في نشاط الاستراحة.
 *
 * ── لماذا حقل حرّ لا اختبار ─────────────────────────────────
 * لا سبيل إلى إثبات أن أحداً شاهد فيديو. والأهمّ أن إثباته غير
 * مرغوب: قاعدة الكتاب في هذا القسم «لا تدرسه»، وهو يعمل لأنه سهل
 * وممتع. تحويله إلى اختبار يُنهيه.
 *
 * لكن **الملاحظة** هي ما يحوّل المشاهدة السلبية إلى تعلّم: أن تتصيّد
 * خمس كلمات، أو تعدّ أفعال الماضي. فيُحفظ ما لاحظه — لا ليُصحَّح، بل
 * ليصير النشاط محدّداً بدل أن يكون «شاهد شيئاً»، وليعود إليه بعد
 * أسابيع فيرى ما كان يلتقطه حينها.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('break_time_completions', function (Blueprint $table) {
            $table->text('note')->nullable()->after('item_key');
        });
    }

    public function down(): void
    {
        Schema::table('break_time_completions', function (Blueprint $table) {
            $table->dropColumn('note');
        });
    }
};
