/**
 * The Madarij mark — three ascending steps.
 *
 * ── Why steps ───────────────────────────────────────────────
 * The name means "ascending stages". The course is exactly that:
 * twenty-four weeks, four modules, A1 to B1 — a staircase, not a
 * game board. The mark says so before a single word is read.
 *
 * ── Why inline SVG ──────────────────────────────────────────
 * No image file, no icon library. The platform is free and every
 * kilobyte ships a thousand times, so the logo is 400 bytes of
 * markup that scales to any size and inherits the current colour.
 */
export default function BrandMark({
  size = 32,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label="مَدارِج"
      className={`shrink-0 ${className}`}
    >
      {/* Three steps rising from the baseline — each one a module */}
      <rect x="3" y="20" width="7.5" height="9" rx="2" fill="currentColor" opacity=".45" />
      <rect x="12.25" y="14" width="7.5" height="15" rx="2" fill="currentColor" opacity=".7" />
      <rect x="21.5" y="6" width="7.5" height="23" rx="2" fill="currentColor" />
    </svg>
  );
}
