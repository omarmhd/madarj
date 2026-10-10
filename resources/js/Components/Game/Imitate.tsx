import { useMemo, useState } from 'react';
import axios from 'axios';
import { Check, Circle, Lightbulb, PenLine } from 'lucide-react';
import Listen from '@/Components/Listen';
import Bdi from '@/Components/Bdi';
import { hasArabic } from '@/lib/spelling';
import { useT } from '@/lib/i18n';

/**
 * Write one like it — a short model, then the learner's own version.
 *
 * The week's writing task is one long piece on day 7, and before it the
 * learner wrote nothing. Imitation is how a beginner writes at all: a
 * model of three or four sentences, one pattern in it, and a prompt
 * that changes only the facts. Each day has its own model, tied to
 * that day's words and grammar.
 *
 * ── The small words ─────────────────────────────────────────
 * A model uses words the course has not taught yet — `in`, `the`,
 * `an`, `too`. A learner who copies them without knowing why copies
 * them wrong in the next sentence. Each model carries a one-line note
 * for those words, and where a later week teaches the rule in full,
 * the note says which.
 *
 * ── Checking ────────────────────────────────────────────────
 * Free writing is not graded (§6.3, `free_text`). What can be checked
 * mechanically is checked live — a capital at the start, a full stop at
 * the end, `I` as a capital — because those are the slips Arabic gives
 * no warning about: it has no capital letters at all.
 */

export interface ImitateItem {
  day: number;
  title_ar: string;
  model: { en: string; ar: string }[];
  pattern_en?: string | null;
  prompt_ar: string;
  min_sentences: number;
  notes: { word: string; ar: string }[];
  check_ar?: string[];
}

interface Props {
  weekNumber: number;
  item: ImitateItem;
  /** Everything saved for this week, by day — the save sends all of it back */
  saved: Record<string, string> | null;
  onProgress?: (done: number, total: number) => void;
}

/** Sentences as the learner wrote them — split after . ! ? */
function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => /[a-z]/i.test(s));
}

export default function Imitate({ weekNumber, item, saved, onProgress }: Props) {
  const tr = useT();
  const key = `day${item.day}`;

  const [text, setText] = useState(saved?.[key] ?? '');
  const [savedText, setSavedText] = useState(saved?.[key] ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const sentences = useMemo(() => sentencesOf(text), [text]);

  const checks = useMemo(() => {
    const list = [
      {
        ok: sentences.length >= item.min_sentences,
        label: tr('كتبت :n جمل على الأقل', { n: item.min_sentences }),
      },
      {
        ok: sentences.length > 0 && sentences.every((s) => /^[A-Z0-9"']/.test(s)),
        label: tr('كل جملة تبدأ بحرف كبير'),
      },
      {
        ok: sentences.length > 0 && sentences.every((s) => /[.!?]$/.test(s)),
        label: tr('كل جملة تنتهي بنقطة . أو علامة ?'),
      },
      {
        ok: sentences.length > 0 && !/(^|[^a-z'])i([^a-z'])/.test(text),
        label: tr('كلمة I (أنا) بحرف كبير دائماً'),
      },
    ];

    return list;
  }, [sentences, text, item.min_sentences, tr]);

  const arabicInside = hasArabic(text);
  const allOk = checks.every((c) => c.ok) && !arabicInside;
  const dirty = text.trim() !== savedText.trim();

  const save = async () => {
    setSaving(true);
    setError(false);

    try {
      await axios.post(`/week/${weekNumber}/notes`, {
        kind: 'imitate',
        answers: { ...(saved ?? {}), [key]: text.trim() },
      });
      setSavedText(text.trim());
      onProgress?.(1, 1);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. The model */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <p className="mb-3 text-sm font-semibold text-slate-800">{tr('النموذج — اقرأه واسمعه')}</p>

        <div className="space-y-2.5">
          {item.model.map((m, i) => (
            <div key={i} className="flex items-start gap-2">
              <Listen text={m.en} size="sm" />
              <div className="min-w-0">
                <p className="text-lg font-medium leading-relaxed text-slate-900" dir="ltr">
                  {m.en}
                </p>
                <p className="text-sm leading-relaxed text-slate-500">{m.ar}</p>
              </div>
            </div>
          ))}
        </div>

        {item.pattern_en && (
          <div className="mt-4 rounded-lg bg-violet-50 p-3">
            <p className="text-sm text-violet-800">{tr('القالب:')}</p>
            <p className="mt-0.5 font-mono text-base font-semibold text-violet-900" dir="ltr">
              {item.pattern_en}
            </p>
          </div>
        )}
      </div>

      {/* 2. The small words in the model, before they are copied */}
      {item.notes.length > 0 && (
        <div className="rounded-xl bg-amber-50/70 p-4 ring-1 ring-amber-200">
          <p className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <Lightbulb aria-hidden size={16} /> {tr('كلمات صغيرة في النموذج — متى تُستعمل؟')}
          </p>
          <ul className="space-y-2">
            {item.notes.map((n) => (
              <li key={n.word} className="flex gap-2.5 text-sm leading-relaxed text-slate-800">
                <span
                  className="h-fit shrink-0 rounded-md bg-white px-2 py-0.5 font-semibold text-amber-800 ring-1 ring-amber-200"
                  dir="ltr"
                >
                  {n.word}
                </span>
                <span>{n.ar}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Their version */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <p className="flex items-center gap-1.5 font-semibold text-slate-900">
          <PenLine aria-hidden size={16} className="text-violet-600" /> {tr('اكتب مثله')}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{item.prompt_ar}</p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          dir="ltr"
          lang="en"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Write here…"
          className="ruled mt-3 w-full resize-y text-base"
        />

        {arabicInside && (
          <p className="mt-1 text-sm text-amber-700">
            {tr('في النص حروف عربية. اكتب بالإنجليزية فقط.')}
          </p>
        )}

        {/* Live checks — what a machine can see without judging the content */}
        <ul className="mt-3 space-y-1.5">
          {checks.map((c, i) => (
            <li
              key={i}
              className={`flex items-center gap-2 text-sm ${c.ok ? 'text-emerald-700' : 'text-slate-500'}`}
            >
              {c.ok ? <Check aria-hidden size={16} /> : <Circle aria-hidden size={14} />}
              {c.label}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {tr(':n جمل', { n: sentences.length })}
          </p>
          {dirty ? (
            <button
              onClick={save}
              disabled={saving || text.trim() === ''}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white
                         transition hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? tr('يحفظ…') : tr('احفظ')}
            </button>
          ) : savedText ? (
            <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
              <Check aria-hidden size={15} /> {tr('محفوظ')}
            </span>
          ) : null}
        </div>

        {error && (
          <p className="mt-2 text-sm text-rose-700">{tr('لم يُحفظ. تحقّق من الاتصال وحاول مرة أخرى.')}</p>
        )}
      </div>

      {/* 4. Compare — after writing, never before */}
      {savedText && (
        <div className="rounded-xl bg-emerald-50/60 p-4 ring-1 ring-emerald-200">
          <p className="text-sm font-semibold text-emerald-900">
            {allOk ? tr('أحسنت. الآن قارن جملك بالنموذج:') : tr('قارن جملك بالنموذج:')}
          </p>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-emerald-900">
            {(item.check_ar ?? []).map((c, i) => (
              <li key={i}>• {c}</li>
            ))}
            <li>
              • {tr('اقرأ جملك بصوت عالٍ. هل تشبه')} <Bdi>{item.pattern_en ?? item.model[0]?.en}</Bdi>{tr('؟')}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
