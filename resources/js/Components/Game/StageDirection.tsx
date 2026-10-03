/**
 * A scene break inside a dialogue.
 *
 * ── Why a dialogue has lines with no speaker ────────────────
 * Some conversations in the book change scene halfway: `(the next
 * day)`, `(later)`. The book writes them as a row whose speaker
 * column is an em dash, and the extractor now carries them through
 * with an empty speaker rather than stopping there — which is what
 * used to cut week 11's first dialogue in half.
 *
 * ── Why they cannot be chat bubbles ────────────────────────
 * A turn belongs to somebody. Rendered as a turn, a stage direction
 * came out as a blue avatar with no initial in it, sitting in the
 * conversation as if a nameless third person had spoken. It is not
 * speech — it is the passage of time — so it reads as a divider and
 * is skipped when the dialogue is played aloud.
 */
export default function StageDirection({ en, ar }: { en: string; ar: string }) {
  return (
    <div className="flex items-center gap-3 py-1" role="separator">
      <span className="h-px flex-1 bg-slate-200" />

      <span className="text-center text-xs leading-relaxed text-slate-500">
        <span dir="ltr">{en}</span>
        {ar && <span className="mx-1.5 text-slate-300">·</span>}
        {ar}
      </span>

      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
