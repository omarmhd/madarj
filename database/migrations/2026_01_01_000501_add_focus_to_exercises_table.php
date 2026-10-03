<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ما يُدرّبه التمرين، وأي خطأ من العشرين يخدمه.
 *
 * السبب: `exercise_no` ترقيم من الكتاب («تمارين 1–2») لا يقول للمتعلّم
 * شيئاً عمّا سيُختبر فيه. التمرين بلا موضوع معلن يبدو عشوائياً،
 * والمتعلّم لا يعرف إن أخفق هل المشكلة في القاعدة أم في المفردة.
 *
 * `error_no` يربط التمرين بقائمة الأخطاء العشرين التي ينصّ `AGENTS.md`
 * على أن كل تمرين يجب أن يخدم واحداً منها. وقيمته التربوية تظهر عند
 * الخطأ: نعرض الصيغة الخاطئة بجانب الصحيحة، وهي أقوى لحظة تعليمية
 * في التمرين كله.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exercises', function (Blueprint $table) {
            // «فعل to be مع الضمائر» · «فهم الحوار الأول»
            $table->string('focus_ar')->nullable()->after('type');

            // 1..20 — أو null لتمرين لا يقابل خطأً بعينه (كفهم الحوار)
            $table->unsignedTinyInteger('error_no')->nullable()->after('focus_ar');
        });
    }

    public function down(): void
    {
        Schema::table('exercises', function (Blueprint $table) {
            $table->dropColumn(['focus_ar', 'error_no']);
        });
    }
};
