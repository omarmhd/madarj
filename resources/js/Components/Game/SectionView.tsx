import type { ReactNode } from 'react';
import { BookOpen, Check, ChevronLeft, Music, PenLine, Play, Smartphone, Tv } from 'lucide-react';
import { useEffect, useState } from 'react';
import Listen from '@/Components/Listen';
import { useSpeech, prefToGender, prefRateFactor, type Gender, type VoicePref } from '@/hooks/useSpeech';
import { useT } from '@/lib/i18n';
import SpeakingBrief from '@/Components/Game/SpeakingBrief';
import SituationsView from '@/Components/Game/SituationsView';
import WordTest from '@/Components/Game/WordTest';
import Comparison, { type ComparisonSaved } from '@/Components/Game/Comparison';
import ConversationGuide from '@/Components/Game/ConversationGuide';

/**
 * أقسام الشرح — القواعد والنطق والعبارات والاستماع والقراءة
 * والاختبار الذاتي.
 *
 * مكوّن واحد بستة أشكال لا ستة مكوّنات: القاسم المشترك بينها كبير
 * (نص عربي + نص إنجليزي منطوق + بنية بسيطة)، والاختلاف في الترتيب
 * لا في الجوهر. وإضافة نوع سابع في الأسابيع القادمة تعني حالة
 * جديدة في `switch` لا ملفاً جديداً.
 *
 * قاعدة الكتاب المطبَّقة في كل الأشكال: كل نص إنجليزي قابل للنطق
 * بنقرة، وبالسرعة التي يختارها المتعلّم.
 */

export interface SectionData {
  id: number;
  kind:
    | 'grammar'
    | 'phonics'
    | 'phrases'
    | 'listening'
    | 'reading'
    | 'selfcheck'
    | 'breaktime'
    | 'speaking'
    | 'situations'
    | 'word_test'
    | 'comparison'
    | 'conversation';
  title_ar: string;
  title_en: string | null;
  payload: Record<string, any>;
}

interface Props {
  section: SectionData;
  /** سرعة النطق — تأتي من شريط الصفحة فتكون واحدة في كل مكان */
  rate?: number;
  /** الصوت الذي اختاره المتدرّب — يُطبَّق على كل نطق هنا */
  voice?: VoicePref;
  /** هل تُعرض الترجمة العربية افتراضياً؟ من تفضيلات المتدرّب */
  showTranslation?: boolean;
  /** أنشطة الاستراحة المُنجزة — مفاتيحها song · watch · story · channel */
  breakDone?: string[];
  /** ما كتبه في كل نشاط — يعود إليه فيراه كما تركه */
  breakNotes?: Record<string, string>;
  /** يُنادى عند تأشير نشاط استراحة. غيابه يُخفي التأشير. */
  onToggleBreak?: (item: string, done: boolean, note?: string) => void;
  /** رقم الأسبوع — تحتاجه المقارنة الكبرى لتحفظ فيه */
  weekNumber?: number;
  /** ما قاسه وكتبه سابقاً في المقارنة — يعود إليه كما تركه */
  myComparison?: ComparisonSaved | null;
  /** إجابات استمارات هذا الأسبوع، بنوعها */
  myNotes?: Record<string, Record<string, string>> | null;
}

/**
 * ما التقطه في نشاط الاستراحة.
 *
 * ── لماذا حقلٌ حرّ لا اختبار ────────────────────────────────
 * لا سبيل إلى إثبات أن أحداً شاهد فيديو، والأهمّ أن إثباته غير
 * مرغوب: قاعدة الكتاب هنا «لا تدرسه»، وهو يعمل لأنه سهل. لكن
 * المشاهدة الصامتة تمرّ بلا أثر، والملاحظة المكتوبة تحوّلها إلى
 * انتباه — وهذا هو الفرق بين «شاهدتُ» و«تعلّمت».
 *
 * ── ولماذا الكتابة وحدها تُؤشِّر الإنجاز ────────────────────
 * ما كُتب دليلٌ أقوى من زرٍّ نُقر. فمن كتب ملاحظته فقد أنجز، ولا
 * يُطلب منه تأكيد ذلك مرتين.
 */
