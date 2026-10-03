<?php

namespace App\Filament\Resources\UpgradeRequests\Pages;

use App\Filament\Resources\UpgradeRequests\UpgradeRequestResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditUpgradeRequest extends EditRecord
{
    protected static string $resource = UpgradeRequestResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
