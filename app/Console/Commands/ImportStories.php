<?php

namespace App\Console\Commands;

use App\Models\Story;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * استيراد القصص من `content/stories-*.json`.
 *
 * ── لماذا أمر مستقلّ عن `content:import` ───────────────────
 * ذاك يستورد أسبوعاً برقمه ويربط كل شيء بـ`week_id`. والقصص ليست
 * لأسبوع، وملفّاتها ليست `week-NN`. فخلطهما يعني شرطاً في كل خطوة.
 *
 * ── يرفض ولا يخمّن ─────────────────────────────────────────
 * قصّة بلا جمل، أو بمعرّف مكرّر، أو بسطر فارغ — كلّها تُوقف
 * الاستيراد. لأنّ قصّة نصفها مستورَد تُقرأ كأنّها كاملة: لا شيء
 * على الشاشة يقول إنّ آخرها ضاع.
 */
class ImportStories extends Command
{
    protected $signature = 'stories:import {--fresh : يحذف القصص كلّها قبل الاستيراد}';

    protected $description = 'استيراد القصص القصيرة من content/stories-*.json';

    public function handle(): int
    {
        $files = glob(base_path('content/stories-*.json'));
        sort($files);

        if (! $files) {
            $this->error('لا ملفّات قصص في content/');

            return self::FAILURE;
        }

        $seen = [];
        $rows = [];

        foreach ($files as $file) {
            $data = json_decode(file_get_contents($file), true);

            if (! is_array($data['stories'] ?? null)) {
                $this->error(basename($file).': لا مفتاح stories');

                return self::FAILURE;
            }

            foreach ($data['stories'] as $i => $story) {
                $where = basename($file).' #'.($i + 1);

                foreach (['slug', 'title_en', 'title_ar', 'lines'] as $key) {
                    if (empty($story[$key])) {
                        $this->error("$where: ينقصه $key");

                        return self::FAILURE;
                    }
                }

                // The levels are the course's milestones (LevelCard)
                if (! in_array($story['level'] ?? null, Story::LEVELS, true)) {
                    $this->error("$where: المستوى «".($story['level'] ?? '')."» ليس من ".implode(' · ', Story::LEVELS));

                    return self::FAILURE;
                }

                if (isset($seen[$story['slug']])) {
                    $this->error("$where: المعرّف «{$story['slug']}» مكرّر");

                    return self::FAILURE;
                }

                $lines = array_values(array_filter(
                    array_map('trim', $story['lines']),
                    fn ($l) => $l !== ''
                ));

                if (count($lines) !== count($story['lines'])) {
                    $this->error("$where: فيه سطر فارغ");

                    return self::FAILURE;
                }

                $seen[$story['slug']] = true;

                $rows[] = [
                    'slug'      => $story['slug'],
                    'title_en'  => $story['title_en'],
                    'title_ar'  => $story['title_ar'],
                    'level'     => $story['level'],
                    'source_ar' => $story['source_ar'] ?? null,
                    'minutes'   => $story['minutes'] ?? 2,
                    'why_ar'    => $story['why_ar'] ?? null,
                    'lines'     => $lines,
                    'moral_en'  => $story['moral_en'] ?? null,
                    'moral_ar'  => $story['moral_ar'] ?? null,
                    'words'     => $story['words'] ?? [],
                    'position'  => count($rows) + 1,
                ];
            }
        }

        DB::transaction(function () use ($rows) {
            if ($this->option('fresh')) {
                Story::query()->delete();
            }

            foreach ($rows as $row) {
                Story::updateOrCreate(['slug' => $row['slug']], $row);
            }

            /*
             * The files are the source of truth: a story removed from them
             * leaves the site too. Without this, seven replaced stories
             * stayed on the stories page after their files were rewritten.
             */
            $removed = Story::whereNotIn('slug', array_column($rows, 'slug'))->delete();

            if ($removed) {
                $this->warn("Removed $removed stories no longer in content/stories-*.json");
            }
        });

        /*
         * السرد البشريّ — يُكتشف ولا يُعلَن.
         *
         * ملفّ لكل جملة باصطلاح `<slug>/01.mp3`. وقصّة نصف جملها
         * مسجَّلة أسوأ من قصّة بلا صوت: القارئ يسكت في المنتصف بلا
         * سبب ظاهر. فالعلَم لا يُرفع إلا إذا اكتملت الجمل كلّها،
         * وناقصُها يُذكر ليُعرف ما بقي.
         */
        $partial = [];

        foreach (Story::all() as $story) {
            $url = $story->audioUrl();
            $file = $url ? public_path(ltrim($url, '/')) : null;

            $hasSound = $file !== null && filesize($file) > 0;
            $cues = $story->cues();

            /*
             * الصوت بلا توقيت لا يُعدّ سرداً.
             *
             * يُشغَّل فيسمع المتدرّب صوتاً لا يعرف أين هو من النصّ:
             * لا سطر يُضاء ولا سطر يُضغط. وعدد المقاطع يجب أن يطابق
             * عدد الجمل تماماً، وإلا أُضيء سطرٌ بينما يُقرأ غيره —
             * وهذا أسوأ من ألّا يُضاء شيء.
             */
            $ok = $hasSound && count($cues) === count($story->lines);

            $story->update(['has_audio' => $ok]);

            if ($hasSound && ! $ok) {
                $partial[] = $story->slug.': '.count($cues).' مقطعاً مقابل '
                    .count($story->lines).' جملة';
            }
        }

        $recorded = Story::where('has_audio', true)->count();

        $this->info('ملفّات: '.count($files).'   قصص: '.count($rows).
            '   مسرودة بشريّاً: '.$recorded);

        foreach ($partial as $line) {
            $this->warn('سرد ناقص — '.$line);
        }

        $this->table(
            ['المعرّف', 'العنوان', 'جمل', 'كلمات', 'مسرد', 'سرد'],
            Story::orderBy('position')->get()->map(fn (Story $s) => [
                $s->slug,
                $s->title_ar,
                count($s->lines),
                $s->wordCount(),
                count($s->words ?? []),
                $s->has_audio ? 'بشريّ' : '—',
            ])->all(),
        );

        return self::SUCCESS;
    }
}
