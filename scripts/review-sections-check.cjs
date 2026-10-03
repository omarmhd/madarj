/*
 * The review weeks' sections: does their content still fit their screens?
 *
 * ── Why this check exists ───────────────────────────────────
 * The section is generated from the book by a script, and the screen
 * reads its fields directly. A payload that loses a field does not
 * fail the type checker (the JSON is not typed), does not fail the
 * build, and reaches the learner as a blank card — which is how the
 * white screen on week 1 day 1 happened: the shape changed under a
 * renderer that still trusted the old one.
 *
 * So this asserts the contract between the two, and it reads the
 * field list out of the component rather than restating it. A test
 * that repeats what it checks checks nothing.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VIEWS = {
  word_test: path.join(ROOT, 'resources/js/Components/Game/WordTest.tsx'),
  comparison: path.join(ROOT, 'resources/js/Components/Game/Comparison.tsx'),
  conversation: path.join(ROOT, 'resources/js/Components/Game/ConversationGuide.tsx'),
};

/** The field names inside one `interface` block of the component */
function fieldsOf(src, name) {
  const m = new RegExp('interface\\s+' + name + '\\s*\\{([^}]*)\\}').exec(src);
  if (!m) throw new Error('interface ' + name + ' not found: ' + name);

  return m[1]
    .split('\n')
    .map((l) => /^\s*([a-z_]+)\s*[?:]/i.exec(l))
    .filter(Boolean)
    .map((x) => x[1]);
}

const wordSrc = fs.readFileSync(VIEWS.word_test, 'utf8');
const wantWord = fieldsOf(wordSrc, 'Word');
const wantList = fieldsOf(wordSrc, 'List');
const wantPayload = fieldsOf(wordSrc, 'WordTestPayload');

const cmpSrc = fs.readFileSync(VIEWS.comparison, 'utf8');
const wantMetric = fieldsOf(cmpSrc, 'Metric');
const wantCmp = fieldsOf(cmpSrc, 'ComparisonPayload');

const convSrc = fs.readFileSync(VIEWS.conversation, 'utf8');
const wantConv = fieldsOf(convSrc, 'ConversationPayload');
const wantPathRow = fieldsOf(convSrc, 'PathRow');

/*
 * Arabic where the learner has to read to act.
 *
 * Every `_ar` field in this section is guidance a beginner acts on, so
 * an English string sitting in one is not a formatting slip -- it is a
 * paragraph the reader cannot use. Only what they say or paste stays
 * English, and those fields are named `_en`.
 */
const ARABIC = /[؀-ۿ]/;

function mustBeArabic(value, where, problems) {
  if (typeof value !== 'string' || !value.trim()) return;
  if (!ARABIC.test(value)) problems.push(where + ' ليس عربياً: «' + value.slice(0, 40) + '»');
}

const problems = [];
let checked = 0;

