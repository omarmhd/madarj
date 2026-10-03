<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Arabic naming and coaching for each sound contrast.
 *
 * ── The bug this fixes ──────────────────────────────────────
 * The drill showed the book's own English heading to an absolute
 * beginner — `short oo against long oo` — and nothing else. A
 * learner on day one of A1 cannot read that sentence. It is the
 * label of the very skill the platform exists to teach, written
 * in the language they came here to learn.
 *
 * ── Why two columns, not one ────────────────────────────────
 * A translated label fixes the reading but not the learning:
 * "الضمّة القصيرة والممدودة" still does not say *what to do*. So
 * `hint_ar` carries the coaching the book gives elsewhere — where
 * the sound sits, which Arabic sound it is or is not, and the one
 * physical thing to change. That is the difference between naming
 * a contrast and being able to hear it.
 *
 * Content family: filled by `content:import` from the week JSON,
 * never written by a user.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('minimal_pairs', function (Blueprint $table) {
            // The contrast named in Arabic — what the learner reads
            $table->string('group_label_ar')->nullable()->after('group_label');

            // How to tell the two apart, and how to produce each
            $table->text('hint_ar')->nullable()->after('group_label_ar');
        });
    }

    public function down(): void
    {
        Schema::table('minimal_pairs', function (Blueprint $table) {
            $table->dropColumn(['group_label_ar', 'hint_ar']);
        });
    }
};
