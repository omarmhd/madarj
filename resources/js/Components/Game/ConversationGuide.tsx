import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';
import Listen from '@/Components/Listen';
import { useT } from '@/lib/i18n';

/**
 * Week 12 — Your First Real Conversation.
 *
 * ── The one section that teaches no English ─────────────────
 * It is the longest in the book and it is entirely about getting a
 * person to talk to: four ways to practise, what to tell an AI so it
 * trains you instead of flattering you, the phrases that keep you in a
 * conversation instead of nodding silently, and what to write down
 * afterwards. The book calls it the most important section so far.
 *
 * ── Folded, because reading it all at once is not the task ──
 * Printed, it runs several pages. Shown as one scroll it becomes a
 * wall nobody finishes. So the four paths are an accordion and the
 * rest is in order of use: what to do before, during, and after. The
 * learner opens the path they can afford and the part they are at.
 *
 * ── Two things here are not reading ─────────────────────────
 * The AI instructions are meant to be pasted into a chat, so they get
 * a copy button. The survival phrases are meant to be said, so they
 * get the same listen button as every other English line here. And
 * the debrief is a form: the book says write it immediately, and
 * something typed and lost is worse than paper.
 */

interface PathRow {
  code_en: string;
  code_ar: string;
  cost_ar: string;
  best_ar: string;
  weak_ar: string;
}

interface Table {
  head_ar: string[];
  rows: string[][];
}

interface PathDetail {
  code_ar: string;
  lead_ar: string;
  problem_ar?: string;
  rules_ar?: string[];
  closing_ar: string;
  table?: Table;
  prompt?: {
    start_label_ar: string;
    start_en: string[];
    roles_label_ar: string;
    roles_en: string[];
  };
  key_ar?: string;
  exercises_lead_ar?: string;
  exercises?: { name_ar: string; say_en: string; why_ar: string }[];
  limits_ar?: string;
  limits?: string[][];
  self_fix?: {
    title_ar: string;
    steps_ar: string[];
    link: { name: string; note_en: string | null; url: string };
  };
  links?: { name: string; note_en: string | null; url: string }[];
}

export interface ConversationPayload {
  intro_ar: string;
  choose: { lead_ar: string; combo_ar: string; paths: PathRow[] };
  paths: PathDetail[];
  plan: {
    title_ar: string;
    rows: { who_ar: string; what_ar: string; total_en: string }[];
    empty_ar: string;
  };
  before: { title_ar: string; steps_ar: string[] };
  phrases: { title_ar: string; note_ar: string; items: { when_ar: string; say_en: string }[] };
  during: { title_ar: string; rules_ar: string[] };
  fears: { title_ar: string; items: { fear_ar: string; truth_ar: string }[] };
  debrief: {
    title_ar: string;
    note_ar: string;
    questions_ar: string[];
    closing_ar: string;
  };
}

/** What comes back may be an array where it was sent as a map */
function asMap(value: unknown): Record<string, string> {
  if (value === null || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value)) as Record<string, string>;
}

