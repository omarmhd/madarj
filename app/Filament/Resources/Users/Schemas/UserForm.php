<?php

namespace App\Filament\Resources\Users\Schemas;

use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

/**
 * تعديل متدرّب — وما لا يُعدَّل أهمّ ممّا يُعدَّل.
 *
 * ── لماذا لا كلمة مرور هنا ─────────────────────────────────
 * المولّد وضعها حقلاً مطلوباً. وموظّفٌ يضبط كلمة مرور متدرّب يملك
 * حسابه — وهي مسؤوليّة لا يحتاجها أحد: من نسيها يستعيدها بنفسه.
 * وأسوأ من ذلك أنّ الحقل المطلوب يمنع حفظ أيّ تعديل آخر بدونه.
 *
 * ── وما حُذف كذلك ──────────────────────────────────────────
 * `age_band` و`goal` و`source` و`start_level` يكتبها المتدرّب عن
 * نفسه في التهيئة، وتعديلها من هنا يفسد بياناته لا يصلحها.
 * تُقرأ في صفحته ولا تُكتب.
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
                            ->options(fn () => \App\Support\Countries::forSelect())
                            ->searchable(),
                    ]),

                Section::make('الوصول')
                    ->description('الاشتراكات تُضاف من زرّ «منح وصول» في الجدول — هنا التجربة وحدها.')
                    ->columns(2)
                    ->schema([
                        /*
                         * الفراغ يعني «اتبع الإعداد العامّ»، والصفر
                         * يعني «أوقف تجربته». وهما مختلفان، فالفرق
                         * مكتوبٌ تحت الحقل لا في رأس الموظّف.
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
