<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use App\Support\LandingCopy;
use BackedEnum;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;

/**
 * The landing page's text and the support number, edited by the admin.
 *
 * Opens with the current wording filled in (defaults until someone
 * changes them), so editing is changing a sentence, not writing the
 * page from a blank form. An emptied field falls back to the default.
 */
class LandingContent extends Page
{
    // Same plain form-and-save view as the settings page
    protected string $view = 'filament.pages.settings';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedHome;

    protected static ?string $navigationLabel = 'صفحة الهبوط';

    protected static ?string $title = 'صفحة الهبوط';

    protected static ?int $navigationSort = 8;

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill([
            ...LandingCopy::get(),
            'support_whatsapp' => (string) Setting::get('support_whatsapp', ''),
        ]);
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('الدعم الفنّيّ')
                    ->description('يظهر زرّ واتساب عائماً في يسار صفحة الهبوط. اتركه فارغاً لإخفاء الزرّ.')
                    ->schema([
                        TextInput::make('support_whatsapp')
                            ->label('رقم واتساب للدعم')
                            ->tel()
                            ->placeholder('+201000000000')
                            ->helperText('اكتب الرقم مع رمز الدولة. المسافات والرموز تُحذف تلقائياً.')
                            ->rule('nullable')
                            ->regex('/^[+\d\s\-()]*$/'),
                    ]),

                Section::make('أعلى الصفحة')
                    ->schema([
                        TextInput::make('eyebrow')->label('السطر الصغير فوق العنوان')->maxLength(120),
                        TextInput::make('title_1')->label('العنوان — السطر الأول')->maxLength(80),
                        TextInput::make('title_2')->label('العنوان — بداية السطر الثاني')->maxLength(60),
                        TextInput::make('title_accent')->label('العنوان — الكلمة الملوّنة في آخره')->maxLength(40),
                        Textarea::make('subtitle')->label('الفقرة تحت العنوان')->rows(3)->maxLength(400),
                        TextInput::make('cta')->label('نصّ زرّ البداية')->maxLength(60),
                        TextInput::make('trial_note')->label('السطر تحت الزرّ')->maxLength(160),
                    ]),

                Section::make('معنى الاسم')
                    ->schema([
                        Textarea::make('name_meaning')->label('شرح «مَدارِج»')->rows(2)->maxLength(300),
                    ]),

                Section::make('الأسئلة الشائعة')
                    ->schema([
                        Repeater::make('faq')
                            ->label('الأسئلة')
                            ->schema([
                                TextInput::make('q')->label('السؤال')->required()->maxLength(160),
                                Textarea::make('a')->label('الجواب')->required()->rows(2)->maxLength(600),
                            ])
                            ->itemLabel(fn (array $state) => $state['q'] ?? null)
                            ->collapsible()
                            ->reorderable()
                            ->addActionLabel('أضف سؤالاً'),
                    ]),

                Section::make('آخر الصفحة')
                    ->schema([
                        TextInput::make('closing_title')->label('العنوان الأخير')->maxLength(100),
                        Textarea::make('closing_text')->label('السطر تحته')->rows(2)->maxLength(200),
                    ]),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();

        Setting::put('support_whatsapp', trim((string) ($data['support_whatsapp'] ?? '')));
        unset($data['support_whatsapp']);

        /*
         * Store only what differs from the defaults. Saving the form to
         * change the WhatsApp number used to freeze every text field at
         * the wording shown that day, so a later rewrite of the defaults
         * never reached the page.
         */
        $changed = array_filter(
            $data,
            fn ($value, $key) => ($value ?? '') !== '' && $value !== (LandingCopy::DEFAULTS[$key] ?? null),
            ARRAY_FILTER_USE_BOTH,
        );

        LandingCopy::put($changed);

        Notification::make()->title('حُفظت صفحة الهبوط.')->success()->send();
    }
}
