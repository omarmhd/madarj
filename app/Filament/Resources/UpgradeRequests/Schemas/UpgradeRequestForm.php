<?php

namespace App\Filament\Resources\UpgradeRequests\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class UpgradeRequestForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('user_id')
                    ->relationship('user', 'name')
                    ->required(),
                Select::make('plan_id')
                    ->relationship('plan', 'id'),
                TextInput::make('contact_method')
                    ->required(),
                TextInput::make('contact_value')
                    ->required(),
                TextInput::make('note'),
                TextInput::make('status')
                    ->required()
                    ->default('new'),
                TextInput::make('admin_note'),
                TextInput::make('handled_by')
                    ->numeric(),
                DateTimePicker::make('handled_at'),
            ]);
    }
}
