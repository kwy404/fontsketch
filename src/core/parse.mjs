// Font import: TTF, OTF (CFF), WOFF and WOFF2 into the fontsketch model.

import { toUint8 } from './binary.mjs';
import { readSfnt } from './sfnt.mjs';
import { decodeGlyph, splitGlyf } from './glyf.mjs';
import { readCFF } from './cff.mjs';
import { readCmap, readHead, readHhea, readHmtx, readMaxp, readName, readOS2, readPost } from './tables.mjs';
import { readGPOS, readKern } from './layout.mjs';
import { readAvar, readFvar, readGvar, readHVAR, inferDeltas, supportScalar } from './variable.mjs';
import { woffToSfnt } from './woff.mjs';
import { woff2ToSfnt } from './woff2.mjs';
import { cubicToQuadratic } from './geometry.mjs';
import { DEFAULT_META, glyphNameFor, isValidGlyphName } from './model.mjs';

/**
 * Detects the container format of font bytes.
 * @param {Uint8Array} b
 * @returns {'ttf' | 'otf' | 'woff' | 'woff2' | 'ttc' | 'unknown'}
 */
export function detectFormat(b) {
  if (b.length < 4) return 'unknown';
  const sig = String.fromCharCode(b[0], b[1], b[2], b[3]);
  if (sig === 'wOFF') return 'woff';
  if (sig === 'wOF2') return 'woff2';
  if (sig === 'OTTO') return 'otf';
  if (sig === 'ttcf') return 'ttc';
  if (sig === 'true' || (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0)) return 'ttf';
  return 'unknown';
}

/**
 * Unwraps WOFF and WOFF2 to a plain sfnt (TTF or OTF) binary.
 * @param {Uint8Array | ArrayBuffer} input
 */
export function toSfnt(input) {
  const b = toUint8(input);
  const format = detectFormat(b);
  if (format === 'woff') return woffToSfnt(b);
  if (format === 'woff2') return woff2ToSfnt(b);
  if (format === 'ttf' || format === 'otf') return b;
  if (format === 'ttc') throw new Error('parseFont: font collections (.ttc) are not supported; extract one font first');
  throw new Error('parseFont: not a TTF, OTF, WOFF or WOFF2 file');
}

/**
 * Parses TTF, OTF, WOFF or WOFF2 bytes into a fontsketch font.
 * Outlines become quadratic contours (CFF curves are converted within half
 * a unit), composites stay composites, GPOS and kern pair kerning become
 * `kerning.pairs` and `kerning.classes`, and variable fonts get `axes`,
 * `instances` and one master per variation peak.
 * @param {Uint8Array | ArrayBuffer} input
 * @returns {import('./model.mjs').Font}
 */
