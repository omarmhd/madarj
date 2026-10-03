<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DialogueLine extends Model
{
    protected $fillable = ['dialogue_id', 'position', 'speaker', 'en', 'ar'];

    protected $casts = ['position' => 'integer'];

    public function dialogue(): BelongsTo
    {
        return $this->belongsTo(Dialogue::class);
    }
}
