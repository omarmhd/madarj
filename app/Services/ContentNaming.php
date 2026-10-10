<?php

namespace App\Services;

use App\Models\Week;

/**
 * تسمية ما يفتحه أي مرجع — بالعربية والإنجليزية معاً.
 *
 * ── لماذا خدمة لا نصّ مخزَّن ────────────────────────────────
 * كان وصف اليوم وعنوان مهمّته نصّاً مكتوباً في ملفّ كل أسبوع. وهذا
 * يعني أن كل عنوان يُكتب أربعاً وعشرين مرة، وأن تغيير اسم مجموعة
 * واحدة يوجب تحرير ملفّات وإعادة استيراد — وأن أي أسبوع جديد يحتاج
 * كتابة يدوية قبل أن يعمل.
 *
 * فالتسمية هنا **تُشتقّ** من المرجع نفسه ومن محتوى الأسبوع، لحظة
 * الطلب. مصدر واحد يخدم الأسابيع كلها: تغيّر اسم مجموعة فيتغيّر في
 * كل موضع دفعةً، ويعمل الأسبوع الخامس والعشرون بلا سطر إضافي.
 *
 * ── ولماذا لغتان لا لغة ─────────────────────────────────────
 * المتدرّب يختار أساسه في التهيئة. فالخدمة تعطي الاثنين دائماً،
 * والواجهة تختار — لا يُحسم الأمر في الخادم فيصير تغيير التفضيل
 * محتاجاً إعادة توليد.
 */
class ContentNaming
{
    /** أسماء أقسام الشرح — قيم نظامية ثابتة، لا محتوى متغيّر */
    protected const SECTIONS = [
        'grammar'   => ['ar' => 'القواعد', 'en' => 'Grammar'],
        'phonics'   => ['ar' => 'النطق', 'en' => 'Pronunciation'],
        'phrases'   => ['ar' => 'العبارات', 'en' => 'Phrases'],
        'listening' => ['ar' => 'الاستماع', 'en' => 'Listening'],
        'reading'   => ['ar' => 'القراءة', 'en' => 'Reading'],
        'selfcheck' => ['ar' => 'الاختبار الذاتي', 'en' => 'Self-Check'],
        'writing'   => ['ar' => 'الكتابة', 'en' => 'Writing'],
    ];

    protected const FIXED = [
        'pairs'    => ['ar' => 'التمييز الصوتي', 'en' => 'Sound Discrimination'],
        // خطّة اليوم تقول «إنتاج»: يبدأ عند فحص النطق لا عند الأذن
        'produce'  => ['ar' => 'النطق — قُلها ولنرَ', 'en' => 'Say It'],
        'review'   => ['ar' => 'مراجعة المفردات', 'en' => 'Vocabulary Review'],
        'exercises' => ['ar' => 'تمارين اليوم', 'en' => 'Today’s Exercises'],
        'record'   => ['ar' => 'التحدّث', 'en' => 'Speaking'],
        'baseline' => ['ar' => 'تسجيل خط الأساس', 'en' => 'Baseline Recording'],
        'spell'    => ['ar' => 'كتابة الكلمات', 'en' => 'Spelling'],
        'spell_review' => ['ar' => 'مراجعة الإملاء', 'en' => 'Spelling Review'],
        'shadow'   => ['ar' => 'الشادوينج — تكلّم مع الصوت', 'en' => 'Shadowing'],
        'imitate'  => ['ar' => 'اكتب مثله', 'en' => 'Write One Like It'],
        'homework' => ['ar' => 'الواجب المنزلي', 'en' => 'Homework'],
    ];

    /** ترتيب عربي للحوارات — «الحوار الأول» أطبع من «الحوار 1» */
    protected const ORDINAL_AR = [1 => 'الأول', 2 => 'الثاني', 3 => 'الثالث', 4 => 'الرابع'];

    /** فهرس أسماء المجموعات — يُبنى مرة لكل أسبوع */
    protected array $groups = [];
    protected ?int $groupsFor = null;

    /**
     * كل ما يفتحه المرجع، بالعربية والإنجليزية.
     *
     * @return array{ar: string[], en: string[]}
     */
    public function parts(Week $week, ?string $ref): array
    {
        $ar = [];
        $en = [];

        foreach (explode('|', (string) $ref) as $token) {
            $token = trim($token);
            if ($token === '') {
                continue;
            }

            $one = $this->one($week, $token);
            if (! $one) {
                continue;
            }

            // بلا تكرار: مهمّة قد تفتح القسم نفسه مرتين
            if (! in_array($one['ar'], $ar, true)) {
                $ar[] = $one['ar'];
                $en[] = $one['en'];
            }
        }

        return ['ar' => $ar, 'en' => $en];
    }

