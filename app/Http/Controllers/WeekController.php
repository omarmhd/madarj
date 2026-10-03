<?php

namespace App\Http\Controllers;

use App\Models\BreakTimeCompletion;
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

            // نشاط وقت الاستراحة لهذا اليوم — تذكير لا إلزام
            'breakToday' => function () use ($user, $statsOf, $weeksOf) {
                $stats = $statsOf();

                return $this->breakTimeForDay(
                    $user,
                    $weeksOf()->get($stats['current_week'] ?? 1),
                    $stats['current_day'] ?? null,
                );
            },

        ]);
    }

    /**
     * نشاط وقت الاستراحة المقرّر ليوم دراسي معيّن (1..7).
     *
     * الفهرسة بيوم الأسبوع الدراسي لا بيوم التقويم. الكتاب يكتب
     * خطته «السبت… الجمعة» على افتراض أن المتدرّب يبدأ السبت، ومن
     * يبدأ الأربعاء يجد نشاط السبت في يومه الأول فيرتبك. أما ترتيب
     * الأنشطة السبعة فصحيح دائماً: النشاط الثالث لليوم الثالث.
     *
     * وقسمٌ لا يُذكَّر به لا يُفتَح — وهو ما يخالف غرضه بأن يكون
     * العادة اليومية السهلة. لذلك نُخرج صفّ اليوم إلى اللوحة وإلى
     * صفحة اليوم معاً.
     */
    protected function breakTimeForDay(User $user, ?Week $week, ?int $dayNumber): ?array
    {
        $section = $week?->sections()->where('kind', 'breaktime')->first();
        $plan = $section?->payload['plan'] ?? null;

        if (! $plan || ! $dayNumber) {
            return null;
        }

        $row = $plan[$dayNumber - 1] ?? null;

        if (! $row) {
            return null;
        }

        $itemKey = $this->breakTimeItemKey($row['activity_ar'], $section->payload);
        $item = $itemKey === null ? [] : ($section->payload[$itemKey]['item'] ?? []);

        // صفّ الإنجاز — يُقرأ مرة واحدة، منه الحالة وما كُتب فيه
        $done = $itemKey === null ? null : BreakTimeCompletion::forUser($user->id)
            ->where('week_id', $week->id)
            ->where('item_key', $itemKey)
            ->first();

        return [
            'week_number' => $week->number,
            'day_number'  => $dayNumber,
            // اسم اليوم من الكتاب — سياقاً لا تعريفاً
            'book_day_ar' => $row['day_ar'] ?? null,
            'activity_ar' => $row['activity_ar'],
            'minutes'     => $row['minutes'],
            'link'        => $this->breakTimeLink($section->payload, $itemKey),
            'total'       => collect($plan)->sum('minutes'),
            // النشاط الذي يقابله في العدّاد — ليؤشّره من هنا
            'item_key'    => $itemKey,
            'item_done'   => $done !== null,
            /**
             * تفصيل النشاط — وبدونه لا يعرف المتدرّب ماذا يفعل.
             *
             * صفّ الخطة عبارةٌ من الكتاب: «الأغنية + مهمّة تعقّب النبر».
             * وهي عنوانٌ لا تعليمة — فما «تعقّب النبر»؟ الجواب مخزَّنٌ
             * في خطوات البند نفسه ولم يكن يصل إلى الشاشة، فيقرأ
             * المتدرّب عنواناً لا يفهمه ثم يتخطّاه.
             *
             * والخطوات تُرسَل مع صفّ اليوم لا في صفحة أخرى: النشاط
             * خمس عشرة دقيقة، ومن يُضطرّ إلى مغادرة شاشته ليعرف
             * المطلوب لا يعود.
             */
            'item_label_ar'  => $item['label_ar'] ?? null,
            'item_steps'     => $item['steps'] ?? [],
            'item_why_ar'    => $item['why_ar'] ?? null,
            // مهمّة الملاحظة وما كتبه فيها — تُنجَز من هنا بلا مغادرة اليوم
            'item_prompt_ar' => $item['prompt_ar'] ?? null,
            'item_note'      => $done?->note,
        ];
    }

    /**
     * مفتاح البند الذي يخصّه صفّ اليوم — أو `null` إن لم يخصّ بنداً.
     *
     * ── لماذا لا سقوط افتراضيّ ─────────────────────────────
     * كانت القاعدة: الأغنية والقصة والبودكاست بكلماتها، **وكل ما
     * عداها مشاهدة**. فصفّ «حوّل لغة هاتفك إلى الإنجليزية» كان يُنسَب
     * إلى بند المشاهدة، فتُعرض تحته خطواته: «شاهد حلقة كاملة بلا
     * توقّف» — تعليمةٌ لا علاقة لها بما طُلب. وتعليمةٌ خاطئة أسوأ من
     * لا تعليمة.
     *
     * ── والقاعدة الآن من البيانات لا من الحدس ──────────────
     * يُبحَث عن اسم المصدر نفسه في نصّ الصفّ — «Extra English» و
     * «Storynory» وأسماء البدائل كلّها موجودة في المحتوى. فإن لم
     * يُذكر مصدرٌ ولا كلمةٌ دالّة فالصفّ **قائم بذاته**: نصّه هو
     * التعليمة كاملةً، ولا تُلصَق به خطوات بندٍ آخر.
     */
    protected function breakTimeItemKey(string $activity, array $payload = []): ?string
    {
        if (str_starts_with($activity, 'حرّ')) {
            return null;
        }

        // ① الكلمات الدالّة — يكتبها الكتاب بالعربية في كل أسبوع
        $keywords = [
            'song'    => ['الأغنية', 'الأغاني'],
            // «المتدرّج» تلتقط «الكتاب المتدرّج» و«كتابك المتدرّج» معاً
            'story'   => ['القصة', 'القصص', 'المتدرّج'],
            'channel' => ['البودكاست', 'القناة'],
            'watch'   => ['حلقة', 'مسلسل', 'فيلم'],
        ];

        foreach ($keywords as $key => $words) {
            if (! isset($payload[$key])) {
                continue;
            }

            foreach ($words as $word) {
                if (str_contains($activity, $word)) {
                    return $key;
                }
            }
        }

        // ② اسم المصدر نفسه — من المحتوى لا من قائمة مكتوبة هنا
        foreach (array_keys($keywords) as $key) {
            foreach ($this->breakTimeNames($payload[$key] ?? []) as $name) {
                if (mb_strlen($name) >= 4 && mb_stripos($activity, $name) !== false) {
                    return $key;
                }
            }
        }

        return null;
    }

    /** أسماء مصادر فئةٍ: المختار وبدائله */
    protected function breakTimeNames(array $group): array
    {
        $names = [];

        foreach ([$group['pick'] ?? null, ...($group['alts'] ?? [])] as $o) {
            if (! is_array($o)) {
                continue;
            }

            foreach (['title', 'name', 'source'] as $f) {
                if (! empty($o[$f])) {
                    // «Extra English — Episode 6» يُطابَق باسم المسلسل وحده
                    $names[] = trim(preg_split('/\s+[—–-]\s+/u', $o[$f])[0]);
                }
            }
        }

        return array_unique($names);
    }

    /**
     * ربط نصّ النشاط بالمصدر المناسب.
     *
     * الخطة تقول «الأغنية — التشغيلان الأول والثاني»، والمتدرّب يحتاج
     * رابط الأغنية لا شرحاً. المطابقة بالكلمة المفتاحية.
     */
    protected function breakTimeLink(array $payload, ?string $itemKey): ?array
    {
        // صفٌّ قائم بذاته أو يومٌ حرّ — لا مصدر يُفرَض عليه
        if ($itemKey === null) {
            return null;
        }

        $pick = $payload[$itemKey]['pick'] ?? null;

        if (! $pick) {
            return null;
        }

        return [
            'label'   => $pick['title'] ?? $pick['name'] ?? $pick['source'] ?? 'افتح',
            'url'     => $pick['url'] ?? (isset($pick['search'])
                ? 'https://www.youtube.com/results?search_query='.urlencode($pick['search'])
                : null),
            // ما هذا المصدر أصلاً — الاسم وحده لا يعرّف به
            'note_ar' => $pick['why_ar'] ?? $pick['what_ar'] ?? null,
            'note_en' => $pick['why_en'] ?? $pick['what_en'] ?? null,
        ];
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

            // أقسام الشرح مرجعاً في المكتبة. تشمل Break Time الذي
            // لا تصل إليه مهمة بالتصميم — الكتاب يضعه خارج ساعة الدراسة.
            'sections' => $week->sections->map->toClientArray()->values(),

            // ما أُنجز من أنشطة الاستراحة — يُحتسب ولا يُلزم
            'breakDone' => BreakTimeCompletion::forUser($user->id)
                ->where('week_id', $week->id)
                ->pluck('item_key')
                ->all(),

            // ما لاحظه في كل نشاط — يُعرض في حقله فيرى ما كتبه
            'breakNotes' => BreakTimeCompletion::forUser($user->id)
                ->where('week_id', $week->id)
                ->pluck('note', 'item_key')
                ->filter()
                ->all(),
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
        $tasks = collect($dayModel->tasks)->map(function (array $task) use ($week) {
            // الاسم يُشتقّ من المرجع لحظة الطلب — لا نصّ مخزّن لكل أسبوع
            $name = $this->naming->label($week, $task['ref'] ?? null);

            return [
                ...$task,
                'label_ar' => $name['ar'] ?: ($task['label'] ?? ''),
                'label_en' => $name['en'] ?: ($task['label'] ?? ''),
                'blocks'   => $this->resolveTaskContent($week, $task['ref'] ?? null),
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

            // نشاط الاستراحة المقرّر لهذا اليوم — يُذكَّر به هنا لا يُلزم
            'breakToday' => $this->breakTimeForDay($user, $week, $day),
        ]);
    }

    /**
     * تحويل مرجع مهمة إلى كتل محتوى جاهزة للعرض.
     *
     * المرجع قد يحمل نشاطين مفصولين بـ `|` مثل `vocab:core|dialogue:2`،
     * فنرجع قائمة لا كتلة واحدة.
     */
    protected function resolveTaskContent(Week $week, ?string $ref): array
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
                $blocks[] = [
                    'type'   => 'minimal_pairs',
                    'groups' => $week->pairsByGroup(),
                    'production' => str_contains($token, 'production'),
                ];

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
