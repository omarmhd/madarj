import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * نطق الكلمات عبر Web Speech API.
 *
 * هذا الـ hook هو ما يجعل المنصة ممكنة بلا ملفات صوتية:
 * المتصفح ينطق أي كلمة إنجليزية فوراً، بصفر تكلفة خادم.
 *
 * ملاحظة مهمة: الأصوات تُحمّل بشكل غير متزامن في بعض المتصفحات،
 * لذلك نستمع لحدث voiceschanged بدل الاعتماد على أول استدعاء.
 */

export interface SpeechOptions {
  /** سرعة النطق — 0.7 للتدريب، 1.0 للطبيعي */
  rate?: number;
  /** تفضيل اللهجة: en-GB أو en-US */
  lang?: string;
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

  /** اختيار أفضل صوت إنجليزي متاح */
  const pickVoice = useCallback(
    (lang = 'en-GB') =>
      voices.find((v) => v.lang === lang) ??
      voices.find((v) => v.lang.replace('_', '-').startsWith('en')) ??
      null,
    [voices],
  );

  const speak = useCallback(
    (text: string, opts: SpeechOptions = {}) => {
      if (!supported) return;

      // إلغاء أي نطق جارٍ — يمنع تراكم الطوابير عند النقر السريع
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = opts.rate ?? 0.85;
      utterance.lang = opts.lang ?? 'en-GB';

      const voice = pickVoice(utterance.lang);
      if (voice) utterance.voice = voice;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [supported, pickVoice],
  );

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { speak, stop, speaking, supported, voices };
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
