<?php

namespace App\Filament\Resources\UpgradeRequests;

use App\Filament\Resources\UpgradeRequests\Pages\CreateUpgradeRequest;
use App\Filament\Resources\UpgradeRequests\Pages\EditUpgradeRequest;
use App\Filament\Resources\UpgradeRequests\Pages\ListUpgradeRequests;
use App\Filament\Resources\UpgradeRequests\Schemas\UpgradeRequestForm;
use App\Filament\Resources\UpgradeRequests\Tables\UpgradeRequestsTable;
use App\Models\UpgradeRequest;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class UpgradeRequestResource extends Resource
{
    protected static ?string $navigationLabel = 'طلبات الترقية';

    protected static ?string $modelLabel = 'طلب ترقية';

    protected static ?string $pluralModelLabel = 'طلبات الترقية';

    protected static ?int $navigationSort = 3;

    protected static ?string $model = UpgradeRequest::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedArrowTrendingUp;

    public static function form(Schema $schema): Schema
    {
        return UpgradeRequestForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return UpgradeRequestsTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListUpgradeRequests::route('/'),
            'create' => CreateUpgradeRequest::route('/create'),
            'edit' => EditUpgradeRequest::route('/{record}/edit'),
        ];
    }
}
