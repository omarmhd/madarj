<?php

namespace App\Filament\Resources\UpgradeRequests\Tables;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\UpgradeRequest;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Notifications\Notification;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

/**
 * طابور طلبات الترقية — شاشة العمل اليوميّة.
 *
 * ── ولماذا الأقدم أوّلاً لا الأحدث ─────────────────────────
 * كل جدول آخر يُرتَّب بالأحدث. وهذا طابور: من انتظر أطول يُخدَم
 * أوّلاً، والترتيب بالأحدث يدفن من طلب أمس تحت طلبات اليوم — وهو
 * أشدّهم انتظاراً وأقربهم إلى الانصراف.
 *
 * ── والفعل الأهمّ: من الطلب إلى الاشتراك بنقرة ─────────────
 * الدفع يدويّ: الموظّف يتواصل ويحصّل ثم يجب أن **يُفعّل**. ولو كان
 * التفعيل في شاشة الاشتراكات لبحث عن المتدرّب مرّة ثانية ونسخ
 * الخطّة بيده — وكل نسخٍ يدويّ يُخطئ يوماً.
 */
class UpgradeRequestsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'asc')
            ->columns([
                TextColumn::make('created_at')
                    ->label('طُلب')
                    ->since()
                    ->sortable(),

                TextColumn::make('user.name')
                    ->label('المتدرّب')
                    ->searchable()
                    ->weight('bold')
                    ->description(fn ($record) => $record->user?->email),

                TextColumn::make('contact_value')
                    ->label('وسيلة التواصل')
                    ->copyable()
                    ->description(fn ($record) => UpgradeRequest::METHODS[$record->contact_method] ?? $record->contact_method),

                TextColumn::make('plan.name_ar')
                    ->label('الخطّة')
                    ->placeholder('لم يحدّد')
                    ->badge(),

                TextColumn::make('note')
                    ->label('ملاحظته')
                    ->wrap()
                    ->limit(60)
                    ->placeholder('—'),

                TextColumn::make('status')
                    ->label('الحالة')
                    ->badge()
                    ->formatStateUsing(fn ($state) => UpgradeRequest::STATUSES[$state] ?? $state)
                    ->color(fn ($state) => match ($state) {
                        'new'       => 'warning',
                        'contacted' => 'info',
                        'done'      => 'success',
                        'declined'  => 'gray',
                        default     => 'gray',
                    }),

                TextColumn::make('handler.name')
                    ->label('تولّاه')
                    ->placeholder('—')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->label('الحالة')
                    ->options(UpgradeRequest::STATUSES)
                    // الطابور يُفتح على ما لم يُنجَز
                    ->default('new'),
            ])
            ->recordActions([
                /*
                 * «تواصلنا معه» — نقرة واحدة.
                 *
                 * أكثر ما يفعله الموظّف: اتّصل، والجواب لم يأتِ بعد.
                 * ونموذجٌ بحقول لأجل ذلك يجعله لا يُسجَّل أصلاً، فيضيع
                 * الفرق بين من كُلِّم ومن لم يُكلَّم.
                 */
                Action::make('contacted')
                    ->label('تواصلنا')
                    ->icon('heroicon-o-phone')
                    ->color('info')
                    ->visible(fn ($record) => $record->status === 'new')
                    ->action(function ($record) {
                        $record->update([
                            'status'     => 'contacted',
                            'handled_by' => auth()->id(),
                            'handled_at' => now(),
                        ]);
                    }),

                Action::make('activate')
                    ->label('فعّل الاشتراك')
                    ->icon('heroicon-o-key')
                    ->color('success')
                    ->visible(fn ($record) => in_array($record->status, ['new', 'contacted'], true))
                    ->fillForm(fn ($record) => [
                        'plan_id'   => $record->plan_id,
                        'starts_on' => now()->toDateString(),
                        'ends_on'   => now()->addMonths($record->plan?->months ?? 1)->toDateString(),
                        'paid'      => $record->plan?->price,
                    ])
                    ->schema([
                        Select::make('plan_id')
                            ->label('الخطّة')
                            ->options(fn () => Plan::offered()->pluck('name_ar', 'id'))
                            ->live()
                            ->afterStateUpdated(function ($state, $set) {
                                $plan = Plan::find($state);
                                $set('ends_on', now()->addMonths($plan?->months ?? 1)->toDateString());
                                $set('paid', $plan?->price);
                            }),

                        DatePicker::make('starts_on')->label('يبدأ')->required(),
                        DatePicker::make('ends_on')->label('ينتهي')->required()->afterOrEqual('starts_on'),

                        TextInput::make('paid')->label('المحصَّل')->numeric(),

                        Textarea::make('admin_note')->label('ملاحظة داخليّة')->rows(2)->maxLength(500),
                    ])
                    ->action(function (array $data, $record) {
                        $plan = $data['plan_id'] ? Plan::find($data['plan_id']) : null;

                        Subscription::create([
                            'user_id'    => $record->user_id,
                            'plan_id'    => $plan?->id,
                            'starts_on'  => $data['starts_on'],
                            'ends_on'    => $data['ends_on'],
                            'is_free'    => blank($data['paid'] ?? null),
                            'paid'       => $data['paid'] ?: null,
                            'currency'   => $plan?->currency,
                            'note'       => 'من طلب ترقية #'.$record->id,
                            'created_by' => auth()->id(),
                        ]);

                        $record->update([
                            'status'     => 'done',
                            'admin_note' => $data['admin_note'] ?? $record->admin_note,
                            'handled_by' => auth()->id(),
                            'handled_at' => now(),
                        ]);

                        Notification::make()
                            ->title('فُعِّل حتى '.$data['ends_on'])
                            ->success()
                            ->send();
                    }),

                Action::make('decline')
                    ->label('انصرف')
                    ->icon('heroicon-o-x-mark')
                    ->color('gray')
                    ->visible(fn ($record) => in_array($record->status, ['new', 'contacted'], true))
                    ->schema([
                        Textarea::make('admin_note')
                            ->label('لماذا؟')
                            ->rows(2)
                            ->maxLength(500)
                            // السبب هو الفائدة كلّها: عشرة أسباب تقول لك ما يمنع البيع
                            ->helperText('سببه — وهو أهمّ ما يُجمَع من طلب لم يكتمل.'),
                    ])
                    ->action(fn (array $data, $record) => $record->update([
                        'status'     => 'declined',
                        'admin_note' => $data['admin_note'] ?? null,
                        'handled_by' => auth()->id(),
                        'handled_at' => now(),
                    ])),

                EditAction::make()->label('تعديل'),
            ]);
    }
}
