<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Models\UpgradeRequest;
use App\Services\AccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Response;
use Inertia\Inertia;

/**
 * طلب الترقية — يرفع يده، ونحن نتواصل.
 *
 * ── لا دفع هنا ─────────────────────────────────────────────
 * قرارٌ مُتّخذ: التحصيل يدويّ. فهذا المسار لا يبيع شيئاً ولا يفتح
 * أسبوعاً — يُنشئ صفّاً في طابور عملٍ يفتحه موظّف. والوصول لا
 * يُمنح إلا باشتراكٍ يُنشئه المدير بعد التحصيل.
 *
 * ── وطلبٌ واحد مفتوح لا أكثر ───────────────────────────────
 * من ضغط الزرّ ثلاث مرّات وهو ينتظر لا يريد ثلاثة اشتراكات: يريد
 * جواباً. وثلاثة صفوف في الطابور تُوهم الموظّف بثلاثة عملاء،
 * وتُخفي من انتظر فعلاً. فالثاني يُحدّث الأوّل.
 */
class UpgradeController extends Controller
{
    public function __construct(
        protected AccessService $access,
    ) {}

    /**
     * العرض — ما يراه من انتهت تجربته.
     *
     * ── ولماذا صفحة لا نافذة ──────────────────────────────
     * هذه اللحظة هي قمع البيع كلّه: يقرأ الخطط ويقارنها ويقرّر.
     * ونافذةٌ منبثقة فوق أسبوعٍ مقفل تُغلَق بضغطة خارجها، ولا رابط
     * لها يُرسَل، ولا تُفتح ثانيةً إلا بالاصطدام بالجدار مرّة أخرى.
     */
    public function show(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Upgrade', [
            'plans' => fn () => Plan::offered()->get()->map(fn (Plan $p) => [
                'id'      => $p->id,
                'name_ar' => $p->name_ar,
                'months'  => $p->months,
                'price'   => $p->priceLabel(),
                'note_ar' => $p->note_ar,
                // ثمن الشهر: الأطول أرخص، ولا يظهر ذلك بلا قسمة
                'monthly' => $p->months > 1
                    ? round((float) $p->price / $p->months, 2).' '
                        .($p->currency === 'USD' ? 'دولار' : $p->currency)
                    : null,
            ]),

            // طلبه المفتوح إن وُجد — فلا يُعرض عليه النموذج مرّتين
            'pending' => fn () => UpgradeRequest::where('user_id', $user->id)
                ->open()
                ->latest()
                ->first(['id', 'contact_method', 'contact_value', 'status', 'created_at']),

            'trialWeeks' => $this->access->trialWeeks($user),

            // The feature that sent them here, when a locked one did
            'feature' => AccessService::FEATURES[$request->query('feature')] ?? null,
            'lockedWeek' => $this->access->firstLockedWeek($user),

            // رقم واتسابه من التسجيل — يُملأ ولا يُسأل عنه مرّتين
            'contact' => [
                'whatsapp' => $user->phone,
                'email'    => $user->email,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'plan_id'        => ['nullable', 'exists:plans,id'],
            'contact_method' => ['required', 'in:'.implode(',', array_keys(UpgradeRequest::METHODS))],
            'contact_value'  => ['required', 'string', 'max:120'],
            'note'           => ['nullable', 'string', 'max:500'],
        ]);

        $user = $request->user();

        // خطّةٌ معطَّلة لا تُطلَب: قد يكون العميل فتح الصفحة قبل تغييرها
        if ($data['plan_id'] ?? null) {
            abort_unless(
                Plan::where('id', $data['plan_id'])->where('is_active', true)->exists(),
                422,
                'هذه الخطّة لم تعد متاحة. حدّث الصفحة واختر غيرها.'
            );
        }

        /*
         * من له اشتراكٌ سارٍ لا يُرقّى.
         *
         * والخادم هو من يحكم: الواجهة تُخفي الزرّ، لكنّ §4.6 تقول
         * إنّها لا تُؤتمَن — وطلبٌ من مشترِك يُشغل الطابور بلا سبب.
         */
        abort_if(
            $this->access->hasSubscription($user),
            422,
            'لديك اشتراك سارٍ بالفعل.'
        );

        $open = UpgradeRequest::where('user_id', $user->id)->open()->first();

        $fields = [
            'plan_id'        => $data['plan_id'] ?? null,
            'contact_method' => $data['contact_method'],
            'contact_value'  => trim($data['contact_value']),
            'note'           => $data['note'] ?? null,
        ];

        if ($open) {
            $open->update($fields);
        } else {
            UpgradeRequest::create([...$fields, 'user_id' => $user->id, 'status' => 'new']);
        }

        return response()->json([
            'sent'    => true,
            // نقول له ما سيحدث لا «تمّ» فقط: الانتظار بلا خبر يُقرأ إهمالاً
            'message' => 'وصلنا طلبك. سنتواصل معك على '
                .UpgradeRequest::METHODS[$data['contact_method']]
                .' خلال يوم عمل.',
        ]);
    }
}
