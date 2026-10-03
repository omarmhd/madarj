import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { strip } from '@/lib/bidi';
import { usePage } from '@inertiajs/react';

/**
 * نطق الكلمات عبر Web Speech API.
 *
 * هذا الـ hook هو ما يجعل المنصة ممكنة بلا ملفات صوتية:
 * المتصفح ينطق أي كلمة إنجليزية فوراً، بصفر تكلفة خادم.
 *
 * ملاحظة مهمة: الأصوات تُحمّل بشكل غير متزامن في بعض المتصفحات،
 * لذلك نستمع لحدث voiceschanged بدل الاعتماد على أول استدعاء.
 */

/**
 * جنس المتحدث — يأتي من speaker_genders في المحتوى.
 *
 * و'c' تفضيل المستخدم «طفل»: لا يعرف Web Speech الأعمار، فننفّذه
 * بالصوت الأنثوي مع سرعة أعلى قليلاً — أقرب ما يمكن بلا وعد كاذب.
 */
export type Gender = 'f' | 'm';
export type VoicePref = 'f' | 'm' | 'c';

/** تحويل تفضيل المستخدم إلى جنس صوت فعلي */
export function prefToGender(v: VoicePref | undefined): Gender {
  return v === 'm' ? 'm' : 'f';
}

/** معامل السرعة لتفضيل «طفل» */
export function prefRateFactor(v: VoicePref | undefined): number {
  return v === 'c' ? 1.1 : 1;
}

export interface SpeechOptions {
  /** سرعة النطق — 0.7 للتدريب، 1.0 للطبيعي */
  rate?: number;
  /** تفضيل اللهجة: en-GB أو en-US */
  lang?: string;
  /** صوت أنثوي أو ذكوري — لحوارات فيها متحدثان */
  gender?: Gender;
}

/** سطر في تشغيل متتابع */
export interface SpeechLine {
  text: string;
  gender?: Gender;
}

export interface SequenceOptions {
  rate?: number;
  lang?: string;
  /** صمت بين السطرين — يحاكي تنفّس المحادثة */
  gapMs?: number;
  /** يُنادى قبل كل سطر — لإبراز السطر الجاري في الواجهة */
  onLine?: (index: number) => void;
  onDone?: () => void;
}

/**
 * أسماء أصوات معروفة لكل جنس.
 *
 * Web Speech API لا يعرض جنس الصوت إطلاقاً — لا خاصية gender ولا ما يشبهها.
 * الاسم هو الدليل الوحيد المتاح، فنطابقه على أصوات المنصات الثلاث.
 */
const FEMALE_VOICES = [
  // Windows
  'hazel', 'susan', 'zira', 'eva', 'linda', 'heera', 'catherine',
  'sonia', 'libby', 'maisie', 'aria', 'ana', 'jenny', 'michelle',
  'emily', 'clara', 'natasha', 'molly',
  // macOS و iOS
  'samantha', 'karen', 'moira', 'tessa', 'fiona', 'victoria',
  'allison', 'ava', 'zoe', 'serena', 'kate', 'nicky', 'joelle',
];

const MALE_VOICES = [
  // Windows
  'david', 'mark', 'george', 'ryan', 'guy', 'christopher', 'eric',
  'brandon', 'liam', 'steffan', 'tony', 'roger', 'andrew', 'brian',
  'jason', 'james',
  // macOS و iOS
  'daniel', 'alex', 'fred', 'tom', 'aaron', 'oliver', 'rishi',
  'gordon', 'lee', 'bruce', 'ralph', 'junior', 'arthur',
];

/** استدلال جنس الصوت من اسمه — أو null إن تعذّر */
/**
 * جودة الصوت بحسب اسمه — أعلى رقم أفضل.
 *
 * ── لماذا بالاسم ───────────────────────────────────────────
 * `SpeechSynthesisVoice` لا يحمل أيّ وصف للجودة: اسم ولغة وعلَم
 * `localService` وكفى. والاسم هو كل ما يفرّق عمليّاً بين صوت عصبيّ
 * وآخر من التسعينيّات، لأن المنصّات تسمّ العصبيّ صراحةً.
 *
 * ── والعلامات ليست تخميناً ─────────────────────────────────
 * «Natural» و«Online» علامتا مايكروسوفت للأصوات العصبيّة،
 * و«Google» أصوات كروم السحابيّة، و«Siri» و«Premium» و«Enhanced»
 * أصوات آبل الموسّعة. و«Compact» علامة آبل للنسخة المضغوطة،
 * و«eSpeak» المحرّك الآليّ القديم على لينكس وأندرويد.
 */
const BETTER = ['natural', 'neural', 'online', 'google', 'siri', 'premium', 'enhanced'];
const WORSE = ['compact', 'espeak', 'pico', 'sapi'];

