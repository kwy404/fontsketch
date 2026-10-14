// Variable fonts: axis normalization, the master interpolation model, the
// fvar, gvar, STAT and HVAR tables (TrueType flavored variable fonts) and
// static instances.

import { Reader, Writer } from './binary.mjs';
import { cloneFont } from './model.mjs';

/** @typedef {import('./model.mjs').Axis} Axis */
/** @typedef {Record<string, [number, number, number]>} Support axis tag to [lower, peak, upper] */

/* ------------------------------------------------------------------ */
/* Normalization and the variation model                               */
/* ------------------------------------------------------------------ */

/**
 * Maps user coordinates (for example `{ wght: 700 }`) to normalized
 * coordinates between -1 and 1 (default 0). Axes at their default value
 * are left out. Values outside the axis range are clamped.
 * @param {Axis[]} axes
 * @param {Record<string, number>} location
 * @param {Record<string, Array<[number, number]>>} [avar] optional segment maps
 */
export function normalizeLocation(axes, location, avar) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const a of axes) {
    const v = Math.max(a.min, Math.min(a.max, location[a.tag] ?? a.default));
    let n = 0;
    if (v < a.default) n = a.default === a.min ? 0 : (v - a.default) / (a.default - a.min);
    else if (v > a.default) n = a.max === a.default ? 0 : (v - a.default) / (a.max - a.default);
    if (avar && avar[a.tag]) n = applySegmentMap(avar[a.tag], n);
    n = Math.round(n * 16384) / 16384;
    if (n !== 0) out[a.tag] = n;
  }
  return out;
}

/** @param {Array<[number, number]>} map @param {number} v */
function applySegmentMap(map, v) {
  if (!map.length) return v;
  for (let i = 1; i < map.length; i++) {
    const [a0, b0] = map[i - 1];
    const [a1, b1] = map[i];
    if (v >= a0 && v <= a1) return a1 === a0 ? b0 : b0 + ((v - a0) * (b1 - b0)) / (a1 - a0);
  }
  return v;
}

/**
 * Scalar contribution of a region at a location (OpenType rules).
 * @param {Record<string, number>} location normalized
 * @param {Support} support
 */
export function supportScalar(location, support) {
  let scalar = 1;
  for (const [axis, [lower, peak, upper]] of Object.entries(support)) {
    if (peak === 0) continue;
    if (lower > peak || peak > upper) continue;
    if (lower < 0 && upper > 0) continue;
    const v = location[axis] ?? 0;
    if (v === peak) continue;
    if (v <= lower || upper <= v) return 0;
    scalar *= v < peak ? (v - lower) / (peak - lower) : (v - upper) / (peak - upper);
  }
  return scalar;
}

/**
 * Master interpolation model. Locations are normalized; the first one with
 * no axes (`{}`) is the default master. Masters are ordered by how many axes
 * they use, regions are split where earlier masters fall inside them, and
 * deltas are solved so that interpolating at a master location gives that
 * master exactly.
 */
export class VariationModel {
  /**
   * @param {Array<Record<string, number>>} locations
   * @param {string[]} [axisOrder]
   */
  constructor(locations, axisOrder = []) {
    const clean = locations.map((l) => Object.fromEntries(Object.entries(l).filter(([, v]) => v !== 0)));
    const keys = clean.map((l) => JSON.stringify(Object.entries(l).sort()));
    if (new Set(keys).size !== keys.length) throw new Error('variable font: two masters share the same location');
    if (!clean.some((l) => Object.keys(l).length === 0)) throw new Error('variable font: no master at the default location');
    const sortKey = locationSortKey(clean, axisOrder);
    const order = clean.map((_, i) => i).sort((a, b) => compareKeys(sortKey(clean[a]), sortKey(clean[b])));
    this.mapping = order;
    this.locations = order.map((i) => clean[i]);
    this.supports = computeSupports(this.locations);
    this.deltaWeights = this.locations.map((loc, i) => {
      /** @type {Map<number, number>} */
      const w = new Map();
      for (let j = 0; j < i; j++) {
        const s = supportScalar(loc, this.supports[j]);
        if (s) w.set(j, s);
      }
      return w;
    });
  }

  /**
   * Deltas (in model order) for values given in the original master order.
   * Values may be numbers or arrays of numbers.
   * @template {number | number[]} T
   * @param {T[]} masterValues
   * @returns {T[]}
   */
  getDeltas(masterValues) {
    const out = [];
    for (let i = 0; i < this.locations.length; i++) {
      let delta = masterValues[this.mapping[i]];
      delta = Array.isArray(delta) ? delta.slice() : delta;
      for (const [j, weight] of this.deltaWeights[i]) {
        if (Array.isArray(delta)) {
          const d = out[j];
          for (let k = 0; k < delta.length; k++) delta[k] -= d[k] * weight;
        } else delta -= out[j] * weight;
      }
      out.push(delta);
    }
    return /** @type {T[]} */ (out);
  }

