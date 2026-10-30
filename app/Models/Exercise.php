<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * تمرين واحد.
 *
 * منطق التصحيح موجود هنا في النموذج لا في الـ controller،
 * لسبب أمني: لو صحّحنا في الواجهة فقط لأمكن للمستخدم
 * قراءة الإجابات من الـ props. التصحيح يحدث على الخادم دائماً.
 */
class Exercise extends Model
{
    /** أنواع التمارين المدعومة */
    public const TYPE_FILL_BLANK      = 'fill_blank';
    public const TYPE_MULTIPLE_CHOICE = 'multiple_choice';
    public const TYPE_TRUE_FALSE      = 'true_false';
    public const TYPE_CORRECT_ERROR   = 'correct_error';
    public const TYPE_MATCH           = 'match';
    public const TYPE_ORDER_WORDS     = 'order_words';
    public const TYPE_FREE_TEXT       = 'free_text';

    protected $fillable = [
        'week_id', 'day_number', 'exercise_no', 'type', 'focus_ar', 'error_no',
        'prompt', 'position', 'payload', 'answer', 'explanation', 'points',
    ];

    protected $casts = [
        'payload'     => 'array',
        'answer'      => 'array',
        'day_number'  => 'integer',
        'exercise_no' => 'integer',
        'error_no'    => 'integer',
        'position'    => 'integer',
        'points'      => 'integer',
    ];

    /**
     * إخفاء الإجابة عند إرسال التمرين للواجهة.
     * الواجهة لا ترى answer أبداً — ترسل الإجابة والخادم يحكم.
     */
    protected $hidden = ['answer', 'explanation'];

    public function week(): BelongsTo
    {
        return $this->belongsTo(Week::class);
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(ExerciseAttempt::class);
    }

    /**
     * تصحيح إجابة المستخدم.
     *
     * @param  mixed  $response  ما أرسله المستخدم — بنيته تعتمد على النوع
     */
    public function check(mixed $response): bool
    {
        return match ($this->type) {
            self::TYPE_FILL_BLANK,
            self::TYPE_CORRECT_ERROR   => $this->checkText($response),
            self::TYPE_MULTIPLE_CHOICE => (int) $response === (int) ($this->answer['correct'] ?? -1),
            self::TYPE_TRUE_FALSE      => (bool) $response === (bool) ($this->answer['correct'] ?? false),
            self::TYPE_ORDER_WORDS     => $this->checkOrder($response),
            self::TYPE_MATCH           => $this->checkMatch($response),
            self::TYPE_FREE_TEXT       => true,   // لا يُصحَّح آلياً — يُقيَّم ذاتياً
            default                    => false,
        };
    }

    /**
     * تصحيح النص: نتسامح مع فروق لا تؤثر على الصحة اللغوية.
     *
     * يُقبل: فروق حالة الأحرف، المسافات الزائدة، علامة الترقيم الأخيرة،
     *        وأنواع الفاصلة العليا المختلفة (' و ')
     */
    protected function checkText(mixed $response): bool
    {
        $normalise = function (string $s): string {
            $s = trim(mb_strtolower($s));
            $s = str_replace(['’', '‘', '`'], "'", $s);   // توحيد الفاصلة العليا
            $s = preg_replace('/\s*\/\s*/u', ' / ', $s);  // blanks joined as "a / b"
            $s = preg_replace('/\s+/u', ' ', $s);          // مسافة واحدة
            $s = rtrim($s, ".!?؟");                        // تجاهل الترقيم الأخير

            return $s;
        };

        $given = self::contractionForms($normalise((string) $response));

        foreach ($this->answer['accepted'] ?? [] as $accepted) {
            if (array_intersect($given, self::contractionForms($normalise($accepted)))) {
                return true;
            }
        }

        return false;
    }

    /**
     * The sentence with its contractions written out, every way they can be.
     *
     * "haven't finished" and "have not finished" are the same answer; listing
     * both in every exercise was forgotten in dozens of them, and a learner
     * who wrote the full form was told it was wrong. 's and 'd are ambiguous
     * (is/has, would/had), so each reading is a form of its own, and two
     * answers match when they share one.
     *
     * @return list<string>
     */
    protected static function contractionForms(string $s): array
    {
        $s = preg_replace(
            ["/\bwon't\b/u", "/\bshan't\b/u", "/\bcan't\b/u", "/\bcan not\b/u", "/\bain't\b/u"],
            ['will not', 'shall not', 'cannot', 'cannot', 'is not'],
            $s
        );
        $s = preg_replace(
            ["/n't\b/u", "/'m\b/u", "/'re\b/u", "/'ve\b/u", "/'ll\b/u"],
            [' not', ' am', ' are', ' have', ' will'],
            $s
        );

        $forms = [$s];
        foreach (["'s" => ['is', 'has'], "'d" => ['would', 'had']] as $short => $long) {
            $next = [];
            foreach ($forms as $f) {
                $next[] = $f;   // a possessive 's stays as written
                foreach ($long as $l) {
                    $next[] = preg_replace('/(?<=\w)'.preg_quote($short, '/').'\b/u', ' '.$l, $f);
                }
            }
            $forms = $next;
        }

        // A blank can start with the contraction ("'ll stay"), leaving two spaces
        $forms = array_map(fn ($f) => trim(preg_replace('/\s+/u', ' ', $f)), $forms);

        return array_values(array_unique($forms));
    }

    /** ترتيب الكلمات: المصفوفة يجب أن تطابق الترتيب الصحيح تماماً */
    protected function checkOrder(mixed $response): bool
    {
        return is_array($response)
            && $response === ($this->answer['order'] ?? []);
    }

    /** التوصيل: خريطة من اليسار إلى اليمين */
    protected function checkMatch(mixed $response): bool
    {
        if (! is_array($response)) {
            return false;
        }

        ksort($response);
        $correct = $this->answer['pairs'] ?? [];
        ksort($correct);

        return $response === $correct;
    }

    /**
     * البيانات الآمنة لإرسالها للواجهة — بلا الإجابة.
     * تُستخدم في الـ controller عند بناء props.
     */
    public function toClientArray(): array
    {
        return [
            'id'          => $this->id,
            'type'        => $this->type,
            'prompt'      => $this->prompt,
            'payload'     => $this->payload,
            'points'      => $this->points,
            'exercise_no' => $this->exercise_no,
            // ما يُدرّبه — يُعرض للمتعلّم قبل أن يبدأ
            'focus_ar'    => $this->focus_ar,
            // رقم الخطأ من العشرين. آمن: القائمة معروفة ولا تكشف إجابة
            'error_no'    => $this->error_no,
        ];
    }
}
