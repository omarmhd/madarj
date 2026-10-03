import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { saveRecording } from '@/lib/recordings';

/**
 * المسجّل الصوتي.
 *
 * قرار معماري: الملف الصوتي لا يُرفع للخادم.
 * يُخزَّن في IndexedDB عند المستخدم، والخادم يحفظ البيانات
 * الوصفية فقط (الأسبوع، المدة، المرجع المحلي).
 *
 * الأسباب: التكلفة، الخصوصية، وأن قيمة التسجيل في أن يسمعه هو.
 */

interface Props {
  weekNumber: number;
  /** تسجيل خط الأساس في اليوم السابع — دقيقتان */
  isBaseline?: boolean;
  targetSeconds?: number;
}

export default function Recorder({
  weekNumber,
  isBaseline = false,
  targetSeconds = 90,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        (window as any).__lastBlob = blob;   // للحفظ عند التأكيد
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      setAudioUrl(null);
      setSaved(false);

      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError('لم نتمكّن من الوصول للميكروفون. تأكّد من الإذن.');
    }
  };

  const stop = () => {
    mediaRef.current?.stop();
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRecording(false);
  };

  /** الحفظ: الملف محلياً، والبيانات الوصفية على الخادم */
  const save = async () => {
    const blob = (window as any).__lastBlob as Blob | undefined;
    if (!blob) return;

    // 1. الملف في IndexedDB
    const localRef = await saveRecording(weekNumber, blob);

    // 2. البيانات الوصفية على الخادم
    await axios.post('/recordings', {
      week_number: weekNumber,
      duration_seconds: seconds,
      local_ref: localRef,
    });

    setSaved(true);
  };

  const label = (n: number) =>
    `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;

  const progress = Math.min((seconds / targetSeconds) * 100, 100);

  return (
    <div className="rounded-xl border bg-white p-6">
      {isBaseline && (
        <div className="mb-5 rounded-lg border-r-4 border-amber-400 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            تسجيل خط الأساس — لا تحكم عليه
          </p>
          <p className="mt-1 text-sm text-amber-800">
            سيكون سيئاً، وهذا هو المقصود. هذا الملف هو الدليل الوحيد على
            نقطة البداية، وستقارنه بالأسبوع السادس والثاني عشر والرابع والعشرين.
            <strong> احفظه ولا تحذفه أبداً.</strong>
          </p>
        </div>
      )}

      <div className="text-center">
        {/* المؤقّت */}
        <div className="relative mx-auto mb-5 h-32 w-32">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none"
                    stroke="#e2e8f0" strokeWidth="6" />
            <circle cx="50" cy="50" r="45" fill="none"
                    stroke={recording ? '#f43f5e' : '#0d9488'} strokeWidth="6"
                    strokeDasharray={`${progress * 2.83} 283`}
                    strokeLinecap="round"
                    className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-bold text-slate-900">
              {label(seconds)}
            </span>
            <span className="text-xs text-slate-400">
              الهدف {label(targetSeconds)}
            </span>
          </div>
        </div>

        {error && (
          <p className="mb-4 text-sm text-rose-600">{error}</p>
        )}

        {/* الأزرار */}
        {!recording && !audioUrl && (
          <button onClick={start}
                  className="rounded-full bg-rose-600 px-8 py-3 font-medium
                             text-white hover:bg-rose-700">
            ● ابدأ التسجيل
          </button>
        )}

        {recording && (
          <button onClick={stop}
                  className="rounded-full bg-slate-900 px-8 py-3 font-medium
                             text-white hover:bg-slate-800">
            ■ إيقاف
          </button>
        )}

        {audioUrl && (
          <div className="space-y-4">
            <audio src={audioUrl} controls className="mx-auto w-full max-w-sm" />

            {saved ? (
              <p className="text-sm font-medium text-emerald-700">
                ✓ حُفظ — التسجيل في متصفحك، والخادم يعرف المدة فقط
              </p>
            ) : (
              <div className="flex justify-center gap-2">
                <button onClick={save}
                        className="rounded-lg bg-teal-600 px-6 py-2.5 font-medium
                                   text-white hover:bg-teal-700">
                  احفظ
                </button>
                <button onClick={start}
                        className="rounded-lg bg-slate-100 px-5 py-2.5 font-medium
                                   text-slate-700 hover:bg-slate-200">
                  أعد التسجيل
                </button>
              </div>
            )}
          </div>
        )}

        {seconds > 0 && seconds < targetSeconds * 0.6 && !recording && audioUrl && (
          <p className="mt-3 text-xs text-amber-700">
            أقصر من الهدف. حاول الوصول إلى {label(targetSeconds)} في المرة القادمة.
          </p>
        )}
      </div>
    </div>
  );
}
