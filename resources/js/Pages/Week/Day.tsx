import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Spelling, { type SpellWord, type SpellRound } from '@/Components/Game/Spelling';
import Watch, { type WatchData } from '@/Components/Game/Watch';
import StoryStation, { type StoryStationData } from '@/Components/Game/StoryStation';
import ChallengeStation, { type ChallengeData } from '@/Components/Game/ChallengeStation';
import Imitate, { type ImitateItem } from '@/Components/Game/Imitate';
import Homework, { type HomeworkData } from '@/Components/Game/Homework';
import VocabPractice from '@/Components/Game/VocabPractice';
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
import { taskKind, TONES } from '@/lib/taskKinds';
import DayJourney from '@/Components/DayJourney';
import { ArrowLeft, ArrowRight, Check, Map as MapIcon, ChevronLeft, CircleCheck, Clock, Headphones, Lock, PenLine, Play, Settings2, Smartphone, Square, X } from 'lucide-react';
import MemoryLauncher from '@/Components/Memory/MemoryLauncher';

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

interface SpellingBlock {
  type: 'spelling';
  review: boolean;
  rounds: SpellRound[];
  words: SpellWord[];
}

interface WatchBlock extends WatchData {
  type: 'watch';
}

interface StoryBlock extends StoryStationData {
  type: 'story';
}

interface ChallengeBlock extends ChallengeData {
  type: 'challenge';
}

interface HomeworkBlock extends HomeworkData {
  type: 'homework';
}

interface ImitateBlock {
  type: 'imitate';
  item: ImitateItem;
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
  | SpellingBlock
  | WatchBlock
  | StoryBlock
  | ChallengeBlock
  | ImitateBlock
  | HomeworkBlock
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
  section: 'قسم من الدرس',
};

/**
 * Into document.body when `on`. A page or a station that animates with
 * a transform pins anything `fixed` inside it to itself — the focus bar
 * floated mid-screen — so a pinned bar has to live outside them.
 */
function MaybePortal({ on, children }: { on: boolean; children: React.ReactNode }) {
  return on ? createPortal(children, document.body) : <>{children}</>;
}

/** Said when a station is done — short, varied, never the same twice in a row */
const PRAISE = ['أحسنت!', 'رائع!', 'ممتاز!', 'عمل جميل!', 'خطوة أخرى!', 'استمرّ هكذا!', 'أنت تتقدّم!'];

