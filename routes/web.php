<?php

use App\Http\Controllers\BreakTimeController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\ComparisonController;
use App\Http\Controllers\StoryController;
use App\Http\Controllers\UpgradeController;
use App\Http\Controllers\WeekNoteController;
use App\Http\Controllers\ExerciseController;
use App\Http\Controllers\MemoryController;
use App\Http\Controllers\PlayController;
use App\Http\Controllers\LevelTestController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ProgressController;
use App\Http\Controllers\SetupController;
use App\Http\Controllers\RecordingController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\WeekController;
use App\Http\Controllers\WritingController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| مسارات المنصة
|--------------------------------------------------------------------------
|
| كل المسارات تتطلّب مصادقة — لا يوجد محتوى عام.
| ملاحظة: /week/{week} يستخدم رقم الأسبوع لا المعرّف،
| بفضل getRouteKeyName في نموذج Week.
|
*/

// الجذر ليس صفحة — يحوّل إلى اللوحة، ومنها يُبعَد الزائر إلى الدخول
/*
 * The bare domain: the landing page for a visitor, the dashboard for
 * a learner who is already signed in — they came to study, not to be
 * sold the course again.
 */
Route::get('/', function () {
    if (auth()->check()) {
        return redirect()->route('dashboard');
    }

    return \Inertia\Inertia::render('Landing', [
        'trialWeeks' => (int) \App\Models\Setting::get('trial_weeks', \App\Services\AccessService::DEFAULT_TRIAL_WEEKS),
        'trialDays'  => app(\App\Services\AccessService::class)->trialDays(),

        // The real prices, not copy that drifts from the admin panel
        'plans' => \App\Models\Plan::offered()->get()->map(fn ($p) => [
            'name_ar' => $p->name_ar,
            'months'  => $p->months,
            'price'   => $p->priceLabel(),
            'note_ar' => $p->note_ar,
        ]),

        // Editable copy (admin → صفحة الهبوط) and the WhatsApp support number
        'copy'     => \App\Support\LandingCopy::get(),
        'whatsapp' => \App\Support\LandingCopy::whatsapp(),

        'storiesCount' => \App\Models\Story::count(),

        // The level tests as they are: level, minutes, questions
        'tests' => \App\Models\LevelTest::orderBy('after_week')->get()->map(fn ($t) => [
            'level'      => $t->level,
            'after_week' => $t->after_week,
            'minutes'    => $t->minutes,
            'items'      => count($t->items()),
        ]),

        // A real day from the course — the first one — shown as it is
        'sampleDay' => optional(
            \App\Models\Day::whereHas('week', fn ($q) => $q->where('number', 1))->where('number', 1)->first()
        )->only(['focus', 'tasks']),
    ]);
})->name('home');

