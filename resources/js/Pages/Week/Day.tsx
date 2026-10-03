import { useEffect, useMemo, useRef, useState } from 'react';
import StageDirection from '@/Components/Game/StageDirection';
import Bdi from '@/Components/Bdi';
import { Head, Link } from '@inertiajs/react';
import AppNav from '@/Components/AppNav';
import Listen from '@/Components/Listen';
import { track, setTrackContext, startHeartbeat, flush } from '@/lib/tracker';
import axios from 'axios';
import MinimalPairGame, { type Group as PairGroup } from '@/Components/Game/MinimalPairGame';
import Flashcards, { type Word } from '@/Components/Game/Flashcards';
import ExerciseRunner, { type ExerciseData } from '@/Components/Game/ExerciseRunner';
import WritingTask, {
  type WritingContent,
  type MyWriting,
} from '@/Components/Game/WritingTask';
import Recorder from '@/Components/Recorder';
import SpeakingBrief, { type SpeakingPayload } from '@/Components/Game/SpeakingBrief';
import ReviewSession from '@/Components/Game/ReviewSession';
import SectionView, { type SectionData } from '@/Components/Game/SectionView';
import SpeechControls from '@/Components/SpeechControls';
import { type ComparisonSaved } from '@/Components/Game/Comparison';
import { useSpeech, prefToGender, prefRateFactor, type Gender } from '@/hooks/useSpeech';
import { cleanLabel } from '@/lib/labels';
import { useLocale, dirOf, pick, dirFor } from '@/lib/bilingual';
import { type Prefs, DEFAULT_PREFS } from '@/lib/prefs';
import { sliceBlock, sliceTitle } from '@/lib/contentSteps';
import { useT } from '@/lib/i18n';
import Celebrate from '@/Components/Celebrate';
import { celebrationFor, type Celebration } from '@/lib/milestones';
import { ArrowLeft, Check, ChevronLeft, CircleCheck, Headphones, Lock, PenLine, Play, Square } from 'lucide-react';

/**
 * صفحة اليوم — شاشة العمل اليومية.
 *
 * مرحلتان بالترتيب، كما في الكتاب:
 *   1. تعلّم  — محتوى اليوم معروضاً بترتيب مهامه
 *   2. أنجز  — المهام الخمس، إجبارية، وبإتمامها يُفتح الغد
 *
 * لا يظهر هنا شيء من محتوى بقية الأسبوع. قاعدة الكتاب:
 * «افتح صندوق اليوم، أنجز مهامه، ثم أغلق الصفحة».
 */

interface VocabBlock {
  type: 'vocabulary';
  group: string;
  items: Word[];
}

interface DialogueBlock {
  type: 'dialogue';
  number: number;
  title: string;
  situation_ar: string | null;
  situation_en: string;
  speaker_genders: Record<string, Gender>;
  lines: { speaker: string; en: string; ar: string }[];
}

interface PairsBlock {
  type: 'minimal_pairs';
  groups: PairGroup[];
  production: boolean;
}

interface ExercisesBlock {
  type: 'exercises';
  day: number;
  items: ExerciseData[];
}

interface RecordBlock {
  type: 'record';
  baseline: boolean;
  /** مهمّة التحدّث لهذا الأسبوع — الموضوع والتقسيم والتقييم */
  speaking: SpeakingPayload | null;
}

interface WritingBlock {
  type: 'writing';
  writing: WritingContent | null;
}

interface SectionBlock {
  type: 'section';
  section: SectionData;
}

interface ReviewBlock {
  type: 'review';
}

interface UnbuiltBlock {
  type: 'unbuilt';
  ref: string;
}

type Block =
  | VocabBlock
  | DialogueBlock
  | PairsBlock
  | ExercisesBlock
  | RecordBlock
  | WritingBlock
  | ReviewBlock
  | SectionBlock
  | UnbuiltBlock;

interface DayTask {
  order: number;
  label: string;
  label_ar?: string;
  label_en?: string;
  minutes: number;
  ref: string | null;
  blocks: Block[];
}

interface Props {
  week: { number: number; module: number; title_ar: string; title_en: string };
  day: {
    number: number;
    focus: string;
  focus_ar?: string;
  focus_en?: string;
    minutes: number;
    tasks: DayTask[];
    tasks_done: Record<string, boolean>;
    completed: boolean;
    percent: number;
  };
  stats: { track: 'A' | 'B'; streak: number };
  lastDay: number;
  nextDayUnlocked: boolean;
  myWriting: MyWriting | null;
  myComparison: ComparisonSaved | null;
  myNotes: Record<string, Record<string, string>> | null;
  /** تفضيلات المتدرّب — مشتركة من الخادم */
  prefs?: Prefs;
  /** نشاط الاستراحة المقرّر لهذا اليوم — تذكير لا مهمة */
  breakToday: {
    week_number: number;
    day_number: number;
    book_day_ar: string | null;
    activity_ar: string;
    minutes: number;
    total: number;
    link: {
      label: string;
      url: string | null;
      /** ما هذا المصدر — الاسم وحده لا يعرّف به */
      note_ar: string | null;
      note_en: string | null;
    } | null;
    item_key: string | null;
    item_done: boolean;
    /** تفصيل النشاط — بدونه العنوان بلا معنى */
    item_label_ar: string | null;
    item_steps: string[];
    item_why_ar: string | null;
    /** مهمّة الملاحظة — سؤال واحد يحوّل المشاهدة إلى انتباه */
    item_prompt_ar: string | null;
    item_note: string | null;
  } | null;
}

/**
 * اسم المجموعة يأتي مع الكتلة من الخادم.
 *
 * كان هنا خريطة بأربعة أسماء والمحتوى فيه سبع وسبعون مجموعة، فكان
 * المتدرّب يرى «places_and_things_in_your_day» عنواناً فوق بطاقاته
 * العربية. والاسم محتوى — يتبع عنوان القسم في الكتاب — فمكانه في
 * الـJSON لا في ملفّ TSX.
 */
const groupName = (b: { group: string; group_label_ar?: string | null }) =>
  b.group_label_ar || b.group.replace(/_/g, ' ');

const UNBUILT_LABELS: Record<string, string> = {
  listening: 'الاستماع',
  reading: 'القراءة',
  grammar: 'القواعد',
  selfcheck: 'الاختبار الذاتي',
  section: 'قسم من الكتاب',
};