export default function DayPage({
  week,
  day,
  stats,
  lastDay,
  nextDayUnlocked,
  myWriting,
  myComparison,
  myNotes,
  prefs = DEFAULT_PREFS,
}: Props) {
  const tr = useT();

  /** ما يقوله رفيق الآن — أو لا شيء، وهو الأشيع */
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [tasksDone, setTasksDone] = useState(day.tasks_done);
  const [saving, setSaving] = useState<number | null>(null);

  /** The task whose "done" stamp is landing right now */
  const [stamped, setStamped] = useState<number | null>(null);

  /**
   * A save the server refused. It used to be undone silently and the
   * page moved on anyway, so the learner saw the next task, could not
   * finish it, and was told nothing.
   */
  const [saveFailed, setSaveFailed] = useState<number | null>(null);
  /** The server's own reason, when it answered with one */
  const [saveError, setSaveError] = useState<string | null>(null);

  /** Today's homework proof — the day does not finish without it */
  const [homeworkProof, setHomeworkProof] = useState(
    (myNotes?.homework as Record<string, string> | undefined)?.[`day${day.number}`] ?? '',
  );
  /** Today's episode proof — an English line heard in it */
  const [watchProof, setWatchProof] = useState(
    (myNotes?.watch as Record<string, string> | undefined)?.[`day${day.number}`] ?? '',
  );
  /** Today's story proof — the moral found and a sentence from it */
  const [storyProof, setStoryProof] = useState(
    (myNotes?.story as Record<string, string> | undefined)?.[`day${day.number}`] ?? '',
  );
  const [needsProof, setNeedsProof] = useState(false);

  /*
   * Which steps the learner actually finished.
   *
   * "Next" used to move on whatever had happened — a spelling drill
   * with nothing typed counted as done. Now an exercise step must report
   * its own end (each drill calls onComplete); reading steps — an
   * explanation, a dialogue, a word list — stay free to pass.
   */
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [needsFinish, setNeedsFinish] = useState(false);
  /** Sound steps whose test has begun — listening comes first */
  const [pairsStarted, setPairsStarted] = useState<Record<string, boolean>>({});
  const markComplete = (key: string) =>
    setCompleted((c) => (c[key] ? c : { ...c, [key]: true }));
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

  /** Each task's icon and one-line purpose — from its first block */
  const kinds = useMemo(() => day.tasks.map((t) => taskKind(t.blocks)), [day.tasks]);

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
  const sliceKey = `${step}-${innerStep}`;


  /**
   * The vocabulary step being tested, if any.
   *
   * The word list and the cards used to share the screen, the cards
   * folded away under it — so the answers sat just above the question,
   * and the cards were easy to miss altogether. Testing now replaces
   * the list: study it, then put it away and recall.
   */
  const [testing, setTesting] = useState<string | null>(null);

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

  /*
   * One stable reporter for every drill, and no update when nothing moved.
   *
   * It used to be a fresh arrow on each render. Each drill reports from an
   * effect that lists `onProgress` as a dependency, so: report → new state
   * → re-render → new arrow → report again — forever, at 100% CPU, from the
   * moment a drill opened. Typing lagged and letters were lost.
   */
  const reportInner = useCallback((done: number, total: number) => {
    setInner((prev) => (prev && prev.done === done && prev.total === total ? prev : { done, total }));
  }, []);

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
    // In the wizard a station is its own screen (focus mode): its top is the page's top
    if (!el || mode === 'wizard') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    // الشريطان الملتصقان يغطّيان أعلى الشاشة، فنطرح ارتفاعهما
    const chrome = window.innerWidth < 640 ? 44 + 62 : 56 + 62;
    const y = el.getBoundingClientRect().top + window.scrollY - chrome;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  };

  /**
   * The journey map or one task.
   *
   * The day opens on the map — its whole shape, and where you are — and
   * returns to it after each task, so the learner sees the road move
   * instead of being handed the next box.
   */
  const [view, setView] = useState<'map' | 'task'>('map');
  /** A line shown on the map for a moment — why a station closed by itself */
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  /** The voice and speed sheet in the focus bar */
  const [settingsOpen, setSettingsOpen] = useState(false);

  const showMap = () => {
    setView('map');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToStep = (next: number) => {
    const t = day.tasks[next];
    if (t) track('task_open', t.ref ?? `order:${t.order}`);
    setStep(next);
    setInnerStep(0);
    setView('task');
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
  /*
   * The frontier: the first station not yet done, from what the server
   * saved — not from the station on screen.
   *
   * One number used to mean both "the station I am viewing" and "how far
   * I have got". Opening a finished station to look back — or one tap on
   * the back arrow — moved that number back, so the map put "you are
   * here" on the old station and "next station" led there again.
   * Viewing never moves the frontier now.
   */
  const frontier = (() => {
    const i = day.tasks.findIndex((t) => !tasksDone[String(t.order)]);
    return i === -1 ? day.tasks.length - 1 : i;
  })();

  const taskReachable = (t: DayTask) => {
    if (tasksDone[String(t.order)]) return true;
    const i = day.tasks.findIndex((x) => x.order === t.order);
    return i <= frontier;
  };

  const atLastSlice = innerStep >= slices.length - 1;

  /*
   * Is the step on screen an exercise that must be finished first? Then
   * the way forward does not exist until it is — the platform knows when
   * a drill ends, so the learner is never asked to claim it ("أنجزتها").
   */
  const currentSlice = slices[innerStep];
  const sliceIsDrill = !!currentSlice && (
    ['spelling', 'minimal_pairs', 'review', 'watch', 'story', 'challenge', 'imitate', 'homework', 'vocabulary'].includes(currentSlice.type)
    || (currentSlice.type === 'exercises' && (currentSlice as ExercisesBlock).items.length > 0)
  );

  // Homework and the episode count as finished once their proof is saved
  const drillProven = (currentSlice?.type === 'homework' && homeworkProof.trim().length >= 3)
    || (currentSlice?.type === 'watch' && /[A-Za-z]{2,}/.test(watchProof))
    || (currentSlice?.type === 'story' && /[A-Za-z]{2,}/.test(storyProof));

  /** Returns whether the server accepted it — the stamp lands only on a real save */
  const toggle = async (task: DayTask): Promise<boolean> => {
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
      setSaveFailed(null);

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

      return true;
    } catch (e) {
      setTasksDone((prev) => ({ ...prev, [String(task.order)]: !next }));
      setSaveFailed(task.order);
      // A refusal ("finish the tasks before it first") is not a lost connection
      const msg = axios.isAxiosError(e) ? (e.response?.data as { message?: string } | undefined)?.message : undefined;
      setSaveError(e && axios.isAxiosError(e) && e.response ? msg ?? null : null);

      return false;
    } finally {
      setSaving(null);
    }
  };

  /**
   * Let the "done" stamp land before the page turns.
   *
   * Moving on the instant the button was pressed made finishing a task
   * look like skipping it — the next screen simply replaced this one.
   * A second and a quarter is enough to see the praise and the count
   * and short enough not to wait for it; with reduced motion, a beat.
   */
  const stampDone = (order: number) =>
    new Promise<void>((resolve) => {
      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      setStamped(order);
      window.setTimeout(() => {
        setStamped(null);
        resolve();
      }, still ? 400 : 1250);
    });

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

            {testing === `${step}-${key}-${block.group}` ? (
              <>
                {/* Required practice: recall, then the word in its sentence */}
                <VocabPractice words={block.items} onComplete={() => markComplete(sliceKey)} />
                <button
                  onClick={() => setTesting(null)}
                  className="w-full rounded-xl bg-white py-2.5 text-sm text-slate-600 ring-1 ring-slate-200
                             transition hover:ring-slate-300"
                >
                  {tr('ارجع إلى قائمة الكلمات')}
                </button>
              </>
            ) : (
              <>
                {/* Each word with its use: the word, then a sentence with it in
                    place, its translation, and one line on where it goes */}
                <div className="space-y-2.5">
                  {block.items.map((w) => (
                    <div key={w.id} className="rounded-xl bg-white p-3.5 ring-1 ring-slate-200">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 text-base text-slate-700">{w.arabic}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="text-start">
                            <p className="text-lg font-bold text-slate-900" dir="ltr">{w.word}</p>
                            {w.ipa && <p className="font-mono text-xs text-slate-400" dir="ltr">{w.ipa}</p>}
                          </div>
                          <Listen text={w.word} size="sm" />
                        </div>
                      </div>
                      {w.sentence && (
                        <div className="mt-2.5 border-t border-slate-100 pt-2.5">
                          <div className="flex items-start justify-between gap-2" dir="ltr">
                            <p className="text-base leading-relaxed text-slate-800">{w.sentence}</p>
                            <Listen text={w.sentence} size="sm" />
                          </div>
                          {w.sentence_ar && <p className="mt-0.5 text-sm text-slate-500">{w.sentence_ar}</p>}
                        </div>
                      )}
                      {w.usage_ar && (
                        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-sm leading-relaxed text-amber-900">
                          {w.usage_ar}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setTesting(`${step}-${key}-${block.group}`)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3
                             text-sm font-semibold text-white transition hover:bg-violet-700"
                >
                  <PenLine aria-hidden size={16} />
                  {tr('حفظتها؟ ابدأ التمرين')}
                </button>
              </>
            )}
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

      /* ---------- النطق: استماع قبل إنتاج ----------
         Two stages, not three layers: hear the pairs, then the test opens
         in place. It used to be an intro, a box of pairs, and the game
         folded away under a button the learner had to find. */
      case 'minimal_pairs': {
        const started = pairsStarted[sliceKey] || block.production;

        if (started) {
          return (
            <div key={key}>
              <MinimalPairGame
                groups={block.groups}
                onFinish={() => markComplete(sliceKey)}
                production={block.production}
                onProgress={reportInner}
              />
            </div>
          );
        }

        return (
          <div key={key} className="space-y-4">
            {block.groups.map((g) => (
              <div key={g.label_en}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-slate-900">{g.label_ar ?? g.label_en}</p>
                  <p className="shrink-0 font-mono text-sm text-violet-700" dir="ltr">{g.ipa}</p>
                </div>
                <p className="mt-1 text-sm text-slate-600">{tr('اسمع كل زوج قبل الاختبار. اضغط الكلمة أو جملتها لتسمعها.')}</p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2" dir="ltr">
                  {g.pairs.map((p) => (
                    <div key={p.id} className="grid grid-cols-2 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                      {[p.word_a, p.word_b].map((w, i) => {
                        const gl = p.gloss?.[i];
                        return (
                          <div key={w} className={`flex flex-col ${i === 0 ? 'border-e border-slate-200' : ''}`}>
                            <button
                              onClick={() => speak(w, { rate: myRate, gender: myVoice })}
                              disabled={!supported}
                              className="flex flex-col items-center bg-white px-2 pb-1.5 pt-2.5 transition
                                         hover:bg-violet-50 active:scale-95 disabled:opacity-50"
                            >
                              <span className="text-lg font-bold text-slate-900">{w}</span>
                              {gl?.arabic && <span className="text-sm text-slate-500" dir="rtl">{gl.arabic}</span>}
                            </button>
                            {gl?.example && (
                              <button
                                onClick={() => speak(gl.example!, { rate: Math.min(myRate, 0.85), gender: myVoice })}
                                disabled={!supported}
                                className="flex-1 border-t border-slate-100 bg-slate-50 px-2.5 py-2 text-start text-sm
                                           leading-snug text-slate-700 transition hover:bg-violet-50 disabled:opacity-50"
                              >
                                {gl.example}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={() => setPairsStarted((m) => ({ ...m, [sliceKey]: true }))}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-base
                         font-semibold text-white transition hover:bg-violet-700"
            >
              {tr('جاهز؟ ابدأ الاختبار')}
            </button>
          </div>
        );
      }

      /* ---------- التمارين ---------- */
      case 'exercises':
        return (
          <div key={key}>
            {block.items.length > 0 ? (
              <ExerciseRunner
                exercises={block.items}
                onProgress={reportInner}
                onFinish={() => markComplete(sliceKey)}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5 text-center">
                <p className="text-sm font-medium text-amber-900">
                  {tr('لا توجد تمارين مُدخلة لهذا اليوم')}
                </p>
                <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-amber-800">
                  تمارين اليوم {block.day} قيد التجهيز. أشّر المهمة وتابع يومك.
                </p>
              </div>
            )}
          </div>
        );

      /* ---------- التحدّث — يسجّل على جواله ---------- */
      case 'record':
        return (
          <div key={key} className="space-y-4">
            {block.speaking && <SpeakingBrief speaking={block.speaking} />}

            {/* No recorder: the recording lives on the learner's phone (§4.2) */}
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                <Smartphone aria-hidden size={18} className="text-violet-600" />
                {tr('سجّل على جوالك')}
              </p>
              <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-700">
                <li>1. {tr('افتح مسجّل الصوت في جوالك.')}</li>
                <li>
                  2. {tr('تكلّم :n ثانية عن الموضوع. لا تتوقّف لتبدأ من جديد.', {
                    n: block.speaking?.target_seconds ?? (block.baseline ? 120 : 90),
                  })}
                </li>
                <li>3. {tr('اسمع تسجيلك مرة واحدة، وقيّم نفسك بالجدول أعلاه.')}</li>
                <li>
                  4. {tr('احفظه باسم')}{' '}
                  <Bdi>
                    <span className="font-mono font-semibold">
                      {`Week${String(week.number).padStart(2, '0')}`}
                    </span>
                  </Bdi>
                  {block.baseline && ` — ${tr('هذا تسجيل خط الأساس. ستقارنه بتسجيلاتك القادمة، فلا تحذفه.')}`}
                </li>
              </ol>
            </div>
          </div>
        );

      /* ---------- كتابة الكلمات ---------- */
      case 'spelling':
        return (
          <div key={key}>
            <Spelling
              key={`${step}-${innerStep}`}
              words={block.words}
              rounds={block.rounds}
              onProgress={reportInner}
              onComplete={() => markComplete(sliceKey)}
            />
          </div>
        );

      /* ---------- حلقة اليوم ---------- */
      case 'watch':
        return (
          <div key={key}>
            <Watch
              weekNumber={week.number}
              data={block}
              saved={(myNotes?.watch as Record<string, string> | undefined) ?? null}
              onSaved={(t) => { setWatchProof(t); setNeedsProof(false); markComplete(sliceKey); }}
            />
          </div>
        );

      /* ---------- قصة اليوم ---------- */
      case 'story':
        return (
          <div key={key}>
            <StoryStation
              weekNumber={week.number}
              data={block}
              rate={rate}
              voice={voice}
              saved={(myNotes?.story as Record<string, string> | undefined) ?? null}
              onSaved={(t) => { setStoryProof(t); setNeedsProof(false); markComplete(sliceKey); }}
            />
          </div>
        );

      /* ---------- تحدّي اليوم ---------- */
      case 'challenge':
        return (
          <div key={key}>
            <ChallengeStation data={block} onDone={() => markComplete(sliceKey)} />
          </div>
        );

      /* ---------- الواجب المنزلي ---------- */
      case 'homework':
        return (
          <div key={key}>
            <Homework
              weekNumber={week.number}
              data={block}
              saved={(myNotes?.homework as Record<string, string> | undefined) ?? null}
              onSaved={(t) => { setHomeworkProof(t); setNeedsProof(false); markComplete(sliceKey); }}
            />
          </div>
        );

      /* ---------- اكتب مثله ---------- */
      case 'imitate':
        return (
          <div key={key}>
            <Imitate
              weekNumber={week.number}
              item={block.item}
              saved={(myNotes?.imitate as Record<string, string> | undefined) ?? null}
              onComplete={() => markComplete(sliceKey)}
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
              onComplete={() => markComplete(sliceKey)}
              onFinished={() => {
                const task = day.tasks.find((t) =>
                  t.blocks.some((b) => b.type === 'review'),
                );
                if (task && !tasksDone[String(task.order)]) toggle(task);
              }}
              /*
               * Nothing due: a station that asks nothing, then a button to
               * leave it, broke the day's momentum for no lesson. It marks
               * itself and returns to the map with one line saying why.
               */
              onEmpty={async () => {
                const task = day.tasks.find((t) => t.blocks.some((b) => b.type === 'review'));
                if (!task || day.tasks[step]?.order !== task.order || slices.length > 1) return;
                if (!tasksDone[String(task.order)] && !(await toggle(task))) return;
                setNotice(tr('لا كلمات تحتاج مراجعة اليوم — المحطة تمّت تلقائياً.'));
                setInnerStep(0);
                showMap();
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
              {tr('هذا الجزء قيد التجهيز في المنصة. أشّر المهمة وتابع يومك.')}
            </p>
            <p className="mt-2 font-mono text-xs text-slate-400" dir="ltr">
              {block.ref}
            </p>
          </div>
        );
    }
  };

  /*
   * Focus mode — inside a station, only the station.
   *
   * Measured on a 390x844 phone, the content began 370px down: the app
   * bar, the day header, a line of voice controls on two rows, a progress
   * strip and the station's own card all came first, and the Next bar and
   * the tab bar took 150px at the bottom. An exercise showed two and a
   * half of its four options. So inside a station the app bar, the day
   * header, the tab bar and the floating memory button go; one slim bar
   * carries the way out, the station's progress, the voice settings and
   * the memory, and the content sits on the page itself.
   */
  const focus = mode === 'wizard' && view === 'task';

  return (
    <div dir={dirOf(locale)} className={`min-h-screen bg-slate-50 ${focus ? 'pb-36' : 'pb-28 sm:pb-24'}`}>
      <Head title={`الأسبوع ${week.number} · اليوم ${day.number}`} />

      {!focus && <AppNav />}

      {/*
        ============ الرأس ============
        صفحة اليوم أطول صفحة في المنصة، والرأس فيها يجب أن يُخلي
        الشاشة للمحتوى بسرعة — فهو سطران وشريط تقدّم رقيق، بلا لوح
        ملوّن. والنيلي هنا لأن الأخضر محفوظ لـ«تمّ».
      */}
      {!focus && (
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
      )}

      {focus && (() => {
        const t = day.tasks[step];
        const tone = TONES[kinds[step]?.tone ?? 'violet'];
        const part = slices.length > 1 ? (innerStep + 1) / slices.length : (t && tasksDone[String(t.order)] ? 1 : 0.5);
        return (
          <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"
               style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2.5 sm:px-4">
              <button
                onClick={() => { setSettingsOpen(false); showMap(); }}
                aria-label={tr('خريطة اليوم')}
                title={tr('خريطة اليوم')}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <X aria-hidden size={20} />
              </button>

              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-bold text-slate-900" dir={t ? dirFor(taskName(t).primary) : undefined}>
                    {t ? taskName(t).primary : ''}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {step + 1}/{total}
                    {slices.length > 1 && <> · {tr('الجزء')} {innerStep + 1}/{slices.length}</>}
                  </span>
                </p>
                {/* One bar: how far into this station */}
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                  <span className={`block h-full rounded-full transition-all duration-500 ${tone.bar}`} style={{ width: `${Math.round(part * 100)}%` }} />
                </span>
              </div>

              {supported && (
                <div className="relative">
                  <button
                    onClick={() => setSettingsOpen((v) => !v)}
                    aria-label={tr('الصوت والسرعة')}
                    aria-expanded={settingsOpen}
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 transition ${
                      settingsOpen ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'
                    }`}
                  >
                    <Settings2 aria-hidden size={18} />
                  </button>
                  {settingsOpen && (
                    <>
                      <button aria-label={tr('إغلاق')} className="fixed inset-0 z-30 cursor-default" onClick={() => setSettingsOpen(false)} />
                      <div className="absolute end-0 top-12 z-40 w-max max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white p-3 shadow-xl ring-1 ring-slate-200">
                        <p className="mb-2 text-xs font-semibold text-slate-500">{tr('الصوت والسرعة')}</p>
                        <SpeechControls voice={voice} onVoice={setVoice} rate={rate} onRate={setRate} size="sm" />
                      </div>
                    </>
                  )}
                </div>
              )}

              <MemoryLauncher inline />
            </div>
          </div>
        );
      })()}

      <main ref={contentTop} className={focus ? 'mx-auto max-w-2xl space-y-3 px-4 pt-4 sm:px-6' : 'mx-auto max-w-4xl space-y-4 px-4 py-6'}>
        {/* ============ المهام ============ */}
        {mode === 'wizard' && view === 'map' && notice && (
          <p role="status" className="leaf-in flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
            <Check aria-hidden size={16} className="shrink-0" /> {notice}
          </p>
        )}
        {mode === 'wizard' && view === 'map' && (
          <DayJourney
            dayNumber={day.number}
            current={Math.max(0, frontier)}
            onOpen={(i) => goToStep(i)}
            stations={day.tasks.map((t, i) => ({
              order: t.order,
              name: taskName(t).primary,
              minutes: t.minutes * multiplier,
              kind: kinds[i],
              done: tasksDone[String(t.order)] ?? false,
              reachable: taskReachable(t),
            }))}
            finished={
              <div className="relative overflow-hidden rounded-3xl bg-emerald-50 p-6 text-center ring-1 ring-emerald-200">
                <span aria-hidden className="confetti is-slow">
                  {Array.from({ length: 18 }, (_, k) => (
                    <i key={k} className={TONES[kinds[k % kinds.length]?.tone ?? 'violet'].bar} style={{ ['--k' as string]: k }} />
                  ))}
                </span>
                <span className="station-done-mark mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-600 text-white shadow-lg">
                  <CircleCheck aria-hidden size={40} strokeWidth={1.75} />
                </span>
                <p className="mt-3 text-2xl font-bold text-emerald-900">{tr('اكتمل اليوم')} {day.number}</p>
                <div className="mx-auto mt-3 flex max-w-xs justify-center gap-3">
                  <span className="flex-1 rounded-2xl bg-white/70 px-3 py-2">
                    <span className="block text-xl font-bold text-emerald-800">{total}</span>
                    <span className="text-xs text-emerald-700">{tr('محطات')}</span>
                  </span>
                  <span className="flex-1 rounded-2xl bg-white/70 px-3 py-2">
                    <span className="block text-xl font-bold text-emerald-800">{day.minutes * multiplier}</span>
                    <span className="text-xs text-emerald-700">{tr('دقيقة')}</span>
                  </span>
                </div>
                <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-emerald-800">
                  {day.number < lastDay
                    ? tr('اليوم التالي مفتوح الآن. عد غداً — هذا ما يبني السلسلة.')
                    : tr('أنهيت الأسبوع كاملاً.')}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {day.number < lastDay && nextDayUnlocked && (
                    <Link href={`/week/${week.number}/day/${day.number + 1}`}
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700">
                      {tr('اليوم')} {day.number + 1}
                    </Link>
                  )}
                  <Link href={`/week/${week.number}`}
                    className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
                    {tr('عد إلى الأسبوع')}
                  </Link>
                </div>
              </div>
            }
          />
        )}

        {(mode === 'wizard' ? (view === 'task' ? visibleTasks : []) : day.tasks).map((task) => {
          const checked = tasksDone[String(task.order)] ?? false;
          const isSaving = saving === task.order;
          const isLastStep = mode === 'wizard' && step >= total - 1;

          return (
            <section
              key={task.order}
              className={focus
                ? 'leaf-in relative'
                : 'relative overflow-clip rounded-3xl bg-white ring-1 ring-slate-200 transition'}
            >
              {/* In focus the bar names the station; what it asks is said once, on its first step */}
              {focus && innerStep === 0 && kinds[day.tasks.indexOf(task)]?.purpose && (
                <p className="mb-3 text-sm leading-relaxed text-slate-500">
                  {tr(kinds[day.tasks.indexOf(task)]!.purpose)}
                </p>
              )}
              {!focus && (
              <>
              {/* The station's colour, as a band across its top */}
              <span aria-hidden className={`block h-1.5 ${TONES[kinds[day.tasks.indexOf(task)]?.tone ?? 'violet'].bar}`} />
              {/* The task's opener: its mark, its place in the day, its name,
                  and one line on what the learner is about to do */}
              <div className="flex items-start gap-4 p-5 sm:p-6">
                <span
                  className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${
                    checked
                      ? 'bg-emerald-600 text-white'
                      : `${TONES[kinds[day.tasks.indexOf(task)]?.tone ?? 'violet'].soft} ${TONES[kinds[day.tasks.indexOf(task)]?.tone ?? 'violet'].text}`
                  }`}
                  aria-hidden
                >
                  {checked ? (
                    <Check size={22} strokeWidth={2.25} />
                  ) : (
                    (() => {
                      const KindIcon = kinds[day.tasks.indexOf(task)]?.Icon ?? Check;
                      return <KindIcon size={22} strokeWidth={1.75} />;
                    })()
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock aria-hidden size={12} /> {task.minutes * multiplier} {tr('دقيقة')}
                    </span>
                    {checked && (
                      <>
                        <span aria-hidden className="text-slate-300">•</span>
                        <span className="text-emerald-700">{tr('منجزة')}</span>
                      </>
                    )}
                  </p>

                  <h2
                    className="mt-1 text-lg font-bold leading-snug text-slate-900 sm:text-xl"
                    dir={dirFor(taskName(task).primary)}
                  >
                    {taskName(task).primary}
                  </h2>
                  {taskName(task).secondary && (
                    <p className="hidden text-xs text-slate-400 sm:block" dir={dirFor(taskName(task).secondary!)}>
                      {taskName(task).secondary}
                    </p>
                  )}

                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {tr(kinds[day.tasks.indexOf(task)]?.purpose ?? '')}
                  </p>
                </div>
              </div>
              </>
              )}

              {/* "Done", stamped across the task before the page turns */}
              {/* In a portal: the station animates with a transform, which would
                  pin a fixed overlay inside it instead of over the screen */}
              {stamped === task.order && createPortal(
                <div className="station-done pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-white/85 backdrop-blur-[2px]">
                  <div className="text-center">
                    <span className="station-done-mark mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-600 text-white shadow-lg">
                      <Check aria-hidden size={40} strokeWidth={2.75} />
                    </span>
                    <p className="mt-3 text-2xl font-bold text-slate-900">{tr(PRAISE[(task.order + day.number) % PRAISE.length])}</p>
                    <p className="mt-1 text-sm font-medium text-slate-600">
                      {tr('أنجزت :d من :n محطات', { d: doneCount, n: total })}
                    </p>
                  </div>
                  {/* A burst of the day's colours */}
                  <span aria-hidden className="confetti">
                    {Array.from({ length: 14 }, (_, k) => (
                      <i key={k} className={TONES[kinds[k % kinds.length]?.tone ?? 'violet'].bar} style={{ ['--k' as string]: k }} />
                    ))}
                  </span>
                </div>
              ,
                document.body,
              )}

              {/* محتوى المهمة —
                  في الخطوات: شريحة واحدة، والقسم wizard بنفسه.
                  في الوضع الكامل: كل الكتل، للمراجعة والتمرير. */}
              {task.blocks.length > 0 ? (
                <div className={focus ? '' : 'border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5'}>
                  {mode === 'wizard' ? (
                    // Keyed by step, so each step slides in as a new page
                    <div key={`${task.order}-${innerStep}`} className="leaf-in space-y-4">
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
                    {tr('هذه المهمة تُنجز خارج المنصة. أنجزها ثم أشّرها.')}
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
              <MaybePortal on={focus}>
              <div
                dir={dirOf(locale)}
                className={focus
                  // No tab bar under it in focus: pinned to the screen's edge, at every size,
                  // so a short step does not leave the button floating mid-screen
                  ? 'fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur'
                  : 'border-t border-slate-100 bg-white p-4 max-sm:sticky max-sm:z-20'}
                // Otherwise it sits on top of AppNav's mobile bottom bar (h-16 + safe area)
                style={focus
                  ? { paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }
                  : { bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
              >
                <div className={focus ? 'mx-auto max-w-2xl px-4 pt-3 sm:px-6' : ''}>

                {needsProof && task.blocks.some((b) => b.type === 'homework') && (
                  <p className="mb-3 rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-900">
                    {tr('أنجز مغامرتك، ثم اكتب ما فعلته واضغط «احفظ». بعدها ينتهي اليوم.')}
                  </p>
                )}
                {needsProof && task.blocks.some((b) => b.type === 'story') && (
                  <p className="mb-3 rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-900">
                    {tr('اختر عبرة القصة، ثم اكتب جملة منها واضغط «احفظ».')}
                  </p>
                )}
                {needsProof && task.blocks.some((b) => b.type === 'watch') && (
                  <p className="mb-3 rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-900">
                    {tr('شاهد الحلقة، ثم اكتب ما سمعته واضغط «احفظ».')}
                  </p>
                )}

                {saveFailed === task.order && (
                  <p className="mb-3 rounded-lg bg-rose-50 p-3 text-center text-sm text-rose-800">
                    {saveError ?? tr('لم تُحفظ المهمة. تحقّق من الاتصال واضغط مرة أخرى.')}
                  </p>
                )}

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
                    {true && (
                      <button
                        onClick={() => {
                          if (innerStep > 0) goToSlice(innerStep - 1);
                          // Not the start of the previous task: one stray tap
                          // there meant stepping through all of it again
                          else showMap();
                        }}
                        // An arrow, not a word: the one labelled button on this bar is the way forward
                        aria-label={tr('رجوع')}
                        title={tr('رجوع')}
                        className="grid min-h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-slate-500
                                   ring-1 ring-slate-200 transition hover:text-slate-700 hover:ring-slate-300
                                   active:scale-95"
                      >
                        <ArrowRight aria-hidden size={18} />
                      </button>
                    )}

                    {/*
                      An exercise must be finished before moving on — but only
                      the first time. A task already marked done stays open:
                      reviewing it must not lock everything after it again.
                      Saved homework counts too: its proof is already written.
                    */}
                    {/*
                      A station done on an earlier visit may be skipped, but
                      quietly: a full "Next" beside an unfinished drill read
                      as a second way forward, competing with the card itself.
                    */}
                    {sliceIsDrill && !completed[sliceKey] && checked && !drillProven && (
                      <button
                        onClick={() => (atLastSlice ? (setInnerStep(0), showMap()) : goToSlice(innerStep + 1))}
                        className="min-h-12 flex-1 rounded-xl text-sm font-medium text-slate-500 transition hover:text-slate-700"
                      >
                        {tr('تخطَّ — أنجزتها من قبل')}
                      </button>
                    )}
                    {(!sliceIsDrill || completed[sliceKey] || drillProven) && (
                    <button
                      onClick={async () => {

                        // ① خطوة تالية داخل المهمّة
                        if (!atLastSlice) { goToSlice(innerStep + 1); return; }

                        // ② المهمّة تُؤشَّر إن لم تكن مؤشَّرة
                        if (!checked) {
                          // Homework needs its written proof first — the server checks too
                          if (task.blocks.some((b) => b.type === 'homework') && homeworkProof.trim().length < 3) {
                            setNeedsProof(true);
                            return;
                          }
                          if (task.blocks.some((b) => b.type === 'story') && !/[A-Za-z]{2,}/.test(storyProof)) {
                            setNeedsProof(true);
                            return;
                          }
                          if (task.blocks.some((b) => b.type === 'watch') && !/[A-Za-z]{2,}/.test(watchProof)) {
                            setNeedsProof(true);
                            return;
                          }
                          if (!(await toggle(task))) return;   // stay, and say so below
                          await stampDone(task.order);
                        }

                        // ③ مهمّة تالية إن وُجدت
                        // Back to the map, which points at the frontier
                        setInnerStep(0);
                        showMap();
                        return;

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
                          ? <>
                              {slices[innerStep + 1]?.type === currentSlice?.type
                                ? <>{tr('التالي: الجزء')} {innerStep + 2} {tr('من')} {slices.length}</>
                                : tr('التالي')}{' '}
                              <ArrowLeft aria-hidden size={15} className="inline-block align-[-3px]" />
                            </>
                          : isLastStep
                            ? tr('أنهِ اليوم')
                            : (
                              // The next task by name: the learner knows where the button leads
                              <span className="flex items-center justify-center gap-1.5 px-2">
                                <span className="shrink-0">{tr('التالي:')}</span>
                                <span className="truncate">
                                  <Bdi>{day.tasks[step + 1] ? taskName(day.tasks[step + 1]).primary : ''}</Bdi>
                                </span>
                                <ArrowLeft aria-hidden size={15} className="shrink-0" />
                              </span>
                            )}
                    </button>
                    )}
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
              </div>
              </MaybePortal>
            </section>
          );
        })}

        {mode === 'full' && (<>

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
        </>)}

        {/* التنقّل بين الأيام — on the map, not under a task */}
        {!(mode === 'wizard' && view === 'task') && (
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
        )}
      </main>

      <Celebrate celebration={celebration} onClose={() => setCelebration(null)} />
    </div>
  );
}
