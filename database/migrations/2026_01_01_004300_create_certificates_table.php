<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Certificates — one per level passed (A1 · A2 · A2+ · B1).
 *
 * Progress family: written when a level test is passed, never by
 * `content:import`. The name is a copy taken at issue, editable by the
 * learner (the account name is often a first name only), and `code` is
 * what the printed QR points at: anyone holding it can check the
 * certificate is real at /certificates/{code}, without an account.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('level_test_id')->constrained()->cascadeOnDelete();
            $table->foreignId('level_test_attempt_id')->nullable()->constrained()->nullOnDelete();
            $table->string('code', 16)->unique();
            $table->string('level', 4);
            $table->string('name', 120);
            $table->unsignedTinyInteger('percent');
            $table->timestamp('issued_at');
            $table->timestamps();

            // The first pass earns it; a later sitting does not issue a second
            $table->unique(['user_id', 'level_test_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificates');
    }
};
