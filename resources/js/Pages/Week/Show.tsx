import { useEffect, useRef, useState } from 'react';
import StageDirection from '@/Components/Game/StageDirection';
import { iso } from '@/lib/bidi';
import { Head, Link } from '@inertiajs/react';
import AppNav from '@/Components/AppNav';
import Listen from '@/Components/Listen';
import axios from 'axios';
import DayCard, { type DayState } from '@/Components/DayCard';
import Modal from '@/Components/Modal';
import MinimalPairGame, { type Group as PairGroup } from '@/Components/Game/MinimalPairGame';
import Flashcards, { type Word } from '@/Components/Game/Flashcards';
import ExerciseRunner, { type ExerciseData } from '@/Components/Game/ExerciseRunner';
import WritingTask, {
  type WritingContent,
  type MyWriting,
} from '@/Components/Game/WritingTask';
import SpeakingBrief, { type SpeakingPayload } from '@/Components/Game/SpeakingBrief';
import ReviewSession from '@/Components/Game/ReviewSession';
import SectionView, { type SectionData } from '@/Components/Game/SectionView';
import SpeechControls from '@/Components/SpeechControls';
import { type ComparisonSaved } from '@/Components/Game/Comparison';
import { useSpeech, prefToGender, prefRateFactor, type Gender } from '@/hooks/useSpeech';
import { cleanLabel } from '@/lib/labels';
import { useLocale, dirOf, pick, dirFor } from '@/lib/bilingual';
import { type Prefs, DEFAULT_PREFS } from '@/lib/prefs';
import { useT } from '@/lib/i18n';
import { CalendarCheck, CalendarDays, ChevronDown, ChevronLeft, ChevronUp, Construction, Flame, Library, MessageCircle, Pin, Play, Square, Timer } from 'lucide-react';

/**
 * صفحة الأسبوع — الشاشة الرئيسية.
 *
 * وحدة التنظيم هي **اليوم** لا الأسبوع:
 *   1. اليوم        ← مهام يومه ومحتواها، مفتوحة وبارزة
 *   2. الأيام السبعة ← الموضع والمراجعة
 *   3. مكتبة الأسبوع ← كل المحتوى مرجعاً، مغلقة افتراضياً
 *
 * السبب: عرض محتوى الأسبوع كله بجانب خطة اليوم يجعل المتدرّب
 * يتصفّح بلا هدف ولا يعرف من أين يبدأ. الكتاب صريح في هذا:
 * «الكتاب مرجع لا رواية — خطة اليوم تحدد ما يُفتح».
 *
 * أقسام الكتاب (§1 الأهداف · §2 المفردات · §4 النطق · §5-6 الحوارات)
 * محفوظة بترتيبها داخل المكتبة، وكل مهمة في اليوم تفتح ما يقابلها.
 *
 * وقاعدة «الاستماع قبل الإنتاج» تظهر في أن كل نص إنجليزي
 * قابل للنطق بنقرة، بسرعة يتحكّم بها المتدرّب.
 */

interface WeekMeta {
  number: number;
  module: number;
  title_en: string;
  title_ar: string;
  objectives: { en: string; ar: string }[];
  pron_section: number;
}

interface Dialogue {
  number: number;
  title: string;
  situation_en: string;
  situation_ar: string;
  /** خريطة اسم المتحدث ← جنسه، تأتي من المحتوى */
  speaker_genders: Record<string, Gender>;
  lines: { speaker: string; en: string; ar: string }[];
}

interface Props {
  week: WeekMeta;
  days: DayState[];
  vocabulary: Record<string, Word[]>;
  /** اسم كل مجموعة بالعربية — من المحتوى */
  vocabularyLabels?: Record<string, string | null>;
  minimalPairs: PairGroup[];
  dialogues: Dialogue[];
  exercises: Record<string, ExerciseData[]>;
  stats: { track: 'A' | 'B'; current_week: number; current_day: number; streak: number };
  writing: WritingContent | null;
  myWriting: MyWriting | null;
  myComparison: ComparisonSaved | null;
  myNotes: Record<string, Record<string, string>> | null;
  /** خطّة الكلام التي اختارها في الأسبوع 12 — تُذكَّر كل أسبوع */
  speakingPlan?: string | null;
  /** تفضيلات المتدرّب — مشتركة من الخادم */
  prefs?: Prefs;
  sections: SectionData[];
  breakDone: string[];
  /** ما كتبه في كل نشاط استراحة — مفتاحه اسم النشاط */
  breakNotes?: Record<string, string>;
}

/**
 * نشاط قابل للفتح.
 *
 * `unbuilt` ليست حالة خطأ — بعض مراجع الكتاب (الاستماع، القراءة،
 * القواعد، الاختبار الذاتي) لم تُبنَ بعد. عرضها صريحاً أصدق من
 * زرّ لا يفعل شيئاً عند النقر.
 */
type Activity =
  | { kind: 'pairs' }
  | { kind: 'flashcards'; group: string }
  | { kind: 'exercises'; day: string }
  | { kind: 'record'; baseline: boolean }
  | { kind: 'writing' }
  | { kind: 'dialogue'; number: number }
  | { kind: 'review' }
  /**
   * Drills the server builds for one day — today's spelling words,
   * today's shadowing paragraph, today's writing model. They have no
   * week-wide version, so this page points to the day instead.
   */
  | { kind: 'inday'; what: 'spell' | 'spell_review' | 'shadow' | 'imitate' | 'homework' }
  /** قسم شرح: القواعد · النطق · الاستماع · القراءة · العبارات */
  | { kind: 'section'; sectionKind: string }
  | { kind: 'unbuilt'; ref: string };

/** السطر الجاري نطقه في تشغيل حوار كامل */
type PlayingLine = { dialogue: number; index: number } | null;

/* ====================================================================
 |  ثوابت العرض
 |==================================================================== */

/**
 * ألوان المجموعات تُشتقّ من اسمها لا تُكتب.
 *
 * كانت خريطة بأربع مجموعات والمحتوى فيه سبع وسبعون، فكانت ثلاث
 * وسبعون منها رمادية بلا تمييز — والغرض من اللون أصلاً أن تفصل
 * الذاكرةُ البصرية بينها. والاشتقاق يعطي كل مجموعة لوناً ثابتاً
 * لا يتغيّر بين زيارة وأخرى، ويظلّ صالحاً لأي مجموعة تُضاف غداً.
 *
 * والألوان المختارة تتجنّب البنفسجي (لون الهوية) والأخضر (الإنجاز)
 * والأحمر (الخطأ) — فلا يُقرأ لون تصنيف على أنه حالة.
 */
