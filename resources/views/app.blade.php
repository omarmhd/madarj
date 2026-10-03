<!DOCTYPE html>
{{--
    اتجاه الصفحة ولغتها من تفضيل المتدرّب.

    وُضع في الجذر لا في React وحده: شريط التمرير وسلوك الفائض
    والخطّ الافتراضي تُحسم كلها على <html>، فلو بقيت ثابتة ظهر
    الشريط في الجانب الخطأ ولو انقلب المحتوى.
--}}
@php
    $locale = auth()->user()?->enrollment?->locale ?? 'ar';
@endphp
<html lang="{{ $locale }}" dir="{{ $locale === 'en' ? 'ltr' : 'rtl' }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        {{-- الخطوط: Figtree للإنجليزية، IBM Plex Sans Arabic للعربية.
             التوزيع يحدث تلقائياً لأن Figtree لا يملك محارف عربية،
             فيسقط المتصفح على الخط التالي لكل حرف عربي. --}}
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600,700|ibm-plex-sans-arabic:400,500,600,700|fraunces:400,400i&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/Pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
