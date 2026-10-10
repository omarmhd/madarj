<?php

namespace App\Http\Controllers;

use App\Models\Comparison;
use App\Models\DayCompletion;
use App\Models\ReviewCard;
use App\Models\User;
use App\Models\Week;
use App\Models\WeekGate;
use App\Models\WeekNote;
use App\Models\Writing;
use App\Services\ContentNaming;
use App\Services\ProgressService;
use Illuminate\Http\RedirectResponse;
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
    /** طول الدورة — 24 أسبوعاً حتى لو لم يُدخل محتواها كله */
    protected const TOTAL_WEEKS = 24;

    /**
     * الوحدات الأربع ومستوياتها — من «الخريطة» في مقدّمة الكتاب.
     *
     * ثابت في الكود لا في المحتوى: بنية الدورة لا تتغيّر بين
     * الأسابيع، ولا معنى لتكرارها في أربعة وعشرين ملف JSON.
     */
    protected const MODULES = [
        ['number' => 1, 'weeks' => [1, 6], 'title_ar' => 'بناء أساس الأصوات', 'title_en' => 'Building the Sound Foundation', 'from' => 'A1', 'to' => 'A1+', 'words' => 500],
        ['number' => 2, 'weeks' => [7, 12], 'title_ar' => 'الماضي والحاضر', 'title_en' => 'Past and Present', 'from' => 'A1+', 'to' => 'A2', 'words' => 1000],
        ['number' => 3, 'weeks' => [13, 18], 'title_ar' => 'الكلام المتصل', 'title_en' => 'Connected Speech', 'from' => 'A2', 'to' => 'A2+', 'words' => 1500],
        ['number' => 4, 'weeks' => [19, 24], 'title_ar' => 'الطلاقة', 'title_en' => 'Fluency', 'from' => 'A2+', 'to' => 'B1', 'words' => 2000],
    ];

    /** محطات التقييم — من «جدول التقييم» في الكتاب */
    protected const MILESTONES = [
        6  => 'اختبار الوحدة الأولى',
        12 => 'اختبار Cambridge مرة أخرى — المتوقّع A2',
        18 => 'عرض مسجّل 3 دقائق يُقارن بخط الأساس',
        24 => 'اختبار EF SET كامل — الهدف B1',
    ];

    public function __construct(
        protected ProgressService $progress,
        protected ContentNaming $naming,
    ) {}

    /**
     * لوحة التقدّم — نقطة الدخول.
     *
     * تعرض الطريق كاملاً: أربع وعشرون أسبوعاً في أربع وحدات، حتى ما
     * لم يُدخل محتواه بعد. رؤية الطريق كله تحفّز، وإخفاء ما بعد
     * الأسبوع الجاري يجعل الدورة تبدو بلا نهاية معلومة.
     */
    public function dashboard(Request $request): Response
    {
        $user = $request->user();

        /**
         * كل خاصية ثقيلة تُغلَّف في دالّة.
         *
         * Inertia لا يستدعي الدالّة إلا إن كانت الخاصية مطلوبة. وهذا
         * هو ما يجعل التأجيل ربحاً لا خسارة: النداء الثاني الذي يجلب
         * `memory` كان يعيد حساب اللوحة كاملة — واحداً وخمسين استعلاماً
         * ليُرجع صفّين. أما الآن فلا يُحسب إلا ما طُلب.
         *
         * و`$stats` تُحسب مرة واحدة ولو طلبها اثنان.
         */
        $stats = null;
        $statsOf = function () use (&$stats, $user) {
            return $stats ??= $this->progress->dashboard($user);
        };

        // ما أُدخل محتواه فعلاً — مفتاحه رقم الأسبوع
        $existing = null;
        $weeksOf = function () use (&$existing) {
            return $existing ??= Week::orderBy('number')->get()->keyBy('number');
        };

        return Inertia::render('Dashboard', [
            'stats' => $statsOf,

            /*
             * The test waiting for them, if any. Finishing a module
             * lands the learner on its review week; the dashboard then
             * sends them to the test instead of leaving it in a menu.
             * And before the first day: the pre-test, once.
             */
            'dueTest' => fn () => $this->dueTest($request->user()),

            /*
             * أين أنا من A1 إلى B1.
             *
             * اللوحة كانت تقول «الوحدة 2» و«A1+ → A2» وتترك للمتدرّب
             * أن يستنتج مستواه من فرق بينهما — وهو أول ما يسأل عنه.
             * فهنا يُقال صراحةً: أنت الآن كذا، وتصل إلى كذا بعد كذا.
             *
             * والكلمات ليست تقديراً: البطاقات تُبذَر أسبوعاً بأسبوع
             * حين يبلغه المتدرّب، فعددها ما قابله فعلاً، والمدروس
             * منها ما جاوز حالة «جديدة».
             *
             * ودالّة لا قيمة — فهي للوحة وحدها، ولا تدفعها صفحة
             * الأسبوع ولا اليوم وإن شاركتاها `stats`.
             */
            'level' => function () use ($user) {
                $week = $user->enrollment->current_week;

                $module = collect(self::MODULES)
                    ->first(fn ($m) => $week >= $m['weeks'][0] && $week <= $m['weeks'][1])
                    ?? self::MODULES[0];

                // صفّ واحد يحمل العددين — لا استعلامان
                $words = ReviewCard::forUser($user->id)
                    ->selectRaw('COUNT(*) AS met')
                    ->selectRaw("SUM(CASE WHEN state != 'new' THEN 1 ELSE 0 END) AS studied")
                    ->first();

                // سلّم الكتاب: خمس محطّات، ومنزلة المتدرّب بينها
                $scale = ['A1', 'A1+', 'A2', 'A2+', 'B1'];

                return [
                    'now'        => $module['from'],
                    'next'       => $module['to'],
                    'module'     => $module['number'],
                    'module_ar'  => $module['title_ar'],
                    'scale'      => $scale,
                    'at'         => array_search($module['from'], $scale, true),
                    // الموضع على الشريط: أسبوعٌ من أربعة وعشرين
                    'percent'    => (int) round((min($week, 24) - 1) / 24 * 100),
                    'weeks_left' => max(0, $module['weeks'][1] - $week + 1),
                    'words_met'  => (int) ($words->met ?? 0),
                    'words_studied' => (int) ($words->studied ?? 0),
                    'words_goal' => $module['words'],
                ];
            },

            'weeks' => function () use ($user, $weeksOf) {
                $existing = $weeksOf();

                $completions = DayCompletion::where('user_id', $user->id)
                    ->whereNotNull('completed_at')
                    ->get()
                    ->groupBy('week_id');

                /**
                 * البوابات المفتوحة — استعلام واحد لا ثلاثة وعشرين.
                 *
                 * كان كل أسبوع يسأل `isWeekUnlocked` فيجري استعلامين:
                 * واحداً للأسبوع وآخر لبوابته. أي ستّة وأربعين استعلاماً
                 * لرسم شريط لا يتغيّر. وهي تُجلب هنا دفعةً واحدة.
                 *
                 * وهذا عرضٌ لا إذن: القفل الحقيقي يبقى في `week.show`
                 * و`week.day` كما تنصّ §4.6.
                 */
                $open = WeekGate::where('user_id', $user->id)
                    ->whereNotNull('unlocked_at')
                    ->pluck('week_id')
                    ->flip();

                /*
                 * الاستحقاق مرّة واحدة لأربعة وعشرين أسبوعاً.
                 *
                 * `mayOpenWeek` يسأل عن الاشتراك في كل نداء، وأربعة
                 * وعشرون نداءً تعني أربعة وعشرين استعلاماً — وهو عين ما
                 * أُصلح هنا سابقاً. فالجواب يُحسب مرّة: مشترِكٌ أو مدير
                 * يملك الكلّ، وغيرهما يملك عدد أسابيع تجربته.
                 */
                $access = app(\App\Services\AccessService::class);
                $all = $user->is_admin || $access->hasSubscription($user);
                $trial = $access->trialWeeks($user);

                $entitled = fn (int $n) => $all || $n <= $trial;

                /*
                 * The development bypass has to be honoured here too.
                 *
                 * This board reads the gate rows directly rather than
                 * asking `isWeekUnlocked` — that is what took it from
                 * fifty-one queries to seven. The cost is that it no
                 * longer inherits the service's answer, so a switch
                 * that opened every week on the server left the board
                 * still drawing padlocks.
                 */
                $bypass = $this->progress->locksBypassed();

                return collect(range(1, self::TOTAL_WEEKS))->map(function (int $n) use (
                    $existing, $completions, $open, $bypass, $entitled
                ) {
                    $week = $existing->get($n);

                    return [
                        'number'    => $n,
                        'module'    => (int) ceil($n / 6),
                        'title_en'  => $week?->title_en,
                        'title_ar'  => $week?->title_ar,
                        'is_review' => $week?->is_review ?? in_array($n, [6, 12, 18, 24], true),
                        // بلا محتوى = لم يُدخل بعد، وهذا يختلف عن «مقفل»
                        'has_content' => $week !== null,
                        /*
                         * الاستحقاق يُسأل هنا كما في القفل.
                         *
                         * هذا اللوح يقرأ صفوف البوّابات مباشرةً — وهو ما
                         * أنزل استعلاماته من واحدٍ وخمسين إلى سبعة. وثمنه
                         * أنّه لا يرث جواب الخدمة، فلمّا أُضيفت طبقة
                         * الاستحقاق لم تصل إليه: قال اللوح «الأسبوع الثاني
                         * مفتوح» ودعا المتدرّب إليه، فصفعه الخادم بـ403.
                         *
                         * ومصدرا حقيقةٍ لواقعةٍ واحدة يفترقان دائماً. وهذه
                         * الدالّة لا تسأل القاعدة: تجربةٌ وحقل ومقارنة.
                         */
                        'unlocked'  => $week !== null
                            && ($bypass || $n === 1 || $open->has($week->id))
                            && ($bypass || $entitled($n)),
                        'days_done' => $week ? ($completions->get($week->id)?->count() ?? 0) : 0,
                    ];
                });
            },

            /*
             * The wall — and why the server names it.
             *
             * A learner who finished week one had `current_week` moved
             * to two, so the board said "you are on week 2" and the
             * resume card offered a door that answered 403. Progression
             * advanced without asking whether the week was owned.
             *
             * The fix is not to hold `current_week` back — they did
             * finish the week, and a counter that lies about that is a
             * second wrong answer. It is to say, alongside it, that the
             * next week is not theirs yet. The dashboard then swaps the
             * resume card for the upgrade card instead of inferring the
             * wall from `unlocked` being false, which is also what an
             * unstudied week looks like.
             */
            'wall' => function () use ($user, $statsOf) {
                $locked = app(\App\Services\AccessService::class)->firstLockedWeek($user);

                // لا جدار، أو لم يبلغه بعد
                if ($locked === null || $statsOf()['current_week'] < $locked) {
                    return null;
                }

                return [
                    'week'    => $locked,
                    'trial'   => $locked - 1,
                    // طلبٌ مفتوح يغيّر النصّ: من «اشترك» إلى «ننتظرك»
                    'pending' => \App\Models\UpgradeRequest::where('user_id', $user->id)
                        ->open()
                        ->exists(),
                ];
            },

            'modules'    => self::MODULES,
            'milestones' => self::MILESTONES,


        ]);
    }

    /** صفحة أسبوع واحد بكل محتواه */
    public function show(Request $request, Week $week): Response|RedirectResponse
    {
        $user = $request->user();

        /*
         * سببان للمنع، وجوابان مختلفان.
         *
         * من لم يشترك ليس كمن لم يدرس. وكانت الرسالة واحدة — «أكمل
         * الأسبوع السابق أولاً» — تُقال لمن أتمّه فعلاً وانتهت تجربته،
         * فتكون كاذبة ومحيّرة معاً. ولا يُعرض عليه سعرٌ ولا زرّ، بل
         * 403 خام.
         *
         * فالاستحقاق يُسأل أولاً: من لا يملك يُؤخذ إلى العرض، ومن
         * يملك ولم يدرس يُقال له الحقيقة.
         */
        if (! app(\App\Services\AccessService::class)->mayOpenWeek($user, $week->number)) {
            return redirect()->route('upgrade');
        }

        abort_unless(
            $this->progress->isWeekUnlocked($user, $week->number),
            403,
            'هذا الأسبوع مقفل. أكمل الأسبوع السابق أولاً.'
        );

        $week->load([
            'days', 'vocabulary', 'minimalPairs',
            'dialogues.lines', 'exercises', 'sections',
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

            // رأس الصفحة يعرض السلسلة والمسار — تشترطها Props في Week/Show
            'stats' => $this->progress->dashboard($user),

            // §9 الكتابة — بلا model_answer: يُطلب بنقطة منفصلة بعد أن يكتب،
            // وإلا قرأه من devtools ونسخه بدل أن يحاول
            'writing' => $week->writing
                ? collect($week->writing)->except('model_answer')->all()
                : null,

            // ما كتبه سابقاً — ليعود لنصّه لا ليبدأ من الصفر
            'myWriting' => Writing::where('user_id', $user->id)
                ->where('week_id', $week->id)
                ->first(['body', 'word_count', 'self_score', 'model_seen', 'updated_at']),

            /*
             * ما قاسه وكتبه في المقارنة الكبرى.
             *
             * الكتاب يأمر بحفظ الصفحة، وقيمة التمرين في العودة إليها
             * بعد ستة أسابيع — فقسمٌ يُفتح فارغاً كلّ مرّة يُبطل الأمر.
             * صفٌّ واحد بمفتاح فريد (متدرّب، أسبوع).
             */
            'myComparison' => Comparison::where('user_id', $user->id)
                ->where('week_id', $week->id)
                ->first(['measures', 'sentences', 'updated_at']),

            // إجابات استمارات هذا الأسبوع، بنوعها — يعود إليها كما تركها
            'myNotes' => WeekNote::where('user_id', $user->id)
                ->where('week_id', $week->id)
                ->pluck('answers', 'kind'),

            /*
             * خطّة الكلام الأسبوعيّة — تُختار مرّة وتُذكَّر كل أسبوع.
             *
             * الكتاب يجعلها التزاماً أسبوعيّاً متكرّراً، لا سطراً
             * يُقرأ مرّة في الأسبوع الثاني عشر ثم يُنسى. فهي تُقرأ
             * بلا قيد الأسبوع الحالي، ولذلك يُخزَّن نصّها مع رقمها:
             * الأسبوع العشرون لا يحمل محتوى قسم الثاني عشر.
             *
             * ودالّة لا قيمة: صفحةٌ لا تطلبها لا تدفع استعلامها.
             */
            'speakingPlan' => fn () => WeekNote::where('user_id', $user->id)
                ->where('kind', 'conversation')
                ->latest('updated_at')
                ->first()?->answers['plan_text'] ?? null,

            // أسماء المجموعات بالعربية — من المحتوى، فتتبع الكتاب لا الكود
            'vocabularyLabels' => $week->vocabulary
                ->groupBy('group')
                ->map(fn ($items) => $items->first()->group_label_ar),

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

            // Sound contrasts, already grouped and named in Arabic
            'minimalPairs' => $week->pairsByGroup(),

            'dialogues' => $week->dialogues->map(fn ($d) => [
                'number'       => $d->number,
                'title'        => $d->title,
                'situation_en' => $d->situation_en,
                'situation_ar' => $d->situation_ar,
                // خريطة الجنس — الواجهة تختار بها صوتاً أنثوياً أو ذكورياً
                'speaker_genders' => $d->speaker_genders ?? [],
                'lines'           => $d->lines->map(fn ($l) => [
                    'speaker' => $l->speaker,
                    'en'      => $l->en,
                    'ar'      => $l->ar,
                ]),
            ]),

            // التمارين بلا إجاباتها — التصحيح على الخادم
            'exercises' => $week->exercises
                ->groupBy('day_number')
                ->map(fn ($group) => $group->map->toClientArray()->values()),

            // أقسام الشرح مرجعاً في المكتبة
            'sections' => $week->sections->map->toClientArray()->values(),

        ]);
    }

    /**
     * صفحة يوم واحد — محتواه التعليمي ثم مهامه.
     *
     * لماذا صفحة مستقلة لا قسم في صفحة الأسبوع:
     * الكتاب يقول «افتح صندوق اليوم، أنجز مهامه، ثم أغلق الصفحة».
     * عرض محتوى الأسبوع كله بجانب خطة اليوم يجعل المتدرّب يتصفّح
     * بلا هدف. هنا لا يرى إلا ما يحتاجه اليوم.
     *
     * الترتيب يتبع مهام اليوم لا أقسام الكتاب: المهمة الثانية تفتح
     * المفردات، فالمفردات تأتي ثانية. خطة اليوم هي التي تحكم.
     */
    public function day(Request $request, Week $week, int $day): Response|RedirectResponse
    {
        $user = $request->user();

        /*
         * سببان للمنع، وجوابان مختلفان.
         *
         * من لم يشترك ليس كمن لم يدرس. وكانت الرسالة واحدة — «أكمل
         * الأسبوع السابق أولاً» — تُقال لمن أتمّه فعلاً وانتهت تجربته،
         * فتكون كاذبة ومحيّرة معاً. ولا يُعرض عليه سعرٌ ولا زرّ، بل
         * 403 خام.
         *
         * فالاستحقاق يُسأل أولاً: من لا يملك يُؤخذ إلى العرض، ومن
         * يملك ولم يدرس يُقال له الحقيقة.
         */
        if (! app(\App\Services\AccessService::class)->mayOpenWeek($user, $week->number)) {
            return redirect()->route('upgrade');
        }

        // طبقتا القفل: الأسبوع ثم اليوم. الخادم لا يثق بالواجهة.
        abort_unless(
            $this->progress->isWeekUnlocked($user, $week->number),
            403,
            'هذا الأسبوع مقفل. أكمل الأسبوع السابق أولاً.'
        );

        abort_unless(
            $this->progress->isDayUnlocked($user, $week->number, $day),
            403,
            'هذا اليوم مقفل. أكمل اليوم السابق أولاً.'
        );

        $dayModel = $week->days()->where('number', $day)->firstOrFail();

        $states = collect($this->progress->weekDayStates($user, $week));
        $state = $states->firstWhere('number', $day);

        $week->load(['vocabulary', 'minimalPairs', 'dialogues.lines', 'exercises', 'sections']);

        // كل مهمة تُرفق بمحتواها — الواجهة لا تبحث ولا تخمّن
        $tasks = collect($dayModel->tasks)->map(function (array $task) use ($week, $day) {
            // الاسم يُشتقّ من المرجع لحظة الطلب — لا نصّ مخزّن لكل أسبوع
            $name = $this->naming->label($week, $task['ref'] ?? null);

            return [
                ...$task,
                'label_ar' => $name['ar'] ?: ($task['label'] ?? ''),
                'label_en' => $name['en'] ?: ($task['label'] ?? ''),
                'blocks'   => $this->resolveTaskContent($week, $task['ref'] ?? null, $day),
            ];
        })->values()->all();

        return Inertia::render('Week/Day', [
            'week' => [
                'number'   => $week->number,
                'module'   => $week->module,
                'title_ar' => $week->title_ar,
                'title_en' => $week->title_en,
            ],
            'day' => [
                'number'     => $dayModel->number,
                // الوصف بلغتين — يُشتقّ من مهامّ اليوم لا يُخزَّن
                'focus'      => $this->naming->dayFocus($week, $dayModel->tasks)['ar'],
                'focus_ar'   => $this->naming->dayFocus($week, $dayModel->tasks)['ar'],
                'focus_en'   => $this->naming->dayFocus($week, $dayModel->tasks)['en'],
                'minutes'    => $dayModel->totalMinutes(),
                'tasks'      => $tasks,
                'tasks_done' => $state['tasks_done'] ?? [],
                'completed'  => $state['completed'] ?? false,
                'percent'    => $state['percent'] ?? 0,
            ],
            'stats'    => $this->progress->dashboard($user),
            'lastDay'  => $week->days->max('number'),
            'nextDayUnlocked' => $this->progress->isDayUnlocked($user, $week->number, $day + 1),

            // ما كتبه سابقاً — تظهر في مهمة الكتابة إن كانت من مهام اليوم
            'myWriting' => Writing::where('user_id', $user->id)
                ->where('week_id', $week->id)
                ->first(['body', 'word_count', 'self_score', 'model_seen']),

            /*
             * ما قاسه وكتبه في المقارنة الكبرى.
             *
             * الكتاب يأمر بحفظ الصفحة، وقيمة التمرين في العودة إليها
             * بعد ستة أسابيع — فقسمٌ يُفتح فارغاً كلّ مرّة يُبطل الأمر.
             * صفٌّ واحد بمفتاح فريد (متدرّب، أسبوع).
             */
            'myComparison' => Comparison::where('user_id', $user->id)
                ->where('week_id', $week->id)
                ->first(['measures', 'sentences', 'updated_at']),

            // إجابات استمارات هذا الأسبوع، بنوعها — يعود إليها كما تركها
            'myNotes' => WeekNote::where('user_id', $user->id)
                ->where('week_id', $week->id)
                ->pluck('answers', 'kind'),

        ]);
    }

    /**
     * تحويل مرجع مهمة إلى كتل محتوى جاهزة للعرض.
     *
     * المرجع قد يحمل نشاطين مفصولين بـ `|` مثل `vocab:core|dialogue:2`،
     * فنرجع قائمة لا كتلة واحدة.
     */
    protected function resolveTaskContent(Week $week, ?string $ref, int $day = 0): array
    {
        if ($ref === null || $ref === '') {
            return [];
        }

        $blocks = [];

        foreach (explode('|', $ref) as $token) {
            $token = trim($token);
            if ($token === '') {
                continue;
            }

            if (str_starts_with($token, 'vocab:')) {
                // `vocab:family,numbers` مجموعتان لا واحدة. أخذ الأولى فقط
                // كان يُسقط 20 كلمة من الأسبوع بلا أي أثر في الواجهة.
                foreach (explode(',', explode(':', $token, 2)[1]) as $group) {
                    $group = trim($group);
                    if ($group === '') {
                        continue;
                    }

                    $words = $week->vocabulary->where('group', $group)->values();

                    $blocks[] = [
                        'type'  => 'vocabulary',
                        'group' => $group,
                        // الاسم العربي من المحتوى لا من خريطة في الواجهة
                        'group_label_ar' => $words->first()?->group_label_ar,
                        'items' => $words->map(fn ($v) => [
                            'id'        => $v->id,
                            'word'      => $v->word,
                            'ipa'       => $v->ipa,
                            'arabic'    => $v->arabic,
                            'example'   => $v->example,
                            'cambridge' => $v->cambridge_url,
                        ])->all(),
                    ];
                }

                continue;
            }

            if (str_starts_with($token, 'dialogue:')) {
                $number = (int) explode(':', $token, 2)[1];
                $d = $week->dialogues->firstWhere('number', $number);

                if ($d) {
                    $blocks[] = [
                        'type'            => 'dialogue',
                        'number'          => $d->number,
                        'title'           => $d->title,
                        'situation_ar'    => $d->situation_ar,
                        'situation_en'    => $d->situation_en,
                        'speaker_genders' => $d->speaker_genders ?? [],
                        'lines'           => $d->lines->map(fn ($l) => [
                            'speaker' => $l->speaker,
                            'en'      => $l->en,
                            'ar'      => $l->ar,
                        ])->all(),
                    ];
                }

                continue;
            }

            if (str_starts_with($token, 'game:minimal_pairs') || str_starts_with($token, 'pron:')) {
                $production = str_contains($token, 'production');

                $blocks[] = [
                    'type'   => 'minimal_pairs',
                    'groups' => $production ? $week->pairsByGroup() : $this->pairsForDay($week, $day),
                    'production' => $production,
                ];

                continue;
            }

            if (str_starts_with($token, 'spell:')) {
                $block = $this->spellingBlock($week, substr($token, 6), $day);
                if ($block) {
                    $blocks[] = $block;
                }

                continue;
            }

            if ($token === 'shadow') {
                // No material at all: fall back to the week's speaking task
                $blocks[] = $this->shadowFor($week, $day) ?? [
                    'type'     => 'record',
                    'baseline' => false,
                    'speaking' => $week->sections->firstWhere('kind', 'speaking')?->payload,
                ];

                continue;
            }

            if ($token === 'homework') {
                $blocks[] = $this->homeworkFor($week, $day);

                continue;
            }

            if ($token === 'imitate') {
                $item = collect($week->sections->firstWhere('kind', 'practice')?->payload['items'] ?? [])
                    ->firstWhere('day', $day);

                if ($item) {
                    $blocks[] = ['type' => 'imitate', 'item' => $item];
                }

                continue;
            }

            if (str_starts_with($token, 'exercises:')) {
                $dayNo = (int) explode(':', $token, 2)[1];

                $blocks[] = [
                    'type'  => 'exercises',
                    'day'   => $dayNo,
                    // بلا إجابات — التصحيح على الخادم
                    'items' => $week->exercises
                        ->where('day_number', $dayNo)
                        ->map->toClientArray()
                        ->values()
                        ->all(),
                ];

                continue;
            }

            if (str_starts_with($token, 'record')) {
                // مهمّة الأسبوع تسافر مع المسجّل: مسجّلٌ بلا موضوع
                // يُفتح ثم يُغلق، ولا يعرف صاحبه لماذا فتحه
                $blocks[] = [
                    'type'     => 'record',
                    'baseline' => str_contains($token, 'baseline'),
                    'speaking' => $week->sections
                        ->firstWhere('kind', 'speaking')?->payload,
                ];

                continue;
            }

            // المراجعة تجلب بطاقاتها بنفسها — تعتمد على الاستحقاق لا الأسبوع
            if (str_starts_with($token, 'review')) {
                $blocks[] = ['type' => 'review'];

                continue;
            }

            if (str_starts_with($token, 'writing')) {
                $blocks[] = [
                    'type'    => 'writing',
                    // بلا model_answer — يُطلب بنقطة منفصلة بعد الكتابة
                    'writing' => $week->writing
                        ? collect($week->writing)->except('model_answer')->all()
                        : null,
                ];

                continue;
            }

            // أقسام الشرح: القواعد والنطق والعبارات والاستماع والقراءة
            if (str_starts_with($token, 'section:')) {
                $kind = explode(':', $token, 2)[1];
                $section = $week->sections->firstWhere('kind', $kind);

                if ($section) {
                    $blocks[] = [
                        'type'    => 'section',
                        'section' => $section->toClientArray(),
                    ];

                    continue;
                }
            }

            // مرجع لا يقابله محتوى — يظهر صريحاً بدل زرّ صامت
            $blocks[] = ['type' => 'unbuilt', 'ref' => $token];
        }

        return $blocks;
    }

    /**
     * The sound contrast for this day — one group, not the whole week.
     *
     * Every day used to receive every pair of the week, so a learner
     * played the same twelve questions six days running. The groups now
     * rotate, one a day, and the last day of the week takes them all as
     * a review. One group a day is also what §2.4 asks for: contrasts
     * practised apart, never mixed.
     */
    protected function pairsForDay(Week $week, int $day)
    {
        $groups = $week->pairsByGroup();
        $lastDay = (int) $week->days()->max('number');

        if ($day < 1 || $groups->count() <= 1 || $day >= $lastDay) {
            return $groups;
        }

        return collect([$groups[($day - 1) % $groups->count()]]);
    }

    /**
     * The day each vocabulary group, dialogue and section first appears
     * in the week's plan.
     *
     * @return array<string, int>  e.g. ['vocab:family' => 2, 'dialogue:1' => 3]
     */
    protected function introductions(Week $week): array
    {
        $seen = [];

        foreach ($week->days()->orderBy('number')->get() as $d) {
            foreach ($d->tasks ?? [] as $task) {
                foreach (explode('|', (string) ($task['ref'] ?? '')) as $token) {
                    $token = trim($token);

                    if (str_starts_with($token, 'vocab:')) {
                        foreach (explode(',', substr($token, 6)) as $g) {
                            $seen['vocab:'.trim($g)] ??= $d->number;
                        }
                    } elseif (str_starts_with($token, 'dialogue:') || str_starts_with($token, 'section:')) {
                        $seen[$token] ??= $d->number;
                    }
                }
            }
        }

        return $seen;
    }

    /**
     * A spelling drill.
     *
     * `spell:family,numbers` drills named groups with support first
     * (vowel gaps), then from memory. `spell:review` takes a dozen words
     * from groups introduced on earlier days — a spelling recalled after
     * a night's gap sticks better than one copied straight after
     * learning — and drills them by ear, then from memory.
     */
    protected function spellingBlock(Week $week, string $arg, int $day): ?array
    {
        $review = $arg === 'review';

        // Spelling is for words. A six-word phrase typed from memory is a
        // test of patience, and the phrase groups have their own drills.
        $spellable = fn ($v) => str_word_count($v->word) <= 3;

        if ($review) {
            $groups = collect($this->introductions($week))
                ->filter(fn ($d, $k) => str_starts_with($k, 'vocab:') && $d < $day)
                ->keys()->map(fn ($k) => substr($k, 6));

            $words = $week->vocabulary->whereIn('group', $groups->all())
                ->filter($spellable)->shuffle()->take(12)->values();

            /*
             * Nothing learned earlier this week — the first days of a week,
             * or a week whose plan teaches no word groups. Then the review
             * reaches back: a normal week to the week before, a review week
             * to its whole unit. Spelling recalled after days, not hours, is
             * the review that sticks, so this is the better material anyway.
             */
            if ($words->isEmpty() && $week->number > 1) {
                $pool = fn (array $numbers) => \App\Models\Vocabulary::query()
                    ->whereIn('week_id', Week::whereIn('number', $numbers)->pluck('id'))
                    ->get()
                    ->filter($spellable);

                $unit = range(max(1, $week->number - 5), $week->number - 1);

                // The week before can itself hold nothing to spell (a review
                // week's lists are phrases) — then the unit behind it
                $words = ($week->is_review ? collect() : $pool([$week->number - 1]))
                    ->whenEmpty(fn () => $pool($unit))
                    ->shuffle()->take(12)->values();
            }
        } else {
            $groups = collect(explode(',', $arg))->map(fn ($g) => trim($g))->filter();
            $words = $week->vocabulary->whereIn('group', $groups->all())->filter($spellable)->values();

            // Twenty at most — week 8 has a group of eighty. The rest come
            // back through `spell:review` on the following days.
            if ($words->count() > 20) {
                $words = $words->shuffle()->take(20)->values();
            }
        }

        if ($words->isEmpty()) {
            return null;
        }

        return [
            'type'   => 'spelling',
            'review' => $review,
            'rounds' => $review ? ['dictation', 'recall'] : ['gaps', 'recall'],
            'words'  => $words->map(fn ($v) => [
                'id'     => $v->id,
                'word'   => $v->word,
                'arabic' => $v->arabic,
                'ipa'    => $v->ipa,
            ])->all(),
        ];
    }

    /**
     * Today's shadowing paragraph.
     *
     * Drawn from what the learner has already met this week — a dialogue
     * or listening text introduced on or before today — so it never
     * shows the listening transcript before the day whose method says
     * "do not read the text before step three". Before any of those
     * appear, it falls back to the survival phrases, then to the example
     * sentences of words already learned.
     */
    protected function shadowFor(Week $week, int $day): ?array
    {
        $intro = $this->introductions($week);
        $introducedBy = fn (string $key) => ($intro[$key] ?? 99) <= $day;

        $dialogueParts = function (bool $onlyIntroduced) use ($week, $introducedBy): array {
            $parts = [];

            foreach ($week->dialogues->sortBy('number') as $d) {
                if ($onlyIntroduced && ! $introducedBy('dialogue:'.$d->number)) {
                    continue;
                }

                $spoken = $d->lines->filter(fn ($l) => $l->speaker)->values()->all();
                $genders = $d->speaker_genders ?? [];

                foreach ($this->balancedChunks($spoken, 4) as $chunk) {
                    $chunk = collect($chunk);
                    $parts[] = [
                        'source_ar' => 'من الحوار '.$d->number,
                        'title_en'  => $d->title,
                        'lines'     => $chunk->map(fn ($l) => [
                            'en'      => $l->en,
                            'speaker' => $l->speaker,
                            'gender'  => $genders[$l->speaker] ?? $genders[strtoupper($l->speaker)] ?? null,
                        ])->values()->all(),
                        'ar' => $chunk->pluck('ar')->filter()->implode(' '),
                    ];
                }
            }

            return $parts;
        };

        $pool = $dialogueParts(true);

        $listening = $week->sections->firstWhere('kind', 'listening');
        if ($listening && $introducedBy('section:listening')) {
            foreach ($listening->payload['transcript'] ?? [] as $para) {
                $sentences = preg_split('/(?<=[.!?])\s+/u', trim($para['en'] ?? ''), -1, PREG_SPLIT_NO_EMPTY);

                // A long paragraph becomes short ones; a part has no matching translation
                $parts = $this->balancedChunks($sentences, 5);
                foreach ($parts as $part) {
                    $pool[] = [
                        'source_ar' => 'من نص الاستماع',
                        'title_en'  => $listening->title_en,
                        'lines'     => array_map(fn ($en) => ['en' => $en], $part),
                        'ar'        => count($parts) === 1 ? ($para['ar'] ?? null) : null,
                    ];
                }
            }
        }

        if ($pool === []) {
            $phrases = $week->sections->firstWhere('kind', 'phrases');
            $items = collect($phrases?->payload['groups'] ?? [])->flatMap(fn ($g) => $g['items'] ?? []);

            if ($phrases && $introducedBy('section:phrases')) {
                foreach ($items->chunk(5) as $chunk) {
                    $pool[] = [
                        'source_ar' => 'من عبارات النجاة',
                        'title_en'  => null,
                        'lines'     => $chunk->map(fn ($i) => ['en' => $i['en']])->values()->all(),
                        'ar'        => $chunk->pluck('ar')->implode(' · '),
                    ];
                }
            }
        }

        if ($pool === []) {
            $groups = collect($intro)
                ->filter(fn ($d, $k) => str_starts_with($k, 'vocab:') && $d <= $day)
                ->keys()->map(fn ($k) => substr($k, 6));

            $examples = $week->vocabulary->whereIn('group', $groups->all())
                ->pluck('example')->filter()->unique()->values();

            if ($examples->isNotEmpty()) {
                $pool[] = [
                    'source_ar' => 'جمل من كلمات هذا الأسبوع',
                    'title_en'  => null,
                    'lines'     => $examples->take(5)->map(fn ($e) => ['en' => $e])->values()->all(),
                    'ar'        => null,
                ];
            }
        }

        // Nothing met yet: a dialogue ahead of its day still beats no shadowing
        if ($pool === []) {
            $pool = $dialogueParts(false);
        }

        /*
         * A week with no dialogues of its own — the review weeks, and the
         * situations week. Its unit's earlier dialogues, then: shadowing
         * a conversation already studied is exactly what review is for.
         */
        if ($pool === [] && $week->number > 1) {
            $earlier = \App\Models\Dialogue::with('lines')
                ->whereIn('week_id', Week::whereBetween('number', [max(1, $week->number - 5), $week->number - 1])->pluck('id'))
                ->get();

            foreach ($earlier as $d) {
                $spoken = $d->lines->filter(fn ($l) => $l->speaker)->values()->all();
                $genders = $d->speaker_genders ?? [];

                foreach ($this->balancedChunks($spoken, 4) as $chunk) {
                    $chunk = collect($chunk);
                    $pool[] = [
                        'source_ar' => 'من حوار سابق في هذه الوحدة',
                        'title_en'  => $d->title,
                        'lines'     => $chunk->map(fn ($l) => [
                            'en'      => $l->en,
                            'speaker' => $l->speaker,
                            'gender'  => $genders[$l->speaker] ?? $genders[strtoupper($l->speaker)] ?? null,
                        ])->values()->all(),
                        'ar' => $chunk->pluck('ar')->filter()->implode(' '),
                    ];
                }
            }

            // Spread the days across the unit, not the first dialogue's four parts
            $step = max(1, intdiv(count($pool), 6));
            $pool = array_values(array_filter($pool, fn ($_, $i) => $i % $step === 0, ARRAY_FILTER_USE_BOTH));
        }

        if ($pool === []) {
            return null;
        }

        return [
            'type'   => 'shadow',
            'shadow' => [
                ...$pool[max(0, $day - 1) % count($pool)],
                'save_as' => sprintf('Week%02d-Day%d', $week->number, $day),
            ],
        ];
    }

    /**
     * The day's homework — one task away from the screen, from a weekly
     * cycle of seven, filled with that day's material.
     *
     * The cycle replaced Break Time. Each kind is built from what the
     * server already knows about the day (its words, its dialogue), so
     * 168 days need no authored homework. The learner writes a short
     * proof; the day does not complete without it (ProgressService).
     */
    protected function homeworkFor(Week $week, int $day): array
    {
        $kinds = [1 => 'label', 2 => 'teach', 3 => 'dialogue', 4 => 'sentences', 5 => 'hunt', 6 => 'speak', 7 => 'message'];
        $kind = $kinds[(($day - 1) % 7) + 1];

        // Today's words, else the week's so far, else the week before
        $intro = $this->introductions($week);
        $groupsBy = fn ($cmp) => collect($intro)->filter(fn ($d, $k) => str_starts_with($k, 'vocab:') && $cmp($d))->keys()->map(fn ($k) => substr($k, 6))->all();
        $words = $week->vocabulary->whereIn('group', $groupsBy(fn ($d) => $d === $day));
        if ($words->isEmpty()) {
            $words = $week->vocabulary->whereIn('group', $groupsBy(fn ($d) => $d <= $day));
        }
        if ($words->isEmpty() && $week->number > 1) {
            $words = \App\Models\Vocabulary::whereIn('week_id', Week::where('number', $week->number - 1)->pluck('id'))->get();
        }
        $words = $words->filter(fn ($v) => str_word_count($v->word) <= 3)->shuffle()->take($kind === 'teach' ? 3 : 5)->values();

        // The latest dialogue met by today, else the first one
        $dialogue = $week->dialogues->sortByDesc('number')
            ->first(fn ($d) => ($intro['dialogue:'.$d->number] ?? 99) <= $day) ?? $week->dialogues->sortBy('number')->first();

        // A dialogue day with no dialogue becomes a sentences day
        if ($kind === 'dialogue' && ! $dialogue) {
            $kind = 'sentences';
        }

        return [
            'type'     => 'homework',
            'kind'     => $kind,
            'day'      => $day,
            'words'    => $words->map(fn ($v) => ['word' => $v->word, 'arabic' => $v->arabic])->all(),
            'dialogue' => $kind === 'dialogue' ? [
                'title' => $dialogue->title,
                'lines' => $dialogue->lines->filter(fn ($l) => $l->speaker)->take(8)
                    ->map(fn ($l) => ['speaker' => $l->speaker, 'en' => $l->en])->values()->all(),
            ] : null,
        ];
    }

    /**
     * Split into parts of at most `$max`, as even as possible.
     *
     * `array_chunk` leaves the remainder alone at the end: thirteen
     * dialogue lines in fours gave a fourth "paragraph" of one line.
     * Thirteen now splits 4 · 3 · 3 · 3.
     */
    protected function balancedChunks(array $items, int $max): array
    {
        $n = count($items);
        if ($n === 0) {
            return [];
        }

        $parts = (int) ceil($n / $max);
        $base = intdiv($n, $parts);
        $extra = $n % $parts;
        $out = [];
        $at = 0;

        for ($i = 0; $i < $parts; $i++) {
            $size = $base + ($i < $extra ? 1 : 0);
            $out[] = array_slice($items, $at, $size);
            $at += $size;
        }

        return $out;
    }

    /** The level test the learner should sit now, or null */
    protected function dueTest($user): ?array
    {
        $week = $user->enrollment?->current_week ?? 1;

        $taken = \App\Models\LevelTestAttempt::where('user_id', $user->id)
            ->whereNotNull('submitted_at')
            ->get(['level_test_id', 'passed'])
            ->groupBy('level_test_id');

        $test = \App\Models\LevelTest::orderBy('after_week')->get()->first(function ($t) use ($week, $taken) {
            $mine = $taken->get($t->id);

            // The pre-test is offered only in week 1 and only until taken
            if ($t->after_week === 0) {
                return $week === 1 && ! $mine;
            }

            return $week >= $t->after_week && ! ($mine && $mine->contains('passed', true));
        });

        return $test ? [
            'slug'       => $test->slug,
            'level'      => $test->level,
            'placement'  => $test->after_week === 0,
            'minutes'    => $test->minutes,
        ] : null;
    }
}
