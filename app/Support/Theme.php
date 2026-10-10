<?php

namespace App\Support;

use App\Models\Setting;
use Throwable;

/**
 * The platform's identity colour, chosen in the admin and printed into
 * the head of every page as CSS variables.
 *
 * ── Why variables, and why in the head ──────────────────────
 * The components use Tailwind's `violet-*` and `slate-*` classes in
 * about a thousand places, and `tailwind.config.js` maps those scales to
 * `rgb(var(--accent-600) / …)`. So changing the identity is one block of
 * variables, not a rebuild — and because the server writes it into
 * `<head>` before any stylesheet, the page never flashes the old colour.
 *
 * ── The presets ─────────────────────────────────────────────
 *   paper   the book page: terracotta on warm paper (since 3 Oct 2026)
 *   violet  what came before it: Tailwind's violet on cool slate and
 *           pure white, as the comments in tailwind.config.js record
 *   custom  any colour, with warm or cool paper beneath it
 *
 * A custom colour is taken as the 600 shade — the one buttons are filled
 * with — and darkened until white text on it is readable (4.5:1), since
 * an admin choosing a pastel would otherwise make every button illegible.
 */
class Theme
{
    public const PRESETS = [
        'paper'  => 'ورقي بالتيراكوتا — الحالي',
        'violet' => 'الهوية الأولى — البنفسجي',
        'custom' => 'لون من اختيارك',
    ];

    public const NEUTRALS = [
        'warm' => 'ورق دافئ (بيج)',
        'cool' => 'رمادي بارد وأبيض ناصع',
    ];

    protected const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

    protected const TERRACOTTA = [
        50 => '#fbf3ef', 100 => '#f6e2d9', 200 => '#edc3b2', 300 => '#e19d84',
        400 => '#d4775a', 500 => '#c65a3b', 600 => '#b8432a', 700 => '#983524',
        800 => '#7c2d22', 900 => '#66281f', 950 => '#37120d',
    ];

    /** Tailwind's default violet — the platform's colour before the book redesign */
    protected const VIOLET = [
        50 => '#f5f3ff', 100 => '#ede9fe', 200 => '#ddd6fe', 300 => '#c4b5fd',
        400 => '#a78bfa', 500 => '#8b5cf6', 600 => '#7c3aed', 700 => '#6d28d9',
        800 => '#5b21b6', 900 => '#4c1d95', 950 => '#2e1065',
    ];

    /** Warm greys: paper at the light end, ink at the dark end */
    protected const INK = [
        50 => '#f5f0e6', 100 => '#ece5d7', 200 => '#ddd4c3', 300 => '#c6bca9',
        400 => '#9d9587', 500 => '#767068', 600 => '#5d5953', 700 => '#45433f',
        800 => '#2e2e2c', 900 => '#1d2729', 950 => '#121618',
    ];

    /**
     * Tailwind's slate, with its two lightest shades lifted toward white:
     * the stock #f8fafc / #f1f5f9 read as silver across a whole page
     * background. The rest — text and borders — is slate as it was.
     */
    protected const SLATE = [
        50 => '#fcfcfd', 100 => '#f5f7fa', 200 => '#e2e8f0', 300 => '#cbd5e1',
        400 => '#94a3b8', 500 => '#64748b', 600 => '#475569', 700 => '#334155',
        800 => '#1e293b', 900 => '#0f172a', 950 => '#020617',
    ];

    /** The page itself — the `.folio` variables in app.css */
    protected const SURFACES = [
        'warm' => [
            'white' => '#fffcf5', 'paper' => '#f5f0e6', 'sheet' => '#fffcf5', 'ink' => '#1d2729',
            'ink-soft' => '#5d6567', 'rule' => '#e7ddca', 'tint' => '#f6f0e4',
        ],
        'cool' => [
            'white' => '#ffffff', 'paper' => '#fcfcfd', 'sheet' => '#ffffff', 'ink' => '#0f172a',
            'ink-soft' => '#475569', 'rule' => '#e8ecf1', 'tint' => '#f7f8fa',
        ],
    ];

    /** @return array{preset: string, accent: string, neutral: string} */
    public static function settings(): array
    {
        try {
            return [
                'preset'  => (string) Setting::get('theme_preset', 'paper'),
                'accent'  => (string) Setting::get('theme_accent', '#b8432a'),
                'neutral' => (string) Setting::get('theme_neutral', 'warm'),
            ];
        } catch (Throwable) {
            // No settings table yet (a fresh install, a test database): the default look
            return ['preset' => 'paper', 'accent' => '#b8432a', 'neutral' => 'warm'];
        }
    }

