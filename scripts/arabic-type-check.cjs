/*
 * Two ways Arabic gets damaged in a Tailwind codebase.
 *
 * ── ① letter-spacing ────────────────────────────────────────
 * Arabic is a connected script and carries vowel marks above and
 * below the line. `tracking-tight` squeezes the joins and crowds the
 * marks; `tracking-widest` pulls the joins apart so the word stops
 * looking like one word. Neither is visible to a reader of English —
 * the brand name «مَدارِج» sat under `tracking-tight` until somebody
 * said a letter was unclear.
 *
 * ── ② sizes below the floor ─────────────────────────────────
 * Arabic carries meaning in dots that 10 and 11 pixels erase — ت
 * against ب against ث is two dots, one dot, three dots. Latin at
 * that size loses nothing comparable, so the rule is about the
 * script, not the number.
 *
 * ── How an element is judged to be Arabic ───────────────────
 * By its own text: what sits between this tag and the next one. An
 * element whose content is an expression (`{tr(...)}`, `{x.title_ar}`)
 * cannot be read statically, so those are left alone rather than
 * guessed at — the check reports what it can prove.
 *
 * ── Except for size, where the burden is reversed ──────────
 * That gap let 82 tiny `{tr(...)}` elements through: the content
 * was an expression, so it was never judged Arabic. For sizes
 * below the floor the tag must now prove it is Latin — `dir="ltr"`
 * on the tag itself, the codebase's marker for Latin content.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ARABIC = /[؀-ۿ]/;

/** Sizes no Arabic text may use */
const TOO_SMALL = /text-\[(?:9|10|11)px\]/;

/** Letter-spacing has no business on a connected script */
const TRACKING = /\btracking-(?:tighter|tight|wide|wider|widest)\b/;

const files = [];

(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'vendor', '.git', 'public', 'build'].includes(e.name)) continue;

    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.tsx')) files.push(p);
  }
})(path.join(ROOT, 'resources/js'));

const problems = [];
let checked = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).split(path.sep).join('/');

  /*
   * Every opening tag, with the text that follows it up to the next
   * tag. That text is the element's own content — enough to tell
   * whether this class list is wrapping Arabic.
   */
  const re = /<[a-zA-Z][^>]*>/g;
  let m;

  while ((m = re.exec(src))) {
    const tag = m[0];
    if (!TRACKING.test(tag) && !TOO_SMALL.test(tag)) continue;

    checked++;

    if (TOO_SMALL.test(tag) && !/dir=["'{]*ltr/.test(tag)) {
      const line = src.slice(0, m.index).split('\n').length;
      problems.push(rel + ':' + line + '  حجم دون الأرضيّة بلا dir="ltr"');
      continue;
    }

    const after = src.slice(m.index + tag.length);
    const text = after.slice(0, Math.max(0, after.search(/[<{]/)));

    if (!ARABIC.test(text)) continue;

    const line = src.slice(0, m.index).split('\n').length;
    const where = rel + ':' + line;
    const sample = text.trim().slice(0, 24);

    if (TRACKING.test(tag)) {
      problems.push(where + '  tracking على عربيّة — «' + sample + '»');
    }

    if (TOO_SMALL.test(tag)) {
      problems.push(where + '  حجم دون الأرضيّة — «' + sample + '»');
    }
  }
}

if (problems.length) {
  console.error('نصّ عربيّ متضرّر:\n  ' + problems.join('\n  '));
  process.exit(1);
}

console.log(
  'الخطّ العربيّ: ' + files.length + ' ملفاً، و' + checked +
    ' موضعاً فُحص، ولا ضرر.',
);
