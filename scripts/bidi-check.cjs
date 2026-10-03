/*
 * فحص عزل الاتجاه — على `lib/bidi.ts` نفسه.
 *
 * ── لماذا يستورد الملفّ ولا يكرّره ──────────────────────────
 * كان هنا اختبارٌ يعيد كتابة التعبير النمطي بيده، فبقي يمرّ بينما
 * الملفّ الحقيقي مكسور: ضاع هروب `\[` و`\]` في `MID` فانغلق صنف
 * المحارف عند أول `]`، فسقط نصف التعبير وصار **كل حرف** مقطعاً
 * وحده — فتُقرأ «We» في الصفحة العربية «eW».
 *
 * واختبارٌ يكرّر ما يفحصه لا يفحص شيئاً. فهذا يقرأ `bidi.ts` من
 * قرصه وينفّذه كما هو.
 *
 * التشغيل: npm run check:bidi
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'resources', 'js', 'lib', 'bidi.ts');

/* تحميل الوحدة الحقيقية بعد نزع أنواع TypeScript وحدها */
let src = fs.readFileSync(SRC, 'utf8');
src = src.slice(0, src.indexOf('export function isolateDeep'));
src = src
  .split('export function').join('function')
  .split('(text: string): string').join('(text)')
  .split('(text: string | null | undefined): string').join('(text)');

const mod = { exports: {} };
new Function('module', src + '\nmodule.exports = { RUN, isolate, strip, iso };')(mod);

const { RUN, isolate, strip, iso } = mod.exports;

const FSI = '⁨';
const PDI = '⁩';

let failed = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    console.log('  ✓ ' + name);
  } else {
    failed++;
    console.log('  ✗ ' + name + (detail ? '\n      ' + detail : ''));
  }
}

/** النصّ بعد العزل، والعلامتان مرئيّتان للفحص */
const show = (t) => isolate(t).split(FSI).join('[').split(PDI).join(']');

console.log('\n── المقطع كلمةٌ لا حرف ──');

ok(
  'الجملة الإنجليزية مقطعٌ واحد',
  'We sit on the roof.'.match(RUN)?.length === 1,
  'المطابقات: ' + JSON.stringify('We sit on the roof.'.match(RUN)),
);

ok(
  'جملة داخل عربية تُعزَل كاملة',
  show('قال: We sit on the roof in summer.') ===
    'قال: [We sit on the roof in summer].',
  show('قال: We sit on the roof in summer.'),
);

ok(
  'لا حرف مفرد يُعزَل وحده',
  !/⁨.⁩⁨/.test(isolate('قال: We sit on the roof.')),
);

console.log('\n── حالات المحتوى ──');

const cases = [
  ['نسيان الـ s. «He work» خطأ.', 'نسيان الـ [s]. «[He work]» خطأ.'],
  ['صوت /θ/ في think و/ð/ في this.', 'صوت [/θ/] في [think] و[/ð/] في [this].'],
  ['can لا تأخذ -s أبداً', '[can] لا تأخذ [-s] أبداً'],
  ['الفرق: /iː/ ممدودة و/ɪ/ قصيرة', 'الفرق: [/iː/] ممدودة و[/ɪ/] قصيرة'],
  ['كلمة café وnaïve مستعارة', 'كلمة [café] و[naïve] مستعارة'],
  ['sheep فيها /iː/ وship فيها /ɪ/.', '[sheep] فيها [/iː/] و[ship] فيها [/ɪ/].'],
];

for (const [input, want] of cases) {
  ok(input.slice(0, 34), show(input) === want, 'وجدنا: ' + show(input));
}

console.log('\n── ما لا يُمسّ ──');

ok('العربي الخالص كما هو', isolate('نصّ عربي خالص.') === 'نصّ عربي خالص.');
ok('الإنجليزي الخالص كما هو', isolate('Pure english only.') === 'Pure english only.');
ok('الفارغ آمن', isolate('') === '' && iso(null) === '');

console.log('\n── الخصائص ──');

const sample = 'نسيان الـ s. «He work» خطأ، وthink فيها /θ/.';

ok('ثابت عند التكرار', isolate(isolate(sample)) === isolate(sample));
ok('النزع يُعيد الأصل', strip(isolate(sample)) === sample);
ok('iso تلفّ مرة واحدة', iso(iso('x')) === FSI + 'x' + PDI);
ok(
  'strip بلا حالة عالقة',
  strip(sample) === sample && strip(sample) === sample,
);

console.log(failed === 0 ? '\nكل الفحوص نجحت.\n' : '\nأخفق: ' + failed + '\n');
process.exit(failed === 0 ? 0 : 1);