export default function DayPage({
  week,
  day,
  stats,
  lastDay,
  nextDayUnlocked,
  myWriting,
  myComparison,
  myNotes,
  breakToday,
  prefs = DEFAULT_PREFS,
}: Props) {
  const tr = useT();

  /** ما يقوله رفيق الآن — أو لا شيء، وهو الأشيع */
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [tasksDone, setTasksDone] = useState(day.tasks_done);
  /** تأشير نشاط الاستراحة من صفحة اليوم — يُحتسب ولا يُلزم */
  const [breakDone, setBreakDone] = useState(breakToday?.item_done ?? false);
  const [breakNote, setBreakNote] = useState(breakToday?.item_note ?? '');
  const [breakSaved, setBreakSaved] = useState(breakToday?.item_note ?? '');
  const [saving, setSaving] = useState<number | null>(null);
  // السرعة الافتراضية من تفضيلات المستخدم لا رقماً ثابتاً
  const [rate, setRate] = useState(prefs.rate);
  const [voice, setVoice] = useState(prefs.voice);

  /**
   * الصوت المفضّل والسرعة الفعلية.
   *
   * يُطبَّقان على كل نطق ليس لمتحدّث بعينه. أما أسطر الحوار فتنطق
   * بصوت متحدّثها لأن ذلك من المحتوى لا من التفضيل.
   */
  const myVoice = prefToGender(voice);
  const myRate = rate * prefRateFactor(voice);
  const [playing, setPlaying] = useState<{ dialogue: number; index: number } | null>(null);

  const stopSeq = useRef<(() => void) | null>(null);
  const { speak, speakSequence, stop, supported } = useSpeech();

  /*
   * تُعدّ المهامّ **الموجودة** لا المفاتيح المخزَّنة.
   *
   * حين تُحذف مهمّة من الخطة تبقى إشارتها في `tasks_done` القديم،
   * فيصير المخزَّن خمسة والمهام أربعاً — و`doneCount === total` تكذب
   * أبداً، فلا يكتمل اليوم مهما فعل المتدرّب ولا يعمل زرّ «أنهِ اليوم».
   * وهذا يقع لكل من بدأ قبل تعديل الخطة.
   */
  const doneCount = day.tasks.filter((t) => tasksDone[String(t.order)]).length;
  const total = day.tasks.length;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const isComplete = doneCount === total && total > 0;

  // المسار B يضاعف الوقت — قاعدة الكتاب
  const multiplier = stats.track === 'B' ? 2 : 1;

  /**
   * وضع العرض.
   *
   * `wizard` هو الافتراضي: مهمة واحدة على الشاشة، فلا يرى المتعلّم
   * ستين دقيقة من المحتوى في تمرير واحد ويشعر بالإرباك.
   * `full` للمراجعة: كل اليوم في صفحة واحدة.
   */
  const [mode, setMode] = useState<'wizard' | 'full'>('wizard');

  /** الخطوة الحالية في الـ wizard — تبدأ من أول مهمة غير منجزة */
  const [step, setStep] = useState(() => {
    const i = day.tasks.findIndex((t) => !day.tasks_done[String(t.order)]);
    return i >= 0 ? i : 0;
  });

  /** المهمة المعروضة في وضع الخطوات */
  const visibleTasks = useMemo(() => {
    const t = day.tasks[Math.min(step, day.tasks.length - 1)];
    return t ? [t] : [];
  }, [day.tasks, step]);

  /**
   * الخطوة داخل القسم.
   *
   * القسم نفسه wizard: الحوار يُقدَّم مقطعاً مقطعاً، والمفردات دفعة
   * دفعة، والأزواج الصوتية مجموعة مجموعة. التقسيم يُحسب من حجم
   * المحتوى في lib/contentSteps فيصلح لكل الأسابيع بلا ضبط يدوي.
   */
  const [innerStep, setInnerStep] = useState(0);

  /** أعلى منطقة المحتوى — إليها يصعد التمرير لا إلى أعلى الصفحة */
  const locale = useLocale();

  /** وصف اليوم وعناوين مهامّه — الأساس بحسب تفضيل المتدرّب */
  const dayName = pick(locale, day.focus_ar ?? day.focus, day.focus_en);
  const taskName = (t: { label: string; label_ar?: string; label_en?: string }) =>
    pick(locale, t.label_ar ?? t.label, t.label_en);

  const contentTop = useRef<HTMLDivElement>(null);

  /**
   * تقدّم النشاط الجاري — الدرجة الثالثة.
   *
   * كان لكل نشاط شريطه، فيظهر شريطان على الشاشة. الآن يُبلّغ النشاط
   * موضعه ويُعرَض هنا: اليوم ← المهمّة ← الخطوة ← موضعك في النشاط.
   */
  const [inner, setInner] = useState<{ done: number; total: number } | null>(null);

  // كل انتقال يُصفّر الدرجة الثالثة — النشاط الجديد يُبلّغ عن نفسه
  useEffect(() => setInner(null), [step, innerStep]);

  /*
   * سياق الصفحة يُضبط مرة، فلا يحمل كل نداء رقم الأسبوع واليوم.
   * والنبضة تبدأ هنا لا في الجذر: صفحة اليوم هي التي يُقاس فيها
   * الوقت، أما تصفّح اللوحة فليس دراسة.
   */
  useEffect(() => {
    setTrackContext(week.number, day.number);
    startHeartbeat();
    track('day_open', `week:${week.number}/day:${day.number}`);
    return () => {
      void flush();
    };
  }, [week.number, day.number]);

  /** شرائح القسم الحالي — كل شريحة كتلة صحيحة تُعرض بنفس الدالة */
  const slices = useMemo(() => {
    const task = day.tasks[Math.min(step, day.tasks.length - 1)];
    if (!task) return [] as Block[];

    return task.blocks.flatMap((b) => sliceBlock(b));
  }, [day.tasks, step]);

  /** الانتقال بين الأقسام يعيد الترقيم الداخلي إلى أوّله */
  /**
   * الصعود إلى أعلى المحتوى عند كل انتقال.
   *
   * بلا هذا يبقى المتدرّب حيث كان في نهاية المهمّة السابقة، فيجد
   * نفسه في وسط المهمّة الجديدة أو في نهايتها — وهو لم يقرأ أولها.
   *
   * والهدف ليس أعلى الصفحة بل أعلى **المحتوى**: الرأس الملوّن قُرئ
   * مرة ولا داعي لإعادته، والشريط الملتصق يبقى ظاهراً فوقه.
   */
  const scrollToContent = () => {
    const el = contentTop.current;
    if (!el) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    // الشريطان الملتصقان يغطّيان أعلى الشاشة، فنطرح ارتفاعهما
    const chrome = window.innerWidth < 640 ? 44 + 62 : 56 + 62;
    const y = el.getBoundingClientRect().top + window.scrollY - chrome;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  };

  const goToStep = (next: number) => {
    const t = day.tasks[next];
    if (t) track('task_open', t.ref ?? `order:${t.order}`);
    setStep(next);
    setInnerStep(0);
    scrollToContent();
  };

  /** الانتقال بين خطوات المهمّة الواحدة يصعد أيضاً — لنفس السبب */
  const goToSlice = (next: number) => {
    setInnerStep(next);
    scrollToContent();
  };

  /**
   * هل بلغ المتدرّب هذه المهمّة؟
   *
   * قاعدة واحدة يستعملها الشريط والوضع الكامل معاً: ما أُنجز مفتوح
   * دائماً للمراجعة، وما بعد الموضع الحالي مقفل. فلا يتقدّم أحد على
   * تسلسل اليوم من أي باب.
   */
  const taskReachable = (t: DayTask) => {
    if (tasksDone[String(t.order)]) return true;
    const i = day.tasks.findIndex((x) => x.order === t.order);
    return i <= step;
  };

  const atLastSlice = innerStep >= slices.length - 1;

  const toggle = async (task: DayTask) => {
    const next = !tasksDone[String(task.order)];

    // تحديث متفائل — المتدرّب قد يغلق الصفحة في أي لحظة
    setTasksDone((prev) => ({ ...prev, [String(task.order)]: next }));
    setSaving(task.order);

    try {
      const { data } = await axios.post('/progress/task', {
        week: week.number,
        day: day.number,
        task: task.order,
        done: next,
      });
      setTasksDone(data.tasks_done);

      /*
       * الاحتفال من ردّ الخادم لا من حساب الواجهة.
       *
       * السلسلة والرقم القياسي وعدد الأيام كلها في القاعدة، والواجهة
       * لا تعرفها إلا بعد الكتابة. فالخادم يرسل الحقائق ورفيق يقرّر
       * أيّها يستحقّ الظهور — وأكثرها لا يستحقّ، وهذا مقصود.
       */
      if (data.milestone) {
        const c = celebrationFor(data.milestone);
        if (c) setCelebration(c);
      }
    } catch {
      setTasksDone((prev) => ({ ...prev, [String(task.order)]: !next }));
    } finally {
      setSaving(null);
    }
  };

  const toggleBreak = () => {
    if (!breakToday?.item_key) return;

    const next = !breakDone;
    setBreakDone(next);

    axios
      .post(`/week/${week.number}/break-time`, {
        item: breakToday.item_key,
        done: next,
        // ما كُتب يُرسَل مع كل تأشير كي لا يضيع عند إعادة التأشير
        note: next ? breakSaved || null : null,
      })
      .catch(() => setBreakDone(!next));
  };

  /**
   * حفظ ما التقطه.
   *
   * الكتابة نفسها تُؤشّر النشاط منجَزاً: ما كُتب دليلٌ أقوى من زرٍّ
   * نُقر، ولا يُطلب من أحد تأكيد ما فعله مرتين.
   */
  const saveBreakNote = () => {
    if (!breakToday?.item_key) return;

    const text = breakNote.trim();
    setBreakSaved(text);
    setBreakDone(true);

    axios
      .post(`/week/${week.number}/break-time`, {
        item: breakToday.item_key,
        done: true,
        note: text || null,
      })
      .catch(() => setBreakSaved(breakToday.item_note ?? ''));
  };

  const genderOf = (d: DialogueBlock, speaker: string): Gender | undefined =>
    d.speaker_genders?.[speaker] ?? d.speaker_genders?.[speaker.toUpperCase()];

  const playDialogue = (d: DialogueBlock) => {
    stopSeq.current?.();

    /*
     * Stage directions are not spoken: the reader hears a conversation,
     * not somebody narrating the passage of time. Two dialogues carry
     * one — "(later)" in week 3 and "(the next day)" in week 11.
     *
     * But the original position has to travel with each line. The
     * highlight compares against the index in `d.lines`, while
     * `onLine` reports a position in the filtered array, so every line
     * after a stage direction used to light up one line early — ten of
     * them in week 11, where the direction sits in the middle.
     */
    const spoken = d.lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.speaker);

    stopSeq.current = speakSequence(
      spoken.map(({ line }) => ({ text: line.en, gender: genderOf(d, line.speaker) })),
      {
        rate,
        onLine: (i) => setPlaying({ dialogue: d.number, index: spoken[i].index }),
        onDone: () => setPlaying(null),
      },
    );
  };

  const stopAll = () => {
    stopSeq.current?.();
    stopSeq.current = null;
    setPlaying(null);
    stop();
  };

  /* ================================================================
   |  كتل المحتوى التعليمي
   |================================================================ */

  const renderBlock = (block: Block, key: number) => {
    switch (block.type) {
      /* ---------- المفردات: العربي أولاً كما ينصّ الكتاب ---------- */
      case 'vocabulary':
        return (
          <div key={key} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h4 className="font-semibold text-slate-800">
                {groupName(block)}
              </h4>
              <span className="text-xs text-slate-500">{block.items.length} كلمة</span>
            </div>

            <div className="grid gap-1.5 sm:grid-cols-2">
              {block.items.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white
                             px-3 py-2 ring-1 ring-slate-200"
                >
                  <span className="min-w-0 truncate text-sm text-slate-700">{w.arabic}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-start">
                      <p className="text-sm font-medium text-slate-900" dir="ltr">
                        {w.word}
                      </p>
                      {w.ipa && (
                        <p className="font-mono text-[10px] text-slate-400" dir="ltr">
                          {w.ipa}
                        </p>
                      )}
                    </div>
                    <Listen text={w.word} size="sm" />
                  </div>
                </div>
              ))}
            </div>

            <details className="rounded-lg bg-white ring-1 ring-slate-200">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-violet-700">
                {tr('درّبها بالبطاقات — عربي ثم أنتِج الإنجليزية')}
              </summary>
              <div className="border-t border-slate-100 p-3">
                <Flashcards
                  words={block.items}
                  groupLabel={groupName(block)}
                  onProgress={(d, t) => setInner({ done: d, total: t })}
                />
              </div>
            </details>
          </div>
        );

      /* ---------- الحوار كمحادثة بصوتين ---------- */
      case 'dialogue':
        return (
          <div key={key} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="font-semibold text-slate-800" dir="ltr">
                {block.title}
              </h4>
              <span className="text-xs text-slate-500">{block.lines.length} سطراً</span>
            </div>
            <p className="text-xs text-slate-500">{block.situation_ar ?? block.situation_en}</p>

            <button
              onClick={() =>
                playing?.dialogue === block.number ? stopAll() : playDialogue(block)
              }
              disabled={!supported}
              className="stamp w-full py-2.5 text-sm font-medium
                         transition hover:bg-violet-700 disabled:cursor-not-allowed
                         disabled:opacity-50"
            >
              {playing?.dialogue === block.number ? <><Square aria-hidden size={14} fill="currentColor" className="inline-block align-[-3px]" /> {tr('أوقف')}</> : <><Play aria-hidden size={14} fill="currentColor" className="inline-block align-[-3px]" /> {tr('شغّل الحوار كاملاً')}</>}
            </button>

            <div className="space-y-2.5">
              {block.lines.map((line, i) => {
                // A scene break, not a turn — it belongs to nobody
                if (!line.speaker) {
                  return <StageDirection key={i} en={line.en} ar={line.ar} />;
                }

                const gender = genderOf(block, line.speaker);
                const isFemale = gender === 'f';
                const active = playing?.dialogue === block.number && playing?.index === i;

                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 ${isFemale ? '' : 'flex-row-reverse'}`}
                  >
                    <span
                      className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full
                                  text-xs font-bold text-white
                                  ${isFemale ? 'bg-rose-400' : 'bg-sky-500'}
                                  ${active ? 'ring-2 ring-offset-2 ' + (isFemale ? 'ring-rose-300' : 'ring-sky-300') : ''}`}
                      title={line.speaker}
                    >
                      {line.speaker.charAt(0)}
                    </span>

                    <div
                      className={`min-w-0 max-w-[85%] rounded-2xl px-4 py-2.5
                                  ${
                                    isFemale
                                      ? 'rounded-tr-sm bg-rose-50 ring-1 ring-rose-100'
                                      : 'rounded-tl-sm bg-sky-50 ring-1 ring-sky-100'
                                  }
                                  ${active ? 'shadow-md ring-2 ' + (isFemale ? 'ring-rose-300' : 'ring-sky-300') : ''}`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={`text-[11px] font-bold ${
                            isFemale ? 'text-rose-700' : 'text-sky-700'
                          }`}
                          dir="ltr"
                        >
                          {line.speaker}
                        </span>
                        {supported && (
                          <Listen text={line.en} gender={gender} size="sm" />
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-slate-900" dir="ltr">
                        {line.en}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500">{line.ar}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      /* ---------- النطق: استماع قبل إنتاج ---------- */
      case 'minimal_pairs':
        return (
          <div key={key} className="space-y-3">
            <p className="text-sm leading-relaxed text-slate-600">
              <strong className="text-slate-800">{tr('الاستماع أولاً.')}</strong> {tr('لا يمكنك إنتاج صوت لا تسمعه. اسمع الكلمتين، ثم العب — الهدف 11 من 12.')}
            </p>

            {block.groups.map((g) => (
              <div key={g.label_en} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {g.label_ar ?? g.label_en}
                  </p>
                  <p className="shrink-0 font-mono text-sm text-violet-700" dir="ltr">
                    {g.ipa}
                  </p>
                </div>

                {/* سطر التدريب: ما الفرق وكيف تصنعه — وبدونه الاسم وحده لا يعلّم */}
                {g.hint_ar && (
                  <p className="mb-3 text-xs leading-relaxed text-slate-600">{g.hint_ar}</p>
                )}

                <div className="flex flex-wrap gap-2" dir="ltr">
                  {g.pairs.map((p) => (
                    <div key={p.id} className="flex overflow-hidden rounded-lg ring-1 ring-slate-200">
                      {[p.word_a, p.word_b].map((w, i) => (
                        <button
                          key={w}
                          onClick={() => speak(w, { rate: myRate, gender: myVoice })}
                          disabled={!supported}
                          className={`bg-white px-3 py-1.5 text-xs font-medium text-slate-700
                                      transition hover:bg-violet-600 hover:text-white
                                      disabled:opacity-50
                                      ${i === 0 ? 'border-e border-slate-200' : ''}`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <details className="rounded-lg bg-white ring-1 ring-slate-200">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-violet-700">
                {tr('ابدأ لعبة التمييز الصوتي')}
              </summary>
              <div className="border-t border-slate-100 p-3">
                <MinimalPairGame
                  groups={block.groups}
                  target={11}
                  production={block.production}
                  onProgress={(d, t) => setInner({ done: d, total: t })}
                />
              </div>
            </details>
          </div>
        );

      /* ---------- التمارين ---------- */
      case 'exercises':
        return (
          <div key={key}>
            {block.items.length > 0 ? (
              <ExerciseRunner
                exercises={block.items}
                onProgress={(d, t) => setInner({ done: d, total: t })}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5 text-center">
                <p className="text-sm font-medium text-amber-900">
                  {tr('لا توجد تمارين مُدخلة لهذا اليوم')}
                </p>
                <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-amber-800">
                  المهمة تشير إلى تمارين اليوم {block.day}، لكن ملف المحتوى لا
                  يحتوي أي تمرين بهذا الرقم. راجع مفتاح الإجابات في الكتاب
                  وأشّر المهمة.
                </p>
              </div>
            )}
          </div>
        );

      /* ---------- التسجيل ---------- */
      case 'record':
        return (
          <div key={key} className="space-y-4">
            {/* الموضوع أولاً ثم المسجّل — لا مسجّل بلا موضوع */}
            {block.speaking && <SpeakingBrief speaking={block.speaking} />}

            <Recorder
              weekNumber={week.number}
              isBaseline={block.baseline}
              targetSeconds={
                block.speaking?.target_seconds ?? (block.baseline ? 120 : 90)
              }
            />
          </div>
        );

      /* ---------- الكتابة ---------- */
      case 'writing':
        return (
          <div key={key}>
            {block.writing ? (
              <WritingTask
                weekNumber={week.number}
                writing={block.writing}
                existing={myWriting}
              />
            ) : (
              <p className="text-sm text-slate-500">{tr('لا توجد مهمة كتابة في هذا الأسبوع.')}</p>
            )}
          </div>
        );

      /* ---------- أقسام الشرح ---------- */
      case 'section':
        return (
          <div key={key}>
            <SectionView section={block.section} rate={rate} voice={voice}
                    showTranslation={prefs.showTranslation}
                    weekNumber={week.number} myComparison={myComparison} myNotes={myNotes} />
          </div>
        );

      /* ---------- المراجعة المتباعدة ---------- */
      case 'review':
        return (
          <div key={key}>
            <ReviewSession
              weekNumber={week.number}
              dayNumber={day.number}
              onFinished={() => {
                const task = day.tasks.find((t) =>
                  t.blocks.some((b) => b.type === 'review'),
                );
                if (task && !tasksDone[String(task.order)]) toggle(task);
              }}
            />
          </div>
        );

      /* ---------- مرجع من الكتاب بلا واجهة ---------- */
      case 'unbuilt':
        return (
          <div
            key={key}
            className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5"
          >
            <p className="font-medium text-slate-700">
              {tr(UNBUILT_LABELS[block.ref.split(':')[0]] ?? block.ref)}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              {tr('هذا القسم موجود في الكتاب المطبوع ولم تُبنَ واجهته في المنصة بعد. افتح الكتاب على هذا القسم، أنجزه، ثم أشّر المهمة.')}
            </p>
            <p className="mt-2 font-mono text-xs text-slate-400" dir="ltr">
              {block.ref}
            </p>
          </div>
        );
    }
  };

  return (
    <div dir={dirOf(locale)} className="min-h-screen bg-slate-50 pb-8 sm:pb-24">
      <Head title={`الأسبوع ${week.number} · اليوم ${day.number}`} />

      <AppNav />

      {/*
        ============ الرأس ============
        صفحة اليوم أطول صفحة في المنصة، والرأس فيها يجب أن يُخلي
        الشاشة للمحتوى بسرعة — فهو سطران وشريط تقدّم رقيق، بلا لوح
        ملوّن. والنيلي هنا لأن الأخضر محفوظ لـ«تمّ».
      */}
      <header className="book-head relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-violet-400/25 blur-3xl"
        />

        <div className="relative mx-auto max-w-4xl px-4 py-4 sm:py-5">
          <div className="flex items-center gap-2 text-xs text-violet-100/85">
            <Link href="/dashboard" className="transition hover:text-white">
              {tr('لوحة التقدّم')}
            </Link>
            <span aria-hidden><ChevronLeft aria-hidden size={16} /></span>
            <Link
              href={`/week/${week.number}`}
              className="transition hover:text-white"
            >
              الأسبوع {week.number}
            </Link>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
              <span className="text-xs font-medium text-violet-100/85">{tr('يوم')}</span>
              <span className="-mt-0.5 text-xl font-bold text-white">{day.number}</span>
            </div>

            <div className="min-w-0 flex-1">
              {/* الأساس بارز والثانوي تحته أخفت — كلاهما يُحتاج:
                  العربي للفهم السريع، والإنجليزي ليجده في أي مصدر */}
              <h1
                className="truncate text-sm font-semibold text-white sm:text-base"
                dir={dirFor(dayName.primary)}
              >
                {dayName.primary}
              </h1>
              {dayName.secondary && (
                <p
                  className="hidden truncate text-xs text-violet-100/70 sm:block"
                  dir={dirFor(dayName.secondary)}
                >
                  {dayName.secondary}
                </p>
              )}
              <p className="mt-0.5 text-xs text-violet-100/80">
                {doneCount} من {total} مهام · {day.minutes * multiplier} دقيقة
              </p>
            </div>

            <span
              className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1.5 text-sm font-bold
                         text-white ring-1 ring-white/20 backdrop-blur"
            >
              {percent}%
            </span>
          </div>
        </div>
      </header>

      {/* ============ الشريط الملتصق: أين أنت + سرعة النطق ============

           كان شريط الخطوات يمرّ مع الصفحة، فالمهمّة الطويلة تدفع
           المتدرّب إلى العودة للأعلى ليعرف في أي خطوة هو — وهذا يكسر
           التركيز في كل مرة. فالتصق.

           ولئلا يصير ثلاثة أشرطة فوق بعضها على شاشة صغيرة، ضُمّت
           السرعة إلى سطر الموضع نفسه.

           والألوان درجتان من لون الهوية لا لونان مختلفان: الأخضر في
           المنصة يعني «صحيح» في التمارين، فاستعماله هنا للإنجاز يجعل
           المتدرّب يقرأ «أجبت صواباً» حيث المقصود «أنهيت». الدرجة
           الغامقة لما مضى والفاتحة لما أنت فيه — التمييز في الشدّة
           لا في اللون.
      */}
      <div className="sticky top-11 z-30 border-b border-slate-200 bg-white/95 backdrop-blur sm:top-14">
        <div className="mx-auto max-w-4xl px-4 py-2">

          {/* شريط واحد هرميّ: كل مهمة خانة، والنشطة تتّسع وتتفرّع */}
          <div className="flex items-stretch gap-1.5">
            {day.tasks.map((t, i) => {
              const done = tasksDone[String(t.order)] ?? false;
              const active = mode === 'wizard' && step === i;

              /*
               * القفز إلى الأمام ممنوع.
               *
               * الزرّ الرئيسي يفرض المرور بكل خطوة داخل المهمّة، لكن
               * الشريط كان ثغرة: ضغطةٌ على خانة لاحقة تتخطّى المهمّة
               * الحالية وخطواتها كلها. والترتيب ليس تنظيماً شكلياً —
               * الكتاب يبني اليوم على تسلسل: تسمع قبل أن تنطق، وتقرأ
               * القاعدة قبل أن تُمرَّن عليها.
               *
               * والرجوع مسموح دائماً: المتدرّب يعود إلى ما أنجزه
               * مراراً قبل أن يرسخ، ومنعه من ذلك عقاب بلا سبب.
               */
              const reachable = taskReachable(t);

              return (
                <button
                  key={t.order}
                  onClick={() => { if (reachable) { setMode('wizard'); goToStep(i); } }}
                  disabled={!reachable}
                  title={
                    reachable
                      ? taskName(t).primary
                      : tr('أنهِ المهمّة الحالية أولاً')
                  }
                  aria-label={taskName(t).primary}
                  aria-disabled={!reachable}
                  aria-current={active ? 'step' : undefined}
                  className={`group relative min-h-6 rounded-lg transition-all
                              ${active ? 'flex-[2.2]' : 'flex-1'}
                              ${reachable ? '' : 'cursor-not-allowed'}`}
                >
                  <span
                    className={`flex h-2.5 w-full overflow-hidden rounded-full transition ${
                      active
                        ? 'bg-violet-100'
                        : done
                          ? 'bg-violet-700'
                          : reachable
                            ? 'bg-slate-200 group-hover:bg-slate-300'
                            : 'bg-slate-100'
                    }`}
                  >
                    {active && slices.length > 1
                      ? slices.map((_, k) => (
                          <span
                            key={k}
                            className={`relative h-full flex-1 overflow-hidden border-e
                                        border-white/70 last:border-0 transition ${
                                          k < innerStep
                                            ? 'bg-violet-700'
                                            : 'bg-violet-100'
                                        }`}
                          >
                            {/* الخطوة الحالية تمتلئ بتقدّم النشاط داخلها */}
                            {k === innerStep && (
                              <span
                                // `start-0` تنقلب مع الاتجاه — التقدّم يسير كاتّجاه القراءة
                                className="absolute inset-y-0 start-0 bg-violet-400 transition-all duration-300"
                                style={{
                                  width: inner && inner.total
                                    ? `${Math.round((inner.done / inner.total) * 100)}%`
                                    : '100%',
                                }}
                              />
                            )}
                          </span>
                        ))
                      : active && (
                          <span className={`h-full w-full ${done ? 'bg-violet-700' : 'bg-violet-400'}`} />
                        )}
                  </span>

                  <span
                    className={`mt-1 block text-center text-xs leading-none transition ${
                      active
                        ? 'font-bold text-violet-700'
                        : done
                          ? 'text-violet-600'
                          : reachable
                            ? 'text-slate-400'
                            : 'text-slate-300'
                    }`}
                  >
                    {done && !active ? <Check size={14} /> : reachable ? t.order : <Lock size={12} />}
                  </span>
                </button>
              );
            })}
          </div>

          {/* سطر واحد: أين أنت يميناً، وسرعة النطق يساراً */}
          <div className="mt-1.5 flex items-center justify-between gap-3">
            {mode === 'wizard' && day.tasks[step] ? (
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs text-slate-500">
                <span className="shrink-0 font-semibold text-slate-800">
                  المهمة {step + 1}/{total}
                </span>
                {slices.length > 1 && (
                  <span className="shrink-0 rounded-md bg-violet-50 px-1.5 py-0.5 text-xs font-medium text-violet-700">
                    خطوة {innerStep + 1}/{slices.length}
                  </span>
                )}
                {inner && inner.total > 1 && (
                  <span className="shrink-0 rounded-md bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-800">
                    {Math.min(inner.done + 1, inner.total)}/{inner.total}
                  </span>
                )}
                <span className="truncate">
                  {sliceTitle(slices[innerStep], innerStep, slices.length) ||
                    taskName(day.tasks[step]).primary}
                </span>
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                {doneCount} من {total} مهام
              </p>
            )}

            {supported && (
              <SpeechControls voice={voice} onVoice={setVoice} rate={rate} onRate={setRate} size="sm" />
            )}
          </div>
        </div>
      </div>


      <main ref={contentTop} className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        {/* ============ المهام ============ */}
        {(mode === 'wizard' ? visibleTasks : day.tasks).map((task) => {
          const checked = tasksDone[String(task.order)] ?? false;
          const isSaving = saving === task.order;
          const isLastStep = mode === 'wizard' && step >= total - 1;

          return (
            <section
              key={task.order}
              className={`overflow-hidden rounded-2xl bg-white transition
                          ${mode === 'wizard' ? 'ring-1 ring-violet-300 shadow-sm' : 'ring-1 ring-slate-200'}`}
            >
              {/* رأس المهمة */}
              <div
                className={`flex items-start gap-3 p-5 ${
                  checked ? 'bg-emerald-50/50' : 'bg-violet-50/50'
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm
                              font-bold ${
                                checked
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-violet-600 text-white'
                              }`}
                >
                  {checked ? <Check size={15} /> : task.order}
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className={`font-medium ${
                      checked ? 'text-slate-400 line-through' : 'text-slate-900'
                    }`}
                    dir={dirFor(taskName(task).primary)}
                  >
                    {taskName(task).primary}
                  </p>
                  {taskName(task).secondary && (
                    <p className="hidden text-xs text-slate-400 sm:block" dir={dirFor(taskName(task).secondary!)}>
                      {taskName(task).secondary}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-500">
                    {task.minutes * multiplier} دقيقة
                  </p>
                </div>


              </div>

              {/* محتوى المهمة —
                  في الخطوات: شريحة واحدة، والقسم wizard بنفسه.
                  في الوضع الكامل: كل الكتل، للمراجعة والتمرير. */}
              {task.blocks.length > 0 ? (
                <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5">
                  {mode === 'wizard' ? (
                    <div className="space-y-4">
                      {slices[innerStep] && renderBlock(slices[innerStep], innerStep)}

                    </div>
                  ) : (
                    <div className="space-y-5">
                      {task.blocks.map((b, i) => renderBlock(b, i))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
                  <p className="text-xs leading-relaxed text-slate-500">
                    {tr('هذه المهمة تُنجز في الكتاب المطبوع. أنجزها ثم أشّرها.')}
                  </p>
                </div>
              )}

              {/* ============ التأشير والتنقّل ============

                   ملتصق بأسفل الشاشة على الموبايل.

                   المحتوى يختلف طولاً اختلافاً شديداً: لعبة تمييز
                   صوتي تسع الشاشة، ونصّ قراءة من ثماني فقرات لا يسع.
                   فحبس المحتوى في صندوق تمرير بارتفاع ثابت — «المهمّة
                   كشاشة» — يريح القصير ويخنق الطويل، ويورّث تمريراً
                   متداخلاً هشّاً على iOS.

                   والمقصود من الفكرة أن يكون «التالي» في متناول
                   الإبهام دائماً، وهذا يتحقّق بالتصاق الشريط وحده:
                   المحتوى يمرّ طبيعياً، والزرّ لا يغيب.
              */}
              <div
                className="border-t border-slate-100 bg-white p-4
                           max-sm:sticky max-sm:bottom-0 max-sm:z-20"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              >
                {mode === 'wizard' ? (
                  /*
                   * تنقّل واحد لا اثنان.
                   *
                   * كان هنا زرّان للتنقّل داخل القسم وزرّان للتنقّل بين
                   * المهام — أربعة أزرار في شاشة واحدة، ولا يعرف المتدرّب
                   * أيّها يقدّمه. فصارا سلسلة واحدة: «التالي» ينتقل إلى
                   * الشريحة التالية، فإن كانت الأخيرة أنهى المهمة وانتقل
                   * إلى التالية. و«رجوع» يعود في السلسلة نفسها.
                   */
                  <div className="flex gap-2">
                    {(step > 0 || innerStep > 0) && (
                      <button
                        onClick={() => {
                          if (innerStep > 0) goToSlice(innerStep - 1);
                          else goToStep(step - 1);
                        }}
                        className="min-h-12 shrink-0 rounded-xl bg-white px-4 text-sm text-slate-600
                                   ring-1 ring-slate-200 transition hover:ring-slate-300
                                   active:scale-95"
                      >
                        {tr('رجوع')}
                      </button>
                    )}

                    <button
                      onClick={async () => {
                        // ① خطوة تالية داخل المهمّة
                        if (!atLastSlice) { goToSlice(innerStep + 1); return; }

                        // ② المهمّة تُؤشَّر إن لم تكن مؤشَّرة
                        if (!checked) await toggle(task);

                        // ③ مهمّة تالية إن وُجدت
                        if (!isLastStep) { goToStep(step + 1); return; }

                        /*
                         * ④ آخر مهمّة — «أنهِ اليوم».
                         *
                         * كان الزرّ هنا لا يفعل شيئاً إن كانت المهمّة
                         * مؤشَّرة أصلاً: الشرطان الأولان يمرّان والثالث
                         * كاذب، فيبقى الضغط بلا أثر. ولوحة الإتمام في
                         * أسفل الصفحة، والمتدرّب لا يعرف أنها هناك.
                         *
                         * فالزرّ الآن يُنزل إليها — وهي التي تحمل
                         * زرّ اليوم التالي والعودة إلى الأسبوع.
                         */
                        requestAnimationFrame(() => {
                          const end = document.getElementById('day-end');
                          if (end) end.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          else window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                        });
                      }}
                      disabled={isSaving}
                      className={`min-h-12 flex-1 rounded-xl text-sm font-semibold transition
                                  active:scale-95 disabled:opacity-50 ${
                                    checked && atLastSlice
                                      ? 'bg-violet-600 text-white hover:bg-violet-700'
                                      : 'bg-slate-900 text-white hover:bg-slate-800'
                                  }`}
                    >
                      {isSaving
                        ? tr('يحفظ…')
                        : !atLastSlice
                          ? <>{`التالي  ${innerStep + 1}/${slices.length}`} <ArrowLeft aria-hidden size={15} className="inline-block align-[-3px]" /></>
                          : isLastStep
                            ? checked
                              ? tr('أنهِ اليوم')
                              : tr('أنجزتها — أنهِ اليوم')
                            : checked
                              ? <>{tr('المهمة التالية')} <ArrowLeft aria-hidden size={15} className="inline-block align-[-3px]" /></>
                              : <>{tr('أنجزتها — المهمة التالية')} <ArrowLeft aria-hidden size={15} className="inline-block align-[-3px]" /></>}
                    </button>
                  </div>
                ) : taskReachable(task) ? (
                  <button
                    onClick={() => toggle(task)}
                    disabled={isSaving}
                    className={`min-h-12 w-full rounded-xl text-sm font-semibold transition
                                disabled:opacity-50 ${
                                  checked
                                    ? 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                                    : 'bg-slate-900 text-white hover:bg-slate-800'
                                }`}
                  >
                    {isSaving
                      ? tr('يحفظ…')
                      : checked
                        ? <><Check aria-hidden size={15} className="inline-block align-[-3px]" /> {tr('أنجزتها — اضغط للتراجع')}</>
                        : tr('أنجزت هذه المهمة')}
                  </button>
                ) : (
                  /*
                   * الوضع الكامل عرضٌ ومراجعة، لا باب خلفي.
                   *
                   * كان يعرض كل مهامّ اليوم بأزرارها، فيؤشّر المتدرّب
                   * المهمّة السابعة قبل الثانية — والترتيب في هذا
                   * الكتاب ليس تنظيماً: تسمع قبل أن تنطق، وتقرأ
                   * القاعدة قبل أن تُمرَّن عليها.
                   */
                  <p className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-50 py-3 text-center text-xs text-slate-500">
                    <Lock aria-hidden size={13} />
                    {tr('تُفتح بعد إتمام المهام التي قبلها')}
                  </p>
                )}
              </div>
            </section>
          );
        })}

        {/* التبديل بين الوضعين */}
        <button
          onClick={() => setMode((m) => (m === 'wizard' ? 'full' : 'wizard'))}
          className="w-full rounded-xl bg-white py-3 text-sm font-medium text-slate-600
                     ring-1 ring-slate-200 transition hover:ring-slate-300"
        >
          {mode === 'wizard'
            ? tr('اعرض اليوم كاملاً في صفحة واحدة')
            : tr('عد إلى الخطوات — مهمة واحدة في كل مرة')}
        </button>

        {/* ============ نهاية اليوم ============ */}
        {isComplete ? (
          <div id="day-end" className="scroll-mt-32 rounded-2xl bg-emerald-50 p-6 text-center ring-1 ring-emerald-200">
            <CircleCheck aria-hidden size={36} strokeWidth={1.5} className="mx-auto text-emerald-600" />
            <p className="mt-2 font-bold text-emerald-900">
              اكتمل اليوم {day.number}
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-emerald-800">
              {day.number < lastDay
                ? tr('اليوم التالي مفتوح الآن. أغلق الصفحة وعد غداً — هذا ما يبني السلسلة.')
                : tr('أنهيت الأسبوع كاملاً.')}
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {day.number < lastDay && nextDayUnlocked && (
                <Link
                  href={`/week/${week.number}/day/${day.number + 1}`}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium
                             text-white transition hover:bg-emerald-700"
                >
                  اليوم {day.number + 1} <ArrowLeft aria-hidden size={15} className="inline-block align-[-3px]" />
                </Link>
              )}
              <Link
                href={`/week/${week.number}`}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-slate-700
                           ring-1 ring-slate-200 transition hover:ring-slate-300"
              >
                {tr('عد إلى الأسبوع')}
              </Link>
            </div>
          </div>
        ) : (
          <div id="day-end" className="scroll-mt-32 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center">
            <p className="text-sm text-slate-600">
              بقيت {total - doneCount} من {total} مهام. اليوم التالي يُفتح عند
              إتمامها كلها.
            </p>
          </div>
        )}

        {/* ============ وقت الاستراحة لهذا اليوم ============
             خارج ساعة الدراسة ولا يُحتسب في مهام اليوم الخمس.
             موضعه هنا بعد المهام لا قبلها: أولاً ساعة الدراسة،
             ثم ما يُستمتع به. */}
        {breakToday && (
          <section className="overflow-hidden rounded-2xl bg-fuchsia-50/60 ring-1 ring-fuchsia-200">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-fuchsia-700">
                  <Headphones aria-hidden size={15} />
                  وقت الاستراحة · اليوم {breakToday.day_number}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-fuchsia-600 ring-1 ring-fuchsia-200">
                    {tr('خارج ساعة الدراسة')}
                  </span>
                </p>

                {/* اسم النشاط عنواناً، وعملُ اليوم تحته — لا العكس:
                    «الأغنية + مهمّة تعقّب النبر» عنوانٌ لا يقول شيئاً
                    وحده، و«أغنية الأسبوع» يقول عمّ نتكلّم */}
                <p
                  className={`mt-1.5 font-semibold ${
                    breakDone ? 'text-slate-400 line-through' : 'text-slate-900'
                  }`}
                >
                  {breakToday.item_label_ar ?? breakToday.activity_ar}
                </p>

                {breakToday.item_label_ar && (
                  <p className="mt-0.5 text-sm text-slate-700">
                    {tr('اليوم:')} {breakToday.activity_ar}
                  </p>
                )}

                <p className="mt-0.5 text-xs text-slate-500">
                  {breakToday.minutes} دقيقة · خارج مهام اليوم
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">

                {breakToday.item_key && (
                  <button
                    onClick={toggleBreak}
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      breakDone
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300'
                    }`}
                  >
                    {breakDone ? <><Check aria-hidden size={15} className="inline-block align-[-3px]" /> {tr('أنجزته')}</> : tr('أشّر كمنجَز')}
                  </button>
                )}

                <Link
                  href={`/week/${week.number}#breaktime`}
                  className="rounded-xl bg-white px-4 py-2.5 text-sm text-slate-600
                             ring-1 ring-slate-200 transition hover:ring-slate-300"
                >
                  {tr('كل الأنشطة')}
                </Link>
              </div>
            </div>

            {/* ماذا أفعل بالضبط — الخطوات من الكتاب.
                هذه هي التي كانت مفقودة: العنوان يقول «تعقّب النبر»
                ولا يقول كيف، فيُقرأ ثم يُتخطّى. */}
            {(breakToday.item_steps.length > 0 || breakToday.link?.note_ar || breakToday.link?.note_en) && (
              <div className="border-t border-fuchsia-100 bg-white/70 px-5 py-4">
                {/* تعريف المصدر: «Extra English» اسمٌ لا يعرفه أحد */}
                {(breakToday.link?.note_ar || breakToday.link?.note_en) && (
                  <p className="mb-3 rounded-lg bg-fuchsia-50/70 p-3 text-xs leading-relaxed text-fuchsia-900">
                    <strong><Bdi>{breakToday.link?.label}</Bdi></strong>
                    {' — '}
                    {breakToday.link?.note_ar ? (
                      breakToday.link.note_ar
                    ) : (
                      <span dir="ltr">{breakToday.link?.note_en}</span>
                    )}
                  </p>
                )}

                {breakToday.item_steps.length > 0 && (
                  <>
                    <p className="mb-2 text-xs font-bold text-slate-800">
                      {tr('ماذا تفعل')}
                    </p>

                    <ol className="space-y-1.5">
                      {breakToday.item_steps.map((step, i) => (
                        <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-700">
                          <span
                            className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full
                                       bg-fuchsia-100 text-xs font-bold text-fuchsia-700"
                          >
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </>
                )}

                {breakToday.item_why_ar && (
                  <p className="mt-3 border-t border-slate-100 pt-2.5 text-xs leading-relaxed text-slate-500">
                    {breakToday.item_why_ar}
                  </p>
                )}
              </div>
            )}

            {/* مهمّة الملاحظة — سطر واحد يحوّل المشاهدة السلبية إلى
                انتباه. لا يُقيَّم ولا يُصحَّح ولا يقفل شيئاً؛ غرضه أن
                يبقى منه أثر بعد أن ينتهي الفيديو */}
            {breakToday.item_prompt_ar && (
              <div className="border-t border-fuchsia-100 bg-white/70 p-5 pt-4">
                <label className="flex items-center gap-1.5 text-xs font-bold text-fuchsia-900">
                  <PenLine aria-hidden size={14} /> {breakToday.item_prompt_ar}
                </label>

                <textarea
                  value={breakNote}
                  onChange={(e) => setBreakNote(e.target.value)}
                  rows={2}
                  placeholder={tr('اكتب ما التقطته…')}
                  className="ruled mt-2 resize-y text-sm"
                />

                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-fuchsia-700/70">
                    {tr('لك وحدك — لا يُصحَّح ولا يُقيَّم')}
                  </p>

                  {breakNote.trim() !== breakSaved.trim() ? (
                    <button
                      onClick={saveBreakNote}
                      className="shrink-0 rounded-lg bg-fuchsia-600 px-3.5 py-2 text-xs font-medium
                                 text-white transition hover:bg-fuchsia-700"
                    >
                      {tr('احفظ')}
                    </button>
                  ) : breakSaved ? (
                    <span className="shrink-0 text-xs font-medium text-emerald-600">
                      <Check aria-hidden size={15} className="inline-block align-[-3px]" /> {tr('محفوظ')}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        )}

        {/* التنقّل بين الأيام */}
        <div className="flex justify-between gap-2 pt-2">
          {day.number > 1 ? (
            <Link
              href={`/week/${week.number}/day/${day.number - 1}`}
              className="rounded-xl bg-white px-4 py-2 text-sm text-slate-600
                         ring-1 ring-slate-200 transition hover:ring-slate-300"
            >
              → اليوم {day.number - 1}
            </Link>
          ) : (
            <span />
          )}

          {day.number < lastDay && nextDayUnlocked && (
            <Link
              href={`/week/${week.number}/day/${day.number + 1}`}
              className="rounded-xl bg-white px-4 py-2 text-sm text-slate-600
                         ring-1 ring-slate-200 transition hover:ring-slate-300"
            >
              اليوم {day.number + 1} <ArrowLeft aria-hidden size={15} className="inline-block align-[-3px]" />
            </Link>
          )}
        </div>
      </main>

      <Celebrate celebration={celebration} onClose={() => setCelebration(null)} />
    </div>
  );
}
