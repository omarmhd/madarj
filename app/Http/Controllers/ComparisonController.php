<?php

namespace App\Http\Controllers;

use App\Models\Comparison;
use App\Models\Week;
use App\Services\ProgressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * المقارنة الكبرى — يسمع تسجيلاته القديمة ويقيس ما تغيّر.
 *
 * ── لا تقييم على الخادم هنا ─────────────────────────────────
 * §4.4 يقول إنّ التصحيح على الخادم دائماً، وهذا ليس تصحيحاً: لا
 * إجابة صحيحة لـ«كم طول تسجيلك» ولا لـ«ما لم تكن تقدر عليه قبل
 * ستة أسابيع». دور الخادم هنا الحفظ وحده.
 *
 * ── والتسجيلات لا تصل الخادم ───────────────────────────────
 * الملفات في متصفّح المتدرّب (§4.2)، فالتشغيل والمقارنة كلها
 * عنده. ما يصل هنا أرقامٌ كتبها هو وجملٌ كتبها بنفسه.
 */
class ComparisonController extends Controller
{
    /** أكبر ما يُقبل في جملة واحدة — الكتاب يطلب سطراً لا مقالاً */
    public const MAX_SENTENCE = 500;

    /** سقف القيمة الرقمية — أطول تسجيل معقول بالثواني */
    public const MAX_MEASURE = 3600;

    public function __construct(
        protected ProgressService $progress,
    ) {}

    public function store(Request $request, Week $week): JsonResponse
    {
        $data = $request->validate([
            // { "<أسبوع>": { "<رقم المقياس>": رقم أو نعم/لا } }
            'measures'            => ['array'],
            'measures.*'          => ['array'],
            'measures.*.*'        => ['nullable'],

            'sentences'           => ['array', 'max:12'],
            'sentences.*'         => ['nullable', 'string', 'max:'.self::MAX_SENTENCE],
        ]);

        // الأسبوع المقفل لا يُكتب فيه — الخادم لا يثق بالواجهة
        abort_unless(
            $this->progress->isWeekUnlocked($request->user(), $week->number),
            403,
            'هذا الأسبوع مقفل.'
        );

        $comparison = Comparison::updateOrCreate(
            ['user_id' => $request->user()->id, 'week_id' => $week->id],
            [
                'measures'  => $this->cleanMeasures($data['measures'] ?? []),
                'sentences' => $this->cleanSentences($data['sentences'] ?? []),
            ]
        );

        // «أُنجزت» تعني أنّ فيها شيئاً، لا أنّها ممتلئة
        if ($comparison->hasContent() && ! $comparison->completed_at) {
            $comparison->update(['completed_at' => now()]);
        }

        return response()->json([
            'saved'    => true,
            'saved_at' => $comparison->updated_at->toIso8601String(),
        ]);
    }

    /**
     * تنقية القياسات.
     *
     * تُحفظ كما كتبها إلا حدّاً أعلى وشكلاً: الرقم يُقصّ إلى مدى
     * معقول، و«نعم/لا» تبقى منطقية، وما ليس واحداً منهما يُسقَط.
     * وبلا هذا يصير حقلٌ رقميّ مدخلاً حرّاً في قاعدة البيانات.
     */
    protected function cleanMeasures(array $raw): array
    {
        $out = [];

        foreach ($raw as $weekKey => $row) {
            if (! is_array($row)) {
                continue;
            }

            $clean = [];

            foreach ($row as $metric => $value) {
                if ($value === null || $value === '') {
                    continue;
                }

                if (is_bool($value)) {
                    $clean[(string) $metric] = $value;
                    continue;
                }

                if (is_numeric($value)) {
                    $clean[(string) $metric] = max(0, min(self::MAX_MEASURE, (int) $value));
                }
            }

            if ($clean !== []) {
                $out[(string) $weekKey] = $clean;
            }
        }

        return $out;
    }

    /** الجمل بترتيبها، والفراغ يبقى فراغاً لا يُزحزح ما بعده */
    protected function cleanSentences(array $raw): array
    {
        $out = [];

        foreach ($raw as $i => $text) {
            $out[(string) $i] = is_string($text) ? trim($text) : '';
        }

        return $out;
    }
}
