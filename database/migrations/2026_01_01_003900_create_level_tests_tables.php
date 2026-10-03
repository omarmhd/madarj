<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Level tests — one per module, A1 · A2 · A2+ · B1.
 *
 * Two families, as everywhere else (§4.1):
 *   level_tests          content  — written by `level-tests:import` only
 *   level_test_attempts  progress — one row per sitting
 *
 * The questions and their answers live in one JSON column: a test is
 * always read whole, never queried by item, and the answers are
 * stripped before anything reaches the browser (§4.4).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('level_tests', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 16)->unique();          // a1, a2, a2plus, b1
            $table->string('level', 4);                    // A1, A2, A2+, B1
            $table->unsignedTinyInteger('after_week');     // the review week it gates
            $table->string('title_ar');
            $table->string('title_en');
            $table->unsignedSmallInteger('minutes');
            $table->unsignedTinyInteger('pass_percent')->default(60);
            $table->json('body');                          // tips + sections, answers included
            $table->timestamps();
        });

        Schema::create('level_test_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('level_test_id')->constrained()->cascadeOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('deadline_at');
            $table->timestamp('submitted_at')->nullable();
            $table->json('answers')->nullable();           // saved as they go, so a reload loses nothing
            $table->unsignedSmallInteger('score')->nullable();
            $table->unsignedSmallInteger('max')->nullable();
            $table->json('sections')->nullable();          // per-section score, for the diagnosis
            $table->unsignedSmallInteger('focus_lost')->default(0);
            $table->boolean('passed')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'level_test_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('level_test_attempts');
        Schema::dropIfExists('level_tests');
    }
};
