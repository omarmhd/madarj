<?php

namespace App\Http\Controllers;

use App\Models\DailyStat;
use App\Models\LearningEvent;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * استقبال حركات المتدرّب.
 *
 * ── قواعد الأداء الأربع ─────────────────────────────────────
 *
 * ① **دفعة لا حدث.** المتصفح يجمع ثم يرسل مرة واحدة. لو أرسل كل
 *    نقرة لصار زرّ الاستماع ثلاثين طلباً في الدقيقة.
 *
 * ② **إدخال واحد لا حلقة.** `insert` بمصفوفة يكتب الثلاثين صفّاً في
 *    استعلام واحد. المرور بـEloquent يعني ثلاثين رحلة ذهاب وإياب.
 *
 * ③ **التجميع عند الكتابة.** العدّادات تُزاد الآن، فلا تحتاج اللوحة
 *    أن تمسح السجلّ لاحقاً. هذا يقلب تكلفة السؤال من O(الأحداث)
 *    إلى O(الأيام).
 *
 * ④ **لا يُبطئ المتدرّب أبداً.** الردّ 204 بلا جسم، والفشل يُبتلع
 *    صامتاً في المتصفح. حدث ضائع لا يساوي شاشة متجمّدة — وهذا هو
 *    الفرق بين هذا المسار ومسار التقدّم الذي يجب ألّا يضيع منه شيء.
 */
class EventController extends Controller
{
    /** أنواع مسموحة — لئلا يمتلئ الجدول بنوع مكتوب خطأً */
    protected const TYPES = [
        'day_open', 'task_open', 'task_done', 'section_view',
        'audio_play', 'audio_slow', 'card_flip', 'card_grade',
        'exercise_try', 'exercise_reveal', 'dialogue_play',
        'game_answer', 'game_score', 'record_start', 'break_item', 'heartbeat',
        'word_test', 'say_check', 'story_read',
    ];

    /** سقف الدفعة — يمنع طلباً ضخماً من إشغال الخادم */
    protected const MAX_BATCH = 60;

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'events'                => ['required', 'array', 'max:'.self::MAX_BATCH],
            'events.*.type'         => ['required', 'string', 'in:'.implode(',', self::TYPES)],
            'events.*.ref'          => ['nullable', 'string', 'max:120'],
            'events.*.value'        => ['nullable', 'integer', 'min:0', 'max:86400'],
            'events.*.week'         => ['nullable', 'integer', 'between:1,24'],
            'events.*.day'          => ['nullable', 'integer', 'between:1,7'],
            'events.*.at'           => ['nullable', 'date'],
            'events.*.meta'         => ['nullable', 'array'],
        ]);

        $now = CarbonImmutable::now();
        $rows = [];
        $tally = [
            'audio_plays' => 0, 'cards_reviewed' => 0,
            'exercises_tried' => 0, 'tasks_done' => 0, 'active_seconds' => 0,
        ];

        foreach ($data['events'] as $e) {
            // وقت العميل لا يُوثَق به: ساعة مضبوطة خطأً تُفسد الترتيب.
            // يُقبل فقط إن كان ضمن يوم من الآن.
            $at = isset($e['at']) ? CarbonImmutable::parse($e['at']) : $now;
            if ($at->diffInHours($now, true) > 24) {
                $at = $now;
            }

            $rows[] = [
                'user_id'     => $user->id,
                'week_number' => $e['week'] ?? null,
                'day_number'  => $e['day'] ?? null,
                'type'        => $e['type'],
                'ref'         => $e['ref'] ?? null,
                'value'       => $e['value'] ?? null,
                'meta'        => isset($e['meta']) ? json_encode($e['meta'], JSON_UNESCAPED_UNICODE) : null,
                'occurred_at' => $at,
                'created_at'  => $now,
            ];

            match ($e['type']) {
                'audio_play', 'audio_slow', 'dialogue_play' => $tally['audio_plays']++,
                'card_grade'    => $tally['cards_reviewed']++,
                'exercise_try'  => $tally['exercises_tried']++,
                'task_done'     => $tally['tasks_done']++,
                // النبضة تحمل ثوانيَ النشاط منذ سابقتها
                'heartbeat'     => $tally['active_seconds'] += min(120, $e['value'] ?? 0),
                default         => null,
            };
        }

        // يوم المتدرّب بتوقيته هو — لا بتوقيت الخادم
        $tz = $user->enrollment?->timezone ?? 'UTC';
        $today = $now->setTimezone($tz)->toDateString();

        DB::transaction(function () use ($rows, $tally, $user, $today) {
            LearningEvent::insert($rows);

            $stat = DailyStat::firstOrCreate(
                ['user_id' => $user->id, 'on_date' => $today],
            );

            // زيادة ذرّية: دفعتان متزامنتان لا تُلغي إحداهما الأخرى
            $inc = array_filter([...$tally, 'events' => count($rows)]);
            if ($inc) {
                DailyStat::where('id', $stat->id)->incrementEach($inc);
            }
        });

        // بلا جسم: المتصفح لا ينتظر شيئاً، وsendBeacon لا يقرأ ردّاً
        return response()->json(null, 204);
    }
}
