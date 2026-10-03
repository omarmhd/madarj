<?php

namespace App\Console\Commands;

use App\Models\Day;
use App\Models\Dialogue;
use App\Models\DialogueLine;
use App\Models\Exercise;
use App\Models\MinimalPair;
use App\Models\Vocabulary;
use App\Models\Week;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * استيراد المحتوى من ملفات JSON إلى قاعدة البيانات.
 *
 *   php artisan content:import              كل الأسابيع الموجودة
 *   php artisan content:import --week=1     أسبوع واحد
 *   php artisan content:import --fresh      حذف المحتوى القديم أولاً
 *
 * الأمر **idempotent**: تشغيله مرتين يعطي نفس النتيجة.
 * يستخدم updateOrCreate على رقم الأسبوع، ويحذف المحتوى الفرعي
 * القديم قبل إعادة إدخاله — فلا تتراكم صفوف مكررة.
 *
 * ملاحظة: هذا الأمر يمسّ **جداول المحتوى فقط**.
 * لا يقترب من جداول التقدّم إطلاقاً، فتحديث المحتوى آمن
 * حتى بعد أن يبدأ مستخدمون فعليون الدورة.
 */
class ImportContent extends Command
{
    protected $signature = 'content:import
                            {--week= : رقم أسبوع محدد}
                            {--fresh : حذف كل المحتوى قبل الاستيراد}';

    protected $description = 'استيراد محتوى الدورة من ملفات content/week-*.json';

    public function handle(): int
    {
        $dir = base_path('content');

        if (! is_dir($dir)) {
            $this->error("مجلد المحتوى غير موجود: {$dir}");

            return self::FAILURE;
        }

        // اختيار الملفات المطلوبة
        $files = $this->option('week')
            ? [sprintf('%s/week-%02d.json', $dir, (int) $this->option('week'))]
            : glob("{$dir}/week-*.json");

        $files = array_filter($files, 'is_file');

        if (empty($files)) {
            $this->error('لم يُعثر على أي ملف محتوى.');

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->warn('حذف كل المحتوى القديم…');
            $this->truncateContent();
        }

        sort($files);

        foreach ($files as $file) {
            $this->importFile($file);
        }

        $this->newLine();
        $this->info('✓ اكتمل الاستيراد.');
        $this->table(
            ['الجدول', 'عدد الصفوف'],
            [
                ['weeks',          Week::count()],
                ['days',           Day::count()],
                ['vocabulary',     Vocabulary::count()],
                ['dialogues',      Dialogue::count()],
                ['dialogue_lines', DialogueLine::count()],
                ['exercises',      Exercise::count()],
                ['minimal_pairs',  MinimalPair::count()],
            ]
        );

        return self::SUCCESS;
    }

    /**
     * استيراد ملف أسبوع واحد داخل معاملة.
     * لو فشل أي جزء، لا يُكتب شيء — فلا يبقى أسبوع ناقص.
     */
    protected function importFile(string $path): void
    {
        $raw = json_decode(file_get_contents($path), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->error('  ✗ '.basename($path).' — JSON غير صالح: '.json_last_error_msg());

            return;
        }

        $this->line('→ '.basename($path));

        DB::transaction(function () use ($raw) {
            $week = $this->upsertWeek($raw);

            // حذف المحتوى الفرعي القديم لهذا الأسبوع قبل إعادة الإدخال.
            // ضروري لجعل الأمر idempotent — بدونه تتضاعف الصفوف.
            $week->days()->delete();
            $week->vocabulary()->delete();
            $week->dialogues()->delete();          // dialogue_lines تُحذف بالـ cascade
            $week->exercises()->delete();
            $week->minimalPairs()->delete();

            $this->importDays($week, $raw['days'] ?? []);
            $this->importVocabulary($week, $raw['vocabulary'] ?? []);
            $this->importDialogues($week, $raw['dialogues'] ?? []);
            $this->importExercises($week, $raw['exercises'] ?? []);
            $this->importMinimalPairs($week, $raw['minimal_pairs'] ?? []);
        });
    }

