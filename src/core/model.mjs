// The fontsketch data model: plain JSON friendly objects shared by the
// editor, the scanner and the compiler.
//
// Units per em are 1000 by default and the Y axis points UP (font
// convention). Canvas code must flip the Y axis when drawing.

/**
 * @typedef {{ x: number, y: number, on: boolean, type?: 'corner' | 'smooth' }} Point
 * Off curve points (`on: false`) are quadratic TrueType controls. Two off
 * curve points in a row imply an on curve point halfway between them.
 */

/**
 * @typedef {{ closed: boolean, points: Point[] }} Contour
 */

/**
 * @typedef {{ glyph: string, dx: number, dy: number, scale?: number }} Component
 */

/**
 * @typedef {{ x: number, y: number }} Anchor
 */

/**
 * @typedef {{
 *   stems?: { h?: Array<[number, number]>, v?: Array<[number, number]> },
 *   instructions?: Uint8Array,
 * }} GlyphHints
 */

/**
 * @typedef {{
 *   name: string,
 *   unicodes: number[],
 *   advanceWidth: number,
 *   contours: Contour[],
 *   components?: Component[],
 *   anchors?: Record<string, Anchor>,
 *   leftSideBearing?: number,
 *   hints?: GlyphHints,
 * }} Glyph
 * `anchors` is optional: `top`, `bottom` and `ogonek` on bases and `_top`,
 * `_bottom`, `_ogonek` on marks. `compose` uses them when present.
 */

/**
 * @typedef {{
 *   family: string,
 *   style: string,
 *   version: string,
 *   designer: string,
 *   license: string,
 *   unitsPerEm: number,
 *   ascender: number,
 *   descender: number,
 *   xHeight: number,
 *   capHeight: number,
 *   lineGap: number,
 *   weightClass?: number,
 *   italicAngle?: number,
 *   designerURL?: string,
 *   vendorURL?: string,
 *   licenseURL?: string,
 *   copyright?: string,
 *   description?: string,
 *   vendorID?: string,
 *   underlinePosition?: number,
 *   underlineThickness?: number,
 * }} FontMeta
 */

/**
 * @typedef {{ tag: string, name: string, min: number, default: number, max: number }} Axis
 */

/**
 * @typedef {{
 *   name: string,
 *   location: Record<string, number>,
 *   glyphs: Record<string, { contours: Contour[], advanceWidth?: number }>,
 * }} Master
 */

/**
 * @typedef {{
 *   pairs: Record<string, number>,
 *   classes: Record<string, string[]>,
 * }} Kerning
 * `pairs` keys are `left|right`. Either side may be a glyph name or a class
 * name starting with `@` that is defined in `classes`, for example
 * `{ pairs: { '@A|@V': -80 }, classes: { '@A': ['A', 'Aacute'], '@V': ['V', 'W'] } }`.
 */

/**
 * @typedef {{
 *   meta: FontMeta,
 *   glyphs: Record<string, Glyph>,
 *   kerning: Kerning,
 *   axes?: Axis[],
 *   masters?: Master[],
 *   instances?: Array<{ name: string, location: Record<string, number> }>,
 *   features: Record<string, unknown>,
 * }} Font
 */

/** @type {FontMeta} */
export const DEFAULT_META = Object.freeze({
  family: 'Untitled',
  style: 'Regular',
  version: '1.000',
  designer: '',
  license: '',
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
  xHeight: 500,
  capHeight: 700,
  lineGap: 0,
});

/**
 * Creates an empty font with a `.notdef` and a `space` glyph.
 * @param {Partial<FontMeta>} [meta]
 * @returns {Font}
 */
export function createFont(meta = {}) {
  const m = { ...DEFAULT_META, ...meta };
  /** @type {Font} */
  const font = { meta: m, glyphs: {}, kerning: { pairs: {}, classes: {} }, features: {} };
  addGlyph(font, notdefGlyph(m));
  addGlyph(font, { name: 'space', unicodes: [0x20], advanceWidth: Math.round(m.unitsPerEm / 4), contours: [] });
  return font;
}

