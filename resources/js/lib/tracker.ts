/**
 * تسجيل حركات المتدرّب — من جهة المتصفح.
 *
 * ── لماذا لا نرسل عند كل حركة ───────────────────────────────
 * زرّ الاستماع يُضغط عشرات المرات في الدقيقة الواحدة. طلبٌ لكل ضغطة
 * يعني طابوراً من الطلبات ينافس تحميل الصفحة نفسها، وعلى شبكة موبايل
 * بطيئة يظهر ذلك تأخّراً في الواجهة — وهذا ثمن لا يستحقّه سجلّ.
 *
 * فالأحداث تُجمع في الذاكرة وتُرسل دفعةً واحدة عند أول ما يقع من:
 *   • مرور عشر ثوانٍ
 *   • امتلاء المخزن (25 حدثاً)
 *   • إخفاء التبويب أو إغلاقه
 *
 * ── لماذا `sendBeacon` عند الإغلاق ──────────────────────────
 * `fetch` عادي يُلغى حين تُغلق الصفحة، فتضيع آخر دفعة — وهي أهمّها،
 * لأنها تحمل «أين توقّف». و`sendBeacon` يسلّم الطلب للمتصفح فيرسله
 * بعد موت الصفحة. هذا هو الفرق بين معرفة أين توقّف وعدم معرفتها.
 *
 * ── لماذا لا يُعاد الإرسال عند الفشل ────────────────────────
 * لأن هذه ملاحظات لا حقائق. حدث ضائع لا يضرّ أحداً، ومحاولة إنقاذه
 * تعني حلقة إعادة تنافس ما يفعله المتدرّب الآن. أما تقدّمه الحقيقي —
 * إتمام مهمّة، تصحيح تمرين — فله مساره الخاص المتزامن.
 */

export type EventType =
  | 'day_open' | 'task_open' | 'task_done' | 'section_view'
  | 'audio_play' | 'audio_slow' | 'card_flip' | 'card_grade'
  | 'exercise_try' | 'exercise_reveal' | 'dialogue_play'
  | 'game_answer' | 'record_start' | 'break_item' | 'heartbeat'
  | 'word_test' | 'say_check' | 'story_read';

interface Ev {
  type: EventType;
  ref?: string | null;
  value?: number | null;
  week?: number | null;
  day?: number | null;
  meta?: Record<string, unknown>;
  at: string;
}

const URL = '/events';
const FLUSH_MS = 10_000;
const MAX_BUFFER = 25;

let buffer: Ev[] = [];
let timer: number | null = null;

/** سياق الصفحة الحالية — يُضبط مرة فلا يتكرّر في كل نداء */
let ctx: { week?: number | null; day?: number | null } = {};

export function setTrackContext(week?: number | null, day?: number | null) {
  ctx = { week, day };
}

function csrf(): string {
  return (
    document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ??
    decodeURIComponent(
      document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))?.slice(11) ?? '',
    )
  );
}

/** يرسل ما في المخزن. `viaBeacon` عند إغلاق الصفحة */
/**
 * يرسل ما تجمّع الآن.
 *
 * ويُرجع وعداً ينتهي حين يصل — لأنّ مناديه قد يحتاج أن يقرأ ما كتبه
 * مباشرةً بعده: سجلّ الأخطاء يُحدَّث فور انتهاء الجولة، ولو أُعيد
 * طلبه قبل وصول الدفعة لعاد بالسجلّ القديم.
 *
 * وهو لا يفشل أبداً من ناحية المنادي: الفشل مبتلع كما كان، والوعد
 * ينتهي في الحالين.
 */
export function flush(viaBeacon = false): Promise<void> {
  if (!buffer.length) return Promise.resolve();

  const events = buffer;
  buffer = [];
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }

  const body = JSON.stringify({ events });

  if (viaBeacon && navigator.sendBeacon) {
    // Beacon لا يحمل ترويسات، فالرمز يُمرَّر في الجسم — والخادم
    // يقرؤه من الكوكي أصلاً، لكن نتركه صريحاً لوضوح النية
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(URL, blob);
    return Promise.resolve();
  }

  return fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': csrf(),
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
    credentials: 'same-origin',
    // لا ينافس طلبات الواجهة على النطاق
    keepalive: true,
  })
    .then(() => undefined)
    .catch(() => {
      /* ملاحظة ضائعة لا تستحقّ إزعاج المتدرّب */
    });
}

/** يسجّل حركة — لا يُرسل شيئاً بنفسه في الغالب */
export function track(
  type: EventType,
  ref?: string | null,
  value?: number | null,
  meta?: Record<string, unknown>,
) {
  buffer.push({
    type,
    ref: ref ?? null,
    value: value ?? null,
    week: ctx.week ?? null,
    day: ctx.day ?? null,
    ...(meta ? { meta } : {}),
    at: new Date().toISOString(),
  });

  if (buffer.length >= MAX_BUFFER) {
    flush();
    return;
  }
  if (timer === null) {
    timer = window.setTimeout(() => flush(), FLUSH_MS);
  }
}

/**
 * نبضة النشاط.
 *
 * «كم دقيقة درس؟» لا يُقاس بفارق فتح الصفحة وإغلاقها: من يترك
 * التبويب مفتوحاً ساعتين لم يدرس ساعتين. فتُرسل نبضة كل ثلاثين
 * ثانية **ما دام التبويب ظاهراً وفيه حركة**، والمجموع هو الوقت
 * الفعلي.
 */
let lastActivity = Date.now();
let heartbeat: number | null = null;

export function startHeartbeat() {
  if (heartbeat !== null) return;

  const bump = () => { lastActivity = Date.now(); };
  ['pointerdown', 'keydown', 'scroll'].forEach((e) =>
    window.addEventListener(e, bump, { passive: true }),
  );

  heartbeat = window.setInterval(() => {
    if (document.hidden) return;
    // خاملٌ أكثر من دقيقتين: لا يُحتسب
    if (Date.now() - lastActivity > 120_000) return;
    track('heartbeat', null, 30);
  }, 30_000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush(true);
  });
  window.addEventListener('pagehide', () => flush(true));
}
