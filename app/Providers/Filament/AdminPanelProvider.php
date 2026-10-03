<?php

namespace App\Providers\Filament;

use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Pages\Dashboard;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\Widgets\AccountWidget;
use Filament\Widgets\FilamentInfoWidget;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

/**
 * لوحة الإدارة — على `/admin` وحدها.
 *
 * ── لماذا حزمة أماميّة ثانية مقبولة هنا ────────────────────
 * المنصّة Inertia/React، وFilament يعمل بـLivewire وAlpine. وحزمتان
 * في تطبيق واحد ثمنٌ يُدفع مرّة: لا شيء من هذا يُحمَّل على المتدرّب
 * أبداً — أصول اللوحة لا تُطلَب إلا على مسارها.
 *
 * وما تعطيه في المقابل: جداول وفلاتر وطوابير عمل في ساعات، بدل
 * أسبوعين من نماذج CRUD نصونها للأبد.
 *
 * ── والعربيّة هنا ليست ترفاً ───────────────────────────────
 * من يديرها يقرأ العربيّة، والاتّجاه من اليمين. ولوحة إنجليزيّة
 * من اليسار فوق بيانات عربيّة تُقرأ خطأً — والأسماء والملاحظات
 * كلّها عربيّة.
 */
class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('admin')
            ->path('admin')
            ->login()
            ->brandName('مَدارِج — الإدارة')
            ->favicon(asset('favicon.ico'))
            // نيليّ كالمنصّة: اللوحة امتدادها لا منتجٌ آخر
            ->colors([
                'primary' => Color::Violet,
            ])
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\Filament\Resources')
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\Filament\Pages')
            ->pages([
                Dashboard::class,
            ])
            ->discoverWidgets(in: app_path('Filament/Widgets'), for: 'App\Filament\Widgets')
            ->widgets([
                AccountWidget::class,
                FilamentInfoWidget::class,
            ])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                PreventRequestForgery::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            /*
             * العربيّة والاتّجاه.
             *
             * Filament يستنتج `dir="rtl"` من لغة التطبيق، ولغة
             * المنصّة إنجليزيّة في `config/app.php` لأنّ الواجهة
             * تتولّى تعريبها بنفسها. فتُضبط اللغة هنا عند خدمة
             * اللوحة وحدها — ولا يتأثّر بها شيء خارجها.
             */
            ->bootUsing(fn () => app()->setLocale('ar'))
            ->authMiddleware([
                Authenticate::class,
            ]);
    }
}
