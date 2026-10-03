<?php

namespace App\Filament\Resources\Plans\Tables;

use Filament\Actions\EditAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class PlansTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('sort')
            ->columns([
                TextColumn::make('name_ar')
                    ->label('الخطّة')
                    ->weight('bold')
                    ->description(fn ($record) => $record->note_ar),

                TextColumn::make('months')
                    ->label('الشهور')
                    ->alignCenter(),

                TextColumn::make('price')
                    ->label('السعر')
                    ->formatStateUsing(fn ($state, $record) => $record->priceLabel()),

                // كم مشترِكاً عليها — الرقم الذي يقول أيّها تنجح
                TextColumn::make('subscriptions_count')
                    ->label('اشتراكات')
                    ->counts('subscriptions')
                    ->alignCenter(),

                IconColumn::make('is_active')
                    ->label('معروضة')
                    ->boolean(),

                TextColumn::make('sort')
                    ->label('الترتيب')
                    ->alignCenter()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->recordActions([EditAction::make()->label('تعديل')]);
    }
}
