<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use App\Services\AccessService;
use BackedEnum;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;

/**
 * الإعدادات — وفيها القرار التسويقيّ الأهمّ.
 *
 * ── لماذا صفحة لا مورد ─────────────────────────────────────
 * الإعدادات ليست صفوفاً تُضاف وتُحذف: هي قيمٌ معلومة تُعدَّل. وجدولٌ
 * بمفتاحٍ وقيمة أمام الموظّف يعني أن يكتب `trial_weeks` بيده —
 * وخطأٌ في حرف يُسقط البوّابة كلّها.
 *
 * ── وعدد أسابيع التجربة قرارٌ يتغيّر في يوم ────────────────
 * حملةٌ تفتح أسبوعين، وأخرى ترجع إلى واحد. ولو كان في `config/`
 * لاحتاج كل تغييرٍ نشرةً ومبرمجاً — وهذا يعني أنّه لن يُجرَّب.
 */
class Settings extends Page
{
    protected string $view = 'filament.pages.settings';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCog6Tooth;

    protected static ?string $navigationLabel = 'الإعدادات';

    protected static ?string $title = 'الإعدادات';

    protected static ?int $navigationSort = 9;

    public ?array $data = [];

    public function mount(): void
    {
        $access = app(AccessService::class);

        $this->form->fill([
            'trial_days'     => $access->trialDays(),
            'trial_weeks'    => (int) Setting::get('trial_weeks', AccessService::DEFAULT_TRIAL_WEEKS),
            'trial_features' => $access->trialFeatures(),
        ]);
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('التجربة المجّانيّة')
                    ->description('يسري على كل من لم يُمنَح استثناءً في صفحته.')
                    ->schema([
                        TextInput::make('trial_days')
                            ->label('مدّة التجربة بالأيام')
                            ->numeric()
                            ->required()
                            ->minValue(0)
                            ->maxValue(365)
                            ->suffix('يوماً')
                            // Counted from sign-up, and what happens at the end, said plainly
                            ->helperText('تُحسب من يوم التسجيل. بعدها تُغلق المنصّة كلّها على غير المشترك وتظهر له صفحة الاشتراك. والصفر يعني تجربة بلا حدّ زمنيّ.'),

                        TextInput::make('trial_weeks')
                            ->label('عدد الأسابيع المفتوحة بلا اشتراك')
                            ->numeric()
                            ->required()
                            ->minValue(0)
                            ->maxValue(24)
                            // الصفر يُغلق التجربة كلّها: يُقال صريحاً
                            ->helperText('الصفر يُغلق الدورة على غير المشتركين تماماً — حتى الأسبوع الأول.'),
                    ]),

                Section::make('ميزات التجربة المجّانيّة')
                    ->description('ما يُفتح للمتدرّب في فترة التجربة. وما لا تختاره يظهر له مقفلاً بزرّ اشتراك. والمشترك يملك كل شيء.')
                    ->schema([
                        CheckboxList::make('trial_features')
                            ->label('الميزات المتاحة في التجربة')
                            ->options(AccessService::FEATURES)
                            ->columns(2)
                            ->bulkToggleable(),
                    ]),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();

        Setting::put('trial_days', (int) $data['trial_days']);
        Setting::put('trial_weeks', (int) $data['trial_weeks']);
        Setting::put('trial_features', json_encode(array_values($data['trial_features'] ?? [])));

        $days = (int) $data['trial_days'];

        Notification::make()
            ->title('حُفظ. التجربة '.($days > 0 ? $days.' يوماً' : 'بلا حدّ زمنيّ')
                .' و'.(int) $data['trial_weeks'].' أسبوعاً من الدروس، بـ'
                .count($data['trial_features'] ?? []).' من '.count(AccessService::FEATURES).' ميزات.')
            ->success()
            ->send();
    }
}