    protected function upsertWeek(array $raw): Week
    {
        $week = Week::updateOrCreate(
            ['number' => $raw['number']],
            [
                'module'       => $raw['module'],
                'title_en'     => $raw['title_en'],
                'title_ar'     => $raw['title_ar'],
                'objectives'   => $raw['objectives'] ?? [],
                'pron_section' => $raw['pron_section'] ?? 4,
                'is_review'    => $raw['is_review'] ?? false,
            ]
        );

        $this->line("   أسبوع {$week->number}: {$week->title_en}");

        return $week;
    }

    protected function importDays(Week $week, array $days): void
    {
        foreach ($days as $d) {
            $week->days()->create([
                'number' => $d['number'],
                'focus'  => $d['focus'],
                'tasks'  => $d['tasks'],
            ]);
        }

        $this->line('   • أيام: '.count($days));
    }

    protected function importVocabulary(Week $week, array $words): void
    {
        // الترتيب داخل كل مجموعة يُحسب تلقائياً من ترتيب الملف
        $positions = [];

        foreach ($words as $w) {
            $group = $w['group'];
            $positions[$group] = ($positions[$group] ?? 0) + 1;

            $week->vocabulary()->create([
                'group'    => $group,
                'word'     => $w['word'],
                'ipa'      => $w['ipa'] ?? null,
                'arabic'   => $w['arabic'],
                'example'  => $w['example'] ?? null,
                'position' => $positions[$group],
            ]);
        }

        $this->line('   • مفردات: '.count($words).' في '.count($positions).' مجموعات');
    }

    protected function importDialogues(Week $week, array $dialogues): void
    {
        $lineCount = 0;

        foreach ($dialogues as $d) {
            $dialogue = $week->dialogues()->create([
                'number'       => $d['number'],
                'title'        => $d['title'],
                'situation_en' => $d['situation_en'],
                'situation_ar' => $d['situation_ar'],
            ]);

            foreach ($d['lines'] as $i => $line) {
                $dialogue->lines()->create([
                    'position' => $i + 1,
                    'speaker'  => $line['speaker'],
                    'en'       => $line['en'],
                    'ar'       => $line['ar'],
                ]);
                $lineCount++;
            }
        }

        $this->line('   • حوارات: '.count($dialogues)." ({$lineCount} سطراً)");
    }

    protected function importExercises(Week $week, array $exercises): void
    {
        foreach ($exercises as $i => $e) {
            $week->exercises()->create([
                'day_number'  => $e['day_number'] ?? null,
                'exercise_no' => $e['exercise_no'] ?? null,
                'type'        => $e['type'],
                'prompt'      => $e['prompt'],
                'position'    => $i + 1,
                'payload'     => $e['payload'] ?? null,
                'answer'      => $e['answer'] ?? null,
                'explanation' => $e['explanation'] ?? null,
                'points'      => $e['points'] ?? 1,
            ]);
        }

        $byType = collect($exercises)->countBy('type')
            ->map(fn ($n, $t) => "{$t}={$n}")->implode(' · ');

        $this->line('   • تمارين: '.count($exercises).' — '.$byType);
    }

    protected function importMinimalPairs(Week $week, array $pairs): void
    {
        foreach ($pairs as $i => $p) {
            $week->minimalPairs()->create([
                'group_label' => $p['group_label'],
                'ipa'         => $p['ipa'] ?? null,
                'word_a'      => $p['word_a'],
                'word_b'      => $p['word_b'],
                'position'    => $i + 1,
            ]);
        }

        $this->line('   • أزواج صوتية: '.count($pairs));
    }

    /**
     * حذف كل المحتوى — بترتيب يحترم المفاتيح الأجنبية.
     * جداول التقدّم لا تُمَس.
     */
    protected function truncateContent(): void
    {
        DB::transaction(function () {
            DialogueLine::query()->delete();
            Dialogue::query()->delete();
            Exercise::query()->delete();
            MinimalPair::query()->delete();
            Vocabulary::query()->delete();
            Day::query()->delete();
            Week::query()->delete();
        });
    }
}
