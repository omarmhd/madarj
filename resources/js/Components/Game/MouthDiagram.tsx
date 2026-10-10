import { Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ARTICULATION, type Articulation } from '@/lib/articulation';
import { iso } from '@/lib/bidi';
import { useT } from '@/lib/i18n';

/**
 * How the mouth makes a sound — drawn, not described.
 *
 * Two views because they answer two questions. The side view shows
 * what the learner cannot see: where the tongue is and what it
 * touches. The front view shows what they can check in a mirror:
 * the shape of the lips. Arabic speakers mostly fail on the first
 * (/ɪ/ vs /iː/ is tongue tension) and fix fastest with the second.
 *
 * Everything is computed from `lib/articulation.ts` — no image per
 * sound, so a new sound is one line of data and ~3 KB of code covers
 * all of them.
 */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Roof of the mouth, as a height at each point front→back */
const palateY = (x: number) => 45 + ((x - 88) / 40) ** 2 * 6;

function geometry(a: Articulation) {
  const dy = a.jaw * 14;

  // Lips: rounded pushes them forward, spread pulls them back
  const lx = a.lips === 'rounded' ? -5 : a.lips === 'spread' ? 2 : 0;

  // Lower lip follows the jaw — except where the lips themselves act
  const lower =
    a.lips === 'closed' ? { x: lx, y: -7 }
    : a.lips === 'teeth-lip' ? { x: 7, y: -6 }
    : { x: lx, y: dy };

  let tip = { x: 49, y: 76 + dy };
  let hump = { x: 88, y: 70 + dy };

  if (a.kind === 'vowel' && a.tongue) {
    const hx = 64 + a.tongue.back * 56;
    hump = { x: hx, y: lerp(palateY(hx) + 5, 86 + dy * 0.8, a.tongue.height) };
  } else {
    switch (a.contact) {
      case 'dental':
        tip = { x: 37, y: 67 + dy * 0.5 };
        hump = { x: 82, y: 63 };
        break;
      case 'alveolar':
        tip = { x: 51, y: 58.5 };
        hump = { x: 85, y: 62 };
        break;
      case 'alveolar-near':
        tip = { x: 51, y: 61.5 };
        hump = { x: 85, y: 63 };
        break;
      case 'velar':
        hump = { x: 117, y: 49.5 };
        break;
    }
  }

  const tongue =
    `M ${tip.x} ${tip.y} C ${tip.x + 6} ${tip.y - 8}, ${hump.x - 18} ${hump.y}, ${hump.x} ${hump.y} ` +
    `C ${hump.x + 16} ${hump.y}, 134 ${hump.y + 10}, 136 118 L 120 121 ` +
    `Q 80 ${112 + dy * 0.4} 54 ${96 + dy * 0.6} Q 47 ${90 + dy * 0.6} ${tip.x} ${tip.y} Z`;

  return { dy, lx, lower, tip, tongue };
}

