<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Open every week and day
    |--------------------------------------------------------------------------
    |
    | A development switch, for walking the course without studying it
    | first. It bypasses both lock layers at once — §4.6 — so it is
    | fenced twice:
    |
    |   · it is off unless `UNLOCK_ALL_WEEKS=true` is set, and
    |   · it is ignored outright when the app runs in production,
    |     whatever the environment file says.
    |
    | It writes nothing. No gate rows, no faked completions, no touched
    | progress — set it back to false and the learner's real position is
    | exactly where it was.
    |
    */
    'unlock_all' => env('UNLOCK_ALL_WEEKS', false),

];
