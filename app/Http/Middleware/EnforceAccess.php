<?php

namespace App\Http\Middleware;

use App\Services\AccessService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The subscription gate — by route name, in one place.
 *
 * ── Why a map and not a middleware on each route ────────────
 * A guard added route by route is forgotten on the next route. Here
 * every route in the learner group passes through one table, and a
 * route that is not in the table is treated as a lesson — closed when
 * the lessons are — so a new page cannot slip out from under the gate.
 *
 * ── What "expired" closes ───────────────────────────────────
 * Everything but the way out: the upgrade page, the account, setup and
 * logout. An ended trial and an ended subscription look the same here;
 * the upgrade page tells them apart ("subscribe" or "renew").
 *
 * The server decides (§4.6); the interface only shows the locks.
 */
class EnforceAccess
{
    /** Always reachable, whatever the status */
    protected const EXEMPT = [
        'upgrade', 'upgrade.*', 'profile.*', 'setup', 'setup.*', 'logout',
        'verification.*', 'password.*', 'events.store', 'media',
    ];

    /** Route name patterns → feature key */
    protected const FEATURE_OF = [
        'review.*'    => 'review',
        'tests'       => 'tests',
        'tests.*'     => 'tests',
        'play'        => 'play',
        'play.*'      => 'play',
        'stories'     => 'stories',
        'memory.*'    => 'memory',
        // The dashboard is the home page: open in any trial, closed only when expired
        'dashboard'   => null,
    ];

    public function __construct(protected AccessService $access) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || $request->routeIs(...self::EXEMPT)) {
            return $next($request);
        }

        $status = $this->access->status($user);

        if ($status === AccessService::STATUS_ADMIN || $status === AccessService::STATUS_SUBSCRIBED) {
            return $next($request);
        }

        if ($status === AccessService::STATUS_EXPIRED) {
            return $this->deny($request, null);
        }

        $feature = $this->featureOf($request);

        if ($feature === null || $this->access->mayUse($user, $feature)) {
            return $next($request);
        }

        return $this->deny($request, $feature);
    }

    protected function featureOf(Request $request): ?string
    {
        foreach (self::FEATURE_OF as $pattern => $feature) {
            if ($request->routeIs($pattern)) {
                return $feature;
            }
        }

        // Anything unlisted is part of the course itself
        return 'lessons';
    }

    /**
     * Pages go to the upgrade page; background calls (axios) get a
     * status code they can read, not an HTML page in place of JSON.
     */
    protected function deny(Request $request, ?string $feature): Response
    {
        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            abort(402, $feature
                ? 'هذه الميزة للمشتركين: '.AccessService::FEATURES[$feature]
                : 'انتهت فترتك. جدّد اشتراكك للمتابعة.');
        }

        return redirect()->route('upgrade', $feature ? ['feature' => $feature] : []);
    }
}
