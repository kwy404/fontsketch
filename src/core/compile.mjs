// The font compiler: turns the fontsketch model into TrueType (glyf) or
// OpenType CFF binaries.

import { correctDirection, controlBounds, removeOverlaps } from './geometry.mjs';
import { notdefGlyph, validateFont } from './model.mjs';
import { assembleSfnt } from './sfnt.mjs';
import { buildGlyfLoca, encodeCompositeGlyph, encodeSimpleGlyph } from './glyf.mjs';
import { writeCFF } from './cff.mjs';
import {
  codePageBits, unicodeRangeBits, weightFromStyle, writeCmap, writeHead, writeHhea, writeHmtx, writeMaxp,
  writeName, writeOS2, writePost,
} from './tables.mjs';
import { writeGDEF, writeGPOS, writeKern } from './layout.mjs';
import { autoHintCFF, buildTrueTypeHinting, detectZones } from './hinting.mjs';
import { buildVariationTables, decomposeMixedGlyphs } from './variable.mjs';

/**
 * @typedef {{
 *   outlines?: 'truetype' | 'cff',
 *   hinting?: 'auto' | 'manual' | 'none',
 *   variable?: boolean,
 *   legacyKern?: boolean,
 *   correctDirections?: boolean,
 *   removeOverlaps?: boolean,
 *   optimize?: boolean,
 *   timestamp?: Date | number,
 *   onWarning?: (message: string) => void,
 * }} CompileOptions
 */

/** @typedef {{ x: number, y: number, on: boolean }} IntPoint */

/**
 * A glyph ready for table writing.
 * @typedef {{
 *   name: string, unicodes: number[], advance: number,
 *   contours: IntPoint[][],
 *   components: Array<{ gid: number, dx: number, dy: number, transform?: [number, number, number, number] }>,
 *   flat: IntPoint[][],
 *   box: { xMin: number, yMin: number, xMax: number, yMax: number },
 *   source: import('./model.mjs').Glyph,
 *   instructions?: Uint8Array,
 * }} PreparedGlyph
 * `flat` is the fully decomposed outline (used for metrics, CFF and hinting).
 */

const COMBINING = [[0x300, 0x36f], [0x1ab0, 0x1aff], [0x1dc0, 0x1dff], [0x20d0, 0x20ff], [0xfe20, 0xfe2f]];

/**
 * Compiles a font to an sfnt binary (TTF or OTF).
 * @param {import('./model.mjs').Font} font
 * @param {CompileOptions} [options]
 * @returns {Uint8Array}
 */
