<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * A learner.
 *
 * Registration asks for two profile columns. `country` is not
 * optional data: it infers the timezone, and the timezone decides
 * when a day rolls over and whether a streak survives the night.
 * `phone` is the channel that reaches an Arabic-speaking learner
 * when email does not. The rest are nullable and unasked — the
 * profile screen is where they belong.
 */
#[Fillable([
    'name', 'email', 'password', 'phone', 'country',
    // Not asked at registration — the profile screen is their place
    'age_band', 'goal', 'source', 'start_level',
])]
#[Hidden(['password', 'remember_token'])]
/**
 * ولماذا يحمل المستخدم `canAccessPanel`.
 *
 * Filament يسأل هذا العقد قبل أن يفتح لوحته، ولا يسأل غيره. وبلا
 * تطبيقه يفتحها **كل** من سجّل دخوله — أي كل متدرّب. فهو ليس
 * تحسيناً بل الباب نفسه.
 */
class User extends Authenticatable implements FilamentUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'free_weeks' => 'integer',
        ];
    }

    public function canAccessPanel(Panel $panel): bool
    {
        return (bool) $this->is_admin;
    }

    /** مُدَد وصوله — المدفوعة والممنوحة */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /** Their enrolment — exactly one row per user */
    public function enrollment(): HasOne
    {
        return $this->hasOne(Enrollment::class);
    }

    /** Their run of consecutive days */
    public function streak(): HasOne
    {
        return $this->hasOne(Streak::class);
    }
}
