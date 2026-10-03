<?php

namespace App\Filament\Resources\Subscriptions\Schemas;

use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class SubscriptionForm
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
                DatePicker::make('starts_on')
                    ->required(),
                DatePicker::make('ends_on')
                    ->required(),
                Toggle::make('is_free')
                    ->required(),
                TextInput::make('paid')
                    ->numeric(),
                TextInput::make('currency'),
                TextInput::make('note'),
                TextInput::make('created_by')
                    ->numeric(),
            ]);
    }
}
