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
    public const VOICES = [
        ['value' => 'f', 'label_ar' => 'أنثى', 'hint_ar' => 'صوت نسائي واضح'],
        ['value' => 'm', 'label_ar' => 'ذكر', 'hint_ar' => 'صوت رجالي'],
        ['value' => 'c', 'label_ar' => 'طفل', 'hint_ar' => 'إن توفّر في متصفحك'],
    ];

    public const RATES = [
        ['value' => 0.6, 'label_ar' => 'بطيء جداً', 'hint_ar' => 'للأصوات الصعبة'],
        ['value' => 0.8, 'label_ar' => 'بطيء', 'hint_ar' => 'ما يوصي به الكتاب للاستماع الأول'],
        ['value' => 1.0, 'label_ar' => 'طبيعي', 'hint_ar' => 'سرعة الكلام الحقيقية'],
    ];

    public const THEMES = [
        ['value' => 'light', 'label_ar' => 'نهاري', 'hint_ar' => 'خلفية فاتحة'],
        ['value' => 'dark', 'label_ar' => 'ليلي', 'hint_ar' => 'أرحم للعين في الإضاءة الخفيفة'],
        ['value' => 'system', 'label_ar' => 'تبعاً للنظام', 'hint_ar' => 'يتبع إعداد جهازك'],
    ];

    public const LOCALES = [
        [
            'value' => 'ar',
            'label_ar' => 'العربية',
            'hint_ar' => 'تظهر ترجمة كل نصّ إنجليزي — الحوارات والقصص والقواعد',
        ],
        [
            'value' => 'en',
            'label_ar' => 'الإنجليزية فقط',
            'hint_ar' => 'تُخفى الترجمة العربية للمحتوى. أصعب وأسرع في التعلّم',
        ],
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
                'done'        => $e?->setup_done_at !== null,
            ],
            'options' => [
                'voices'  => self::VOICES,
                'rates'   => self::RATES,
                'themes'  => self::THEMES,
                'locales' => self::LOCALES,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'voice'       => ['required', 'in:f,m,c'],
            'speech_rate' => ['required', 'numeric', 'between:0.5,1.5'],
            'theme'       => ['required', 'in:light,dark,system'],
            'locale'      => ['required', 'in:ar,en'],
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
