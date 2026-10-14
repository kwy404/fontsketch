// Accented letters built from a base glyph and mark glyphs (components),
// placed with anchors when the glyphs have them and with metric based
// defaults otherwise. Covers Latin-1 Supplement and Latin Extended-A,
// including every letter Portuguese needs.

import { addGlyph, glyphNameFor } from './model.mjs';

/** Mark glyph candidates for each combining mark, most specific first. */
const MARKS = {
  0x300: ['grave', 'gravecomb'],
  0x301: ['acute', 'acutecomb'],
  0x302: ['circumflex', 'uni0302', 'circumflexcomb'],
  0x303: ['tilde', 'tildecomb'],
  0x304: ['macron', 'uni0304', 'macroncomb'],
  0x306: ['breve', 'uni0306', 'brevecomb'],
  0x307: ['dotaccent', 'uni0307', 'dotaccentcomb'],
  0x308: ['dieresis', 'uni0308', 'dieresiscomb'],
  0x30a: ['ring', 'uni030A', 'ringcomb'],
  0x30b: ['hungarumlaut', 'uni030B', 'hungarumlautcomb'],
  0x30c: ['caron', 'uni030C', 'caroncomb'],
  0x326: ['commaaccent', 'uni0326', 'commaaccentcomb'],
  0x327: ['cedilla', 'uni0327', 'cedillacomb'],
  0x328: ['ogonek', 'uni0328', 'ogonekcomb'],
};
const BELOW = new Set([0x326, 0x327, 0x328]);
/** Letters whose "cedilla" is drawn as a comma below. */
const COMMA_BELOW = new Set([0x122, 0x136, 0x137, 0x13b, 0x13c, 0x145, 0x146, 0x156, 0x157]);
/** Letters whose caron is drawn as a vertical apostrophe. */
const CARON_ALT = new Set([0x10f, 0x13d, 0x13e, 0x165]);

/** Every character `compose` can build in Latin-1 Supplement and Latin Extended-A. */
export const COMPOSABLE = (() => {
  const out = [];
  for (let c = 0xc0; c <= 0x17f; c++) {
    if (c === 0xd7 || c === 0xf7) continue;
    if (decompose(c)) out.push(c);
  }
  return out;
})();

/** Accented letters needed for Portuguese (upper and lower case). */
export const PORTUGUESE = [...'áàâãçéêíóôõúü'].flatMap((c) => [c, c.toUpperCase()]);

/**
 * Base and marks for a code point, or null.
 * @param {number} code
 * @returns {{ base: string, marks: number[], special?: string } | null}
 */
export function decompose(code) {
  const special = {
    0x13f: { base: 'L', marks: [], special: 'middot' },
    0x140: { base: 'l', marks: [], special: 'middot' },
    0x149: { base: 'n', marks: [], special: 'apostrophe' },
    0x132: { base: 'I', marks: [], special: 'pair:J' },
    0x133: { base: 'i', marks: [], special: 'pair:j' },
  }[code];
  if (special) return special;
  const nfd = String.fromCodePoint(code).normalize('NFD');
  const chars = [...nfd];
  if (chars.length < 2) return null;
  const base = /** @type {number} */ (chars[0].codePointAt(0));
  const marks = chars.slice(1).map((c) => /** @type {number} */ (c.codePointAt(0)));
  if (!marks.every((m) => m in MARKS)) return null;
  return { base: glyphNameFor(base), marks };
}

/**
 * @param {import('./model.mjs').Font} font
 * @param {string} name
 */
function outlineBox(font, name, depth = 0) {
  const g = font.glyphs[name];
  if (!g || depth > 8) return null;
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  const add = (x, y) => {
    xMin = Math.min(xMin, x);
    xMax = Math.max(xMax, x);
    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);
  };
  for (const c of g.contours || []) for (const p of c.points) add(p.x, p.y);
  for (const comp of g.components || []) {
    const b = outlineBox(font, comp.glyph, depth + 1);
    if (!b) continue;
    const s = comp.scale ?? 1;
    add(b.xMin * s + comp.dx, b.yMin * s + comp.dy);
    add(b.xMax * s + comp.dx, b.yMax * s + comp.dy);
  }
  return xMin === Infinity ? null : { xMin, yMin, xMax, yMax };
}

