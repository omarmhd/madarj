<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `due_at` becomes DATETIME, because TIMESTAMP stops in 2038.
 *
 * ── The bug this prevents ───────────────────────────────────
 * Spaced repetition schedules forward without limit. ts-fsrs is
 * generated with `maximum_interval: 36500` — a hundred years — so a
 * card the learner keeps getting right eventually comes due in 2040,
 * 2060, 2120. That is the system working correctly.
 *
 * MySQL's TIMESTAMP ends at 2038-01-19, and in strict mode it does not
 * round or warn: the INSERT is rejected outright, so saving that review
 * answers 500. Postgres and SQLite have no such ceiling, which is why
 * this survived every run before the move to MySQL — and why it would
 * not have surfaced in testing either. It needs a learner with a card
 * mature enough to schedule past 2038, which is years of real use.
 *
 * DATETIME runs to the year 9999 on MySQL, and Laravel maps `dateTime`
 * to the same types the other two engines already used, so nothing
 * changes for them.
 *
 * ── Progress family ─────────────────────────────────────────
 * Both tables are progress, not content (§4.1). This alters column
 * types only; it reads and writes no row.
 */
return new class extends Migration
{
    /** The two schedulers — review cards and the learner's own words */
    protected array $tables = ['review_cards', 'memory_words'];

    public function up(): void
    {
        foreach ($this->tables as $table) {
            Schema::table($table, function (Blueprint $t) {
                // type only — re-declaring ->index() would try to create
                // the existing index again, which MySQL rejects as 1061
                $t->dateTime('due_at')->change();
            });
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->timestamp('due_at')->change();
            });
        }
    }
};
