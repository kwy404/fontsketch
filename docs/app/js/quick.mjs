// Quick font: draw only the most used letters and let the editor finish the
// rest. finishQuick() turns a font with hand drawn lowercase letters into a
// usable font: capitals from your lowercase (unless you drew them), digits,
// punctuation and marks from the style template, accented letters composed
// from base and mark, and even spacing. Pure functions, no DOM.
import { inkBounds, matrix, resolve, status, transformContours } from './geom.mjs';
import { DIGITS, EXTRA_PUNCT, LATIN1, LOWER, PUNCT, UPPER } from './charsets.mjs';
import { cellsFromContours, cellsToContours, pixelate, snapComponents, stretchCells } from './pixel.mjs';
import { autoBearings } from './panels/spacing.mjs';

/** The three style templates. `template` is a template id from panels/templates.mjs. */
export const STYLES = [
  {
    id: 'script',
    name: 'Script',
    note: 'Flowing handwriting from a tapered brush pen',
    template: 'quill-hand',
    family: 'My Script',
    sample: 'abc',
    brush: { shape: 'round', size: 80, smoothing: 60, taper: 55, pressure: true, preset: 'brushpen' },
    spacing: 55,
  },
  {
    id: 'block',
    name: 'Block',
    note: 'Bold, even strokes for posters and titles',
    template: 'geometric',
    family: 'My Block',
    sample: 'abc',
    brush: { shape: 'round', size: 150, smoothing: 55, taper: 0, pressure: false, preset: 'heavy' },
    spacing: 70,
  },
  {
    id: 'pixel',
    name: 'Pixel',
    note: 'Square cells on a grid, like an old video game',
    template: 'pixel',
    family: 'My Pixel',
    sample: 'abc',
    brush: { shape: 'pixel', size: 100, smoothing: 0, taper: 0, pressure: false, preset: 'pixel' },
    pixel: 100,
  },
];
export const styleById = (id) => STYLES.find((s) => s.id === id) || STYLES[0];

/** Letters quick mode asks for, in order. */
export function quickQueue({ capitals = false } = {}) {
  return [...LOWER, ...(capitals ? UPPER : '')];
}

/** Spacing marks and combining marks that accented letters are built from. */
const MARK_GLYPHS = [
  'grave', 'gravecomb', 'acute', 'acutecomb', 'circumflex', 'uni0302', 'circumflexcomb', 'tilde', 'tildecomb',
  'macron', 'uni0304', 'macroncomb', 'breve', 'uni0306', 'brevecomb', 'dotaccent', 'uni0307', 'dotaccentcomb',
  'dieresis', 'uni0308', 'dieresiscomb', 'ring', 'uni030A', 'ringcomb', 'caron', 'uni030C', 'caroncomb',
  'cedilla', 'uni0327', 'cedillacomb',
];
const SPACING_MARKS = '\u00b4\u02c6\u02dc\u00a8\u02da\u00b8\u02c7\u00af\u02d8\u02d9';

/** Characters copied from the style template when you have not drawn them. */
export const FILL_CHARS = [...new Set([...DIGITS, ...PUNCT.replace(' ', ''), ...EXTRA_PUNCT, ...SPACING_MARKS])];

/** Accented letters quick mode builds (Latin-1, which covers Portuguese, Spanish, French and German). */
export const QUICK_ACCENTS = [...LATIN1].filter((ch) => ch.normalize('NFD').length > 1);

const drawn = (g) => !!g && status(g) === 'drawn';
const roundAll = (cs) => cs.map((c) => ({ ...c, points: c.points.map((p) => ({ ...p, x: Math.round(p.x), y: Math.round(p.y) })) }));

/**
 * Finishes a quick font in place.
 * @param {any} font the font being edited
 * @param {any} core the fontsketch core
 * @param {{ source?: any, pixel?: number, spacing?: number }} [options]
 *   `source` is the style template font, `pixel` the cell size for pixel
 *   fonts (0 for outlines), `spacing` the side bearing base in units per 1000.
 * @returns {{ drawn: string[], capitals: string[], filled: string[], composed: string[], missing: string[] }}
 */
