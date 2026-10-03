<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * مُدَد الوصول — المدفوعة والممنوحة معاً.
 *
 * ── لماذا جدول واحد للاثنين ────────────────────────────────
 * «أعطِ هذا الشخص شهراً مجّاناً» و«اشترى سنة» سؤالهما واحد:
 * **هل له وصولٌ اليوم؟** فحقلٌ على المستخدم (`access_until`) يجيبه،
 * لكنّه ينسى: من منح؟ ومتى؟ وبأيّ خطّة؟ ولا يحتمل مدّتين متتاليتين.
 *
 * فالممنوح اشتراكٌ بلا خطّة (`plan_id` فارغ و`is_free`)، والمدفوع
 * اشتراكٌ بخطّة. والسؤال استعلامٌ واحد في الحالين.
 *
 * ── والدفع خارج النظام ─────────────────────────────────────
 * قرارٌ مُتّخذ: لا بوّابة ولا فواتير. المدير يتواصل ثم يُنشئ الصفّ
 * بيده. فلا حالة «معلّق الدفع» هنا — الصفُّ يُنشأ بعد التحصيل.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // فارغ = مِنحة يدويّة لا خطّة مُشتراة
            $table->foreignId('plan_id')->nullable()->constrained()->nullOnDelete();

            $table->date('starts_on');
            $table->date('ends_on');

            $table->boolean('is_free')->default(false);

            // ما دُفع فعلاً — قد يخالف سعر الخطّة بخصمٍ اتُّفق عليه
            $table->decimal('paid', 10, 2)->nullable();
            $table->string('currency', 3)->nullable();

            $table->string('note', 300)->nullable();

            // من أنشأه من الموظّفين — للمساءلة
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            // سؤال «هل له وصول اليوم؟» يجلس على هذا الفهرس
            $table->index(['user_id', 'ends_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};
