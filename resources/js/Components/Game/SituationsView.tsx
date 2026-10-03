import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import Listen from '@/Components/Listen';
import { useT } from '@/lib/i18n';

/**
 * Week 23 — the seven situations.
 *
 * ── Why this week needed its own view ───────────────────────
 * Every other week is built on two dialogues. This one is built on
 * seven role-plays instead: a job interview, a meeting, travel
 * trouble, the telephone, complaining, an emergency, small talk.
 * The importer found no §5–§6 and skipped the chapter's whole spine
 * — the week arrived with twenty words and nothing to do.
 *
 * ── One situation open at a time ────────────────────────────
 * Seven situations of tables and model answers is a wall. But they
 * are not a sequence — nobody works through them in order; they
 * open the one they are afraid of. So they are an accordion, and
 * the first is open so the screen is never blank.
 *
 * ── And what stays English ──────────────────────────────────
 * The tables and the model answers are what the learner has to say
 * out loud. Translating them turns a production task into a reading
 * comprehension. The Arabic names the situation and says when it is
 * needed; the English is the thing itself.
 */

interface Table {
  type: 'table';
  heading_en: string | null;
  head: string[];
  rows: string[][];
}

interface Prose {
  type: 'model' | 'note';
  heading_en: string | null;
  text_en: string;
  extra: string[];
}

type Block = Table | Prose;

interface Situation {
  number: number;
  title_en: string;
  title_ar: string;
  why_ar: string;
  blocks: Block[];
}

export default function SituationsView({
  payload,
}: {
  payload: { intro_ar?: string | null; items: Situation[] };
}) {
  const tr = useT();
  const [open, setOpen] = useState<number>(payload.items[0]?.number ?? 1);

  return (
    <div className="space-y-3">
      {payload.intro_ar && (
        <p className="rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-200">
          {payload.intro_ar}
        </p>
      )}

      {payload.items.map((s) => {
        const isOpen = open === s.number;

        return (
          <section
            key={s.number}
            className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
          >
            <button
              onClick={() => setOpen(isOpen ? -1 : s.number)}
              aria-expanded={isOpen}
              className="flex w-full items-start gap-3 p-4 text-start transition hover:bg-slate-50"
            >
              <span
                className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg
                           bg-violet-100 text-sm font-bold text-violet-700"
              >
                {s.number}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">{s.title_ar}</span>
                <span className="mt-0.5 block text-xs text-slate-400" dir="ltr">
                  {s.title_en}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-slate-600">
                  {s.why_ar}
                </span>
              </span>

              <span aria-hidden className="shrink-0 text-slate-400">
                {isOpen ? <ChevronUp aria-hidden size={16} /> : <ChevronDown aria-hidden size={16} />}
              </span>
            </button>

            {isOpen && (
              <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-4">
                {s.blocks.map((b, i) =>
                  b.type === 'table' ? (
                    <TableBlock key={i} block={b} />
                  ) : (
                    <ProseBlock key={i} block={b} />
                  ),
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** A reference table: scanned, not read — so it stays dense */
function TableBlock({ block }: { block: Table }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
      {block.heading_en && (
        <p className="mb-2 text-xs font-bold text-slate-800" dir="ltr">
          {block.heading_en}
        </p>
      )}

      {/* Wide content scrolls in its own box, never the page */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] text-sm" dir="ltr">
          <thead>
            <tr className="text-slate-500">
              {block.head.map((h, i) => (
                <th key={i} className="border-b border-slate-200 px-2 py-1.5 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {block.rows.map((row, i) => (
              <tr key={i} className="align-top">
                {row.map((cell, k) => (
                  <td
                    key={k}
                    className={`px-2 py-1.5 leading-relaxed ${
                      k === 0 ? 'font-medium text-slate-800' : 'text-slate-600'
                    }`}
                    // Arabic columns in the phrase tables must read right
                    dir={/[؀-ۿ]/.test(cell) ? 'rtl' : 'ltr'}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * A model answer or a piece of guidance.
 *
 * The model gets a listen button and room to breathe, because it is
 * meant to be said aloud three times. Guidance is just read.
 */
function ProseBlock({ block }: { block: Prose }) {
  const tr = useT();
  const isModel = block.type === 'model';

  return (
    <div
      className={`rounded-xl p-3 ring-1 ${
        isModel ? 'bg-violet-50/60 ring-violet-100' : 'bg-white ring-slate-200'
      }`}
    >
      {block.heading_en && (
        <p
          className={`mb-1.5 text-xs font-bold ${
            isModel ? 'text-violet-900' : 'text-slate-800'
          }`}
          dir="ltr"
        >
          {block.heading_en}
        </p>
      )}

      <p className="text-sm leading-relaxed text-slate-700" dir="ltr">
        {/* `//` marks a natural pause in the book's models */}
        {block.text_en.split('//').map((piece, i, all) => (
          <span key={i}>
            {piece.trim()}
            {i < all.length - 1 && (
              <span className="mx-1 text-violet-400" title={tr('قف هنا')}>
                ⏸
              </span>
            )}
          </span>
        ))}
      </p>

      {block.extra.map((line, i) => (
        <p key={i} className="mt-1.5 text-xs leading-relaxed text-slate-500" dir="ltr">
          {line}
        </p>
      ))}

      {isModel && (
        <div className="mt-2">
          <Listen text={block.text_en.replaceAll('//', ' ')} size="sm" />
        </div>
      )}
    </div>
  );
}