function SideView({ a, ghost }: { a: Articulation; ghost?: Articulation }) {
  const { dy, lx, lower, tip, tongue } = geometry(a);
  // In a comparison, the other sound's tongue as a dashed outline — the
  // shift between /ɪ/ and /iː/ is a few millimetres, invisible side by side
  const ghostTongue = ghost ? geometry(ghost).tongue : null;
  const skin = '#fde7d7';
  const edge = '#d9a487';

  // Where the air escapes, for the hissing sounds
  const air =
    !a.fricative ? null
    : a.lips === 'teeth-lip' ? { x: 40, y: 64 }
    : a.contact === 'dental' ? { x: tip.x - 2, y: tip.y }
    : { x: 46, y: 63 };

  return (
    <svg viewBox="0 0 170 130" className="h-auto w-full" aria-hidden>
      {/* oral cavity */}
      <rect x="40" y="40" width="102" height="88" fill="#4a1d2a" />

      {/* upper head: nose, palate line, back of throat */}
      <path
        d="M170 0 L52 0 Q46 14 44 24 L24 42 Q20 47 27 50 L44 52 L44 58
           Q48 56 52 56 Q75 42 112 46 Q126 49 132 58 L140 60 L140 130 L170 130 Z"
        fill={skin} stroke={edge} strokeWidth="1"
      />

      {/* air through the nose */}
      {a.nasal && (
        <path
          d="M128 54 Q100 28 42 34 L18 40" fill="none" style={{ stroke: 'rgb(var(--accent-600))' }}
          strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#arrow)"
        />
      )}

      {/* upper lip */}
      <path
        d={`M44 52 L${36 + lx} 53 Q${28 + lx} 56 ${29 + lx} 61 Q${30 + lx} 65 ${38 + lx} 65 L44 64 Z`}
        fill="#e9967a" stroke={edge} strokeWidth="1"
      />
      <rect x="42" y="59" width="5" height="8" rx="1" fill="#fff" stroke="#94a3b8" strokeWidth="0.8" />

      {/* lower jaw: chin and teeth move together */}
      <g style={{ transition: 'transform .35s' }} transform={`translate(0 ${dy})`}>
        <path
          d="M46 84 Q48 96 42 104 Q60 114 100 114 L138 122 L138 130 L30 130 L30 104 Q34 92 40 84 Z"
          fill={skin} stroke={edge} strokeWidth="1"
        />
        <rect x="43" y="70" width="5" height="8" rx="1" fill="#fff" stroke="#94a3b8" strokeWidth="0.8" />
      </g>

      {/* lower lip — moves with the jaw unless the lips themselves act */}
      <g style={{ transition: 'transform .35s' }} transform={`translate(${lower.x} ${lower.y})`}>
        <path
          d="M46 72 L38 72 Q29 74 30 79 Q31 84 40 84 L46 84 Z"
          fill="#e9967a" stroke={edge} strokeWidth="1"
        />
      </g>

      {/* tongue */}
      <path d={tongue} fill="#f4a3b4" stroke="#be4b63" strokeWidth="1.2" style={{ transition: 'd .35s' }} />
      {ghostTongue && ghostTongue !== tongue && (
        <path d={ghostTongue} fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
      )}

      {/* hiss */}
      {air && (
        <g stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 3">
          <path d={`M${air.x} ${air.y} L${air.x - 22} ${air.y - 2}`} />
          <path d={`M${air.x} ${air.y + 2} L${air.x - 20} ${air.y + 5}`} />
        </g>
      )}

      {/* puff of air on release */}
      {a.aspirated && (
        <g fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round">
          <path d="M20 58 q-4 5 0 10" />
          <path d="M14 56 q-5 7 0 14" />
          <path d="M8 54 q-6 9 0 18" />
        </g>
      )}

      {/* vocal folds buzzing */}
      {a.voiced ? (
        <path
          d="M142 112 l4 -4 l4 4 l4 -4 l4 4 l4 -4" fill="none" stroke="#f59e0b"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        />
      ) : (
        <path d="M142 110 L164 110" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
      )}

      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" style={{ fill: 'rgb(var(--accent-600))' }} />
        </marker>
      </defs>
    </svg>
  );
}