const TONE_PALETTE = [
  { ring: 'ring-rose-200', chip: 'bg-rose-50 text-rose-700', dot: 'bg-rose-400' },
  { ring: 'ring-amber-200', chip: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' },
  { ring: 'ring-cyan-200', chip: 'bg-cyan-50 text-cyan-700', dot: 'bg-cyan-400' },
  { ring: 'ring-teal-200', chip: 'bg-teal-50 text-teal-700', dot: 'bg-teal-400' },
  { ring: 'ring-sky-200', chip: 'bg-sky-50 text-sky-700', dot: 'bg-sky-400' },
  { ring: 'ring-orange-200', chip: 'bg-orange-50 text-orange-700', dot: 'bg-orange-400' },
];

function toneOf(group: string) {
  let h = 0;
  for (let i = 0; i < group.length; i++) h = (h * 31 + group.charCodeAt(i)) >>> 0;
  return TONE_PALETTE[h % TONE_PALETTE.length];
}

/** الاسم العربي من الخادم؛ وبلا اسم يُعرض المفتاح مقروءاً */
const groupName = (g: string, labels?: Record<string, string | null>) =>
  labels?.[g] || g.replace(/_/g, ' ');

/** خيارات السرعة — ثلاثة تكفي، والأكثر يشوّش */
/**
 * أقسام الصفحة الأربعة.
 *
 * كانت تسمياتها «اليوم · الأسبوع · الاستراحة · المكتبة»، وهي غامضة:
 * «اليوم» و«الأسبوع» متشابهتان، و«المكتبة» لا تقول شيئاً. فصار كل
 * قسم يقول ما يفعله المتدرّب فيه، مع أيقونة وسطر يشرح — لأن من لا
 * يفهم القائمة لا يجرّبها، بل يتوقّف.
 */
const SECTIONS = [
  { id: 'today', label: 'ابدأ من هنا', icon: <Play size={15} />, hint: 'مهمّة اليوم' },
  { id: 'plan', label: 'الأيام السبعة', icon: <CalendarDays size={15} />, hint: 'خطة الأسبوع كلها' },
  { id: 'library', label: 'كل محتوى الأسبوع', icon: <Library size={15} />, hint: 'مفردات وقواعد ونطق وحوارات' },
];

/** أسماء عربية للمراجع التي لم تُبنَ بعد — لنقول ما هي بدل الصمت */
const UNBUILT_LABELS: Record<string, string> = {
  listening: 'الاستماع',
  reading: 'القراءة',
  grammar: 'القواعد',
  selfcheck: 'الاختبار الذاتي',
  section: 'قسم من الدرس',
};

/**
 * تحويل مرجع مهمة إلى قائمة أنشطة.
 *
 * مهمة واحدة قد تحمل نشاطين مفصولين بـ `|` مثل
 * `vocab:days_months|dialogue:1` أو `reading:1|writing:1`.
 * تقسيمها ضروري: بدونه يُقرأ اسم المجموعة `days_months|dialogue`
 * فتُفتح بطاقات فارغة.
 */
function parseRef(ref: string): Activity[] {
  return ref
    .split('|')
    .map((token) => token.trim())
    .filter(Boolean)
    // `vocab:family,numbers` مجموعتان — نفكّهما إلى مرجعين مستقلّين
    .flatMap((token) =>
      token.startsWith('vocab:')
        ? token
            .slice('vocab:'.length)
            .split(',')
            .map((g) => g.trim())
            .filter(Boolean)
            .map((g) => `vocab:${g}`)
        : [token],
    )
    .map((token): Activity => {
      if (token.startsWith('game:minimal_pairs') || token.startsWith('pron:')) {
        return { kind: 'pairs' };
      }
      if (token.startsWith('record')) {
        return { kind: 'record', baseline: token.includes('baseline') };
      }
      if (token.startsWith('vocab:')) {
        return { kind: 'flashcards', group: token.split(':')[1].split(',')[0] };
      }
      if (token.startsWith('exercises:')) {
        return { kind: 'exercises', day: token.split(':')[1] };
      }
      if (token.startsWith('dialogue:')) {
        return { kind: 'dialogue', number: Number(token.split(':')[1]) };
      }
      if (token.startsWith('writing')) {
        return { kind: 'writing' };
      }
      if (token.startsWith('section:')) {
        return { kind: 'section', sectionKind: token.slice('section:'.length) };
      }
      if (token.startsWith('review')) {
        return { kind: 'review' };
      }
      if (token.startsWith('spell:')) {
        return { kind: 'inday', what: token === 'spell:review' ? 'spell_review' : 'spell' };
      }
      if (token === 'shadow' || token === 'imitate' || token === 'homework') {
        return { kind: 'inday', what: token };
      }
      return { kind: 'unbuilt', ref: token };
    });
}

/** أسماء أقسام الشرح — `kind` قيمة نظامية ثابتة لا محتوى متغيّر */
const SECTION_NAMES: Record<string, string> = {
  grammar: 'القواعد',
  phonics: 'النطق',
  phrases: 'العبارات',
  listening: 'الاستماع',
  reading: 'القراءة',
  selfcheck: 'الاختبار الذاتي',
  speaking: 'التحدّث والتسجيل',
  situations: 'المواقف السبعة',
  conversation: 'أوّل محادثة حقيقيّة',
  word_test: 'اختبار الكلمات',
  comparison: 'المقارنة الكبرى',
};

const INDAY_NAMES: Record<string, string> = {
  spell: 'كتابة الكلمات',
  spell_review: 'مراجعة الإملاء',
  shadow: 'الشادوينج — تكلّم مع الصوت',
  imitate: 'اكتب مثله',
  homework: 'الواجب المنزلي',
};

/** عنوان النشاط في رأس النافذة */
function activityTitle(
  a: Activity,
  labels?: Record<string, string | null>,
  tr: (s: string) => string = (x) => x,
): string {
  switch (a.kind) {
    case 'pairs':
      return tr('التمييز الصوتي');
    case 'flashcards':
      return `بطاقات — ${iso(groupName(a.group, labels))}`;
    case 'exercises':
      return `تمارين اليوم ${a.day}`;
    case 'record':
      return a.baseline ? 'تسجيل خط الأساس' : 'التحدّث';
    case 'inday':
      return tr(INDAY_NAMES[a.what]);
    case 'writing':
      return tr('الكتابة');
    case 'review':
      return tr('مراجعة المفردات');
    case 'dialogue':
      return `حوار ${a.number}`;
    case 'section':
      return tr(SECTION_NAMES[a.sectionKind] ?? a.sectionKind);
    case 'unbuilt':
      return tr(UNBUILT_LABELS[a.ref.split(':')[0]] ?? a.ref);
  }
}

/* ====================================================================
 |  مكوّنات صغيرة
 |==================================================================== */

/** حلقة تقدّم الأسبوع — أوضح من شريط في رأس مزدحم */
function ProgressRing({ percent }: { percent: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * c;

  return (
    <div className="relative grid h-14 w-14 shrink-0 place-items-center sm:h-16 sm:w-16">
      <svg viewBox="0 0 64 64" className="h-14 w-14 -rotate-90 sm:h-16 sm:w-16">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <span className="absolute text-xs font-bold text-white sm:text-sm">
        {Math.round(percent)}%
      </span>
    </div>
  );
}

/* ====================================================================
 |  الصفحة
 |==================================================================== */

export default function WeekShow({
  week, days, vocabulary, vocabularyLabels, minimalPairs, dialogues, exercises, stats,
  writing, myWriting, myComparison, myNotes, speakingPlan, sections, prefs = DEFAULT_PREFS,
}: Props) {
  const tr = useT();
  const locale = useLocale();
  const [dayStates, setDayStates] = useState(days);

  /**
   * الأنشطة المفتوحة في النافذة.
   *
   * قائمة لا عنصر واحد، لأن مهمة واحدة قد تحمل نشاطين
   * (`reading:1|writing:1`) فنعرضهما كتبويبين بدل أن نُسقط أحدهما.
   */
  const [openActivities, setOpenActivities] = useState<Activity[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  const [openDialogue, setOpenDialogue] = useState<number | null>(null);
  const [hideEnglish, setHideEnglish] = useState(false);

  /** السرعة تحكم كل نطق في الصفحة — قيمة واحدة بدل إعداد في كل قسم */
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

  const [playingLine, setPlayingLine] = useState<PlayingLine>(null);
  const stopSequenceRef = useRef<(() => void) | null>(null);

  const { speak, speakSequence, stop, supported, hasGenderedVoices } = useSpeech();

  /** المكتبة مغلقة افتراضياً كي لا تنافس خطة اليوم على الانتباه */
  const [libraryOpen, setLibraryOpen] = useState(false);
  /*
   * Break time starts folded. Open, it was two thirds of the page —
   * songs, films and channels outside the study hour pushing the
   * week's plan off the screen. Folded, it is one line that says
   * how many activities wait and how many are done.
   */

  /**
   * القسم الظاهر الآن — يضيء تبويبه في الشريط.
   *
   * القائمة كانت أربعة نصوص بلا حالة، فلا يعرف المتدرّب أنها تنقّل
   * ولا أين هو منها. والتبويب المضيء يجيب السؤالين بلا شرح.
   */
  const [activeSection, setActiveSection] = useState('today');

  const stickyBar = useRef<HTMLDivElement>(null);

  /**
   * التمرير إلى قسم بإزاحة **مقيسة** لا مخمّنة.
   *
   * كانت `scroll-mt` قيمة ثابتة تُخمّن ارتفاع الشريطين الملتصقين،
   * وارتفاعهما يتغيّر: شريط السرعة يظهر ويختفي بحسب دعم المتصفح،
   * والشريط العلويّ 44 بكسل على الموبايل و56 على الحاسوب. فكان
   * عنوان القسم يقف خلف الشريط، فيبدو أن الضغط لم يفعل شيئاً.
   *
   * والقياس الفعلي يصيب في كل الحالات.
   */
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    const nav = document.querySelector('nav.sticky')?.getBoundingClientRect().height ?? 0;
    const bar = stickyBar.current?.getBoundingClientRect().height ?? 0;
    const y = el.getBoundingClientRect().top + window.scrollY - nav - bar - 8;

    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    setActiveSection(id);
  };

  useEffect(() => {
    const els = SECTIONS
      .map((x) => document.getElementById(x.id))
      .filter((x): x is HTMLElement => !!x);
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (seen) setActiveSection(seen.target.id);
      },
      // الثلث الأعلى من الشاشة: القسم «النشط» هو ما تقرأه لا ما يلامس الحدّ
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [libraryOpen]);

  const studySections = sections;

  const doneDays = dayStates.filter((d) => d.completed).length;
  const weekPercent = (doneDays / (dayStates.length || 7)) * 100;
  const vocabCount = Object.values(vocabulary).reduce((n, w) => n + w.length, 0);

  /**
   * يوم العمل الحالي.
   *
   * موضع المستخدم من enrollment إن كان في هذا الأسبوع، وإلا أول يوم
   * مفتوح غير مكتمل — حتى لا تظهر الصفحة بلا نقطة بدء عند تصفّح
   * أسبوع سابق.
   */
  const todayDay =
    (stats.current_week === week.number
      ? dayStates.find((d) => d.number === stats.current_day && d.unlocked)
      : undefined) ??
    dayStates.find((d) => d.unlocked && !d.completed) ??
    null;

  /**
   * فتح نشاط في نافذة فوق الصفحة.
   *
   * لا تمرير ولا انتقال — النافذة تظهر مكانك وتُغلق فتبقى حيث كنت.
   * التمرير للأعلى كان يفقد المتدرّب موضعه، وهو ما يجعل التجربة
   * تبدو عشوائية.
   */
  const openActivity = (ref: string) => {
    const list = parseRef(ref);
    if (list.length === 0) return;

    setOpenActivities(list);
    setActiveTab(0);
  };

  const closeActivities = () => {
    setOpenActivities([]);
    stopEverything();
  };

  /** عند إتمام يوم — نفتح اليوم التالي في الحالة المحلية فوراً */
  const handleDayCompleted = (dayNumber: number) => {
    setDayStates((prev) =>
      prev.map((d) =>
        d.number === dayNumber
          ? { ...d, completed: true }
          : d.number === dayNumber + 1
            ? { ...d, unlocked: true }
            : d,
      ),
    );
  };

  /** جنس متحدّث سطر معيّن — أساس اختيار الصوت */
  const genderOfSpeaker = (d: Dialogue, speaker: string): Gender | undefined =>
    d.speaker_genders?.[speaker] ?? d.speaker_genders?.[speaker.toUpperCase()];

  /** تشغيل الحوار كاملاً — كل سطر بصوت متحدّثه، مع إبراز السطر الجاري */
  const playDialogue = (d: Dialogue) => {
    stopSequenceRef.current?.();

    stopSequenceRef.current = speakSequence(
      // Stage directions are not spoken
      d.lines
        .filter((l) => l.speaker)
        .map((l) => ({ text: l.en, gender: genderOfSpeaker(d, l.speaker) })),
      {
        rate,
        onLine: (index) => setPlayingLine({ dialogue: d.number, index }),
        onDone: () => setPlayingLine(null),
      },
    );
  };

  const stopEverything = () => {
    stopSequenceRef.current?.();
    stopSequenceRef.current = null;
    setPlayingLine(null);
    stop();
  };

  const isPlayingThis = (d: Dialogue) => playingLine?.dialogue === d.number;

  /**
   * وصف ما تفتحه المهمة بالأرقام.
   *
   * «تدريب النطق — §8» عنوان لا يقول شيئاً. «12 زوجاً صوتياً في 3
   * مجموعات» يقول للمتدرّب ما ينتظره وكم يستغرق، فيدخل مستعداً.
   */
  const describeRef = (ref: string): string | null => {
    const parts = parseRef(ref)
      .map((a): string | null => {
        switch (a.kind) {
          case 'pairs': {
            const pairs = minimalPairs.reduce((n, g) => n + g.pairs.length, 0);
            const groups = minimalPairs.length;
            return `${pairs} زوجاً صوتياً في ${groups} مجموعات`;
          }
          case 'flashcards': {
            const n = vocabulary[a.group]?.length ?? 0;
            return `${iso(groupName(a.group, vocabularyLabels))} — ${n} كلمة`;
          }
          case 'exercises': {
            const n = exercises[a.day]?.length ?? 0;
            return n > 0 ? `${n} تمريناً بتصحيح فوري` : tr('لا تمارين لهذا اليوم');
          }
          case 'record': {
            // الوصف يقول الموضوع لا المدّة فقط — المدّة لا تُغري أحداً
            const brief = sections.find((s) => s.kind === 'speaking')
              ?.payload as SpeakingPayload | undefined;

            if (brief) return brief.task_ar;

            return a.baseline
              ? tr('تسجيل 120 ثانية — خط الأساس الذي تقارن به لاحقاً')
              : tr('تسجيل 90 ثانية');
          }
          case 'writing':
            return writing
              ? `${writing.templates.length} قالب جملة · ${writing.min_words} كلمة على الأقل`
              : null;
          case 'dialogue': {
            const d = dialogues.find((x) => x.number === a.number);
            return d ? `${iso(d.title)} — ${d.lines.length} سطراً بصوتين` : null;
          }
          case 'review':
            return tr('تكرار متباعد — البطاقات المستحقة اليوم');
          case 'inday':
            return tr('تمرين خاص بيومه — يُفتح من صفحة اليوم');
          case 'section': {
            const sec = sections.find((x) => x.kind === a.sectionKind);
            if (!sec) return null;
            const p = (sec.payload ?? {}) as any;
            // العدّ يقول للمتدرّب ما ينتظره قبل أن يفتح
            const n =
              a.sectionKind === 'grammar'
                ? (p.common_errors ?? []).length && `${p.common_errors.length} خطأً شائعاً وقاعدته`
                : a.sectionKind === 'phonics'
                  ? (p.symbols ?? []).length && `${p.symbols.length} صوتاً بأمثلة مسموعة`
                  : a.sectionKind === 'listening'
                    ? (p.transcript ?? []).length && `${p.transcript.length} فقرات بنصّها وترجمتها`
                    : a.sectionKind === 'reading'
                      ? (p.story ?? []).length && `${p.story.length} فقرات مع مسرد`
                      : a.sectionKind === 'phrases'
                        ? (p.groups ?? []).length && `${p.groups.length} مجموعات عبارات`
                        : a.sectionKind === 'selfcheck'
                          ? (p.items ?? []).length && `${p.items.length} بنداً تُقيّم بها نفسك`
                          : null;
            return (n as string) || sec.title_ar || null;
          }
          case 'unbuilt':
            return tr('قيد التجهيز');
        }
      })
      .filter((x): x is string => Boolean(x));

    return parts.length > 0 ? parts.join('  ·  ') : null;
  };

  /**
   * أسطر الحوار كمحادثة — الأنثى في جهة والذكر في الأخرى.
   * مستخرجة في دالة لأنها تُعرض في مكانين: قسم الحوارات والنافذة.
   */
  const renderDialogueLines = (d: Dialogue) => (
    <div className="space-y-3">
      {d.lines.map((line, i) => {
        // A scene break, not a turn — it belongs to nobody
        if (!line.speaker) {
          return <StageDirection key={i} en={line.en} ar={line.ar} />;
        }

        const gender = genderOfSpeaker(d, line.speaker);
        const isFemale = gender === 'f';
        const active = isPlayingThis(d) && playingLine?.index === i;

        return (
          <div
            key={i}
            className={`flex items-start gap-2.5 ${isFemale ? '' : 'flex-row-reverse'}`}
          >
            <span
              className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full
                          text-xs font-bold text-white
                          ${isFemale ? 'bg-rose-400' : 'bg-sky-500'}
                          ${
                            active
                              ? 'ring-2 ring-offset-2 ' +
                                (isFemale ? 'ring-rose-300' : 'ring-sky-300')
                              : ''
                          }`}
              title={line.speaker}
            >
              {line.speaker.charAt(0)}
            </span>

            <div
              className={`min-w-0 max-w-[85%] rounded-2xl px-4 py-2.5 transition
                          ${
                            isFemale
                              ? 'rounded-tr-sm bg-rose-50 ring-1 ring-rose-100'
                              : 'rounded-tl-sm bg-sky-50 ring-1 ring-sky-100'
                          }
                          ${
                            active
                              ? 'shadow-md ring-2 ' +
                                (isFemale ? 'ring-rose-300' : 'ring-sky-300')
                              : ''
                          }`}
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
                <Listen text={line.en} gender={gender} size="sm" />
              </div>

              {!hideEnglish && (
                <p className="text-sm leading-relaxed text-slate-900" dir="ltr">
                  {line.en}
                </p>
              )}

              <p
                className={`text-sm leading-relaxed text-slate-500 ${
                  hideEnglish ? '' : 'mt-1'
                }`}
              >
                {line.ar}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );

  /** عرض نشاط واحد داخل النافذة */
  const renderActivity = (a: Activity) => {
    switch (a.kind) {
      case 'pairs':
        return <MinimalPairGame groups={minimalPairs} />;

      case 'flashcards':
        return (
          <Flashcards
            words={vocabulary[a.group] ?? []}
            groupLabel={groupName(a.group, vocabularyLabels)}
          />
        );

      case 'exercises':
        return <ExerciseRunner exercises={exercises[a.day] ?? []} />;

      case 'record': {
        const brief = sections.find((s) => s.kind === 'speaking')
          ?.payload as SpeakingPayload | undefined;

        return (
          <div className="space-y-4">
            {brief && <SpeakingBrief speaking={brief} />}

            {/* No recorder: the recording lives on the learner's phone (§4.2) */}
            <p className="rounded-xl bg-violet-50 p-4 text-sm leading-relaxed text-violet-900">
              {tr('سجّل على جوالك بمسجّل الصوت، ثم اسمع تسجيلك مرة وقيّم نفسك بالجدول أعلاه.')}
            </p>
          </div>
        );
      }

      case 'review':
        return <ReviewSession weekNumber={week.number} />;

      case 'writing':
        return writing ? (
          <WritingTask
            weekNumber={week.number}
            writing={writing}
            existing={myWriting}
          />
        ) : (
          <p className="p-6 text-sm text-slate-500">
            {tr('لا توجد مهمة كتابة في هذا الأسبوع.')}
          </p>
        );

      case 'dialogue': {
        const d = dialogues.find((x) => x.number === a.number);
        if (!d) {
          return <p className="p-6 text-sm text-slate-500">{tr('الحوار غير موجود.')}</p>;
        }
        return (
          <div className="space-y-3">
            <button
              onClick={() => (isPlayingThis(d) ? stopEverything() : playDialogue(d))}
              disabled={!supported}
              className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-medium
                         text-white transition hover:bg-violet-700
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPlayingThis(d) ? <><Square aria-hidden size={15} className="inline-block align-[-3px]" fill="currentColor" /> {tr('أوقف')}</> : <><Play aria-hidden size={15} className="inline-block align-[-3px]" fill="currentColor" /> {tr('شغّل الحوار كاملاً')}</>}
            </button>
            {renderDialogueLines(d)}
          </div>
        );
      }

      case 'section': {
        const sec = sections.find((x) => x.kind === a.sectionKind);
        if (!sec) return null;
        return <SectionView section={sec} rate={rate} voice={voice}
                    weekNumber={week.number} myComparison={myComparison} myNotes={myNotes} />;
      }

      case 'inday':
        return (
          <div className="p-6 text-center">
            <p className="font-semibold text-slate-800">{activityTitle(a, vocabularyLabels, tr)}</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
              {tr('هذا التمرين يتغيّر كل يوم: كلمات اليوم وفقرة اليوم. افتحه من صفحة اليوم.')}
            </p>
            {todayDay && (
              <Link
                href={`/week/${week.number}/day/${todayDay.number}`}
                className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white
                           transition hover:bg-violet-700"
              >
                {tr('افتح اليوم')} {todayDay.number}
              </Link>
            )}
          </div>
        );

      case 'unbuilt':
        return (
          <div className="p-6 text-center">
            <Construction aria-hidden size={32} strokeWidth={1.5} className="mx-auto text-slate-400" />
            <p className="mt-3 font-semibold text-slate-800">
              {activityTitle(a, vocabularyLabels, tr)} — لم يُبنَ بعد
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
              {tr('هذا القسم قيد التجهيز في المنصة. أشّر المهمة حين تنجزها.')}
            </p>
            <p className="mt-3 font-mono text-xs text-slate-400" dir="ltr">
              {a.ref}
            </p>
          </div>
        );
    }
  };

  return (
    <div dir={dirOf(locale)} className="min-h-screen bg-slate-50 pb-28 sm:pb-20">
      <Head title={`الأسبوع ${week.number} — ${week.title_ar}`} />

      <AppNav />

      {/*
        ============ الرأس ============
        فاتح لا أخضر: الأخضر في هذه المنصة يعني «تمّ» و«صحيح»، فلوحٌ
        أخضر فوق كل صفحة يستهلك المعنى. والنيلي هنا للموضع والتقدّم.
        وعلى الموبايل ينضغط إلى سطرين بلا أن يأكل الشاشة.
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

        <div className="relative mx-auto max-w-4xl px-4 py-4 sm:py-6">
          <div className="flex items-center gap-2 text-xs text-violet-100/85">
            <Link href="/dashboard" className="transition hover:text-white">
              {tr('لوحة التقدّم')}
            </Link>
            <span aria-hidden><ChevronLeft aria-hidden size={16} /></span>
            <span>الوحدة {week.module}</span>
          </div>

          <div className="mt-2.5 flex items-start gap-3 sm:gap-4">
            {/* رقم الأسبوع ككتلة بصرية — يثبّت «أين أنا» في الذهن */}
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur sm:h-16 sm:w-16">
              <span className="text-xs font-medium text-violet-100/85">{tr('أسبوع')}</span>
              <span className="-mt-0.5 text-2xl font-bold text-white">{week.number}</span>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold leading-snug text-white sm:text-2xl">
                {week.title_ar}
              </h1>
              <p className="mt-0.5 hidden truncate text-xs text-violet-100/80 sm:block sm:text-sm" dir="ltr">
                {week.title_en}
              </p>
            </div>

            {/* الحلقة تبقى ظاهرة على الموبايل — هي جواب «كم أنجزت» */}
            <ProgressRing percent={weekPercent} />
          </div>

          {/* الأرقام في سطر مستقلّ: على الموبايل لا تزاحم العنوان */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {[
              { v: stats.streak, l: tr('سلسلة'), icon: <Flame size={14} /> },
              { v: `${doneDays}/${dayStates.length}`, l: tr('أيام'), icon: <CalendarCheck size={14} /> },
              {
                v: `مسار ${stats.track}`,
                l: stats.track === 'A' ? tr('ساعة يومياً') : tr('ساعتان يومياً'),
                icon: <Timer size={14} />,
              },
            ].map((x, i) => (
              <span
                key={i}
                className="flex items-baseline gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5
                           text-xs ring-1 ring-white/20 backdrop-blur"
              >
                <span aria-hidden className="opacity-70">{x.icon}</span>
                <span className="font-bold text-white">{x.v}</span>
                <span className="text-xs text-violet-100/80">{x.l}</span>
              </span>
            ))}
          </div>

          {/*
            الخطّة الأسبوعيّة للكلام.
            اختيارٌ يُتّخذ مرّة في الأسبوع الثاني عشر، والتزامه أسبوعيّ
            متكرّر — فمكانه هنا، في أعلى كل أسبوع يفتحه بعدها، لا في
            قسمٍ لن يعود إليه.
          */}
          {speakingPlan && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/15 px-3 py-2.5 ring-1 ring-white/20 backdrop-blur">
              <MessageCircle aria-hidden size={16} className="mt-0.5 shrink-0 opacity-80" />

              <p className="min-w-0 flex-1 text-sm leading-relaxed text-white">
                <span className="text-violet-100/80">{tr('خطّتك للكلام هذا الأسبوع:')} </span>
                {speakingPlan}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* ============ شريط ثابت: أقسام الصفحة + سرعة النطق ============ */}
      <div ref={stickyBar} className="sticky top-11 z-30 border-b border-slate-200 bg-white/90 backdrop-blur sm:top-14">
        <div className="mx-auto max-w-4xl px-4">
          {/* الأقسام — أيقونة ونصّ، وحجم يسهل على الإبهام */}
          <nav className="-mx-1 flex gap-1 overflow-x-auto py-2">
            {SECTIONS.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  // «كل المحتوى» يُفتح أيضاً — التمرير إلى زرّ مغلق لا يفيد
                  if (sec.id === 'library') setLibraryOpen(true);
                  // بعد الفتح لأن ارتفاع الصفحة يتغيّر بفتحه
                  requestAnimationFrame(() => scrollToSection(sec.id));
                }}
                className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm
                            ring-1 transition active:scale-95 ${
                              activeSection === sec.id
                                ? 'bg-violet-600 text-white ring-violet-600'
                                : 'bg-slate-50 text-slate-700 ring-slate-200 hover:bg-violet-50 hover:text-violet-800 hover:ring-violet-200'
                            }`}
              >
                <span aria-hidden>{sec.icon}</span>
                <span className="whitespace-nowrap font-medium">{tr(sec.label)}</span>
              </a>
            ))}
          </nav>

          {supported && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 py-2">
              <SpeechControls
                voice={voice}
                onVoice={setVoice}
                rate={rate}
                onRate={setRate}
                size="md"
                label={tr('سرعة النطق')}
              />
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-4xl space-y-10 px-4 py-8">
        {!supported && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {tr('متصفحك لا يدعم النطق الآلي. كل شيء آخر يعمل، لكن أزرار الاستماع معطّلة — استخدم Chrome أو Edge للاستفادة من النطق.')}
          </div>
        )}

        {/* ============ اليوم — نقطة البدء الوحيدة ============
             وحدة التنظيم هي اليوم لا الأسبوع. المتدرّب يفتح الصفحة
             فيجد مهام يومه ومحتواها أمامه، ولا يتصفّح أسبوعاً كاملاً
             ليعرف من أين يبدأ. قاعدة الكتاب: «الكتاب مرجع لا رواية». */}
        <section id="today" className="scroll-mt-32 sm:scroll-mt-36">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="flex items-baseline gap-2 text-lg font-bold text-slate-900">
              ابدأ من هنا
              {todayDay && (
                <span className="ms-2 text-sm font-normal text-slate-500">
                  اليوم {todayDay.number} من سبعة
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">
              {todayDay
                ? `${todayDay.minutes * (stats.track === 'B' ? 2 : 1)} دقيقة · ${todayDay.tasks.length} مهام`
                : ''}
            </p>
          </div>

          {todayDay ? (
            <>
              <div className="mb-3 flex gap-3 rounded-xl border-s-4 border-violet-500 bg-violet-50/70 p-4">
                <Pin aria-hidden size={17} className="mt-0.5 shrink-0 text-violet-600" />
                <p className="text-sm leading-relaxed text-violet-900">
                  <strong>{tr('أنجز مهام هذا اليوم فقط، ثم أغلق الصفحة.')}</strong> {tr('كل مهمة تفتح ما تحتاجه بنقرة — لا تبحث في الأسبوع. اليوم التالي يُفتح تلقائياً عند إتمام الخمس.')}
                </p>
              </div>

              <DayCard
                key={`today-${todayDay.number}`}
                weekNumber={week.number}
                day={todayDay}
                track={stats.track}
                isCurrent
                defaultExpanded
                describeRef={describeRef}
                onDayCompleted={handleDayCompleted}
                onOpenActivity={openActivity}
              />
            </>
          ) : (
            <div className="rounded-xl bg-white p-6 text-center ring-1 ring-slate-200">
              <p className="text-sm text-slate-600">
                {tr('أنهيت كل أيام هذا الأسبوع. افتح أي يوم أدناه للمراجعة.')}
              </p>
            </div>
          )}
        </section>

        {/* ============ الأسبوع كامل ============ */}
        <section id="plan" className="scroll-mt-32 sm:scroll-mt-36">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-slate-900">{tr('الأيام السبعة')}</h2>
            <p className="text-xs text-slate-500">
              {doneDays} مكتمل · المكتمل يبقى متاحاً للمراجعة
            </p>
          </div>

          {/* شريط الأيام — نظرة واحدة تكفي لمعرفة الموضع */}
          <div className="mb-4 flex gap-1.5">
            {dayStates.map((d) => {
              const isCurrent =
                stats.current_week === week.number && stats.current_day === d.number;

              return (
                <div
                  key={d.number}
                  title={`اليوم ${d.number} — ${iso(cleanLabel(d.focus))}`}
                  className={`flex h-1.5 flex-1 overflow-hidden rounded-full
                              ${isCurrent ? 'ring-1 ring-violet-600' : ''}
                              ${d.completed ? 'bg-violet-700' : d.unlocked ? 'bg-slate-200' : 'bg-slate-100'}`}
                >
                  {!d.completed && d.unlocked && d.percent > 0 && (
                    <span
                      className="bg-violet-400"
                      style={{ width: `${d.percent}%` }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            {dayStates.map((day) => (
              <DayCard
                key={day.number}
                weekNumber={week.number}
                day={day}
                track={stats.track}
                isCurrent={
                  stats.current_week === week.number && stats.current_day === day.number
                }
                defaultExpanded={false}
                describeRef={describeRef}
                onDayCompleted={handleDayCompleted}
                onOpenActivity={openActivity}
              />
            ))}
          </div>
        </section>


        {/* ============ مكتبة الأسبوع ============
             المحتوى الكامل مرجع يُفتح عند الحاجة، لا شيء يتصفّحه
             من أوله لآخره. مغلقة افتراضياً كي لا تنافس خطة اليوم. */}
        <section id="library" className="scroll-mt-32 sm:scroll-mt-36">
          <button
            onClick={() => setLibraryOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl bg-white p-5
                       text-start ring-1 ring-slate-200 transition hover:ring-slate-300"
          >
            <div>
              <h2 className="text-lg font-bold text-slate-900">{tr('كل محتوى الأسبوع')}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                كل المحتوى مرجعاً — الأهداف، {vocabCount} كلمة، النطق، الكتابة،{' '}
                {dialogues.length} حوارات
              </p>
            </div>
            <span className="shrink-0 text-slate-400">{libraryOpen ? <ChevronUp aria-hidden size={16} /> : <ChevronDown aria-hidden size={16} />}</span>
          </button>
        </section>

        {libraryOpen && (
          <>
        {/* ============ الأهداف ============ */}
        <section
          id="objectives"
          className="scroll-mt-16 rounded-2xl bg-white p-6 ring-1 ring-slate-200"
        >
          <h2 className="mb-1 text-lg font-bold text-slate-900">{tr('ما ستستطيع فعله')}</h2>
          <p className="mb-5 text-xs text-slate-500">
            {tr('نهاية هذا الأسبوع، هذه الجمل تصبح في متناولك')}
          </p>

          <ul className="grid gap-3 sm:grid-cols-2">
            {week.objectives.map((o, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-xl bg-slate-50/80 p-3.5 ring-1 ring-slate-100"
              >
                <span
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg
                             bg-violet-600 text-xs font-bold text-white"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-slate-800">{o.ar}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500" dir="ltr">
                    {o.en}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ============ المفردات ============ */}
        <section id="vocab" className="scroll-mt-32 sm:scroll-mt-36">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {tr('المفردات')}
              <span className="ms-2 text-sm font-normal text-slate-500">
                {Object.values(vocabulary).reduce((n, w) => n + w.length, 0)} كلمة
              </span>
            </h2>
            <p className="text-xs text-slate-500">{tr('العربي أولاً — أنتِج الإنجليزية')}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(vocabulary).map(([group, words]) => {
              const tone = toneOf(group);

              return (
                <div
                  key={group}
                  className={`flex flex-col rounded-2xl bg-white p-5 ring-1 transition
                              hover:shadow-md ${tone.ring}`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-semibold text-slate-800">
                      <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                      {groupName(group, vocabularyLabels)}
                    </h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone.chip}`}>
                      {words.length} كلمة
                    </span>
                  </div>

                  {/* عيّنة — العربية أولاً كما ينصّ الكتاب */}
                  <div className="mb-4 flex-1 space-y-2">
                    {words.slice(0, 4).map((w) => (
                      <div
                        key={w.id}
                        className="flex items-center justify-between gap-3 rounded-lg
                                   px-2 py-1.5 transition hover:bg-slate-50"
                      >
                        <span className="truncate text-sm text-slate-700">{w.arabic}</span>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-medium text-slate-900" dir="ltr">
                            {w.word}
                          </span>
                          <Listen text={w.word} size="sm" />
                        </div>
                      </div>
                    ))}

                    {words.length > 4 && (
                      <p className="px-2 pt-1 text-xs text-slate-400">
                        و{words.length - 4} كلمة أخرى في البطاقات…
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => openActivity(`vocab:${group}`)}
                    className="rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white
                               transition hover:bg-slate-800 active:scale-[.99]"
                  >
                    {tr('ابدأ البطاقات')}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ============ النطق ============ */}
        <section
          id="pron"
          className="scroll-mt-16 rounded-2xl bg-white p-6 ring-1 ring-slate-200"
        >
          <h2 className="mb-1 text-lg font-bold text-slate-900">{tr('النطق — التمييز الصوتي')}</h2>
          <p className="mb-5 max-w-2xl text-sm leading-relaxed text-slate-600">
            <strong className="text-slate-800">{tr('الاستماع أولاً.')}</strong> {tr('لا يمكنك إنتاج صوت لا تسمعه. المتصفح ينطق إحدى الكلمتين وأنت تختار ما سمعته — الهدف ١١ من ١٢.')}
          </p>

          <div className="mb-5 space-y-3">
            {minimalPairs.map((g) => (
              <div key={g.label_en} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    {g.label_ar ?? g.label_en}
                  </p>
                  <p
                    className="shrink-0 rounded-md bg-white px-2 py-0.5 font-mono text-sm text-violet-700 ring-1 ring-slate-200"
                    dir="ltr"
                  >
                    {g.ipa}
                  </p>
                </div>

                {/* سطر التدريب من الكتاب — الاسم يقول ماذا، وهذا يقول كيف */}
                {g.hint_ar && (
                  <p className="mb-3 text-xs leading-relaxed text-slate-600">{g.hint_ar}</p>
                )}

                <div className="flex flex-wrap gap-2" dir="ltr">
                  {g.pairs.map((p) => (
                    <div
                      key={p.id}
                      className="flex overflow-hidden rounded-lg ring-1 ring-slate-200"
                    >
                      {[p.word_a, p.word_b].map((w, i) => (
                        <button
                          key={w}
                          onClick={() => speak(w, { rate: myRate, gender: myVoice })}
                          disabled={!supported}
                          className={`bg-white px-3 py-1.5 text-xs font-medium text-slate-700
                                      transition hover:bg-violet-600 hover:text-white
                                      disabled:cursor-not-allowed disabled:opacity-50
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
          </div>

          <button
            onClick={() => openActivity('game:minimal_pairs')}
            className="w-full rounded-xl bg-gradient-to-l from-violet-600 to-violet-500 py-3
                       font-semibold text-white shadow-sm transition
                       hover:from-violet-700 hover:to-violet-600 active:scale-[.995]"
          >
            {tr('ابدأ اللعبة')}
          </button>
        </section>

        {/* ============ الكتابة §9 ============ */}
        {writing && (
          <section
            id="writing"
            className="scroll-mt-16 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
          >
            <div className="bg-gradient-to-bl from-violet-600 to-violet-500 p-6">
              <p className="text-xs font-medium text-violet-100">{tr('مهارة الكتابة')}</p>
              <h2 className="mt-1 text-lg font-bold text-white">{writing.title_ar}</h2>
              <p className="mt-0.5 text-sm text-violet-100/90" dir="ltr">
                {writing.title_en}
              </p>
            </div>

            <div className="p-6">
              <p className="text-sm leading-relaxed text-slate-700">{writing.task_ar}</p>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <span>{writing.min_words} كلمة على الأقل</span>
                <span>{writing.templates.length} قالب جملة</span>
                {myWriting && (
                  <span className="font-medium text-emerald-600">
                    كتبت {myWriting.word_count} كلمة
                    {myWriting.self_score ? ` · تقييمك ${myWriting.self_score}/5` : ''}
                  </span>
                )}
              </div>

              <button
                onClick={() => openActivity('writing:1')}
                className="mt-5 w-full rounded-xl bg-violet-600 py-3 font-semibold text-white
                           shadow-sm transition hover:bg-violet-700 active:scale-[.995]"
              >
                {myWriting ? tr('أكمل الكتابة') : tr('ابدأ الكتابة')}
              </button>
            </div>
          </section>
        )}

        {/* ============ أقسام الشرح مرجعاً ============
             تُدرَس في أيامها، وتُعرض هنا للمراجعة. */}
        {studySections.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">{tr('أقسام الشرح')}</h2>
            {studySections.map((sec) => (
              <details
                key={sec.id}
                className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
              >
                <summary className="cursor-pointer p-5 text-sm font-semibold text-slate-800">
                  {sec.title_ar}
                </summary>
                <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5">
                  <SectionView section={sec} rate={rate} voice={voice}
                    showTranslation={prefs.showTranslation}
                    weekNumber={week.number} myComparison={myComparison} myNotes={myNotes} />
                </div>
              </details>
            ))}
          </section>
        )}

        {/* ============ الحوارات ============ */}
        <section id="dialogues" className="scroll-mt-32 sm:scroll-mt-36">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">{tr('الحوارات')}</h2>

            <label
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-1.5
                         text-sm text-slate-600 ring-1 ring-slate-200 transition
                         hover:ring-slate-300"
            >
              <input
                type="checkbox"
                checked={hideEnglish}
                onChange={(e) => setHideEnglish(e.target.checked)}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              {tr('أخفِ الإنجليزية — أنتِج من العربية')}
            </label>
          </div>

          {supported && !hasGenderedVoices && (
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              {tr('متصفحك يوفّر صوتاً إنجليزياً واحداً، فسيتحدّث الطرفان بالصوت نفسه. تثبيت أصوات إنجليزية إضافية من إعدادات النظام يفصل بينهما.')}
            </div>
          )}

          <div className="space-y-4">
            {dialogues.map((d) => {
              const isOpen = openDialogue === d.number;
              const speakers = Object.keys(d.speaker_genders ?? {});

              return (
                <div
                  key={d.number}
                  className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
                >
                  <button
                    onClick={() => {
                      setOpenDialogue(isOpen ? null : d.number);
                      if (isOpen) stopEverything();
                    }}
                    className="flex w-full items-center justify-between gap-3 p-5 text-start
                               transition hover:bg-slate-50/70"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                          حوار {d.number}
                        </span>
                        {/* أفاتار المتحدثين — يُعرّف الطرفين قبل الفتح */}
                        <div className="flex gap-1">
                          {speakers.map((name) => {
                            const g = d.speaker_genders[name];
                            return (
                              <span
                                key={name}
                                title={name}
                                className={`grid h-5 w-5 place-items-center rounded-full
                                            text-xs font-bold text-white
                                            ${g === 'f' ? 'bg-rose-400' : 'bg-sky-500'}`}
                              >
                                {name.charAt(0)}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <p className="mt-1.5 truncate font-semibold text-slate-900" dir="ltr">
                        {d.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {d.situation_ar ?? d.situation_en}
                      </p>
                    </div>

                    <span className="shrink-0 text-slate-400">{isOpen ? <ChevronUp aria-hidden size={16} /> : <ChevronDown aria-hidden size={16} />}</span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100">
                      {/* شريط تحكّم الحوار */}
                      <div className="flex flex-wrap items-center gap-2 bg-slate-50/70 px-4 py-3">
                        {isPlayingThis(d) ? (
                          <button
                            onClick={stopEverything}
                            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2
                                       text-sm font-medium text-white transition hover:bg-rose-700"
                          >
                            <Square aria-hidden size={15} className="inline-block align-[-3px]" fill="currentColor" /> {tr('أوقف')}
                          </button>
                        ) : (
                          <button
                            onClick={() => playDialogue(d)}
                            disabled={!supported}
                            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2
                                       text-sm font-medium text-white transition
                                       hover:bg-violet-700 disabled:cursor-not-allowed
                                       disabled:opacity-50"
                          >
                            <Play aria-hidden size={15} className="inline-block align-[-3px]" fill="currentColor" /> {tr('شغّل الحوار كاملاً')}
                          </button>
                        )}

                        <p className="text-xs text-slate-500">
                          {tr('كل متحدّث بصوته · السرعة من الشريط الأعلى')}
                        </p>
                      </div>

                      {/* الأسطر كمحادثة — الدالة نفسها تُستخدم في النافذة */}
                      <div className="p-4 sm:p-5">{renderDialogueLines(d)}</div>

                      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3">
                        <p className="text-xs leading-relaxed text-slate-500">
                          <strong className="text-slate-700">{tr('الموقف:')}</strong>{' '}
                          {d.situation_ar ?? d.situation_en}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
          </>
        )}
      </main>

      {/* ============ نافذة النشاط ============
           تظهر فوق الصفحة ولا تحرّك التمرير — تُغلق فتبقى حيث كنت.
           التبويبات تظهر فقط حين تحمل المهمة أكثر من نشاط. */}
      <Modal
        show={openActivities.length > 0}
        onClose={closeActivities}
        maxWidth="4xl"
      >
        <div dir="rtl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            {openActivities.length > 1 ? (
              <div className="flex min-w-0 gap-1 overflow-x-auto">
                {openActivities.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition
                                ${
                                  activeTab === i
                                    ? 'bg-white text-violet-700 shadow-sm ring-1 ring-slate-200'
                                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                                }`}
                  >
                    {activityTitle(a, vocabularyLabels, tr)}
                  </button>
                ))}
              </div>
            ) : (
              <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span className="truncate">
                  {openActivities[0] ? activityTitle(openActivities[0], vocabularyLabels, tr) : ''}
                </span>
              </h2>
            )}

            <button
              onClick={closeActivities}
              className="shrink-0 rounded-lg px-2.5 py-1 text-sm text-slate-400
                         transition hover:bg-slate-200/70 hover:text-slate-700"
            >
              {tr('إغلاق')}
            </button>
          </div>

          <div className="max-h-[75vh] overflow-y-auto p-3 sm:p-5">
            {openActivities[activeTab] && renderActivity(openActivities[activeTab])}
          </div>
        </div>
      </Modal>
    </div>
  );
}
