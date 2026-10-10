import {
  AudioLines,
  BookOpen,
  BookOpenText,
  ClipboardCheck,
  Ear,
  Feather,
  Headphones,
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
export interface TaskKind {
  Icon: LucideIcon;
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

const SECTIONS: Record<string, TaskKind> = {
  phonics: { Icon: Ear, short: 'النطق', purpose: 'رموز النطق، وكيف يتحرّك الفم لكل صوت' },
  phrases: { Icon: MessageCircle, short: 'العبارات', purpose: 'عبارات تنقذك حين لا تفهم' },
  grammar: { Icon: BookOpen, short: 'القواعد', purpose: 'القاعدة، ومقارنتها بالعربية، والأخطاء الشائعة' },
  listening: { Icon: Headphones, short: 'الاستماع', purpose: 'استمع أربع مرات بطريقة الكتاب' },
  reading: { Icon: BookOpenText, short: 'القراءة', purpose: 'اقرأ نصاً قصيراً، والكلمات الصعبة مشروحة' },
  selfcheck: { Icon: ClipboardCheck, short: 'اختبار ذاتي', purpose: 'هل تستطيع ما وعدك به الأسبوع؟' },
};

const FALLBACK: TaskKind = { Icon: ListChecks, short: 'مهمة', purpose: 'مهمة من خطة اليوم' };

export function taskKind(blocks: BlockLike[]): TaskKind {
  const b = blocks[0];
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
    case 'shadow':
      return { Icon: AudioLines, short: 'ردّد معه', purpose: 'تكلّم مع الصوت وقلّده' };
    case 'imitate':
      return { Icon: Feather, short: 'اكتب مثله', purpose: 'اقرأ النموذج، ثم اكتب مثله عنك أنت' };
    case 'writing':
      return { Icon: NotebookPen, short: 'الكتابة', purpose: 'نصّ الأسبوع — بقوالب جاهزة ونموذج' };
    case 'homework':
      return { Icon: House, short: 'الواجب', purpose: 'مهمة في البيت بعيداً عن الشاشة، ثم اكتب ما فعلته' };
    case 'record':
      return { Icon: Smartphone, short: 'التحدّث', purpose: 'تكلّم وسجّل على جوالك' };
    default:
      return FALLBACK;
  }
}
