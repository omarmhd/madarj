/*
 * توليد سرد القصص: ملفّ صوت واحد لكل قصّة، ومعه توقيت جمله.
 *
 * ── لماذا يُولَّد جملةً جملة ثم يُدمَج ──────────────────────
 * القصّة ملفّ واحد، لكنّ الشاشة تحتاج بداية كل جملة بالثانية. وأن
 * تُستخرَج التوقيتات من ملفّ جاهز يحتاج محاذاة قسريّة — أداةً أخرى
 * تُخطئ صامتةً وتزيغ ثانيةً هنا وثانيةً هناك.
 *
 * فالطريق الأقصر: نولّد كل جملة وحدها، فنعرف مدّتها **يقيناً**، ثم
 * ندمجها في ملفّ واحد. التوقيت يخرج من الجمع لا من التخمين، وهو
 * مضبوط إلى الملّي ثانية.
 *
 * ── والمحرّك مُبدَّل ───────────────────────────────────────
 * `--engine=piper` مجّانيّ يعمل بلا إنترنت، و`--engine=azure` أقرب
 * إلى البشريّ بكلفةٍ زهيدة. والباقي — الدمج والتوقيت والتحقّق —
 * واحد في الحالين.
 *
 * ── يحتاج ffmpeg ──────────────────────────────────────────
 * للدمج وقياس المدّة. وهو الأداة القياسيّة لهذا، ولا بديل عنها
 * يستحقّ كتابته.
 *
 * الاستعمال:
 *   node scripts/narrate-stories.cjs --engine=piper --voice=<path.onnx>
 *   node scripts/narrate-stories.cjs --engine=azure --voice=en-GB-SoniaNeural
 *   ... --slug=tortoise-and-hare      قصّة واحدة
 *   ... --dry                          يحسب ولا يولّد
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

const ENGINE = arg('engine', 'piper');
const VOICE = arg('voice');
const ONLY = arg('slug');
const DRY = process.argv.includes('--dry');

/* ── القصص كما هي في المحتوى ──────────────────────────────── */
const stories = [];

for (const file of fs.readdirSync(path.join(ROOT, 'content')).sort()) {
  if (!/^stories-\d+\.json$/.test(file)) continue;

  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', file), 'utf8'));
  stories.push(...data.stories);
}

const chosen = ONLY ? stories.filter((s) => s.slug === ONLY) : stories;

if (!chosen.length) {
  console.error('لا قصص مطابقة.');
  process.exit(1);
}

/* ── الحساب قبل أيّ عمل ───────────────────────────────────── */
const chars = chosen.reduce((n, s) => n + s.lines.join(' ').length, 0);
const words = chosen.reduce((n, s) => n + s.lines.join(' ').split(/\s+/).length, 0);

console.log('قصص: ' + chosen.length + '   جمل: ' +
  chosen.reduce((n, s) => n + s.lines.length, 0));
console.log('حروف: ' + chars + '   كلمات: ' + words +
  '   مدّة متوقّعة: ' + (words / 150).toFixed(1) + ' دقيقة');

/*
 * الكلفة تُقال قبل الإنفاق.
 *
 * أسعار المحرّكات التجاريّة لكل مليون حرف، وهي تتغيّر — فالرقم هنا
 * ترتيب حجم لا فاتورة.
 */
const PER_MILLION = { azure: 16, elevenlabs: 300, piper: 0 };
const cost = ((PER_MILLION[ENGINE] ?? 0) * chars) / 1_000_000;

console.log('المحرّك: ' + ENGINE + (VOICE ? '   الصوت: ' + VOICE : '') +
  '   الكلفة التقريبيّة: ' + (cost ? '$' + cost.toFixed(2) : 'مجّاناً'));

if (DRY) {
  console.log('\n(حساب فقط — بلا توليد)');
  process.exit(0);
}

if (!VOICE) {
  console.error('\nينقص --voice');
  process.exit(1);
}

