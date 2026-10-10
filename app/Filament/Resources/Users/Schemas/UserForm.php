<?php

namespace App\Filament\Resources\Users\Schemas;

use App\Support\Countries;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

/**
 * Editing a learner — what is left out matters as much as what is in.
 *
 * ── The password ────────────────────────────────────────────
 * Required when the admin creates an account (there is no other way
 * to hand it over), optional when editing. An empty field is never
 * saved, so editing a name does not wipe the password, and the
 * model's `hashed` cast hashes it — hashing here too would hash twice.
 *
 * ── What is left out ────────────────────────────────────────
 * `age_band`, `goal`, `source` and `start_level` are written by the
 * learner during setup. Editing them here corrupts their data rather
 * than fixing it.
 */
class UserForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('البيانات')
                    ->columns(2)
                    ->schema([
                        TextInput::make('name')
                            ->label('الاسم')
                            ->required()
                            ->maxLength(120),

                        TextInput::make('email')
                            ->label('البريد')
                            ->email()
                            ->required()
                            ->unique(ignoreRecord: true),

                        TextInput::make('phone')
                            ->label('الواتساب')
                            ->tel()
                            ->maxLength(32),

                        Select::make('country')
                            ->label('الدولة')
                            ->options(Countries::options())
                            ->searchable()
                            ->native(false)
                            ->placeholder('اختر الدولة')
                            ->searchPrompt('اكتب اسم الدولة للبحث')
                            ->noSearchResultsMessage('لا توجد دولة بهذا الاسم'),

                        TextInput::make('password')
                            ->label('كلمة المرور')
                            ->password()
                            ->revealable()
                            ->minLength(8)
                            ->maxLength(255)
                            ->autocomplete('new-password')
                            ->required(fn (string $operation) => $operation === 'create')
                            ->dehydrated(fn (?string $state) => filled($state))
                            ->helperText(fn (string $operation) => $operation === 'edit'
                                ? 'اتركها فارغة لتبقى كلمة المرور الحالية.'
                                : '8 أحرف على الأقل.'),
                    ]),

                Section::make('الوصول')
                    ->description('الاشتراكات تُضاف من زرّ «منح وصول» في الجدول — هنا التجربة وحدها.')
                    ->columns(2)
                    ->schema([
                        /*
                         * Empty means "follow the global setting", zero
                         * means "stop their trial". They differ, so the
                         * difference is written under the field.
                         */
                        TextInput::make('free_weeks')
                            ->label('أسابيع مجّانيّة لهذا المتدرّب')
                            ->numeric()
                            ->minValue(0)
                            ->maxValue(24)
                            ->placeholder('اتركه فارغاً ليتبع الإعداد العامّ')
                            ->helperText('الصفر يوقف تجربته تماماً. والفراغ يتبع العدد العامّ.'),

                        Toggle::make('is_admin')
                            ->label('مدير')
                            ->helperText('يفتح /admin، ويفتح له الدورة كلّها.'),
                    ]),
            ]);
    }
}