export function parseFont(input) {
  const sfnt = toSfnt(input);
  const { tables } = readSfnt(sfnt);
  const need = (tag) => {
    const t = tables.get(tag);
    if (!t) throw new Error(`parseFont: missing required table "${tag}"`);
    return t;
  };
  const head = readHead(need('head'));
  const hhea = readHhea(need('hhea'));
  const maxp = readMaxp(need('maxp'));
  const numGlyphs = maxp.numGlyphs;
  const hmtx = readHmtx(need('hmtx'), hhea.numberOfHMetrics, numGlyphs);
  const names = tables.has('name') ? readName(/** @type {Uint8Array} */ (tables.get('name'))) : {};
  const os2 = tables.has('OS/2') ? readOS2(/** @type {Uint8Array} */ (tables.get('OS/2'))) : null;
  const post = tables.has('post') ? readPost(/** @type {Uint8Array} */ (tables.get('post'))) : null;
  const cmap = tables.has('cmap') ? readCmap(/** @type {Uint8Array} */ (tables.get('cmap'))) : new Map();
  const cffData = tables.get('CFF ');
  const cff = cffData ? readCFF(cffData) : null;

  // Glyph names.
  /** @type {string[]} */
  const rawNames = [];
  const byGid = new Map();
  for (const [code, gid] of [...cmap].sort((a, b) => a[0] - b[0])) if (!byGid.has(gid)) byGid.set(gid, code);
  for (let gid = 0; gid < numGlyphs; gid++) {
    let n = post?.glyphNames?.[gid] || (cff && !cff.topDict.isCID ? cff.glyphNames[gid] : '') || '';
    if (!n) n = gid === 0 ? '.notdef' : byGid.has(gid) ? glyphNameFor(byGid.get(gid)) : `glyph${gid}`;
    rawNames.push(n);
  }
  const glyphNames = uniqueNames(rawNames);

  const upm = head.unitsPerEm;
  /** @type {import('./model.mjs').Font} */
  const font = {
    meta: {
      ...DEFAULT_META,
      family: names[16] || names[1] || 'Untitled',
      style: names[17] || names[2] || 'Regular',
      version: Number(head.fontRevision).toFixed(3),
      designer: names[9] || '',
      license: names[13] || '',
      unitsPerEm: upm,
      ascender: os2?.typoAscender ?? hhea.ascender,
      descender: os2?.typoDescender ?? hhea.descender,
      lineGap: os2?.typoLineGap ?? hhea.lineGap,
      xHeight: os2?.xHeight || 0,
      capHeight: os2?.capHeight || 0,
    },
    glyphs: {},
    kerning: { pairs: {}, classes: {} },
    features: {},
  };
  const meta = font.meta;
  if (os2 && !(os2.fsSelection & (1 << 7)) && os2.typoAscender === undefined) {
    meta.ascender = hhea.ascender;
    meta.descender = hhea.descender;
    meta.lineGap = hhea.lineGap;
  }
  if (os2?.weightClass) meta.weightClass = os2.weightClass;
  if (os2?.vendorID && os2.vendorID.trim() && os2.vendorID !== 'NONE') meta.vendorID = os2.vendorID.trim();
  if (names[0]) meta.copyright = names[0];
  if (names[10]) meta.description = names[10];
  if (names[11]) meta.vendorURL = names[11];
  if (names[12]) meta.designerURL = names[12];
  if (names[14]) meta.licenseURL = names[14];
  if (post) {
    if (post.italicAngle) meta.italicAngle = post.italicAngle;
    meta.underlinePosition = post.underlinePosition;
    meta.underlineThickness = post.underlineThickness;
  }

  // Unicode assignments.
  /** @type {Map<number, number[]>} */
  const unicodesOf = new Map();
  for (const [code, gid] of [...cmap].sort((a, b) => a[0] - b[0])) {
    if (gid >= numGlyphs) continue;
    if (!unicodesOf.has(gid)) unicodesOf.set(gid, []);
    /** @type {number[]} */ (unicodesOf.get(gid)).push(code);
  }

  // Outlines.
  /** @type {Array<Array<Array<{ x: number, y: number, on: boolean }>>>} */
  const rawContours = [];
  if (tables.has('glyf')) {
    const records = splitGlyf(need('glyf'), need('loca'), head.indexToLocFormat, numGlyphs);
    const decoded = records.map((r) => decodeGlyph(r));
    decoded.forEach((g, gid) => {
      rawContours.push(g.contours);
      /** @type {import('./model.mjs').Glyph} */
      const glyph = {
        name: glyphNames[gid],
        unicodes: unicodesOf.get(gid) || [],
        advanceWidth: hmtx[gid].advanceWidth,
        contours: g.contours.map((c) => ({ closed: true, points: c.map((p) => ({ x: p.x, y: p.y, on: p.on })) })),
      };
      if (g.components.length) {
        glyph.components = g.components.map((c) => {
          /** @type {import('./model.mjs').Component & { transform?: number[] }} */
          const comp = { glyph: glyphNames[c.glyphIndex] ?? glyphNames[0], dx: c.dx, dy: c.dy };
          if (c.transform) {
            const [a, b, cc, d] = c.transform;
            if (b === 0 && cc === 0 && a === d) comp.scale = a;
            else comp.transform = [a, b, cc, d];
          }
          if (c.matchPoints) /** @type {any} */ (comp).matchPoints = c.matchPoints;
          return comp;
        });
      }
      font.glyphs[glyph.name] = glyph;
    });
    resolvePointMatchedComponents(font);
  } else if (cff) {
    cff.glyphs.forEach((g, gid) => {
      const contours = g.contours.map((c) => cubicContourToQuadratic(c));
      /** @type {import('./model.mjs').Glyph} */
      const glyph = {
        name: glyphNames[gid],
        unicodes: unicodesOf.get(gid) || [],
        advanceWidth: hmtx[gid].advanceWidth,
        contours,
      };
      if (g.hstems.length || g.vstems.length) glyph.hints = { stems: { h: g.hstems, v: g.vstems } };
      font.glyphs[glyph.name] = glyph;
    });
  } else {
    throw new Error('parseFont: the font has neither glyf nor CFF outlines (CFF2 is not supported)');
  }

  if (!meta.xHeight) meta.xHeight = measure(font, 'x', 'yMax') ?? Math.round(upm * 0.5);
  if (!meta.capHeight) meta.capHeight = measure(font, 'H', 'yMax') ?? Math.round(upm * 0.7);

  // Kerning.
  if (tables.has('GPOS')) {
    try {
      const { pairs, classPairs } = readGPOS(/** @type {Uint8Array} */ (tables.get('GPOS')));
      for (const [l, r, v] of pairs) {
        const key = `${glyphNames[l]}|${glyphNames[r]}`;
        if (!(key in font.kerning.pairs)) font.kerning.pairs[key] = v;
      }
      const classNames = new Map();
      const classFor = (ids, side) => {
        const members = ids.map((i) => glyphNames[i]).filter(Boolean);
        const key = `${side}:${members.join(',')}`;
        let name = classNames.get(key);
        if (!name) {
          name = `@${side === 1 ? 'left' : 'right'}_${members[0]}`;
          let k = 2;
          while (font.kerning.classes[name]) name = `@${side === 1 ? 'left' : 'right'}_${members[0]}_${k++}`;
          classNames.set(key, name);
          font.kerning.classes[name] = members;
        }
        return name;
      };
      for (const cp of classPairs) {
        const key = `${classFor(cp.left, 1)}|${classFor(cp.right, 2)}`;
        if (!(key in font.kerning.pairs)) font.kerning.pairs[key] = cp.value;
      }
    } catch (err) {
      font.features.importWarnings = [...(/** @type {string[]} */ (font.features.importWarnings) || []), `GPOS kerning skipped: ${/** @type {Error} */ (err).message}`];
    }
  } else if (tables.has('kern')) {
    for (const [l, r, v] of readKern(/** @type {Uint8Array} */ (tables.get('kern')))) {
      if (glyphNames[l] && glyphNames[r]) font.kerning.pairs[`${glyphNames[l]}|${glyphNames[r]}`] = v;
    }
  }

  if (tables.has('fvar')) readVariations(font, tables, names, glyphNames, rawContours, hmtx);
  return font;
}

