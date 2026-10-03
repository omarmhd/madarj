{{-- The email's own HTML runs in a sandboxed iframe so its styles can't leak into the panel. --}}
<div dir="ltr" class="space-y-2 text-sm">
    <div><strong>To:</strong> {{ $record->to }}</div>

    @if ($record->html)
        <iframe
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcdoc="{{ '<base target="_blank">' . $record->html }}"
            style="width: 100%; height: 65vh; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff;"
        ></iframe>
    @else
        <pre style="white-space: pre-wrap;">{{ $record->text }}</pre>
    @endif
</div>
