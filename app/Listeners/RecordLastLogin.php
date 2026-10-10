<?php

namespace App\Listeners;

use Illuminate\Auth\Events\Login;

/**
 * Stamps `last_login_at` on every sign-in, including the silent one
 * from a "remember me" cookie — that also fires `Login`.
 *
 * Written through the query builder so `updated_at` stays the time
 * the profile last changed, not the time they last signed in.
 */
class RecordLastLogin
{
    public function handle(Login $event): void
    {
        $user = $event->user;

        $user->newQuery()
            ->whereKey($user->getAuthIdentifier())
            ->toBase()
            ->update(['last_login_at' => now()]);

        $user->last_login_at = now();
        $user->syncOriginalAttribute('last_login_at');
    }
}