export function compileSfnt(font, options = {}) {
  const warn = options.onWarning || (() => {});
  const problems = validateFont(font);
  if (problems.length) throw new Error(`fontsketch: cannot compile this font:\n- ${problems.join('\n- ')}`);
  const cff = options.outlines === 'cff';
  const variable = !!options.variable;
  if (variable && cff) throw new Error('fontsketch: variable fonts are written with TrueType outlines (use format "ttf" or "woff2")');
  if (variable && !(font.axes && font.axes.length && font.masters && font.masters.length)) {
    throw new Error('fontsketch: a variable font needs font.axes and at least one entry in font.masters');
  }
  let hinting = options.hinting || 'none';
  if (variable && hinting !== 'none') {
    warn('hinting is not applied to variable fonts (their outlines change with the axes); the font is written unhinted');
    hinting = 'none';
  }
  if (variable) font = decomposeMixedGlyphs(font);
  const meta = font.meta;
  const upm = meta.unitsPerEm;

  // Glyph order: .notdef first, then the font's own order.
  const names = Object.keys(font.glyphs).filter((n) => n !== '.notdef');
  const notdef = font.glyphs['.notdef'] || notdefGlyph(meta);
  const order = ['.notdef', ...names];
  const sources = order.map((n) => (n === '.notdef' ? notdef : font.glyphs[n]));
  const gidOf = new Map(order.map((n, i) => [n, i]));
  const glyphs = prepareGlyphs(sources, gidOf, {
    cff,
    correct: options.correctDirections !== false,
    removeOverlaps: options.removeOverlaps,
    optimize: options.optimize !== false && !variable,
    variable,
  });

  // Metrics.
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  let minLsb = Infinity;
  let minRsb = Infinity;
  let maxExtent = -Infinity;
  let advanceMax = 0;
  for (const g of glyphs) {
    advanceMax = Math.max(advanceMax, g.advance);
    if (!g.flat.length) continue;
    xMin = Math.min(xMin, g.box.xMin);
    yMin = Math.min(yMin, g.box.yMin);
    xMax = Math.max(xMax, g.box.xMax);
    yMax = Math.max(yMax, g.box.yMax);
    minLsb = Math.min(minLsb, g.box.xMin);
    minRsb = Math.min(minRsb, g.advance - g.box.xMax);
    maxExtent = Math.max(maxExtent, g.box.xMax);
  }
  if (xMin === Infinity) xMin = yMin = xMax = yMax = minLsb = minRsb = maxExtent = 0;

  /** @type {Map<number, number>} */
  const cmap = new Map();
  glyphs.forEach((g, gid) => {
    for (const u of g.unicodes) if (!cmap.has(u)) cmap.set(u, gid);
  });
  const codes = new Set(cmap.keys());

  const style = meta.style || 'Regular';
  const lower = style.toLowerCase();
  const bold = /\bbold\b/.test(lower) && !/(semi|demi|extra|ultra)\s*bold/.test(lower);
  const italic = /italic|oblique/.test(lower) || (meta.italicAngle || 0) !== 0;
  const ribbi = ['regular', 'bold', 'italic', 'bold italic'].includes(lower);
  const weightClass = meta.weightClass || (variable ? defaultWeight(font) : weightFromStyle(style));
  const psName = postscriptName(meta.family, style);

  /** @type {Map<string, Uint8Array>} */
  const tables = new Map();
  let ttHints = null;
  if (!cff && hinting !== 'none') ttHints = buildTrueTypeHinting(glyphs, font, hinting, warn);
  const head = {
    fontRevision: parseFloat(meta.version) || 1,
    unitsPerEm: upm,
    created: timestampOf(options.timestamp),
    modified: timestampOf(options.timestamp),
    xMin, yMin, xMax, yMax,
    macStyle: (bold && ribbi ? 1 : 0) | (italic ? 2 : 0),
    lowestRecPPEM: 8,
    indexToLocFormat: 0,
    flags: 0x0003 | (ttHints ? 0x0008 : 0),
  };

  // Outlines.
  if (cff) {
    const zones = detectZones(font);
    tables.set('CFF ', writeCFF({
      psName,
      fullName: `${meta.family} ${style}`,
      familyName: meta.family,
      weight: weightName(weightClass),
      notice: meta.copyright || '',
      unitsPerEm: upm,
      bbox: [xMin, yMin, xMax, yMax],
      italicAngle: meta.italicAngle || 0,
      underlinePosition: meta.underlinePosition ?? Math.round(-upm * 0.1),
      underlineThickness: meta.underlineThickness ?? Math.round(upm * 0.05),
      isFixedPitch: isFixedPitch(glyphs),
      glyphs: glyphs.map((g) => {
        const stems = hinting === 'none' ? { hstems: [], vstems: [] } : autoHintCFF(g, zones, hinting);
        return { name: g.name, width: g.advance, contours: g.flat, ...stems };
      }),
      blueValues: hinting === 'none' ? [] : zones.blueValues,
      otherBlues: hinting === 'none' ? [] : zones.otherBlues,
      stdHW: hinting === 'none' ? undefined : zones.stdHW,
      stdVW: hinting === 'none' ? undefined : zones.stdVW,
    }));
  } else {
    const records = glyphs.map((g, gid) => {
      const instr = ttHints?.glyphInstructions.get(gid);
      if (g.components.length) {
        return encodeCompositeGlyph(
          g.components.map((c) => ({ glyphIndex: c.gid, dx: c.dx, dy: c.dy, transform: c.transform })),
          g.box,
          instr,
          { useMyMetrics: useMyMetricsIndex(g, glyphs), overlap: variable },
        );
      }
      return encodeSimpleGlyph(g.contours, instr || new Uint8Array(0), { overlap: variable && g.contours.length > 1 });
    });
    const { glyf, loca, indexToLocFormat } = buildGlyfLoca(records);
    head.indexToLocFormat = indexToLocFormat;
    tables.set('glyf', glyf);
    tables.set('loca', loca);
    if (ttHints) {
      tables.set('fpgm', ttHints.fpgm);
      tables.set('prep', ttHints.prep);
      tables.set('cvt ', ttHints.cvt);
      tables.set('gasp', ttHints.gasp);
    }
  }

  const { bytes: hmtx, numberOfHMetrics } = writeHmtx(glyphs.map((g) => ({ advanceWidth: g.advance, lsb: g.flat.length ? g.box.xMin : 0 })));
  tables.set('hmtx', hmtx);
  tables.set('head', writeHead(head));
  const slope = italic && meta.italicAngle ? Math.tan((-meta.italicAngle * Math.PI) / 180) : 0;
  tables.set('hhea', writeHhea({
    ascender: meta.ascender,
    descender: meta.descender,
    lineGap: meta.lineGap || 0,
    advanceWidthMax: advanceMax,
    minLeftSideBearing: minLsb,
    minRightSideBearing: minRsb,
    xMaxExtent: maxExtent,
    caretSlopeRise: slope ? upm : 1,
    caretSlopeRun: slope ? Math.round(slope * upm) : 0,
    numberOfHMetrics,
  }));
  tables.set('maxp', writeMaxp(cff ? { numGlyphs: glyphs.length, cff: true } : { numGlyphs: glyphs.length, ...maxpStats(glyphs), ...(ttHints?.maxp || {}) }));

  // Kerning.
  const kernRules = resolveKerning(font, gidOf, warn);
  const gpos = writeGPOS(kernRules);
  if (gpos) tables.set('GPOS', gpos);
  if (options.legacyKern) {
    const kern = writeKern(flattenRules(kernRules));
    if (kern) {
      tables.set('kern', kern.bytes);
      if (kern.dropped) warn(`legacy kern table: ${kern.dropped} pairs beyond the 10920 pair limit were left out (GPOS has all of them)`);
    }
  }
  const gdefClasses = new Map();
  glyphs.forEach((g, gid) => {
    if (gid === 0) return;
    if (isMark(g.source)) gdefClasses.set(gid, 3);
    else if (g.flat.length) gdefClasses.set(gid, 1);
  });
  if (gpos || [...gdefClasses.values()].includes(3)) tables.set('GDEF', writeGDEF(gdefClasses));

  // OS/2.
  const advances = glyphs.map((g) => g.advance).filter((a) => a > 0);
  const winAscent = Math.max(meta.ascender, yMax);
  const winDescent = Math.max(-meta.descender, -yMin);
  tables.set('OS/2', writeOS2({
    xAvgCharWidth: advances.length ? Math.round(advances.reduce((a, b) => a + b, 0) / advances.length) : 0,
    weightClass,
    widthClass: 5,
    fsType: 0,
    unitsPerEm: upm,
    unicodeRange: unicodeRangeBits(codes),
    codePageRange: codePageBits(codes),
    vendorID: meta.vendorID || 'NONE',
    fsSelection: (italic ? 1 : 0) | (bold && ribbi ? 1 << 5 : 0) | (!italic && !(bold && ribbi) ? 1 << 6 : 0) | (1 << 7),
    firstChar: codes.size ? Math.min(...codes) : 0,
    lastChar: codes.size ? Math.max(...codes) : 0,
    typoAscender: meta.ascender,
    typoDescender: meta.descender,
    typoLineGap: meta.lineGap || 0,
    winAscent,
    winDescent,
    xHeight: meta.xHeight,
    capHeight: meta.capHeight,
    defaultChar: 0,
    breakChar: 32,
    maxContext: gpos ? 2 : 0,
  }));

  // Names.
  const nameRecords = baseNameRecords(meta, style, ribbi, psName);
  if (variable) {
    const vt = buildVariationTables(font, glyphs, gidOf, { nameStart: 256, warn });
    for (const [tag, data] of vt.tables) tables.set(tag, data);
    nameRecords.push(...vt.names);
    nameRecords.push([25, psName.split('-')[0]]);
  }
  tables.set('name', writeName(nameRecords));
  tables.set('post', writePost({
    italicAngle: meta.italicAngle || 0,
    underlinePosition: meta.underlinePosition ?? Math.round(-upm * 0.1),
    underlineThickness: meta.underlineThickness ?? Math.round(upm * 0.05),
    isFixedPitch: isFixedPitch(glyphs),
    glyphNames: order,
  }));
  tables.set('cmap', writeCmap(cmap));
  return assembleSfnt(tables, cff ? 0x4f54544f : 0x00010000);
}

