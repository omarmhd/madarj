<?php

namespace App\Filament\Resources\Plans\Schemas;

use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

/**
 * خطّة — سعرٌ ومدّة يضبطهما المدير.
 *
 * ── ولماذا العملة قائمة لا نصّ حرّ ─────────────────────────
 * حقلٌ حرّ يُنتج «USD» و«usd» و«دولار» و«$» في أربعة صفوف، ثم لا
 * يُجمع عليها تقرير ولا تُعرض بصيغة واحدة. والقائمة تمنع ذلك من
 * أوّل صفّ.
 */
class PlanForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->columns(2)
            ->components([
                TextInput::make('name_ar')
                    ->label('الاسم كما يراه العميل')
                    ->required()
                    ->maxLength(80)
                    ->placeholder('سنة كاملة'),

                TextInput::make('months')
                    ->label('المدّة بالشهور')
                    ->numeric()
                    ->required()
                    ->minValue(1)
                    ->maxValue(60)
                    ->helperText('منها يُحسب تاريخ الانتهاء عند التفعيل.'),

                TextInput::make('price')
                    ->label('السعر')
                    ->numeric()
                    ->required()
                    ->minValue(0),

                Select::make('currency')
                    ->label('العملة')
                    ->options([
                        'USD' => 'دولار أمريكي (USD)',
                        'EGP' => 'جنيه مصري (EGP)',
                        'SAR' => 'ريال سعودي (SAR)',
                        'AED' => 'درهم إماراتي (AED)',
                        'KWD' => 'دينار كويتي (KWD)',
                        'JOD' => 'دينار أردني (JOD)',
                        'QAR' => 'ريال قطري (QAR)',
                    ])
                    ->default('USD')
                    ->required(),

                TextInput::make('note_ar')
                    ->label('سطر تحت السعر')
                    ->maxLength(160)
                    ->placeholder('يوفّر شهرين')
                    ->columnSpanFull(),

                TextInput::make('sort')
                    ->label('الترتيب')
                    ->numeric()
                    ->default(0)
                    ->helperText('الأصغر يظهر أوّلاً.'),

                Toggle::make('is_active')
                    ->label('معروضة على العملاء')
                    ->default(true)
                    ->helperText('المعطَّلة تبقى في السجلّ ولا تُعرض، فلا تُكسَر اشتراكاتها.'),
            ]);
    }
}
