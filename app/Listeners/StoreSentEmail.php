<?php

namespace App\Listeners;

use App\Models\SentEmail;
use Illuminate\Mail\Events\MessageSent;
use Throwable;

class StoreSentEmail
{
    public function handle(MessageSent $event): void
    {
        $message = $event->message;

        // Storing a copy must never break the send itself.
        try {
            SentEmail::create([
                'to'      => mb_substr(collect($message->getTo())->map->toString()->implode(', '), 0, 500),
                'subject' => mb_substr((string) $message->getSubject(), 0, 500),
                'html'    => self::body($message->getHtmlBody()),
                'text'    => self::body($message->getTextBody()),
                'mailer'  => $event->data['mailer'] ?? config('mail.default'),
            ]);
        } catch (Throwable $e) {
            report($e);
        }
    }

    /** Symfony may hand the body back as a stream. */
    private static function body(mixed $body): ?string
    {
        if (is_resource($body)) {
            rewind($body);

            return stream_get_contents($body) ?: null;
        }

        return $body;
    }
}
