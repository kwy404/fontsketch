// Character sets offered by the glyph grid, the handwriting template and the
// accent builder. Every entry is a plain string of characters; the grid maps
// each character to its production glyph name with glyphNameFor().

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i)).join('');

export const UPPER = range(0x41, 0x5a);
export const LOWER = range(0x61, 0x7a);
export const DIGITS = range(0x30, 0x39);
export const PUNCT = ' .,;:!?\'"-()[]{}/\\@#$%&*+=<>_~^`|';
export const PT_ACCENTS = '\u00c1\u00c0\u00c2\u00c3\u00c9\u00ca\u00cd\u00d3\u00d4\u00d5\u00da\u00dc\u00c7\u00e1\u00e0\u00e2\u00e3\u00e9\u00ea\u00ed\u00f3\u00f4\u00f5\u00fa\u00fc\u00e7';
/** Marks used to build accented letters from components. */
export const MARKS = '\u00b4`\u02c6\u02dc\u00a8\u00b8\u02c7\u02d8\u02da\u00af\u02d9';
export const LATIN1 = range(0xc0, 0xff).replace('\u00d7', '').replace('\u00f7', '');
export const EXTRA_PUNCT = '\u00a1\u00bf\u00ab\u00bb\u2018\u2019\u201c\u201d\u2026\u2022\u00b7\u20ac\u00a3\u00a9\u00ae\u00b0';

export const CHARSETS = [
  { id: 'basic', label: 'Basic Latin', chars: UPPER + LOWER + DIGITS + PUNCT },
  { id: 'letters', label: 'Letters only', chars: UPPER + LOWER },
  { id: 'pt', label: 'Portuguese (Basic Latin + accents)', chars: UPPER + LOWER + DIGITS + PUNCT + PT_ACCENTS + MARKS },
  { id: 'latin1', label: 'Western European (Latin-1)', chars: UPPER + LOWER + DIGITS + PUNCT + LATIN1 + MARKS + EXTRA_PUNCT },
  { id: 'digits', label: 'Digits and punctuation', chars: DIGITS + PUNCT },
  { id: 'custom', label: 'Custom', chars: '' },
];

/** Characters for a charset id plus optional custom characters, deduplicated, in order. */
export function charsFor(id, custom = '') {
  const set = CHARSETS.find((c) => c.id === id) || CHARSETS[0];
  const seen = new Set();
  const out = [];
  for (const ch of set.chars + custom) {
    if (!seen.has(ch)) {
      seen.add(ch);
      out.push(ch);
    }
  }
  return out;
}

/** Template groups for the handwriting sheet: what to ask the writer for. */
export const SHEET_SETS = [
  { id: 'upper-lower', label: 'Uppercase and lowercase', chars: UPPER + LOWER },
  { id: 'full', label: 'Letters, digits and punctuation', chars: UPPER + LOWER + DIGITS + '.,;:!?\'"-()&@' },
  { id: 'pt', label: 'Portuguese: letters, digits, accents', chars: UPPER + LOWER + DIGITS + '.,;:!?-()' + '\u00e1\u00e0\u00e2\u00e3\u00e9\u00ea\u00ed\u00f3\u00f4\u00f5\u00fa\u00e7\u00c7' },
  { id: 'lower', label: 'Lowercase only', chars: LOWER },
];

/** Sample texts for the preview. */
export const SAMPLES = {
  pangram: 'The quick brown fox jumps over the lazy dog',
  pt: 'Jovem craque belga prima por whisky de fava',
  alphabet: UPPER + '\n' + LOWER + '\n' + DIGITS,
  paragraph:
    'Every typeface begins as a handful of marks on paper. Spacing turns those marks into words, kerning turns words into a texture, and a texture is what the reader finally sees. Set a few lines, step back, and look at the grey of the page: dark spots mean a pair is too tight, holes mean it is too loose.',
};