    /** The resolved palette: accent and neutral scales, and the page surfaces */
    public static function palette(?array $s = null): array
    {
        $s ??= static::settings();

        [$accent, $neutral, $surface] = match ($s['preset']) {
            'violet' => [self::VIOLET, self::SLATE, 'cool'],
            'custom' => [
                static::scaleFrom($s['accent']),
                $s['neutral'] === 'cool' ? self::SLATE : self::INK,
                $s['neutral'] === 'cool' ? 'cool' : 'warm',
            ],
            default => [self::TERRACOTTA, self::INK, 'warm'],
        };

        return ['accent' => $accent, 'neutral' => $neutral, 'surface' => self::SURFACES[$surface]];
    }

    /** The `<style>` body for the page head */
    public static function css(?array $s = null): string
    {
        $p = static::palette($s);
        $vars = [];

        foreach (self::SHADES as $shade) {
            $vars[] = "--accent-{$shade}:".static::channels($p['accent'][$shade]);
            $vars[] = "--neutral-{$shade}:".static::channels($p['neutral'][$shade]);
        }

        $vars[] = '--white:'.static::channels($p['surface']['white']);

        foreach (['paper', 'sheet', 'ink', 'ink-soft', 'rule', 'tint'] as $k) {
            $vars[] = "--{$k}:".$p['surface'][$k];
        }

        $vars[] = '--accent:'.$p['accent'][600];
        $vars[] = '--margin:'.$p['accent'][300];
        // Dark mode reads the accent lighter, and its tints very dark
        $vars[] = '--accent-dark:'.$p['accent'][300];
        $vars[] = '--accent-dark-tint:'.static::mix($p['accent'][950], '#121618', 0.35);
        $vars[] = '--accent-dark-ring:'.$p['accent'][800];

        return ':root{'.implode(';', $vars).'}';
    }

    /**
     * The page style: `book` (paper, stamp buttons, ruled boxes) or
     * `classic` — the platform's first look, which the violet preset
     * brings back whole, not just its colour. app.css keys every
     * difference off `html[data-style]`.
     */
    public static function style(?array $s = null): string
    {
        $s ??= static::settings();

        return $s['preset'] === 'violet' ? 'classic' : 'book';
    }

    /** The accent's button colour, for places outside CSS */
    public static function accentHex(?array $s = null): string
    {
        return static::palette($s)['accent'][600];
    }

    /**
     * A full scale from one colour, taken as the 600 shade.
     *
     * Lighter shades mix toward white, darker ones toward black, in the
     * proportions Tailwind's own scales roughly follow.
     */
    public static function scaleFrom(string $hex): array
    {
        $base = static::readable(static::normalizeHex($hex));

        $toWhite = [50 => 0.93, 100 => 0.85, 200 => 0.70, 300 => 0.50, 400 => 0.28, 500 => 0.12];
        $toBlack = [700 => 0.18, 800 => 0.33, 900 => 0.46, 950 => 0.68];

        $scale = [600 => $base];
        foreach ($toWhite as $shade => $t) {
            $scale[$shade] = static::mix($base, '#ffffff', $t);
        }
        foreach ($toBlack as $shade => $t) {
            $scale[$shade] = static::mix($base, '#000000', $t);
        }
        ksort($scale);

        return $scale;
    }

    /** Darken until white text on it reaches 4.5:1 — buttons must stay legible */
    public static function readable(string $hex): string
    {
        for ($i = 0; $i < 20 && static::contrastWithWhite($hex) < 4.5; $i++) {
            $hex = static::mix($hex, '#000000', 0.08);
        }

        return $hex;
    }

    public static function contrastWithWhite(string $hex): float
    {
        return 1.05 / (static::luminance($hex) + 0.05);
    }

    public static function normalizeHex(string $hex): string
    {
        $hex = ltrim(trim($hex), '#');

        if (preg_match('/^[0-9a-f]{3}$/i', $hex)) {
            $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
        }

        return preg_match('/^[0-9a-f]{6}$/i', $hex) ? '#'.strtolower($hex) : '#b8432a';
    }

    protected static function rgb(string $hex): array
    {
        $hex = ltrim($hex, '#');

        return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
    }

    /** "184 67 42" — the form Tailwind's `<alpha-value>` needs */
    protected static function channels(string $hex): string
    {
        return implode(' ', static::rgb($hex));
    }

    protected static function mix(string $a, string $b, float $t): string
    {
        [$r1, $g1, $b1] = static::rgb($a);
        [$r2, $g2, $b2] = static::rgb($b);

        return sprintf(
            '#%02x%02x%02x',
            (int) round($r1 + ($r2 - $r1) * $t),
            (int) round($g1 + ($g2 - $g1) * $t),
            (int) round($b1 + ($b2 - $b1) * $t),
        );
    }

    protected static function luminance(string $hex): float
    {
        $c = array_map(function ($v) {
            $v /= 255;

            return $v <= 0.03928 ? $v / 12.92 : (($v + 0.055) / 1.055) ** 2.4;
        }, static::rgb($hex));

        return 0.2126 * $c[0] + 0.7152 * $c[1] + 0.0722 * $c[2];
    }
}
