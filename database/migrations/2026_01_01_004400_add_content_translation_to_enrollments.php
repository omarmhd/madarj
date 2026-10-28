<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Content translation, a setting of its own.
 *
 * It rode on the interface language: choosing English hid the Arabic
 * translation of the content and switched every button to English at
 * once. Two decisions in one switch — a beginner who wants Arabic
 * buttons and a harder, translation-free dialogue could not have both.
 * Existing learners on English keep what they had: translation off.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->boolean('content_translation')->default(true)->after('locale');
        });

        \Illuminate\Support\Facades\DB::table('enrollments')->where('locale', 'en')->update(['content_translation' => false]);
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropColumn('content_translation');
        });
    }
};
