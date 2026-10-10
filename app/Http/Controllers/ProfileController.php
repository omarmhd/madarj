<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Models\DailyStat;
use App\Models\ExerciseAttempt;
use App\Models\LearningEvent;
use App\Models\Recording;
use App\Models\ReviewCard;
use App\Models\Writing;
use App\Services\ProgressService;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

/**
 * ملفّ المتدرّب.
 *
 * كان نموذج Breeze الافتراضي: اسم وبريد وكلمة مرور وحذف حساب —
 * ولا شيء عن التعلّم. والمتدرّب يفتح ملفّه ليرى **أثره** لا بياناته:
 * كم يوماً أنجز، وكم كلمة يعرف، وكم تمريناً حلّ، وأين هو من الطريق.
 *
 * وأضفنا إليه المسار والمنطقة الزمنية لأنهما يحكمان حساب «اليوم»
 * والسلسلة، ويجب أن يكونا قابلين للتصحيح.
 */
class ProfileController extends Controller
{
    public function __construct(
        protected ProgressService $progress,
    ) {}

    public function edit(Request $request): Response
    {
        $user = $request->user();
        $enrollment = $user->enrollment;

        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $user instanceof MustVerifyEmail,
            'status'          => session('status'),

            'stats' => $this->progress->dashboard($user),

            'enrollment' => $enrollment ? [
                'track'      => $enrollment->track,
                'timezone'   => $enrollment->timezone,
                'started_on' => $enrollment->started_on->toDateString(),
            ] : null,

            // أثر التعلّم — الأرقام التي تعني شيئاً للمتدرّب
            'learning' => [
                'words_seen'      => ReviewCard::forUser($user->id)->count(),
                'words_learned'   => ReviewCard::forUser($user->id)->where('state', '!=', 'new')->count(),
                'exercises_done'  => ExerciseAttempt::where('user_id', $user->id)
                    ->where('is_correct', true)->distinct('exercise_id')->count('exercise_id'),
                'attempts_total'  => ExerciseAttempt::where('user_id', $user->id)->count(),
                'recordings'      => Recording::where('user_id', $user->id)->count(),
                'writings'        => Writing::where('user_id', $user->id)->count(),
            ],

            /*
             * ما يقوله سجلّ الحركات ولا يقوله جدول التقدّم.
             *
             * الدقائق تُقرأ من الملخّص المجمَّع لا من السجلّ الخام:
             * ثلاثون صفّاً لا آلاف الأحداث، فيبقى الاستعلام ثابت
             * التكلفة مهما طالت مدّة المتدرّب في المنصة.
             */
            'behaviour' => [
                'minutes_total' => (int) round(DailyStat::where('user_id', $user->id)->sum('active_seconds') / 60),
                'minutes_7d'    => (int) round(
                    DailyStat::where('user_id', $user->id)
                        ->where('on_date', '>=', now()->subDays(7)->toDateString())
                        ->sum('active_seconds') / 60
                ),
                'audio_plays'   => (int) DailyStat::where('user_id', $user->id)->sum('audio_plays'),
                'active_days'   => DailyStat::where('user_id', $user->id)->where('events', '>', 0)->count(),

                // الكلمات التي أعاد سماعها أكثر — أصدق مؤشّر صعوبة
                'hardest_words' => LearningEvent::forUser($user->id)
                    ->whereIn('type', ['audio_play', 'audio_slow'])
                    ->whereNotNull('ref')
                    ->where('ref', 'not like', '% %')      // كلمة مفردة لا جملة
                    ->selectRaw('ref, count(*) as plays')
                    ->groupBy('ref')
                    ->havingRaw('count(*) >= 3')
                    ->orderByDesc('plays')
                    ->limit(8)
                    ->get()
                    ->map(fn ($r) => ['word' => $r->ref, 'plays' => (int) $r->plays])
                    ->all(),
            ],

            'timezones' => self::TIMEZONES,

            'subscription' => fn () => $this->subscription($user),
        ]);
    }

    /**
     * Everything the learner should be able to see about paying:
     * where they stand, until when, what they asked for and what
     * became of it. Before this the profile said nothing at all, and
     * the only answer to "am I subscribed?" was a locked page.
     */
    protected function subscription($user): array
    {
        $access = app(\App\Services\AccessService::class);
        $today = now()->toDateString();

        $subs = \App\Models\Subscription::with('plan:id,name_ar,months')
            ->where('user_id', $user->id)
            ->orderByDesc('ends_on')
            ->get();

        $row = fn ($s) => [
            'id'        => $s->id,
            'plan'      => $s->plan?->name_ar,
            'starts_on' => $s->starts_on->toDateString(),
            'ends_on'   => $s->ends_on->toDateString(),
            'is_free'   => $s->is_free,
            'paid'      => $s->paid !== null ? rtrim(rtrim((string) $s->paid, '0'), '.').' '.($s->currency ?? '') : null,
            'state'     => $s->starts_on->toDateString() > $today ? 'upcoming'
                : ($s->ends_on->toDateString() < $today ? 'ended' : 'active'),
            // Through the end of the last day, counted in whole days
            'days_left' => max(0, (int) now()->startOfDay()->diffInDays($s->ends_on->copy()->startOfDay(), false) + 1),
        ];

        $current = $subs->first(fn ($s) => $s->starts_on->toDateString() <= $today && $s->ends_on->toDateString() >= $today);

        return [
            'access'   => $access->summary($user),
            'current'  => $current ? $row($current) : null,
            'trial'    => [
                'days'       => $access->trialDays(),
                'weeks'      => $access->trialWeeks($user),
                'ends_on'    => $access->trialEndsAt($user)?->toDateString(),
                'started_on' => $user->created_at->toDateString(),
                'features'   => collect(\App\Services\AccessService::FEATURES)
                    ->map(fn ($label, $key) => ['label' => $label, 'open' => in_array($key, $access->trialFeatures(), true)])
                    ->values(),
            ],
            'history'  => $subs->map($row)->values(),
            'requests' => \App\Models\UpgradeRequest::with('plan:id,name_ar')
                ->where('user_id', $user->id)
                ->latest()
                ->limit(10)
                ->get()
                ->map(fn ($r) => [
                    'id'         => $r->id,
                    'plan'       => $r->plan?->name_ar,
                    'method'     => \App\Models\UpgradeRequest::METHODS[$r->contact_method] ?? $r->contact_method,
                    'contact'    => $r->contact_value,
                    'status'     => $r->status,
                    'status_ar'  => \App\Models\UpgradeRequest::STATUSES[$r->status] ?? $r->status,
                    'created_at' => $r->created_at->toDateString(),
                    'handled_at' => $r->handled_at?->toDateString(),
                ]),
        ];
    }

    /** المناطق الزمنية الشائعة لجمهور المنصة */
    protected const TIMEZONES = [
        'Africa/Cairo', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Amman',
        'Asia/Beirut', 'Asia/Baghdad', 'Asia/Kuwait', 'Asia/Qatar',
        'Africa/Khartoum', 'Africa/Algiers', 'Africa/Casablanca',
        'Africa/Tunis', 'Africa/Tripoli', 'Europe/Istanbul', 'UTC',
    ];

    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        return Redirect::route('profile.edit');
    }

    /**
     * تعديل إعدادات الدورة.
     *
     * المسار والمنطقة الزمنية يحكمان حساب «اليوم» والسلسلة، فتغييرهما
     * ليس تفضيلاً شكلياً. ولا نمسّ `started_on` هنا: تغييره يعيد حساب
     * كل الجدول ويجعل المتدرّب متأخّراً أو متقدّماً بلا سبب.
     */
    public function updateCourse(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'track'    => ['required', 'in:A,B'],
            'timezone' => ['required', 'in:'.implode(',', self::TIMEZONES)],
        ]);

        $request->user()->enrollment?->update($data);

        return Redirect::route('profile.edit');
    }

    /**
     * تفضيلات النطق من داخل الدرس.
     *
     * الصوت كان يُختار في التهيئة مرّة ثم لا سبيل إلى تغييره إلا
     * بإعادتها — وهي مقفلة بعد إتمامها. وهو تفضيل يُكتشف أثناء
     * الاستماع لا قبله: يسمع الصوت الأنثوي عشر دقائق فيريد الذكوري.
     *
     * والسرعة تبقى محليّة كما كانت: تُرفع لمقطع صعب ثم تعود، فحفظها
     * يجعل كل صفحة تفتح على سرعة لحظةٍ عابرة.
     */
    public function updateVoice(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'voice' => ['required', 'in:f,m,c'],
        ]);

        $request->user()->enrollment?->update($data);

        return back();
    }

    public function destroy(Request $request): RedirectResponse
    {
        $request->validate(['password' => ['required', 'current_password']]);

        $user = $request->user();

        Auth::logout();
        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}
