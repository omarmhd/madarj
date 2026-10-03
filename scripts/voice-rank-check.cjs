/*
 * Does the voice picker actually pick the better voice?
 *
 * ── The bug it was written for ──────────────────────────────
 * `pickVoice` was documented as "the best available voice" and
 * returned `sameLang[0]` — the first one the browser happened to
 * list. On Windows that is usually a SAPI voice from the nineties
 * while a neural one sits further down the same list. Nothing fails
 * when the wrong voice is chosen; it just sounds like a robot, and
 * the learner concludes English sounds like that.
 *
 * ── Real voice lists, not invented ones ─────────────────────
 * The names below are what these platforms actually report.
 *
 * ── And it calls the real chooser ───────────────────────────
 * The first version of this check sorted the list itself and only
 * asked `voiceRank` for scores. So when the original bug was put
 * back — `sameLang[0]` instead of the best — the check still passed.
 * A check that re-implements what it is checking checks nothing; the
 * selection was pulled out of the hook so this can call it.
 */
const fs = require('fs');
const path = require('path');
const ts = require(path.join(__dirname, '..', 'node_modules', 'typescript'));

const FILE = path.join(__dirname, '..', 'resources/js/hooks/useSpeech.ts');

const js = ts.transpileModule(fs.readFileSync(FILE, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const stub = new Proxy({}, { get: () => () => [null, () => {}] });
const req = () => stub;

const exports_ = {};
new Function('require', 'module', 'exports', js)(req, { exports: exports_ }, exports_);

const { voiceRank, chooseVoice } = exports_;

for (const [name, fn] of [['voiceRank', voiceRank], ['chooseVoice', chooseVoice]]) {
  if (typeof fn !== 'function') {
    console.error('useSpeech.ts لم يعد يصدّر ' + name);
    process.exit(1);
  }
}

const v = (name, localService = true) => ({ name, localService, lang: 'en-GB' });

/* Each case: the list a real platform reports, and the one that
 * should win */
const CASES = [
  [
    'ويندوز · إيدج',
    [
      v('Microsoft David - English (United States)'),
      v('Microsoft Zira - English (United States)'),
      v('Microsoft Sonia Online (Natural) - English (United Kingdom)', false),
    ],
    'Microsoft Sonia Online (Natural) - English (United Kingdom)',
  ],
  [
    'ويندوز · كروم',
    [
      v('Microsoft Hazel - English (Great Britain)'),
      v('Google UK English Female', false),
    ],
    'Google UK English Female',
  ],
  [
    'آيفون',
    [v('Daniel (Compact)'), v('Daniel'), v('Siri Voice 2')],
    'Siri Voice 2',
  ],
  [
    'أندرويد',
    [v('English (United Kingdom) espeak'), v('English United Kingdom')],
    'English United Kingdom',
  ],
  [
    'لينكس بلا شيء جيّد',
    [v('espeak-ng en-gb'), v('pico en-GB')],
    // كلاهما رديء — والمهمّ ألّا يسقط الاختيار
    null,
  ],
];

const problems = [];

for (const [platform, list, want] of CASES) {
  const winner = chooseVoice(list, 'en-GB');

  if (want && winner.name !== want) {
    problems.push(platform + ': اختير «' + winner.name + '» والأفضل «' + want + '»');
  }

  if (!winner) problems.push(platform + ': لم يُختر شيء');
}

/* A neural voice must outrank a local one, always */
if (voiceRank(v('Microsoft Sonia Online (Natural)', false)) <= voiceRank(v('Microsoft David'))) {
  problems.push('الصوت العصبيّ لا يتقدّم على القديم');
}

/* And the cloud tie-break must never outweigh quality */
if (voiceRank(v('Daniel (Compact)', false)) >= voiceRank(v('Daniel'))) {
  problems.push('المضغوط السحابيّ يتقدّم على الكامل المحليّ');
}

if (problems.length) {
  console.error('اختيار الصوت — مشاكل:\n  ' + problems.join('\n  '));
  process.exit(1);
}

console.log('اختيار الصوت: ' + CASES.length + ' منصّة، ويُختار أفضل المتاح.');
