<?php

namespace App\Http\Controllers;

use App\Models\ReviewCard;
use App\Models\Vocabulary;
use App\Models\Week;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * التكرار المتباعد — مراجعة المفردات داخل المنصة.
 *
 * لا تطبيق خارجي. كانت خطة اليوم تحيل المتدرّب إلى Anki،
 * وهذا يعني مغادرة المنصة وتحميل ملفات وإعدادها — وهو ما
 * لن يفعله مبتدئ. كل شيء هنا.
 *
 * توزيع العمل حسب `AGENTS.md`: حسابات FSRS تجري في المتصفح
 * (ts-fsrs) والخادم يحفظ النتيجة فقط. السبب المكتوب: توفير حمل
 * الخادم وإمكانية المراجعة بلا إنترنت ثم المزامنة.
 *
 * دور الخادم إذاً: يقول ما هو مستحق، ويخزّن ما آلت إليه البطاقة.
 */
class ReviewController extends Controller
{
    /** أقصى عدد بطاقات في جلسة واحدة — الجلسة الطويلة تُنفّر */
    protected const SESSION_LIMIT = 20;

    /**
     * New words per session, at most. Twenty random new cards crowded
     * out the words actually due to return, and mixed last week's words
     * with yesterday's in no order — the session felt like the same
     * lesson again, not a review of what came before.
     */
    protected const NEW_LIMIT = 8;

    /** The learner's own words (the 🧠 memory) mixed into each session */
    protected const MEMORY_LIMIT = 5;

