<?php

namespace App\Support;

/**
 * Countries, nationalities, and the timezone each implies.
 *
 * ── Why this list and not a full ISO table ──────────────────
 * The audience is Arabic speakers. Two hundred and forty-nine
 * countries in a dropdown is a scroll; twenty-two plus "elsewhere"
 * is a choice. Anybody outside the list still gets in — they land
 * on UTC and the setup screen lets them correct it.
 *
 * ── Why the timezone is inferred, never asked ───────────────
 * The timezone is load-bearing: it decides when a day rolls over,
 * and therefore whether a streak survives the night. But asking a
 * beginner to pick an IANA identifier out of six hundred is how
 * you lose them on the first screen. The country answers it.
 *
 * Single source of truth: the same array feeds the validation rule
 * and the dropdown, so the two can never disagree.
 */
final class Countries
{
    /**
     * code => [Arabic country, IANA timezone]
     *
     * Ordered by learner population rather than alphabetically —
     * the common answers should not need scrolling.
     */
    public const LIST = [
        'EG' => ['مصر', 'Africa/Cairo'],
        'SA' => ['السعودية', 'Asia/Riyadh'],
        'DZ' => ['الجزائر', 'Africa/Algiers'],
        'IQ' => ['العراق', 'Asia/Baghdad'],
        'MA' => ['المغرب', 'Africa/Casablanca'],
        'SD' => ['السودان', 'Africa/Khartoum'],
        'YE' => ['اليمن', 'Asia/Aden'],
        'SY' => ['سوريا', 'Asia/Damascus'],
        'TN' => ['تونس', 'Africa/Tunis'],
        'JO' => ['الأردن', 'Asia/Amman'],
        'AE' => ['الإمارات', 'Asia/Dubai'],
        'LY' => ['ليبيا', 'Africa/Tripoli'],
        'LB' => ['لبنان', 'Asia/Beirut'],
        'PS' => ['فلسطين', 'Asia/Hebron'],
        'OM' => ['عمان', 'Asia/Muscat'],
        'KW' => ['الكويت', 'Asia/Kuwait'],
        'MR' => ['موريتانيا', 'Africa/Nouakchott'],
        'QA' => ['قطر', 'Asia/Qatar'],
        'BH' => ['البحرين', 'Asia/Bahrain'],
        'SO' => ['الصومال', 'Africa/Mogadishu'],
        'DJ' => ['جيبوتي', 'Africa/Djibouti'],
        'KM' => ['جزر القمر', 'Indian/Comoro'],
        'TR' => ['تركيا', 'Europe/Istanbul'],
        'DE' => ['ألمانيا', 'Europe/Berlin'],
        'FR' => ['فرنسا', 'Europe/Paris'],
        'GB' => ['بريطانيا', 'Europe/London'],
        'US' => ['أمريكا', 'America/New_York'],
        'CA' => ['كندا', 'America/Toronto'],
        'XX' => ['بلد آخر', 'UTC'],
    ];

    /** Valid codes — for the `in:` validation rule */
    public static function codes(): array
    {
        return array_keys(self::LIST);
    }

    /** The timezone a country implies, or UTC when unknown */
    public static function timezone(?string $code): string
    {
        return self::LIST[$code][1] ?? 'UTC';
    }

    /** `[{ value, label }]` for a country dropdown */
    public static function forSelect(): array
    {
        return array_map(
            fn ($code) => ['value' => $code, 'label' => self::LIST[$code][0]],
            self::codes(),
        );
    }
}