/**
 * The conventional `.notdef` box glyph scaled to the font metrics.
 * @param {FontMeta} meta
 * @returns {Glyph}
 */
export function notdefGlyph(meta) {
  const upm = meta.unitsPerEm;
  const w = Math.round(upm * 0.5);
  const h = Math.round(meta.capHeight || upm * 0.7);
  const t = Math.max(1, Math.round(upm * 0.05));
  const m = Math.round(upm * 0.05);
  const rect = (x0, y0, x1, y1, cw) => ({
    closed: true,
    points: cw
      ? [{ x: x0, y: y0, on: true }, { x: x0, y: y1, on: true }, { x: x1, y: y1, on: true }, { x: x1, y: y0, on: true }]
      : [{ x: x0, y: y0, on: true }, { x: x1, y: y0, on: true }, { x: x1, y: y1, on: true }, { x: x0, y: y1, on: true }],
  });
  return {
    name: '.notdef',
    unicodes: [],
    advanceWidth: w,
    contours: [rect(m, 0, w - m, h, true), rect(m + t, t, w - m - t, h - t, false)],
  };
}

/**
 * Adds or replaces a glyph. Missing fields get defaults. Returns the stored glyph.
 * @param {Font} font
 * @param {Partial<Glyph> & { name: string }} glyph
 * @returns {Glyph}
 */
export function addGlyph(font, glyph) {
  if (!glyph || typeof glyph.name !== 'string' || !glyph.name) throw new TypeError('addGlyph: glyph.name is required');
  if (!isValidGlyphName(glyph.name)) throw new TypeError(`addGlyph: invalid glyph name "${glyph.name}"`);
  /** @type {Glyph} */
  const g = {
    ...glyph,
    name: glyph.name,
    unicodes: Array.isArray(glyph.unicodes) ? [...glyph.unicodes] : [],
    advanceWidth: Number.isFinite(glyph.advanceWidth) ? /** @type {number} */ (glyph.advanceWidth) : font.meta.unitsPerEm / 2,
    contours: Array.isArray(glyph.contours) ? glyph.contours : [],
  };
  if (!Array.isArray(glyph.unicodes)) {
    const u = unicodeFor(glyph.name);
    if (u !== undefined) g.unicodes = [u];
  }
  for (const u of g.unicodes) {
    if (!Number.isInteger(u) || u < 0 || u > 0x10ffff) throw new RangeError(`addGlyph: invalid code point ${u} in "${g.name}"`);
  }
  font.glyphs[g.name] = g;
  return g;
}

/**
 * Removes a glyph and every kerning pair that mentions it.
 * @param {Font} font
 * @param {string} name
 */
export function removeGlyph(font, name) {
  delete font.glyphs[name];
  for (const key of Object.keys(font.kerning.pairs)) {
    const [l, r] = key.split('|');
    if (l === name || r === name) delete font.kerning.pairs[key];
  }
  for (const members of Object.values(font.kerning.classes)) {
    const i = members.indexOf(name);
    if (i >= 0) members.splice(i, 1);
  }
}

/**
 * Glyph names valid in post tables and CFF charsets: up to 63 characters
 * from `A-Z a-z 0-9 . _ -`, not starting with a digit (except `.notdef`).
 * @param {string} name
 */
export function isValidGlyphName(name) {
  return name === '.notdef' || name === '.null' || /^[A-Za-z_.][A-Za-z0-9_.-]{0,62}$/.test(name);
}

