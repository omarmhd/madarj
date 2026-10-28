<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who tells the story: `f` (Jenny) or `m` (Alan).
 *
 * Chosen per story in the content, not by the learner: a story about
 * Della or Mathilde is told by a woman, one about Juha by a man. The
 * recording is made in that voice (scripts/narrate-stories.py), and a
 * story without a recording falls back to the browser in the same one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            $table->char('narrator', 1)->default('m')->after('level');
        });
    }

    public function down(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            $table->dropColumn('narrator');
        });
    }
};