/** Makes glyph names valid and unique. @param {string[]} list */
function uniqueNames(list) {
  const seen = new Set();
  return list.map((raw, gid) => {
    let n = raw.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 63);
    if (gid === 0) n = '.notdef';
    else if (n === '.notdef' || !n) n = `glyph${gid}`;
    if (!isValidGlyphName(n)) n = `_${n}`.slice(0, 63);
    let out = n;
    let k = 1;
    while (seen.has(out)) out = `${n.slice(0, 58)}.${k++}`;
    seen.add(out);
    return out;
  });
}

/** @param {import('./model.mjs').Font} font @param {string} name @param {'yMax' | 'yMin'} which */
function measure(font, name, which) {
  const g = font.glyphs[name];
  if (!g || !g.contours.length) return null;
  let v = which === 'yMax' ? -Infinity : Infinity;
  for (const c of g.contours) for (const p of c.points) v = which === 'yMax' ? Math.max(v, p.y) : Math.min(v, p.y);
  return Number.isFinite(v) ? v : null;
}

/**
 * Converts a CFF contour (move, lines and cubic curves; counter clockwise
 * outer contours) to a quadratic TrueType contour (clockwise outer).
 * @param {Array<number[]>} c
 * @returns {import('./model.mjs').Contour}
 */
