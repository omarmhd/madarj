/**
 * Spelling checks for typed vocabulary.
 *
 * ── Why this runs in the browser ────────────────────────────
 * §4.4 keeps exercise answers on the server. A vocabulary word is not
 * an answer of that kind: it is already on the same screen in the word
 * list, and dictation cannot work unless the browser knows the word to
 * speak it. Hiding it would protect nothing.
 *
 * ── What the feedback targets ───────────────────────────────
 * Arabic writes short vowels as optional marks, so Arabic-speaking
 * learners read and spell English by its consonants ("vowel blindness",
 * Ryan & Meara 1991): `fthr`, `dotor`, `brothr`. The gap round hides
 * exactly those letters, and the hints name the pattern when the typed
 * word has the right consonants and the wrong vowels. The other
 * patterns the hints name are the ones Arabic gives no help with:
 * p/b (Arabic has no /p/), doubled letters, and capitals.
 */

import { iso } from '@/lib/bidi';

export type Verdict = 'right' | 'close' | 'wrong';

export interface Mark {
  ch: string;
  /** false = this letter of the target was missing or wrong in the attempt */
  ok: boolean;
}

export interface SpellResult {
  verdict: Verdict;
  /** The target, letter by letter, coloured by what the attempt got right */
  marks: Mark[];
  /** The attempt, letter by letter — safe to show before the word is revealed */
  attemptMarks: Mark[];
  /** One short hint in plain Arabic, when a known pattern explains the miss */
  hint: string | null;
  /** Accepted, but worth a word — a capital, a British spelling */
  note: string | null;
}

const VOWELS = /[aeiou]/i;
const ARABIC = /[؀-ۿ]/;

/** Lowercase, straight apostrophes, single spaces, no trailing punctuation */
export function normalize(s: string): string {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[‐-―]/g, '-')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.!?,;:]+$/, '')
    .toLowerCase();
}

export const hasArabic = (s: string) => ARABIC.test(s);

/** The word with its vowels blanked — the first letter always stays as an anchor */
export function vowelGaps(word: string): string {
  let hidden = 0;

  const out = word
    .split(/(\s+|-)/)
    .map((part) => {
      if (/^(\s+|-)$/.test(part)) return part;

      return [...part]
        .map((ch, i) => {
          if (i > 0 && VOWELS.test(ch)) {
            hidden++;
            return '_';
          }
          return ch;
        })
        .join('');
    })
    .join('');

  // A word like "by" has no vowel after its first letter: hide the last letter instead
  if (hidden === 0 && word.length > 1) return word.slice(0, -1) + '_';

  return out;
}

/** Levenshtein distance — a near miss is a different thing from not knowing */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }

  return row[b.length];
}

/**
 * Align attempt and target by their longest common subsequence.
 *
 * Two views of one alignment: the target's letters (shown once the
 * word is revealed) and the attempt's letters (shown after a first
 * miss — it colours what the learner wrote without giving the word away).
 */
function align(typed: string, target: string): { target: Mark[]; attempt: Mark[] } {
  const t = target.toLowerCase();
  const a = typed.toLowerCase();
  const n = a.length;
  const m = t.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === t[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const okT = new Array(m).fill(false);
  const okA = new Array(n).fill(false);
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (a[i] === t[j]) {
      okT[j] = okA[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  const letter = (ch: string) => /[a-z]/i.test(ch);

  return {
    target: [...target].map((ch, k) => ({ ch, ok: okT[k] || !letter(ch) })),
    attempt: [...typed].map((ch, k) => ({ ch, ok: okA[k] || !letter(ch) })),
  };
}

const consonants = (s: string) => s.replace(/[aeiou\s'-]/gi, '');

/** Spellings the book's British English and a learner's American source both use */
function variantOf(typed: string, target: string): boolean {
  const swaps: [RegExp, string][] = [
    [/our\b/g, 'or'],
    [/ise\b/g, 'ize'],
    [/ence\b/g, 'ense'],
    [/tre\b/g, 'ter'],
  ];

  return swaps.some(([re, to]) => re.test(target) && target.replace(re, to) === typed);
}

/** Check one attempt against one word */
export function checkSpelling(attempt: string, target: string): SpellResult {
  const typed = normalize(attempt);
  const want = normalize(target);
  const { target: marks, attempt: attemptMarks } = align(attempt.trim(), target.trim());

  if (hasArabic(attempt)) {
    return {
      verdict: 'wrong',
      marks: align('', target.trim()).target,
      attemptMarks: [],
      hint: 'لوحة المفاتيح بالعربية. غيّرها إلى الإنجليزية ثم اكتب.',
      note: null,
    };
  }

  // Exact, or exact apart from a leading article the word list carries ("a hundred")
  const bare = want.replace(/^(a|an|the|to) /, '');
  if (typed === want || (bare !== want && typed === bare)) {
    const capital = /[A-Z]/.test(target) && !/[A-Z]/.test(attempt);

    return {
      verdict: 'right',
      marks,
      attemptMarks,
      hint: null,
      note: capital
        ? `تُكتب بحرف كبير دائماً: ${iso(target.trim())}`
        : null,
    };
  }

  if (variantOf(typed, want)) {
    return {
      verdict: 'right',
      marks,
      attemptMarks,
      hint: null,
      note: `صحيحة بالإملاء الأمريكي. الكتاب يكتبها: ${iso(target.trim())}`,
    };
  }

  const d = distance(typed, want);
  const verdict: Verdict = d <= (want.length >= 8 ? 2 : 1) ? 'close' : 'wrong';

  return { verdict, marks, attemptMarks, hint: hintFor(typed, want), note: null };
}

/** Name the pattern behind the miss, when there is one worth naming */
function hintFor(typed: string, want: string): string | null {
  if (typed === '') return null;

  // Right consonants, wrong or missing vowels — the Arabic-speaker pattern
  if (consonants(typed) === consonants(want) && typed !== want) {
    return `الحروف الساكنة صحيحة. راجع حروف العلة ${iso('a e i o u')}: في الإنجليزية تُكتب الحركات حروفاً.`;
  }

  if (typed.replace(/p/g, 'b') === want.replace(/p/g, 'b')) {
    return `انتبه للحرفين ${iso('p')} و${iso('b')}: هما صوتان مختلفان وحرفان مختلفان.`;
  }

  const doubled = want.match(/([a-z])\1/);
  if (doubled && typed === want.replace(doubled[0], doubled[1])) {
    return `الحرف ${iso(doubled[1])} مكرّر مرتين في هذه الكلمة.`;
  }

  if (typed.length === want.length && [...typed].sort().join('') === [...want].sort().join('')) {
    return 'الحروف كلها صحيحة لكن ترتيبها مختلف.';
  }

  if (want.startsWith(typed) && typed.length >= 2) {
    return 'بداية صحيحة. الكلمة أطول من هذا.';
  }

  return null;
}
