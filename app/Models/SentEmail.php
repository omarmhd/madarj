<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SentEmail extends Model
{
    protected $fillable = ['to', 'subject', 'html', 'text', 'mailer'];
}
