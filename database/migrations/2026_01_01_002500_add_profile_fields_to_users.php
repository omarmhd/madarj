<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who is actually arriving.
 *
 * ── Why collect this at registration ────────────────────────
 * There is no second chance. A learner who signs up and starts
 * week one will not come back to fill in a profile, and the two
 * fields that matter most are needed before day one even opens:
 *
 *   `country` — infers the timezone, and the timezone decides when
 *               a day rolls over and whether a streak survives the
 *               night. Asking for an IANA zone would lose people;
 *               asking for a country does not.
 *   `phone`   — the only channel that reaches an Arabic-speaking
 *               learner reliably. Email gets ignored; WhatsApp does
 *               not.
 *
 * The rest — nationality, age band, goal, source — is segmentation
 * that cannot be reconstructed later.
 *
 * ── Why on `users`, not a separate profile table ────────────
 * One row per person, always read together with the person, never
 * without them. A join would buy nothing.
 *
 * Progress family: written by the user at registration, never
 * touched by `content:import`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Contact — the channel that actually reaches them
            $table->string('phone', 32)->nullable()->after('email');

            // Where they are: infers the timezone
            $table->string('country', 2)->nullable()->after('phone');
            $table->string('nationality', 2)->nullable()->after('country');

            // Who they are, for reading the cohort — not for gating
            $table->string('age_band', 16)->nullable()->after('nationality');
            $table->string('goal', 16)->nullable()->after('age_band');
            $table->string('source', 16)->nullable()->after('goal');

            // Where they think they start. The course begins at A1, and a
            // mismatch here is worth seeing in the data rather than in a
            // week-three drop-off.
            $table->string('start_level', 16)->nullable()->after('source');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'phone', 'country', 'nationality',
                'age_band', 'goal', 'source', 'start_level',
            ]);
        });
    }
};
