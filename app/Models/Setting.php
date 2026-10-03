<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * إعداد يضبطه المدير.
 *
 * ── ويُخزَّن مؤقتاً ────────────────────────────────────────
 * `trial_weeks` يُسأل عنه في كل بوّابة أسبوع — أي في كل صفحة درس.
 * وهو صفٌّ واحد لا يتغيّر في الشهر مرّة، فقراءته من القاعدة كل مرّة
 * استعلامٌ بلا سبب. والكتابة تُبطل الخزن، فلا يبقى قديماً.
 */
class Setting extends Model
{
    public $incrementing = false;

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];

    protected static function booted(): void
    {
        static::saved(fn (Setting $s) => Cache::forget('setting:'.$s->key));
        static::deleted(fn (Setting $s) => Cache::forget('setting:'.$s->key));
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return Cache::rememberForever(
            'setting:'.$key,
            fn () => static::find($key)->value ?? $default,
        );
    }

    public static function put(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => (string) $value]);
    }
}
