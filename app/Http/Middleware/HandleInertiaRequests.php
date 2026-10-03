<?php

namespace App\Http\Middleware;

use App\Http\Controllers\MemoryController;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $enrollment = $request->user()?->enrollment;

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
            ],

            /**
             * التفضيلات تُشارك مع كل صفحة لا تُطلب في كل متحكّم:
             * الصوت والسرعة والوضع والترجمة تخصّ كل شاشة فيها نصّ
             * إنجليزي — وتكرارها في تسعة متحكّمات تكرار بلا فائدة.
             */
            'prefs' => [
                'voice'  => $enrollment?->voice ?? 'f',
                'rate'   => $enrollment?->speech_rate ?? 0.8,
                'theme'  => $enrollment?->theme ?? 'light',
                'locale' => $enrollment?->locale ?? 'ar',
                // الواجهة تعرف بها هل تُظهر ترجمة المحتوى
                'showTranslation' => ($enrollment?->locale ?? 'ar') === 'ar',
            ],

            /**
             * ما يحتاجه شريط التنقّل — يقرأه الشريط نفسه.
             *
             * كان كل صفحة تمرّره إليه كخصائص، فكل صفحة تنسى شيئاً:
             * التهيئة بلا سلسلة، والوسائط بلا زرّ «تابع». والشريط
             * واحد فيجب أن تكون بياناته واحدة.
             *
             * والثلاثة أعمدة جاهزة (`current_week`, `current_day`,
             * `streaks.current`) لا حساب — فلا ثمن على كل طلب.
             */
            'nav' => [
                'week'   => $enrollment?->current_week,
                'day'    => $enrollment?->current_day,
                'streak' => $request->user()?->streak?->current,
            ],

            /**
             * عدّاد الذاكرة.
             *
             * زرّها في كل صفحة، فرقمه يجب أن يكون في كل صفحة — ولو
             * جُلب بطلبٍ من الواجهة لصار طلباً إضافيّاً عند كل تنقّل.
             *
             * وثمنه استعلامٌ واحد مفهرس بـ0.3ms على `(user_id, due_at)`:
             * أرخص من طلب HTTP كامل بمراتب.
             *
             * ودالّةٌ لا قيمة: طلبٌ جزئيّ لا يطلبه لا يحسبه.
             */
            'memory' => fn () => $request->user()
                ? app(MemoryController::class)->counts($request)
                : null,

            // Trial / subscription status — the nav draws its locks from this
            'access' => fn () => $request->user()
                ? app(\App\Services\AccessService::class)->summary($request->user())
                : null,
        ];
    }
}
