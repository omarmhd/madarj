/**
 * رفيق — الشخصية التي تظهر عند الإنجاز.
 *
 * ── لماذا شخصية أصلاً ───────────────────────────────────────
 * أربعة وعشرون أسبوعاً وحدك أمام شاشة. والذي يُوقف الناس ليس صعوبة
 * اللغة بل الشعور بأن لا أحد يلاحظ. فرفيق يلاحظ — ويقول رقماً
 * حقيقياً لا مجاملة.
 *
 * ── القاعدة التي تحكم ظهوره ─────────────────────────────────
 * **لا يظهر إلا حين يكون عنده ما يقوله.** «أحسنت» تُقال لكل شيء
 * فتصير بلا معنى، فيغلقها المتدرّب بلا قراءة بعد ثلاثة أيام. أما
 * «ثلاثة أيام متصلة — وهذه أطول سلسلة لك» فتُقال مرة وتُصدَّق.
 *
 * ── وشكله ───────────────────────────────────────────────────
 * SVG خالص بلا مكتبة رسوم: المنصة مجانية وكل كيلوبايت يُحمّل ألف
 * مرة. وتعبيره يتبع المناسبة — الفرح ليس كالاطمئنان، والاطمئنان
 * ليس كالفخر.
 */

export type Mood = 'happy' | 'proud' | 'calm' | 'cheer';

/*
 * The identity colour, from the variables the admin's choice sets —
 * Rafiq was still the old violet after the platform turned terracotta.
 * Applied as `style`, not as the `fill` attribute: SVG presentation
 * attributes do not resolve var() everywhere.
 */
const PALETTE: Record<Mood, { body: string; ring: string }> = {
  happy: { body: 'rgb(var(--accent-600))', ring: 'rgb(var(--accent-100))' },
  proud: { body: 'rgb(var(--accent-700))', ring: 'rgb(var(--accent-200))' },
  calm:  { body: 'rgb(var(--neutral-600))', ring: 'rgb(var(--neutral-100))' },
  cheer: { body: 'rgb(var(--accent-500))', ring: 'rgb(var(--accent-50))' },
};

export default function Rafiq({
  mood = 'happy',
  size = 72,
}: {
  mood?: Mood;
  size?: number;
}) {
  const c = PALETTE[mood];

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="رفيق"
      className="shrink-0"
    >
      {/* هالة — تكبر قليلاً في الفرح */}
      <circle cx="32" cy="32" r="30" style={{ fill: c.ring }} />

      {/* الجسم: قطرة مستديرة — شكل واحد يقرأه الطفل والكهل */}
      <path
        d="M32 12c9.5 0 16 7 16 16.5S41.5 52 32 52 16 37 16 28.5 22.5 12 32 12Z"
        style={{ fill: c.body }}
      />

      {/* العينان */}
      {mood === 'cheer' ? (
        /* مغمضتان من الفرح — قوسان لا دائرتان */
        <>
          <path d="M24 28c1.6-2.2 4.4-2.2 6 0" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M34 28c1.6-2.2 4.4-2.2 6 0" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx="26" cy="28" r="3.2" fill="#fff" />
          <circle cx="38" cy="28" r="3.2" fill="#fff" />
          <circle cx="26.8" cy="28.8" r="1.4" style={{ fill: c.body }} />
          <circle cx="38.8" cy="28.8" r="1.4" style={{ fill: c.body }} />
        </>
      )}

      {/* الفم */}
      {mood === 'calm' ? (
        <path d="M27 39h10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      ) : (
        <path
          d={mood === 'proud' ? 'M26 38c3 3.5 9 3.5 12 0' : 'M26 37c3 4.5 9 4.5 12 0'}
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* وميض الفخر — نجمة صغيرة لا تاج، فالتاج ادّعاء */}
      {mood === 'proud' && (
        <path
          d="M48 14l1.6 3.4L53 19l-3.4 1.6L48 24l-1.6-3.4L43 19l3.4-1.6z"
          fill="#fbbf24"
        />
      )}
    </svg>
  );
}
