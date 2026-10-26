import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import axios from 'axios';
import { Check, Copy, Pencil, Printer, ShieldCheck } from 'lucide-react';
import BrandMark from '@/Components/BrandMark';
import Bdi from '@/Components/Bdi';
import { useT } from '@/lib/i18n';

/**
 * A certificate — the page its QR opens, and the page it is printed from.
 *
 * One page for both: the owner sees the buttons (print, edit the name,
 * copy the link), anyone else sees the certificate and the line that
 * says it is genuine. Printing uses the browser (Save as PDF) on an A4
 * landscape sheet; nothing is generated on the server but the QR.
 *
 * It says what it is: a certificate of completion from the platform's
 * own level test, at a CEFR level — not an accredited exam. A paper
 * that claims more than it is would mislead whoever it is handed to.
 */

interface Cert {
  code: string;
  level: string;
  name: string;
  percent: number;
  issued_on: string;
  url: string;
  mine: boolean;
}

const LEVEL_AR: Record<string, string> = {
  A1: 'المستوى الأول — مبتدئ',
  A2: 'المستوى الثاني — أساسي',
  'A2+': 'المستوى الثاني المتقدّم',
  B1: 'المستوى الثالث — متوسّط',
};

/** The platform's signature, drawn once — a pen line, not a font */
function Signature() {
  return (
    <svg viewBox="0 0 220 70" className="h-14 w-44" aria-hidden>
      <path
        d="M8 48 C 20 20, 34 18, 38 40 S 52 62, 60 36 C 66 18, 74 22, 72 40 C 70 54, 84 52, 92 34
           C 98 22, 104 30, 102 42 C 100 52, 116 50, 124 30 C 128 20, 134 24, 132 38 C 130 50, 146 50, 156 36
           C 164 26, 172 30, 170 42 C 168 52, 186 46, 212 26"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M30 60 C 80 54, 140 56, 200 52" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

export default function CertificateShow({ certificate, qr }: { certificate: Cert; qr: string }) {
  const tr = useT();
  const [name, setName] = useState(certificate.name);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(certificate.name);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const date = new Date(certificate.issued_on + 'T00:00:00');
  const dateAr = date.toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
  const dateEn = date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

  const saveName = async () => {
    setError(false);
    try {
      const { data } = await axios.patch(`/certificates/${certificate.code}/name`, { name: draft });
      setName(data.name);
      setEditing(false);
    } catch {
      setError(true);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(certificate.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the link is printed on the page anyway */
    }
  };

  return (
    <div dir="rtl" className="cert-page min-h-screen bg-slate-100 px-3 py-6 sm:py-10">
      <Head title={`${tr('شهادة')} ${certificate.level} — ${name}`} />

      {/* Who is looking decides what is above the sheet */}
      <div className="no-print mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
          <ShieldCheck aria-hidden size={17} /> {tr('شهادة صحيحة صادرة عن منصة مَدارِج')}
        </p>
        {certificate.mine && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
              <Printer aria-hidden size={16} /> {tr('اطبع أو احفظ PDF')}
            </button>
            <button onClick={() => setEditing((v) => !v)} className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300">
              <Pencil aria-hidden size={15} /> {tr('الاسم على الشهادة')}
            </button>
            <button onClick={copy} className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300">
              {copied ? <Check aria-hidden size={15} className="text-emerald-600" /> : <Copy aria-hidden size={15} />}
              {copied ? tr('نُسخ') : tr('انسخ رابط التحقّق')}
            </button>
            <Link href="/certificates" className="rounded-xl px-3 py-2 text-sm text-slate-500 hover:text-slate-800">{tr('شهاداتي')}</Link>
          </div>
        )}
      </div>

      {certificate.mine && editing && (
        <div className="no-print mx-auto mb-4 max-w-4xl rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-900">{tr('اكتب اسمك كما تريده على الشهادة')}</p>
          <p className="mt-0.5 text-xs text-slate-500">{tr('الاسم الكامل، بالعربية أو بالإنجليزية.')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={120}
              dir="auto"
              className="min-w-0 flex-1 rounded-xl border-slate-300 text-base focus:border-violet-500 focus:ring-violet-500"
            />
            <button onClick={saveName} disabled={draft.trim().length < 2} className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {tr('احفظ')}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-rose-700">{tr('لم يُحفظ. حاول مرة أخرى.')}</p>}
        </div>
      )}

      {/* ============ The sheet ============ */}
      <article className="cert-sheet mx-auto max-w-4xl bg-white text-slate-900 shadow-xl">
        <div className="cert-frame relative m-3 p-6 sm:m-4 sm:p-10">
          {/* Heading: the mark, and what this is, in both languages */}
          <header className="flex flex-col items-center text-center">
            <span className="flex items-center gap-2 text-violet-700">
              <BrandMark size={34} />
              <span className="text-2xl font-bold text-slate-900">{tr('مَدارِج')}</span>
            </span>
            <p className="mt-1 text-xs uppercase tracking-[0.3em] text-slate-400" dir="ltr">Madarij English</p>

            <h1 className="mt-6 text-3xl font-bold text-slate-900 sm:text-4xl">{tr('شهادة إتمام مستوى')}</h1>
            <p className="mt-1 font-entry text-xl italic text-slate-500 sm:text-2xl" dir="ltr">Certificate of Level Completion</p>
          </header>

          {/* The statement */}
          <div className="mt-8 text-center">
            {/* A verbal noun, not a verb: «اجتياز» reads right for any learner, man or woman */}
            <p className="text-base text-slate-600">{tr('تشهد منصة مَدارِج باجتياز')}</p>
            <p className="cert-name mx-auto mt-3 max-w-2xl border-b-2 border-dotted border-slate-300 pb-2 text-3xl font-bold text-violet-800 sm:text-4xl">
              <Bdi>{name}</Bdi>
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-loose text-slate-700 sm:text-lg">
              {tr('اختبار نهاية')} <strong>{LEVEL_AR[certificate.level] ?? certificate.level}</strong>{' '}
              {tr('في دورة الإنجليزية من A1 إلى B1، بنسبة')} <strong dir="ltr">{certificate.percent}%</strong>.
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500" dir="ltr">
              has passed the end-of-level test for <strong>CEFR {certificate.level}</strong> in the Madarij A1–B1 English course, with a score of {certificate.percent}%.
            </p>

            {/* The level, as a seal */}
            <div className="mx-auto mt-6 grid h-24 w-24 place-items-center rounded-full border-4 border-double border-violet-300 bg-violet-50 text-violet-800">
              <span className="text-center leading-none">
                <span className="block text-3xl font-bold" dir="ltr">{certificate.level}</span>
                <span className="mt-1 block text-[0.65rem] font-semibold uppercase tracking-wider" dir="ltr">CEFR</span>
              </span>
            </div>
          </div>

          {/* Signature, date, verification */}
          <footer className="mt-8 grid items-end gap-6 sm:grid-cols-3">
            <div className="text-center sm:text-start">
              <p className="text-sm text-slate-500">{tr('تاريخ الإصدار')}</p>
              <p className="font-semibold text-slate-800">{dateAr}</p>
              <p className="text-xs text-slate-400"><span dir="ltr">{dateEn}</span></p>
            </div>

            <div className="flex flex-col items-center text-center">
              <span className="text-slate-800"><Signature /></span>
              <span className="mt-1 w-48 border-t border-slate-300 pt-1 text-sm font-semibold text-slate-800">{tr('إدارة منصة مَدارِج')}</span>
              <span className="text-xs text-slate-400" dir="ltr">Madarij Platform</span>
            </div>

            <div className="flex flex-col items-center gap-1 sm:items-end">
              <span className="cert-qr h-24 w-24" dangerouslySetInnerHTML={{ __html: qr }} />
              <span className="text-xs text-slate-500">{tr('رقم الشهادة')}</span>
              <span className="font-mono text-sm font-bold tracking-wider text-slate-800" dir="ltr">{certificate.code}</span>
            </div>
          </footer>

          <p className="mt-6 text-center text-[0.7rem] leading-relaxed text-slate-400">
            {tr('امسح الرمز أو افتح الرابط للتحقّق من صحّة الشهادة:')} <span dir="ltr">{certificate.url}</span>
            <br />
            {tr('شهادة إتمام صادرة عن المنصة بحسب اختبارها للمستوى، وليست شهادة امتحان دوليّ معتمد.')}
          </p>
        </div>
      </article>
    </div>
  );
}
