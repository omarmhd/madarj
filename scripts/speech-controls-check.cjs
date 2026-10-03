/*
 * A screen that speaks must let the learner choose how.
 *
 * ── The bug this exists to stop ─────────────────────────────
 * The speed buttons were written inline on the week page and copied
 * to the day page. When the stories page arrived it had neither the
 * buttons nor a way to reach them — and worse, its reader called
 * `speakSequence` without passing anything, so it read at the
 * library's default rate in whatever voice the browser chose. The
 * learner's two settings were on screen elsewhere and had no effect
 * there.
 *
 * Nothing failed. A missing control throws no error, and a default
 * argument is a perfectly valid argument.
 *
 * ── The two rules ───────────────────────────────────────────
 * ① A page that renders a reader or speaks must render SpeechControls.
 * ② Every `speakSequence` call must pass `rate` — the one option with
 *    a default that silently overrides the learner.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JS = path.join(ROOT, 'resources/js');

const files = [];

(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'build'].includes(e.name)) continue;

    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
})(JS);

const problems = [];

/*
 * Pages whose whole purpose is speaking, and which therefore owe the
 * learner the controls. Listed rather than guessed: a page that
 * happens to contain one Listen button does not need a whole bar,
 * and inferring "speaks a lot" from source text would be a guess.
 */
const MUST_HAVE_CONTROLS = [
  'resources/js/Pages/Stories.tsx',
  'resources/js/Pages/Week/Show.tsx',
  'resources/js/Pages/Week/Day.tsx',
];

for (const rel of MUST_HAVE_CONTROLS) {
  const full = path.join(ROOT, rel);

  if (!fs.existsSync(full)) {
    problems.push(rel + ' — غير موجود');
    continue;
  }

  if (!fs.readFileSync(full, 'utf8').includes('SpeechControls')) {
    problems.push(rel + ' — شاشة تنطق بلا شريط صوت وسرعة');
  }
}

/* Every sequence call carries the learner's speed */
let calls = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).split(path.sep).join('/');

  // the hook's own definition is not a call site
  if (rel.endsWith('hooks/useSpeech.ts')) continue;

  let at = -1;
  while ((at = src.indexOf('speakSequence(', at + 1)) >= 0) {
    calls++;

    /* The options object is the second argument; reading to the end
     * of the call is enough to see whether `rate` is in it */
    const tail = src.slice(at, at + 700);
    const line = src.slice(0, at).split('\n').length;

    if (!/\brate\b/.test(tail)) {
      problems.push(
        rel + ':' + line + ' — speakSequence بلا rate، فتقرأ بسرعة المكتبة لا بسرعته',
      );
    }
  }
}

if (problems.length) {
  console.error('النطق — مشاكل:\n  ' + problems.join('\n  '));
  process.exit(1);
}

console.log(
  'النطق: ' + MUST_HAVE_CONTROLS.length + ' شاشة تحمل الشريط، و' +
    calls + ' نداء متسلسل يحمل السرعة.',
);
