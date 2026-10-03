/**
 * الأخطاء العشرون التي يقع فيها المتحدث بالعربية.
 *
 * هذه ليست محتوى أسبوع، بل عمود المنهج كله: `AGENTS.md` ينصّ على أن
 * كل تمرين يجب أن يخدم واحداً منها. لذلك هي ثابت مشترك لا ملف JSON
 * أسبوعي — لا تتغيّر بين الأسابيع الـ24.
 *
 * قيمتها في الواجهة: التمرين وحده يقول «خطأ». لكن أن يرى المتعلّم
 * الخطأ الذي كان يقع فيه مكتوباً بجانب صوابه هو ما يجعله يتذكّره.
 */

export interface CommonError {
  no: number;
  wrong: string;
  right: string;
  /** ما القاعدة التي يخالفها — بالعربية */
  rule_ar: string;
}

export const COMMON_ERRORS: CommonError[] = [
  { no: 1, wrong: 'I engineer.', right: 'I am an engineer.', rule_ar: 'الجملة الإنجليزية تحتاج فعلاً دائماً، والمهنة تحتاج a/an' },
  { no: 2, wrong: 'I have 30 years.', right: 'I am 30 years old.', rule_ar: 'العمر بـ be لا have' },
  { no: 3, wrong: 'He work here.', right: 'He works here.', rule_ar: 'he/she/it تأخذ s في المضارع البسيط' },
  { no: 4, wrong: "He doesn't likes fish.", right: "He doesn't like fish.", rule_ar: 'بعد doesn’t يأتي الفعل مجرّداً' },
  { no: 5, wrong: 'Where you work?', right: 'Where do you work?', rule_ar: 'السؤال يحتاج do/does' },
  { no: 6, wrong: 'I wake up always early.', right: 'I always wake up early.', rule_ar: 'ظرف التكرار قبل الفعل الرئيسي' },
  { no: 7, wrong: 'Have a park near my house.', right: 'There is a park near my house.', rule_ar: 'الوجود بـ there is/are لا have' },
  { no: 8, wrong: 'He can to swim.', right: 'He can swim.', rule_ar: 'بعد الأفعال الناقصة لا to' },
  { no: 9, wrong: 'I am good at play.', right: 'I am good at playing.', rule_ar: 'بعد حرف الجر يأتي ing' },
  { no: 10, wrong: 'She sings good.', right: 'She sings well.', rule_ar: 'الفعل يوصف بظرف لا بصفة' },
  { no: 11, wrong: 'They was happy.', right: 'They were happy.', rule_ar: 'they/we/you تأخذ were' },
  { no: 12, wrong: "I didn't went.", right: "I didn't go.", rule_ar: 'بعد didn’t يأتي الفعل مجرّداً' },
  { no: 13, wrong: 'He buyed a car.', right: 'He bought a car.', rule_ar: 'الأفعال الشاذة لا تأخذ ed' },
  { no: 14, wrong: 'I am knowing the answer.', right: 'I know the answer.', rule_ar: 'أفعال الحالة لا تُستخدم في المستمر' },
  { no: 15, wrong: 'bigger from', right: 'bigger than', rule_ar: 'المقارنة بـ than لا from' },
  { no: 16, wrong: 'I live here since 2020.', right: 'I have lived here since 2020.', rule_ar: 'مع since يأتي المضارع التام' },
  { no: 17, wrong: 'I have seen him 2 years ago.', right: 'I saw him two years ago.', rule_ar: 'مع ago يأتي الماضي البسيط' },
  { no: 18, wrong: 'If it will rain, I stay home.', right: "If it rains, I'll stay home.", rule_ar: 'بعد if الشرطية لا will' },
  { no: 19, wrong: 'The man who he called me…', right: 'The man who called me…', rule_ar: 'who تنوب عن الفاعل فلا يتكرّر' },
  { no: 20, wrong: 'He said me the truth.', right: 'He told me the truth.', rule_ar: 'tell يأخذ مفعولاً، say لا تأخذه مباشرة' },
];

/** خطأ برقمه — أو null إن كان الرقم خارج النطاق */
export function commonError(no: number | null | undefined): CommonError | null {
  if (!no) return null;

  return COMMON_ERRORS.find((e) => e.no === no) ?? null;
}