function FrontView({ a }: { a: Articulation }) {
  const j = a.jaw;
  const shape = {
    spread: { w: 46, h: 6 + j * 10 },
    neutral: { w: 34, h: 8 + j * 16 },
    rounded: { w: 16, h: 14 + j * 6 },
    open: { w: 36, h: 14 + j * 12 },
    closed: { w: 34, h: 1 },
    'teeth-lip': { w: 36, h: 5 },
  }[a.lips];

  const cx = 40;
  const cy = 26;
  const inner = { rx: Math.max(shape.w / 2 - 4, 2), ry: Math.max(shape.h / 2 - 2, 0.5) };

  return (
    <svg viewBox="0 0 80 52" className="h-auto w-full" aria-hidden>
      <ellipse cx={cx} cy={cy} rx={shape.w / 2 + 3} ry={shape.h / 2 + 5} fill="#e9967a" style={{ transition: 'all .35s' }} />
      {a.lips !== 'closed' && (
        <>
          <ellipse cx={cx} cy={cy} rx={inner.rx} ry={inner.ry} fill="#4a1d2a" style={{ transition: 'all .35s' }} />
          {shape.h > 8 && (
            <rect x={cx - inner.rx * 0.7} y={cy - inner.ry} width={inner.rx * 1.4} height={Math.min(4, inner.ry)} fill="#fff" />
          )}
          {a.contact === 'dental' && (
            <ellipse cx={cx} cy={cy + 0.5} rx={inner.rx * 0.6} ry="2.6" fill="#f4a3b4" stroke="#be4b63" strokeWidth="0.6" />
          )}
        </>
      )}
      {a.lips === 'closed' && <path d={`M${cx - 17} ${cy} Q${cx} ${cy + 2} ${cx + 17} ${cy}`} stroke="#9a3b2e" strokeWidth="1.2" fill="none" />}
      {a.lips === 'teeth-lip' && (
        <rect x={cx - 10} y={cy - 4} width="20" height="5" rx="1" fill="#fff" stroke="#94a3b8" strokeWidth="0.6" />
      )}
    </svg>
  );
}

/** The plain-words reading of a shape — one row per thing to do. */
function describe(a: Articulation): { key: string; label: string; value: string }[] {
  const rows: { key: string; label: string; value: string }[] = [];

  rows.push({
    key: 'jaw',
    label: 'الفم',
    value: a.lips === 'closed' ? 'مغلق' : a.jaw < 0.25 ? 'شبه مغلق' : a.jaw < 0.55 ? 'نصف مفتوح' : 'مفتوح واسعاً',
  });

  rows.push({
    key: 'lips',
    label: 'الشفتان',
    value: {
      spread: 'مشدودتان كالابتسامة',
      neutral: 'مسترخيتان',
      rounded: 'مستديرتان ومدفوعتان للأمام',
      open: 'مفتوحتان',
      closed: 'مطبقتان، ثم تنفتحان',
      'teeth-lip': 'الأسنان العليا على الشفة السفلى',
    }[a.lips],
  });

  let tongue: string;
  if (a.kind === 'vowel' && a.tongue) {
    const { height, back } = a.tongue;
    // Four steps, not three: /ɪ/ and /iː/ differ by exactly this one
    const h = height < 0.15 ? 'مرتفع' : height < 0.4 ? 'مرتفع قليلاً' : height < 0.65 ? 'في الوسط' : 'منخفض';
    const b = back < 0.35 ? 'في الأمام' : back < 0.65 ? 'في الوسط' : 'في الخلف';
    tongue = h === 'في الوسط' && b === 'في الوسط' ? 'في وسط الفم، مسترخٍ' : `${h} ${b}`;
  } else {
    tongue = {
      rest: 'مسترخٍ في قاع الفم',
      dental: 'طرفه بين الأسنان — أخرجه قليلاً',
      alveolar: 'طرفه يلمس اللثة خلف الأسنان العليا',
      'alveolar-near': 'طرفه قريب من اللثة، والهواء يصفر بينهما',
      velar: 'مؤخّرته ترتفع وتلمس سقف الحلق الخلفي',
    }[a.contact ?? 'rest'];
  }
  rows.push({ key: 'tongue', label: 'اللسان', value: tongue });

  if (a.kind === 'vowel') {
    rows.push({ key: 'length', label: 'الطول', value: a.glide ? 'متحرّك' : a.long ? 'ممدود ومشدود' : 'قصير ومسترخٍ' });
  } else {
    rows.push({ key: 'voice', label: 'الحلق', value: a.voiced ? 'يهتزّ — ضع يدك على حلقك تشعر به' : 'لا يهتزّ — هواء فقط' });
  }

  if (a.aspirated) rows.push({ key: 'air', label: 'الهواء', value: 'نفخة عند الخروج — ورقةٌ أمام فمك تتحرّك' });
  if (a.nasal) rows.push({ key: 'air', label: 'الهواء', value: 'يخرج من الأنف' });

  return rows;
}

