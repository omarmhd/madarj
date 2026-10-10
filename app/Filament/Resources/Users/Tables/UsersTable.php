<?php

namespace App\Filament\Resources\Users\Tables;

use App\Models\Plan;
use App\Models\Subscription;
use App\Support\Countries;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Notifications\Notification;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * جدول المتدرّبين — وهو شاشة عملٍ لا تقرير.
 *
 * ── ولماذا أُعيدت كتابته ───────────────────────────────────
 * المولّد يصبّ كل عمود في الجدول: `age_band` و`source` و`updated_at`
 * وكلمة المرور. وجدولٌ بأربعة عشر عموداً لا يُقرأ، والسؤال الذي
 * يُفتح له في الحقيقة واحد: **من هذا، وما حالة وصوله، وماذا أفعل؟**
 *
 * ── وحالة الوصول باستعلام فرعيّ لا بخدمة ───────────────────
 * `AccessService` يسأل القاعدة لكل متدرّب، وخمسٌ وعشرون صفّاً في
 * الصفحة تعني خمساً وعشرين استعلاماً. فآخر يوم وصول يأتي مع الصفّ
 * نفسه في استعلام واحد — والمنطق يبقى واحداً: صفٌّ سارٍ يعني وصولاً.
 */
class UsersTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(
                fn (Builder $query) => $query->withMax(
                    ['subscriptions as access_until' => fn ($q) => $q->active()],
                    'ends_on',
                ),
            )
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('name')
                    ->label('الاسم')
                    ->searchable()
                    ->weight('bold')
                    ->description(fn ($record) => $record->email),

                TextColumn::make('phone')
                    ->label('الواتساب')
                    ->searchable()
                    ->copyable()
                    ->placeholder('—'),

                TextColumn::make('country')
                    ->label('الدولة')
                    ->badge()
                    ->formatStateUsing(fn (?string $state) => Countries::options()[$state] ?? $state)
                    ->placeholder('—'),

                /*
                 * الحالة في عمود واحد.
                 *
                 * ثلاث حالات لا تجتمع: مشترِكٌ إلى تاريخ، أو في
                 * تجربته، أو انتهت تجربته ولم يشترك — وهذه الأخيرة
                 * هي من يُتواصل معه، فتُلوَّن لتُرى.
                 */
                TextColumn::make('access_until')
                    ->label('الوصول')
                    ->badge()
                    ->color(fn ($record) => match (true) {
                        (bool) $record->is_admin => 'gray',
                        $record->access_until !== null => 'success',
                        default => 'warning',
                    })
                    ->formatStateUsing(fn ($state, $record) => match (true) {
                        (bool) $record->is_admin => 'مدير',
                        $state !== null => 'مشترك حتى '.$state,
                        default => 'تجربة',
                    }),

                TextColumn::make('free_weeks')
                    ->label('أسابيع ممنوحة')
                    ->placeholder('العام')
                    ->alignCenter(),

                TextColumn::make('enrollment.current_week')
                    ->label('أسبوعه')
                    ->alignCenter()
                    ->placeholder('—'),

                /*
                 * Relative ("3 days ago") because the question is "who
                 * stopped coming back"; the exact time is in the tooltip.
                 */
                TextColumn::make('last_login_at')
                    ->label('آخر دخول')
                    ->since()
                    ->dateTimeTooltip('Y-m-d H:i')
                    ->placeholder('لم يدخل بعد')
                    ->sortable(),

                TextColumn::make('created_at')
                    ->label('سجّل في')
                    ->date('Y-m-d')
                    ->sortable(),
            ])
            ->filters([
                Filter::make('subscribed')
                    ->label('المشتركون فقط')
                    ->query(fn (Builder $q) => $q->whereHas(
                        'subscriptions',
                        fn ($s) => $s->active(),
                    )),

                Filter::make('trial')
                    ->label('في التجربة (لم يشترك)')
                    ->query(fn (Builder $q) => $q->whereDoesntHave(
                        'subscriptions',
                        fn ($s) => $s->active(),
                    )->where('is_admin', false)),

                SelectFilter::make('country')
                    ->label('الدولة')
                    ->options(Countries::options())
                    ->searchable(),
            ])
            ->recordActions([
                /*
                 * منح الوصول — الفعل الأكثر تكراراً في هذه الشاشة.
                 *
                 * الدفع يدويّ، فالموظّف يحصّل ثم يُنشئ المدّة. ولو كان
                 * ذلك في شاشة أخرى لصار كل تحصيل ثلاث نقرات وبحثاً
                 * عن المتدرّب مرّة ثانية.
                 *
                 * وتاريخ الانتهاء يُحسب من شهور الخطّة ولا يُكتب
                 * بيد: الحساب اليدويّ يُخطئ في فبراير وفي آخر الشهر.
                 */
                Action::make('grant')
                    ->label('منح وصول')
                    ->icon('heroicon-o-key')
                    ->color('success')
                    ->schema([
                        Select::make('plan_id')
                            ->label('الخطّة')
                            ->options(fn () => Plan::offered()->pluck('name_ar', 'id'))
                            ->placeholder('منحة بلا خطّة')
                            ->live()
                            ->afterStateUpdated(function ($state, $set) {
                                $months = Plan::find($state)?->months ?? 1;
                                $set('ends_on', now()->addMonths($months)->toDateString());
                            }),

                        DatePicker::make('starts_on')
                            ->label('يبدأ')
                            ->default(now())
                            ->required(),

                        DatePicker::make('ends_on')
                            ->label('ينتهي')
                            ->default(now()->addMonth())
                            ->required()
                            ->afterOrEqual('starts_on'),

                        TextInput::make('paid')
                            ->label('المدفوع')
                            ->numeric()
                            ->placeholder('اتركه فارغاً للمنحة'),

                        Textarea::make('note')
                            ->label('ملاحظة')
                            ->rows(2)
                            ->maxLength(300),
                    ])
                    ->action(function (array $data, $record) {
                        $plan = $data['plan_id'] ? Plan::find($data['plan_id']) : null;

                        Subscription::create([
                            'user_id'    => $record->id,
                            'plan_id'    => $plan?->id,
                            'starts_on'  => $data['starts_on'],
                            'ends_on'    => $data['ends_on'],
                            'is_free'    => blank($data['paid'] ?? null),
                            'paid'       => $data['paid'] ?: null,
                            'currency'   => $plan?->currency,
                            'note'       => $data['note'] ?? null,
                            'created_by' => auth()->id(),
                        ]);

                        Notification::make()
                            ->title('مُنح الوصول حتى '.$data['ends_on'])
                            ->success()
                            ->send();
                    }),

                EditAction::make()->label('تعديل'),
            ]);
    }
}
