<?php

namespace App\Support;

use App\Models\Dialogue;

/**
 * Which Piper voice speaks each dialogue line, and where its file is.
 *
 * ── Why recorded, like the stories ──────────────────────────
 * The browser's voices differ from device to device, and many devices
 * have one English voice, so both speakers sounded the same. Each line
 * is now a small MP3 made once with Piper (scripts/narrate-dialogues.py).
 *
 * ── A file per line, named after its voice and text ─────────
 * Every line has its own listen button, so a line is the unit. And
 * fixing a typo changes that line's name only: the script speaks that
 * one again and deletes the old file.
 *
 * ── Two men in one dialogue get two voices ──────────────────
 * Nine dialogues are two men talking, and one male voice made them one
 * person. The cast's main characters come first (Sami, then Khaled)
 * and take Alan; the second man takes the northern English voice.
 * The rule lives here only: the script asks `dialogues:audio-list`.
 */
class DialogueVoices
{
    /** Piper models, by the short name used in file keys */
    public const VOICES = [
        'jenny' => 'en_GB-jenny_dioco-medium',
        'alan'  => 'en_GB-alan-medium',
        'north' => 'en_GB-northern_english_male-medium',
    ];

    /** Who keeps Alan when two men talk */
    protected const MAIN_CAST = ['SAMI', 'KHALED'];

    public const DIR = 'audio/dialogues';

    /** The voice of one speaker in a dialogue */
    public static function voiceFor(array $genders, string $speaker): string
    {
        $genders = array_change_key_case($genders, CASE_UPPER);
        $speaker = strtoupper($speaker);

        if (($genders[$speaker] ?? 'm') === 'f') {
            return 'jenny';
        }

        $men = array_keys(array_filter($genders, fn ($g) => $g !== 'f'));
        usort($men, fn ($a, $b) => self::rank($a) <=> self::rank($b));

        return ($men[0] ?? $speaker) === $speaker ? 'alan' : 'north';
    }

    protected static function rank(string $name): int
    {
        $i = array_search($name, self::MAIN_CAST, true);

        return $i === false ? count(self::MAIN_CAST) : $i;
    }

    /** The file's name — the voice and the words, nothing else */
    public static function file(string $voice, string $text): string
    {
        return substr(sha1($voice."\n".$text), 0, 16).'.mp3';
    }

    /** The URL of a line's recording, or null so the browser speaks it */
    public static function url(Dialogue $d, ?string $speaker, string $text): ?string
    {
        if (! $speaker) {
            return null;
        }

        $file = self::file(self::voiceFor($d->speaker_genders ?? [], $speaker), $text);

        return is_file(public_path(self::DIR.'/'.$file)) ? '/'.self::DIR.'/'.$file : null;
    }
}
