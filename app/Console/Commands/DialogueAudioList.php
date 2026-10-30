<?php

namespace App\Console\Commands;

use App\Models\Dialogue;
use App\Support\DialogueVoices;
use Illuminate\Console\Command;

/**
 * Every spoken dialogue line with its voice and file name, as JSON —
 * what scripts/narrate-dialogues.py generates from.
 */
class DialogueAudioList extends Command
{
    protected $signature = 'dialogues:audio-list';

    protected $description = 'List dialogue lines with their Piper voice and file name (JSON)';

    public function handle(): int
    {
        $out = [];

        foreach (Dialogue::with('lines')->get() as $d) {
            foreach ($d->lines as $l) {
                if (! $l->speaker) {
                    continue; // stage directions are not spoken
                }

                $voice = DialogueVoices::voiceFor($d->speaker_genders ?? [], $l->speaker);
                $file = DialogueVoices::file($voice, $l->en);

                $out[$file] = ['file' => $file, 'model' => DialogueVoices::VOICES[$voice], 'text' => $l->en];
            }
        }

        $this->line(json_encode(array_values($out), JSON_UNESCAPED_UNICODE));

        return self::SUCCESS;
    }
}
