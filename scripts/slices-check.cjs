/*
 * Step-splitting check — against `lib/contentSteps.ts` itself.
 *
 * ── The bug this exists to catch ────────────────────────────
 * A sound-contrast group used to be a map keyed by the book's
 * English heading. It became a list of objects when the group
 * gained an Arabic name — and this module was left behind, still
 * calling `Object.entries` on it. On an array that returns the
 * indices '0', '1', '2' as labels and hands the drill an object
 * where it expects an array, so `groups.forEach` is not a function
 * and the day page renders a blank white screen.
 *
 * Nothing caught it: the types passed, the build passed, the server
 * payload was correct, and the page answered 200. Only a browser
 * would have shown it.
 *
 * So this asserts the contract between the payload and the splitter
 * by running the real module, not a copy of it.
 *
 * Run: npm run check:slices
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'resources', 'js', 'lib', 'contentSteps.ts');

/*
 * Compile the real file with the project's own TypeScript, rather
 * than stripping types with regexes. A hand-rolled stripper is one
 * more thing that can be wrong about the module it is checking.
 */
const ts = require('typescript');

const compiled = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const mod = { exports: {} };
new Function('module', 'exports', 'require', compiled)(mod, mod.exports, require);

const { sliceBlock, sliceTitle } = mod.exports;

let failed = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    console.log('  ✓ ' + name);
  } else {
    failed++;
    console.log('  ✗ ' + name + (detail ? '\n      ' + detail : ''));
  }
}

/* The payload shape the server actually sends, three contrasts deep */
const block = {
  type: 'minimal_pairs',
  groups: [
    {
      label_ar: 'الكسرة القصيرة والممدودة',
      label_en: 'short i against long ee',
      ipa: '/ɪ/ vs /iː/',
      hint_ar: '…',
      pairs: [{ id: 1 }, { id: 2 }],
    },
    {
      label_ar: 'الضمّة القصيرة والممدودة',
      label_en: 'short oo against long oo',
      ipa: '/ʊ/ vs /uː/',
      hint_ar: '…',
      pairs: [{ id: 3 }],
    },
    {
      label_ar: 'الفتحة المفتوحة والممدودة',
      label_en: 'open a against long a',
      ipa: '/æ/ vs /ɑː/',
      hint_ar: '…',
      pairs: [{ id: 4 }],
    },
  ],
};

console.log('\n── one contrast per step ──');

const slices = sliceBlock(block);

ok('a step per contrast', slices.length === 3, 'got ' + slices.length);

ok(
  'every step still carries an array',
  slices.every((s) => Array.isArray(s.groups)),
  'shapes: ' + slices.map((s) => (Array.isArray(s.groups) ? 'array' : typeof s.groups)).join(', '),
);

ok(
  'exactly one contrast per step — §2.4 forbids mixing',
  slices.every((s) => s.groups.length === 1),
);

ok(
  'the contrast object survives whole',
  slices[1].groups[0].label_ar === 'الضمّة القصيرة والممدودة' &&
    Array.isArray(slices[1].groups[0].pairs),
);

console.log('\n── the step title ──');

const title = sliceTitle(slices[1], 1, 3);

ok('names the contrast in Arabic', title.startsWith('الضمّة القصيرة والممدودة'), title);
ok('and says where the learner is', title.includes('2') && title.includes('3'), title);
ok('no title when there is nothing to divide', sliceTitle(slices[0], 0, 1) === null);

console.log('\n── a single contrast is not split ──');

const one = sliceBlock({ type: 'minimal_pairs', groups: [block.groups[0]] });
ok('left as one step', one.length === 1);
ok('and still an array', Array.isArray(one[0].groups));

console.log('\n── blocks that own their interface stay whole ──');

for (const type of ['exercises', 'record', 'writing', 'review', 'section']) {
  ok(type, sliceBlock({ type }).length === 1);
}

console.log(failed === 0 ? '\nAll checks passed.\n' : '\nFailed: ' + failed + '\n');
process.exit(failed === 0 ? 0 : 1);