export default function ConversationGuide({
  payload,
  saved,
  weekNumber,
}: {
  payload: ConversationPayload;
  saved: Record<string, string> | null;
  weekNumber: number;
}) {
  const tr = useT();

  const [openPath, setOpenPath] = useState<number>(-1);
  const [answers, setAnswers] = useState<Record<string, string>>(() => asMap(saved));
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const set = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setState('idle');
  };

  const send = (payload: Record<string, string>) => {
    setState('saving');

    axios
      .post(`/week/${weekNumber}/notes`, { kind: 'conversation', answers: payload })
      .then(() => setState('saved'))
      .catch(() => setState('idle'));
  };

  const save = () => send(answers);

  /**
   * Choosing a plan saves it on the spot.
   *
   * It used to only tint the row, and the single save button sat far
   * below inside the debrief card — so a learner who picked a plan and
   * did not also fill in a debrief lost the choice entirely, with
   * nothing on screen saying so. A click is one action and needs no
   * debounce, so it is written immediately.
   *
   * The row's text is stored beside its index, not just the index: the
   * plan is shown again on every later week, where this section's
   * content is not loaded, and what the learner committed to should be
   * the wording they actually read.
   */
  const choosePlan = (i: number, text: string) => {
    const chosen = answers.plan === String(i);

    const next = {
      ...answers,
      plan: chosen ? '' : String(i),
      plan_text: chosen ? '' : text,
    };

    setAnswers(next);
    send(next);
  };

  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-violet-50/60 p-4 text-sm leading-relaxed text-violet-950 ring-1 ring-violet-100">
        {payload.intro_ar}
      </p>

      {/* ── Which path ───────────────────────────────────────── */}
      <Card title={tr('أربع طرق للتدرّب على الكلام')}>
        <p className="text-sm leading-relaxed text-slate-700">{payload.choose.lead_ar}</p>

        <div className="mt-3 space-y-2">
          {payload.choose.paths.map((p) => (
            <div key={p.code_en} className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">
                {p.code_ar}
                <span className="ms-2 rounded-md bg-white px-1.5 py-0.5 text-xs font-medium text-slate-500">
                  {p.cost_ar}
                </span>
              </p>

              <p className="mt-1 text-sm leading-relaxed text-emerald-800"><Check aria-hidden size={15} className="inline-block align-[-3px]" /> {p.best_ar}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-rose-800"><X aria-hidden size={15} className="inline-block align-[-3px]" /> {p.weak_ar}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 rounded-lg border-s-4 border-violet-500 bg-violet-50/70 p-3 text-sm leading-relaxed text-violet-900">
          {payload.choose.combo_ar}
        </p>
      </Card>

      {/* ── Each path in detail ──────────────────────────────── */}
      {payload.paths.map((p, i) => {
        const open = openPath === i;

        return (
          <section
            key={i}
            className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
          >
            <button
              onClick={() => setOpenPath(open ? -1 : i)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 p-4 text-start transition hover:bg-slate-50"
            >
              <span className="flex-1 font-semibold text-slate-900">{p.code_ar}</span>
              <span aria-hidden className="text-slate-400">
                {open ? <ChevronUp aria-hidden size={16} /> : <ChevronDown aria-hidden size={16} />}
              </span>
            </button>

            {open && (
              <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-4">
                <p className="text-sm leading-relaxed text-slate-700">{p.lead_ar}</p>

                {p.table && <SmallTable table={p.table} />}

                {p.problem_ar && (
                  <p className="text-sm leading-relaxed text-slate-700">{p.problem_ar}</p>
                )}

                {p.rules_ar && <Numbered items={p.rules_ar} />}

                {/* The block that gets pasted into the chat */}
                {p.prompt && <PromptBlock prompt={p.prompt} tr={tr} />}

                {p.key_ar && (
                  <p className="rounded-lg border-s-4 border-amber-400 bg-amber-50/70 p-3 text-sm leading-relaxed text-amber-900">
                    {p.key_ar}
                  </p>
                )}

                {p.exercises_lead_ar && (
                  <p className="text-sm leading-relaxed text-slate-700">{p.exercises_lead_ar}</p>
                )}

                {p.exercises?.map((e, k) => (
                  <div key={k} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                    <p className="text-sm font-semibold text-slate-900">{e.name_ar}</p>

                    <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-700" dir="ltr">
                      {e.say_en}
                    </p>

                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{e.why_ar}</p>
                  </div>
                ))}

                {p.limits_ar && (
                  <p className="text-sm leading-relaxed text-slate-700">{p.limits_ar}</p>
                )}

                {p.limits?.map(([limit, why], k) => (
                  <div key={k} className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                    <p className="text-sm font-semibold text-slate-800">{limit}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{why}</p>
                  </div>
                ))}

                {p.self_fix && (
                  <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                    <p className="text-sm font-semibold text-slate-900">{p.self_fix.title_ar}</p>
                    <div className="mt-2">
                      <Numbered items={p.self_fix.steps_ar} />
                    </div>
                    <Links links={[p.self_fix.link]} />
                  </div>
                )}

                {p.links && <Links links={p.links} />}

                <p className="rounded-lg border-s-4 border-violet-500 bg-violet-50/70 p-3 text-sm leading-relaxed text-violet-900">
                  {p.closing_ar}
                </p>
              </div>
            )}
          </section>
        );
      })}

      {/* ── The weekly plan ──────────────────────────────────── */}
      <Card title={payload.plan.title_ar}>
        <div className="space-y-2">
          {payload.plan.rows.map((row, i) => {
            const chosen = answers.plan === String(i);

            return (
              <button
                key={i}
                onClick={() => choosePlan(i, row.what_ar)}
                className={`w-full rounded-xl p-3 text-start transition ring-1 ${
                  chosen
                    ? 'bg-violet-50 ring-violet-300'
                    : 'bg-slate-50 ring-transparent hover:bg-slate-100'
                }`}
              >
                <p className="text-sm font-semibold text-slate-500">
                  {row.who_ar}
                  <span className="ms-2 font-normal text-slate-400" dir="ltr">
                    {row.total_en}
                  </span>
                </p>

                <p className="mt-1 text-sm leading-relaxed text-slate-800">{row.what_ar}</p>
              </button>
            );
          })}
        </div>

        {answers.plan ? (
          <p className="mt-3 rounded-lg border-s-4 border-emerald-500 bg-emerald-50/70 p-3 text-sm leading-relaxed text-emerald-900">
            {state === 'saving'
              ? tr('نحفظ خطّتك…')
              : tr('هذه خطّتك الآن. ستظهر لك في أعلى كل أسبوع قادم لتتذكّرها، ويمكنك تغييرها من هنا متى شئت.')}
          </p>
        ) : (
          <p className="mt-3 rounded-lg border-s-4 border-rose-400 bg-rose-50/70 p-3 text-sm leading-relaxed text-rose-900">
            {payload.plan.empty_ar}
          </p>
        )}
      </Card>

      {/* ── Before ───────────────────────────────────────────── */}
      <Card title={payload.before.title_ar}>
        <Numbered items={payload.before.steps_ar} />
      </Card>

      {/* ── The phrases, spoken ──────────────────────────────── */}
      <Card title={payload.phrases.title_ar}>
        <div className="space-y-2">
          {payload.phrases.items.map((item, i) => (
            <div key={i} className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm text-slate-500">{item.when_ar}</p>

              <div className="mt-1 flex items-center gap-2">
                <p className="flex-1 text-sm font-medium text-slate-900" dir="ltr">
                  {item.say_en}
                </p>
                <Listen text={item.say_en} size="sm" />
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">{payload.phrases.note_ar}</p>
      </Card>

      {/* ── During ───────────────────────────────────────────── */}
      <Card title={payload.during.title_ar}>
        <Numbered items={payload.during.rules_ar} />
      </Card>

      {/* ── What you fear, and what happens ──────────────────── */}
      <Card title={payload.fears.title_ar}>
        <div className="space-y-2">
          {payload.fears.items.map((f, i) => (
            <div key={i} className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-500">«{f.fear_ar}»</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-800">{f.truth_ar}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── After: the debrief, written down ─────────────────── */}
      <Card title={payload.debrief.title_ar}>
        <p className="text-sm leading-relaxed text-slate-700">{payload.debrief.note_ar}</p>

        <div className="mt-3 space-y-3">
          {payload.debrief.questions_ar.map((q, i) => (
            <div key={i}>
              <p className="text-sm font-medium text-slate-600">{q}</p>

              <textarea
                rows={2}
                value={answers[String(i)] ?? ''}
                onChange={(e) => set(String(i), e.target.value)}
                className="ruled mt-1 text-sm"
              />
            </div>
          ))}
        </div>

        <button
          onClick={save}
          disabled={state === 'saving'}
          className="mt-3 w-full rounded-xl bg-violet-600 py-3 font-semibold text-white transition
                     hover:bg-violet-700 disabled:opacity-60"
        >
          {state === 'saving' ? tr('نحفظ…') : state === 'saved' ? tr('حُفظ') : tr('احفظ')}
        </button>

        <p className="mt-3 rounded-lg border-s-4 border-violet-500 bg-violet-50/70 p-3 text-sm leading-relaxed text-violet-900">
          {payload.debrief.closing_ar}
        </p>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="mb-3 font-semibold text-slate-900">{title}</p>
      {children}
    </section>
  );
}

function Numbered({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((text, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
          <span
            className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md
                       bg-violet-100 text-xs font-bold text-violet-700"
          >
            {i + 1}
          </span>
          <span className="flex-1">{text}</span>
        </li>
      ))}
    </ol>
  );
}

/** A reference table: scanned, not read, so it stays dense */
function SmallTable({ table }: { table: Table }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500">
            {table.head_ar.map((h, i) => (
              <th key={i} className="border-b border-slate-200 px-2 py-1.5 text-start font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {table.rows.map((row, i) => (
            <tr key={i} className="align-top">
              {row.map((c, k) => (
                <td
                  key={k}
                  className={`px-2 py-1.5 leading-relaxed ${
                    k === 0 ? 'font-medium text-slate-800' : 'text-slate-600'
                  }`}
                  // App names and links are Latin; the notes are Arabic
                  dir={/[؀-ۿ]/.test(c) ? 'rtl' : 'ltr'}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Links({ links }: { links: { name: string; note_en: string | null; url: string }[] }) {
  return (
    <div className="mt-2 space-y-1.5">
      {links.map((l, i) => (
        <p
          key={i}
          className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
          dir="ltr"
        >
          <span className="font-semibold text-slate-800">{l.name}</span>
          {l.note_en && <span className="text-slate-500"> — {l.note_en}</span>}
        </p>
      ))}
    </div>
  );
}

/**
 * The instructions given to an AI at the start of a conversation.
 *
 * Kept in the book's exact English because it is addressed to the
 * model, not to the learner, and copied rather than retyped — a
 * mistyped "do not simplify for me" is the whole point lost.
 */
function PromptBlock({
  prompt,
  tr,
}: {
  prompt: NonNullable<PathDetail['prompt']>;
  tr: (s: string) => string;
}) {
  const [copied, setCopied] = useState(false);

  const text = prompt.start_en.join('\n');

  const copy = () => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => {
        // Clipboard permission can be refused; the text is on screen
        // to select by hand, so this is not worth an error message
      },
    );
  };

  return (
    <div className="rounded-xl bg-slate-900 p-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm font-semibold text-slate-300">{prompt.start_label_ar}</p>

        <button
          onClick={copy}
          className="rounded-lg bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-100
                     transition hover:bg-slate-600"
        >
          {copied ? tr('نُسخ') : tr('انسخ')}
        </button>
      </div>

      <pre
        className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-emerald-300"
        dir="ltr"
      >
        {text}
      </pre>

      <p className="mt-3 text-sm font-semibold text-slate-300">{prompt.roles_label_ar}</p>

      <div className="mt-1.5 space-y-1">
        {prompt.roles_en.map((role, i) => (
          <p key={i} className="font-mono text-xs leading-relaxed text-sky-300" dir="ltr">
            {role}
          </p>
        ))}
      </div>
    </div>
  );
}
