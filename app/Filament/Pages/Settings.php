<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use App\Services\AccessService;
use BackedEnum;
use App\Support\Theme;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\ColorPicker;
use Filament\Forms\Components\Radio;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Components\Html;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Utilities\Get;
use Illuminate\Support\HtmlString;
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
        $theme = Theme::settings();

        $this->form->fill([
            'trial_days'     => $access->trialDays(),
            'trial_weeks'    => (int) Setting::get('trial_weeks', AccessService::DEFAULT_TRIAL_WEEKS),
            'trial_features' => $access->trialFeatures(),
            'theme_preset'   => $theme['preset'],
            'theme_accent'   => $theme['accent'],
            'theme_neutral'  => $theme['neutral'],
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

                /*
                 * The identity colour. Two presets — the current book
                 * look and the violet before it — and a custom colour.
                 * The preview redraws as the choice changes, so the
                 * admin sees the result before every learner does.
                 */
                Section::make('هوية المنصة — الألوان')
                    ->description('اللون الذي تظهر به الأزرار والعناوين والشريط في كل صفحات المتدرّب. يتغيّر فور الحفظ، بلا إعادة بناء.')
                    ->schema([
                        Radio::make('theme_preset')
                            ->label('النمط')
                            ->options(Theme::PRESETS)
                            ->descriptions([
                                'paper'  => 'تيراكوتا على ورق بيج دافئ، كصفحة كتاب.',
                                'violet' => 'الشكل الأول كاملاً: البنفسجي، والرأس الملوّن، والأزرار والزوايا المدوّرة، وخلفية بيضاء. كما كانت المنصة قبل تصميم الكتاب.',
                                'custom' => 'اختر أي لون، ويُبنى منه تدرّج كامل.',
                            ])
                            ->required()
                            ->live(),

                        ColorPicker::make('theme_accent')
                            ->label('لون الهوية')
                            ->helperText('هذا لون الأزرار. إن كان فاتحاً جداً يُغمَّق تلقائياً قليلاً، حتى يُقرأ عليه النص الأبيض.')
                            ->regex('/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/')
                            ->visible(fn (Get $get) => $get('theme_preset') === 'custom')
                            ->live(),

                        Radio::make('theme_neutral')
                            ->label('لون الخلفية')
                            ->options(Theme::NEUTRALS)
                            ->inline()
                            ->visible(fn (Get $get) => $get('theme_preset') === 'custom')
                            ->live(),

                        Html::make(fn (Get $get) => $this->preview($get)),
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

    /** Swatches, a progress bar and two buttons on the chosen paper — what learners will see */
    protected function preview(Get $get): HtmlString
    {
        $p = Theme::palette([
            'preset'  => (string) ($get('theme_preset') ?: 'paper'),
            'accent'  => Theme::normalizeHex((string) ($get('theme_accent') ?: '#b8432a')),
            'neutral' => (string) ($get('theme_neutral') ?: 'warm'),
        ]);

        $swatches = collect($p['accent'])
            ->map(fn ($hex, $shade) => '<div style="flex:1;height:28px;background:'.e($hex).'" title="'.$shade.' '.e($hex).'"></div>')
            ->implode('');

        $a = e($p['accent'][600]);
        $s = $p['surface'];

        return new HtmlString(
            '<div style="border-radius:8px;overflow:hidden;border:1px solid '.e($s['rule']).'">'
            .'<div style="display:flex">'.$swatches.'</div>'
            .'<div dir="rtl" style="padding:16px;background:'.e($s['paper']).';color:'.e($s['ink']).'">'
            .'<div style="background:'.e($s['sheet']).';border:1px solid '.e($s['rule']).';border-radius:7px;padding:14px">'
            .'<div style="font-size:12px;color:'.e($p['accent'][700]).';font-weight:600">المهمة 2 من 7</div>'
            .'<div style="font-size:17px;font-weight:700;margin:4px 0 10px">كتابة الكلمات</div>'
            .'<div style="height:8px;border-radius:9px;background:'.e($p['accent'][100]).';margin-bottom:12px">'
            .'<div style="width:45%;height:8px;border-radius:9px;background:'.$a.'"></div></div>'
            .'<span style="display:inline-block;background:'.$a.';color:#fff;padding:8px 18px;border-radius:7px;font-weight:600">التالي</span> '
            .'<span style="display:inline-block;color:'.$a.';padding:8px 6px;font-weight:600">اكشف الإجابة</span>'
            .'</div></div></div>'
        );
    }

    public function save(): void
    {
        $data = $this->form->getState();

        $preset = array_key_exists($data['theme_preset'] ?? '', Theme::PRESETS) ? $data['theme_preset'] : 'paper';
        // Hidden fields are not submitted: switching to a preset keeps the custom colour for later
        $saved = Theme::settings();
        $chosen = Theme::normalizeHex((string) ($data['theme_accent'] ?? $saved['accent']));
        $neutral = $data['theme_neutral'] ?? $saved['neutral'];

        Setting::put('theme_preset', $preset);
        Setting::put('theme_accent', $chosen);
        Setting::put('theme_neutral', $neutral === 'cool' ? 'cool' : 'warm');

        // Say so when a pale colour was darkened for legible buttons
        if ($preset === 'custom' && Theme::readable($chosen) !== $chosen) {
            Notification::make()
                ->title('اللون فاتح على النص الأبيض، فغُمِّق قليلاً في الأزرار إلى '.Theme::readable($chosen).'.')
                ->warning()
                ->send();
        }

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
