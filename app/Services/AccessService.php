<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * هل يملك هذا المتدرّب حقّ هذا الأسبوع؟
 *
 * ── ولماذا هذا سؤالٌ آخر غير القفل ─────────────────────────
 * `ProgressService` يسأل: **هل استحقّه دراسةً؟** — أتمّ ما قبله
 * ونجح في اختباره. وهذا يسأل: **هل يملكه؟** — تجربةً أو اشتراكاً.
 *
 * وخلطهما خطأ يظهر متأخّراً وبأسوأ صورة: من أتمّ الأسبوع الأول
 * **استحقّ** الثاني وإن لم يشترك، فلو كان القفل واحداً لانفتح له.
 * والعكس أسوأ: مشترِكٌ لم يدرس بعد يُفتح له الأسبوع الرابع
 * والعشرون. فالشرطان يجتمعان ولا ينوب أحدهما عن الآخر.
 *
 * ── ثلاث مراتب، والأعلى يكفي ───────────────────────────────
 *   ① اشتراكٌ سارٍ — مدفوعاً أو ممنوحاً: الدورة كلّها.
 *   ② أسابيع تجربة للمتدرّب وحده — استثناءُ البيع.
 *   ③ أسابيع التجربة العامّة — من الإعدادات، لا من الشفرة.
 */
class AccessService
{
    /** ما يفتحه غير المشترِك — عامّاً أو باستثناءٍ له */
    public const DEFAULT_TRIAL_WEEKS = 1;

    /**
     * Trial length in days from sign-up; 0 means no time limit.
     *
     * Zero by default on purpose: existing learners signed up long
     * ago, and any positive default would lock every one of them out
     * the moment this shipped. The admin sets the real length.
     */
    public const DEFAULT_TRIAL_DAYS = 0;

    /**
     * The features an admin can open or close for the free trial.
     *
     * Each key is matched to routes in `EnforceAccess`; the labels are
     * what the admin reads in the settings page and what a locked
     * learner reads on the upgrade page.
     */
    public const FEATURES = [
        'lessons' => 'الدروس والأسابيع',
        'review'  => 'المراجعة بالبطاقات',
        'tests'   => 'اختبارات المستوى',
        'play'    => 'الألعاب',
        'stories' => 'القصص',
        'memory'  => 'الذاكرة — كلماتك',
    ];

    /** Open in the trial unless the admin says otherwise */
    public const DEFAULT_TRIAL_FEATURES = ['lessons', 'review', 'tests', 'play', 'stories', 'memory'];

    public const STATUS_ADMIN = 'admin';

    public const STATUS_SUBSCRIBED = 'subscribed';

    public const STATUS_TRIAL = 'trial';

    public const STATUS_EXPIRED = 'expired';

    /**
     * هل يملك الوصول إلى هذا الأسبوع؟
     *
     * والمدير يفتح كل شيء: لا يُحجب عن نفسه ما يديره، وإلا اضطرّ
     * إلى منح نفسه اشتراكاً ليرى ما يعرضه على الناس.
     */
    public function mayOpenWeek(User $user, int $weekNumber): bool
    {
        if ($user->is_admin) {
            return true;
        }

        if ($this->hasSubscription($user)) {
            return true;
        }

        // An ended trial opens nothing, whatever the week count says
        if ($this->trialExpired($user)) {
            return false;
        }

        return $weekNumber <= $this->trialWeeks($user);
    }

    /* ───────────── Trial by time, and features ───────────── */

    public function trialDays(): int
    {
        return (int) Setting::get('trial_days', self::DEFAULT_TRIAL_DAYS);
    }

    /** The end of the trial, or null when the trial has no time limit */
    public function trialEndsAt(User $user): ?Carbon
    {
        $days = $this->trialDays();

        return $days > 0 ? $user->created_at->copy()->addDays($days) : null;
    }

    public function trialExpired(User $user): bool
    {
        $end = $this->trialEndsAt($user);

        return $end !== null && now()->gte($end);
    }

    /** Feature keys open during the free trial */
    public function trialFeatures(): array
    {
        $saved = Setting::get('trial_features');

        return $saved === null
            ? self::DEFAULT_TRIAL_FEATURES
            : array_values(array_intersect(array_keys(self::FEATURES), (array) json_decode($saved, true)));
    }

    /**
     * Where this learner stands — one word every gate reads.
     *
     * Expired covers both an ended trial and an ended subscription:
     * either way nothing is open and the way back is the same page.
     */
    public function status(User $user): string
    {
        return match (true) {
            (bool) $user->is_admin        => self::STATUS_ADMIN,
            $this->hasSubscription($user) => self::STATUS_SUBSCRIBED,
            $this->trialExpired($user)    => self::STATUS_EXPIRED,
            default                       => self::STATUS_TRIAL,
        };
    }

    public function mayUse(User $user, string $feature): bool
    {
        return match ($this->status($user)) {
            self::STATUS_ADMIN, self::STATUS_SUBSCRIBED => true,
            self::STATUS_EXPIRED => false,
            default => in_array($feature, $this->trialFeatures(), true),
        };
    }

    /** Whether the learner ever had a subscription — "renew" rather than "subscribe" */
    public function hadSubscription(User $user): bool
    {
        return Subscription::where('user_id', $user->id)->exists();
    }

    /** What the interface needs for locks and the trial countdown */
    public function summary(User $user): array
    {
        $status = $this->status($user);
        $end = $status === self::STATUS_TRIAL ? $this->trialEndsAt($user) : null;

        return [
            'status'        => $status,
            'trial_ends_at' => $end?->toIso8601String(),
            'days_left'     => $end ? max(0, (int) ceil(now()->diffInSeconds($end, false) / 86400)) : null,
            'features'      => collect(array_keys(self::FEATURES))
                ->mapWithKeys(fn ($f) => [$f => $this->mayUse($user, $f)])
                ->all(),
            'renew'         => $status === self::STATUS_EXPIRED && $this->hadSubscription($user),
        ];
    }

    /** اشتراكٌ سارٍ اليوم — استعلامٌ واحد على الفهرس */
    public function hasSubscription(User $user): bool
    {
        return Subscription::where('user_id', $user->id)->active()->exists();
    }

    /** آخر يوم وصول، أو `null` لمن لا اشتراك له */
    public function accessUntil(User $user): ?string
    {
        return Subscription::where('user_id', $user->id)
            ->active()
            ->max('ends_on');
    }

    /**
     * أسابيع التجربة لهذا المتدرّب.
     *
     * حقله وحده إن ضُبط — والصفر منه مقصود: مَن أُوقفت تجربته.
     * ولذلك يُفحَص `null` لا «الفارغ»، فالصفر قيمةٌ لا غياب.
     */
    public function trialWeeks(User $user): int
    {
        if ($user->free_weeks !== null) {
            return (int) $user->free_weeks;
        }

        return (int) Setting::get('trial_weeks', self::DEFAULT_TRIAL_WEEKS);
    }

    /**
     * أوّل أسبوع مُغلَق عليه — ما يُعرض عليه أن يترقّى إليه.
     *
     * يُرجع `null` للمشترِك: لا شيء يُعرض على من يملك الكلّ.
     */
    public function firstLockedWeek(User $user): ?int
    {
        if ($user->is_admin || $this->hasSubscription($user) || $this->trialExpired($user)) {
            return null;
        }

        $next = $this->trialWeeks($user) + 1;

        return $next <= 24 ? $next : null;
    }
}