/** @param {Date | number | undefined} t */
function timestampOf(t) {
  if (t instanceof Date) return t;
  if (typeof t === 'number') return new Date(t);
  const epoch = typeof process !== 'undefined' && process.env && process.env.SOURCE_DATE_EPOCH;
  if (epoch && /^\d+$/.test(epoch)) return new Date(Number(epoch) * 1000);
  return new Date();
}

/** @param {import('./model.mjs').Font} font */
function defaultWeight(font) {
  const w = (font.axes || []).find((a) => a.tag === 'wght');
  return w ? Math.max(1, Math.min(1000, Math.round(w.default))) : weightFromStyle(font.meta.style || 'Regular');
}

/** @param {number} w */
function weightName(w) {
  const names = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
  return names[Math.round(w / 100) * 100] || 'Regular';
}

/**
 * PostScript name: printable ASCII without spaces or reserved characters,
 * at most 63 characters, `Family-Style`.
 * @param {string} family
 * @param {string} style
 */
export function postscriptName(family, style) {
  const clean = (s) => s.normalize('NFKD').replace(/[^\x21-\x7e]/g, '').replace(/[[\](){}<>/%]/g, '');
  const fam = clean(family) || 'Untitled';
  const sty = clean(style) || 'Regular';
  return `${fam}-${sty}`.slice(0, 63);
}