for (const f of fs.readdirSync(path.join(ROOT, 'content'))) {
  if (!/^week-\d\d\.json$/.test(f)) continue;

  const week = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', f), 'utf8'));
  const at = f + ' → ';
  const comparison = (week.sections ?? []).find((s) => s.kind === 'comparison');

  if (comparison) {
    checked++;
    const c = comparison.payload ?? {};

    for (const k of wantCmp) {
      if (!(k in c)) problems.push(at + 'comparison.' + k + ' مفقود');
    }

    const weeksList = Array.isArray(c.weeks) ? c.weeks : [];

    if (weeksList.length < 2) {
      problems.push(at + 'المقارنة تحتاج أسبوعين على الأقل — لا شيء يُقارَن');
    }

    // The week doing the comparing must be one of the columns, or the
    // learner measures everything except what they just recorded
    const own = Number(/week-(\d\d)/.exec(f)[1]);
    if (weeksList.length && !weeksList.includes(own)) {
      problems.push(at + 'الأسبوع ' + own + ' ليس بين أعمدة جدوله');
    }

    const metrics = Array.isArray(c.metrics) ? c.metrics : [];
    if (!metrics.length) problems.push(at + 'لا مقاييس');

    for (const k of wantMetric) {
      const bad = metrics.filter((m) => !(k in m)).length;
      if (bad) problems.push(at + bad + ' مقياساً بلا حقل ' + k);
    }

    // A beginner reads the Arabic label; an English one is unusable
    const noAr = metrics.filter((m) => !m.label_ar).length;
    if (noAr) problems.push(at + noAr + ' مقياساً بلا عربية');

    const kinds = metrics.filter((m) => !['number', 'yesno'].includes(m.kind)).length;
    if (kinds) problems.push(at + kinds + ' مقياساً بنوع غير معروف');

    if (!Array.isArray(c.stems_en) || !c.stems_en.length) {
      problems.push(at + 'لا جمل تُكمَل');
    }
  }

  const conversation = (week.sections ?? []).find((s) => s.kind === 'conversation');

  if (conversation) {
    checked++;
    const c = conversation.payload ?? {};

    for (const k of wantConv) {
      if (!(k in c)) problems.push(at + 'conversation.' + k + ' مفقود');
    }

    const paths = c.choose?.paths ?? [];
    if (paths.length !== 4) problems.push(at + 'الطرق ' + paths.length + ' لا أربعة');

    for (const k of wantPathRow) {
      const bad = paths.filter((x) => !(k in x)).length;
      if (bad) problems.push(at + bad + ' طريقاً بلا حقل ' + k);
    }

    // The block pasted into a chat is useless empty
    const prompt = (c.paths ?? []).map((x) => x.prompt).find(Boolean);
    if (!prompt?.start_en?.length) problems.push(at + 'كتلة اللصق فارغة');

    if (!(c.phrases?.items ?? []).length) problems.push(at + 'لا عبارات نجاة');
    if (!(c.debrief?.questions_ar ?? []).length) problems.push(at + 'لا أسئلة مراجعة');

    /* Every `_ar` in the payload, however deep */
    const walk = (node, where) => {
      if (Array.isArray(node)) return node.forEach((x, i) => walk(x, where + '[' + i + ']'));
      if (!node || typeof node !== 'object') return;

      for (const [k, v] of Object.entries(node)) {
        if (k.endsWith('_ar') && typeof v === 'string') mustBeArabic(v, at + where + '.' + k, problems);
        else walk(v, where + '.' + k);
      }
    };

    walk(c, 'conversation');
  }

  const section = (week.sections ?? []).find((s) => s.kind === 'word_test');
  if (!section) continue;

  checked++;
  const p = section.payload ?? {};

  for (const k of wantPayload) {
    if (!(k in p)) problems.push(at + 'payload.' + k + ' مفقود');
  }

  const list = p.list ?? {};

  for (const k of wantList) {
    if (!(k in list)) problems.push(at + 'list.' + k + ' مفقود');
  }

  const words = Array.isArray(list.words) ? list.words : [];

  if (!words.length) {
    problems.push(at + 'القائمة فارغة — الشاشة تبدأ باختبار بلا كلمات');
  }

  for (const k of wantWord) {
    const bad = words.filter((w) => !(k in w)).length;
    if (bad) problems.push(at + bad + ' كلمة بلا حقل ' + k);
  }

  // The screen offers "reveal the answer" only where there is one, so
  // a mode that asks for a form must supply it for every word
  if (list.ask && list.ask !== 'say') {
    const blank = words.filter((w) => !w.answer).length;
    if (blank) problems.push(at + blank + ' كلمة بلا جواب في نمط «' + list.ask + '»');
  }

  if (list.ask === 'say' && words.some((w) => w.answer)) {
    problems.push(at + 'نمط «say» لا جواب فيه، وبعض الكلمات تحمل جواباً');
  }

  if (!(list.minutes > 0)) problems.push(at + 'minutes ليست موجبة');
}

if (!checked) {
  console.error('لم يُفحص أي قسم — هل تغيّرت أسماء الأقسام؟');
  process.exit(1);
}

if (problems.length) {
  console.error('أقسام المراجعة — مشاكل:\n  ' + problems.join('\n  '));
  process.exit(1);
}

console.log('أقسام المراجعة: ' + checked + ' قسماً، والحمولة مطابقة لشاشتها.');
