<?php

namespace App\Http\Controllers;

use App\Models\Exercise;
use App\Models\ExerciseAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * تصحيح التمارين — على الخادم دائماً.
 *
 * الواجهة ترسل الإجابة، والخادم يحكم ويرجع النتيجة مع الشرح.
 * الإجابة الصحيحة لا تُرسل للمتصفح قبل المحاولة أبداً.
 */
class ExerciseController extends Controller
{
    public function check(Request $request, Exercise $exercise): JsonResponse
    {
        $data = $request->validate([
            'response' => ['required'],
        ]);

        $isCorrect = $exercise->check($data['response']);

        // رقم المحاولة — نحفظ كل المحاولات لا الأخيرة فقط
        $attemptNo = ExerciseAttempt::where('user_id', $request->user()->id)
            ->where('exercise_id', $exercise->id)
            ->max('attempt_no') + 1;

        ExerciseAttempt::create([
            'user_id'     => $request->user()->id,
            'exercise_id' => $exercise->id,
            'response'    => ['value' => $data['response']],
            'is_correct'  => $isCorrect,
            'attempt_no'  => $attemptNo,
        ]);

        return response()->json([
            'correct'     => $isCorrect,
            'attempt_no'  => $attemptNo,
            // الشرح يُرسل بعد المحاولة فقط
            'explanation' => $exercise->explanation,
            // الإجابة الصحيحة تُكشف بعد محاولتين فاشلتين
            'reveal'      => (! $isCorrect && $attemptNo >= 2)
                ? $this->revealOf($exercise)
                : null,
        ]);
    }

    /**
     * The right answer, said as the learner would read it.
     *
     * Only typed answers have `accepted`; a choice stores the option's
     * index and true/false a boolean. Reading `accepted` alone revealed
     * nothing for them, so a learner who missed twice was never shown the
     * answer — and the drill retried the same question forever.
     */
    protected function revealOf(Exercise $exercise): ?string
    {
        $answer = $exercise->answer ?? [];

        return match ($exercise->type) {
            'multiple_choice' => $exercise->payload['options'][$answer['correct'] ?? -1] ?? null,
            'true_false'      => ($answer['correct'] ?? null) === null ? null : (($answer['correct']) ? 'صحيح' : 'خطأ'),
            'order_words'     => isset($answer['order']) ? implode(' ', $answer['order']) : null,
            'match'           => isset($answer['pairs'])
                ? collect($answer['pairs'])->map(fn ($r, $l) => "$l → $r")->implode(' · ')
                : null,
            default           => $answer['accepted'][0] ?? null,
        };
    }
}