/** هل ffmpeg موجود؟ */
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
} catch {
  console.error('\nffmpeg غير موجود — وهو لازم للدمج وقياس المدّة.');
  process.exit(1);
}

/** مدّة ملفّ بالثواني */
function duration(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ]).toString().trim();

  return Number(out);
}

/**
 * ينطق جملة إلى ملفّ.
 *
 * كل محرّك بأمره الخاصّ، وما بعد ذلك مشترك. وإضافة محرّك ثالث
 * سطرٌ هنا لا مسار جديد في البرنامج.
 */
function say(text, file) {
  if (ENGINE === 'piper') {
    // piper يقرأ من stdin ويكتب wav
    const wav = file.replace(/\.mp3$/, '.wav');

    execFileSync('piper', ['--model', VOICE, '--output_file', wav], { input: text });
    execFileSync('ffmpeg', ['-y', '-i', wav, '-b:a', '32k', '-ac', '1', file], { stdio: 'ignore' });
    fs.unlinkSync(wav);

    return;
  }

  if (ENGINE === 'azure') {
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;

    if (!key || !region) {
      throw new Error('ينقص AZURE_SPEECH_KEY و AZURE_SPEECH_REGION في البيئة');
    }

    const ssml = '<speak version="1.0" xml:lang="en-GB">' +
      '<voice name="' + VOICE + '">' +
      text.replace(/&/g, '&amp;').replace(/</g, '&lt;') +
      '</voice></speak>';

    execFileSync('curl', [
      '-s', '-X', 'POST',
      'https://' + region + '.tts.speech.microsoft.com/cognitiveservices/v1',
      '-H', 'Ocp-Apim-Subscription-Key: ' + key,
      '-H', 'Content-Type: application/ssml+xml',
      '-H', 'X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3',
      '--data-binary', ssml,
      '-o', file,
    ]);

    if (!fs.existsSync(file) || fs.statSync(file).size < 1000) {
      throw new Error('الاستجابة فارغة — تحقّق من المفتاح واسم الصوت');
    }

    return;
  }

  throw new Error('محرّك غير معروف: ' + ENGINE);
}

/** `12.345` إلى `00:00:12.345` */
function stamp(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(3).padStart(6, '0');

  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + s;
}

fs.mkdirSync(OUT, { recursive: true });

for (const story of chosen) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'narrate-'));
  const parts = [];
  const cues = [];

  let at = 0;

  process.stdout.write(story.slug + ' … ');

  try {
    for (const [i, line] of story.lines.entries()) {
      const part = path.join(tmp, String(i).padStart(2, '0') + '.mp3');

      say(line, part);

      cues.push({ from: at, to: at + duration(part), text: line });
      at += duration(part);
      parts.push(part);
    }

    /* الدمج — ملفّ واحد كما طُلب */
    const list = path.join(tmp, 'list.txt');
    fs.writeFileSync(
      list,
      parts.map((p) => "file '" + p.split(path.sep).join('/') + "'").join('\n'),
    );

    const mp3 = path.join(OUT, story.slug + '.mp3');
    execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', mp3],
      { stdio: 'ignore' });

    /* التوقيت — خرج من الجمع لا من المحاذاة */
    const vtt = ['WEBVTT', ''];

    cues.forEach((c, i) => {
      vtt.push(String(i + 1));
      vtt.push(stamp(c.from) + ' --> ' + stamp(c.to));
      vtt.push(c.text);
      vtt.push('');
    });

    fs.writeFileSync(path.join(OUT, story.slug + '.vtt'), vtt.join('\n'));

    console.log('✓ ' + at.toFixed(1) + ' ثانية · ' +
      (fs.statSync(mp3).size / 1024).toFixed(0) + ' ك.ب');
  } catch (e) {
    console.log('✗ ' + e.message);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('\nثم: php artisan stories:import');
