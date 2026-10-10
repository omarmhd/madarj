<?php

namespace App\Services;

use App\Models\Vocabulary;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * ترجمة كلمة واحدة — بأقلّ ثمن ممكن.
 *
 * ── الترتيب، والأول هو الأهمّ ───────────────────────────────
 *
 * ① **مفردات الكتاب.** في القاعدة ألف وثمانمئة كلمة مترجمة
 *    أصلاً، وأكثر ما يكتبه مبتدئ في دفتره منها. فالبحث فيها
 *    استعلامٌ واحد بفهرس: بلا شبكة، وبلا انتظار، وبلا حصّة
 *    يومية — وبترجمة الكتاب نفسه لا ترجمة آلة.
 *
 * ② **ذاكرة مشتركة.** ترجمة «book» واحدة لكل المستخدمين، فتُحفظ
 *    مرة وتُقرأ ألفاً. وهذا ما يبقي الاستدعاء الخارجي نادراً حتى
 *    مع آلاف المتدرّبين.
 *
 * ③ **خدمة خارجية مجانية** — وهي آخر الحلول لا أولها.
 *
 * ── ولماذا يجوز أن تفشل ─────────────────────────────────────
 * الترجمة الآلية **راحة لا شرط**. فإن تعذّرت رجعت `null` وكتب
 * المتدرّب المعنى بيده — وهو أفضل لحفظه أصلاً. ولذلك لا استثناء
 * يُرفع هنا، ولا انتظار يطول: ثانيتان ونصف ثم ينصرف.
 */
class WordTranslator
{
    /** أطول انتظار للخدمة الخارجية — الواجهة لا تنتظر أكثر */
    protected const TIMEOUT = 2.5;

    /**
     * ترجمة كلمة إنجليزية إلى العربية.
     *
     * @return array{translation: ?string, source: string}
     */
    public function translate(string $term): array
    {
        $term = $this->normalise($term);

        if ($term === '') {
            return ['translation' => null, 'source' => 'manual'];
        }

        /*
         * Machine translation first, the course vocabulary as fallback.
         *
         * The order used to be the reverse: the course list answered
         * first because it is instant. But a learner searching a word
         * expects a translation, not a lookup in one lesson's list —
         * and one corrupted row ("age" → «سامي») was served as the
         * answer with nothing to catch it. Each word still goes out
         * only once: the shared cache keeps it for every user.
         */
        if (config('memory.translate')) {
            $auto = Cache::rememberForever(
                'memory:tr:'.sha1($term),
                fn () => $this->remote($term) ?? '',
            );

            if ($auto !== '') {
                return ['translation' => $auto, 'source' => 'auto'];
            }
        }

        // The service is off or failed: the course's own translation, if it has one
        $known = Vocabulary::whereRaw('LOWER(word) = ?', [$term])
            ->value('arabic');

        return $known
            ? ['translation' => $known, 'source' => 'course']
            : ['translation' => null, 'source' => 'manual'];
    }

    /**
     * الخدمة الخارجية.
     *
     * MyMemory: مجانية بلا مفتاح ولا تسجيل — وهذا شرط اختيارها.
     * أي خدمة تطلب مفتاحاً أو بطاقة تُخالف كون المنصة مجانية.
     */
    protected function remote(string $term): ?string
    {
        try {
            $res = Http::timeout(self::TIMEOUT)
                ->retry(1, 200)
                ->get('https://api.mymemory.translated.net/get', [
                    'q'        => $term,
                    'langpair' => 'en|ar',
                ]);

            if (! $res->successful()) {
                return null;
            }

            $text = trim((string) $res->json('responseData.translatedText', ''));

            // الخدمة تُعيد رسالة خطأ في حقل الترجمة أحياناً
            if ($text === '' || mb_strlen($text) > 120 || ! preg_match('/\p{Arabic}/u', $text)) {
                return null;
            }

            return $text;
        } catch (\Throwable $e) {
            // الفشل متوقّع ومقبول — يكتبها المتدرّب بيده
            Log::debug('memory: تعذّرت الترجمة الآلية', ['term' => $term, 'why' => $e->getMessage()]);

            return null;
        }
    }

    /** توحيد الكلمة: حروف صغيرة بلا فراغات زائدة */
    public function normalise(string $term): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $term)));
    }
}
