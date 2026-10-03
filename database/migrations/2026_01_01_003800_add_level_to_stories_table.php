<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The level a story is written at — A1, A2, A2+, B1, B1+.
 *
 * ── Why a level and not a week ──────────────────────────────
 * Stories are extended reading outside the study hour, not part of
 * a week. What a learner needs to know is "can I read this yet?",
 * and the levels are the course's own milestones (LevelCard): A1 is
 * module 1, A2 module 2, A2+ module 3, B1 module 4, B1+ beyond it.
 *
 * ── Where the value comes from ──────────────────────────────
 * Authored in `content/stories-*.json`, graded by the hardest
 * structure the story uses (mapped to the week the book teaches it)
 * and by how common its unglossed words are. `stories:import`
 * rejects a story without one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            $table->string('level', 4)->default('A2')->after('title_ar')->index();
        });
    }

    public function down(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            $table->dropColumn('level');
        });
    }
};
