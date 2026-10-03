<?php

namespace App\Http\Controllers;

use App\Models\Week;
use App\Models\Writing;
use App\Services\ProgressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * مهمة الكتابة الأسبوعية (§9).
 *
 * لا تصحيح آلي هنا — الكتاب يجعل الكتابة الحرّة تقييماً ذاتياً.
 * دور الخادم: يحفظ النص، ويحسب الكلمات، ويسجّل أنه رأى النموذج.
 *
 * ملاحظة أمنية: نموذج الإجابة لا يُرسل مع props الصفحة.
 * يُطلب بنقطة منفصلة، فلا يستطيع قراءته من devtools قبل أن يكتب.
 */
class WritingController extends Controller
{
    public function __construct(
        protected ProgressService $progress,
    ) {}

    /** حفظ ما كتبه — يُنادى عند كل توقّف عن الكتابة */
    public function store(Request $request, Week $week): JsonResponse
    {
        $data = $request->validate([
            'body'       => ['required', 'string', 'max:5000'],
            'self_score' => ['nullable', 'integer', 'between:1,5'],
        ]);

        // الأسبوع المقفل لا يُكتب فيه — الخادم لا يثق بالواجهة
        abort_unless(
            $this->progress->isWeekUnlocked($request->user(), $week->number),
            403,
            'هذا الأسبوع مقفل.'
        );

        $writing = Writing::updateOrCreate(
            ['user_id' => $request->user()->id, 'week_id' => $week->id],
            [
                'body'       => $data['body'],
                'word_count' => Writing::countWords($data['body']),
                'self_score' => $data['self_score'] ?? null,
            ]
        );

        $minWords = (int) ($week->writing['min_words'] ?? 0);

        return response()->json([
            'saved'      => true,
            'word_count' => $writing->word_count,
            'min_words'  => $minWords,
            'enough'     => $writing->meetsMinimum($minWords),
            'saved_at'   => $writing->updated_at->toIso8601String(),
        ]);
    }

    /**
     * كشف نموذج الإجابة.
     *
     * لا يُكشف قبل أن يكتب الحدّ الأدنى — قاعدة الكتاب:
     * من يرى النموذج أولاً ينسخه ولا يتعلّم.
     */
    public function model(Request $request, Week $week): JsonResponse
    {
        abort_unless(
            $this->progress->isWeekUnlocked($request->user(), $week->number),
            403,
            'هذا الأسبوع مقفل.'
        );

        $writing = Writing::where('user_id', $request->user()->id)
            ->where('week_id', $week->id)
            ->first();

        $minWords = (int) ($week->writing['min_words'] ?? 0);
        $written  = $writing?->word_count ?? 0;

        if ($written < $minWords) {
            return response()->json([
                'revealed'  => false,
                'reason'    => 'اكتب '.$minWords.' كلمة على الأقل أولاً. كتبت '.$written.'.',
                'word_count' => $written,
                'min_words'  => $minWords,
            ], 422);
        }

        $writing->update(['model_seen' => true]);

        return response()->json([
            'revealed'     => true,
            'model_answer' => $week->writing['model_answer'] ?? '',
        ]);
    }
}
