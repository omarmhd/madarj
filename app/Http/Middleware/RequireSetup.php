<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * يحوّل مَن لم يُهيّئ إعداداته إلى صفحة التهيئة.
 *
 * مرة واحدة فقط: `setup_done_at` يمنع التكرار.
 *
 * ولا يُطبَّق على صفحة التهيئة نفسها ولا على الخروج، وإلا دار
 * التحويل على نفسه.
 */
class RequireSetup
{
    public function handle(Request $request, Closure $next): Response
    {
        $enrollment = $request->user()?->enrollment;

        $exempt = $request->routeIs('setup')
            || $request->routeIs('setup.store')
            || $request->routeIs('logout')
            || $request->routeIs('profile.*');

        /*
         * وغياب التسجيل كنقصان التهيئة.
         *
         * كان الشرط يفحص `$enrollment &&` — فمن لا تسجيل له يمرّ، ثم
         * تنهار اللوحة عليه بـ500 لأنّها تسأل تسجيلاً غير موجود.
         * ومثل هذا المستخدم ليس فرضاً نظريّاً: كلّ من يُنشئه المدير
         * من اللوحة يولد هكذا.
         */
        if ((! $enrollment || $enrollment->setup_done_at === null) && ! $exempt) {
            // الطلبات غير الملاحية (axios) لا تُحوَّل — تُرجع 409 ليعرف
            // المتصفح أن عليه الانتقال، بدل أن يستقبل HTML مكان JSON
            if ($request->expectsJson() && ! $request->header('X-Inertia')) {
                abort(409, 'التهيئة مطلوبة أولاً.');
            }

            return redirect()->route('setup');
        }

        return $next($request);
    }
}
