<?php

namespace App\Http\Controllers;

use App\Models\Recording;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * سجل التسجيلات الصوتية.
 *
 * الملف الصوتي لا يُرفع — يبقى في IndexedDB عند المستخدم.
 * هنا نحفظ البيانات الوصفية فقط: الأسبوع، المدة، المرجع المحلي.
 */
class RecordingController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'week_number'      => ['required', 'integer', 'between:1,24'],
            'duration_seconds' => ['required', 'integer', 'min:1', 'max:3600'],
            'local_ref'        => ['required', 'string', 'max:64'],
            'self_score'       => ['nullable', 'integer', 'min:0'],
            'self_score_max'   => ['nullable', 'integer', 'min:1'],
            'note'             => ['nullable', 'string', 'max:1000'],
        ]);

        $recording = Recording::create([
            ...$data,
            'user_id'     => $request->user()->id,
            'recorded_at' => now(),
        ]);

        return response()->json([
            'id'        => $recording->id,
            'duration'  => $recording->duration_label,
            'milestone' => $recording->isMilestone(),
        ]);
    }

    /** قائمة تسجيلات المستخدم — لصفحة المقارنة */
    public function index(Request $request): JsonResponse
    {
        return response()->json(
            Recording::where('user_id', $request->user()->id)
                ->orderBy('week_number')
                ->get()
                ->map(fn ($r) => [
                    'id'          => $r->id,
                    'week_number' => $r->week_number,
                    'duration'    => $r->duration_label,
                    'local_ref'   => $r->local_ref,
                    'self_score'  => $r->self_score,
                    'milestone'   => $r->isMilestone(),
                    'recorded_at' => $r->recorded_at->toDateString(),
                ])
        );
    }
}
