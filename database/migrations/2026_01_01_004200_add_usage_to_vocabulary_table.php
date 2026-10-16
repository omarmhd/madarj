<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * How each word is used — a sentence with the word in place, its
 * translation, and one line on where and how it is used.
 *
 * The book's `example` field is sometimes a sentence and often a note
 * ("The d is silent."), so only a quarter of the words could be shown
 * in use. These fields are written for every word; `target` is the exact
 * text in the sentence that the gap exercise blanks (null for long
 * phrases, which are shown in context but not typed).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vocabulary', function (Blueprint $table) {
            $table->string('target')->nullable()->after('example');
            $table->string('sentence', 500)->nullable()->after('target');
            $table->string('sentence_ar', 500)->nullable()->after('sentence');
            $table->string('usage_ar', 500)->nullable()->after('sentence_ar');
        });
    }

    public function down(): void
    {
        Schema::table('vocabulary', function (Blueprint $table) {
            $table->dropColumn(['target', 'sentence', 'sentence_ar', 'usage_ar']);
        });
    }
};
