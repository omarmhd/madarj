/**
 * تقسيم كتل المحتوى إلى خطوات — نظام واحد لكل الأسابيع الـ24.
 *
 * المشكلة التي يحلّها: حوار من 12 سطراً أو مجموعة من 20 كلمة تُعرض
 * كلها مرة واحدة تُرهق المبتدئ ولا تُرسّخ شيئاً. والحلّ ليس أرقاماً
 * مكتوبة يدوياً لكل أسبوع، بل قاعدة تُحسب من حجم المحتوى نفسه.
 *
 * الفكرة المحورية: كل «شريحة» هي كتلة صحيحة من نفس النوع تحمل
 * جزءاً من العناصر. لذلك دالة العرض نفسها تصلح للكتلة الكاملة
 * وللشريحة بلا أي تفريع — لا نكتب عرضاً ثانياً للـ wizard.
 *
 * وأهم ما يضمنه التقسيم: الأزواج الصوتية تُقسَّم **بالمجموعة**،
 * فيستحيل بنيوياً أن يخلط اختبار مجموعتين صوتيتين — وهي قاعدة
 * صريحة في `AGENTS.md` كانت تعتمد على انتباه المؤلّف وحده.
 */

/** أحجام الخطوة — مبنية على سعة الذاكرة العاملة لا على تقدير عشوائي */
const STEP_SIZES = {
  /** خمس كلمات في الخطوة: حدّ ما يستوعبه المبتدئ في دفعة واحدة */
  vocabulary: 5,
  /** أربعة أسطر = تبادلان كاملان، وهي أصغر وحدة محادثة ذات معنى */
  dialogue: 4,
} as const;

/**
 * توزيع العناصر على خطوات متوازنة.
 *
 * القسمة بحجم ثابت تُنتج خطوة أخيرة كسيحة: 13 سطراً بحجم 4 تعطي
 * 4+4+4+**1**، وخطوة بسطر واحد تبدو خطأً في الواجهة. ولا يمكن لحجم
 * واحد أن يتوازن، فنحسب عدد الخطوات أولاً ثم نوزّع الباقي على
 * الخطوات الأولى — فتصبح 4+3+3+3.
 *
 * 41 كلمة بحجم 5 تعطي 5×5 ثم 4×4 بدل ثماني خطوات وخطوة بكلمة واحدة.
 */
export function distribute<T>(items: T[], ideal: number): T[][] {
  const n = items.length;

  if (n === 0) return [[]];
  if (n <= ideal) return [items];

  const steps = Math.ceil(n / ideal);
  const base = Math.floor(n / steps);
  let extra = n % steps;

  const out: T[][] = [];
  let at = 0;

  for (let s = 0; s < steps; s++) {
    const size = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;

    out.push(items.slice(at, at + size));
    at += size;
  }

  return out;
}

/** الحد الأدنى الذي تحتاجه هذه الوحدة من الكتلة */
type Sliceable =
  | { type: 'vocabulary'; items: unknown[] }
  | { type: 'dialogue'; lines: unknown[] }
  | {
      type: 'minimal_pairs';
      /**
       * A list of named contrasts, not a map keyed by the English
       * heading. It changed when the group gained an Arabic name —
       * `Object.entries` on the new array yielded '0', '1', '2' as
       * labels and handed the game an object where it expected an
       * array, which is a white screen, not a wrong title.
       */
      groups: { label_ar?: string | null; label_en?: string; pairs: unknown[] }[];
    }
  | { type: string };

/**
 * تقسيم كتلة إلى شرائح قابلة للعرض بالترتيب.
 *
 * الأنواع التي تحمل واجهتها الخاصة — التمارين والتسجيل والكتابة
 * والمراجعة — تُرجع شريحة واحدة: هي wizard بنفسها أصلاً، وتقسيمها
 * مرة أخرى يضيف نقرات بلا فائدة.
 */
export function sliceBlock<T extends Sliceable>(block: T): T[] {
  switch (block.type) {
    case 'vocabulary': {
      const b = block as T & { items: unknown[] };

      return distribute(b.items, STEP_SIZES.vocabulary).map(
        (items) => ({ ...b, items }) as T,
      );
    }

    case 'dialogue': {
      const b = block as T & { lines: unknown[] };

      return distribute(b.lines, STEP_SIZES.dialogue).map(
        (lines) => ({ ...b, lines }) as T,
      );
    }

    case 'minimal_pairs': {
      // One contrast per step — this is what structurally prevents
      // mixing sound groups, which §2.4 forbids
      const b = block as T & { groups: unknown[] };

      if (b.groups.length <= 1) return [block];

      return b.groups.map((group) => ({ ...b, groups: [group] }) as T);
    }

    default:
      return [block];
  }
}

/** عنوان الخطوة — يقول للمتعلّم أين هو داخل القسم */
export function sliceTitle(block: Sliceable, index: number, count: number): string | null {
  if (count <= 1) return null;

  switch (block.type) {
    case 'vocabulary': {
      const n = (block as { items: unknown[] }).items.length;
      return `${n} كلمة · الدفعة ${index + 1} من ${count}`;
    }
    case 'dialogue': {
      const n = (block as { lines: unknown[] }).lines.length;
      return `${n} أسطر · المقطع ${index + 1} من ${count}`;
    }
    case 'minimal_pairs': {
      // The Arabic name, not the book's English heading: a beginner
      // on day one cannot read "short oo against long oo"
      const g = (block as {
        groups: { label_ar?: string | null; label_en?: string }[];
      }).groups[0];

      const name = g?.label_ar ?? g?.label_en ?? '';

      return `${name} · المجموعة ${index + 1} من ${count}`;
    }
    default:
      return `${index + 1} من ${count}`;
  }
}
