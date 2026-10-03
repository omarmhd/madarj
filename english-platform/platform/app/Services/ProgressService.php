<?php

namespace App\Services;

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
    public function isWeekUnlocked(User $user, int $weekNumber): bool
    {
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
        if (! $this->isWeekUnlocked($user, $weekNumber)) {
            return false;
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
            $isNowComplete = collect($tasks)->every(fn ($v) => $v === true);

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

            return [
                'tasks_done' => $completion->tasks_done,
                'percent'    => $completion->percent(),
                'completed'  => $isNowComplete,
                'next_day_unlocked' => $isNowComplete && $day->number < 7,
                'week_completed'    => $isNowComplete && $day->number === 7,
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
        $expected   = $enrollment->expectedPosition();

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
        $completions = DayCompletion::where('user_id', $user->id)
            ->where('week_id', $week->id)
            ->get()
            ->keyBy('day_number');

        return $week->days->map(function (Day $day) use ($user, $week, $completions) {
            $c = $completions->get($day->number);

            return [
                'number'     => $day->number,
                'focus'      => $day->focus,
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
