/**
 * How each taught sound is made — the data behind MouthDiagram.
 *
 * This is phonetic reference, not course content: where the tongue
 * sits for /iː/ does not change between weeks or editions, so it lives
 * beside the code that draws it rather than in content/*.json.
 *
 * Only sounds the course actually drills are listed (minimal pairs and
 * phonics symbols across weeks 1–24). Stress, intonation and linking
 * have no mouth shape and are deliberately absent — `soundsIn()` simply
 * finds nothing for them and no diagram is drawn.
 */

export type Lips = 'spread' | 'neutral' | 'rounded' | 'open' | 'closed' | 'teeth-lip';

/** Where the tongue makes contact, for consonants. `rest` = lies flat. */
export type Contact = 'rest' | 'dental' | 'alveolar' | 'alveolar-near' | 'velar';

export interface Articulation {
  ipa: string;
  kind: 'vowel' | 'consonant';
  /** 0 = closed jaw, 1 = wide open */
  jaw: number;
  lips: Lips;
  /** Vowels: tongue body. height 0 = high, 1 = low; back 0 = front, 1 = back */
  tongue?: { height: number; back: number };
  /** Consonants: what the tongue touches */
  contact?: Contact;
  long?: boolean;
  voiced?: boolean;
  nasal?: boolean;
  /** A puff of air on release — the thing that separates /p/ from /b/ for an Arabic ear */
  aspirated?: boolean;
  /** Air hisses through a narrow gap */
  fricative?: boolean;
  /** Diphthongs: the sound the mouth glides to */
  glide?: string;
  /** The nearest Arabic anchor, or a warning that there is none */
  near_ar: string;
}

const V = (
  ipa: string, height: number, back: number, jaw: number, lips: Lips,
  near_ar: string, extra: Partial<Articulation> = {},
): Articulation => ({ ipa, kind: 'vowel', tongue: { height, back }, jaw, lips, voiced: true, near_ar, ...extra });

const C = (
  ipa: string, contact: Contact, lips: Lips, near_ar: string, extra: Partial<Articulation> = {},
): Articulation => ({ ipa, kind: 'consonant', contact, jaw: 0.15, lips, near_ar, ...extra });

export const ARTICULATION: Record<string, Articulation> = Object.fromEntries(
  [
    V('iː', 0.05, 0.1, 0.1, 'spread', 'مثل الياء الممدودة في «فِيل»', { long: true }),
    V('ɪ', 0.28, 0.25, 0.2, 'neutral', 'لا مقابل عربيّ دقيق — كسرة أقصر وأرخى من «فِيل»'),
    V('e', 0.5, 0.15, 0.4, 'spread', 'قريب من الإمالة في «بيت» بالعاميّة'),
    V('æ', 0.92, 0.18, 0.9, 'open', 'لا مقابل عربيّ — فتحة أوسع بكثير من «بَ»'),
    V('ʌ', 0.75, 0.5, 0.6, 'neutral', 'مثل الفتحة القصيرة في «قَد»'),
    V('ɑː', 1, 0.85, 1, 'open', 'مثل الألف المفخّمة في «قال»', { long: true }),
    V('ɒ', 0.9, 0.9, 0.8, 'rounded', 'فتحة قصيرة والشفتان مدوّرتان قليلاً'),
    V('ɔː', 0.55, 0.9, 0.45, 'rounded', 'واو مفتوحة ممدودة، والشفتان مدوّرتان', { long: true }),
    V('ʊ', 0.28, 0.75, 0.2, 'rounded', 'ضمّة قصيرة مسترخية — أقصر من «فُول»'),
    V('uː', 0.05, 0.92, 0.1, 'rounded', 'مثل الواو الممدودة في «فُول»', { long: true }),
    V('ə', 0.5, 0.5, 0.35, 'neutral', 'أضعف صوت في الإنجليزية: حركة باهتة بلا جهد'),
    V('ɜː', 0.5, 0.5, 0.35, 'neutral', 'لا مقابل عربيّ — بين الفتحة والضمّة، والشفتان مسترخيتان', { long: true }),
    V('əʊ', 0.5, 0.5, 0.35, 'neutral', 'صوتان في نَفَس واحد — ليست «أو» ممدودة', { glide: 'ʊ' }),
    V('eɪ', 0.5, 0.15, 0.4, 'spread', 'صوتان في نَفَس واحد — مثل «إيْ»', { glide: 'ɪ' }),
    V('aɪ', 0.95, 0.4, 0.9, 'open', 'صوتان في نَفَس واحد — مثل «آيْ»', { glide: 'ɪ' }),

    C('p', 'rest', 'closed', 'لا يوجد في العربية — «ب» بلا صوت، مع نفخة هواء', { aspirated: true }),
    C('b', 'rest', 'closed', 'مثل «ب» العربية', { voiced: true }),
    C('f', 'rest', 'teeth-lip', 'مثل «ف» العربية', { fricative: true }),
    C('v', 'rest', 'teeth-lip', 'لا يوجد في العربية — «ف» مع اهتزاز الحلق', { voiced: true, fricative: true }),
    C('θ', 'dental', 'neutral', 'مثل «ث» العربية — ليست «س» ولا «ت»', { fricative: true }),
    C('ð', 'dental', 'neutral', 'مثل «ذ» العربية — ليست «ز» ولا «د»', { voiced: true, fricative: true }),
    C('s', 'alveolar-near', 'spread', 'مثل «س» العربية', { fricative: true }),
    C('z', 'alveolar-near', 'spread', 'مثل «ز» العربية', { voiced: true, fricative: true }),
    C('t', 'alveolar', 'neutral', 'مثل «ت» مع نفخة هواء خفيفة', { aspirated: true }),
    C('d', 'alveolar', 'neutral', 'مثل «د» العربية', { voiced: true }),
    C('n', 'alveolar', 'neutral', 'مثل «ن» العربية', { voiced: true, nasal: true }),
    C('ŋ', 'velar', 'neutral', '«ن» من آخر الحلق — بلا «ك» ولا «ج» بعدها', { voiced: true, nasal: true }),
  ].map((a) => [a.ipa, a]),
);

/** Longest symbols first, so `iː` wins over `i` and `əʊ` over `ə`. */
const SYMBOLS = Object.keys(ARTICULATION).sort((a, b) => b.length - a.length);

/**
 * The drawable sounds mentioned in a label like "/ɪ/ vs /iː/",
 * "/θ/, /ð/ and the Endings" or "The Schwa /ə/" — in order, no repeats.
 * Only symbols written between slashes count, so the "e" in "Endings"
 * is never mistaken for /e/.
 */
export function soundsIn(text: string | null | undefined): Articulation[] {
  if (!text) return [];
  const found: Articulation[] = [];

  // A bare symbol on its own ("ə") is unambiguous too
  const bare = text.trim();
  if (ARTICULATION[bare]) return [ARTICULATION[bare]];

  for (const [, inner] of text.matchAll(/\/([^/]+)\//g)) {
    const sym = SYMBOLS.find((s) => inner.trim() === s);
    if (sym && !found.some((f) => f.ipa === sym)) found.push(ARTICULATION[sym]);
  }

  return found;
}
