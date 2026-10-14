// Character sets offered by the handwriting template. Accented letters are
// written as escapes so the source stays plain ASCII.

const range = (a, b) => {
  let s = '';
  for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) s += String.fromCharCode(c);
  return s;
};

/** Named character sets for `createTemplate({ chars })`. */
export const CHARSETS = Object.freeze({
  lowercase: range('a', 'z'),
  uppercase: range('A', 'Z'),
  digits: range('0', '9'),
  punctuation: '.,;:!?\'"-()[]/&@#%*+=<>_$',
  /** Every printable Basic Latin character except space. */
  basicLatin: range('!', '~'),
  /** Accented letters used in Portuguese. */
  portuguese: 'áàâãéêíóôõúüç' +
    'ÁÀÂÃÉÊÍÓÔÕÚÜÇ',
  /** A compact everyday set: letters, digits and the most used punctuation. */
  essential: range('a', 'z') + range('A', 'Z') + range('0', '9') + '.,;:!?\'"-()/&@',
});

/**
 * Resolves a chars option into a list of unique characters (code point safe).
 * Accepts a string of characters, a named set, or an array mixing both, for
 * example `['basicLatin', 'portuguese']` or `'abc'`. A string that exactly
 * matches a set name is treated as that set; prefix a custom string with `=`
 * to force it literally.
 * @param {string | string[] | undefined} chars
 * @returns {string[]}
 */
export function resolveChars(chars) {
  const parts = chars === undefined ? ['essential'] : Array.isArray(chars) ? chars : [chars];
  const seen = new Set();
  const out = [];
  for (const part of parts) {
    let text = String(part);
    if (Object.prototype.hasOwnProperty.call(CHARSETS, text)) text = CHARSETS[text];
    else if (text.startsWith('=')) text = text.slice(1);
    for (const ch of text) {
      if (/\s/.test(ch) || seen.has(ch)) continue;
      seen.add(ch);
      out.push(ch);
    }
  }
  return out;
}

// Vertical class of a character: where its ink is expected to sit relative to
// the font metrics. Used for single glyph imports and row baseline fitting.
const ASCENDERS = 'bdfhklt';
const DESCENDERS = 'gjpqy';
const TALL_PUNCT = '!?\'"()[]{}/\\|&@#%$';

/**
 * Expected vertical extent of a character as names of metric lines.
 * @param {string} ch
 * @returns {{ top: 'xHeight' | 'capHeight' | 'ascender' | 'mid', bottom: 'baseline' | 'descender' | 'mid' }}
 */
export function verticalClass(ch) {
  const base = ch.normalize('NFD')[0] || ch;
  const bottom = DESCENDERS.includes(base) || base === 'Q' || base === '(' || base === ')' || base === '[' || base === ']' || base === ',' || base === ';'
    ? 'descender'
    : base === '-' || base === '=' || base === '+' || base === '*' || base === '~'
      ? 'mid'
      : 'baseline';
  let top;
  if (/[A-Z0-9]/.test(base) || TALL_PUNCT.includes(base)) top = 'capHeight';
  else if (ASCENDERS.includes(base)) top = 'ascender';
  else if (base === '-' || base === '=' || base === '+' || base === '*' || base === '~' || base === '.' || base === ',' || base === '_') top = 'mid';
  else if (base === 'i' || base === 'j') top = 'ascender';
  else top = 'xHeight';
  return { top, bottom };
}
