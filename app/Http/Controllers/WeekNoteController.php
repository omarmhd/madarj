<?php

namespace App\Http\Controllers;

use App\Models\Week;
use App\Models\WeekNote;
use App\Services\ProgressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * استمارات الكتاب — أسئلة عن نفسه يكتب أجوبتها.
 *
 * ── لا تقييم على الخادم ────────────────────────────────────
 * §4.4 يوجب التصحيح على الخادم، وهذا ليس تصحيحاً: لا إجابة
 * صحيحة لـ«ما أصعب لحظة في المحادثة» ولا لـ«متى درسك القادم».
 * دور الخادم الحفظ والحدود وحدها.
 */
class WeekNoteController extends Controller
{
    /** أطول جواب مقبول — الاستمارة أسطر لا مقالات */
    public const MAX_ANSWER = 600;

    /** أكثر ما تحمله استمارة — أطولها سبعة أسئلة وخانة خطّة */
    public const MAX_ANSWERS = 20;

    public function __construct(
        protected ProgressService $progress,
    ) {}

    public function store(Request $request, Week $week): JsonResponse
    {
        $data = $request->validate([
            'kind'        => ['required', 'string', 'in:'.implode(',', WeekNote::KINDS)],
            'answers'     => ['array', 'max:'.self::MAX_ANSWERS],
            'answers.*'   => ['nullable', 'string', 'max:'.self::MAX_ANSWER],
        ]);

        // الأسبوع المقفل لا يُكتب فيه — الخادم لا يثق بالواجهة
        abort_unless(
            $this->progress->isWeekUnlocked($request->user(), $week->number),
            403,
            'هذا الأسبوع مقفل.'
        );

        $answers = [];

        // الفراغ يبقى فراغاً في موضعه: حذفه يُزحزح ما بعده
        foreach ($data['answers'] ?? [] as $key => $value) {
            $answers[(string) $key] = is_string($value) ? trim($value) : '';
        }

        $note = WeekNote::updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'week_id' => $week->id,
                'kind'    => $data['kind'],
            ],
            ['answers' => $answers]
        );

        return response()->json([
            'saved'    => true,
            'saved_at' => $note->updated_at->toIso8601String(),
        ]);
    }
}
