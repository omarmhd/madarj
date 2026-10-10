<?php

namespace App\Services;

use App\Services\ContentNaming;

use App\Models\Day;
use App\Models\DayCompletion;
use App\Models\Enrollment;
use App\Models\Streak;
use App\Models\User;
use App\Models\Week;
use App\Models\WeekGate;
use Illuminate\Support\Facades\DB;

/**
 * خدمة التقدّم — كل منطق القفل والصرامة في مكان واحد.
 *
 * قواعد الكتاب المنفَّذة هنا:
 *   1. اليوم n+1 لا يُفتح إلا بإتمام اليوم n
 *   2. الأسبوع n+1 لا يُفتح إلا بإتمام أيام الأسبوع n السبعة
 *   3. أسابيع المراجعة تشترط 60% في الاختبار
 *   4. فجوة يوم واحد لا تكسر السلسلة (grace_days)
 *
 * السبب في وضع هذا في خدمة لا في النماذج: المنطق يمسّ عدة
 * جداول معاً (day_completions + week_gates + streaks + enrollments)
 * ووضعه في نموذج واحد يعني تشتيت المسؤولية.
 */
class ProgressService
{
    /* ===================================================================
     |  البدء
     |=================================================================== */

    /**
     * تسجيل مستخدم جديد في الدورة.
     * يفتح الأسبوع الأول واليوم الأول فقط.
     */
    public function enroll(User $user, string $track = 'A', string $timezone = 'UTC'): Enrollment
    {
        return DB::transaction(function () use ($user, $track, $timezone) {
            $enrollment = Enrollment::create([
                'user_id'      => $user->id,
                'track'        => $track,
                'started_on'   => now($timezone)->toDateString(),
                'current_week' => 1,
                'current_day'  => 1,
                'timezone'     => $timezone,
            ]);

            Streak::create(['user_id' => $user->id]);

            // فتح الأسبوع الأول
            $firstWeek = Week::where('number', 1)->firstOrFail();
            WeekGate::create([
                'user_id'     => $user->id,
                'week_id'     => $firstWeek->id,
                'unlocked_at' => now(),
            ]);

            return $enrollment;
        });
    }

    /* ===================================================================
     |  الاستعلام عن حالة القفل
     |=================================================================== */

    /**
     * هل هذا الأسبوع مفتوح للمستخدم؟
     */
    /**
     * Development bypass for both lock layers.
     *
     * Guarded twice on purpose: the switch has to be set *and* the
     * app must not be in production. §4.6 says the server never
     * trusts the client — it should not blindly trust an environment
     * file either, because a `.env` copied to a server is exactly how
     * a course with a fixed daily plan quietly stops having one.
     *
     * It reads only. Nothing is written, so turning it off restores
     * the learner's real position untouched.
     */
    public function locksBypassed(): bool
    {
        return (bool) config('madarij.unlock_all') && ! app()->isProduction();
    }

    public function isWeekUnlocked(User $user, int $weekNumber): bool
    {
        if ($this->locksBypassed()) {
            return true;
        }

        /*
         * الاستحقاق قبل التقدّم.
         *
         * سؤالان لا واحد: **هل يملكه؟** (تجربةً أو اشتراكاً) ثم
         * **هل استحقّه؟** (دراسةً). ومن أتمّ الأسبوع الأول استحقّ
         * الثاني وإن لم يشترك — فلو كان الشرط واحداً انفتح له.
         *
         * وموضعه هنا لا في المتحكّمات: §4.6 تجعل الخادم لا يثق
         * بالواجهة، وبوّابةٌ في عشرة مواضع تُنسى في الحادي عشر.
         */
        if (! app(\App\Services\AccessService::class)->mayOpenWeek($user, $weekNumber)) {
            return false;
        }

        /*
         * والمدير يتجاوز التقدّم أيضاً.
         *
         * حقّ الإدارة كان يتجاوز الاستحقاق وحده — أي يملك الأسابيع
         * ولا تُفتح له حتى يدرسها. ومن يدعم متدرّباً يشكو من الأسبوع
         * الحادي عشر يحتاج أن يفتحه الآن ليرى ما يراه، لا أن يدرس
         * عشرة أسابيع قبله.
         *
         * وهو لا يكتب شيئاً: لا بوّابات ولا إنجازات — يرى فقط.
         */
        if ($user->is_admin) {
            return true;
        }

        if ($weekNumber === 1) {
            return true;   // الأسبوع الأول مفتوح دائماً
        }

        $week = Week::where('number', $weekNumber)->first();
        if (! $week) {
            return false;
        }

        return WeekGate::where('user_id', $user->id)
            ->where('week_id', $week->id)
            ->whereNotNull('unlocked_at')
            ->exists();
    }

