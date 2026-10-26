import {
  Clapperboard,
  BookOpen,
  BookOpenText,
  ClipboardCheck,
  Ear,
  Feather,
  Headphones,
  Compass,
  House,
  Languages,
  ListChecks,
  MessageCircle,
  MessagesSquare,
  Mic,
  NotebookPen,
  PenLine,
  RotateCcw,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';

/**
 * What a day task is, at a glance: an icon and one line on why it exists.
 *
 * The task name says *what* opens ("Spelling"); the line says what the
 * learner is about to do with it ("write the word letter by letter").
 * A beginner reads the second and knows whether this is listening,
 * writing or speaking before the first tap.
 *
 * Derived from the task's first block, which the server already sends —
 * so no content file has to name an icon.
 */
/**
 * Each kind of work has its own colour, so a day reads as a row of
 * different things at a glance — listening is not writing — instead of
 * eight identical violet circles. The palettes are ones the dark layer
 * in app.css already remaps; the class strings are written out whole
 * so Tailwind keeps them.
 */
export type Tone = 'violet' | 'sky' | 'amber' | 'emerald' | 'rose' | 'teal' | 'fuchsia' | 'cyan';

export const TONES: Record<Tone, { soft: string; ring: string; text: string; solid: string; bar: string }> = {
  violet:  { soft: 'bg-violet-50',  ring: 'ring-violet-200',  text: 'text-violet-700',  solid: 'bg-violet-600 text-white',  bar: 'bg-violet-500' },
  sky:     { soft: 'bg-sky-50',     ring: 'ring-sky-100',     text: 'text-sky-700',     solid: 'bg-sky-600 text-white',     bar: 'bg-sky-500' },
  amber:   { soft: 'bg-amber-50',   ring: 'ring-amber-200',   text: 'text-amber-700',   solid: 'bg-amber-500 text-white',   bar: 'bg-amber-400' },
  emerald: { soft: 'bg-emerald-50', ring: 'ring-emerald-200', text: 'text-emerald-700', solid: 'bg-emerald-600 text-white', bar: 'bg-emerald-500' },
  rose:    { soft: 'bg-rose-50',    ring: 'ring-rose-200',    text: 'text-rose-700',    solid: 'bg-rose-500 text-white',    bar: 'bg-rose-400' },
  teal:    { soft: 'bg-teal-50',    ring: 'ring-teal-200',    text: 'text-teal-700',    solid: 'bg-teal-600 text-white',    bar: 'bg-teal-500' },
  fuchsia: { soft: 'bg-fuchsia-50', ring: 'ring-violet-200',  text: 'text-fuchsia-700', solid: 'bg-fuchsia-600 text-white', bar: 'bg-fuchsia-500' },
  cyan:    { soft: 'bg-cyan-50',    ring: 'ring-teal-100',    text: 'text-cyan-700',    solid: 'bg-cyan-600 text-white',    bar: 'bg-cyan-500' },
};

const TONE_OF: Record<string, Tone> = {
  section: 'violet', vocabulary: 'amber', dialogue: 'sky', minimal_pairs: 'fuchsia', spelling: 'cyan',
  review: 'teal', exercises: 'violet', watch: 'rose', imitate: 'emerald', writing: 'emerald',
  homework: 'amber', record: 'rose',
};

export interface TaskKind {
  Icon: LucideIcon;
  tone: Tone;
  /** One or two words for the progress bar, where seven must fit a phone */
  short: string;
  /** Plain Arabic, one short line */
  purpose: string;
}

interface BlockLike {
  type: string;
  production?: boolean;
  review?: boolean;
  section?: { kind: string };
}

const SECTIONS: Record<string, Omit<TaskKind, 'tone'>> = {
  phonics: { Icon: Ear, short: 'النطق', purpose: 'رموز النطق، وكيف يتحرّك الفم لكل صوت' },
  phrases: { Icon: MessageCircle, short: 'العبارات', purpose: 'عبارات تنقذك حين لا تفهم' },
  grammar: { Icon: BookOpen, short: 'القواعد', purpose: 'القاعدة، ومقارنتها بالعربية، والأخطاء الشائعة' },
  listening: { Icon: Headphones, short: 'الاستماع', purpose: 'استمع أربع مرات بطريقة الكتاب' },
  reading: { Icon: BookOpenText, short: 'القراءة', purpose: 'اقرأ نصاً قصيراً، والكلمات الصعبة مشروحة' },
  selfcheck: { Icon: ClipboardCheck, short: 'اختبار ذاتي', purpose: 'هل تستطيع ما وعدك به الأسبوع؟' },
};

const FALLBACK: Omit<TaskKind, 'tone'> = { Icon: ListChecks, short: 'مهمة', purpose: 'مهمة من خطة اليوم' };

export function taskKind(blocks: BlockLike[]): TaskKind {
  const b = blocks[0];
  return { ...baseKind(b), tone: (b && TONE_OF[b.type]) || 'violet' };
}

function baseKind(b: BlockLike | undefined): Omit<TaskKind, 'tone'> {
  if (!b) return { Icon: Smartphone, short: 'خارج المنصة', purpose: 'تُنجز خارج المنصة، ثم تؤشّرها هنا' };

  switch (b.type) {
    case 'section':
      return SECTIONS[b.section?.kind ?? ''] ?? FALLBACK;
    case 'vocabulary':
      return { Icon: Languages, short: 'الكلمات', purpose: 'تعلّم الكلمات، ثم اختبر نفسك' };
    case 'dialogue':
      return { Icon: MessagesSquare, short: 'الحوار', purpose: 'محادثة حقيقية بصوتين — اسمعها واقرأها' };
    case 'minimal_pairs':
      return b.production
        ? { Icon: Mic, short: 'انطقها', purpose: 'قل الكلمة، والمتصفّح يكتب ما سمع' }
        : { Icon: Ear, short: 'الأصوات', purpose: 'اسمع الفرق قبل أن تنطقه' };
    case 'spelling':
      return b.review
        ? { Icon: PenLine, short: 'الإملاء', purpose: 'كلمات الأيام السابقة — اسمعها واكتبها' }
        : { Icon: PenLine, short: 'الإملاء', purpose: 'اكتب الكلمة حرفاً حرفاً' };
    case 'review':
      return { Icon: RotateCcw, short: 'المراجعة', purpose: 'كلمات حان وقت مراجعتها — اكتبها من الذاكرة' };
    case 'exercises':
      return { Icon: ListChecks, short: 'التمارين', purpose: 'طبّق ما تعلّمته اليوم' };
    case 'watch':
      return { Icon: Clapperboard, short: 'حلقة اليوم', purpose: 'حلقة قصيرة من مسلسل للمتعلّمين — شاهدها واكتب ما سمعت' };
    case 'imitate':
      return { Icon: Feather, short: 'اكتب مثله', purpose: 'اقرأ النموذج، ثم اكتب مثله عنك أنت' };
    case 'writing':
      return { Icon: NotebookPen, short: 'الكتابة', purpose: 'نصّ الأسبوع — بقوالب جاهزة ونموذج' };
    case 'homework':
      return { Icon: Compass, short: 'المغامرة', purpose: 'اختر مغامرة تنفّذها بعيداً عن الشاشة، ثم اكتب ما فعلت' };
    case 'record':
      return { Icon: Smartphone, short: 'التحدّث', purpose: 'تكلّم وسجّل على جوالك' };
    default:
      return FALLBACK;
  }
}
