/*
 * The pronunciation check's only decision: was that the right word?
 *
 * ── Why this is checked and the rest of the screen is not ───
 * Everything else there is presentation. `judge` is the part with a
 * right answer, and getting it wrong is expensive in a specific way:
 * a learner told they said `tree` when they said `three` will stop
 * trusting the feature, and one told they were right when they were
 * not learns the wrong mouth position. Both failures are silent.
 *
 * It imports the real module rather than restating the rules — a
 * check that repeats what it checks checks nothing, which is how a
 * broken bidi regex once passed its own test.
 */
const fs = require('fs');
const path = require('path');
const ts = require(path.join(__dirname, '..', 'node_modules', 'typescript'));

const FILE = path.join(__dirname, '..', 'resources/js/Components/Game/SayIt.tsx');

/* The module pulls in React and app paths; only the two pure
 * functions are wanted, so the imports are stubbed away */
const js = ts.transpileModule(fs.readFileSync(FILE, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;

const stub = new Proxy({}, { get: () => () => null });
const req = (id) => (id === 'react' ? { useState: () => [null, () => {}] } : stub);

const exports_ = {};
new Function('require', 'module', 'exports', js)(req, { exports: exports_ }, exports_);

const { judge, normalise } = exports_;

if (typeof judge !== 'function' || typeof normalise !== 'function') {
  console.error('SayIt.tsx لم يعد يصدّر judge و normalise');
  process.exit(1);
}

/* Contrasts the platform actually holds, and what a recogniser
 * plausibly returns for each */
const CASES = [
  // what was asked, its pair, what the browser heard, the verdict
  ['three', 'tree', ['three'], 'ok'],
  ['three', 'tree', ['Three.'], 'ok'],
  ['three', 'tree', ['tree'], 'confused'],
  ['three', 'tree', ['free', 'tree'], 'confused'],
  ['ship', 'sheep', ['sheep'], 'confused'],
  ['ship', 'sheep', ['chip', 'ship'], 'ok'],
  ['ship', 'sheep', ['shape'], 'other'],
  ['very', 'berry', ['berry'], 'confused'],
  ['very', 'berry', ['very much'], 'ok'],
  ['pen', 'pan', [''], 'other'],
  ['pen', 'pan', [], 'other'],

  // A word inside a phrase counts; a word inside another word does not
  ['cat', 'cut', ['the cat'], 'ok'],
  ['cat', 'cut', ['category'], 'other'],

  // With no pair given there is nothing to be confused with
  ['work', null, ['walk'], 'other'],
  ['work', null, ['work'], 'ok'],
];

const problems = [];

for (const [say, against, heard, want] of CASES) {
  const got = judge(heard, { say, against });

  if (got.kind !== want) {
    problems.push(
      '«' + say + '» سُمعت [' + heard.join(', ') + '] → ' + got.kind + '، والمتوقّع ' + want,
    );
  }

  // The confused verdict must name the other word, or it says nothing
  if (got.kind === 'confused' && got.with !== against) {
    problems.push('«' + say + '» لم تُسمَّ الكلمة الأخرى');
  }
}

/* Normalising must not eat the word itself */
for (const [raw, want] of [
  ['Three.', 'three'],
  ["don't", "don't"],
  ['  SHIP  ', 'ship'],
  ['a   b', 'a b'],
]) {
  if (normalise(raw) !== want) {
    problems.push('normalise(' + JSON.stringify(raw) + ') = ' + JSON.stringify(normalise(raw)));
  }
}

if (problems.length) {
  console.error('فحص النطق — مشاكل:\n  ' + problems.join('\n  '));
  process.exit(1);
}

console.log('فحص النطق: ' + CASES.length + ' حالة، والحكم سليم.');