/**
 * الاختيار نفسه — خارج الخطّاف عمداً.
 *
 * كان داخل `useCallback`، فلم يكن يُستدعى إلا من متصفّح. وفحصٌ لا
 * يستطيع مناداة ما يفحص يضطرّ إلى إعادة كتابة الترتيب بيده — وقد
 * فعلتُ، فأعدتُ العطب الأصليّ ومرّ الفحص. دالّة نقيّة تُنادى كما هي.
 */
export function chooseVoice(
  voices: SpeechSynthesisVoice[],
  lang = 'en-GB',
  gender?: Gender,
): SpeechSynthesisVoice | null {
  const sameLang = voices.filter((v) => v.lang.replace('_', '-') === lang);

  const best = (list: SpeechSynthesisVoice[]) =>
    [...list].sort((a, b) => voiceRank(b) - voiceRank(a))[0] ?? null;

  if (gender) {
    const exact = best(sameLang.filter((v) => voiceGender(v) === gender));
    if (exact) return exact;

    const anyLang = best(voices.filter((v) => voiceGender(v) === gender));
    if (anyLang) return anyLang;
  }

  return best(sameLang) ?? best(voices);
}

export function voiceRank(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();

  let score = 0;

  if (BETTER.some((n) => name.includes(n))) score += 10;
  if (WORSE.some((n) => name.includes(n))) score -= 10;

  // الصوت السحابيّ أنعم، والمحليّ يعمل بلا شبكة — فتفضيلٌ خفيف
  // للسحابيّ لا يقلب ترتيباً
  if (!voice.localService) score += 1;

  return score;
}

function voiceGender(voice: SpeechSynthesisVoice): Gender | null {
  const name = voice.name.toLowerCase();

  // الترتيب مقصود: كلمة "female" تحتوي "male"،
  // فلو فحصنا الذكوري أولاً لصنّفنا كل صوت أنثوي ذكورياً.
  if (name.includes('female') || name.includes('woman')) return 'f';
  if (name.includes('male') || name.includes('man')) return 'm';

  if (FEMALE_VOICES.some((n) => name.includes(n))) return 'f';
  if (MALE_VOICES.some((n) => name.includes(n))) return 'm';

  return null;
}

