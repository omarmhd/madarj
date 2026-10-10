import { useState } from 'react';
import axios from 'axios';
import { Check, House } from 'lucide-react';
import Listen from '@/Components/Listen';
import { useT } from '@/lib/i18n';

/**
 * The day's homework — one task done away from the screen.
 *
 * It replaced Break Time. Seven kinds turn through the week, each
 * filled with that day's words or dialogue by the server. The proof is
 * a short written line: more honest than a ticked box, and the server
 * will not mark the task done without it.
 */

export interface HomeworkData {
  kind: 'label' | 'teach' | 'dialogue' | 'sentences' | 'hunt' | 'speak' | 'message';
  day: number;
  words: { word: string; arabic: string }[];
  dialogue: { title: string; lines: { speaker: string; en: string }[] } | null;
}

interface Props {
  weekNumber: number;
  data: HomeworkData;
  /** Everything saved for this week, by day — the save sends all of it back */
  saved: Record<string, string> | null;
  onSaved?: (text: string) => void;
}

const KINDS: Record<HomeworkData['kind'], { title: string; steps: string[]; proof: string; ltr: boolean }> = {
  label: {
    title: 'سمِّ أشياء بيتك',
    steps: [
      'اكتب كل كلمة من الكلمات أدناه على ورقة صغيرة.',
      'الصق كل ورقة على الشيء الذي تعنيه، أو ضعها حيث تراها كل يوم.',
      'قل الكلمة بصوت عالٍ كلما مررت بها اليوم.',
    ],
    proof: 'اكتب الكلمات التي ألصقتها، وأين وضعت كل واحدة.',
    ltr: false,
  },
  teach: {
    title: 'علّم شخصاً في بيتك',
    steps: [
      'اختر شخصاً من عائلتك أو صديقاً.',
      'علّمه الكلمات الثلاث أدناه: النطق والمعنى.',
      'اطلب منه أن يقولها لك بعد ساعة.',
    ],
    proof: 'من علّمت؟ وأي كلمة تذكّرها، وأيها نسي؟',
    ltr: false,
  },
  dialogue: {
    title: 'مثّل الحوار',
    steps: [
      'اقرأ الحوار أدناه بصوت عالٍ مع شخص في بيتك. كل واحد يأخذ دوراً.',
      'إن كنت وحدك، اقرأ الدورين بصوتين مختلفين.',
      'أعده مرتين، وفي الثانية لا تنظر إلى النص كثيراً.',
    ],
    proof: 'أي سطر كان أصعب عليك؟ اكتبه.',
    ltr: false,
  },
  sentences: {
    title: 'جمل من يومك',
    steps: [
      'خذ ورقة وقلماً بعيداً عن الشاشة.',
      'اكتب 3 جمل صحيحة عن يومك الحقيقي، واستعمل فيها قاعدة اليوم وكلماته.',
      'اقرأها بصوت عالٍ، ثم انقلها هنا.',
    ],
    proof: 'اكتب جملك الثلاث بالإنجليزية.',
    ltr: true,
  },
  hunt: {
    title: 'صيد الإنجليزية',
    steps: [
      'ابحث حولك عن كلمات إنجليزية: على علب الطعام، واللافتات، وهاتفك.',
      'اجمع 5 كلمات لا تعرفها أو لم تنتبه لها من قبل.',
      'ابحث عن معنى كل واحدة.',
    ],
    proof: 'اكتب الكلمات الخمس ومعانيها: word = معنى',
    ltr: false,
  },
  speak: {
    title: 'تكلّم دقيقة',
    steps: [
      'افتح مسجّل الصوت في جوالك.',
      'تكلّم دقيقة كاملة عن موضوع هذا اليوم. استعمل كلمات اليوم.',
      'اسمع تسجيلك مرة واحدة.',
    ],
    proof: 'أي كلمة توقّفت عندها أو لم تعرف كيف تقولها؟',
    ltr: false,
  },
  message: {
    title: 'رسالة عن أسبوعك',
    steps: [
      'اكتب 5 جمل بالإنجليزية عن أسبوعك: ماذا تعلّمت، وماذا كان صعباً.',
      'أرسلها إلى صديق أو قريب، أو احفظها لنفسك.',
    ],
    proof: 'الصق رسالتك هنا.',
    ltr: true,
  },
};

export default function Homework({ weekNumber, data, saved, onSaved }: Props) {
  const tr = useT();
  const key = `day${data.day}`;
  const info = KINDS[data.kind];

  const [text, setText] = useState(saved?.[key] ?? '');
  const [savedText, setSavedText] = useState(saved?.[key] ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(false);
    try {
      await axios.post(`/week/${weekNumber}/notes`, {
        kind: 'homework',
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

  const ready = text.trim().length >= 3;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-violet-50 p-4">
        <p className="flex items-center gap-2 font-semibold text-violet-900">
          <House aria-hidden size={18} /> {tr(info.title)}
        </p>
        <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-violet-900">
          {info.steps.map((s, i) => (
            <li key={i}>{i + 1}. {tr(s)}</li>
          ))}
        </ol>
      </div>

      {/* Today's material */}
      {data.kind === 'dialogue' && data.dialogue ? (
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
      ) : (
        ['label', 'teach', 'sentences', 'speak'].includes(data.kind) && data.words.length > 0 && (
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
        )
      )}

      {/* The proof */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <p className="font-semibold text-slate-900">{tr('بعد أن تنجزه')}</p>
        <p className="mt-1 text-sm text-slate-600">{tr(info.proof)}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          dir={info.ltr ? 'ltr' : 'auto'}
          spellCheck={false}
          autoCorrect="off"
          className="ruled mt-3 w-full resize-y text-base"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">{tr('الواجب شرط لإنهاء اليوم.')}</p>
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