    /** الاسم الجاهز للعرض — الأجزاء موصولة */
    public function label(Week $week, ?string $ref): array
    {
        $p = $this->parts($week, $ref);

        return [
            'ar' => implode(' · ', $p['ar']),
            'en' => implode(' · ', $p['en']),
        ];
    }

    /**
     * وصف اليوم — من مهامّه.
     *
     * المهامّ المتكرّرة كل يوم (المراجعة والتمارين والتسجيل) تُستبعد:
     * ذكرها لا يميّز يوماً عن يوم، وهو غرض الوصف كلّه.
     */
    public function dayFocus(Week $week, array $tasks): array
    {
        $ar = [];
        $en = [];

        foreach ($tasks as $task) {
            foreach (explode('|', (string) ($task['ref'] ?? '')) as $token) {
                $token = trim($token);
                if ($token === '' || $this->isRepeating($token)) {
                    continue;
                }

                $one = $this->one($week, $token);
                if ($one && ! in_array($one['ar'], $ar, true)) {
                    $ar[] = $one['ar'];
                    $en[] = $one['en'];
                }
            }
        }

        return [
            'ar' => $ar ? implode(' · ', $ar) : 'اليوم',
            'en' => $en ? implode(' · ', $en) : 'Today',
        ];
    }

    /** مرجع يتكرّر في كل يوم فلا يميّزه */
    protected function isRepeating(string $token): bool
    {
        return str_starts_with($token, 'review')
            || str_starts_with($token, 'exercises:')
            || str_starts_with($token, 'record')
            || str_starts_with($token, 'spell:')
            || $token === 'shadow'
            || $token === 'imitate'
            || $token === 'homework';
    }

    /** اسم مرجع واحد */
    protected function one(Week $week, string $token): ?array
    {
        if (str_starts_with($token, 'vocab:')) {
            $this->loadGroups($week);
            $names = ['ar' => [], 'en' => []];

            foreach (explode(',', substr($token, 6)) as $g) {
                $g = trim($g);
                if (isset($this->groups[$g])) {
                    $names['ar'][] = $this->groups[$g]['ar'];
                    $names['en'][] = $this->groups[$g]['en'];
                }
            }

            return $names['ar']
                ? ['ar' => implode(' + ', $names['ar']), 'en' => implode(' + ', $names['en'])]
                : null;
        }

        if (str_starts_with($token, 'dialogue:')) {
            $n = (int) substr($token, 9);

            return [
                'ar' => 'الحوار '.(self::ORDINAL_AR[$n] ?? $n),
                'en' => 'Dialogue '.$n,
            ];
        }

        if (str_starts_with($token, 'section:')) {
            return self::SECTIONS[substr($token, 8)] ?? null;
        }

        if (str_starts_with($token, 'game:minimal_pairs') || str_starts_with($token, 'pron:')) {
            return str_contains($token, 'production')
                ? self::FIXED['produce']
                : self::FIXED['pairs'];
        }

        if (str_starts_with($token, 'writing')) {
            return self::SECTIONS['writing'];
        }

        if (str_starts_with($token, 'exercises:')) {
            return self::FIXED['exercises'];
        }

        if (str_starts_with($token, 'review')) {
            return self::FIXED['review'];
        }

        if (str_starts_with($token, 'record')) {
            return str_contains($token, 'baseline') ? self::FIXED['baseline'] : self::FIXED['record'];
        }

        if (str_starts_with($token, 'spell:')) {
            return $token === 'spell:review' ? self::FIXED['spell_review'] : self::FIXED['spell'];
        }

        if ($token === 'shadow') {
            return self::FIXED['shadow'];
        }

        if ($token === 'imitate') {
            return self::FIXED['imitate'];
        }

        if ($token === 'homework') {
            return self::FIXED['homework'];
        }

        return null;
    }

    /** أسماء مجموعات هذا الأسبوع — استعلام واحد */
    protected function loadGroups(Week $week): void
    {
        if ($this->groupsFor === $week->id) {
            return;
        }

        $this->groups = $week->vocabulary
            ->groupBy('group')
            ->map(fn ($items) => [
                'ar' => $items->first()->group_label_ar ?? str_replace('_', ' ', $items->first()->group),
                'en' => $items->first()->group_label_en ?? str_replace('_', ' ', $items->first()->group),
            ])
            ->all();

        $this->groupsFor = $week->id;
    }
}