    /**
     * هل هذا اليوم مفتوح؟
     *
     * القاعدة: اليوم الأول من أسبوع مفتوح يكون مفتوحاً،
     * وأي يوم بعده يشترط إتمام اليوم السابق.
     */
    public function isDayUnlocked(User $user, int $weekNumber, int $dayNumber): bool
    {
        if ($this->locksBypassed()) {
            return true;
        }

        if (! $this->isWeekUnlocked($user, $weekNumber)) {
            return false;
        }

        // أسبوعٌ مفتوح بأيّامٍ مقفلة نصفُ فتح: المدير يرى اليوم كما يراه صاحبه
        if ($user->is_admin) {
            return true;
        }

        if ($dayNumber === 1) {
            return true;
        }

        $week = Week::where('number', $weekNumber)->firstOrFail();

        return DayCompletion::where('user_id', $user->id)
            ->where('week_id', $week->id)
            ->where('day_number', $dayNumber - 1)
            ->whereNotNull('completed_at')
            ->exists();
    }

    /* ===================================================================
     |  تحديث التقدّم
     |=================================================================== */

    /**
     * تأشير مهمة واحدة في يوم معيّن.
     *
     * هذه الدالة هي ما يُنادى عند كل نقرة على مربع تأشير.
     * ترجع الحالة الجديدة ليعرف الواجهة ما إذا اكتمل اليوم.
     *
     * @param  int   $taskOrder  رقم المهمة 1..5
     * @param  bool  $done       تأشير أو إلغاء
     */
    public function toggleTask(
        User $user,
        int $weekNumber,
        int $dayNumber,
        int $taskOrder,
        bool $done,
    ): array {
        // الحماية الأساسية: لا يمكن العمل على يوم مقفل.
        // الواجهة تمنع ذلك أيضاً، لكن الخادم لا يثق بالواجهة.
        if (! $this->isDayUnlocked($user, $weekNumber, $dayNumber)) {
            abort(403, 'هذا اليوم مقفل. أكمل اليوم السابق أولاً.');
        }

        $week = Week::where('number', $weekNumber)->firstOrFail();
        $day  = Day::where('week_id', $week->id)
            ->where('number', $dayNumber)
            ->firstOrFail();

        // The task must exist in this day's plan. This replaced a fixed
        // `between:1,5` in the request, which rejected the sixth and
        // seventh tasks once days grew past five.
        abort_unless(
            collect($day->tasks)->contains(fn ($t) => (int) ($t['order'] ?? 0) === $taskOrder),
            422,
            'هذه المهمة ليست في خطة اليوم.'
        );

        /*
         * ترتيب المهام داخل اليوم — الطبقة الثانية.
         *
         * الواجهة تقفل الخانات اللاحقة، لكن الخادم لا يثق بالواجهة:
         * طلبٌ واحد بـcurl يؤشّر المهمة السابعة قبل الثانية فيُكمل
         * اليوم بلا عمل. والترتيب هنا ليس تنظيماً شكلياً — الكتاب
         * يبني اليوم على تسلسل: تسمع قبل أن تنطق، وتقرأ القاعدة
         * قبل أن تُمرَّن عليها.
         *
         * والتراجع عن تأشير مسموح دائماً: من أخطأ فأشّر يصحّح.
         */
        if ($done) {
            $completion = DayCompletion::where('user_id', $user->id)
                ->where('week_id', $week->id)
                ->where('day_number', $day->number)
                ->first();
            $doneMap = $completion?->tasks_done ?? [];

            foreach ($day->tasks as $t) {
                $order = (int) ($t['order'] ?? 0);
                if ($order >= $taskOrder) {
                    break;
                }
                if (($doneMap[(string) $order] ?? false) !== true) {
                    abort(422, 'أنهِ المهام التي قبلها أولاً.');
                }
            }
        }

        /*
         * Homework counts only with its proof. The form asks for a line
         * on what was done; a request that skips the form must not mark
         * the task — the server does not trust the interface (§4.6).
         */
        $task = collect($day->tasks)->first(fn ($t) => (int) ($t['order'] ?? 0) === $taskOrder);
        if ($done && ($task['ref'] ?? null) === 'homework') {
            $proof = \App\Models\WeekNote::where('user_id', $user->id)
                ->where('week_id', $week->id)
                ->where('kind', 'homework')
                ->first()?->answers['day'.$day->number] ?? '';

            abort_if(mb_strlen(trim((string) $proof)) < 3, 422, 'اكتب ما فعلته في الواجب أولاً، ثم أنجز المهمة.');
        }

        return DB::transaction(function () use ($user, $week, $day, $taskOrder, $done) {
            $completion = DayCompletion::firstOrCreate(
                [
                    'user_id'    => $user->id,
                    'week_id'    => $week->id,
                    'day_number' => $day->number,
                ],
                [
                    // الحالة الابتدائية: كل المهام غير منجزة
                    'tasks_done' => $this->emptyTaskMap($day),
                    'started_at' => now(),
                ]
            );

            $tasks = $completion->tasks_done;
            $tasks[(string) $taskOrder] = $done;
            $completion->tasks_done = $tasks;

            // اكتمل اليوم؟ نسجّل الوقت ونحدّث السلسلة والموضع
            $wasComplete = $completion->completed_at !== null;
            /*
             * تُفحص مهامّ اليوم **كما هي الآن** لا المفاتيح المخزَّنة.
             * تعديل الخطة يترك مفاتيح لمهامّ لم تعد موجودة، فتمنع
             * الاكتمال أو تمنحه بلا وجه حقّ.
             */
            $orders = collect($day->tasks)->pluck('order')->map(fn ($o) => (string) $o);
            $isNowComplete = $orders->isNotEmpty()
                && $orders->every(fn ($o) => ($tasks[$o] ?? false) === true);

            if ($isNowComplete && ! $wasComplete) {
                $completion->completed_at = now();
            } elseif (! $isNowComplete && $wasComplete) {
                // ألغى تأشير مهمة بعد الإكمال — نسحب الإكمال
                $completion->completed_at = null;
            }

            $completion->save();

            if ($isNowComplete && ! $wasComplete) {
                $this->onDayCompleted($user, $week, $day->number);
            }

            /*
             * ما يحتاجه الاحتفال.
             *
             * الرقم وحده لا يحفّز: «أحسنت» تُقال لكل شيء فتصير بلا
             * معنى، أما «ثلاثة أيام متصلة — هذه أطول سلسلة لك» فتُقال
             * مرة واحدة وتُصدَّق. فيرسل الخادم الحقائق التي تجعل
             * الرسالة صادقة، والواجهة تختار أيّها يستحقّ الظهور.
             */
            $streak = $user->streak?->fresh();
            $totalDays = DayCompletion::where('user_id', $user->id)
                ->whereNotNull('completed_at')->count();

            return [
                'tasks_done' => $completion->tasks_done,
                'percent'    => $completion->percent(),
                'completed'  => $isNowComplete,
                'next_day_unlocked' => $isNowComplete && $day->number < 7,
                'week_completed'    => $isNowComplete && $day->number === 7,

                /*
                 * عند **الانتقال** إلى الاكتمال لا عند كل تأشير.
                 *
                 * $isNowComplete وحدها تبقى صادقة في يوم مكتمل، فكل
                 * ضغطة بعده تُعيد الاحتفال — وتهنئةٌ تتكرّر أربع مرات
                 * تُلغي نفسها.
                 */
                'milestone' => ($isNowComplete && ! $wasComplete) ? [
                    'day'            => $day->number,
                    'week'           => $week->number,
                    'module'         => $week->module,
                    'days_total'     => $totalDays,
                    'first_ever'     => $totalDays === 1,
                    'streak'         => $streak?->current ?? 0,
                    'longest_streak' => $streak?->longest ?? 0,
                    // سلسلة جديدة تتجاوز الأطول = لحظة تستحقّ الذكر
                    'streak_record'  => ($streak?->current ?? 0) > 0
                        && ($streak->current === $streak->longest),
                    'week_completed' => $day->number === 7,
                    // نهاية وحدة: 6 · 12 · 18 · 24
                    'module_completed' => $day->number === 7 && in_array($week->number, [6, 12, 18, 24], true),
                ] : null,
            ];
        });
    }

