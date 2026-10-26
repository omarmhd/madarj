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
    /**
     * Is this the moral of the story? Asked from a day's story station.
     *
     * The answer is not sent with the page — the server judges, as with
     * every exercise (§4.4). After a second wrong try it says which one
     * it was: the answer comes after two attempts, never on the first.
     * A right answer also counts the story as read in the library.
     */
    public function check(Request $request): \Illuminate\Http\JsonResponse
    {
        $data = $request->validate([
            'slug'    => ['required', 'string', 'max:120'],
            'moral'   => ['required', 'string', 'max:600'],
            'attempt' => ['required', 'integer', 'min:1', 'max:10'],
        ]);

        $story = Story::where('slug', $data['slug'])->firstOrFail();
        $correct = trim($data['moral']) === trim((string) $story->moral_ar);

        if ($correct) {
            LearningEvent::firstOrCreate(
                ['user_id' => $request->user()->id, 'type' => 'story_read', 'ref' => $story->slug],
                ['occurred_at' => now()],
            );
        }

        return response()->json([
            'correct' => $correct,
            'answer'  => ! $correct && $data['attempt'] >= 2 ? $story->moral_ar : null,
        ]);
    }

    /**
     * A day's story exercise: is this the order of events, is this the
     * missing word? Rebuilt here from the same seed as the page, judged
     * here. Right, or wrong twice (the answer is then shown), counts the
     * exercise as done for that day — ProgressService checks it.
     */
    public function drill(Request $request): \Illuminate\Http\JsonResponse
    {
        $data = $request->validate([
            'slug'     => ['required', 'string', 'max:120'],
            'week'     => ['required', 'integer', 'between:1,24'],
            'day'      => ['required', 'integer', 'between:1,7'],
            'kind'     => ['required', 'in:order,gap'],
            'answer'   => ['required'],
            'answer.*' => ['string', 'max:20'],
            'attempt'  => ['required', 'integer', 'min:1', 'max:20'],
        ]);

        $user = $request->user();
        $story = Story::where('slug', $data['slug'])->firstOrFail();
        $seed = \App\Services\StoryDrills::seed($user->id, $data['week'], $data['day'], $story->slug);

        if ($data['kind'] === 'order') {
            $right = \App\Services\StoryDrills::order($story, $seed)['answer'];
            $correct = is_array($data['answer']) && array_values($data['answer']) === $right;
        } else {
            $right = \App\Services\StoryDrills::gap($story, $seed)['answer'] ?? '';
            $correct = is_string($data['answer']) && \App\Services\StoryDrills::same($data['answer'], $right);
        }

        $settled = $correct || $data['attempt'] >= 2;
        if ($settled) {
            LearningEvent::firstOrCreate(
                ['user_id' => $user->id, 'type' => 'story_drill',
                 'ref' => "{$story->slug}:{$data['kind']}:w{$data['week']}d{$data['day']}"],
                ['value' => $correct ? 1 : 0, 'occurred_at' => now()],
            );
        }

        return response()->json([
            'correct' => $correct,
            // The answer after two tries, never on the first
            'answer'  => ! $correct && $data['attempt'] >= 2 ? $right : null,
        ]);
    }

    public function index(Request $request): Response
    {
        return Inertia::render('Stories', [
            'stories' => fn () => Story::orderBy('position')
                ->get()
                ->map(fn (Story $s) => $s->toClientArray()),

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
