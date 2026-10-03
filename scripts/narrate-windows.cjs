/*
 * سرد بمحرّك ويندوز المدمج — بلا تنزيل ولا مفتاح ولا ffmpeg.
 *
 * ── لماذا هذا الملفّ موجود ─────────────────────────────────
 * المولّد الأصلي يحتاج `ffmpeg` ومحرّكاً خارجيّاً، وكلاهما غير
 * موجود على هذا الجهاز. فبقيت البنية كلّها — الشارة، وإضاءة السطر،
 * والتوقيت — بلا شيء يُثبت أنّها تعمل. وشيءٌ لم يُرَ يعمل قط لا
 * يُقال عنه إنّه يعمل.
 *
 * ── وهو للإثبات لا للنشر ───────────────────────────────────
 * أصوات SAPI على ويندوز (David وZira) آليّة صريحة، وملفّ الـwav
 * غير مضغوط: دقيقة واحدة نحو ميغابايتين. فهذا يُرى ويُسمع اليوم،
 * ثم يُستبدل بصوت عصبيّ حين يتوفّر ffmpeg أو مفتاح خدمة.
 *
 * ── والدمج هنا بيدنا ───────────────────────────────────────
 * WAV صيغة بسيطة: ترويسة ثم كتل، والصوت في كتلة `data`. فدمج
 * ملفّات متطابقة الصيغة يعني جمع كتل الصوت وكتابة ترويسة جديدة.
 * ولذلك لا نحتاج ffmpeg هنا — والمدّة تُحسب من طول الكتلة وسرعة
 * البايتات، وهي دقيقة لا تقديريّة.
 *
 * الاستعمال:
 *   node scripts/narrate-windows.cjs --slug=tortoise-and-hare
 *   node scripts/narrate-windows.cjs --voice="Microsoft Zira Desktop"
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public/audio/stories');

const arg = (name, fallback = null) => {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const VOICE = arg('voice', 'Microsoft Zira Desktop');
const ONLY = arg('slug');
const RATE = Number(arg('rate', '-1')); // SAPI: -10..10، والأبطأ أوضح لمتعلّم

/* ── القصص ────────────────────────────────────────────────── */
const stories = [];

for (const file of fs.readdirSync(path.join(ROOT, 'content')).sort()) {
  if (!/^stories-\d+\.json$/.test(file)) continue;
  stories.push(...JSON.parse(fs.readFileSync(path.join(ROOT, 'content', file), 'utf8')).stories);
}

const chosen = ONLY ? stories.filter((s) => s.slug === ONLY) : stories;

if (!chosen.length) {
  console.error('لا قصص مطابقة.');
  process.exit(1);
}

/**
 * ينطق نصّاً إلى ملفّ wav عبر محرّك ويندوز.
 *
 * ── لماذا `-EncodedCommand` لا `-Command` ─────────────────
 * جمل القصص فيها اقتباسات: «"You are so slow," he said.» — وتمريرها
 * نصّاً في سطر أوامر يمرّ بطبقتَي اقتباس (الصَدَفة ثم PowerShell)،
 * فتُمزَّق الجملة ويفشل الأمر. والترميز يُلغي الطبقتين معاً: يُرسَل
 * النصّ بايتاتٍ لا كلاماً يُفسَّر.
 *
 * ويبقى اقتباس PowerShell نفسه، فالنصّ في سلسلة مفردة، والمفردة
 * وحدها هي ما يُضاعَف فيها.
 */
function say(text, file) {
  const ps = (value) => "'" + String(value).replace(/'/g, "''") + "'";

  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$s.SelectVoice(' + ps(VOICE) + ')',
    '$s.Rate = ' + RATE,
    '$s.SetOutputToWaveFile(' + ps(file) + ')',
    '$s.Speak(' + ps(text) + ')',
    '$s.Dispose()',
  ].join('; ');

  const encoded = Buffer.from(script, 'utf16le').toString('base64');

  execFileSync('powershell', ['-NoProfile', '-EncodedCommand', encoded], { stdio: 'ignore' });
}

/**
 * كتلة الصوت وصيغتها من ملفّ wav.
 *
 * تُقرأ الكتل بأسمائها لا بإزاحة ثابتة: بعض المحرّكات تكتب كتلة
 * `fact` قبل `data`، فترويسة ثابتة الطول تقرأ صوتاً في غير موضعه.
 */
function readWav(file) {
  const buf = fs.readFileSync(file);

  let at = 12; // بعد RIFF....WAVE
  let fmt = null;
  let data = null;

  while (at + 8 <= buf.length) {
    const id = buf.toString('ascii', at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    const body = buf.subarray(at + 8, at + 8 + size);

    if (id === 'fmt ') fmt = body;
    if (id === 'data') data = body;

    at += 8 + size + (size % 2); // الكتل تُحاذى على زوجيّ
  }

  if (!fmt || !data) throw new Error('ملفّ wav بلا fmt أو data: ' + file);

  return { fmt, data, byteRate: fmt.readUInt32LE(8) };
}

/** يكتب ملفّ wav واحداً من كتل صوت متتابعة */
function writeWav(file, fmt, chunks) {
  const data = Buffer.concat(chunks);
  const head = Buffer.alloc(12);

  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(4 + (8 + fmt.length) + (8 + data.length), 4);
  head.write('WAVE', 8, 'ascii');

  const fmtHead = Buffer.alloc(8);
  fmtHead.write('fmt ', 0, 'ascii');
  fmtHead.writeUInt32LE(fmt.length, 4);

  const dataHead = Buffer.alloc(8);
  dataHead.write('data', 0, 'ascii');
  dataHead.writeUInt32LE(data.length, 4);

  fs.writeFileSync(file, Buffer.concat([head, fmtHead, fmt, dataHead, data]));
}

/** `12.345` إلى `00:00:12.345` */
function stamp(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(3).padStart(6, '0');

  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + s;
}

fs.mkdirSync(OUT, { recursive: true });

console.log('الصوت: ' + VOICE + '   قصص: ' + chosen.length + '\n');

for (const story of chosen) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'narrate-'));

  process.stdout.write(story.slug.padEnd(30));

  try {
    const chunks = [];
    const cues = [];

    let fmt = null;
    let at = 0;

    for (const [i, line] of story.lines.entries()) {
      const part = path.join(tmp, i + '.wav');

      say(line, part);

      const wav = readWav(part);
      fmt ??= wav.fmt;

      const seconds = wav.data.length / wav.byteRate;

      cues.push({ from: at, to: at + seconds, text: line });
      chunks.push(wav.data);
      at += seconds;
    }

    writeWav(path.join(OUT, story.slug + '.wav'), fmt, chunks);

    /* التوقيت — من جمع المدد لا من محاذاة تُخمّن */
    const vtt = ['WEBVTT', ''];

    cues.forEach((c, i) => {
      vtt.push(String(i + 1));
      vtt.push(stamp(c.from) + ' --> ' + stamp(c.to));
      vtt.push(c.text);
      vtt.push('');
    });

    fs.writeFileSync(path.join(OUT, story.slug + '.vtt'), vtt.join('\n'));

    const size = fs.statSync(path.join(OUT, story.slug + '.wav')).size / 1024 / 1024;

    console.log('✓ ' + at.toFixed(1) + ' ثانية · ' + size.toFixed(1) + ' م.ب · ' +
      cues.length + ' مقطعاً');
  } catch (e) {
    console.log('✗ ' + e.message);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('\nثم: php artisan stories:import');