  /**
   * @template {number | number[]} T
   * @param {Record<string, number>} location normalized
   * @param {T[]} deltas
   * @returns {T}
   */
  interpolateFromDeltas(location, deltas) {
    let acc = null;
    deltas.forEach((d, i) => {
      const s = supportScalar(location, this.supports[i]);
      if (!s) return;
      if (Array.isArray(d)) {
        if (!acc) acc = new Array(d.length).fill(0);
        for (let k = 0; k < d.length; k++) acc[k] += d[k] * s;
      } else acc = (acc ?? 0) + d * s;
    });
    if (acc === null) acc = Array.isArray(deltas[0]) ? new Array(deltas[0].length).fill(0) : 0;
    return /** @type {T} */ (acc);
  }
}

function locationSortKey(locations, axisOrder) {
  const axisPoints = {};
  for (const loc of locations) {
    const k = Object.keys(loc);
    if (k.length !== 1) continue;
    const axis = k[0];
    if (!axisPoints[axis]) axisPoints[axis] = new Set([0]);
    axisPoints[axis].add(loc[axis]);
  }
  const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
  return (loc) => {
    const axes = Object.keys(loc);
    const onPoint = axes.filter((a) => axisPoints[a] && axisPoints[a].has(loc[a]));
    const ordered = [...axisOrder.filter((a) => a in loc), ...axes.filter((a) => !axisOrder.includes(a)).sort()];
    return [
      axes.length,
      -onPoint.length,
      ordered.map((a) => (axisOrder.includes(a) ? axisOrder.indexOf(a) : 0x10000)),
      ordered,
      ordered.map((a) => sign(loc[a])),
      ordered.map((a) => Math.abs(loc[a])),
    ];
  };
}