/**
 * @param {import('./model.mjs').FontMeta} meta
 * @param {string} style
 * @param {boolean} ribbi
 * @param {string} psName
 * @returns {Array<[number, string]>}
 */
function baseNameRecords(meta, style, ribbi, psName) {
  const family = meta.family;
  const version = `Version ${Number(parseFloat(meta.version) || 1).toFixed(3)}`;
  /** @type {Array<[number, string]>} */
  const r = [];
  if (meta.copyright) r.push([0, meta.copyright]);
  if (ribbi) {
    r.push([1, family], [2, style]);
  } else {
    const italic = /italic|oblique/i.test(style);
    r.push([1, `${family} ${style.replace(/\s*italic\s*/i, ' ').trim()}`.trim()], [2, italic ? 'Italic' : 'Regular']);
  }
  r.push([3, `${Number(parseFloat(meta.version) || 1).toFixed(3)};${meta.vendorID || 'NONE'};${psName}`]);
  r.push([4, `${family} ${style}`]);
  r.push([5, version]);
  r.push([6, psName]);
  if (meta.designer) r.push([9, meta.designer]);
  if (meta.description) r.push([10, meta.description]);
  if (meta.vendorURL) r.push([11, meta.vendorURL]);
  if (meta.designerURL) r.push([12, meta.designerURL]);
  if (meta.license) r.push([13, meta.license]);
  if (meta.licenseURL) r.push([14, meta.licenseURL]);
  if (!ribbi) r.push([16, family], [17, style]);
  return r;
}

