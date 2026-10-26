<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Checks every daily episode still exists on YouTube.
 *
 * A channel can delete a video or make it private at any time, and
 * nothing on our side would notice: the learner follows the link to an
 * error page and meets a station they cannot finish. YouTube's oEmbed
 * answers 404 for a video that is gone, and 401 for one whose owner
 * turned off embedding — that one still plays, since we link out.
 * Run it now and then; it reads the week files, not the DB.
 */
class CheckWatch extends Command
{
    protected $signature = 'watch:check';

    protected $description = 'Check that every watch:<id> episode is in watch.json and still on YouTube';

    public function handle(): int
    {
        $catalog = json_decode(file_get_contents(base_path('content/watch.json')), true)['episodes'] ?? [];

        $used = [];
        foreach (glob(base_path('content/week-*.json')) as $file) {
            $week = json_decode(file_get_contents($file), true);
            foreach ($week['days'] ?? [] as $day) {
                foreach ($day['tasks'] ?? [] as $task) {
                    if (str_starts_with((string) ($task['ref'] ?? ''), 'watch:')) {
                        $used[substr($task['ref'], 6)][] = "w{$week['number']}d{$day['number']}";
                    }
                }
            }
        }

        $bad = 0;
        foreach ($used as $id => $where) {
            $at = implode(', ', $where);
            if (! isset($catalog[$id])) {
                $this->error("{$id} ({$at}): not in content/watch.json");
                $bad++;

                continue;
            }

            $res = Http::timeout(20)->get('https://www.youtube.com/oembed', [
                'format' => 'json',
                'url'    => 'https://www.youtube.com/watch?v='.$id,
            ]);
            if (! $res->ok() && $res->status() !== 401) {
                $this->error("{$id} ({$at}): HTTP {$res->status()} — deleted or private");
                $bad++;
            }
        }

        $this->line(count($used).' episodes checked, '.$bad.' broken.');

        return $bad ? self::FAILURE : self::SUCCESS;
    }
}