function BreakNote({
  prompt,
  saved,
  onSave,
}: {
  prompt: string;
  saved: string;
  onSave: (note: string) => void;
}) {
  const tr = useT();
  const [text, setText] = useState(saved);
  const [state, setState] = useState<'idle' | 'saved'>('idle');

  // ما يصل من الخادم بعد الحفظ يغلب المسوّدة المحليّة
  useEffect(() => {
    setText(saved);
  }, [saved]);

  const dirty = text.trim() !== saved.trim();

  return (
    <div className="mt-3 rounded-xl bg-violet-50/60 p-3 ring-1 ring-violet-100">
      <label className="flex items-center gap-1.5 text-xs font-bold text-violet-900"><PenLine aria-hidden size={14} /> {prompt}</label>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setState('idle');
        }}
        rows={2}
        placeholder={tr('اكتب ما التقطته…')}
        className="ruled mt-2 resize-y text-sm"
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-violet-700/70">
          {tr('لك وحدك — لا يُصحَّح ولا يُقيَّم')}
        </p>

        {dirty ? (
          <button
            onClick={() => {
              onSave(text.trim());
              setState('saved');
            }}
            className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium
                       text-white transition hover:bg-violet-700"
          >
            {tr('احفظ')}
          </button>
        ) : state === 'saved' || saved ? (
          <span className="shrink-0 text-xs font-medium text-emerald-600">
            <Check aria-hidden size={15} className="inline-block align-[-3px]" /> {tr('محفوظ')}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** زر نطق صغير موحّد */
export default function SectionView({
  section,
  rate = 0.8,
  voice = 'f',
  showTranslation = true,
  breakDone = [],
  breakNotes = {},
  onToggleBreak,
  weekNumber,
  myComparison,
  myNotes,
}: Props) {
  const tr = useT();
  const p = section.payload;
  const { speak, speakSequence, stop, supported } = useSpeech();

  // الصوت والسرعة الفعليان من تفضيل المتدرّب
  const myVoice = prefToGender(voice);
  const myRate = rate * prefRateFactor(voice);

  /**
   * الترجمة العربية.
   *
   * الافتراضي من تفضيلات المتدرّب: من اختار «الإنجليزية فقط» لا
   * تُعرض له، ومن اختار العربية تُعرض. ويبقى الزرّ في الحالتين
   * فالقرار قابل للعكس في اللحظة.
   */
  const [showArabic, setShowArabic] = useState(showTranslation);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const header = (
    <div className="mb-4">
      <h4 className="font-bold text-slate-900">{section.title_ar}</h4>
      {section.title_en && (
        <p className="mt-0.5 text-xs text-slate-500" dir="ltr">
          {section.title_en}
        </p>
      )}
    </div>
  );

  switch (section.kind) {
    /* ================= رموز النطق ================= */
    case 'phonics':
      return (
        <div>
          {header}
          <p className="mb-4 text-sm leading-relaxed text-slate-700">{p.intro_ar}</p>

          <div className="space-y-2">
            {(p.symbols ?? []).map((s: any, i: number) => (
              <div key={i} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="rounded-lg bg-violet-50 px-3 py-1 font-mono text-lg font-bold text-violet-700"
                    dir="ltr"
                  >
                    {s.ipa}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-slate-700">
                    {s.arabic_hint}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2" dir="ltr">
                  {(s.examples ?? []).map((w: string) => (
                    <button
                      key={w}
                      onClick={() => speak(w, { rate: myRate, gender: myVoice })}
                      disabled={!supported}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5
                                 text-sm font-medium text-slate-800 ring-1 ring-slate-200
                                 transition hover:bg-violet-600 hover:text-white
                                 disabled:opacity-50"
                    >
                      {w}
                      <span aria-hidden className="text-xs opacity-60">
                        <ChevronLeft aria-hidden size={16} />
                      </span>
                    </button>
                  ))}
                </div>

                {(s.note_ar || s.fix_ar) && (
                  <div className="mt-3 rounded-lg border-s-4 border-amber-400 bg-amber-50/70 p-3">
                    {s.note_ar && (
                      <p className="text-xs leading-relaxed text-amber-900">
                        <span className="font-semibold">{tr('أين يقع الخطأ:')} </span>
                        {s.note_ar}
                      </p>
                    )}
                    {s.fix_ar && (
                      <p className="mt-1.5 text-xs leading-relaxed text-emerald-800">
                        <span className="font-semibold">{tr('ما تفعله:')} </span>
                        {s.fix_ar}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {p.tip_ar && (
            <p className="mt-4 rounded-lg border-s-4 border-violet-500 bg-violet-50/70 p-3 text-xs leading-relaxed text-violet-900">
              {p.tip_ar}
            </p>
          )}
        </div>
      );

    /* ================= عبارات النجاة ================= */
    case 'phrases':
      return (
        <div>
          {header}
          <p className="mb-4 text-sm leading-relaxed text-slate-700">{p.intro_ar}</p>

          <div className="space-y-4">
            {(p.groups ?? []).map((g: any, gi: number) => (
              <div key={gi}>
                <p className="mb-2 text-xs font-semibold text-slate-600">{g.label_ar}</p>

                <div className="space-y-1.5">
                  {(g.items ?? []).map((it: any, i: number) => (
                    <div
                      key={i}
                      className="rounded-lg bg-white p-3 ring-1 ring-slate-200"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 text-sm font-medium text-slate-900" dir="ltr">
                          {it.en}
                        </p>
                        <Listen text={it.en} gender={myVoice} size="sm" />
                      </div>
                      {it.ipa && (
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400" dir="ltr">
                          {it.ipa}
                        </p>
                      )}
                      <p className="mt-0.5 text-sm text-slate-600">{it.ar}</p>
                      {it.when_ar && (
                        <p className="mt-1 text-xs text-slate-400">
                          متى: {it.when_ar}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {p.why_first_ar && (
            <p className="mt-4 rounded-lg border-s-4 border-violet-500 bg-violet-50/70 p-3 text-xs leading-relaxed text-violet-900">
              {p.why_first_ar}
            </p>
          )}
        </div>
      );

    /* ================= القواعد ================= */
    case 'grammar':
      return (
        <div>
          {header}

          <p className="mb-4 rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-800 ring-1 ring-slate-200">
            {p.rule_ar}
          </p>

          {/* الجدول — كل مثال منطوق */}
          {p.table && (
            <div className="mb-4 overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    {(p.table.columns_ar ?? []).map((c: string, i: number) => (
                      <th key={i} className="px-3 py-2 text-start font-medium">
                        {c}
                      </th>
                    ))}
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(p.table.rows ?? []).map((row: string[], i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className={`whitespace-nowrap px-3 py-2 ${
                            j === 1 ? 'font-bold text-violet-700' : 'text-slate-800'
                          }`}
                          dir="ltr"
                        >
                          {cell}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <Listen text={row[2] ?? row[0]} gender={myVoice} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* المقارنة بالعربية — جوهر منهج الكتاب */}
          {p.arabic_contrast_ar && (
            <div className="mb-4 rounded-xl border-s-4 border-sky-500 bg-sky-50/70 p-4">
              <p className="mb-1 text-xs font-semibold text-sky-800">
                {tr('الفرق عن العربية — هنا يقع الخطأ')}
              </p>
              <p className="text-sm leading-relaxed text-sky-900">
                {p.arabic_contrast_ar}
              </p>
            </div>
          )}

          {/* جدول المقارنة — من §7.4 في الكتاب */}
          {(p.contrast_table ?? []).length > 0 && (
            <div className="mb-4 space-y-2">
              {p.contrast_table.map((c: any, i: number) => (
                <div key={i} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-700">{c.ar}</span>
                    <span aria-hidden className="text-slate-300">|</span>
                    <span className="text-sm text-rose-700 line-through decoration-rose-300" dir="ltr">
                      {c.literal}
                    </span>
                    <span aria-hidden className="text-slate-400">→</span>
                    <span className="text-sm font-medium text-emerald-800" dir="ltr">
                      {c.right}
                    </span>
                    <Listen text={c.right} size="sm" />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600">{c.rule_ar}</p>
                </div>
              ))}
            </div>
          )}

          {p.article_rule_ar && (
            <p className="mb-4 rounded-xl bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-900">
              {p.article_rule_ar}
            </p>
          )}

          {/* الأخطاء الشائعة */}
          {(p.common_errors ?? []).length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                {tr('الأخطاء التي يقع فيها المتحدث بالعربية')}
              </p>
              {p.common_errors.map((e: any, i: number) => (
                <div key={i} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center gap-2" dir="ltr">
                    <span className="rounded-md bg-rose-50 px-2 py-0.5 text-sm text-rose-700 line-through decoration-rose-300">
                      {e.wrong}
                    </span>
                    <span aria-hidden className="text-slate-400">
                      →
                    </span>
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-sm font-medium text-emerald-800">
                      {e.right}
                    </span>
                    <Listen text={e.right} gender={myVoice} size="sm" />
                  </div>
                  {/* السبب بالعربية إن كُتب، وإلا بنصّ الكتاب باتجاهه */}
                  {e.why_ar ? (
                    <p className="mt-1.5 text-xs text-slate-600">{e.why_ar}</p>
                  ) : e.why_en ? (
                    <p className="mt-1.5 text-xs text-slate-500" dir="ltr">{e.why_en}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {p.negation_ar && (
              <p className="rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
                {p.negation_ar}
              </p>
            )}
            {p.question_ar && (
              <p className="rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
                {p.question_ar}
              </p>
            )}
          </div>

          {(p.checklist_ar ?? []).length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {p.checklist_ar.map((c: string, i: number) => (
                <li key={i} className="flex gap-2 text-xs text-slate-700">
                  <span className="text-emerald-600"><Check aria-hidden size={16} /></span>
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      );

    /* ================= الاستماع ================= */
    case 'listening':
      return (
        <div>
          {header}

          {/* الطريقة الرباعية — الترتيب ليس اقتراحاً */}
          <ol className="mb-4 space-y-2">
            {(p.method_ar ?? []).map((m: string, i: number) => (
              <li key={i} className="flex gap-2.5 rounded-lg bg-white p-3 ring-1 ring-slate-200">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-xs leading-relaxed text-slate-700">{m}</span>
              </li>
            ))}
          </ol>

          {p.warning_ar && (
            <p className="mb-3 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-800">
              {p.warning_ar}
            </p>
          )}

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={() =>
                speakSequence(
                  (p.transcript ?? []).map((t: any) => ({ text: t.en, gender: myVoice })),
                  { rate: myRate },
                )
              }
              disabled={!supported}
              className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white
                         transition hover:bg-violet-700 disabled:opacity-50"
            >
              <Play aria-hidden size={15} className="inline-block align-[-3px]" fill="currentColor" /> {tr('استمع كاملاً')}
            </button>
            <button
              onClick={stop}
              className="rounded-xl bg-white px-4 py-2.5 text-sm text-slate-600
                         ring-1 ring-slate-200 hover:ring-slate-300"
            >
              {tr('أوقف')}
            </button>
            <button
              onClick={() => setShowArabic((v) => !v)}
              className="rounded-xl bg-white px-4 py-2.5 text-sm text-slate-600
                         ring-1 ring-slate-200 hover:ring-slate-300"
            >
              {showArabic ? tr('أخفِ الترجمة') : tr('أظهر الترجمة')}
            </button>
          </div>

          <div className="mb-4 space-y-1.5">
            {(p.transcript ?? []).map((t: any, i: number) => (
              <div key={i} className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm leading-relaxed text-slate-900" dir="ltr">
                    {t.en}
                  </p>
                  <Listen text={t.en} gender={myVoice} size="sm" />
                </div>
                {showArabic && (
                  <p className="mt-1 text-sm text-slate-500">{t.ar}</p>
                )}
              </div>
            ))}
          </div>

          {p.shadowing_ar && (
            <div className="mb-4 rounded-xl border-s-4 border-sky-500 bg-sky-50/70 p-4">
              <p className="mb-1 text-xs font-semibold text-sky-800">{tr('الشادوينج')}</p>
              <p className="text-sm leading-relaxed text-sky-900">{p.shadowing_ar}</p>
            </div>
          )}

          {/* الأسئلة — الإجابة تُكشف بالطلب لا فوراً */}
          {(p.questions ?? []).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">{tr('أسئلة الفهم')}</p>
              {p.questions.map((q: any, i: number) => (
                <div key={i} className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                  <p className="text-sm text-slate-800">{q.q_ar}</p>

                  {revealed[i] ? (
                    <p className="mt-1.5 text-sm font-medium text-emerald-700">
                      {q.a_ar}
                    </p>
                  ) : (
                    <button
                      onClick={() => setRevealed((r) => ({ ...r, [i]: true }))}
                      className="mt-1.5 text-xs text-violet-700 hover:underline"
                    >
                      اكشف الإجابة
                      {q.hint_ar ? ` · تلميح: ${q.hint_ar}` : ''}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );

    /* ================= القراءة ================= */
    case 'reading':
      return (
        <div>
          {header}

          {p.method_ar && (
            <p className="mb-4 rounded-lg border-s-4 border-violet-500 bg-violet-50/70 p-3 text-xs leading-relaxed text-violet-900">
              {p.method_ar}
            </p>
          )}

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={() =>
                speakSequence(
                  (p.story ?? []).map((s: any) => ({ text: s.en, gender: myVoice })),
                  { rate: myRate },
                )
              }
              disabled={!supported}
              className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white
                         transition hover:bg-violet-700 disabled:opacity-50"
            >
              <Play aria-hidden size={15} className="inline-block align-[-3px]" fill="currentColor" /> {tr('اقرأ لي القصة')}
            </button>
            <button
              onClick={stop}
              className="rounded-xl bg-white px-4 py-2.5 text-sm text-slate-600
                         ring-1 ring-slate-200 hover:ring-slate-300"
            >
              {tr('أوقف')}
            </button>
            <button
              onClick={() => setShowArabic((v) => !v)}
              className="rounded-xl bg-white px-4 py-2.5 text-sm text-slate-600
                         ring-1 ring-slate-200 hover:ring-slate-300"
            >
              {showArabic ? tr('أخفِ الترجمة') : tr('أظهر الترجمة')}
            </button>
          </div>

          <div className="mb-4 space-y-2 rounded-xl bg-white p-4 ring-1 ring-slate-200">
            {(p.story ?? []).map((s: any, i: number) => (
              <div key={i}>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm leading-relaxed text-slate-900" dir="ltr">
                    {s.en}
                  </p>
                  <Listen text={s.en} gender={myVoice} size="sm" />
                </div>
                {showArabic && <p className="mt-0.5 text-sm text-slate-500">{s.ar}</p>}
              </div>
            ))}
          </div>

          {/* المسرد */}
          {(p.glossary ?? []).length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold text-slate-700">{tr('المسرد')}</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {p.glossary.map((g: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white
                               px-3 py-2 ring-1 ring-slate-200"
                  >
                    <span className="min-w-0 truncate text-sm text-slate-600">{g.ar}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-start">
                        <p className="text-sm font-medium text-slate-900" dir="ltr">
                          {g.en}
                        </p>
                        {g.ipa && (
                          <p className="font-mono text-[10px] text-slate-400" dir="ltr">
                            {g.ipa}
                          </p>
                        )}
                        {g.note_ar && (
                          <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                            {g.note_ar}
                          </p>
                        )}
                      </div>
                      <Listen text={g.en} gender={myVoice} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(p.questions ?? []).length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-semibold text-slate-700">{tr('أسئلة الفهم')}</p>
              {p.questions.map((q: any, i: number) => (
                <div key={i} className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                  <p className="text-sm text-slate-800">{q.q_ar}</p>
                  {revealed[i] ? (
                    <p className="mt-1.5 text-sm font-medium text-emerald-700">{q.a_ar}</p>
                  ) : (
                    <button
                      onClick={() => setRevealed((r) => ({ ...r, [i]: true }))}
                      className="mt-1.5 text-xs text-violet-700 hover:underline"
                    >
                      {tr('اكشف الإجابة')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {p.find_task_ar && (
            <p className="mb-3 rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
              <strong>{tr('مهمة:')}</strong> {p.find_task_ar}
            </p>
          )}

          {p.notice_ar && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              {p.notice_ar}
            </p>
          )}
        </div>
      );

    /* ================= الاختبار الذاتي ================= */
    case 'selfcheck': {
      const items = p.items ?? [];
      const passed = items.filter((_: any, i: number) => checked[i]).length;
      // ثلاث درجات كما في §15: 7-8 · 5-6 · أقل من 5
      const tier = passed >= 7 ? 'pass' : passed >= 5 ? 'partial' : 'fail';
      const verdict =
        tier === 'pass' ? p.pass_ar : tier === 'partial' ? p.partial_ar : p.fail_ar;

      return (
        <div>
          {header}

          {p.intro_ar && (
            <p className="mb-4 text-sm leading-relaxed text-slate-700">{p.intro_ar}</p>
          )}

          <div className="mb-4 space-y-2">
            {items.map((it: any, i: number) => (
              <label
                key={i}
                className={`flex cursor-pointer items-start gap-3 rounded-xl p-3.5
                            ring-1 transition ${
                              checked[i]
                                ? 'bg-emerald-50 ring-emerald-200'
                                : 'bg-white ring-slate-200 hover:ring-slate-300'
                            }`}
              >
                <input
                  type="checkbox"
                  checked={!!checked[i]}
                  onChange={(e) =>
                    setChecked((c) => ({ ...c, [i]: e.target.checked }))
                  }
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    أستطيع أن {it.can_ar}
                  </p>
                  {it.proof_ar && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      تحقّق: {it.proof_ar}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>

          {/* الحكم — يظهر فوراً مع كل تأشير */}
          <div
            className={`rounded-xl p-4 text-center ring-1 ${
              tier === 'pass'
                ? 'bg-emerald-50 ring-emerald-200'
                : tier === 'partial'
                  ? 'bg-amber-50 ring-amber-200'
                  : 'bg-rose-50 ring-rose-200'
            }`}
          >
            <p className="text-2xl font-bold text-slate-900">
              {passed}
              <span className="text-base font-normal text-slate-500">
                /{items.length}
              </span>
            </p>
            <p
              className={`mt-1 text-sm font-medium ${
                tier === 'pass'
                  ? 'text-emerald-800'
                  : tier === 'partial'
                    ? 'text-amber-800'
                    : 'text-rose-800'
              }`}
            >
              {verdict}
            </p>
          </div>

          {p.keep_recording_ar && (
            <p className="mt-4 rounded-lg border-s-4 border-violet-500 bg-violet-50/70 p-3 text-xs leading-relaxed text-violet-900">
              {p.keep_recording_ar}
            </p>
          )}
        </div>
      );
    }

    /* ================= أوّل محادثة حقيقيّة ================= */
    case 'conversation':
      // بلا رقم الأسبوع لا مكان تُحفظ فيه المراجعة البعديّة
      return weekNumber ? (
        <div className="space-y-4">
          {header}
          <ConversationGuide
            payload={p as any}
            saved={myNotes?.conversation ?? null}
            weekNumber={weekNumber}
          />
        </div>
      ) : null;

    /* ================= المقارنة الكبرى ================= */
    case 'comparison':
      // بلا رقم الأسبوع لا مكان تُحفظ فيه، فلا تُعرض نصف عاملة
      return weekNumber ? (
        <div className="space-y-4">
          {header}
          <Comparison
            payload={p as any}
            saved={myComparison ?? null}
            weekNumber={weekNumber}
          />
        </div>
      ) : null;

    /* ================= اختبار الكلمات ================= */
    case 'word_test':
      return (
        <div className="space-y-4">
          {header}
          <WordTest payload={p as any} />
        </div>
      );

    /* ================= المواقف السبعة ================= */
    case 'situations':
      return (
        <div className="space-y-4">
          {header}
          <SituationsView payload={p as any} />
        </div>
      );

    /* ================= التحدّث ================= */
    case 'speaking':
      // نفس البطاقة المعروضة فوق المسجّل — مهمّة واحدة لا وصفان
      return (
        <div className="space-y-4">
          {header}
          <SpeakingBrief speaking={p as any} />
        </div>
      );

    /* ================= وقت الاستراحة ================= */
    case 'breaktime': {
      /**
       * بطاقة فئة: الاختيار المُنتقى بارز، والبدائل مطويّة.
       * الكتاب يعطي ثلاثة خيارات متساوية في كل فئة، وثلاثة خيارات
       * متساوية تترك المبتدئ في حيرة فلا يختار شيئاً.
       */
      const Pick = ({
        icon,
        heading,
        pick,
        alts,
        item,
        children,
      }: {
        icon: ReactNode;
        heading: string;
        pick: any;
        alts?: any[];
        item?: {
          key: string;
          task_ar: string;
          minutes: number;
          steps?: string[];
          why_ar?: string;
          prompt_ar?: string;
        };
        children?: React.ReactNode;
      }) => {
        // كل الخيارات معروضة قابلة للاختيار، والأول موصى به.
        // إخفاء البدائل يفرض خياراً واحداً، والكتاب يعطي ثلاثة
        // لأن الذوق يختلف — ومن لا يحبّ ما يسمعه لا يستمرّ عليه.
        const options = [pick, ...(alts ?? [])];

        return (
        <div
          className={`rounded-2xl p-5 ring-1 transition ${
            item && breakDone.includes(item.key)
              ? 'bg-emerald-50/50 ring-emerald-200'
              : 'bg-white ring-slate-200'
          }`}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <span aria-hidden>{icon}</span>
              {heading}
              {item && (
                <span className="text-xs font-normal text-slate-400">
                  {item.minutes} دقيقة
                </span>
              )}
            </p>

            {/* التأشير — يُحتسب ولا يُلزم */}
            {item && onToggleBreak && (
              <button
                onClick={() => onToggleBreak(item.key, !breakDone.includes(item.key))}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5
                            text-xs font-medium transition ${
                              breakDone.includes(item.key)
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
              >
                {breakDone.includes(item.key) ? <><Check aria-hidden size={15} className="inline-block align-[-3px]" /> {tr('أنجزته')}</> : tr('أشّر كمنجَز')}
              </button>
            )}
          </div>

          {/* ما يُعدّ إنجازاً — «سمعت الأغنية» غامضة، والمعيار واضح.
              والخطوات مرقّمة لأن «تصيَّد خمس كلمات» لا تقول ماذا
              يتصيَّد، أما «اختر خمساً وحدّد أين يقع النبر» فتقول */}
          {item && (
            <div className="mb-3 rounded-lg bg-slate-50 p-3">
              {(item.steps ?? []).length > 0 ? (
                <ol className="space-y-1.5">
                  {item.steps!.map((s, i) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-700">
                      <span
                        className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full
                                   bg-slate-200 text-xs font-bold text-slate-600"
                      >
                        {i + 1}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs leading-relaxed text-slate-600">
                  <strong className="text-slate-800">{tr('المطلوب:')}</strong> {item.task_ar}
                </p>
              )}

              {/* لماذا هذه المهمّة بالذات — ما لا يُفهم سببه لا يُنجَز */}
              {item.why_ar && (
                <p className="mt-2.5 border-t border-slate-200 pt-2.5 text-xs leading-relaxed text-slate-500">
                  {item.why_ar}
                </p>
              )}
            </div>
          )}

          {/* الملاحظة — تُحفظ وتُؤشِّر الإنجاز معاً */}
          {item?.prompt_ar && onToggleBreak && (
            <BreakNote
              prompt={item.prompt_ar}
              saved={breakNotes[item.key] ?? ''}
              onSave={(note) => onToggleBreak(item.key, true, note)}
            />
          )}

          {/* الخيارات الثلاثة — اختر ما يناسب ذوقك */}
          <div className="space-y-2">
            {options.map((o: any, i: number) => {
              return (
                <div
                  key={i}
                  className={`rounded-xl p-4 ring-1 ${
                    i === 0
                      ? 'bg-gradient-to-bl from-violet-50 to-white ring-violet-200'
                      : 'bg-white ring-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      {i === 0 && (
                        <span className="mb-1.5 inline-block rounded-full bg-violet-600 px-2 py-0.5 text-xs font-medium text-white">
                          {tr('موصى به لهذا الأسبوع')}
                        </span>
                      )}

                      <p className="font-semibold text-slate-900" dir="ltr">
                        {o.title ?? o.name ?? o.source}
                      </p>

                      {(o.artist || o.level || o.where) && (
                        <p className="mt-0.5 text-xs text-slate-500" dir="ltr">
                          {[o.artist, o.level, o.where].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>

                  </div>

                  {/* الوصف بالعربية إن وُجد، وإلا بنصّ الكتاب الإنجليزي
                      باتجاهه الصحيح — ولا يُوضع الإنجليزي في حقل ‎_ar‎
                      لأن ذلك يجعله يبدو مترجماً وهو ليس كذلك */}
                  {(o.why_ar ?? o.what_ar) ? (
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      {o.why_ar ?? o.what_ar}
                    </p>
                  ) : o.why_en ? (
                    <p className="mt-2 text-sm leading-relaxed text-slate-600" dir="ltr">
                      {o.why_en}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {children}

          <p className="mt-3 text-xs text-slate-400">
            {tr('الثلاثة صالحة. اختر ما تحبّ سماعه — ما لا تحبّه لا تستمرّ عليه.')}
          </p>
        </div>
        );
      };

      return (
        <div className="space-y-4">
          {header}

          {/* العدّاد — ما لا يُحتسب لا يُنجَز، والعدّاد وحده هو الحافز */}
          {onToggleBreak && (p.item_order ?? []).length > 0 && (
            <div className="rounded-2xl bg-gradient-to-bl from-fuchsia-600 to-fuchsia-500 p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-fuchsia-100">{tr('أنشطة هذا الأسبوع')}</p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {p.item_order.filter((k: string) => breakDone.includes(k)).length}
                    <span className="text-base font-normal text-fuchsia-100">
                      /{p.item_order.length}
                    </span>
                  </p>
                </div>
                <p className="text-xs leading-relaxed text-fuchsia-100">
                  {tr('العدّاد للتشجيع فقط. لا يقفل يومك ولا يكسر سلسلتك.')}
                </p>
              </div>

              <div className="mt-3 flex gap-1.5">
                {p.item_order.map((k: string) => (
                  <span
                    key={k}
                    className={`h-1.5 flex-1 rounded-full ${
                      breakDone.includes(k) ? 'bg-white' : 'bg-white/25'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* لماذا هذا القسم موجود */}
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <p className="text-sm leading-relaxed text-slate-700">{p.why_ar}</p>

            {(p.compare ?? []).length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5 text-start font-medium"> </th>
                      <th className="px-2 py-1.5 text-start font-medium">{tr('الدراسة المكثّفة')}</th>
                      <th className="px-2 py-1.5 text-start font-medium">{tr('هذا القسم')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {p.compare.map((c: any, i: number) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5 font-medium text-slate-700">{c.aspect_ar}</td>
                        <td className="px-2 py-1.5 text-slate-600">{c.intensive_ar}</td>
                        <td className="px-2 py-1.5 text-violet-800">{c.extensive_ar}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {p.rule_ar && (
              <p className="mt-4 rounded-lg border-s-4 border-rose-400 bg-rose-50/70 p-3 text-sm leading-relaxed text-rose-900">
                {p.rule_ar}
              </p>
            )}

            {p.how_much_ar && (
              <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                {p.how_much_ar}
              </p>
            )}
          </div>

          {p.song && (
            <Pick icon={<Music size={16} />} heading={tr("أغنية الأسبوع")} pick={p.song.pick} alts={p.song.alternatives} item={p.song.item}>
              {p.song.intro_ar && (
                <p className="mt-3 text-xs leading-relaxed text-slate-600">{p.song.intro_ar}</p>
              )}

              {(p.song.method_ar ?? []).length > 0 && (
                <ol className="mt-3 space-y-1.5">
                  {p.song.method_ar.map((m: string, i: number) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-700">
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      {m}
                    </li>
                  ))}
                </ol>
              )}

              {p.song.tool && (
                <p
                  className="mt-3 rounded-lg bg-fuchsia-50 p-3 text-sm leading-relaxed
                             text-fuchsia-900 ring-1 ring-fuchsia-100"
                >
                  <strong>{p.song.tool.name}</strong> — {p.song.tool.why_ar}
                </p>
              )}
            </Pick>
          )}

          {p.watch && (
            <Pick icon={<Tv size={16} />} heading={tr("ما تشاهده هذا الأسبوع")} pick={p.watch.pick} alts={p.watch.alternatives} item={p.watch.item}>
              {p.watch.encouragement_ar && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                  {p.watch.encouragement_ar}
                </p>
              )}
              {p.watch.subtitle_rule_ar && (
                <p className="mt-2 rounded-lg border-s-4 border-violet-500 bg-violet-50/70 p-3 text-xs leading-relaxed text-violet-900">
                  {p.watch.subtitle_rule_ar}
                </p>
              )}
            </Pick>
          )}

          {p.story && (
            <Pick icon={<BookOpen size={16} />} heading={tr("قصة الأسبوع")} pick={p.story.pick} alts={p.story.alternatives} item={p.story.item}>
              {(p.story.target_ar ?? []).length > 0 && (
                <ul className="mt-3 space-y-1">
                  {p.story.target_ar.map((t: string, i: number) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-700">
                      <span className="text-violet-600">•</span>
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </Pick>
          )}

          {p.channel && (
            <Pick
              icon={<Smartphone size={16} />}
              heading={p.channel.heading_ar ?? tr('قناة تتابعها')}
              pick={p.channel.pick}
              alts={p.channel.alternatives}
              item={p.channel.item}
            >
              {p.channel.intro_ar && (
                <p className="mt-3 text-xs leading-relaxed text-slate-600">{p.channel.intro_ar}</p>
              )}
              {p.channel.note_ar && (
                <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  {p.channel.note_ar}
                </p>
              )}
            </Pick>
          )}

          {/* خطة الأسبوع جاهزة — لا يُرتّبها بنفسه */}
          {(p.plan ?? []).length > 0 && (
            <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
              <div className="mb-3 flex items-baseline justify-between">
                <p className="text-sm font-bold text-slate-900">{tr('خطتك هذا الأسبوع')}</p>
                <p className="text-xs text-slate-500">
                  {p.plan.reduce((n: number, x: any) => n + x.minutes, 0)} دقيقة
                </p>
              </div>
              <div className="space-y-1.5">
                {p.plan.map((row: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="w-16 shrink-0 text-xs font-medium text-slate-700">
                      {row.day_ar}
                    </span>
                    <span className="min-w-0 flex-1 text-xs text-slate-600">{row.activity_ar}</span>
                    <span className="shrink-0 text-xs text-slate-400">{row.minutes}د</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {p.links_note_ar && (
            <p className="text-xs leading-relaxed text-slate-400">{p.links_note_ar}</p>
          )}
        </div>
      );
    }
  }
}
