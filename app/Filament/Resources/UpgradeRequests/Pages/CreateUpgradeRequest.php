<?php

namespace App\Filament\Resources\UpgradeRequests\Pages;

use App\Filament\Resources\UpgradeRequests\UpgradeRequestResource;
use Filament\Resources\Pages\CreateRecord;

class CreateUpgradeRequest extends CreateRecord
{
    protected static string $resource = UpgradeRequestResource::class;
}