/** @param {PreparedGlyph[]} glyphs */
function isFixedPitch(glyphs) {
  const widths = new Set(glyphs.slice(1).map((g) => g.advance).filter((a) => a > 0));
  return glyphs.length > 2 && widths.size === 1;
}

/** @param {import('./model.mjs').Glyph} g */
export function isMark(g) {
  if ((g.unicodes || []).some((u) => COMBINING.some(([a, b]) => u >= a && u <= b))) return true;
  if (/comb(\.|$)/.test(g.name)) return true;
  const anchors = g.anchors ? Object.keys(g.anchors) : [];
  return anchors.length > 0 && anchors.every((a) => a.startsWith('_'));
}

/** A component whose metrics the composite copies (same advance, offset 0). */
function useMyMetricsIndex(g, glyphs) {
  const i = g.components.findIndex((c) => c.dx === 0 && !c.transform && glyphs[c.gid].advance === g.advance && !glyphs[c.gid].components.length);
  return i >= 0 ? i : undefined;
}

/* ------------------------------------------------------------------ */
/* Glyph preparation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Rounds outlines, fixes contour directions, keeps composites when TrueType
 * can express them and decomposes everything else.
 * @param {import('./model.mjs').Glyph[]} sources
 * @param {Map<string, number>} gidOf
 * @param {{ cff: boolean, correct: boolean, optimize: boolean, variable?: boolean, removeOverlaps?: boolean }} opts
 * @returns {PreparedGlyph[]}
 */
export function prepareGlyphs(sources, gidOf, opts) {
  const byName = new Map(sources.map((g) => [g.name, g]));
  /** @type {Map<string, IntPoint[][]>} */
  const flatCache = new Map();
  /** @type {Map<string, Array<{ index: number, reverse: boolean }>>} */
  const plans = new Map();
  const ownContours = (g) => {
    const indexed = (g.contours || []).map((c, index) => ({ c, index })).filter(({ c }) => c.points && c.points.length);
    let contours = indexed.map(({ c }) => c);
    const reversed = new Array(contours.length).fill(false);
    if (opts.correct && contours.length) {
      const fixed = correctDirection(contours, { clockwiseOuter: true });
      fixed.forEach((c, i) => {
        reversed[i] = c.points.length > 1 && c.points[1] !== contours[i].points[1];
      });
      contours = fixed;
    }
    plans.set(g.name, indexed.map(({ index }, i) => ({ index, reverse: reversed[i] })));
    const rounded = contours.map((c) => c.points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), on: p.on !== false })));
    // Variable fonts keep every point so masters stay point compatible.
    if (opts.variable) return rounded;
    return rounded.map((pts) => cleanContour(pts, opts.optimize)).filter((c) => c.length > 0);
  };
  const flatten = (name, stack) => {
    const cached = flatCache.get(name);
    if (cached) return cached;
    if (stack.includes(name)) throw new Error(`fontsketch: glyph "${name}" contains itself through its components (${[...stack, name].join(' > ')})`);
    const g = byName.get(name);
    if (!g) throw new Error(`fontsketch: missing component glyph "${name}"`);
    const out = [...ownContours(g)];
    for (const c of g.components || []) {
      const m = componentMatrix(c);
      for (const contour of flatten(c.glyph, [...stack, name])) {
        const pts = contour.map((p) => ({ x: Math.round(m[0] * p.x + m[2] * p.y + c.dx), y: Math.round(m[1] * p.x + m[3] * p.y + c.dy), on: p.on }));
        out.push(m[0] * m[3] - m[1] * m[2] < 0 ? [pts[0], ...pts.slice(1).reverse()] : pts);
      }
    }
    flatCache.set(name, out);
    return out;
  };
  return sources.map((g) => {
    let flat = flatten(g.name, []);
    const comps = g.components || [];
    // PostScript rasterizers do not cope with overlapping contours, so CFF
    // outlines are merged (TrueType renders overlaps fine and keeps them).
    const merge = opts.cff ? opts.removeOverlaps !== false : opts.removeOverlaps === true && !opts.variable;
    if (merge && flat.length > 1) flat = mergeOverlaps(flat);
    const keepComposite = !opts.cff && comps.length > 0 && !(g.contours || []).some((c) => c.points && c.points.length) &&
      comps.every((c) => Number.isInteger(Math.round(c.dx)) && withinF2Dot14(componentMatrix(c)));
    const flatPS = opts.cff ? flat.map((c) => [c[0], ...c.slice(1).reverse()]) : flat;
    const contours = keepComposite ? [] : opts.cff ? flatPS : flat;
    const box = controlBox(flat);
    return {
      name: g.name,
      unicodes: g.unicodes || [],
      advance: Math.max(0, Math.round(g.advanceWidth)),
      contours,
      components: keepComposite
        ? comps.map((c) => {
          const m = componentMatrix(c);
          const identity = m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1;
          return { gid: /** @type {number} */ (gidOf.get(c.glyph)), dx: Math.round(c.dx), dy: Math.round(c.dy), ...(identity ? {} : { transform: m }) };
        })
        : [],
      flat: opts.cff ? flatPS : flat,
      box,
      source: g,
      plan: plans.get(g.name),
    };
  });
}

