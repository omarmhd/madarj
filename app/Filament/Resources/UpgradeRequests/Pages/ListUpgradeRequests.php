<?php

namespace App\Filament\Resources\UpgradeRequests\Pages;

use App\Filament\Resources\UpgradeRequests\UpgradeRequestResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListUpgradeRequests extends ListRecords
{
    protected static string $resource = UpgradeRequestResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
