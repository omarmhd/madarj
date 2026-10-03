<?php

namespace App\Filament\Resources\SentEmails;

use App\Filament\Resources\SentEmails\Pages\ListSentEmails;
use App\Models\SentEmail;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

/**
 * Read-only inbox of every email the platform has sent.
 */
class SentEmailResource extends Resource
{
    protected static ?string $navigationLabel = 'البريد المُرسَل';

    protected static ?string $modelLabel = 'رسالة بريد';

    protected static ?string $pluralModelLabel = 'البريد المُرسَل';

    protected static ?int $navigationSort = 90;

    protected static ?string $model = SentEmail::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedEnvelope;

    public static function canCreate(): bool
    {
        return false;
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('created_at')
                    ->label('أُرسل')
                    ->since()
                    ->sortable(),

                TextColumn::make('to')
                    ->label('إلى')
                    ->searchable()
                    ->copyable(),

                TextColumn::make('subject')
                    ->label('الموضوع')
                    ->searchable()
                    ->weight('bold')
                    ->wrap(),

                TextColumn::make('mailer')
                    ->label('الناقل')
                    ->badge()
                    ->color('gray'),
            ])
            ->recordActions([
                Action::make('open')
                    ->label('عرض')
                    ->icon(Heroicon::OutlinedEye)
                    ->modalHeading(fn (SentEmail $record) => $record->subject)
                    ->modalWidth('4xl')
                    ->modalSubmitAction(false)
                    ->modalContent(fn (SentEmail $record) => view('filament.sent-email', ['record' => $record])),

                DeleteAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListSentEmails::route('/'),
        ];
    }
}
