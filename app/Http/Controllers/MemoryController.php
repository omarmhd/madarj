<?php

namespace App\Http\Controllers;

use App\Models\MemoryWord;
use App\Services\WordTranslator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * الذاكرة — كلماتك.
 *
 * ── ما يفعله وما لا يفعله ───────────────────────────────────
 * يحفظ كلمةً صادفت المتدرّب خارج الكتاب، ويعيدها إليه في موعدها.
 * **ولا يقفل يوماً ولا يكسر سلسلة ولا يدخل في نسبة التقدّم** —
 * لأنه اختياري، وما كان اختيارياً ثم عُوقب على تركه صار عبئاً.
 *
 * ── توزيع العمل ─────────────────────────────────────────────
 * كما في `ReviewController`: المتصفّح يحسب بـts-fsrs، والخادم
 * يقول ما هو مستحقّ ويخزّن ما آلت إليه البطاقة. لا حساب هنا.
 */
class MemoryController extends Controller
{
    public function __construct(protected WordTranslator $translator) {}

    /**
     * قاعدة الترميز.
     *
     * قاعدة `string` في لارافيل لا تفحص الترميز، وبايتٌ واحد ليس
     * UTF-8 يمرّ إلى القاعدة ثم يُفجّر `json_encode` عند أول قراءة
     * — فيتعطّل الذاكرة كلّه لا الكلمة وحدها. والمنع هنا أرخص من
     * إصلاح صفٍّ فاسد بعد أن يُكتب.
     */
    protected function utf8(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) {
            if (is_string($value) && ! mb_check_encoding($value, 'UTF-8')) {
                $fail('النصّ غير صالح.');
            }
        };
    }

    /**
     * الأعداد وحدها — ما يحتاجه زرّ الذاكرة.
     *
     * الزرّ يعرض رقماً واحداً: كم كلمة تنتظر. فلا معنى لأن يحمل معه
     * الكلمات نفسها قبل أن يُفتح — استعلامٌ واحد بلا صفوف، والفهرس
     * `(user_id, due_at)` يخدمه.
     */
    public function counts(Request $request): array
    {
        $row = MemoryWord::forUser($request->user()->id)
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(CASE WHEN state = ? THEN 1 ELSE 0 END) as fresh', ['new'])
            ->selectRaw('SUM(CASE WHEN due_at <= ? AND state <> ? THEN 1 ELSE 0 END) as due', [now(), 'new'])
            ->first();

        return [
            'total' => (int) ($row->total ?? 0),
            'due'   => (int) ($row->due ?? 0),
            'fresh' => (int) ($row->fresh ?? 0),
        ];
    }

    /**
     * الذاكرة — بحثاً وصفحاتٍ لا دفعةً واحدة.
     *
     * ── لماذا لا يُرسَل كاملاً ──────────────────────────────
     * ذاكرةٌ فيه ألف كلمة يعني ألف صفٍّ في الشجرة وحمولةً بمئة
     * كيلوبايت، ولا أحد يقرأ ألف صفّ. فيُرسَل خمسون، ويُطلب ما
     * بعدها عند بلوغ آخر القائمة.
     *
     * ── ولماذا مؤشّرٌ لا رقم صفحة ─────────────────────────
     * `before` معرّفُ آخر صفّ وصل، فالصفحة التالية `id < before`
     * على المفتاح الأساسي مباشرة. ورقم الصفحة يزحف حين تُضاف كلمة
     * أثناء التصفّح فيتكرّر صفٌّ أو يُفقَد.
     *
     * ── والبحث ─────────────────────────────────────────────
     * على الكلمة ومعناها معاً — لأن من نسي الكلمة يتذكّر معناها.
     * و`term` مخزَّنٌ بحروف صغيرة أصلاً، فالمطابقة تصحّ في المحرّكين
     * بلا `ILIKE` ولا `LOWER()`.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $data = $request->validate([
            'mode'   => ['nullable', 'in:all,due'],
            'q'      => ['nullable', 'string', 'max:64', $this->utf8()],
            'before' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = MemoryWord::forUser($userId);

        if (($data['mode'] ?? 'all') === 'due') {
            // المستحقّ أولاً ثم الجديد — والجديد آخراً كي لا يزاحم
            $query->where(fn ($q) => $q->due()->orWhere('state', 'new'))
                ->orderByRaw("CASE WHEN state = 'new' THEN 1 ELSE 0 END")
                ->orderBy('due_at')
                ->limit((int) config('memory.session'));

            return response()->json([
                'words'  => $query->get()->map->toClientArray()->all(),
                'next'   => null,
                'counts' => $this->counts($request),
            ]);
        }

        $needle = trim((string) ($data['q'] ?? ''));

        if ($needle !== '') {
            /*
             * The escape character is `!`, not `\`.
             *
             * SQLite has no default LIKE escape, so a search for "%"
             * would match every row without an explicit ESCAPE clause.
             * The obvious character to use is a backslash — and that is
             * exactly what broke the first MySQL run: MySQL treats the
             * backslash as an escape inside string literals too, so the
             * literal '\' is an unterminated string and the whole query
             * is a syntax error. Postgres and SQLite read it as one
             * backslash and never complained, which is why this stood.
             *
             * `!` has no special meaning to any of the three, in a
             * string literal or in LIKE. It only has to be escaped in
             * the needle itself — hence three replacements, not two.
             */
            $like = '%'.str_replace(
                ['!', '%', '_'],
                ['!!', '!%', '!_'],
                mb_strtolower($needle)
            ).'%';

            $query->where(fn ($q) => $q
                ->whereRaw("term LIKE ? ESCAPE '!'", [$like])
                ->orWhereRaw("translation LIKE ? ESCAPE '!'", [$like]));
        }

        if (! empty($data['before'])) {
            $query->where('id', '<', $data['before']);
        }

        $size = (int) config('memory.page');

        // صفٌّ زائد يقول: أبعدها المزيد؟ — بلا استعلام عدٍّ ثانٍ
        $rows = $query->orderByDesc('id')->limit($size + 1)->get();
        $more = $rows->count() > $size;
        $rows = $rows->take($size);

        return response()->json([
            'words'  => $rows->map->toClientArray()->values()->all(),
            'next'   => $more ? $rows->last()->id : null,
            // البحث لا يغيّر أعداد الذاكرة، فلا تُحسب معه
            'counts' => $needle === '' && empty($data['before'])
                ? $this->counts($request)
                : null,
        ]);
    }

    /**
     * إضافة كلمة.
     *
     * تُترجَم على الخادم إن لم يكتب المتدرّب معناها: الترجمة تبدأ
     * من مفردات الكتاب، وأكثر ما يُضاف موجود فيها — فلا شبكة ولا
     * انتظار في الحالة الغالبة.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'term'        => ['required', 'string', 'max:64', $this->utf8()],
            'translation' => ['nullable', 'string', 'max:191', $this->utf8()],
        ]);

        $term = $this->translator->normalise($data['term']);

        if ($term === '' || ! preg_match('/[a-z]/', $term)) {
            throw ValidationException::withMessages([
                'term' => 'اكتب كلمة إنجليزية.',
            ]);
        }

        if (MemoryWord::forUser($user->id)->count() >= (int) config('memory.max_words')) {
            throw ValidationException::withMessages([
                'term' => 'ذاكرتك ممتلئة. احذف كلمات أتقنتها أولاً.',
            ]);
        }

        $translation = trim((string) ($data['translation'] ?? ''));
        $source = 'manual';

        if ($translation === '') {
            ['translation' => $translation, 'source' => $source] =
                $this->translator->translate($term);
        }

        // الكلمة المكرّرة تُحدَّث ولا تُرفض: من أعادها يريد تصحيحها
        $word = MemoryWord::updateOrCreate(
            ['user_id' => $user->id, 'term' => $term],
            [
                'translation' => $translation ?: null,
                'source'      => $source,
                // بطاقة جديدة تُستحقّ فوراً — أول مراجعة اليوم نفسه
                'due_at'      => now(),
            ],
        );

        return response()->json([
            'word'    => $word->toClientArray(),
            'counts' => $this->counts($request),
        ], 201);
    }

    /** ترجمة معاينة — قبل الحفظ، ليرى المتدرّب ما سيُحفظ */
    public function translate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'term' => ['required', 'string', 'max:64', $this->utf8()],
        ]);

        return response()->json($this->translator->translate($data['term']));
    }

    /** تصحيح المعنى بيده — والمصدر يصير يدوياً لأنه صار كذلك */
    public function update(Request $request, MemoryWord $memoryWord): JsonResponse
    {
        abort_unless($memoryWord->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'translation' => ['required', 'string', 'max:191', $this->utf8()],
        ]);

        $memoryWord->update([
            'translation' => trim($data['translation']),
            'source'      => 'manual',
        ]);

        return response()->json(['word' => $memoryWord->toClientArray()]);
    }

    /**
     * حفظ نتيجة مراجعة.
     *
     * المتصفّح حسب بـts-fsrs وأرسل الحالة. الخادم يتحقّق من الملكية
     * والمدى ثم يخزّن — ولا يعيد الحساب.
     */
    public function grade(Request $request, MemoryWord $memoryWord): JsonResponse
    {
        abort_unless($memoryWord->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'due_at'     => ['required', 'date'],
            'stability'  => ['required', 'numeric', 'min:0'],
            'difficulty' => ['required', 'numeric', 'between:0,10'],
            'reps'       => ['required', 'integer', 'min:0'],
            'lapses'     => ['required', 'integer', 'min:0'],
            'state'      => ['required', 'in:new,learning,review,relearning'],
        ]);

        $memoryWord->update([...$data, 'last_reviewed_at' => now()]);

        return response()->json([
            'saved'  => true,
            'counts' => $this->counts($request),
        ]);
    }

    public function destroy(Request $request, MemoryWord $memoryWord): JsonResponse
    {
        abort_unless($memoryWord->user_id === $request->user()->id, 403);

        $memoryWord->delete();

        return response()->json(['counts' => $this->counts($request)]);
    }
}
