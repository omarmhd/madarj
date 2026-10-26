import { useState } from 'react';
import axios from 'axios';
import { Check, Clapperboard, Copy, Eye, Search } from 'lucide-react';
import Bdi from '@/Components/Bdi';
import { useT } from '@/lib/i18n';

/**
 * حلقة اليوم — a short official episode in place of shadowing.
 *
 * No player and no link: the learner gets the search phrase and the
 * channel's name, and finds the episode in YouTube themselves. The
 * platform is paid, and YouTube's API policies (III.F.3a) forbid
 * charging users to watch in an embedded player; the owner chose to
 * keep the platform free of YouTube altogether. The phrase was checked
 * to bring the episode up first (`watch:check` keeps the videos alive).
 *
 * The series runs on from day to day, so tomorrow has something to
 * come back for. The written proof is required: the server will not
 * mark the station without it.
 */

export interface WatchData {
  day: number;
  /** What to type in YouTube's search box */
  search: string;
  title: string;
  number: number;
  series: { title: string; part_ar: string; channel: string; about_ar: string };
  /** English captions on from the start — the first two units */
  captions: boolean;
  steps: string[];
  proof: string;
}

interface Props {
  weekNumber: number;
  data: WatchData;
  /** Everything saved for this week, by day — the save sends all of it back */
  saved: Record<string, string> | null;
  onSaved?: (text: string) => void;
}

export default function Watch({ weekNumber, data, saved, onSaved }: Props) {
  const tr = useT();
  const key = `day${data.day}`;

  const [text, setText] = useState(saved?.[key] ?? '');
  const [savedText, setSavedText] = useState(saved?.[key] ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  // The proof must hold English: a line heard, not a line about it
  const ready = /[A-Za-z]{2,}/.test(text);

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.search);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (an old browser, or no permission): the phrase stays on screen to type
    }
  };

  const save = async () => {
    setSaving(true);
    setError(false);
    try {
      await axios.post(`/week/${weekNumber}/notes`, {
        kind: 'watch',
        answers: { ...(saved ?? {}), [key]: text.trim() },
      });
      setSavedText(text.trim());
      onSaved?.(text.trim());
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* The series, then today's episode */}
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-violet-600 text-white">
          <Clapperboard aria-hidden size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-violet-700">
            <span dir="ltr">{data.series.title}</span> · {data.series.part_ar}
          </p>
          <p className="text-lg font-bold text-slate-900" dir="ltr">
            {data.series.title === 'English at Work' ? 'Episode' : 'Lesson'} {data.number}
            {data.title ? `: ${data.title}` : ''}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{data.series.about_ar}</p>
        </div>
      </div>

      {/* What to search for, and whose video to pick */}
      <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Search aria-hidden size={16} /> {tr('اكتب هذا في بحث يوتيوب')}
        </p>
        <div className="mt-3 flex items-stretch gap-2">
          <p className="min-w-0 flex-1 select-all rounded-xl bg-white/10 px-3 py-3 font-mono text-base leading-snug" dir="ltr">
            {data.search}
          </p>
          <button
            onClick={copy}
            aria-label={tr('انسخ')}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-slate-900
                       transition hover:bg-slate-100 active:scale-95"
          >
            {copied ? <Check aria-hidden size={16} className="text-emerald-600" /> : <Copy aria-hidden size={16} />}
            {copied ? tr('نُسخت') : tr('انسخ')}
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          {tr('اختر الفيديو الذي قناته')} <span className="font-semibold text-white"><Bdi>{data.series.channel}</Bdi></span>
          {data.captions ? ` — ${tr('وشغّل الترجمة الإنجليزية من زرّ CC.')}` : '.'}
        </p>
      </div>

      <ol className="space-y-2 rounded-2xl bg-violet-50 p-5 text-sm leading-relaxed text-violet-900">
        {data.steps.map((s, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-violet-700">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      {/* The proof */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <p className="flex items-center gap-2 font-semibold text-slate-900">
          <Eye aria-hidden size={16} className="text-violet-600" /> {tr('بعد المشاهدة')}
        </p>
        <p className="mt-1 text-sm text-slate-600">{data.proof}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          dir="auto"
          spellCheck={false}
          autoCorrect="off"
          className="ruled mt-3 w-full resize-y text-base"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">{tr('الحلقة شرط لإنهاء اليوم.')}</p>
          {text.trim() !== savedText.trim() ? (
            <button
              onClick={save}
              disabled={saving || !ready}
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
        {text.trim() !== '' && !ready && (
          <p className="mt-2 text-sm text-amber-800">{tr('اكتب ما سمعته بالإنجليزية، ولو كلمات قليلة.')}</p>
        )}
        {error && <p className="mt-2 text-sm text-rose-700">{tr('لم يُحفظ. تحقّق من الاتصال وحاول مرة أخرى.')}</p>}
      </div>
    </div>
  );
}