/** Creates `dotlessi` / `dotlessj` from `i` / `j` by dropping the dot. */
function ensureDotless(font, name) {
  if (font.glyphs[name]) return name;
  const src = name === 'dotlessi' ? 'i' : 'j';
  const g = font.glyphs[src];
  if (!g || !g.contours?.length) return null;
  const xh = font.meta.xHeight;
  const kept = g.contours.filter((c) => Math.min(...c.points.map((p) => p.y)) < xh * 0.9);
  if (!kept.length || kept.length === g.contours.length) return null;
  addGlyph(font, {
    name,
    unicodes: [name === 'dotlessi' ? 0x131 : 0x237],
    advanceWidth: g.advanceWidth,
    contours: kept.map((c) => ({ ...c, points: c.points.map((p) => ({ ...p })) })),
  });
  return name;
}

/**
 * Builds an accented glyph from components, for example `compose(font, 'ã')`
 * makes `atilde` from `a` and `tilde`. Uses `top`/`bottom`/`ogonek` anchors
 * on the base and `_top`/`_bottom`/`_ogonek` anchors on the mark when they
 * exist; otherwise marks drawn for lowercase are raised by the base height
 * above the x-height and centred on the base. For `i` and `j` the dotless
 * forms are used (and derived from `i`/`j` when missing). Uppercase letters
 * prefer `.cap` mark variants such as `acute.cap`.
 * @param {import('./model.mjs').Font} font
 * @param {string | number} accentedChar
 * @returns {import('./model.mjs').Glyph}
 */
