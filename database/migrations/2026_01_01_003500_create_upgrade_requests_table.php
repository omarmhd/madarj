<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * طلبات الترقية — والتواصل يدويّ بعدها.
 *
 * ── لماذا طلب لا دفع ───────────────────────────────────────
 * قرارٌ مُتّخذ: لا بوّابة دفع. فالزرّ لا «يشتري» بل **يرفع يدَه**:
 * أريد الترقية، وهذه وسيلتي، فاتّصل بي. والعقد كلّه في هذا الصفّ.
 *
 * ── ووسيلة التواصل يختارها هو ──────────────────────────────
 * رقم الواتساب مجموعٌ عند التسجيل، لكنّ مَن يفضّل البريد أو
 * الاتّصال لا يُفترض عنه. فالوسيلة حقلٌ يُختار، وقيمتها تُملأ
 * مسبقاً بما نعرفه ويُصحّحها إن شاء.
 *
 * ── والحالة أربع لا اثنتان ─────────────────────────────────
 * «جديد» و«تواصلنا» و«اكتمل» و«انصرف». والثالثة والرابعة تفترقان:
 * من دفع يُحسَب، ومن اعتذر يُتعلَّم منه — ودمجهما في «مغلق» يُخفي
 * أهمّ رقم في المنصّة: كم واحد من كل عشرة يترقّى.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('upgrade_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // الخطّة التي أرادها — وقد تُعطَّل لاحقاً فيبقى الطلب
            $table->foreignId('plan_id')->nullable()->constrained()->nullOnDelete();

            $table->string('contact_method', 20);   // whatsapp · email · call
            $table->string('contact_value', 120);

            $table->string('note', 500)->nullable();

            $table->string('status', 20)->default('new');  // new · contacted · done · declined

            // ما كتبه الموظّف بعد التواصل
            $table->string('admin_note', 500)->nullable();

            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('handled_at')->nullable();

            $table->timestamps();

            // طابور العمل: الجديد أوّلاً
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('upgrade_requests');
    }
};
