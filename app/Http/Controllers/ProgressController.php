<?php

namespace App\Http\Controllers;

use App\Services\ProgressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * نقاط تحديث التقدّم.
 *
 * تُنادى من الواجهة عبر router.post من Inertia.
 * ترجع JSON لأنها لا تغيّر الصفحة — فقط الحالة.
 */
class ProgressController extends Controller
{
    public function __construct(
        protected ProgressService $progress,
    ) {}

    /**
     * تأشير مهمة — ما يُنادى عند كل نقرة على مربع تأشير.
     */
    public function toggleTask(Request $request): JsonResponse
    {
        $data = $request->validate([
            'week'  => ['required', 'integer', 'between:1,24'],
            'day'   => ['required', 'integer', 'between:1,7'],
            'task'  => ['required', 'integer', 'between:1,5'],
            'done'  => ['required', 'boolean'],
        ]);

        $result = $this->progress->toggleTask(
            $request->user(),
            $data['week'],
            $data['day'],
            $data['task'],
            $data['done'],
        );

        return response()->json($result);
    }
}