    /**
     * ما يحدث عند إتمام يوم: تحديث السلسلة والموضع، وفتح ما يلي.
     */
    protected function onDayCompleted(User $user, Week $week, int $dayNumber): void
    {
        $enrollment = $user->enrollment;

        // السلسلة اليومية — بتوقيت المستخدم
        $user->streak?->recordActivity($enrollment->today());

        if ($dayNumber < 7) {
            // اليوم التالي في نفس الأسبوع
            $enrollment->update([
                'current_week' => $week->number,
                'current_day'  => $dayNumber + 1,
            ]);

            return;
        }

        // انتهى الأسبوع — نحاول فتح الذي يليه
        $this->completeWeek($user, $week);
    }

    /**
     * إتمام أسبوع وفتح التالي.
     *
     * أسابيع المراجعة (6، 12، 18، 24) لا تُجتاز بإتمام الأيام وحده —
     * تشترط درجة في الاختبار. لذلك لا نفتح التالي إلا بعد تسجيل الدرجة.
     */
    public function completeWeek(User $user, Week $week): void
    {
        $gate = WeekGate::firstOrCreate(
            ['user_id' => $user->id, 'week_id' => $week->id],
            ['unlocked_at' => now()]
        );

        if ($week->is_review && ! $gate->hasPassedTest()) {
            // ينتظر نتيجة الاختبار — لا نفتح التالي بعد
            return;
        }

        $gate->update(['passed_at' => now()]);

        $next = Week::where('number', $week->number + 1)->first();

        if (! $next) {
            // أنهى الدورة كلها
            $user->enrollment->update(['completed_at' => now()]);

            return;
        }

        WeekGate::firstOrCreate(
            ['user_id' => $user->id, 'week_id' => $next->id],
            ['unlocked_at' => now()]
        );

        $user->enrollment->update([
            'current_week' => $next->number,
            'current_day'  => 1,
        ]);
    }

