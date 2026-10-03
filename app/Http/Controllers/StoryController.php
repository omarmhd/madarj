<?php

namespace App\Http\Controllers;

use App\Models\LearningEvent;
use App\Models\Story;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * القصص — قراءة موسّعة خارج ساعة الدراسة.
 *
 * ── لماذا هي هنا أصلاً ─────────────────────────────────────
 * الكتاب يوصي في «وقت الاستراحة» بالقارئ المُدرَّج: نصٌّ سهل يُقرأ
 * بكثرة بلا قاموس. وهي أنفع ما يُملأ به الوقت خارج الساعة، وكانت
 * توصيةً بلا شيء يُفتَح.
 *
 * ── الثلاثون كلّها تُرسَل مرّة ─────────────────────────────
 * نحو ثلاثين كيلوبايت: المتدرّب يقلّب بينها كما يقلّب صفحات كتاب،
 * وطلبٌ عند كل قصّة يجعل التقليب انتظاراً. وهي محتوى ثابت مشترك
 * فلا تتغيّر بين مستخدم وآخر.
 *
 * ── وما قرأه من عائلة التقدّم ──────────────────────────────
 * علامةٌ في سجلّ الأحداث لا جدول: لا تقفل شيئاً ولا تكسر سلسلة،
 * وأثرها الوحيد أن يعرف أين وصل في المكتبة.
 */
class StoryController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('Stories', [
            'stories' => fn () => Story::orderBy('position')
                ->get()
                ->map(fn (Story $s) => [
                    'slug'      => $s->slug,
                    'title_en'  => $s->title_en,
                    'title_ar'  => $s->title_ar,
                    'level'     => $s->level,
                    'source_ar' => $s->source_ar,
                    'minutes'   => $s->minutes,
                    'why_ar'    => $s->why_ar,
                    'lines'     => $s->lines,
                    'moral_en'  => $s->moral_en,
                    'moral_ar'  => $s->moral_ar,
                    'words'     => $s->words ?? [],
                    'word_count' => $s->wordCount(),
                    // السرد إن وُجد: ملفّ واحد وبدايات جمله بالثواني
                    'audio'      => $s->has_audio
                        ? ['url' => $s->audioUrl(), 'cues' => $s->cues()]
                        : null,
                ]),

            // Which level to open first: the learner's own, from their week
            'my_level' => fn () => Story::levelForWeek(
                $request->user()->enrollment?->current_week ?? 1
            ),

            // ما ختمه — استعلام واحد على الفهرس (user_id, type, ref)
            'read' => fn () => LearningEvent::where('user_id', $request->user()->id)
                ->where('type', 'story_read')
                ->distinct()
                ->pluck('ref'),
        ]);
    }
}