// Production glyph names for the characters fontsketch knows best. Anything
// else becomes uniXXXX or uXXXXX, which every tool understands.
const NAMED = [
  [0x20, 'space exclam quotedbl numbersign dollar percent ampersand quotesingle parenleft parenright asterisk plus comma hyphen period slash zero one two three four five six seven eight nine colon semicolon less equal greater question at A B C D E F G H I J K L M N O P Q R S T U V W X Y Z bracketleft backslash bracketright asciicircum underscore grave a b c d e f g h i j k l m n o p q r s t u v w x y z braceleft bar braceright asciitilde'],
  [0xa0, 'uni00A0 exclamdown cent sterling currency yen brokenbar section dieresis copyright ordfeminine guillemotleft logicalnot uni00AD registered macron degree plusminus twosuperior threesuperior acute uni00B5 paragraph periodcentered cedilla onesuperior ordmasculine guillemotright onequarter onehalf threequarters questiondown Agrave Aacute Acircumflex Atilde Adieresis Aring AE Ccedilla Egrave Eacute Ecircumflex Edieresis Igrave Iacute Icircumflex Idieresis Eth Ntilde Ograve Oacute Ocircumflex Otilde Odieresis multiply Oslash Ugrave Uacute Ucircumflex Udieresis Yacute Thorn germandbls agrave aacute acircumflex atilde adieresis aring ae ccedilla egrave eacute ecircumflex edieresis igrave iacute icircumflex idieresis eth ntilde ograve oacute ocircumflex otilde odieresis divide oslash ugrave uacute ucircumflex udieresis yacute thorn ydieresis'],
  [0x100, 'Amacron amacron Abreve abreve Aogonek aogonek Cacute cacute Ccircumflex ccircumflex Cdotaccent cdotaccent Ccaron ccaron Dcaron dcaron Dcroat dcroat Emacron emacron Ebreve ebreve Edotaccent edotaccent Eogonek eogonek Ecaron ecaron Gcircumflex gcircumflex Gbreve gbreve Gdotaccent gdotaccent Gcommaaccent gcommaaccent Hcircumflex hcircumflex Hbar hbar Itilde itilde Imacron imacron Ibreve ibreve Iogonek iogonek Idotaccent dotlessi IJ ij Jcircumflex jcircumflex Kcommaaccent kcommaaccent kgreenlandic Lacute lacute Lcommaaccent lcommaaccent Lcaron lcaron Ldot ldot Lslash lslash Nacute nacute Ncommaaccent ncommaaccent Ncaron ncaron napostrophe Eng eng Omacron omacron Obreve obreve Ohungarumlaut ohungarumlaut OE oe Racute racute Rcommaaccent rcommaaccent Rcaron rcaron Sacute sacute Scircumflex scircumflex Scedilla scedilla Scaron scaron Tcedilla tcedilla Tcaron tcaron Tbar tbar Utilde utilde Umacron umacron Ubreve ubreve Uring uring Uhungarumlaut uhungarumlaut Uogonek uogonek Wcircumflex wcircumflex Ycircumflex ycircumflex Ydieresis Zacute zacute Zdotaccent zdotaccent Zcaron zcaron longs'],
  [0x192, 'florin'],
  [0x218, 'Scommaaccent scommaaccent Tcommaaccent tcommaaccent'],
  [0x237, 'dotlessj'],
  [0x2c6, 'circumflex caron'],
  [0x2d8, 'breve dotaccent ring ogonek tilde hungarumlaut'],
  [0x300, 'gravecomb acutecomb uni0302 tildecomb uni0304'],
  [0x306, 'uni0306 uni0307 uni0308'],
  [0x30a, 'uni030A uni030B uni030C'],
  [0x326, 'uni0326 uni0327 uni0328'],
  [0x2013, 'endash emdash'],
  [0x2018, 'quoteleft quoteright quotesinglbase'],
  [0x201c, 'quotedblleft quotedblright quotedblbase'],
  [0x2020, 'dagger daggerdbl bullet'],
  [0x2026, 'ellipsis'],
  [0x2030, 'perthousand'],
  [0x2039, 'guilsinglleft guilsinglright'],
  [0x2044, 'fraction'],
  [0x20ac, 'Euro'],
  [0x2122, 'trademark'],
  [0x2212, 'minus'],
];