    /**
     * تسجيل نتيجة اختبار أسبوع مراجعة.
     * لو نجح، يُفتح الأسبوع التالي فوراً.
     */
    public function recordTestScore(User $user, int $weekNumber, int $score, int $max): array
    {
        $week = Week::where('number', $weekNumber)->firstOrFail();

        $gate = WeekGate::firstOrCreate(
            ['user_id' => $user->id, 'week_id' => $week->id],
            ['unlocked_at' => now()]
        );

        $gate->update(['test_score' => $score, 'test_max' => $max]);

        $passed = $gate->hasPassedTest();

        if ($passed) {
            $this->completeWeek($user, $week);
        }

        return [
            'passed'   => $passed,
            'percent'  => $gate->scorePercent(),
            'required' => WeekGate::PASS_THRESHOLD * 100,
        ];
    }

    /* ===================================================================
     |  لوحة التقدّم
     |=================================================================== */

    /**
     * كل ما تحتاجه لوحة التقدّم في استعلام واحد.
     */
    public function dashboard(User $user): array
    {
        $enrollment = $user->enrollment;

        /*
         * حارسٌ أخير.
         *
         * الوسيط يمنع وصول غير المسجَّل إلى هنا، لكنّ هذه الدالّة
         * تُنادى من ثلاث صفحات — ومنها `/profile` المستثناة من
         * الوسيط. وصفحةٌ تنهار بـ500 أسوأ من صفحةٍ ناقصة.
         */
        if (! $enrollment) {
            abort(redirect()->route('setup'));
        }

        $expected = $enrollment->expectedPosition();

        $completions = DayCompletion::where('user_id', $user->id)
            ->whereNotNull('completed_at')
            ->count();

        return [
            'track'          => $enrollment->track,
            'current_week'   => $enrollment->current_week,
            'current_day'    => $enrollment->current_day,
            'expected_week'  => $expected['week'],
            'expected_day'   => $expected['day'],
            'days_behind'    => $enrollment->daysBehind(),
            'days_done'      => $completions,
            'days_total'     => 168,
            'percent'        => $enrollment->progressPercent(),
            'streak'         => $user->streak?->current ?? 0,
            'longest_streak' => $user->streak?->longest ?? 0,
            'streak_at_risk' => $user->streak?->isAtRisk($enrollment->today()) ?? false,
            'started_on'     => $enrollment->started_on->toDateString(),
        ];
    }

    /**
     * حالة أيام أسبوع معيّن — للعرض في صفحة الأسبوع.
     */
    public function weekDayStates(User $user, Week $week): array
    {
        $naming = app(ContentNaming::class);
        $completions = DayCompletion::where('user_id', $user->id)
            ->where('week_id', $week->id)
            ->get()
            ->keyBy('day_number');

        return $week->days->map(function (Day $day) use ($user, $week, $completions, $naming) {
            $c = $completions->get($day->number);

            return [
                'number'     => $day->number,
                // الوصف بلغتين — من مهامّ اليوم، بلا نصّ مخزّن
                ...(fn ($f) => ['focus' => $f['ar'], 'focus_ar' => $f['ar'], 'focus_en' => $f['en']])(
                    $naming->dayFocus($week, $day->tasks)
                ),
                'tasks'      => $day->tasks,
                'minutes'    => $day->totalMinutes(),
                'unlocked'   => $this->isDayUnlocked($user, $week->number, $day->number),
                'tasks_done' => $c?->tasks_done ?? $this->emptyTaskMap($day),
                'percent'    => $c?->percent() ?? 0,
                'completed'  => $c?->completed_at !== null,
            ];
        })->all();
    }

    /** خريطة مهام فارغة: { "1": false, "2": false, ... } */
    protected function emptyTaskMap(Day $day): array
    {
        return collect($day->tasks)
            ->mapWithKeys(fn ($t) => [(string) $t['order'] => false])
            ->all();
    }
}
