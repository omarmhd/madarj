import { useState } from 'react';
import axios from 'axios';
import { Check, Clapperboard, ExternalLink, Eye, Play } from 'lucide-react';
import { useT } from '@/lib/i18n';

/**
 * حلقة اليوم — a short official episode in place of shadowing.
 *
 * A link out to YouTube, not an embedded player. The platform is paid,
 * and YouTube's API policies (III.F.3a) forbid charging users to watch
 * in an embedded player; a plain link is outside them. On a phone it
 * opens the YouTube app, where captions and speed are one tap away.
 *
 * The series runs on from day to day, so tomorrow has something to
 * come back for. The written proof is required: the server will not
 * mark the station without it.
 */

export interface WatchData {
  day: number;
  video: string;
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

  const href = `https://www.youtube.com/watch?v=${data.video}`;

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

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-4 rounded-2xl bg-slate-900 p-5 text-white shadow-sm
                   transition hover:bg-slate-800 active:scale-[.99]"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-rose-600 transition group-hover:scale-105">
          <Play aria-hidden size={26} className="ms-0.5" fill="currentColor" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold">{tr('شاهد الحلقة على يوتيوب')}</span>
          <span className="block text-sm text-slate-300">
            {data.captions ? tr('شغّل الترجمة الإنجليزية من زرّ CC.') : tr('تُفتح في يوتيوب، ثم عد إلى هنا.')}
          </span>
        </span>
        <ExternalLink aria-hidden size={18} className="shrink-0 text-slate-400" />
      </a>
      <p className="text-center text-xs text-slate-500" dir="ltr">{data.series.channel}</p>

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