/** @type {Map<number, string>} */
const NAME_BY_CODE = new Map();
/** @type {Map<string, number>} */
const CODE_BY_NAME = new Map();
for (const [start, names] of NAMED) {
  names.split(' ').forEach((name, i) => {
    NAME_BY_CODE.set(/** @type {number} */ (start) + i, name);
    if (!name.startsWith('uni')) CODE_BY_NAME.set(name, /** @type {number} */ (start) + i);
  });
}
// Legacy and alternative names that should still map to a code point.
for (const [name, code] of [
  ['nbspace', 0xa0], ['softhyphen', 0xad], ['mu', 0xb5], ['middot', 0xb7], ['guillemetleft', 0xab],
  ['guillemetright', 0xbb], ['Dslash', 0x110], ['dslash', 0x111], ['Gcedilla', 0x122], ['gcedilla', 0x123],
  ['Kcedilla', 0x136], ['kcedilla', 0x137], ['Lcedilla', 0x13b], ['lcedilla', 0x13c], ['Ncedilla', 0x145],
  ['ncedilla', 0x146], ['Rcedilla', 0x156], ['rcedilla', 0x157], ['Ldotaccent', 0x13f], ['ldotaccent', 0x140],
  ['Edot', 0x116], ['edot', 0x117], ['Gdot', 0x120], ['gdot', 0x121], ['Zdot', 0x17b], ['zdot', 0x17c],
  ['Cdot', 0x10a], ['cdot', 0x10b], ['Idot', 0x130], ['Odblacute', 0x150], ['odblacute', 0x151],
  ['Udblacute', 0x170], ['udblacute', 0x171], ['commaaccentcomb', 0x326], ['cedillacomb', 0x327], ['ogonekcomb', 0x328],
  ['dieresiscomb', 0x308], ['circumflexcomb', 0x302], ['macroncomb', 0x304], ['brevecomb', 0x306],
  ['dotaccentcomb', 0x307], ['ringcomb', 0x30a], ['hungarumlautcomb', 0x30b], ['caroncomb', 0x30c],
]) CODE_BY_NAME.set(/** @type {string} */ (name), /** @type {number} */ (code));

/**
 * Production glyph name for a character, for example `a`, `Atilde`, `space`
 * or `uni0416`. Accepts a one character string or a code point.
 * @param {string | number} char
 * @returns {string}
 */
export function glyphNameFor(char) {
  const code = typeof char === 'number' ? char : /** @type {number} */ (String(char).codePointAt(0));
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) throw new RangeError(`glyphNameFor: invalid character ${char}`);
  const named = NAME_BY_CODE.get(code);
  if (named) return named;
  const hex = code.toString(16).toUpperCase();
  return code <= 0xffff ? `uni${hex.padStart(4, '0')}` : `u${hex.padStart(5, '0')}`;
}

/**
 * Code point for a glyph name, or `undefined` for names without one (such as
 * `.notdef` or `a.alt`). Understands production names, `uniXXXX` and `uXXXXX`.
 * @param {string} name
 * @returns {number | undefined}
 */
export function unicodeFor(name) {
  const known = CODE_BY_NAME.get(name);
  if (known !== undefined) return known;
  let m = /^uni([0-9A-F]{4})$/.exec(name);
  if (m) return parseInt(m[1], 16);
  m = /^u([0-9A-F]{4,6})$/.exec(name);
  if (m) {
    const v = parseInt(m[1], 16);
    if (v <= 0x10ffff) return v;
  }
  return undefined;
}

/** Deep clone of a font (typed arrays are copied). @param {Font} font @returns {Font} */
export function cloneFont(font) {
  return deserialize(serialize(font));
}

const FORMAT = 'fontsketch';
const FORMAT_VERSION = 1;

/**
 * Serializes a font to the `.fontsketch.json` project format (a JSON string).
 * Typed arrays such as hint instructions are stored as base64.
 * @param {Font} font
 * @returns {string}
 */
export function serialize(font) {
  return JSON.stringify(
    { format: FORMAT, version: FORMAT_VERSION, font },
    (_key, value) => (value instanceof Uint8Array ? { $bytes: toBase64(value) } : value),
  );
}

