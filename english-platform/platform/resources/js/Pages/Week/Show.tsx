import { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import DayCard, { type DayState } from '@/Components/DayCard';
import MinimalPairGame from '@/Components/Game/MinimalPairGame';
import Flashcards, { type Word } from '@/Components/Game/Flashcards';
import ExerciseRunner, { type ExerciseData } from '@/Components/Game/ExerciseRunner';
import Recorder from '@/Components/Recorder';
import { useSpeech } from '@/hooks/useSpeech';

/**
 * صفحة الأسبوع — الشاشة الرئيسية.
 *
 * البنية تتبع الكتاب حرفياً:
 *   §1 الأهداف
 *   §  خطة الأيام السبعة  ← أول ما يراه، كما في الكتاب
 *   §2 المفردات
 *   §4 النطق (اللعبة)
 *   §5-6 الحوارات
 *   التمارين
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
  lines: { speaker: string; en: string; ar: string }[];
}

interface Props {
  week: WeekMeta;
  days: DayState[];
  vocabulary: Record<string, Word[]>;
  minimalPairs: Record<string, { id: number; ipa: string | null; word_a: string; word_b: string }[]>;
  dialogues: Dialogue[];
  exercises: Record<string, ExerciseData[]>;
  stats: { track: 'A' | 'B'; current_week: number; current_day: number; streak: number };
}

type Activity =
  | { kind: 'none' }
  | { kind: 'pairs' }
  | { kind: 'flashcards'; group: string }
  | { kind: 'exercises'; day: string }
  | { kind: 'record'; baseline: boolean };

export default function WeekShow({
  week, days, vocabulary, minimalPairs, dialogues, exercises, stats,
}: Props) {
  const [dayStates, setDayStates] = useState(days);
  const [activity, setActivity] = useState<Activity>({ kind: 'none' });
  const [openDialogue, setOpenDialogue] = useState<number | null>(null);
  const [hideEnglish, setHideEnglish] = useState(false);
  const { speak } = useSpeech();

  /** فتح النشاط المناسب حسب مرجع المهمة في خطة اليوم */
  const openActivity = (ref: string) => {
    if (ref.startsWith('game:minimal_pairs')) return setActivity({ kind: 'pairs' });
    if (ref.startsWith('pron:')) return setActivity({ kind: 'pairs' });
    if (ref.startsWith('record')) {
      return setActivity({ kind: 'record', baseline: ref.includes('baseline') });
    }
    if (ref.startsWith('vocab:')) {
      const group = ref.split(':')[1].split(',')[0];
      return setActivity({ kind: 'flashcards', group });
    }
    if (ref.startsWith('exercises:')) {
      return setActivity({ kind: 'exercises', day: ref.split(':')[1] });
    }
    if (ref.startsWith('dialogue:')) {
      return setOpenDialogue(Number(ref.split(':')[1]));
    }
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

  const groupLabels: Record<string, string> = {
    family: 'العائلة',
    numbers: 'الأرقام',
    days_months: 'الأيام والشهور',
    core: 'كلمات أساسية',
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50">
      <Head title={`الأسبوع ${week.number}`} />

      {/* ============ الرأس ============ */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-4xl px-4 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Link href="/dashboard" className="hover:text-teal-600">
                  لوحة التقدّم
                </Link>
                <span>·</span>
                <span>الوحدة {week.module}</span>
              </div>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                الأسبوع {week.number}
              </h1>
              <p className="text-sm text-slate-600" dir="ltr">
                {week.title_en}
              </p>
            </div>

            <div className="flex items-center gap-4 text-center">
              <div>
                <p className="text-xl font-bold text-orange-500">{stats.streak}</p>
                <p className="text-xs text-slate-500">سلسلة</p>
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-1.5">
                <p className="text-xs font-medium text-slate-700">
                  مسار {stats.track}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        {/* ============ النشاط المفتوح ============ */}
        {activity.kind !== 'none' && (
          <section className="rounded-xl bg-white p-1 shadow-lg ring-1 ring-slate-200">
            <div className="flex items-center justify-between px-4 py-2">
              <h2 className="text-sm font-semibold text-slate-700">
                {activity.kind === 'pairs' && 'لعبة التمييز الصوتي'}
                {activity.kind === 'flashcards' && `بطاقات — ${groupLabels[activity.group] ?? activity.group}`}
                {activity.kind === 'exercises' && 'تمارين'}
                {activity.kind === 'record' && (activity.baseline ? 'تسجيل خط الأساس' : 'تسجيل')}
              </h2>
              <button
                onClick={() => setActivity({ kind: 'none' })}
                className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-100"
              >
                إغلاق ✕
              </button>
            </div>

            <div className="p-3">
              {activity.kind === 'pairs' && (
                <MinimalPairGame groups={minimalPairs} target={11} />
              )}

              {activity.kind === 'flashcards' && (
                <Flashcards
                  words={vocabulary[activity.group] ?? []}
                  groupLabel={groupLabels[activity.group] ?? activity.group}
                />
              )}

              {activity.kind === 'exercises' && (
                <ExerciseRunner exercises={exercises[activity.day] ?? []} />
              )}

              {activity.kind === 'record' && (
                <Recorder
                  weekNumber={week.number}
                  isBaseline={activity.baseline}
                  targetSeconds={activity.baseline ? 120 : 90}
                />
              )}
            </div>
          </section>
        )}

        {/* ============ خطة الأيام السبعة ============ */}
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              خطة الأيام السبعة
            </h2>
            <p className="text-xs text-slate-500">
              ابدأ من هنا كل صباح
            </p>
          </div>

          <div className="mb-4 rounded-lg border-r-4 border-teal-500 bg-teal-50 p-4">
            <p className="text-sm text-teal-900">
              <strong>لا تقرأ الأسبوع من أوله لآخره.</strong> افتح صندوق اليوم،
              أنجز مهامه الخمس، ثم أغلق الصفحة. اليوم التالي يُفتح تلقائياً.
            </p>
          </div>

          <div className="space-y-3">
            {dayStates.map((day) => (
              <DayCard
                key={day.number}
                weekNumber={week.number}
                day={day}
                track={stats.track}
                isCurrent={
                  stats.current_week === week.number &&
                  stats.current_day === day.number
                }
                onDayCompleted={handleDayCompleted}
                onOpenActivity={openActivity}
              />
            ))}
          </div>
        </section>

        {/* ============ الأهداف ============ */}
        <section className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            ما ستستطيع فعله
          </h2>
          <ul className="space-y-2.5">
            {week.objectives.map((o, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center
                                 justify-center rounded-full bg-slate-100
                                 text-xs text-slate-600">
                  {i + 1}
                </span>
                <div>
                  <p className="text-slate-800">{o.ar}</p>
                  <p className="text-xs text-slate-500" dir="ltr">{o.en}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ============ المفردات ============ */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            المفردات — 100 كلمة
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(vocabulary).map(([group, words]) => (
              <div key={group} className="rounded-xl border bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">
                    {groupLabels[group] ?? group}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {words.length} كلمة
                  </span>
                </div>

                {/* عيّنة من أول ثلاث كلمات */}
                <div className="mb-4 space-y-1.5">
                  {words.slice(0, 3).map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-600">{w.arabic}</span>
                      <button
                        onClick={() => speak(w.word, { rate: 0.8 })}
                        className="flex items-center gap-1.5 font-medium text-teal-700
                                   hover:text-teal-900"
                        dir="ltr"
                      >
                        <span>{w.word}</span>
                        <span className="text-xs">🔊</span>
                      </button>
                    </div>
                  ))}
                  <p className="pt-1 text-xs text-slate-400">
                    و{words.length - 3} كلمة أخرى…
                  </p>
                </div>

                <button
                  onClick={() => setActivity({ kind: 'flashcards', group })}
                  className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium
                             text-white hover:bg-teal-700"
                >
                  ابدأ البطاقات
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ============ النطق ============ */}
        <section className="rounded-xl border bg-white p-6">
          <h2 className="mb-2 text-lg font-bold text-slate-900">
            النطق — التمييز الصوتي
          </h2>
          <p className="mb-4 text-sm text-slate-600">
            <strong>الاستماع أولاً.</strong> لا يمكنك إنتاج صوت لا تسمعه.
            المتصفح ينطق إحدى الكلمتين وأنت تختار ما سمعته — الهدف 11 من 12.
          </p>

          <div className="mb-4 space-y-3">
            {Object.entries(minimalPairs).map(([label, pairs]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">{label}</p>
                  <p className="font-mono text-sm text-teal-700" dir="ltr">
                    {pairs[0]?.ipa}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2" dir="ltr">
                  {pairs.map((p) => (
                    <div key={p.id} className="flex gap-1">
                      {[p.word_a, p.word_b].map((w) => (
                        <button
                          key={w}
                          onClick={() => speak(w, { rate: 0.75 })}
                          className="rounded-md bg-white px-2.5 py-1 text-xs
                                     font-medium shadow-sm ring-1 ring-slate-200
                                     hover:bg-teal-50"
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
            onClick={() => setActivity({ kind: 'pairs' })}
            className="w-full rounded-lg bg-slate-900 py-3 font-medium text-white
                       hover:bg-slate-800"
          >
            ابدأ اللعبة
          </button>
        </section>

        {/* ============ الحوارات ============ */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">الحوارات</h2>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={hideEnglish}
                onChange={(e) => setHideEnglish(e.target.checked)}
                className="rounded border-slate-300"
              />
              أخفِ الإنجليزية — أنتِج من العربية
            </label>
          </div>

          <div className="space-y-3">
            {dialogues.map((d) => (
              <div key={d.number} className="overflow-hidden rounded-xl border bg-white">
                <button
                  onClick={() =>
                    setOpenDialogue(openDialogue === d.number ? null : d.number)
                  }
                  className="flex w-full items-center justify-between p-5 text-right"
                >
                  <div>
                    <p className="font-semibold text-slate-900" dir="ltr">
                      {d.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {d.situation_ar}
                    </p>
                  </div>
                  <span className="text-slate-400">
                    {openDialogue === d.number ? '▴' : '▾'}
                  </span>
                </button>

                {openDialogue === d.number && (
                  <div className="divide-y divide-slate-100 border-t">
                    {d.lines.map((line, i) => (
                      <div key={i} className="flex gap-3 px-5 py-3 hover:bg-slate-50">
                        <span className="w-14 shrink-0 text-xs font-bold text-teal-700">
                          {line.speaker}
                        </span>

                        <div className="min-w-0 flex-1">
                          {!hideEnglish && (
                            <p className="text-sm text-slate-900" dir="ltr">
                              {line.en}
                            </p>
                          )}
                          <p className="mt-0.5 text-sm text-slate-500">{line.ar}</p>
                        </div>

                        <button
                          onClick={() => speak(line.en, { rate: 0.8 })}
                          className="shrink-0 self-start rounded-md px-2 py-1
                                     text-slate-400 hover:bg-slate-100 hover:text-teal-600"
                          aria-label="استمع"
                        >
                          🔊
                        </button>
                      </div>
                    ))}

                    <div className="bg-slate-50 p-4">
                      <button
                        onClick={() => {
                          // تشغيل الحوار كاملاً بتتابع
                          d.lines.forEach((l, i) => {
                            setTimeout(() => speak(l.en, { rate: 0.85 }), i * 2600);
                          });
                        }}
                        className="w-full rounded-lg bg-teal-600 py-2 text-sm
                                   font-medium text-white hover:bg-teal-700"
                      >
                        🔊 شغّل الحوار كاملاً
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