/**
 * Union of a glyph's contours (integer coordinates in, integer coordinates
 * out). Returns the input when nothing overlaps.
 * @param {IntPoint[][]} flat
 */
function mergeOverlaps(flat) {
  const shapes = flat.map((points) => ({ closed: true, points }));
  const merged = removeOverlaps(shapes);
  if (!merged.length) return flat;
  return merged.map((c) => cleanContour(c.points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), on: p.on })), true)).filter((c) => c.length > 1);
}

/** @param {import('./model.mjs').Component & { transform?: number[] }} c @returns {[number, number, number, number]} */
function componentMatrix(c) {
  if (Array.isArray(c.transform) && c.transform.length === 4) return /** @type {[number, number, number, number]} */ (c.transform.slice());
  const s = c.scale ?? 1;
  return [s, 0, 0, s];
}

function withinF2Dot14(m) {
  return m.every((v) => v >= -2 && v < 2);
}

/** @param {IntPoint[][]} contours */
function controlBox(contours) {
  const b = controlBounds(contours.map((points) => ({ closed: true, points })));
  return { xMin: Math.round(b.xMin), yMin: Math.round(b.yMin), xMax: Math.round(b.xMax), yMax: Math.round(b.yMax) };
}

/**
 * Removes repeated points; with `optimize`, drops on curve points that sit
 * exactly halfway between two off curve points (TrueType implies them).
 * @param {IntPoint[]} pts
 * @param {boolean} optimize
 */
function cleanContour(pts, optimize) {
  let out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y && last.on === p.on) continue;
    if (last && last.x === p.x && last.y === p.y && last.on && !p.on) continue;
    out.push(p);
  }
  while (out.length > 1 && out[0].x === out[out.length - 1].x && out[0].y === out[out.length - 1].y && out[0].on === out[out.length - 1].on) out.pop();
  if (optimize && out.length > 3) {
    const n = out.length;
    const keep = out.filter((p, i) => {
      if (!p.on) return true;
      const a = out[(i - 1 + n) % n];
      const b = out[(i + 1) % n];
      return !(!a.on && !b.on && a.x + b.x === 2 * p.x && a.y + b.y === 2 * p.y);
    });
    if (keep.some((p) => p.on) || keep.length >= 2) out = keep;
  }
  return out;
}

