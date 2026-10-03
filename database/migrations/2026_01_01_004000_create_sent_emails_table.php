<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Every email the platform sends, kept for the admin to read.
 *
 * Filled by a MessageSent listener (App\Listeners\StoreSentEmail, auto-discovered), so it works with
 * any mailer — `log` in development, SMTP in production — and the admin
 * sees verification and password-reset links without opening log files.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sent_emails', function (Blueprint $table) {
            $table->id();
            $table->string('to', 500);
            $table->string('subject', 500)->nullable();
            $table->longText('html')->nullable();
            $table->longText('text')->nullable();
            $table->string('mailer', 30)->nullable();
            $table->timestamps();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sent_emails');
    }
};
