<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Nationality is dropped.
 *
 * ── Why it goes rather than sitting nullable ────────────────
 * It answered no question the platform asks. The country already
 * gives the timezone the streak depends on, and nothing in the
 * course branches on citizenship. A column nobody reads is a
 * column somebody will eventually try to use.
 *
 * ── What stays ──────────────────────────────────────────────
 * `phone` stays and is still asked: it is the channel that reaches
 * an Arabic-speaking learner when email does not.
 *
 * `age_band`, `goal`, `source` and `start_level` stay as nullable
 * columns but are no longer asked at registration — the form was
 * too long, and every extra field at the door costs signups. The
 * profile screen is their place, after the learner has committed,
 * and keeping the columns means that costs no migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('nationality');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('nationality', 2)->nullable()->after('country');
        });
    }
};
