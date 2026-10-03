<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ملاحظات العملاء ورسائلهم.
 *
 * ── ولا زمن حقيقيّ ─────────────────────────────────────────
 * كما طُلب: صندوقٌ يُقرأ، لا محادثة. وهذا قرارٌ يوفّر الكثير —
 * لا اتّصال دائم ولا إشعارات ولا حالة «يكتب الآن».
 *
 * ── والردّ حقلٌ واحد ───────────────────────────────────────
 * ردٌّ واحد يكفي لصندوق ملاحظات، ومحادثةٌ كاملة تحتاج جدولاً
 * للرسائل وعلاقةً وواجهة. فإن صار الردُّ حواراً فوقتها يُبنى.
 *
 * ── و`user_id` يقبل الفراغ ─────────────────────────────────
 * «تواصل معنا» قد يأتي من زائرٍ لم يسجّل بعد — وهو أهمّ من يُسمَع:
 * من لم يشترك بعد يقول لك لماذا.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            // من لم يسجّل يترك اسمه وبريده
            $table->string('name', 120)->nullable();
            $table->string('email', 160)->nullable();

            $table->string('kind', 20)->default('feedback');  // feedback · contact · bug
            $table->string('subject', 160)->nullable();
            $table->text('body');

            $table->string('status', 20)->default('new');  // new · read · answered · closed

            $table->text('reply')->nullable();
            $table->foreignId('answered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('answered_at')->nullable();

            $table->timestamps();

            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
