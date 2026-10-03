<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Dialogue extends Model
{
    protected $fillable = [
        'week_id', 'number', 'title', 'situation_en', 'situation_ar',
    ];

    protected $casts = ['number' => 'integer'];

    public function week(): BelongsTo
    {
        return $this->belongsTo(Week::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(DialogueLine::class)->orderBy('position');
    }

    /** المتحدثون في هذا الحوار — لتلوينهم في الواجهة */
    public function speakers(): array
    {
        return $this->lines->pluck('speaker')->unique()->values()->all();
    }
}
