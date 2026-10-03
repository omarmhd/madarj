<?php

namespace App\Http\Controllers;

use App\Models\Week;
use App\Services\ProgressService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * صفحة الأسبوع — الشاشة الرئيسية للمتدرب.
 *
 * ملاحظة على الأمان: نستخدم toClientArray() للتمارين
 * لأن الإجابات لا يجوز أن تصل المتصفح. التصحيح على الخادم.
 */
class WeekController extends Controller
{
    public function __construct(
        protected ProgressService $progress,
    ) {}

    /** لوحة التقدّم — نقطة الدخول */
    public function dashboard(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Dashboard', [
            'stats' => $this->progress->dashboard($user),
            'weeks' => Week::orderBy('number')->get()->map(fn (Week $w) => [
                'number'   => $w->number,
                'module'   => $w->module,
                'title_en' => $w->title_en,
                'title_ar' => $w->title_ar,
                'unlocked' => $this->progress->isWeekUnlocked($user, $w->number),
            ]),
        ]);
    }

    /** صفحة أسبوع واحد بكل محتواه */
    public function show(Request $request, Week $week): Response
    {
        $user = $request->user();

        abort_unless(
            $this->progress->isWeekUnlocked($user, $week->number),
            403,
            'هذا الأسبوع مقفل. أكمل الأسبوع السابق أولاً.'
        );

        $week->load([
            'days', 'vocabulary', 'minimalPairs',
            'dialogues.lines', 'exercises',
        ]);

        return Inertia::render('Week/Show', [
            'week' => [
                'number'       => $week->number,
                'module'       => $week->module,
                'title_en'     => $week->title_en,
                'title_ar'     => $week->title_ar,
                'objectives'   => $week->objectives,
                'pron_section' => $week->pron_section,
            ],

            'days' => $this->progress->weekDayStates($user, $week),

            // المفردات مجمّعة — كل مجموعة جدول منفصل كما في الكتاب
            'vocabulary' => $week->vocabularyByGroup()->map(
                fn ($items) => $items->map(fn ($v) => [
                    'id'        => $v->id,
                    'word'      => $v->word,
                    'ipa'       => $v->ipa,
                    'arabic'    => $v->arabic,
                    'example'   => $v->example,
                    'cambridge' => $v->cambridge_url,
                ])->values()
            ),

            // أزواج التمييز الصوتي مجمّعة — تغذّي اللعبة
            'minimalPairs' => $week->pairsByGroup()->map(
                fn ($items) => $items->map(fn ($p) => [
                    'id'     => $p->id,
                    'ipa'    => $p->ipa,
                    'word_a' => $p->word_a,
                    'word_b' => $p->word_b,
                ])->values()
            ),

            'dialogues' => $week->dialogues->map(fn ($d) => [
                'number'       => $d->number,
                'title'        => $d->title,
                'situation_en' => $d->situation_en,
                'situation_ar' => $d->situation_ar,
                'lines'        => $d->lines->map(fn ($l) => [
                    'speaker' => $l->speaker,
                    'en'      => $l->en,
                    'ar'      => $l->ar,
                ]),
            ]),

            // التمارين بلا إجاباتها — التصحيح على الخادم
            'exercises' => $week->exercises
                ->groupBy('day_number')
                ->map(fn ($group) => $group->map->toClientArray()->values()),
        ]);
    }
}
