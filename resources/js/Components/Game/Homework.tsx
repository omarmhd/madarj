import { useState } from 'react';
import axios from 'axios';
import {
  BookOpen, Check, Compass, Hash, Headphones, HelpCircle, Image, Languages, List, Mail, MailOpen, Map,
  MessagesSquare, Mic, Moon, Newspaper, Scale, Search, Sparkles, StickyNote, Tag, Timer, Users,
  type LucideIcon,
} from 'lucide-react';
import Listen from '@/Components/Listen';
import { useT } from '@/lib/i18n';

/**
 * مغامرة اليوم — the day's last station, done away from the screen.
 *
 * Two adventures a day, from `content/adventures.json`: a quiet one
 * (alone, on paper, in your head) and a bold one (a voice, another
 * person). Choosing makes it yours; it stays required, and the server
 * will not mark it done without the written proof.
 *
 * On day 7 the quiet choice is a letter to your future self, and the
 * next review week hands those letters back to be answered.
 */

export interface Adventure {
  key: string;
  tone: 'quiet' | 'bold';
  icon: string | null;
  title: string;
  steps: string[];
  proof: string;
  ltr: boolean;
  uses: 'words' | 'dialogue' | null;
}

export interface HomeworkData {
  day: number;
  options: Adventure[];
  words: { word: string; arabic: string }[];
  dialogue: { title: string; lines: { speaker: string; en: string }[] } | null;
  letters: { week: number; text: string }[];
}

interface Props {
  weekNumber: number;
  data: HomeworkData;
  /** Everything saved for this week, by day — the save sends all of it back */
  saved: Record<string, string> | null;
  onSaved?: (text: string) => void;
}

const ICONS: Record<string, LucideIcon> = {
  tag: Tag, sticky: StickyNote, search: Search, moon: Moon, image: Image, list: List, hash: Hash,
  headphones: Headphones, book: BookOpen, languages: Languages, newspaper: Newspaper, users: Users,
  messages: MessagesSquare, mic: Mic, map: Map, help: HelpCircle, timer: Timer, sparkles: Sparkles,
  scale: Scale, mail: Mail, 'mail-open': MailOpen,
};

const TONE = {
  quiet: { label: 'هادئة', hint: 'وحدك، بهدوء', ring: 'ring-sky-200', badge: 'bg-sky-50 text-sky-800' },
  bold: { label: 'جريئة', hint: 'بصوتك أو مع شخص', ring: 'ring-violet-300', badge: 'bg-violet-100 text-violet-800' },
};

export default function Homework({ weekNumber, data, saved, onSaved }: Props) {
  const tr = useT();
  const key = `day${data.day}`;

  const [chosen, setChosen] = useState<string | null>(saved?.[`${key}_kind`] ?? null);
  const [text, setText] = useState(saved?.[key] ?? '');
  const [savedText, setSavedText] = useState(saved?.[key] ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const adventure = data.options.find((o) => o.key === chosen) ?? null;

  const save = async () => {
    if (!adventure) return;
    setSaving(true);
    setError(false);
    try {
      await axios.post(`/week/${weekNumber}/notes`, {
        kind: 'homework',
        answers: { ...(saved ?? {}), [key]: text.trim(), [`${key}_kind`]: adventure.key },
      });
      setSavedText(text.trim());
      onSaved?.(text.trim());
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- choose ---------- */
  if (!adventure) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <Compass aria-hidden size={30} strokeWidth={1.5} className="mx-auto text-violet-600" />
          <p className="mt-2 text-lg font-bold text-slate-900">{tr('اختر مغامرتك')}</p>
          <p className="mt-1 text-sm text-slate-600">{tr('واحدة من اثنتين. تنفّذها بعيداً عن الشاشة، ثم تعود وتكتب ما فعلت.')}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {data.options.map((o) => {
            const Icon = (o.icon && ICONS[o.icon]) || Sparkles;
            const t = TONE[o.tone];
            return (
              <button
                key={o.key}
                onClick={() => setChosen(o.key)}
                className={`group flex flex-col items-start gap-3 rounded-2xl bg-white p-5 text-start ring-2 ${t.ring}
                            transition hover:-translate-y-0.5 hover:shadow-md active:scale-[.99]`}
              >
                <span className="flex w-full items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-violet-600 text-white">
                    <Icon aria-hidden size={22} />
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.badge}`}>
                    {tr(t.label)} · {tr(t.hint)}
                  </span>
                </span>
                <span className="text-lg font-bold text-slate-900">{o.title}</span>
                <span className="text-sm leading-relaxed text-slate-600">{o.steps[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------- the chosen adventure ---------- */
  const Icon = (adventure.icon && ICONS[adventure.icon]) || Sparkles;
  const ready = text.trim().length >= 3;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-violet-50 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-lg font-bold text-violet-900">
            <Icon aria-hidden size={20} /> {adventure.title}
          </p>
          {!savedText && (
            <button onClick={() => setChosen(null)} className="shrink-0 text-sm font-medium text-violet-700 underline">
              {tr('غيّرها')}
            </button>
          )}
        </div>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed text-violet-900">
          {adventure.steps.map((s, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-violet-700">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* The letters coming back — the capsule opened */}
      {adventure.key === 'open_capsule' && data.letters.length > 0 && (
        <div className="space-y-2">
          {data.letters.map((l) => (
            <div key={l.week} className="paper rounded-xl p-4">
              <p className="mb-1 text-xs font-semibold text-violet-700">{tr('رسالتك من الأسبوع')} {l.week}</p>
              <p className="whitespace-pre-line text-base leading-relaxed text-slate-800" dir="ltr">{l.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Today's material, when the adventure uses it */}
      {adventure.uses === 'words' && data.words.length > 0 && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <p className="mb-2 text-sm font-semibold text-slate-700">{tr('كلمات اليوم')}</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {data.words.map((w) => (
              <li key={w.word} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1">
                <span className="text-sm text-slate-600">{w.arabic}</span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900" dir="ltr">{w.word}</span>
                  <Listen text={w.word} size="sm" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {adventure.uses === 'dialogue' && data.dialogue && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <p className="mb-2 text-sm font-semibold text-slate-700" dir="ltr">{data.dialogue.title}</p>
          <div className="space-y-1.5" dir="ltr">
            {data.dialogue.lines.map((l, i) => (
              <p key={i} className="text-base leading-relaxed text-slate-800">
                <span className="me-2 text-sm font-bold text-slate-400">{l.speaker}:</span>
                {l.en}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* The proof */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <p className="font-semibold text-slate-900">{tr('بعد أن تنجزها')}</p>
        <p className="mt-1 text-sm text-slate-600">{adventure.proof}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          dir={adventure.ltr ? 'ltr' : 'auto'}
          spellCheck={false}
          autoCorrect="off"
          className="ruled mt-3 w-full resize-y text-base"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">{tr('المغامرة شرط لإنهاء اليوم.')}</p>
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
        {error && <p className="mt-2 text-sm text-rose-700">{tr('لم يُحفظ. تحقّق من الاتصال وحاول مرة أخرى.')}</p>}
      </div>
    </div>
  );
}