/** @param {PreparedGlyph[]} glyphs */
function maxpStats(glyphs) {
  let maxPoints = 0;
  let maxContours = 0;
  let maxCompositePoints = 0;
  let maxCompositeContours = 0;
  let maxComponentElements = 0;
  let maxComponentDepth = 0;
  const depth = (g, d) => (g.components.length ? Math.max(...g.components.map((c) => depth(glyphs[c.gid], d + 1))) : d);
  for (const g of glyphs) {
    if (g.components.length) {
      maxCompositePoints = Math.max(maxCompositePoints, g.flat.reduce((a, c) => a + c.length, 0));
      maxCompositeContours = Math.max(maxCompositeContours, g.flat.length);
      maxComponentElements = Math.max(maxComponentElements, g.components.length);
      maxComponentDepth = Math.max(maxComponentDepth, depth(g, 0));
    } else {
      maxPoints = Math.max(maxPoints, g.contours.reduce((a, c) => a + c.length, 0));
      maxContours = Math.max(maxContours, g.contours.length);
    }
  }
  return { maxPoints, maxContours, maxCompositePoints, maxCompositeContours, maxComponentElements, maxComponentDepth, maxZones: 1 };
}

/* ------------------------------------------------------------------ */
/* Kerning                                                             */
/* ------------------------------------------------------------------ */

/**
 * Turns `font.kerning` into rules on glyph ids. A side is a class when it
 * names an entry of `kerning.classes`, otherwise a glyph.
 * @param {import('./model.mjs').Font} font
 * @param {Map<string, number>} gidOf
 * @param {(m: string) => void} warn
 * @returns {import('./layout.mjs').KernRule[]}
 */
export function resolveKerning(font, gidOf, warn = () => {}) {
  const kerning = font.kerning || { pairs: {}, classes: {} };
  const classes = kerning.classes || {};
  const side = (name) => {
    if (Object.prototype.hasOwnProperty.call(classes, name)) {
      const ids = [];
      for (const g of classes[name]) {
        const id = gidOf.get(g);
        if (id === undefined) warn(`kerning class "${name}" lists missing glyph "${g}"`);
        else if (!ids.includes(id)) ids.push(id);
      }
      return { ids, isClass: true };
    }
    const id = gidOf.get(name);
    if (id === undefined) return null;
    return { ids: [id], isClass: false };
  };
  const rules = [];
  for (const [key, value] of Object.entries(kerning.pairs || {})) {
    const sep = key.indexOf('|');
    if (sep < 0) {
      warn(`kerning pair "${key}" is not written as "left|right"`);
      continue;
    }
    const l = side(key.slice(0, sep));
    const r = side(key.slice(sep + 1));
    if (!l || !r) {
      warn(`kerning pair "${key}" refers to a missing glyph or class`);
      continue;
    }
    if (!Number.isFinite(value)) continue;
    rules.push({ left: l.ids, right: r.ids, value: Math.round(value), leftClass: l.isClass, rightClass: r.isClass });
  }
  return rules;
}

/**
 * Flattens rules into glyph pairs with the same precedence GPOS uses.
 * @param {import('./layout.mjs').KernRule[]} rules
 * @returns {Array<[number, number, number]>}
 */
export function flattenRules(rules) {
  const rank = (r) => (!r.leftClass && !r.rightClass ? 4 : !r.leftClass ? 3 : !r.rightClass ? 2 : 1);
  const best = new Map();
  for (const r of rules) {
    const k = rank(r);
    for (const l of r.left) {
      for (const g of r.right) {
        const key = l * 65536 + g;
        const prev = best.get(key);
        if (!prev || prev.rank <= k) best.set(key, { rank: k, value: r.value });
      }
    }
  }
  return [...best].map(([key, v]) => [Math.floor(key / 65536), key % 65536, v.value]);
}