export function compose(font, accentedChar) {
  const code = typeof accentedChar === 'number' ? accentedChar : /** @type {number} */ (String(accentedChar).codePointAt(0));
  const hex = `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
  const plan = decompose(code);
  if (!plan) throw new Error(`compose: ${hex} has no base plus mark decomposition; draw it directly`);
  let baseName = plan.base;
  const hasTopMark = plan.marks.some((m) => !BELOW.has(m));
  if (hasTopMark && (baseName === 'i' || baseName === 'j')) {
    const dotless = ensureDotless(font, baseName === 'i' ? 'dotlessi' : 'dotlessj');
    if (!dotless) throw new Error(`compose: ${hex} needs "${baseName === 'i' ? 'dotlessi' : 'dotlessj'}" (or an "${baseName}" whose dot is a separate contour)`);
    baseName = dotless;
  }
  const base = font.glyphs[baseName];
  if (!base) throw new Error(`compose: ${hex} needs the base glyph "${baseName}"`);
  const baseBox = outlineBox(font, baseName) || { xMin: 0, yMin: 0, xMax: base.advanceWidth, yMax: font.meta.xHeight };
  const upper = /\p{Lu}/u.test(String.fromCodePoint(code));
  const xh = font.meta.xHeight;
  /** @type {import('./model.mjs').Component[]} */
  const components = [{ glyph: baseName, dx: 0, dy: 0 }];
  let advance = base.advanceWidth;

  if (plan.special) {
    if (plan.special === 'middot') {
      const dot = ['periodcentered', 'uni00B7'].find((n) => font.glyphs[n]);
      if (!dot) throw new Error(`compose: ${hex} needs "periodcentered"`);
      const db = outlineBox(font, dot);
      components.push({ glyph: dot, dx: Math.round(baseBox.xMax - (db ? db.xMin : 0) + font.meta.unitsPerEm * 0.02), dy: 0 });
      advance = Math.round(base.advanceWidth + (db ? db.xMax - db.xMin : 0) + font.meta.unitsPerEm * 0.04);
    } else if (plan.special === 'apostrophe') {
      const ap = ['quoteright', 'quotesingle'].find((n) => font.glyphs[n]);
      if (!ap) throw new Error(`compose: ${hex} needs "quoteright"`);
      const w = font.glyphs[ap].advanceWidth;
      components[0] = { glyph: ap, dx: 0, dy: 0 };
      components.push({ glyph: baseName, dx: Math.round(w), dy: 0 });
      advance = Math.round(w + base.advanceWidth);
    } else {
      const second = plan.special.slice(5);
      if (!font.glyphs[second]) throw new Error(`compose: ${hex} needs "${second}"`);
      components.push({ glyph: second, dx: Math.round(base.advanceWidth), dy: 0 });
      advance = Math.round(base.advanceWidth + font.glyphs[second].advanceWidth);
    }
  } else {
    let topY = null;
    for (const m of plan.marks) {
      let candidates = MARKS[m];
      const turnedAbove = code === 0x123 && ['uni0312', 'commaturnedabovecomb'].some((n) => font.glyphs[n]);
      if (turnedAbove) candidates = ['uni0312', 'commaturnedabovecomb'];
      else if (m === 0x327 && (COMMA_BELOW.has(code) || code === 0x123)) candidates = [...MARKS[0x326], ...candidates];
      if (m === 0x30c && CARON_ALT.has(code)) candidates = ['caron.alt', 'caronvertical', 'quoteright', ...candidates];
      const options = upper ? [...candidates.map((n) => `${n}.cap`), ...candidates] : candidates;
      const markName = options.find((n) => font.glyphs[n]);
      if (!markName) throw new Error(`compose: ${hex} needs a mark glyph (one of ${candidates.join(', ')})`);
      const mark = font.glyphs[markName];
      const markBox = outlineBox(font, markName) || { xMin: 0, yMin: 0, xMax: mark.advanceWidth, yMax: 0 };
      const below = BELOW.has(m) && !turnedAbove;
      const kind = m === 0x328 ? 'ogonek' : below ? 'bottom' : 'top';
      const isAltCaron = m === 0x30c && CARON_ALT.has(code) && !MARKS[0x30c].includes(markName.replace(/\.cap$/, ''));
      let baseAnchor = base.anchors?.[kind] || (kind === 'ogonek' ? base.anchors?.bottom : undefined);
      let markAnchor = mark.anchors?.[`_${kind}`] || (kind === 'ogonek' ? mark.anchors?._bottom : undefined);
      if (kind === 'top' && topY !== null) baseAnchor = { x: baseAnchor ? baseAnchor.x : (baseBox.xMin + baseBox.xMax) / 2, y: topY };
      if (!baseAnchor) {
        if (kind === 'top') baseAnchor = { x: (baseBox.xMin + baseBox.xMax) / 2, y: Math.max(baseBox.yMax, xh) };
        else if (kind === 'ogonek') baseAnchor = { x: baseBox.xMax, y: 0 };
        else baseAnchor = { x: (baseBox.xMin + baseBox.xMax) / 2, y: 0 };
      }
      if (!markAnchor) {
        if (kind === 'top') markAnchor = { x: (markBox.xMin + markBox.xMax) / 2, y: topY !== null ? markBox.yMin - font.meta.unitsPerEm * 0.03 : xh };
        else if (kind === 'ogonek') markAnchor = { x: markBox.xMax, y: 0 };
        else markAnchor = { x: (markBox.xMin + markBox.xMax) / 2, y: 0 };
      }
      let dx = baseAnchor.x - markAnchor.x;
      let dy = baseAnchor.y - markAnchor.y;
      if (isAltCaron) {
        // Vertical caron sits to the right of the ascender (d, l, t, L).
        dx = baseBox.xMax - markBox.xMin + font.meta.unitsPerEm * 0.02;
        dy = Math.max(0, baseBox.yMax - markBox.yMax);
        advance = Math.max(advance, Math.round(dx + markBox.xMax + font.meta.unitsPerEm * 0.02));
      }
      components.push({ glyph: markName, dx: Math.round(dx), dy: Math.round(dy) });
      if (kind === 'top') topY = markBox.yMax + Math.round(dy) + font.meta.unitsPerEm * 0.03;
    }
  }
  return addGlyph(font, {
    name: glyphNameFor(code),
    unicodes: [code],
    advanceWidth: advance,
    contours: [],
    components,
  });
}

/**
 * Composes every accented letter that the font has the parts for.
 * @param {import('./model.mjs').Font} font
 * @param {{ chars?: Array<string | number>, overwrite?: boolean }} [options]
 * @returns {{ created: string[], skipped: Array<{ char: string, reason: string }> }}
 */
export function composeAll(font, options = {}) {
  const list = options.chars ? options.chars.map((c) => (typeof c === 'number' ? c : /** @type {number} */ (String(c).codePointAt(0)))) : COMPOSABLE;
  const created = [];
  const skipped = [];
  for (const code of list) {
    const name = glyphNameFor(code);
    const existing = font.glyphs[name];
    if (existing && !options.overwrite && existing.contours.length) {
      skipped.push({ char: String.fromCodePoint(code), reason: 'already drawn' });
      continue;
    }
    try {
      compose(font, code);
      created.push(name);
    } catch (err) {
      skipped.push({ char: String.fromCodePoint(code), reason: /** @type {Error} */ (err).message });
    }
  }
  return { created, skipped };
}