export function finishQuick(font, core, { source = null, pixel = 0, spacing = 60 } = {}) {
  const m = font.meta;
  const nameOf = (ch) => core.glyphNameFor(ch);
  const report = { drawn: [], capitals: [], filled: [], composed: [], missing: [] };
  report.drawn = [...LOWER, ...UPPER, ...DIGITS].filter((ch) => drawn(font.glyphs[nameOf(ch)]));

  // 1. Capitals you did not draw come from your lowercase, raised to the cap height.
  for (const up of UPPER) {
    if (drawn(font.glyphs[up])) continue;
    const from = up === 'I' && drawn(font.glyphs.l) ? font.glyphs.l : font.glyphs[up.toLowerCase()];
    if (!drawn(from)) continue;
    let contours;
    let advance = from.advanceWidth;
    if (pixel) {
      // Pixel letters grow by whole rows so the strokes stay one cell thick.
      const cells = cellsFromContours(from.contours, pixel);
      const rows = Math.max(...[...cells].map((k) => +k.split(',')[1])) + 1;
      contours = cellsToContours(stretchCells(cells, Math.round(m.capHeight / pixel) - rows), pixel);
    } else {
      const ib = inkBounds(from.contours);
      const s = Math.min(m.capHeight / m.xHeight, Math.max(1, m.capHeight / Math.max(1, ib.yMax)));
      contours = roundAll(transformContours(from.contours, [s, 0, 0, s, 0, 0]));
      advance = Math.round(from.advanceWidth * s);
    }
    core.addGlyph(font, { name: up, unicodes: [up.codePointAt(0)], advanceWidth: advance, contours });
    report.capitals.push(up);
  }

  // 2. Even spacing for every letter drawn by hand (or raised from one).
  const base = Math.round((spacing / 1000) * m.unitsPerEm);
  for (const ch of [...report.drawn, ...report.capitals]) spaceGlyph(font, font.glyphs[nameOf(ch)], base, pixel);
  if (pixel && font.glyphs.space) font.glyphs.space.advanceWidth = 3 * pixel;

  // 3. Digits, punctuation and marks from the style template.
  if (source) {
    const s = m.capHeight / (source.meta.capHeight || m.capHeight);
    const cmap = new Map();
    for (const g of Object.values(source.glyphs)) for (const u of g.unicodes || []) if (!cmap.has(u)) cmap.set(u, g);
    const copy = (name, theirs, unicodes) => {
      if (drawn(font.glyphs[name]) || !theirs) return false;
      let contours = roundAll(transformContours(resolve(source, theirs), [s, 0, 0, s, 0, 0]));
      if (!contours.length) return false;
      if (pixel && s !== 1) contours = pixelate(contours, pixel);
      core.addGlyph(font, { name, unicodes, advanceWidth: Math.round(theirs.advanceWidth * s), contours });
      if (theirs.anchors) {
        font.glyphs[name].anchors = Object.fromEntries(Object.entries(theirs.anchors).map(([k, a]) => [k, { x: Math.round(a.x * s), y: Math.round(a.y * s) }]));
      }
      return true;
    };
    const marks = new Set(MARK_GLYPHS.flatMap((n) => [n, `${n}.cap`]));
    const copiedMarks = [];
    for (const ch of FILL_CHARS) {
      const code = ch.codePointAt(0);
      if (copy(nameOf(ch), cmap.get(code), [code])) {
        report.filled.push(ch);
        if (marks.has(nameOf(ch))) copiedMarks.push(nameOf(ch));
      }
    }
    for (const name of marks) {
      const theirs = source.glyphs[name];
      if (theirs && !font.glyphs[name] && copy(name, theirs, theirs.unicodes || [])) copiedMarks.push(name);
    }
    // Marks sit above your letters, not on the template's: their own anchors
    // go, and a mark that would dip into the x-height is raised clear of it.
    const clear = m.xHeight + Math.round(m.unitsPerEm * 0.05);
    for (const name of copiedMarks) {
      const g = font.glyphs[name];
      delete g.anchors;
      if (/cedilla|uni0327|ogonek|uni0328|commaaccent|uni0326/.test(name)) continue;
      const ib = inkBounds(g.contours);
      if (!ib || ib.yMin >= clear) continue;
      let up = clear - ib.yMin;
      if (pixel) up = Math.ceil(up / pixel) * pixel;
      g.contours = roundAll(transformContours(g.contours, matrix.translate(0, up)));
    }
  }

  // 4. Accented letters from base letter and mark.
  const todo = QUICK_ACCENTS.filter((ch) => !drawn(font.glyphs[nameOf(ch)]));
  const { created, skipped } = core.composeAll(font, { chars: todo });
  if (pixel) snapComponents(font, created, pixel);
  report.composed = created.map((n) => String.fromCodePoint(font.glyphs[n].unicodes[0]));
  report.missing = skipped.map((x) => x.char);
  return report;
}

/** Sets side bearings from the letter's shape (whole cells for pixel fonts). */
export function spaceGlyph(font, g, base, pixel = 0) {
  if (!g) return;
  const contours = resolve(font, g);
  const ib = inkBounds(contours);
  if (!ib) return;
  let lsb;
  let rsb;
  if (pixel) {
    lsb = 0;
    rsb = pixel;
  } else {
    const sb = autoBearings(contours, font.meta, base);
    lsb = sb.lsb;
    rsb = sb.rsb;
  }
  const dx = Math.round(lsb - ib.xMin);
  if (dx) {
    g.contours = transformContours(g.contours, matrix.translate(dx, 0));
    for (const c of g.components || []) c.dx = (c.dx || 0) + dx;
  }
  g.advanceWidth = Math.max(0, Math.round(ib.xMax + dx + rsb));
}

/**
 * The template's version of a letter scaled to the font, used as a faint
 * guide while drawing. Returns { contours, advanceWidth } or null.
 */
export function guideFor(font, source, ch) {
  if (!source) return null;
  const code = ch.codePointAt(0);
  const g = Object.values(source.glyphs).find((x) => x.unicodes?.includes(code));
  if (!g) return null;
  const s = font.meta.capHeight / (source.meta.capHeight || font.meta.capHeight);
  const contours = transformContours(resolve(source, g), [s, 0, 0, s, 0, 0]);
  return contours.length ? { contours, advanceWidth: Math.round(g.advanceWidth * s) } : null;
}
