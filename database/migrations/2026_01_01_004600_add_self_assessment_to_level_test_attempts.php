<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The learner's own rating of the test's free writing — progress family.
 * Kept apart from `score`: a self-rating never counts toward a pass.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('level_test_attempts', function (Blueprint $table) {
            $table->json('self_assessment')->nullable()->after('sections');
        });
    }

    public function down(): void
    {
        Schema::table('level_test_attempts', function (Blueprint $table) {
            $table->dropColumn('self_assessment');
        });
    }
};
