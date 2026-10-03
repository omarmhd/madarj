<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * الأسبوع — الوحدة الرئيسية للمحتوى.
 *
 * ملاحظة مهمة: نستخدم `number` لا `id` في الروابط.
 * لذلك getRouteKeyName ترجع number ليعمل /week/3 تلقائياً.
 */
class Week extends Model
{
    protected $fillable = [
        'number', 'module', 'title_en', 'title_ar',
        'objectives', 'writing', 'pron_section', 'is_review',
    ];

    protected $casts = [
        'objectives'   => 'array',
        'writing'      => 'array',
        'is_review'    => 'boolean',
        'module'       => 'integer',
        'number'       => 'integer',
        'pron_section' => 'integer',
    ];

    /** الروابط تستخدم رقم الأسبوع: /week/3 */
    public function getRouteKeyName(): string
    {
        return 'number';
    }

    public function days(): HasMany
    {
        return $this->hasMany(Day::class)->orderBy('number');
    }

    public function vocabulary(): HasMany
    {
        return $this->hasMany(Vocabulary::class)->orderBy('position');
    }

    public function dialogues(): HasMany
    {
        return $this->hasMany(Dialogue::class)->orderBy('number');
    }

    public function exercises(): HasMany
    {
        return $this->hasMany(Exercise::class)->orderBy('position');
    }

    public function minimalPairs(): HasMany
    {
        return $this->hasMany(MinimalPair::class)->orderBy('position');
    }

    /** أقسام الشرح: قواعد، نطق، عبارات، استماع، قراءة، اختبار ذاتي */
    public function sections(): HasMany
    {
        // The "I can…" self-check is replaced by the level tests: a
        // ticked box is a claim, a test is evidence. The book's text
        // stays in the content; it is just no longer shown.
        return $this->hasMany(Section::class)
            ->where('kind', '!=', Section::KIND_SELFCHECK)
            ->orderBy('position');
    }

    /**
     * المفردات مجمّعة حسب المجموعة — للعرض في جداول منفصلة.
     * ['family' => Collection, 'numbers' => Collection, ...]
     */
    public function vocabularyByGroup()
    {
        return $this->vocabulary->groupBy('group');
    }

    /** أزواج التمييز الصوتي مجمّعة — لعرضها كمجموعات في اللعبة */
    /**
     * Sound contrasts, grouped and named.
     *
     * ── Why a list of objects, not a map keyed by the label ──
     * It used to return `groupBy('group_label')`, so the only name
     * that reached the screen was the book's English heading —
     * `short oo against long oo` shown to a learner on day one of
     * A1. The label was the map key, so there was nowhere to put an
     * Arabic one.
     *
     * Now each group is an object that carries its own Arabic name,
     * its IPA, and the coaching line for the contrast. The English
     * heading stays as a secondary label, which is where it belongs.
     *
     * §8.2 of the book still holds: groups never mix, so the order
     * here is the order they are drilled in.
     */
    public function pairsByGroup()
    {
        return $this->minimalPairs
            ->groupBy('group_label')
            ->map(fn ($items, $label) => [
                'label_ar' => $items->first()->group_label_ar,
                'label_en' => $label,
                'ipa'      => $items->first()->ipa,
                'hint_ar'  => $items->first()->hint_ar,
                'pairs'    => $items->map(fn ($p) => [
                    'id'     => $p->id,
                    'ipa'    => $p->ipa,
                    'word_a' => $p->word_a,
                    'word_b' => $p->word_b,
                ])->values(),
            ])
            ->values();
    }
}
