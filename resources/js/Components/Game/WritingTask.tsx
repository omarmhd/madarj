import { Check, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useT } from '@/lib/i18n';

/**
 * مهمة الكتابة — §9 في كل فصل.
 *
 * بنية الكتاب: مهمة + قوالب جمل + نموذج إجابة.
 * القوالب هي جوهر القسم: المبتدئ لا يكتب من الصفر، فيُعطى هيكل
 * الجملة ويملأ ما ينقص. نقر القالب يُدرجه في النص مباشرة.
 *
 * قاعدتان من الكتاب مطبّقتان هنا:
 *   - النموذج لا يُكشف قبل بلوغ الحدّ الأدنى (من يراه أولاً ينسخه)
 *   - لا تصحيح آلي — تقييم ذاتي بعد المقارنة
 *
 * الحفظ تلقائي بعد التوقّف عن الكتابة، لأن المتدرّب قد يغلق الصفحة.
 */

export interface WritingTemplate {
  en: string;
  ar: string;
  note_ar?: string;
}

export interface WritingContent {
  title_ar: string;
  title_en: string;
  task_ar: string;
  task_en: string;
  min_words: number;
  templates: WritingTemplate[];
  target_errors?: { wrong: string; right: string }[];
  checklist?: { ar: string }[];
}

export interface MyWriting {
  body: string;
  word_count: number;
  self_score: number | null;
  model_seen: boolean;
}

interface Props {
  weekNumber: number;
  writing: WritingContent;
  existing?: MyWriting | null;
}

/** عدد الكلمات — نفس منطق الخادم، للعرض الفوري فقط */
function countWords(text: string): number {
  const t = text.trim().replace(/\s+/g, ' ');
  return t === '' ? 0 : t.split(' ').length;
}

