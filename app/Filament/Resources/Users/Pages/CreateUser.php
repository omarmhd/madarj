<?php

namespace App\Filament\Resources\Users\Pages;

use App\Filament\Resources\Users\UserResource;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Database\Eloquent\Model;

class CreateUser extends CreateRecord
{
    protected static string $resource = UserResource::class;

    /** See `EditUser::handleRecordUpdate()` — same unfillable fields. */
    protected function handleRecordCreation(array $data): Model
    {
        $model = static::getModel();

        $record = (new $model)->forceFill($data);
        $record->save();

        return $record;
    }
}