Route::middleware(['auth', 'verified', \App\Http\Middleware\RequireSetup::class, \App\Http\Middleware\EnforceAccess::class])->group(function () {

    // صفحة التهيئة — تُعرض مرة قبل أول درس، وتبقى متاحة للتغيير
    Route::get('/setup', [SetupController::class, 'show'])->name('setup');
    Route::post('/setup', [SetupController::class, 'store'])->name('setup.store');

    // لوحة التقدّم — نقطة الدخول
    Route::get('/dashboard', [WeekController::class, 'dashboard'])
        ->name('dashboard');

    // تأشير أنشطة وقت الاستراحة — يُحتسب ولا يُلزم
    Route::post('/week/{week}/break-time', [BreakTimeController::class, 'toggle'])
        ->name('breaktime.toggle');

    /**
     * ملفّ المتدرّب.
     *
     * لم تكن له مسارات إطلاقاً — الصفحة والمتحكّم موجودان وBreeze
     * لم يسجّلهما، فرابط «البروفايل» في الشريط كان يؤدي إلى 404.
     */
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // إعدادات الدورة: المسار والمنطقة الزمنية — تحكمان القفل والسلسلة
    // صوت النطق — يُبدَّل من داخل الدرس لا من التهيئة وحدها
    Route::patch('/profile/voice', [ProfileController::class, 'updateVoice'])
        ->name('profile.voice');

    Route::patch('/profile/course', [ProfileController::class, 'updateCourse'])
        ->name('profile.course');

    // The media guide is hidden: it listed outside tools, and the
    // platform no longer links out. The page and controller are kept;
    // the route sends old bookmarks to the dashboard instead of a 404.
    Route::redirect('/media', '/dashboard')->name('media');

    // صفحة الأسبوع — نظرة عامة ومكتبة مرجعية
    Route::get('/week/{week}', [WeekController::class, 'show'])
        ->name('week.show');

    // صفحة اليوم — محتوى ذلك اليوم ثم مهامه. هذه شاشة العمل اليومية
    Route::get('/week/{week}/day/{day}', [WeekController::class, 'day'])
        ->whereNumber('day')
        ->name('week.day');

    // تحديث التقدّم — تُنادى من مربعات التأشير
    Route::post('/progress/task', [ProgressController::class, 'toggleTask'])
        ->name('progress.task');

    /*
     * Level tests. The old /progress/test took a score from the
     * browser and opened the next module on it — anyone could post
     * 100. The score is now computed here from the answers (§4.4).
     */
    Route::get('/tests', [LevelTestController::class, 'index'])->name('tests');
    Route::post('/tests/{test}/start', [LevelTestController::class, 'start'])->name('tests.start');
    Route::get('/tests/attempt/{attempt}', [LevelTestController::class, 'show'])->name('tests.attempt');
    Route::post('/tests/attempt/{attempt}/save', [LevelTestController::class, 'save'])
        ->middleware('throttle:120,1')->name('tests.save');
    Route::post('/tests/attempt/{attempt}/focus', [LevelTestController::class, 'focus'])
        ->middleware('throttle:60,1')->name('tests.focus');
    Route::post('/tests/attempt/{attempt}/submit', [LevelTestController::class, 'submit'])->name('tests.submit');

    // تصحيح التمارين — على الخادم دائماً
    Route::post('/exercises/{exercise}/check', [ExerciseController::class, 'check'])
        ->name('exercises.check');

    /**
     * سجلّ حركات المتدرّب — دفعات لا أحداثاً مفردة.
     *
     * `throttle` سقفٌ للحماية لا للاستعمال العادي: المتصفح يرسل كل
     * عشر ثوانٍ، أي ستّ مرات في الدقيقة. والستّون تترك مجالاً واسعاً
     * وتمنع حلقةً معطوبة من إغراق الخادم.
     */
    Route::post('/events', [EventController::class, 'store'])
        ->middleware('throttle:60,1')
        ->name('events.store');

    // سجل التسجيلات — بيانات وصفية فقط، بلا ملفات صوتية
    Route::post('/recordings', [RecordingController::class, 'store'])
        ->name('recordings.store');

    Route::get('/recordings', [RecordingController::class, 'index'])
        ->name('recordings.index');

    // التكرار المتباعد — داخل المنصة، بلا تطبيق خارجي
    Route::get('/week/{week}/review/due', [ReviewController::class, 'due'])
        ->name('review.due');

    Route::post('/review/{card}/grade', [ReviewController::class, 'grade'])
        ->name('review.grade');

    /**
     * Play — outside the study hour.
     *
     * The score endpoint is throttled because it is the only write
     * a learner can trigger as fast as they can tap. Sixty a minute
     * is far above one round per minute and stops a broken loop.
     */
    // القصص — قراءة موسّعة خارج ساعة الدراسة
    Route::get('/stories', [StoryController::class, 'index'])->name('stories');

    Route::get('/play', [PlayController::class, 'index'])->name('play');

    Route::post('/play/score', [PlayController::class, 'score'])
        ->middleware('throttle:60,1')
        ->name('play.score');

    Route::post('/play/wordle', [PlayController::class, 'guess'])
        ->middleware('throttle:30,1')
        ->name('play.wordle');

    /**
     * الذاكرة — كلماتك.
     *
     * كل نقاطه صغيرة وتُنادى من الودجة مباشرة، ولا شيء منها يصل مع
     * props اللوحة إلا الملخّص، وهو مؤجَّل.
     *
     * والترجمة وحدها مُحدَّدة بسقف: هي الوحيدة التي قد تخرج إلى
     * خدمة خارجية، والسقف يمنع ذاكرةً مفتوحاً من استنزاف حصّتها.
     */
    Route::get('/memory', [MemoryController::class, 'index'])->name('memory.index');
    Route::post('/memory', [MemoryController::class, 'store'])->name('memory.store');

    Route::post('/memory/translate', [MemoryController::class, 'translate'])
        ->middleware('throttle:30,1')
        ->name('memory.translate');

    Route::patch('/memory/{memoryWord}', [MemoryController::class, 'update'])->name('memory.update');
    Route::post('/memory/{memoryWord}/grade', [MemoryController::class, 'grade'])->name('memory.grade');
    Route::delete('/memory/{memoryWord}', [MemoryController::class, 'destroy'])->name('memory.destroy');

    // مهمة الكتابة §9 — النموذج بنقطة منفصلة كي لا يصل مع props الصفحة
    // استمارات الكتاب — أسئلة عن نفسه، تُحفظ ولا تُقيَّم
    Route::post('/week/{week}/notes', [WeekNoteController::class, 'store'])
        ->name('week-notes.store');

    // الترقية — العرض ثم الطلب. ولا دفع: نتواصل يدوياً
    Route::get('/upgrade', [UpgradeController::class, 'show'])->name('upgrade');
    Route::post('/upgrade', [UpgradeController::class, 'store'])->name('upgrade.store');

    // المقارنة الكبرى — أرقامٌ وجملٌ كتبها المتدرّب، لا تقييم
    Route::post('/week/{week}/comparison', [ComparisonController::class, 'store'])
        ->name('comparison.store');

    Route::post('/week/{week}/writing', [WritingController::class, 'store'])
        ->name('writing.store');

    Route::post('/week/{week}/writing/model', [WritingController::class, 'model'])
        ->name('writing.model');
});

require __DIR__.'/auth.php';