function compareKeys(a, b) {
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (Array.isArray(x)) {
      for (let k = 0; k < Math.max(x.length, y.length); k++) {
        if (k >= x.length) return -1;
        if (k >= y.length) return 1;
        if (x[k] < y[k]) return -1;
        if (x[k] > y[k]) return 1;
      }
    } else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** @param {Array<Record<string, number>>} locations @returns {Support[]} */
function computeSupports(locations) {
  const minV = {};
  const maxV = {};
  for (const l of locations) {
    for (const [k, v] of Object.entries(l)) {
      minV[k] = Math.min(v, minV[k] ?? v);
      maxV[k] = Math.max(v, maxV[k] ?? v);
    }
  }
  const regions = locations.map((loc) => {
    /** @type {Support} */
    const r = {};
    for (const [axis, v] of Object.entries(loc)) r[axis] = v > 0 ? [0, v, maxV[axis]] : [minV[axis], v, 0];
    return r;
  });
  regions.forEach((region, i) => {
    const locAxes = Object.keys(region);
    for (const prev of regions.slice(0, i)) {
      const prevAxes = Object.keys(prev);
      if (!prevAxes.every((a) => locAxes.includes(a))) continue;
      let relevant = true;
      for (const [axis, [lower, peak, upper]] of Object.entries(region)) {
        const pv = prev[axis] ? prev[axis][1] : 0;
        if (!(pv === peak || (lower < pv && pv < upper))) {
          relevant = false;
          break;
        }
      }
      if (!relevant) continue;
      let bestRatio = -1;
      let best = {};
      for (const axis of prevAxes) {
        const val = prev[axis][1];
        const [lower, locV, upper] = region[axis];
        let newLower = lower;
        let newUpper = upper;
        let ratio;
        if (val < locV) {
          newLower = val;
          ratio = (val - locV) / (lower - locV);
        } else if (locV < val) {
          newUpper = val;
          ratio = (val - locV) / (upper - locV);
        } else continue;
        if (ratio > bestRatio) {
          best = {};
          bestRatio = ratio;
        }
        if (ratio === bestRatio) best[axis] = [newLower, locV, newUpper];
      }
      Object.assign(region, best);
    }
  });
  return regions;
}

/* ------------------------------------------------------------------ */
/* Masters                                                             */
/* ------------------------------------------------------------------ */

/**
 * Checks that every master glyph is point compatible with the default glyph
 * and returns a list of clear error messages.
 * @param {import('./model.mjs').Font} font
 */
export function checkCompatibility(font) {
  const errors = [];
  for (const master of font.masters || []) {
    for (const [name, mg] of Object.entries(master.glyphs || {})) {
      const g = font.glyphs[name];
      if (!g) {
        errors.push(`master "${master.name}" has glyph "${name}" which the default master does not have`);
        continue;
      }
      const dc = g.contours || [];
      const mc = mg.contours || [];
      if (dc.length !== mc.length) {
        errors.push(`glyph "${name}": master "${master.name}" has ${mc.length} contours, the default has ${dc.length}`);
        continue;
      }
      dc.forEach((c, ci) => {
        const a = c.points;
        const b = mc[ci].points;
        if (a.length !== b.length) {
          errors.push(`glyph "${name}" contour ${ci}: master "${master.name}" has ${b.length} points, the default has ${a.length}`);
          return;
        }
        for (let k = 0; k < a.length; k++) {
          if ((a[k].on !== false) !== (b[k].on !== false)) {
            errors.push(`glyph "${name}" contour ${ci} point ${k}: on curve in one master and off curve in "${master.name}"`);
            break;
          }
        }
      });
      const comps = g.components || [];
      if (mg.components && mg.components.length !== comps.length) {
        errors.push(`glyph "${name}": master "${master.name}" has ${mg.components.length} components, the default has ${comps.length}`);
      }
    }
    for (const a of Object.keys(master.location || {})) {
      if (!(font.axes || []).some((x) => x.tag === a)) errors.push(`master "${master.name}" uses axis "${a}" which is not in font.axes`);
    }
  }
  return errors;
}

/** Model over the default glyphs plus every master. */
function buildModel(font) {
  const axes = font.axes || [];
  const masters = font.masters || [];
  const locations = [{}, ...masters.map((m) => normalizeLocation(axes, m.location || {}))];
  return { model: new VariationModel(locations, axes.map((a) => a.tag)), locations };
}

/**
 * Coordinates of a glyph in every master as flat arrays
 * `[x0, y0, x1, y1, ..., advance]` (component offsets for composites).
 * @param {import('./model.mjs').Font} font
 * @param {string} name
 */
function masterVectors(font, name) {
  const g = font.glyphs[name];
  const vec = (contours, components, advance) => {
    const out = [];
    for (const c of contours) for (const p of c.points) out.push(p.x, p.y);
    for (const comp of components) out.push(comp.dx, comp.dy);
    out.push(advance);
    return out;
  };
  const base = vec(g.contours || [], g.components || [], g.advanceWidth);
  const list = [base];
  for (const m of font.masters || []) {
    const mg = m.glyphs?.[name];
    if (!mg) {
      list.push(base);
      continue;
    }
    list.push(vec(mg.contours || g.contours || [], mg.components || g.components || [], mg.advanceWidth ?? g.advanceWidth));
  }
  return list;
}

/* ------------------------------------------------------------------ */
/* Static instances                                                    */
/* ------------------------------------------------------------------ */

/** Standard weight names for named instances and STAT. */
export const WEIGHT_NAMES = [
  [100, 'Thin'], [200, 'ExtraLight'], [300, 'Light'], [400, 'Regular'], [500, 'Medium'],
  [600, 'SemiBold'], [700, 'Bold'], [800, 'ExtraBold'], [900, 'Black'],
];

/**
 * Named instances: `font.instances` when given, otherwise Thin 100 to Black
 * 900 along the weight axis (those inside its range), otherwise the default.
 * @param {import('./model.mjs').Font} font
 * @returns {Array<{ name: string, location: Record<string, number> }>}
 */
export function namedInstances(font) {
  if (font.instances && font.instances.length) return font.instances;
  const axes = font.axes || [];
  const defaults = Object.fromEntries(axes.map((a) => [a.tag, a.default]));
  const wght = axes.find((a) => a.tag === 'wght');
  if (wght) {
    const list = WEIGHT_NAMES.filter(([w]) => w >= wght.min && w <= wght.max)
      .map(([w, n]) => ({ name: String(n), location: { ...defaults, wght: Number(w) } }));
    if (list.length) return list;
  }
  return [{ name: font.meta.style || 'Regular', location: defaults }];
}

/**
 * Creates a static font at a design location, for example
 * `interpolate(font, { wght: 700 })`. Contours, component offsets and
 * advance widths are interpolated with the same model the variable font
 * uses; the result has no axes or masters.
 * @param {import('./model.mjs').Font} font
 * @param {Record<string, number>} location user coordinates
 * @returns {import('./model.mjs').Font}
 */
export function interpolate(font, location) {
  const axes = font.axes || [];
  if (!axes.length) throw new Error('interpolate: the font has no axes');
  const errors = checkCompatibility(font);
  if (errors.length) throw new Error(`interpolate: masters are not compatible:\n- ${errors.join('\n- ')}`);
  for (const tag of Object.keys(location)) {
    if (!axes.some((a) => a.tag === tag)) throw new Error(`interpolate: unknown axis "${tag}"`);
  }
  const { model } = buildModel(font);
  const loc = normalizeLocation(axes, location);
  const out = cloneFont(font);
  for (const name of Object.keys(font.glyphs)) {
    const deltas = model.getDeltas(masterVectors(font, name));
    const v = model.interpolateFromDeltas(loc, deltas);
    const g = out.glyphs[name];
    let k = 0;
    for (const c of g.contours) {
      for (const p of c.points) {
        p.x = round2(v[k++]);
        p.y = round2(v[k++]);
      }
    }
    for (const comp of g.components || []) {
      comp.dx = round2(v[k++]);
      comp.dy = round2(v[k++]);
    }
    g.advanceWidth = round2(v[k]);
  }
  delete out.axes;
  delete out.masters;
  delete out.instances;
  const full = Object.fromEntries(axes.map((a) => [a.tag, Math.max(a.min, Math.min(a.max, location[a.tag] ?? a.default))]));
  const named = namedInstances(font).find((i) => axes.every((a) => (i.location[a.tag] ?? a.default) === full[a.tag]));
  if (full.wght !== undefined) out.meta.weightClass = Math.max(1, Math.min(1000, Math.round(full.wght)));
  out.meta.style = named ? named.name : instanceStyle(axes, full);
  return out;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function instanceStyle(axes, loc) {
  const parts = [];
  for (const a of axes) {
    if (a.tag === 'wght') {
      const exact = WEIGHT_NAMES.find(([w]) => w === loc.wght);
      parts.push(exact ? exact[1] : `W${Math.round(loc.wght)}`);
    } else if (loc[a.tag] !== a.default) parts.push(`${a.tag}${Math.round(loc[a.tag])}`);
  }
  return parts.join(' ') || 'Regular';
}

/* ------------------------------------------------------------------ */
/* Table writers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Builds fvar, gvar, STAT and HVAR plus the name records they reference.
 * @param {import('./model.mjs').Font} font
 * @param {Array<{ name: string, contours: Array<Array<{ x: number, y: number, on: boolean }>>, components: Array<{ gid: number }>, advance: number, plan?: Array<{ index: number, reverse: boolean }> }>} glyphs prepared glyphs in glyph order
 * @param {Map<string, number>} _gidOf
 * @param {{ nameStart: number, warn?: (m: string) => void }} opts
 */
export function buildVariationTables(font, glyphs, _gidOf, opts) {
  const errors = checkCompatibility(font);
  if (errors.length) throw new Error(`fontsketch: masters are not point compatible:\n- ${errors.join('\n- ')}`);
  const axes = /** @type {Axis[]} */ (font.axes);
  for (const a of axes) {
    if (!(a.min <= a.default && a.default <= a.max)) throw new Error(`variable font: axis "${a.tag}" needs min <= default <= max`);
    if (!/^[\x20-\x7e]{4}$/.test(a.tag)) throw new Error(`variable font: axis tag "${a.tag}" must be four ASCII characters`);
  }
  const { model } = buildModel(font);
  const regions = model.supports.slice(1);
  /** @type {Array<[number, string]>} */
  const names = [];
  let nextName = opts.nameStart;
  const nameId = (text) => {
    const found = names.find(([, t]) => t === text);
    if (found) return found[0];
    names.push([nextName, text]);
    return nextName++;
  };
  const axisNameIds = axes.map((a) => nameId(a.name || a.tag));
  const instances = namedInstances(font);
  const family = font.meta.family;
  const psFamily = family.normalize('NFKD').replace(/[^\x21-\x7e]/g, '').replace(/[[\](){}<>/%]/g, '') || 'Untitled';

  // fvar
  const fvar = new Writer();
  const instanceSize = 4 + 4 * axes.length + 2;
  fvar.u16(1).u16(0).u16(16).u16(2).u16(axes.length).u16(20).u16(instances.length).u16(instanceSize);
  axes.forEach((a, i) => fvar.tag(a.tag).fixed(a.min).fixed(a.default).fixed(a.max).u16(0).u16(axisNameIds[i]));
  for (const inst of instances) {
    fvar.u16(inst.name === 'Regular' ? 2 : nameId(inst.name)).u16(0);
    for (const a of axes) fvar.fixed(inst.location[a.tag] ?? a.default);
    fvar.u16(nameId(`${psFamily}-${inst.name.replace(/[^\x21-\x7e]/g, '')}`));
  }

  // gvar
  const glyphData = glyphs.map((g) => {
    const vectors = masterVectors(font, g.name);
    const deltas = model.getDeltas(vectors);
    const pointCount = g.components.length ? g.components.length : g.contours.reduce((a, c) => a + c.length, 0);
    const tuples = [];
    for (let r = 1; r < deltas.length; r++) {
      const d = deltas[r];
      const dx = new Array(pointCount + 4).fill(0);
      const dy = new Array(pointCount + 4).fill(0);
      if (g.components.length) {
        const ncPts = (font.glyphs[g.name].contours || []).reduce((a, c) => a + c.points.length, 0);
        for (let i = 0; i < pointCount; i++) {
          dx[i] = Math.round(d[(ncPts + i) * 2]);
          dy[i] = Math.round(d[(ncPts + i) * 2 + 1]);
        }
      } else {
        const order = pointOrder(font.glyphs[g.name], g);
        order.forEach((src, i) => {
          dx[i] = Math.round(d[src * 2]);
          dy[i] = Math.round(d[src * 2 + 1]);
        });
      }
      dx[pointCount + 1] = Math.round(d[d.length - 1]);
      if (dx.every((v) => v === 0) && dy.every((v) => v === 0)) continue;
      tuples.push({ region: model.supports[r], dx, dy });
    }
    return encodeGlyphVariations(tuples, axes);
  });
  const gvar = new Writer();
  let total = 0;
  const offsets = [0];
  for (const gd of glyphData) {
    total += gd.length + (gd.length & 1);
    offsets.push(total);
  }
  const longOffsets = total / 2 > 0xffff;
  const headerSize = 20 + (glyphs.length + 1) * (longOffsets ? 4 : 2);
  gvar.u16(1).u16(0).u16(axes.length).u16(0).u32(headerSize).u16(glyphs.length).u16(longOffsets ? 1 : 0).u32(headerSize);
  for (const o of offsets) {
    if (longOffsets) gvar.u32(o);
    else gvar.u16(o / 2);
  }
  for (const gd of glyphData) {
    gvar.bytes(gd);
    if (gd.length & 1) gvar.u8(0);
  }

  // HVAR
  const advDeltas = glyphs.map((g) => {
    const vectors = masterVectors(font, g.name).map((v) => v[v.length - 1]);
    return model.getDeltas(vectors).slice(1).map((v) => Math.round(v));
  });
  const hvar = writeHVAR(axes, regions, advDeltas);

  // STAT
  const stat = writeSTAT(axes, axisNameIds, instances, nameId);

  return {
    tables: new Map([['fvar', fvar.toBytes()], ['gvar', gvar.toBytes()], ['HVAR', hvar], ['STAT', stat]]),
    names,
  };
}

/**
 * Index of each prepared point in the source glyph's coordinate vector
 * (prepared contours may be reversed by direction correction).
 */
function pointOrder(src, g) {
  const starts = [];
  let acc = 0;
  for (const c of src.contours || []) {
    starts.push(acc);
    acc += c.points.length;
  }
  const out = [];
  const plan = g.plan || (src.contours || []).map((_, index) => ({ index, reverse: false }));
  for (const { index, reverse } of plan) {
    const n = src.contours[index].points.length;
    const s = starts[index];
    if (!reverse) for (let k = 0; k < n; k++) out.push(s + k);
    else {
      out.push(s);
      for (let k = n - 1; k >= 1; k--) out.push(s + k);
    }
  }
  return out;
}

/**
 * One GlyphVariationData record with embedded peak tuples and all points.
 * @param {Array<{ region: Support, dx: number[], dy: number[] }>} tuples
 * @param {Axis[]} axes
 */
function encodeGlyphVariations(tuples, axes) {
  if (!tuples.length) return new Uint8Array(0);
  const headers = [];
  const bodies = [];
  for (const t of tuples) {
    const body = new Writer();
    packDeltas(body, t.dx);
    packDeltas(body, t.dy);
    const b = body.toBytes();
    const h = new Writer();
    const peak = axes.map((a) => t.region[a.tag]?.[1] ?? 0);
    const start = axes.map((a) => t.region[a.tag]?.[0] ?? 0);
    const end = axes.map((a) => t.region[a.tag]?.[2] ?? 0);
    const intermediate = axes.some((a, i) => start[i] !== Math.min(peak[i], 0) || end[i] !== Math.max(peak[i], 0));
    h.u16(b.length).u16(0x8000 | (intermediate ? 0x4000 : 0));
    for (const v of peak) h.f2dot14(v);
    if (intermediate) {
      for (const v of start) h.f2dot14(v);
      for (const v of end) h.f2dot14(v);
    }
    headers.push(h.toBytes());
    bodies.push(b);
  }
  const w = new Writer();
  const headerLen = headers.reduce((a, h) => a + h.length, 0);
  w.u16(0x8000 | tuples.length).u16(4 + headerLen);
  for (const h of headers) w.bytes(h);
  w.u8(0); // shared point numbers: all points
  for (const b of bodies) w.bytes(b);
  return w.toBytes();
}

/** Packed deltas: runs of zeros, bytes or words (at most 64 per run). */
function packDeltas(w, values) {
  let i = 0;
  while (i < values.length) {
    const v = values[i];
    if (v === 0) {
      let n = 0;
      while (i + n < values.length && values[i + n] === 0 && n < 64) n++;
      w.u8(0x80 | (n - 1));
      i += n;
    } else if (v >= -128 && v <= 127) {
      let n = 0;
      while (i + n < values.length && n < 64) {
        const x = values[i + n];
        if (x < -128 || x > 127) break;
        if (x === 0 && i + n + 1 < values.length && values[i + n + 1] === 0) break;
        n++;
      }
      w.u8(n - 1);
      for (let k = 0; k < n; k++) w.i8(values[i + k]);
      i += n;
    } else {
      let n = 0;
      while (i + n < values.length && n < 64) {
        const x = values[i + n];
        if (x === 0) break;
        if (x >= -128 && x <= 127 && i + n + 1 < values.length && values[i + n + 1] >= -128 && values[i + n + 1] <= 127) break;
        n++;
      }
      w.u8(0x40 | (n - 1));
      for (let k = 0; k < n; k++) w.i16(values[i + k]);
      i += n;
    }
  }
}

/**
 * Item variation store shared by HVAR (and usable by other tables).
 * @param {Axis[]} axes
 * @param {Support[]} regions
 * @param {number[][]} rows one row of deltas per item, one column per region
 */
export function writeItemVariationStore(axes, regions, rows) {
  const regionList = new Writer();
  regionList.u16(axes.length).u16(regions.length);
  for (const r of regions) {
    for (const a of axes) {
      const [s, p, e] = r[a.tag] || [0, 0, 0];
      regionList.f2dot14(s).f2dot14(p).f2dot14(e);
    }
  }
  const rl = regionList.toBytes();
  const words = rows.some((row) => row.some((v) => v < -128 || v > 127));
  const data = new Writer();
  data.u16(rows.length).u16(words ? regions.length : 0).u16(regions.length);
  for (let i = 0; i < regions.length; i++) data.u16(i);
  for (const row of rows) {
    for (let i = 0; i < regions.length; i++) {
      if (words) data.i16(row[i] || 0);
      else data.i8(row[i] || 0);
    }
  }
  const d = data.toBytes();
  const w = new Writer();
  w.u16(1).u32(12).u16(1).u32(12 + rl.length);
  w.bytes(rl).bytes(d);
  return w.toBytes();
}

function writeHVAR(axes, regions, rows) {
  const store = writeItemVariationStore(axes, regions, rows);
  const w = new Writer();
  w.u16(1).u16(0).u32(20).u32(0).u32(0).u32(0);
  w.bytes(store);
  return w.toBytes();
}

/**
 * STAT 1.1: one design axis record per axis and format 1 axis values for the
 * named instances (the default value is elidable).
 */
function writeSTAT(axes, axisNameIds, instances, nameId) {
  const values = [];
  axes.forEach((a, ai) => {
    const seen = new Set();
    for (const inst of instances) {
      const v = inst.location[a.tag] ?? a.default;
      if (seen.has(v)) continue;
      const others = axes.every((b) => b === a || (inst.location[b.tag] ?? b.default) === b.default);
      if (!others) continue;
      seen.add(v);
      values.push({ axisIndex: ai, value: v, name: inst.name, elidable: v === a.default });
    }
    if (!seen.has(a.default)) values.push({ axisIndex: ai, value: a.default, name: 'Regular', elidable: true });
  });
  const w = new Writer();
  const designAxesOffset = 20;
  const valueOffsetsOffset = designAxesOffset + axes.length * 8;
  w.u16(1).u16(1).u16(8).u16(axes.length).u32(designAxesOffset).u16(values.length).u32(valueOffsetsOffset).u16(2);
  axes.forEach((a, i) => w.tag(a.tag).u16(axisNameIds[i]).u16(i));
  const tableStart = values.length * 2;
  values.forEach((_, i) => w.u16(tableStart + i * 12));
  for (const v of values) w.u16(1).u16(v.axisIndex).u16(v.elidable ? 2 : 0).u16(v.name === 'Regular' ? 2 : nameId(v.name)).fixed(v.value);
  return w.toBytes();
}

/* ------------------------------------------------------------------ */
/* Readers                                                             */
/* ------------------------------------------------------------------ */

/**
 * @param {Uint8Array} b
 * @param {Record<number, string>} names
 */
export function readFvar(b, names) {
  const r = new Reader(b, 0, 'fvar');
  r.u32();
  const axesOff = r.u16();
  r.u16();
  const axisCount = r.u16();
  const axisSize = r.u16();
  const instanceCount = r.u16();
  const instanceSize = r.u16();
  const axes = [];
  for (let i = 0; i < axisCount; i++) {
    const ar = new Reader(b, axesOff + i * axisSize, 'fvar axis');
    const tag = ar.tag();
    const min = ar.fixed();
    const def = ar.fixed();
    const max = ar.fixed();
    ar.u16();
    const nameID = ar.u16();
    axes.push({ tag, name: names[nameID] || tag, min, default: def, max });
  }
  const instances = [];
  const instStart = axesOff + axisCount * axisSize;
  for (let i = 0; i < instanceCount; i++) {
    const ir = new Reader(b, instStart + i * instanceSize, 'fvar instance');
    const nameID = ir.u16();
    ir.u16();
    /** @type {Record<string, number>} */
    const location = {};
    for (const a of axes) location[a.tag] = ir.fixed();
    instances.push({ name: names[nameID] || `Instance ${i + 1}`, location });
  }
  return { axes, instances };
}

/** @param {Uint8Array} b */
export function readAvar(b) {
  const r = new Reader(b, 0, 'avar');
  r.u32();
  r.u16();
  const n = r.u16();
  const maps = [];
  for (let i = 0; i < n; i++) {
    const count = r.u16();
    const map = [];
    for (let k = 0; k < count; k++) map.push([r.f2dot14(), r.f2dot14()]);
    maps.push(map);
  }
  return maps;
}

/**
 * Reads gvar into per glyph tuple lists with explicit (possibly sparse)
 * point deltas.
 * @param {Uint8Array} b
 * @param {number} axisCount
 * @param {number[]} pointCounts points per glyph including the 4 phantom points
 * @returns {Array<Array<{ peak: number[], start: number[], end: number[], points: number[] | null, dx: number[], dy: number[] }>>}
 */
export function readGvar(b, axisCount, pointCounts) {
  const r = new Reader(b, 0, 'gvar');
  r.u32();
  const ac = r.u16();
  if (ac !== axisCount) throw new Error('gvar: axis count does not match fvar');
  const sharedCount = r.u16();
  const sharedOff = r.u32();
  const glyphCount = r.u16();
  const flags = r.u16();
  const dataOff = r.u32();
  const offsets = [];
  for (let i = 0; i <= glyphCount; i++) offsets.push(flags & 1 ? r.u32() : r.u16() * 2);
  const shared = [];
  const sr = new Reader(b, sharedOff, 'gvar shared tuples');
  for (let i = 0; i < sharedCount; i++) {
    const t = [];
    for (let k = 0; k < axisCount; k++) t.push(sr.f2dot14());
    shared.push(t);
  }
  const out = [];
  for (let g = 0; g < glyphCount; g++) {
    const start = dataOff + offsets[g];
    const end = dataOff + offsets[g + 1];
    if (end <= start) {
      out.push([]);
      continue;
    }
    out.push(readGlyphVariations(b.subarray(start, end), axisCount, shared, pointCounts[g] ?? 0));
  }
  return out;
}

function readGlyphVariations(b, axisCount, shared, pointCount) {
  const r = new Reader(b, 0, 'GlyphVariationData');
  const countWord = r.u16();
  const count = countWord & 0x0fff;
  const dataOffset = r.u16();
  const headers = [];
  for (let i = 0; i < count; i++) {
    const size = r.u16();
    const index = r.u16();
    let peak;
    if (index & 0x8000) {
      peak = [];
      for (let k = 0; k < axisCount; k++) peak.push(r.f2dot14());
    } else peak = shared[index & 0x0fff] || new Array(axisCount).fill(0);
    let start = peak.map((v) => Math.min(v, 0));
    let end = peak.map((v) => Math.max(v, 0));
    if (index & 0x4000) {
      start = [];
      end = [];
      for (let k = 0; k < axisCount; k++) start.push(r.f2dot14());
      for (let k = 0; k < axisCount; k++) end.push(r.f2dot14());
    }
    headers.push({ size, privatePoints: (index & 0x2000) !== 0, peak, start, end });
  }
  const dr = new Reader(b, dataOffset, 'gvar data');
  let sharedPoints = null;
  if (countWord & 0x8000) sharedPoints = readPackedPoints(dr);
  const tuples = [];
  for (const h of headers) {
    const startPos = dr.pos;
    const points = h.privatePoints ? readPackedPoints(dr) : sharedPoints;
    const n = points ? points.length : pointCount;
    const dx = readPackedDeltas(dr, n);
    const dy = readPackedDeltas(dr, n);
    dr.pos = startPos + h.size;
    tuples.push({ peak: h.peak, start: h.start, end: h.end, points, dx, dy });
  }
  return tuples;
}

/** @returns {number[] | null} null means all points */
function readPackedPoints(r) {
  let count = r.u8();
  if (count === 0) return null;
  if (count & 0x80) count = ((count & 0x7f) << 8) | r.u8();
  const pts = [];
  let last = 0;
  while (pts.length < count) {
    const ctrl = r.u8();
    const words = ctrl & 0x80;
    const n = (ctrl & 0x7f) + 1;
    for (let i = 0; i < n && pts.length < count; i++) {
      last += words ? r.u16() : r.u8();
      pts.push(last);
    }
  }
  return pts;
}

function readPackedDeltas(r, count) {
  const out = [];
  while (out.length < count) {
    const ctrl = r.u8();
    const n = (ctrl & 0x3f) + 1;
    if (ctrl & 0x80) for (let i = 0; i < n; i++) out.push(0);
    else if (ctrl & 0x40) for (let i = 0; i < n; i++) out.push(r.i16());
    else for (let i = 0; i < n; i++) out.push(r.i8());
  }
  return out.slice(0, count);
}

/**
 * Fills in deltas for points a tuple does not list (IUP), contour by contour.
 * @param {Array<{ x: number, y: number }>} coords outline points (no phantoms)
 * @param {number[]} ends end point index of each contour
 * @param {Array<number | null>} dx
 * @param {Array<number | null>} dy
 */
export function inferDeltas(coords, ends, dx, dy) {
  const outX = dx.map((v) => v ?? 0);
  const outY = dy.map((v) => v ?? 0);
  let start = 0;
  for (const end of ends) {
    const idx = [];
    for (let i = start; i <= end; i++) if (dx[i] !== null && dx[i] !== undefined) idx.push(i);
    if (idx.length && idx.length < end - start + 1) {
      for (let k = 0; k < idx.length; k++) {
        const i1 = idx[k];
        const i2 = idx[(k + 1) % idx.length];
        let p = i1 + 1 > end ? start : i1 + 1;
        while (p !== i2) {
          outX[p] = iup(coords[p].x, coords[i1].x, coords[i2].x, outX[i1], outX[i2]);
          outY[p] = iup(coords[p].y, coords[i1].y, coords[i2].y, outY[i1], outY[i2]);
          p = p + 1 > end ? start : p + 1;
        }
      }
    }
    start = end + 1;
  }
  return { dx: outX, dy: outY };
}

function iup(v, c1, c2, d1, d2) {
  if (c1 === c2) return d1 === d2 ? d1 : 0;
  const lo = c1 < c2 ? [c1, d1] : [c2, d2];
  const hi = c1 < c2 ? [c2, d2] : [c1, d1];
  if (v <= lo[0]) return lo[1];
  if (v >= hi[0]) return hi[1];
  return lo[1] + ((v - lo[0]) * (hi[1] - lo[1])) / (hi[0] - lo[0]);
}

/**
 * Reads advance deltas from HVAR for one glyph at a normalized location.
 * @param {Uint8Array} b
 * @returns {(gid: number, location: number[]) => number}
 */
export function readHVAR(b) {
  const r = new Reader(b, 0, 'HVAR');
  r.u32();
  const storeOff = r.u32();
  const advOff = r.u32();
  const store = readItemVariationStore(b, storeOff);
  const mapping = advOff ? readDeltaSetIndexMap(b, advOff) : null;
  return (gid, location) => {
    let outer = 0;
    let inner = gid;
    if (mapping) {
      const m = mapping[Math.min(gid, mapping.length - 1)];
      outer = m[0];
      inner = m[1];
    }
    return store.evaluate(outer, inner, location);
  };
}

function readItemVariationStore(b, off) {
  const r = new Reader(b, off, 'ItemVariationStore');
  r.u16();
  const regionOff = r.u32();
  const n = r.u16();
  const dataOffs = [];
  for (let i = 0; i < n; i++) dataOffs.push(r.u32());
  const rr = new Reader(b, off + regionOff, 'VariationRegionList');
  const axisCount = rr.u16();
  const regionCount = rr.u16();
  const regions = [];
  for (let i = 0; i < regionCount; i++) {
    const axes = [];
    for (let k = 0; k < axisCount; k++) axes.push([rr.f2dot14(), rr.f2dot14(), rr.f2dot14()]);
    regions.push(axes);
  }
  const datas = dataOffs.map((o) => {
    const dr = new Reader(b, off + o, 'ItemVariationData');
    const itemCount = dr.u16();
    const wordCountRaw = dr.u16();
    const longWords = (wordCountRaw & 0x8000) !== 0;
    const wordCount = wordCountRaw & 0x7fff;
    const regionIndexCount = dr.u16();
    const regionIndexes = [];
    for (let i = 0; i < regionIndexCount; i++) regionIndexes.push(dr.u16());
    const rows = [];
    for (let i = 0; i < itemCount; i++) {
      const row = [];
      for (let k = 0; k < regionIndexCount; k++) {
        if (k < wordCount) row.push(longWords ? dr.i32() : dr.i16());
        else row.push(longWords ? dr.i16() : dr.i8());
      }
      rows.push(row);
    }
    return { regionIndexes, rows };
  });
  return {
    evaluate(outer, inner, location) {
      const d = datas[outer];
      if (!d || !d.rows[inner]) return 0;
      let total = 0;
      d.regionIndexes.forEach((ri, k) => {
        let s = 1;
        regions[ri].forEach(([lo, peak, hi], ai) => {
          if (peak === 0 || s === 0) return;
          const v = location[ai] ?? 0;
          if (v === peak) return;
          if (v <= lo || v >= hi) s = 0;
          else s *= v < peak ? (v - lo) / (peak - lo) : (v - hi) / (peak - hi);
        });
        total += s * d.rows[inner][k];
      });
      return total;
    },
  };
}

function readDeltaSetIndexMap(b, off) {
  const r = new Reader(b, off, 'DeltaSetIndexMap');
  const format = r.u8();
  const entryFormat = r.u8();
  const count = format === 0 ? r.u16() : r.u32();
  const size = ((entryFormat >> 4) & 3) + 1;
  const innerBits = (entryFormat & 15) + 1;
  const out = [];
  for (let i = 0; i < count; i++) {
    let v = 0;
    for (let k = 0; k < size; k++) v = v * 256 + r.u8();
    out.push([Math.floor(v / 2 ** innerBits), v % 2 ** innerBits]);
  }
  return out;
}

/**
 * Decomposes glyphs that mix contours and components (TrueType cannot store
 * both in one glyph) in the default master and in every master, so the
 * variable font keeps point compatible outlines.
 * @param {import('./model.mjs').Font} font
 * @returns {import('./model.mjs').Font}
 */
export function decomposeMixedGlyphs(font) {
  const mixed = Object.values(font.glyphs).filter((g) => (g.components || []).length && (g.contours || []).some((c) => c.points.length));
  if (!mixed.length) return font;
  const out = cloneFont(font);
  const resolve = (glyphs, fallback, name, stack) => {
    if (stack.includes(name)) throw new Error(`fontsketch: glyph "${name}" contains itself through its components`);
    const g = glyphs[name] || fallback[name];
    const own = (g.contours || fallback[name].contours || []).map((c) => ({ ...c, points: c.points.map((p) => ({ ...p })) }));
    const comps = g.components || fallback[name].components || [];
    for (const c of comps) {
      const m = Array.isArray(c.transform) ? c.transform : [c.scale ?? 1, 0, 0, c.scale ?? 1];
      for (const sub of resolve(glyphs, fallback, c.glyph, [...stack, name])) {
        own.push({ ...sub, points: sub.points.map((p) => ({ ...p, x: m[0] * p.x + m[2] * p.y + c.dx, y: m[1] * p.x + m[3] * p.y + c.dy })) });
      }
    }
    return own;
  };
  for (const g of mixed) {
    out.glyphs[g.name].contours = resolve(font.glyphs, font.glyphs, g.name, []);
    out.glyphs[g.name].components = [];
    for (const [mi, m] of (font.masters || []).entries()) {
      const merged = { ...font.glyphs, ...Object.fromEntries(Object.entries(m.glyphs || {}).map(([k, v]) => [k, { ...font.glyphs[k], ...v }])) };
      const mo = /** @type {any} */ (out.masters)[mi];
      mo.glyphs[g.name] = { ...(mo.glyphs[g.name] || {}), contours: resolve(merged, font.glyphs, g.name, []), components: [] };
    }
  }
  return out;
}
