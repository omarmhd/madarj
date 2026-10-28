<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * صفحة التهيئة — تُعرض مرة واحدة قبل أول درس.
 *
 * أربعة اختيارات: الصوت، السرعة، الوضع الليلي، ولغة الترجمة.
 *
 * لماذا مرة واحدة وليست في كل مكان: المبتدئ الذي يُواجَه بإعدادات
 * في كل صفحة يضبطها مرة ثم لا يعود إليها. وهذه الأربعة تحكم كل
 * تجربته، فالأفضل أن يقرّرها وهو مرتاح قبل أن يبدأ.
 *
 * وكلها قابلة للتغيير لاحقاً من الصفحة نفسها.
 */
class SetupController extends Controller
{
    /** الخيارات المتاحة — تُرسل للواجهة كي لا تُكرَّر فيها */
    /*
     * Each option in both languages: the page is drawn in the language the
     * learner is choosing, so its labels cannot be Arabic only.
     */
    public const VOICES = [
        ['value' => 'f', 'label_ar' => 'أنثى', 'hint_ar' => 'صوت نسائي واضح', 'label_en' => 'Female', 'hint_en' => 'A clear female voice'],
        ['value' => 'm', 'label_ar' => 'ذكر', 'hint_ar' => 'صوت رجالي', 'label_en' => 'Male', 'hint_en' => 'A male voice'],
        ['value' => 'c', 'label_ar' => 'طفل', 'hint_ar' => 'إن توفّر في متصفحك', 'label_en' => 'Child', 'hint_en' => 'If your browser has one'],
    ];

    public const RATES = [
        ['value' => 0.6, 'label_ar' => 'بطيء جداً', 'hint_ar' => 'للأصوات الصعبة', 'label_en' => 'Very slow', 'hint_en' => 'For the hard sounds'],
        ['value' => 0.8, 'label_ar' => 'بطيء', 'hint_ar' => 'ما يوصي به الكتاب للاستماع الأول', 'label_en' => 'Slow', 'hint_en' => 'What the book advises for a first listen'],
        ['value' => 1.0, 'label_ar' => 'طبيعي', 'hint_ar' => 'سرعة الكلام الحقيقية', 'label_en' => 'Natural', 'hint_en' => 'Real speaking speed'],
    ];

    public const THEMES = [
        ['value' => 'light', 'label_ar' => 'نهاري', 'hint_ar' => 'خلفية فاتحة', 'label_en' => 'Light', 'hint_en' => 'A light background'],
        ['value' => 'dark', 'label_ar' => 'ليلي', 'hint_ar' => 'أرحم للعين في الإضاءة الخفيفة', 'label_en' => 'Dark', 'hint_en' => 'Easier on the eyes in dim light'],
        ['value' => 'system', 'label_ar' => 'تبعاً للنظام', 'hint_ar' => 'يتبع إعداد جهازك', 'label_en' => 'Follow the system', 'hint_en' => "Follows your device's setting"],
    ];

    /** The interface: buttons, menus, messages — not the lessons themselves */
    public const LOCALES = [
        ['value' => 'ar', 'label_ar' => 'العربية', 'hint_ar' => 'الأزرار والقوائم والرسائل بالعربية', 'label_en' => 'Arabic', 'hint_en' => 'Buttons, menus and messages in Arabic'],
        ['value' => 'en', 'label_ar' => 'English', 'hint_ar' => 'الواجهة كلها بالإنجليزية، ومن اليسار إلى اليمين', 'label_en' => 'English', 'hint_en' => 'The whole interface in English, left to right'],
    ];

    /** The Arabic under the content's English: dialogues, models, explanations */
    public const TRANSLATIONS = [
        ['value' => 1, 'label_ar' => 'تظهر', 'hint_ar' => 'ترجمة عربية تحت كل سطر إنجليزي — أريح للمبتدئ', 'label_en' => 'Shown', 'hint_en' => 'An Arabic translation under each English line — easier for a beginner'],
        ['value' => 0, 'label_ar' => 'مخفيّة', 'hint_ar' => 'تظهر بضغطة على السطر وحده — أصعب، وأسرع في التعلّم', 'label_en' => 'Hidden', 'hint_en' => 'One tap shows it, for that line — harder, and faster learning'],
    ];

    public function show(Request $request): Response
    {
        $e = $request->user()->enrollment;

        return Inertia::render('Setup', [
            'current' => [
                'voice'       => $e?->voice ?? 'f',
                'speech_rate' => $e?->speech_rate ?? 0.8,
                'theme'       => $e?->theme ?? 'light',
                'locale'      => $e?->locale ?? 'ar',
                'content_translation' => (int) ($e?->content_translation ?? true),
                'done'        => $e?->setup_done_at !== null,
            ],
            'options' => [
                'voices'  => self::VOICES,
                'rates'   => self::RATES,
                'themes'  => self::THEMES,
                'locales' => self::LOCALES,
                'translations' => self::TRANSLATIONS,
            ],
        ]);
    }

    /**
     * Voice and speed, changed from a lesson's ♀/♂ and speed buttons.
     * Saved at once, so the next page and the next visit speak the same.
     */
    public function speech(Request $request): \Illuminate\Http\JsonResponse
    {
        $data = $request->validate([
            'voice' => ['nullable', 'in:f,m,c'],
            'rate'  => ['nullable', 'numeric', 'between:0.5,1.5'],
        ]);

        $request->user()->enrollment?->update(array_filter([
            'voice'       => $data['voice'] ?? null,
            'speech_rate' => $data['rate'] ?? null,
        ], fn ($v) => $v !== null));

        return response()->json(['saved' => true]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'voice'       => ['required', 'in:f,m,c'],
            'speech_rate' => ['required', 'numeric', 'between:0.5,1.5'],
            'theme'       => ['required', 'in:light,dark,system'],
            'locale'      => ['required', 'in:ar,en'],
            'content_translation' => ['required', 'boolean'],
        ]);

        $user = $request->user();

        /*
         * وتُنشئ التسجيل إن لم يكن.
         *
         * `?->update()` على فراغٍ لا تفعل شيئاً ولا تشتكي: فتُحفظ
         * التهيئة ظاهراً، ويبقى `setup_done_at` فارغاً، فيُعاد إلى
         * هذه الصفحة أبداً. والمسار الافتراضيّ وتوقيت دولته يكفيان
         * لمن أنشأه المدير — ويغيّرهما من صفحته متى شاء.
         */
        if (! $user->enrollment) {
            app(\App\Services\ProgressService::class)->enroll(
                $user,
                'A',
                \App\Support\Countries::timezone($user->country) ?? 'Africa/Cairo',
            );

            $user->refresh();
        }

        $user->enrollment?->update([
            ...$data,
            'setup_done_at' => now(),
        ]);

        return redirect()->route('dashboard');
    }
}
