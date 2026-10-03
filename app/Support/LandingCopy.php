<?php

namespace App\Support;

use App\Models\Setting;

/**
 * The landing page's editable text.
 *
 * ── Why defaults live here and not in the page ──────────────
 * The admin edits the copy from the panel; the page must still read
 * well before anyone has touched it, and the panel must open with the
 * current wording filled in rather than blank boxes. So the written
 * text is the default, the admin's version is stored as one JSON
 * setting on top of it, and an emptied field falls back to the
 * default instead of leaving a hole in the page.
 *
 * Only the persuasive text is editable. Facts that come from the
 * course itself — the tests, the plans, the first day, the story
 * count — are read from their tables and cannot drift from the truth.
 */
class LandingCopy
{
    public const SETTING = 'landing_copy';

    public const DEFAULTS = [
        'eyebrow'       => 'منصة متكاملة من A1 إلى B1',
        'title_1'       => 'جرّبت تعلّم الإنجليزية من قبل؟',
        'title_2'       => 'هذه المرة',
        'title_accent'  => 'مختلفة.',
        'subtitle'      => 'مَدارِج دورة كاملة بأسلوب مختلف: ساعة واحدة كل يوم، وخطة جاهزة تنتظرك كل صباح، و24 أسبوعاً تأخذك من أول حرف حتى تفهم وتتكلّم وتكتب.',
        'cta'           => 'ابدأ الأسبوع الأول مجاناً',
        'trial_note'    => 'جرّب الأسبوع الأول كاملاً مجاناً، بلا بطاقة دفع.',
        'name_meaning'  => 'درجات تصعدها واحدة بعد الأخرى. لا أحد يقفز إلى القمة دفعة واحدة، لكن من يصعد درجة كل يوم، يصل.',
        'closing_title' => 'الدرجة الأولى أسهل مما تتخيّل.',
        'closing_text'  => 'لا تحتاج أن تعرف أي شيء. كل ما تحتاجه ساعة اليوم، وساعة غداً. ونحن معك خطوة بخطوة.',
        'faq'           => [
            ['q' => 'هل أحتاج أن أعرف شيئاً من الإنجليزية؟', 'a' => 'لا. الأسبوع الأول يبدأ من الأصوات والحروف، وكل شيء مشروح بالعربية.'],
            ['q' => 'أعرف بعض الإنجليزية. هل أبدأ من مستوى أعلى؟', 'a' => 'لا. اختبار ما قبل البداية يعطيك مستواك للمعرفة فقط، والدورة تبدأ من الأسبوع الأول للجميع. ستكون الأسابيع الأولى أسهل عليك، وتسدّ ثغرات لم تكن تعرف بوجودها.'],
            ['q' => 'كم ساعة في اليوم؟', 'a' => 'ساعة واحدة في المسار A، أو ساعتان في المسار B إن أردت التعمّق أكثر. تختار عند التسجيل، ويمكنك التغيير لاحقاً.'],
            ['q' => 'وماذا لو فاتني يوم؟', 'a' => 'لا مشكلة. تكمل من حيث توقّفت، وسلسلة أيامك تسامحك على يوم واحد فائت.'],
            ['q' => 'هل تعمل على الجوال؟', 'a' => 'نعم، من متصفّح الجوال مباشرة بلا تطبيق. ونفضّل متصفح Chrome لأن تمارين النطق تحتاجه.'],
            ['q' => 'هل تُرفع تسجيلات صوتي إلى الإنترنت؟', 'a' => 'لا. تسجيلاتك تبقى على جهازك أنت. قيمتها أن تسمعها بنفسك وتقارن بينها.'],
        ],
    ];

    /** The copy as the page should show it: saved values over defaults, blanks ignored */
    public static function get(): array
    {
        $saved = json_decode((string) Setting::get(self::SETTING, '{}'), true) ?: [];
        $out = self::DEFAULTS;

        foreach ($saved as $key => $value) {
            if (! array_key_exists($key, $out)) {
                continue;
            }

            if ($key === 'faq') {
                $rows = array_values(array_filter((array) $value, fn ($r) => trim($r['q'] ?? '') !== '' && trim($r['a'] ?? '') !== ''));
                if ($rows) {
                    $out['faq'] = $rows;
                }
            } elseif (is_string($value) && trim($value) !== '') {
                $out[$key] = trim($value);
            }
        }

        return $out;
    }

    public static function put(array $copy): void
    {
        Setting::put(self::SETTING, json_encode($copy, JSON_UNESCAPED_UNICODE));
    }

    /**
     * The WhatsApp support number as digits only, ready for wa.me —
     * or null when the admin has not set one, so the button hides.
     */
    public static function whatsapp(): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) Setting::get('support_whatsapp', ''));

        return strlen($digits) >= 8 ? $digits : null;
    }
}
