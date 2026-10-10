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
            // Not a fixed ceiling: days have five to seven tasks, and the
            // service checks the order against the day's actual plan
            'task'  => ['required', 'integer', 'min:1'],
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
