<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * تفضيلات المتدرّب — يختارها مرة في صفحة التهيئة.
 *
 * موضعها في `enrollments` لا `users`: هي تفضيلات **تعلّم** لا هوية،
 * ومَن يعيد الدورة قد يعيدها بإعدادات مختلفة. ونفس منطق `track`
 * و`timezone` الموجودين هنا أصلاً.
 *
 * `setup_done_at` هو ما يمنع إظهار صفحة التهيئة كل مرة.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            // الصوت المفضّل في النطق: أنثى · ذكر · طفل
            $table->string('voice', 8)->default('f')->after('track');

            // السرعة الافتراضية — الكتاب يوصي 0.8 للاستماع الأول
            $table->float('speech_rate')->default(0.8)->after('voice');

            // نهاري أو ليلي أو تبعاً للنظام
            $table->string('theme', 8)->default('light')->after('speech_rate');

            /**
             * لغة الواجهة: ar تُظهر الترجمة العربية · en تُخفيها.
             * وهي ليست i18n كاملاً بعد — الواجهة عربية، وهذا الخيار
             * يحكم عرض ترجمات المحتوى لا نصوص الواجهة.
             */
            $table->string('locale', 5)->default('ar')->after('theme');

            $table->timestamp('setup_done_at')->nullable()->after('locale');
        });
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropColumn(['voice', 'speech_rate', 'theme', 'locale', 'setup_done_at']);
        });
    }
};
