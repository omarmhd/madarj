<?php

namespace App\Filament\Resources\Messages\Tables;

use App\Models\Message;
use Filament\Actions\Action;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Textarea;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

/**
 * صندوق الرسائل — يُقرأ ويُجاب، ولا يُحادَث.
 *
 * ── والجديد يُعلَّم «قُرئ» عند فتحه لا بنقرة ───────────────
 * علامةٌ تحتاج نقرةً منفصلة لا تُنقَر: فيبقى الصندوق كلّه «جديداً»
 * ويفقد معناه. وفتحُ الرسالة هو قراءتها، فالحالة تتبع الفعل.
 */
class MessagesTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('created_at')
                    ->label('وصلت')
                    ->since()
                    ->sortable(),

                TextColumn::make('sender')
                    ->label('المُرسِل')
                    ->state(fn ($record) => $record->senderName())
                    ->description(fn ($record) => $record->user?->email ?? $record->email)
                    ->weight('bold')
                    ->searchable(query: fn ($query, $search) => $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhereHas('user', fn ($u) => $u
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%"))),

                TextColumn::make('kind')
                    ->label('النوع')
                    ->badge()
                    ->formatStateUsing(fn ($state) => Message::KINDS[$state] ?? $state)
                    ->color(fn ($state) => $state === 'bug' ? 'danger' : 'gray'),

                TextColumn::make('body')
                    ->label('الرسالة')
                    ->wrap()
                    ->limit(90)
                    ->description(fn ($record) => $record->subject),

                TextColumn::make('status')
                    ->label('الحالة')
                    ->badge()
                    ->formatStateUsing(fn ($state) => Message::STATUSES[$state] ?? $state)
                    ->color(fn ($state) => match ($state) {
                        'new'      => 'warning',
                        'answered' => 'success',
                        default    => 'gray',
                    }),
            ])
            ->filters([
                SelectFilter::make('status')->label('الحالة')->options(Message::STATUSES),
                SelectFilter::make('kind')->label('النوع')->options(Message::KINDS),
            ])
            ->recordActions([
                ViewAction::make()
                    ->label('اقرأ')
                    ->after(fn ($record) => $record->status === 'new'
                        ? $record->update(['status' => 'read'])
                        : null),

                Action::make('answer')
                    ->label('سجّل الردّ')
                    ->icon('heroicon-o-chat-bubble-left-right')
                    ->color('success')
                    ->visible(fn ($record) => $record->status !== 'answered')
                    ->schema([
                        Textarea::make('reply')
                            ->label('ما أجبتَه به')
                            ->rows(4)
                            ->required()
                            ->maxLength(2000)
                            // الحفظ هنا ليس إرسالاً: الردّ يُرسَل بيدك
                            ->helperText('يُحفظ للسجلّ — الإرسال يقع منك على وسيلته.'),
                    ])
                    ->action(fn (array $data, $record) => $record->update([
                        'status'      => 'answered',
                        'reply'       => $data['reply'],
                        'answered_by' => auth()->id(),
                        'answered_at' => now(),
                    ])),
            ]);
    }
}
