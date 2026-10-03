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
                ? ($exercise->answer['accepted'][0] ?? null)
                : null,
        ]);
    }
}