interface Props {
  /** One sound, or two to compare — differences are highlighted */
  sounds: (string | Articulation)[];
  /** A word for each sound; tapping its card says it */
  words?: (string | undefined)[];
  onSay?: (word: string) => void;
}

export default function MouthDiagram({ sounds, words, onSay }: Props) {
  const tr = useT();
  const list = sounds
    .map((s) => (typeof s === 'string' ? ARTICULATION[s] : s))
    .filter(Boolean)
    .slice(0, 2);

  // Diphthongs glide: alternate between the start and the end shape
  const [phase, setPhase] = useState(false);
  const gliding = list.some((a) => a.glide);
  useEffect(() => {
    if (!gliding || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setPhase((p) => !p), 900);
    return () => window.clearInterval(id);
  }, [gliding]);

  if (list.length === 0) return null;

  const shown = list.map((a) => (phase && a.glide && ARTICULATION[a.glide] ? { ...ARTICULATION[a.glide], ipa: a.ipa, glide: a.glide, near_ar: a.near_ar } : a));
  const rows = list.map(describe);

  // In a comparison, a row is worth reading only where the two differ
  const differs = (key: string) =>
    list.length === 2 &&
    rows[0].find((r) => r.key === key)?.value !== rows[1].find((r) => r.key === key)?.value;

  return (
    <div className={`grid gap-3 ${list.length === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:max-w-xs'}`}>
      {list.map((a, i) => {
        const word = words?.[i];
        const say = word && onSay ? () => onSay(word) : undefined;

        return (
          <div key={a.ipa} className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
            <button
              type="button"
              onClick={say}
              disabled={!say}
              className="flex w-full items-center justify-between gap-2 bg-violet-50 px-3 py-1.5 text-start
                         enabled:hover:bg-violet-100"
            >
              <span className="font-mono text-base font-bold text-violet-800" dir="ltr">/{a.ipa}/</span>
              {word && (
                <span className="flex items-center gap-1 text-sm font-medium text-slate-700" dir="ltr">
                  {say && <Volume2 aria-hidden size={14} />}
                  {word}
                </span>
              )}
            </button>

            <div className="relative px-2 pt-2">
              <SideView a={shown[i]} ghost={list.length === 2 ? shown[1 - i] : undefined} />
              {/* Physical right, not `end`: the face is drawn on the left in
                  every locale. Top, over the skull — the throat below
                  carries the voicing mark. */}
              <div className="absolute top-2 right-2 w-[34%] rounded-lg bg-white/90 p-0.5 ring-1 ring-slate-200">
                <FrontView a={shown[i]} />
              </div>
            </div>

            {a.glide && (
              <p className="px-3 pt-1 text-xs text-violet-700">
                {tr('يبدأ هكذا ثم ينزلق إلى')} {iso(`/${a.glide}/`)}
              </p>
            )}

            <dl className="space-y-1 px-3 py-2 text-xs">
              {rows[i].map((r) => (
                <div
                  key={r.key + r.value}
                  className={`flex gap-1.5 rounded px-1 ${differs(r.key) ? 'bg-amber-100 font-semibold text-amber-900 ring-1 ring-amber-200' : 'text-slate-600'}`}
                >
                  <dt className="shrink-0 text-slate-400">{tr(r.label)}:</dt>
                  <dd>{tr(r.value)}</dd>
                </div>
              ))}
            </dl>

            <p className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-xs leading-relaxed text-slate-700">
              {a.near_ar}
            </p>
          </div>
        );
      })}

      {list.length === 2 && (
        <p className="col-span-2 text-center text-xs text-slate-500">
          {tr('المظلَّل بالأصفر هو الفرق، وما عداه واحد في الصوتين. والخطّ المتقطّع هو لسان الصوت الآخر.')}
        </p>
      )}
    </div>
  );
}
