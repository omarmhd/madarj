<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * المفردات — 100 كلمة لكل أسبوع، 2400 صف إجمالاً.
 *
 * هذا الجدول يغذّي ثلاثة أشياء:
 *   1. جداول المفردات في صفحة الأسبوع
 *   2. البطاقات التعليمية (flashcards)
 *   3. نظام التكرار المتباعد عبر جدول review_cards
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vocabulary', function (Blueprint $table) {
            $table->id();

            $table->foreignId('week_id')->constrained()->cascadeOnDelete();

            // المجموعة داخل الأسبوع: family / numbers / days_months / core
            $table->string('group', 40);

            $table->string('word');                    // neighbour
            $table->string('ipa')->nullable();         // /ˈneɪbə(r)/
            $table->string('arabic');                  // جار
            $table->string('example')->nullable();     // Our neighbour is very kind.

            // ترتيب العرض داخل المجموعة
            $table->unsignedSmallInteger('position')->default(0);

            $table->timestamps();

            // الاستعلام الأشيع: كلمات أسبوع معيّن مرتّبة
            $table->index(['week_id', 'group', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vocabulary');
    }
};