export function useSpeech() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false);
      return;
    }

    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.speechSynthesis.cancel();
    };
  }, []);

  /** الأصوات الإنجليزية فقط — لا فائدة من صوت عربي هنا */
  const englishVoices = useMemo(
    () => voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('en')),
    [voices],
  );

  /**
   * هل يملك المتصفح صوتاً أنثوياً وذكورياً معاً؟
   * الواجهة تحتاج معرفة ذلك لتخفي وعداً لا تستطيع الوفاء به.
   */
  const hasGenderedVoices = useMemo(() => {
    const found = new Set(englishVoices.map(voiceGender).filter(Boolean));
    return found.has('f') && found.has('m');
  }, [englishVoices]);

  /**
   * اختيار أفضل صوت متاح.
   * الأفضلية: اللهجة والجنس معاً ← الجنس وحده ← اللهجة وحدها ← أي إنجليزي.
   *
   * ── ولماذا لا يُؤخذ أوّل المطابقين ────────────────────────
   * كان هذا التعليق يَعِد بـ«أفضل صوت» والشفرة تأخذ `sameLang[0]` —
   * أي أوّل ما يذكره المتصفّح. وترتيب المتصفّح ليس ترتيب جودة: على
   * ويندوز تتقدّم أصوات SAPI القديمة (David وZira) على الأصوات
   * العصبيّة (Natural/Online)، وعلى أندرويد يتقدّم المضغوط منها.
   * فكان المتدرّب يسمع أسوأ ما في جهازه بينما الأفضل حاضر.
   */
  const pickVoice = useCallback(
    (lang = 'en-GB', gender?: Gender) => chooseVoice(englishVoices, lang, gender),
    [englishVoices],
  );

  /**
   * رمز السلسلة الجارية.
   *
   * ضروري لأن cancel() يُطلق onend على الكلام المُلغى،
   * فبدون رمز يتقدّم الطابور القديم ويتشابك مع الجديد.
   */
  const seqRef = useRef(0);

  const speak = useCallback(
    (text: string, opts: SpeechOptions = {}) => {
      if (!supported) return;

      // إبطال أي سلسلة جارية ثم إلغاء الكلام — يمنع تراكم الطوابير
      seqRef.current++;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(strip(text));
      utterance.rate = opts.rate ?? 0.85;
      utterance.lang = opts.lang ?? 'en-GB';

      const voice = pickVoice(utterance.lang, opts.gender);
      if (voice) utterance.voice = voice;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [supported, pickVoice],
  );

  /**
   * تشغيل عدة أسطر بالتتابع — كل سطر بصوت متحدّثه.
   *
   * السبب في وجودها: التتابع بـ setTimeout بفاصل ثابت يقطع الأسطر
   * الطويلة، لأن speak() يبدأ بـ cancel(). هنا ننتظر onend الحقيقي
   * فلا يُقطع سطر أبداً مهما طال.
   *
   * ترجع دالة إيقاف.
   */
  const speakSequence = useCallback(
    (lines: SpeechLine[], opts: SequenceOptions = {}) => {
      if (!supported || lines.length === 0) return () => {};

      const { rate = 0.85, lang = 'en-GB', gapMs = 400, onLine, onDone } = opts;

      const token = ++seqRef.current;
      window.speechSynthesis.cancel();
      setSpeaking(true);

      let index = 0;

      const next = () => {
        // أُلغيت هذه السلسلة أو بدأت أخرى — نتوقف بصمت
        if (token !== seqRef.current) return;

        if (index >= lines.length) {
          setSpeaking(false);
          onDone?.();
          return;
        }

        const line = lines[index];
        onLine?.(index);

        const utterance = new SpeechSynthesisUtterance(strip(line.text));
        utterance.rate = rate;
        utterance.lang = lang;

        const voice = pickVoice(lang, line.gender);
        if (voice) utterance.voice = voice;

        const advance = () => {
          index++;
          window.setTimeout(next, gapMs);
        };

        utterance.onend = advance;
        utterance.onerror = advance;

        window.speechSynthesis.speak(utterance);
      };

      next();

      return () => {
        seqRef.current++;
        window.speechSynthesis.cancel();
        setSpeaking(false);
      };
    },
    [supported, pickVoice],
  );

  const stop = useCallback(() => {
    seqRef.current++;
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return {
    speak,
    speakSequence,
    stop,
    speaking,
    supported,
    voices,
    hasGenderedVoices,
  };
}

/**
 * فحص النطق عبر SpeechRecognition.
 *
 * الفكرة: المستخدم يقول الكلمة، والمتصفح يكتب ما سمعه.
 * لو قال "three" وكتب المتصفح "tree" فقد نطقها خطأً.
 *
 * تصحيح نطق آلي بصفر بنية تحتية.
 *
 * ملاحظة: مدعوم في Chrome و Edge و Safari. غير مدعوم في Firefox،
 * لذلك نتحقق من supported ونخفي الميزة بدل أن تفشل صامتة.
 */
export function useRecognition() {
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ??
      (window as any).webkitSpeechRecognition;

    if (!SR) {
      setSupported(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = 'en-GB';
    recognition.interimResults = false;
    // عدة احتمالات — المطابقة الحرفية على احتمال واحد قاسية جداً
    recognition.maxAlternatives = 3;
    recognitionRef.current = recognition;
  }, []);

  /** يستمع لكلمة واحدة ويرجع كل ما احتمله المتصفح */
  const listen = useCallback((): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const recognition = recognitionRef.current;
      if (!recognition) return reject(new Error('غير مدعوم في هذا المتصفح'));

      setListening(true);

      recognition.onresult = (e: any) => {
        const alternatives: string[] = [];
        for (let i = 0; i < e.results[0].length; i++) {
          alternatives.push(e.results[0][i].transcript.trim().toLowerCase());
        }
        setListening(false);
        resolve(alternatives);
      };

      recognition.onerror = (e: any) => {
        setListening(false);
        reject(new Error(e.error));
      };

      recognition.onend = () => setListening(false);

      recognition.start();
    });
  }, []);

  return { listen, listening, supported };
}

/**
 * النطق بتفضيلات المتدرّب.
 *
 * `useSpeech` خام: يأخذ سرعة وصوتاً صريحين. وهذا سبب أن خمسة مواضع
 * في المنصة كانت تكتب `rate: 0.65` يدوياً فتتجاهل ما اختاره المتدرّب
 * في التهيئة. هذا الخطّاف يحلّ التفضيلات مرة واحدة، فينطق كل شيء
 * بالصوت والسرعة اللذين اختارهما — إلا أن يُطلب غير ذلك صراحةً.
 */
export function useMySpeech() {
  const { speak, speakSequence, stop, speaking, supported, voices, hasGenderedVoices } = useSpeech();
  const { props } = usePage();

  const prefs = ((props as any).prefs ?? {}) as { voice?: VoicePref; rate?: number };
  const pref = (prefs.voice ?? 'f') as VoicePref;

  const myRate = (prefs.rate ?? 0.8) * prefRateFactor(pref);
  const myGender = prefToGender(pref);

  /** ينطق بتفضيلات المتدرّب؛ و`slow` أبطأ **منها** لا سرعة ثابتة */
  const say = useCallback(
    (text: string, opts: { slow?: boolean; gender?: Gender; rate?: number } = {}) => {
      const base = opts.rate ?? myRate;
      speak(text, {
        rate: opts.slow ? Math.max(0.4, base * 0.7) : base,
        gender: opts.gender ?? myGender,
      });
    },
    [speak, myRate, myGender],
  );

  return { say, speak, speakSequence, stop, speaking, supported, voices, hasGenderedVoices, myRate, myGender };
}