/**
 * Reads a `.fontsketch.json` project (string or parsed object) back into a
 * font, filling defaults for anything missing.
 * @param {string | object} json
 * @returns {Font}
 */
export function deserialize(json) {
  const data = typeof json === 'string' ? JSON.parse(json, reviveBytes) : JSON.parse(JSON.stringify(json), reviveBytes);
  const raw = data && data.format === FORMAT ? data.font : data;
  if (!raw || typeof raw !== 'object' || !raw.glyphs) throw new TypeError('deserialize: not a fontsketch project');
  if (data.format === FORMAT && data.version > FORMAT_VERSION) {
    throw new RangeError(`deserialize: project version ${data.version} is newer than this fontsketch understands`);
  }
  /** @type {Font} */
  const font = {
    meta: { ...DEFAULT_META, ...(raw.meta || {}) },
    glyphs: {},
    kerning: { pairs: { ...(raw.kerning?.pairs || {}) }, classes: { ...(raw.kerning?.classes || {}) } },
    features: raw.features || {},
  };
  if (Array.isArray(raw.axes) && raw.axes.length) font.axes = raw.axes;
  if (Array.isArray(raw.masters) && raw.masters.length) font.masters = raw.masters;
  if (Array.isArray(raw.instances) && raw.instances.length) font.instances = raw.instances;
  for (const [name, g] of Object.entries(raw.glyphs)) addGlyph(font, { ...g, name: g.name || name });
  return font;
}

function reviveBytes(_key, value) {
  return value && typeof value === 'object' && typeof value.$bytes === 'string' ? fromBase64(value.$bytes) : value;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** @param {Uint8Array} bytes */
export function toBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

/** @param {string} text */
export function fromBase64(text) {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) |
      ((clean[i + 2] ? B64.indexOf(clean[i + 2]) : 0) << 6) | (clean[i + 3] ? B64.indexOf(clean[i + 3]) : 0);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

/**
 * Checks a font for problems the compiler would reject. Returns a list of
 * human readable messages (empty when the font is fine).
 * @param {Font} font
 * @returns {string[]}
 */
export function validateFont(font) {
  const problems = [];
  if (!font || !font.meta || !font.glyphs) return ['not a font object'];
  const { meta } = font;
  if (!meta.family || !String(meta.family).trim()) problems.push('meta.family is empty');
  if (!(meta.unitsPerEm >= 16 && meta.unitsPerEm <= 16384)) problems.push('meta.unitsPerEm must be between 16 and 16384');
  if (!(meta.ascender > meta.descender)) problems.push('meta.ascender must be above meta.descender');
  const seen = new Map();
  for (const [key, g] of Object.entries(font.glyphs)) {
    if (g.name !== key) problems.push(`glyph key "${key}" does not match its name "${g.name}"`);
    if (!isValidGlyphName(g.name)) problems.push(`invalid glyph name "${g.name}"`);
    if (!Number.isFinite(g.advanceWidth) || g.advanceWidth < 0) problems.push(`glyph "${g.name}" has an invalid advanceWidth`);
    for (const u of g.unicodes || []) {
      if (seen.has(u)) problems.push(`U+${u.toString(16).toUpperCase().padStart(4, '0')} is mapped by both "${seen.get(u)}" and "${g.name}"`);
      else seen.set(u, g.name);
    }
    (g.contours || []).forEach((c, ci) => {
      if (!c || !Array.isArray(c.points)) problems.push(`glyph "${g.name}" contour ${ci} has no points array`);
      else for (const p of c.points) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
          problems.push(`glyph "${g.name}" contour ${ci} has a point with a non numeric coordinate`);
          break;
        }
      }
    });
    for (const comp of g.components || []) {
      if (!font.glyphs[comp.glyph]) problems.push(`glyph "${g.name}" uses missing component "${comp.glyph}"`);
    }
  }
  return problems;
}
