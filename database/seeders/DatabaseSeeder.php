<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\ProgressService;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Creates the admin account from .env (ADMIN_NAME, ADMIN_EMAIL,
     * ADMIN_PASSWORD). Safe to run again: an existing account keeps its
     * password and is only re-flagged as admin.
     */
    public function run(): void
    {
        $email = env('ADMIN_EMAIL');
        $password = env('ADMIN_PASSWORD');

        if (! $email || ! $password) {
            $this->command->warn('ADMIN_EMAIL / ADMIN_PASSWORD missing from .env — no admin created.');

            return;
        }

        $admin = User::firstOrCreate(
            ['email' => $email],
            ['name' => env('ADMIN_NAME', 'Admin'), 'password' => $password],
        );

        // Not fillable on purpose — set directly
        $admin->is_admin = true;
        $admin->email_verified_at ??= now();
        $admin->save();

        // Enrolling needs week 1 — on a fresh install content:import runs after the seeder
        if (! \App\Models\Week::exists()) {
            $this->command->warn('No content yet — run content:import, then db:seed again to enroll the admin.');
        } elseif (! $admin->enrollment()->exists()) {
            app(ProgressService::class)->enroll($admin, 'A', 'Africa/Cairo');
        }

        $this->command->info("Admin ready: {$email}");
    }
}
