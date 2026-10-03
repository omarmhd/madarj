<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * السلسلة اليومية — صف واحد لكل مستخدم يُحدَّث ولا يُضاف إليه.
 *
 * قاعدة الكتاب: "يوم فائت ليس فشلاً. يومان فائتان خطر."
 * لذلك نسمح بفجوة يوم واحد دون كسر السلسلة.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('streaks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete()->unique();

            $table->unsignedSmallInteger('current')->default(0);
            $table->unsignedSmallInteger('longest')->default(0);

            // آخر يوم نشاط — بتوقيت المستخدم لا بتوقيت الخادم
            $table->date('last_active_on')->nullable();

            // عدد "أيام النعمة" المتبقية — تسمح بفجوة يوم بلا كسر
            $table->unsignedTinyInteger('grace_days')->default(1);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('streaks');
    }
};
