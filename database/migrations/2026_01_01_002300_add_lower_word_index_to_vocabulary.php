<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * An index for "do we already have this word?".
 *
 * ── Why ─────────────────────────────────────────────────────
 * `vocabulary` is indexed on `(week_id, group, position)`, which is
 * display order. The translator asks something else entirely — is this
 * word in the book? — with no week and no group. That was a full scan
 * of 1,898 rows on every word the learner saved.
 *
 * ── Why on LOWER(word) and not on word ──────────────────────
 * Because learners type "Work", "WORK" and "work", and the lookup
 * lowercases before comparing. An index on the bare column is not used
 * by a function over that column, so the scan would survive the index.
 *
 * ── Why this is written in SQL, per driver ──────────────────
 * Laravel's `Schema` builder has no expression indexes, so the DDL is
 * written by hand — and the three engines spell it differently:
 *
 *   Postgres / SQLite  CREATE INDEX IF NOT EXISTS … (LOWER(word))
 *   MySQL 8            no IF NOT EXISTS, and the expression needs its
 *                      own parentheses: ((LOWER(word)))
 *   MariaDB            no functional indexes at all — skipped
 *
 * The first MySQL run of this project died here. The comment above
 * used to claim the statement was portable; it was portable across the
 * two engines it had been run on. Hence the switch, and hence the
 * driver check below rather than one string for everyone.
 *
 * This is an index, not content: it touches no row, so §4.1 does not
 * apply to it.
 */
return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlsrv') {
            return;   // no expression indexes — a scan of 2k rows is acceptable
        }

        if ($this->isMariaDb()) {
            return;   // no functional indexes in MariaDB — a scan of 2k rows is acceptable
        }

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            // MySQL has no IF NOT EXISTS here, so ask before creating
            $exists = DB::selectOne(
                'SELECT 1 AS found FROM information_schema.statistics
                 WHERE table_schema = DATABASE()
                   AND table_name = ? AND index_name = ? LIMIT 1',
                ['vocabulary', 'vocabulary_lower_word_index']
            );

            if (! $exists) {
                // MySQL 8.0.13+ functional index — the extra parens are required
                DB::statement('CREATE INDEX vocabulary_lower_word_index ON vocabulary ((LOWER(word)))');
            }

            return;
        }

        DB::statement('CREATE INDEX IF NOT EXISTS vocabulary_lower_word_index ON vocabulary (LOWER(word))');
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlsrv') {
            return;
        }

        if ($this->isMariaDb()) {
            return;
        }

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            // DROP INDEX … IF EXISTS does not exist in MySQL either
            Schema::table('vocabulary', function ($table) {
                $table->dropIndex('vocabulary_lower_word_index');
            });

            return;
        }

        DB::statement('DROP INDEX IF EXISTS vocabulary_lower_word_index');
    }

    /**
     * MariaDB often sits behind the `mysql` driver (shared hosting), so the
     * driver name alone can't tell them apart — the server version can.
     */
    private function isMariaDb(): bool
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mariadb') {
            return true;
        }

        return $driver === 'mysql'
            && str_contains(strtolower(DB::selectOne('SELECT VERSION() AS v')->v), 'mariadb');
    }
};