export default function WritingTask({ weekNumber, writing, existing }: Props) {
  const tr = useT();
  const [body, setBody] = useState(existing?.body ?? '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [model, setModel] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [selfScore, setSelfScore] = useState<number | null>(existing?.self_score ?? null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimer = useRef<number | null>(null);

  const words = countWords(body);
  const enough = words >= writing.min_words;

  /** حفظ مؤجّل — بعد ثانية ونصف من آخر ضغطة */
  useEffect(() => {
    if (body === (existing?.body ?? '')) return;

    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    saveTimer.current = window.setTimeout(() => {
      setSaving(true);
      setError(null);

      axios
        .post(`/week/${weekNumber}/writing`, { body, self_score: selfScore })
        .then((r) => setSavedAt(r.data.saved_at))
        .catch(() => setError(tr('تعذّر الحفظ. تحقّق من الاتصال.')))
        .finally(() => setSaving(false));
    }, 1500);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, selfScore, weekNumber]);

  /** إدراج قالب في موضع المؤشر */
  const insertTemplate = (en: string) => {
    const el = textareaRef.current;
    const clean = en.split(' / ')[0];

    if (!el) {
      setBody((prev) => (prev ? prev + ' ' + clean : clean));
      return;
    }

    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const needsSpace = start > 0 && !/\s$/.test(body.slice(0, start));
    const insert = (needsSpace ? ' ' : '') + clean;

    const next = body.slice(0, start) + insert + body.slice(end);
    setBody(next);

    /*
     * المؤشّر على أول فراغ ليكتب مكانه فوراً.
     *
     * والفراغ ليس ثلاث شرطات دائماً: الأسبوع الأول يكتبه `___`
     * والثالث `____________`. وتحديد ثلاث من اثنتي عشرة يترك تسعاً
     * في نصّ المتدرّب بعد أن يكتب فوقها — فيُطابَق الفراغ كلّه.
     */
    window.setTimeout(() => {
      const blank = /_{2,}/.exec(next.slice(start));
      el.focus();

      if (blank) {
        const from = start + (blank.index ?? 0);
        el.setSelectionRange(from, from + blank[0].length);
      } else {
        el.setSelectionRange(start + insert.length, start + insert.length);
      }
    }, 0);
  };

  const revealModel = () => {
    setModelError(null);

    axios
      .post(`/week/${weekNumber}/writing/model`)
      .then((r) => setModel(r.data.model_answer))
      .catch((e) =>
        setModelError(e.response?.data?.reason ?? tr('تعذّر جلب النموذج.')),
      );
  };

  const allChecked =
    (writing.checklist?.length ?? 0) > 0 &&
    writing.checklist!.every((_, i) => checked[i]);

  return (
    <div className="space-y-5">
      {/* ============ المهمة ============ */}
      <div className="rounded-xl bg-gradient-to-bl from-violet-50 to-white p-5 ring-1 ring-violet-100">
        <h3 className="font-bold text-slate-900">{writing.title_ar}</h3>
        <p className="mt-0.5 text-xs text-slate-500" dir="ltr">
          {writing.title_en}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          {writing.task_ar}
        </p>
      </div>

      {/* ============ الأخطاء المستهدفة ============ */}
      {writing.target_errors && writing.target_errors.length > 0 && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <p className="mb-3 text-xs font-semibold text-slate-700">
            {tr('انتبه لهذه الأخطاء الثلاثة — هي سبب هذه المهمة')}
          </p>
          <div className="space-y-2">
            {writing.target_errors.map((e, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm" dir="ltr">
                <span className="rounded-md bg-rose-50 px-2 py-0.5 text-rose-700 line-through decoration-rose-300">
                  {e.wrong}
                </span>
                <span className="text-slate-400" aria-hidden>
                  →
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">
                  {e.right}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/*
        ============ قوالب الجمل ============
        أربعة أسابيع (17 و19 و20 و23) لها مهمّة كتابة بلا قوالب في
        الكتاب. وكان العنوان يظهر فوق صندوق فارغ، فيقرأ المتدرّب
        «انقر لإدراج القالب» ولا يجد ما ينقره — وهذا ما يُبلَّغ عنه
        بأنّه «لا يعمل». فالقسم كلّه يختفي حين لا قوالب.
      */}
      {writing.templates.length > 0 && (
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-xs font-semibold text-slate-700">
            {tr('قوالب الجمل — انقر لإدراج القالب')}
          </p>
          <p className="text-xs text-slate-400">{tr('لا تكتب من الصفر')}</p>
        </div>

        <div className="space-y-2">
          {writing.templates.map((t, i) => (
            <button
              key={i}
              onClick={() => insertTemplate(t.en)}
              className="group flex w-full items-start justify-between gap-3 rounded-lg
                         bg-slate-50 px-3 py-2 text-start transition
                         hover:bg-violet-50 hover:ring-1 hover:ring-violet-200"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800" dir="ltr">
                  {t.en}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{t.ar}</p>
                {t.note_ar && (
                  <p className="mt-1 text-xs text-amber-700"><TriangleAlert aria-hidden size={13} className="inline-block align-[-2px]" /> {t.note_ar}</p>
                )}
              </div>
              <span
                className="mt-1 shrink-0 rounded-md bg-white px-1.5 py-0.5 text-xs
                           text-slate-400 ring-1 ring-slate-200
                           transition group-hover:bg-violet-600 group-hover:text-white
                           group-hover:ring-violet-600"
              >
                {tr('إدراج')}
              </span>
            </button>
          ))}
        </div>
      </div>
      )}

      {/* ============ مساحة الكتابة ============ */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="writing-body" className="text-xs font-semibold text-slate-700">
            {tr('اكتب هنا')}
          </label>

          <div className="flex items-center gap-3 text-xs">
            {saving && <span className="text-slate-400">{tr('يحفظ…')}</span>}
            {!saving && savedAt && <span className="text-emerald-600">{tr('حُفظ')} <Check aria-hidden size={15} className="inline-block align-[-3px]" /></span>}
            {error && <span className="text-rose-600">{error}</span>}

            <span
              className={`font-medium ${enough ? 'text-emerald-600' : 'text-slate-400'}`}
            >
              {words} / {writing.min_words} كلمة
            </span>
          </div>
        </div>

        <textarea
          id="writing-body"
          ref={textareaRef}
          dir="ltr"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={9}
          placeholder="My name is…"
          className="ruled resize-y text-end text-base"
        />

        {/* شريط تقدّم الكلمات — يشجّع بلا إحباط */}
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              enough ? 'bg-emerald-500' : 'bg-violet-400'
            }`}
            style={{
              width: `${Math.min(100, (words / Math.max(1, writing.min_words)) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* ============ قائمة المراجعة ============ */}
      {writing.checklist && writing.checklist.length > 0 && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <p className="mb-3 text-xs font-semibold text-slate-700">
            {tr('راجع نصّك قبل أن ترى النموذج')}
          </p>
          <ul className="space-y-2">
            {writing.checklist.map((c, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!checked[i]}
                    onChange={(e) =>
                      setChecked((prev) => ({ ...prev, [i]: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className={checked[i] ? 'text-slate-400 line-through' : ''}>
                    {c.ar}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ============ نموذج الإجابة ============ */}
      {model === null ? (
        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <button
            onClick={revealModel}
            disabled={!enough}
            className="w-full rounded-xl bg-slate-900 py-3 text-sm font-medium text-white
                       transition hover:bg-slate-800 disabled:cursor-not-allowed
                       disabled:bg-slate-300"
          >
            {enough ? tr('اكشف نموذج الإجابة') : `اكتب ${writing.min_words} كلمة أولاً`}
          </button>

          <p className="mt-2 text-center text-xs leading-relaxed text-slate-500">
            {allChecked
              ? tr('راجعت كل النقاط — قارن الآن')
              : tr('من يرى النموذج قبل أن يكتب ينسخه ولا يتعلّم')}
          </p>

          {modelError && (
            <p className="mt-2 text-center text-xs text-rose-600">{modelError}</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
            <p className="mb-2 text-xs font-semibold text-emerald-800">
              {tr('نموذج إجابة — ليس الإجابة الوحيدة الصحيحة')}
            </p>
            <p className="text-sm leading-relaxed text-slate-800" dir="ltr">
              {model}
            </p>
          </div>

          {/* التقييم الذاتي — الكتابة الحرّة لا تُصحَّح آلياً */}
          <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <p className="mb-3 text-xs font-semibold text-slate-700">
              {tr('بعد المقارنة — كيف تقيّم كتابتك؟')}
            </p>

            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setSelfScore(n)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition
                              ${
                                selfScore === n
                                  ? 'bg-violet-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>{tr('ينقصني كثير')}</span>
              <span>{tr('قريب من النموذج')}</span>
            </div>

            {selfScore !== null && (
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                {selfScore <= 2
                  ? tr('أعد كتابة النص مستعيناً بالقوالب. التكرار هو ما يُرسّخ.')
                  : selfScore === 3
                    ? tr('جيد. راجع الأخطاء الثلاثة أعلاه وصحّح ما يقابلها في نصّك.')
                    : tr('ممتاز. الهدف 80% لا 100% — انتقل لمهمة اليوم التالية.')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
