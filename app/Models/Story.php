<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * قصّة قصيرة — من عائلة المحتوى: يكتبها `stories:import` وحده.
 */
class Story extends Model
{
    /** Easiest first — the order the page shows them in */
    public const LEVELS = ['A1', 'A2', 'A2+', 'B1', 'B1+'];

    protected $fillable = [
        'slug', 'title_en', 'title_ar', 'level', 'source_ar', 'minutes',
        'why_ar', 'lines', 'moral_en', 'moral_ar', 'words', 'position', 'has_audio',
    ];

    /**
     * The level a learner reads at in a given week.
     *
     * The book's modules: weeks 1–6 A1, 7–12 A2, 13–18 A2+, 19–24 B1.
     * A learner reads at the level of the module they are in — the
     * stories one level up are there for when that feels easy.
     */
    public static function levelForWeek(int $week): string
    {
        return match (true) {
            $week <= 6  => 'A1',
            $week <= 12 => 'A2',
            $week <= 18 => 'A2+',
            default     => 'B1',
        };
    }

    protected $casts = [
        'lines'    => 'array',
        'words'    => 'array',
        'minutes'   => 'integer',
        'position'  => 'integer',
        'has_audio' => 'boolean',
    ];

    /** الصيغ المقبولة — mp3 للنشر، وwav لما يخرج من محرّك محليّ */
    public const FORMATS = ['mp3', 'wav'];

    /**
     * ملفّ السرد — واحد للقصّة كلّها.
     *
     * وصيغتان لا واحدة: المحرّكات المحليّة تُخرج `wav` ولا تعرف
     * غيره بلا ffmpeg، والنشر يريد `mp3`. فالأولويّة للأصغر، ووجود
     * الملفّ هو ما يحسم — لا اسمٌ مكتوب في عمود.
     */
    public function audioUrl(): ?string
    {
        foreach (self::FORMATS as $ext) {
            $url = '/audio/stories/'.$this->slug.'.'.$ext;

            if (is_file(public_path(ltrim($url, '/')))) {
                return $url;
            }
        }

        return null;
    }

    /** ملفّ التوقيت بجانبه */
    public function cuesPath(): string
    {
        return public_path('audio/stories/'.$this->slug.'.vtt');
    }

    /**
     * بدايات الجمل بالثواني، مقروءةً من ملفّ `.vtt`.
     *
     * ── لماذا التوقيت لازم أصلاً ───────────────────────────
     * ملفّ واحد للقصّة يعني أنّ الصوت لا يعرف أين هو من النصّ. وبلا
     * ذلك لا سطر يُضاء ولا سطر يُضغط ليُسمع — وهما سبب القراءة
     * للمتعلّم: أن تصل العين والأذن معاً.
     *
     * ── ولماذا VTT لا صيغة من عندنا ────────────────────────
     * صيغة ترجمات قياسيّة: تُنتجها أدوات المحاذاة وبرامج المونتاج،
     * وتُفتح في أيّ محرّر نصّ فتُصحَّح بيد الإنسان حين تزيغ ثانية.
     */
    public function cues(): array
    {
        if (! is_file($this->cuesPath())) {
            return [];
        }

        $out = [];

        foreach (file($this->cuesPath(), FILE_IGNORE_NEW_LINES) as $line) {
            if (! str_contains($line, '-->')) {
                continue;
            }

            [$from] = explode('-->', $line);
            $out[] = self::seconds(trim($from));
        }

        return $out;
    }

    /** `00:01:02.500` أو `01:02.500` إلى ثوانٍ */
    protected static function seconds(string $stamp): float
    {
        $parts = array_reverse(explode(':', $stamp));

        $total = (float) str_replace(',', '.', $parts[0] ?? '0');
        $total += 60 * (float) ($parts[1] ?? 0);
        $total += 3600 * (float) ($parts[2] ?? 0);

        return round($total, 3);
    }

    /** الرابط بالمعرّف الثابت لا بالرقم */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * عدد كلمات القصّة.
     *
     * يُحسب عند الطلب لا يُخزَّن: القصص ثلاثون وتُقرأ صفحةً واحدة،
     * وعمودٌ يُحسب مرّة ثم يكذب بعد تحرير النصّ أسوأ من حسابٍ رخيص.
     */
    public function wordCount(): int
    {
        return collect($this->lines)
            ->sum(fn (string $line) => count(preg_split('/\s+/', trim($line)) ?: []));
    }
}