    /**
     * البطاقات المستحقة الآن، مع بطاقات جديدة من هذا الأسبوع.
     *
     * الجديدة تُنشأ عند أول طلب لا عند الاستيراد: إنشاء بطاقة لكل
     * كلمة لكل مستخدم عند التسجيل يعني 2000 صف لمن قد لا يبدأ.
     */
    public function due(Request $request, Week $week): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'day' => ['nullable', 'integer', 'between:1,7'],
        ]);

        /*
         * Seed only what earlier days taught. The review opens the day,
         * before the day's own words are learned — seeding "up to today"
         * served today's words as review, then the lesson taught them,
         * then the flashcards drilled them: the same words three times
         * in an hour, and none of yesterday's.
         */
        $upTo = isset($data['day']) ? max(0, $data['day'] - 1) : null;
        if ($upTo !== 0) {
            $this->seedCardsForWeek($user->id, $week, $upTo);
        }

        /**
         * Two queries, because the two halves are ordered by different
         * things — and one of them must not be ordered at all.
         *
         * ── The bug this replaces ──────────────────────────────
         * It was a single query: due cards first, then `orderBy
         * due_at`. But every card a learner has never seen is seeded
         * with the *same* `due_at`, so for a beginner the whole
         * ordering was one flat tie — and a tie is resolved by row
         * order. The session therefore opened on the same word, and
         * served the same twenty in the same sequence, every single
         * time. Forty cards behaved like one.
         *
         * ── The rule now ──────────────────────────────────────
         * Cards that are actually due are ordered by *how* overdue
         * they are: the oldest debt first, which is what spaced
         * repetition means. New cards have no such order — nothing
         * distinguishes them — so they are drawn at random, and the
         * session looks different each time it opens.
         *
         * Due before new is kept: a word you are about to forget
         * matters more than a word you have never met.
         */
        $due = ReviewCard::with('vocabulary:id,word,ipa,arabic,example,group')
            ->forUser($user->id)
            ->due()
            ->where('state', '!=', 'new')
            ->orderBy('due_at')
            ->limit(self::SESSION_LIMIT)
            ->get();

        $room = min(self::NEW_LIMIT, self::SESSION_LIMIT - $due->count());

        // New words in the order they were taught — seeding follows the
        // day plan, so the card id is the order of learning: oldest first
        /*
         * A new card only for a word already taught: any earlier week, or a
         * group this week's plan introduced before today. Seeding follows the
         * same rule, but cards seeded under older rules are still in the
         * table — and a review that asks for a word never shown is not a
         * review. Filtering here holds whatever the table contains.
         */
        // Opened from the week page (no day): the whole week counts as taught
        $taughtThisWeek = $upTo === null
            ? $week->vocabulary()->distinct()->pluck('group')->all()
            : ($upTo > 0 ? $this->introducedGroups($week, $upTo) : []);
        $earlierWeeks = Week::where('number', '<', $week->number)->pluck('id');

        $fresh = $room > 0
            ? ReviewCard::with('vocabulary:id,word,ipa,arabic,example,group')
                ->forUser($user->id)
                ->new()
                ->whereHas('vocabulary', fn ($q) => $q
                    ->whereIn('week_id', $earlierWeeks)
                    ->orWhere(fn ($q) => $q->where('week_id', $week->id)->whereIn('group', $taughtThisWeek ?: ['']))
                )
                ->orderBy('id')
                ->limit($room)
                ->get()
            : collect();

        $cards = $due->concat($fresh);

        // The learner's own words, due or never reviewed — graded on
        // their own table, so each carries where its result goes
        $memory = \App\Models\MemoryWord::forUser($user->id)
            ->where(fn ($q) => $q->due()->orWhere('state', 'new'))
            ->orderBy('due_at')
            ->limit(self::MEMORY_LIMIT)
            ->get();

        return response()->json([
            'cards' => $cards->map(fn (ReviewCard $c) => [
                'id'         => $c->id,
                'source'     => 'course',
                'word'       => $c->vocabulary->word,
                'ipa'        => $c->vocabulary->ipa,
                'arabic'     => $c->vocabulary->arabic,
                'example'    => $c->vocabulary->example,
                'group'      => $c->vocabulary->group,
                // حالة FSRS كما هي — المتصفح يحسب عليها
                'state'      => $c->state,
                'stability'  => $c->stability,
                'difficulty' => $c->difficulty,
                'reps'       => $c->reps,
                'lapses'     => $c->lapses,
                'due_at'     => $c->due_at?->toIso8601String(),
                'last_reviewed_at' => $c->last_reviewed_at?->toIso8601String(),
            ])->concat($memory->map(fn ($m) => [
                'id'         => $m->id,
                'source'     => 'memory',
                'word'       => $m->term,
                'ipa'        => null,
                'arabic'     => $m->translation ?: $m->term,
                'example'    => null,
                'group'      => 'memory',
                'state'      => $m->state,
                'stability'  => $m->stability,
                'difficulty' => $m->difficulty,
                'reps'       => $m->reps,
                'lapses'     => $m->lapses,
                'due_at'     => $m->due_at?->toIso8601String(),
                'last_reviewed_at' => $m->last_reviewed_at?->toIso8601String(),
            ]))->shuffle()->values()->all(),

            'counts' => [
                'due'   => ReviewCard::forUser($user->id)->due()->where('state', '!=', 'new')->count(),
                'new'   => ReviewCard::forUser($user->id)->new()->count(),
                'total' => ReviewCard::forUser($user->id)->count(),
            ],
        ]);
    }

    /**
     * حفظ نتيجة مراجعة بطاقة.
     *
     * المتصفح يحسب بـ ts-fsrs ويرسل الحالة الجديدة. الخادم يتحقّق
     * من الملكية والمدى، ثم يخزّن — لا يعيد الحساب.
     */
    public function grade(Request $request, ReviewCard $card): JsonResponse
    {
        // لا يراجع بطاقة غيره
        abort_unless($card->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'due_at'     => ['required', 'date'],
            'stability'  => ['required', 'numeric', 'min:0'],
            'difficulty' => ['required', 'numeric', 'between:0,10'],
            'reps'       => ['required', 'integer', 'min:0'],
            'lapses'     => ['required', 'integer', 'min:0'],
            'state'      => ['required', 'in:new,learning,review,relearning'],
        ]);

        $card->update([
            ...$data,
            'last_reviewed_at' => now(),
        ]);

        return response()->json([
            'saved'  => true,
            'due_at' => $card->due_at->toIso8601String(),
            'state'  => $card->state,
        ]);
    }

    /**
     * المجموعات التي قُدّمت للمتدرّب حتى يوم معيّن.
     *
     * تُستخرج من خطة الأيام: مهمة تحمل `vocab:family,numbers` تعني أن
     * هذين قُدّما في ذلك اليوم. فلا نعتمد على ترتيب افتراضي، ولا
     * نحتاج جدولاً جديداً — الخطة نفسها هي الجدول.
     */
    protected function introducedGroups(Week $week, ?int $upToDay): ?array
    {
        // بلا يوم محدّد: كل مجموعات الأسبوع (كصفحة الأسبوع المرجعية)
        if ($upToDay === null) {
            return null;
        }

        $groups = [];

        foreach ($week->days->where('number', '<=', $upToDay) as $day) {
            foreach ($day->tasks as $task) {
                $ref = $task['ref'] ?? null;
                if (! $ref) {
                    continue;
                }

                foreach (explode('|', $ref) as $token) {
                    $token = trim($token);
                    if (! str_starts_with($token, 'vocab:')) {
                        continue;
                    }

                    foreach (explode(',', explode(':', $token, 2)[1]) as $g) {
                        $g = trim($g);
                        if ($g !== '') {
                            $groups[$g] = true;
                        }
                    }
                }
            }
        }

        return array_keys($groups);
    }

    /**
     * إنشاء بطاقات لكلمات قُدّمت فعلاً ولا بطاقة لها.
     *
     * القيد الجوهري: **لا تُزرع بطاقة لكلمة لم تُدرَّس**. زرع مفردات
     * الأسبوع كلها في اليوم الأول يعني تقديم كلمات اليوم الخامس
     * لمن لم يرَها — وهذا يُفشل الجلسة ويُحطّم الثقة، ويخالف
     * قاعدة الكتاب في أن المراجعة تلي التعلّم لا تسبقه.
     *
     * idempotent: تشغيله مراراً لا يضاعف شيئاً، بفضل القيد
     * الفريد (user_id, vocabulary_id) وفحص ما هو موجود.
     */
    protected function seedCardsForWeek(int $userId, Week $week, ?int $upToDay = null): void
    {
        $groups = $this->introducedGroups($week, $upToDay);

        /*
         * أسبوع فيه مفردات ولا إشارة `vocab:` في خطته — كالأسبوع
         * الثالث والعشرين، الذي يقدّم عباراته في قسم «المواقف» لا في
         * بطاقات. لولا هذا الاستثناء لبقيت عباراته العشرون بلا بطاقة
         * إلى الأبد.
         */
        if ($groups === []) {
            $hasRefs = $week->days->contains(
                fn ($day) => collect($day->tasks)->contains(
                    fn ($t) => str_contains((string) ($t['ref'] ?? ''), 'vocab:')
                )
            );
            if (! $hasRefs) {
                $groups = null;   // كل مفردات الأسبوع
            }
        }

        // مجموعات لم تُقدَّم بعد — لا شيء يُراجَع، وهذا صحيح لا خطأ
        if ($groups !== null && $groups === []) {
            return;
        }

        $scope = $week->vocabulary();
        if ($groups !== null) {
            $scope->whereIn('group', $groups);
        }

        $existing = ReviewCard::forUser($userId)
            ->whereIn('vocabulary_id', $week->vocabulary()->select('id'))
            ->pluck('vocabulary_id')
            ->all();

        $missing = $scope
            ->whereNotIn('id', $existing ?: [0])
            ->get(['id']);

        if ($missing->isEmpty()) {
            return;
        }

        $now = now();

        ReviewCard::insert(
            $missing->map(fn (Vocabulary $v) => [
                'user_id'       => $userId,
                'vocabulary_id' => $v->id,
                // مستحقة فوراً: البطاقة الجديدة تُقدَّم في أول جلسة
                'due_at'        => $now,
                'stability'     => 0,
                'difficulty'    => 0,
                'reps'          => 0,
                'lapses'        => 0,
                'state'         => 'new',
                'created_at'    => $now,
                'updated_at'    => $now,
            ])->all()
        );
    }
}
