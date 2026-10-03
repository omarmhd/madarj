<?php

namespace App\Http\Controllers;

use App\Models\BreakTimeCompletion;
use App\Models\Week;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * تأشير أنشطة وقت الاستراحة.
 *
 * يُحتسب ولا يُلزم — لا يقفل يوماً ولا يفتح أسبوعاً ولا يمسّ السلسلة.
 * السبب أن الكتاب يضع هذا القسم خارج ساعة الدراسة، وتحويله إلى شرط
 * ينقض غرضه. لكن ما لا يُحتسب لا يُنجَز، فالعدّاد وحده هو الحافز.
 *
 * ولا فحص قفل هنا بخلاف بقية النقاط: الاستراحة متاحة في أي أسبوع
 * محتواه موجود، وحصرها بالأسبوع المفتوح يمنع من يريد سماع أغنية
 * أسبوع قادم — ولا ضرر في ذلك.
 */
class BreakTimeController extends Controller
{
    /** تأشير نشاط أو إلغاء تأشيره */
    public function toggle(Request $request, Week $week): JsonResponse
    {
        $data = $request->validate([
            'item' => ['required', 'string', 'in:'.implode(',', BreakTimeCompletion::ITEMS)],
            'done' => ['required', 'boolean'],
            // ما لاحظه — حرّ، ولا يُصحَّح، ولا يمنع التأشير
            'note' => ['nullable', 'string', 'max:600'],
        ]);

        $userId = $request->user()->id;

        if ($data['done']) {
            BreakTimeCompletion::updateOrCreate(
                ['user_id' => $userId, 'week_id' => $week->id, 'item_key' => $data['item']],
                ['completed_at' => now(), 'note' => $data['note'] ?? null]
            );
        } else {
            BreakTimeCompletion::forUser($userId)
                ->where('week_id', $week->id)
                ->where('item_key', $data['item'])
                ->delete();
        }

        $rows = BreakTimeCompletion::forUser($userId)->where('week_id', $week->id)->get();
        $done = $rows->pluck('item_key')->all();
        $notes = $rows->pluck('note', 'item_key')->filter()->all();

        return response()->json([
            'done'  => $done,
            'notes' => $notes,
            'count' => count($done),
            'total' => count(BreakTimeCompletion::ITEMS),
        ]);
    }
}