function cubicContourToQuadratic(c) {
  /** @type {import('./model.mjs').Point[]} */
  const pts = [];
  if (!c.length) return { closed: true, points: pts };
  let cur = { x: c[0][0], y: c[0][1] };
  pts.push({ x: cur.x, y: cur.y, on: true });
  for (let i = 1; i < c.length; i++) {
    const s = c[i];
    if (s.length === 2) {
      cur = { x: s[0], y: s[1] };
      pts.push({ x: cur.x, y: cur.y, on: true });
    } else {
      const q = cubicToQuadratic(cur, { x: s[0], y: s[1] }, { x: s[2], y: s[3] }, { x: s[4], y: s[5] }, 0.5);
      for (const p of q) pts.push({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, on: p.on });
      cur = { x: s[4], y: s[5] };
    }
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (pts.length > 1 && last.on && last.x === first.x && last.y === first.y) pts.pop();
  // CFF outer contours run counter clockwise; reverse to the TrueType convention.
  return { closed: true, points: pts.length > 1 ? [pts[0], ...pts.slice(1).reverse()] : pts };
}

/** Components positioned by point matching become plain offsets. */
function resolvePointMatchedComponents(font) {
  const pointsOf = (name, depth = 0) => {
    const g = font.glyphs[name];
    if (!g || depth > 8) return [];
    const out = g.contours.flatMap((c) => c.points.map((p) => ({ x: p.x, y: p.y })));
    for (const comp of g.components || []) {
      const m = comp.transform || [comp.scale ?? 1, 0, 0, comp.scale ?? 1];
      for (const p of pointsOf(comp.glyph, depth + 1)) out.push({ x: m[0] * p.x + m[2] * p.y + comp.dx, y: m[1] * p.x + m[3] * p.y + comp.dy });
    }
    return out;
  };
  for (const g of Object.values(font.glyphs)) {
    const comps = g.components || [];
    comps.forEach((comp, i) => {
      const mp = /** @type {any} */ (comp).matchPoints;
      if (!mp) return;
      delete (/** @type {any} */ (comp)).matchPoints;
      const parent = [];
      for (const prev of comps.slice(0, i)) {
        const m = prev.transform || [prev.scale ?? 1, 0, 0, prev.scale ?? 1];
        for (const p of pointsOf(prev.glyph)) parent.push({ x: m[0] * p.x + m[2] * p.y + prev.dx, y: m[1] * p.x + m[3] * p.y + prev.dy });
      }
      const child = pointsOf(comp.glyph);
      const a = parent[mp[0]];
      const b = child[mp[1]];
      if (a && b) {
        const m = comp.transform || [comp.scale ?? 1, 0, 0, comp.scale ?? 1];
        comp.dx = Math.round(a.x - (m[0] * b.x + m[2] * b.y));
        comp.dy = Math.round(a.y - (m[1] * b.x + m[3] * b.y));
      }
    });
  }
}

/* ------------------------------------------------------------------ */
/* Variable fonts                                                      */
/* ------------------------------------------------------------------ */

function readVariations(font, tables, names, glyphNames, rawContours, hmtx) {
  const { axes, instances } = readFvar(tables.get('fvar'), names);
  if (!axes.length) return;
  font.axes = axes;
  if (instances.length) font.instances = instances;
  const avarMaps = tables.has('avar') ? readAvar(tables.get('avar')) : null;
  if (!tables.has('gvar')) return;
  const pointCounts = glyphNames.map((name, gid) => {
    const g = font.glyphs[name];
    const n = g.components?.length ? g.components.length : rawContours[gid].reduce((a, c) => a + c.length, 0);
    return n + 4;
  });
  const gvar = readGvar(tables.get('gvar'), axes.length, pointCounts);
  const hvar = tables.has('HVAR') ? readHVAR(tables.get('HVAR')) : null;
  // One master per distinct peak.
  const peaks = new Map();
  for (const tuples of gvar) {
    for (const t of tuples) {
      const key = t.peak.join(',');
      if (!peaks.has(key)) peaks.set(key, t.peak);
    }
  }
  const denormalize = (axis, i, v) => {
    let n = v;
    if (avarMaps && avarMaps[i]) n = invertSegmentMap(avarMaps[i], v);
    return Math.round((n < 0 ? axis.default + n * (axis.default - axis.min) : axis.default + n * (axis.max - axis.default)) * 1000) / 1000;
  };
  const masters = [];
  for (const peak of peaks.values()) {
    const loc = Object.fromEntries(axes.map((a, i) => [a.tag, denormalize(a, i, peak[i])]));
    const normLoc = Object.fromEntries(axes.map((a, i) => [a.tag, peak[i]]).filter(([, v]) => v !== 0));
    const named = instances.find((inst) => axes.every((a) => Math.abs((inst.location[a.tag] ?? a.default) - loc[a.tag]) < 0.5));
    /** @type {import('./model.mjs').Master} */
    const master = { name: named ? named.name : axes.map((a) => `${a.tag}${loc[a.tag]}`).join(' '), location: loc, glyphs: {} };
    glyphNames.forEach((name, gid) => {
      const tuples = gvar[gid];
      if (!tuples || !tuples.length) return;
      const g = font.glyphs[name];
      const count = pointCounts[gid];
      const sumX = new Float64Array(count);
      const sumY = new Float64Array(count);
      const coords = rawContours[gid].flat();
      const ends = [];
      let acc = -1;
      for (const c of rawContours[gid]) {
        acc += c.length;
        ends.push(acc);
      }
      let any = false;
      for (const t of tuples) {
        const support = {};
        axes.forEach((a, i) => {
          support[a.tag] = [t.start[i], t.peak[i], t.end[i]];
        });
        const s = supportScalar(normLoc, support);
        if (!s) continue;
        any = true;
        let dx = new Array(count).fill(null);
        let dy = new Array(count).fill(null);
        if (t.points) {
          t.points.forEach((p, k) => {
            if (p < count) {
              dx[p] = t.dx[k];
              dy[p] = t.dy[k];
            }
          });
          if (!g.components?.length) {
            const inferred = inferDeltas(coords, ends, dx.slice(0, count - 4), dy.slice(0, count - 4));
            dx = [...inferred.dx, ...dx.slice(count - 4).map((v) => v ?? 0)];
            dy = [...inferred.dy, ...dy.slice(count - 4).map((v) => v ?? 0)];
          }
        } else {
          dx = t.dx;
          dy = t.dy;
        }
        for (let k = 0; k < count; k++) {
          sumX[k] += (dx[k] ?? 0) * s;
          sumY[k] += (dy[k] ?? 0) * s;
        }
      }
      if (!any) return;
      /** @type {{ contours: import('./model.mjs').Contour[], advanceWidth?: number, components?: any[] }} */
      const mg = { contours: [] };
      if (g.components?.length) {
        mg.components = g.components.map((c, i) => ({ ...c, dx: c.dx + Math.round(sumX[i]), dy: c.dy + Math.round(sumY[i]) }));
      } else {
        let k = 0;
        mg.contours = g.contours.map((c) => ({ closed: true, points: c.points.map((p) => {
          const out = { x: Math.round((p.x + sumX[k]) * 100) / 100, y: Math.round((p.y + sumY[k]) * 100) / 100, on: p.on };
          k++;
          return out;
        }) }));
      }
      const phantomAdvance = sumX[count - 3] - sumX[count - 4];
      const hv = hvar ? hvar(gid, axes.map((a) => normLoc[a.tag] ?? 0)) : phantomAdvance;
      mg.advanceWidth = Math.round(hmtx[gid].advanceWidth + hv);
      master.glyphs[name] = mg;
    });
    masters.push(master);
  }
  if (masters.length) font.masters = masters;
}

/** @param {Array<[number, number]>} map @param {number} v */
function invertSegmentMap(map, v) {
  for (let i = 1; i < map.length; i++) {
    const [a0, b0] = map[i - 1];
    const [a1, b1] = map[i];
    if (v >= Math.min(b0, b1) && v <= Math.max(b0, b1)) return b1 === b0 ? a0 : a0 + ((v - b0) * (a1 - a0)) / (b1 - b0);
  }
  return v;
}
