// Hinting: a TrueType autohinter (blue zones, stem detection, fpgm, prep,
// cvt, per glyph programs and gasp), manual stem hints and CFF stem hints.
//
// The TrueType programs work on the Y axis, which is the direction modern
// rasterizers still honour: points on blue zones snap to rounded zone
// heights shared by every glyph, stems keep a consistent pixel height taken
// from the control value table, and IUP interpolates everything else.

import { windingNumber } from './geometry.mjs';
import { Writer } from './binary.mjs';

/** @typedef {{ x: number, y: number, on: boolean }} IntPoint */
/**
 * @typedef {{ name: string, kind: 'top' | 'bottom', flat: number, overshoot: number }} Zone
 * @typedef {{
 *   zones: Zone[], blueValues: number[], otherBlues: number[], stdHW?: number, stdVW?: number,
 * }} ZoneInfo
 */
/**
 * @typedef {{ pos: number, kind: 'top' | 'bottom', points: number[], from: number, to: number }} Edge
 * An edge is a set of points at the same height (or width for X edges);
 * `kind` tells on which side the ink is (`bottom` edges have ink above,
 * `left` edges are encoded as `bottom` too). `from`/`to` give the extent
 * along the other axis.
 */

/* ------------------------------------------------------------------ */
/* Blue zones                                                          */
/* ------------------------------------------------------------------ */

/**
 * Finds alignment zones from the font metrics and, when present, from
 * reference glyphs (o, O, x, H, b, d, h, k, l, p, q).
 * @param {import('./model.mjs').Font} font
 * @returns {ZoneInfo}
 */
export function detectZones(font) {
  const m = font.meta;
  const upm = m.unitsPerEm;
  const maxOvershoot = upm * 0.04;
  const box = (name) => {
    const g = font.glyphs[name];
    if (!g || !g.contours || !g.contours.length) return null;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const c of g.contours) for (const p of c.points) {
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
    return yMin === Infinity ? null : { yMin: Math.round(yMin), yMax: Math.round(yMax) };
  };
  const median = (vals) => {
    const v = vals.filter((x) => x !== null).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  };
  const xTop = box('x')?.yMax ?? m.xHeight;
  const hTop = box('H')?.yMax ?? m.capHeight;
  const ascTop = median(['b', 'd', 'h', 'k', 'l'].map((n) => box(n)?.yMax ?? null)) ?? m.ascender;
  const descBottom = median(['p', 'q'].map((n) => box(n)?.yMin ?? null)) ?? m.descender;
  const roundBottom = Math.min(box('o')?.yMin ?? 0, box('O')?.yMin ?? 0);
  const xOver = box('o')?.yMax ?? xTop;
  const capOver = box('O')?.yMax ?? hTop;
  const os = (flat, value, up) => {
    const d = value - flat;
    return (up ? d >= 0 : d <= 0) && Math.abs(d) <= maxOvershoot ? value : flat;
  };
  /** @type {Zone[]} */
  const zones = [
    { name: 'baseline', kind: 'bottom', flat: 0, overshoot: os(0, roundBottom, false) },
    { name: 'xheight', kind: 'top', flat: xTop, overshoot: os(xTop, xOver, true) },
    { name: 'capheight', kind: 'top', flat: hTop, overshoot: os(hTop, capOver, true) },
    { name: 'ascender', kind: 'top', flat: ascTop, overshoot: ascTop },
    { name: 'descender', kind: 'bottom', flat: descBottom, overshoot: descBottom },
  ];
  // Drop zones that duplicate an earlier one.
  const unique = [];
  for (const z of zones) {
    if (unique.some((u) => u.kind === z.kind && Math.abs(u.flat - z.flat) <= upm * 0.01)) continue;
    unique.push(z);
  }
  const pairs = unique.map((z) => (z.kind === 'bottom' ? [z.overshoot, z.flat] : [z.flat, z.overshoot]));
  const baselinePair = pairs[0];
  const tops = pairs.filter((_, i) => i > 0 && unique[i].kind === 'top').sort((a, b) => a[0] - b[0]);
  const bottoms = pairs.filter((_, i) => i > 0 && unique[i].kind === 'bottom').sort((a, b) => a[0] - b[0]);
  const blueValues = [baselinePair, ...tops].slice(0, 7).flat();
  const otherBlues = bottoms.slice(0, 5).flat();
  const stems = dominantStems(font);
  return { zones: unique, blueValues, otherBlues, stdHW: stems.h, stdVW: stems.v };
}

/** Typical horizontal and vertical stem thickness from reference glyphs. */
function dominantStems(font) {
  const h = [];
  const v = [];
  for (const name of ['H', 'O', 'o', 'n', 'l', 'I', 'e', 'E', 'T', 'x']) {
    const g = font.glyphs[name];
    if (!g || !g.contours?.length) continue;
    const contours = g.contours.map((c) => c.points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), on: p.on !== false })));
    const limit = font.meta.unitsPerEm * 0.25;
    for (const s of findStems(contours, 'y', limit)) h.push(s.width);
    for (const s of findStems(contours, 'x', limit)) v.push(s.width);
  }
  const mode = (list) => {
    if (!list.length) return undefined;
    const counts = new Map();
    for (const x of list) counts.set(x, (counts.get(x) || 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  };
  return { h: mode(h), v: mode(v) };
}

/* ------------------------------------------------------------------ */
/* Edges and stems                                                     */
/* ------------------------------------------------------------------ */

/**
 * Finds horizontal (axis `y`) or vertical (axis `x`) edges: straight runs
 * along the axis and curve extrema. Point numbers follow the TrueType
 * numbering of `contours` (all contours concatenated).
 * @param {IntPoint[][]} contours
 * @param {'x' | 'y'} axis
 * @returns {Edge[]}
 */
export function findEdges(contours, axis) {
  const other = axis === 'y' ? 'x' : 'y';
  const shapes = contours.map((points) => ({ closed: true, points }));
  /** @type {Edge[]} */
  const edges = [];
  let base = 0;
  for (const c of contours) {
    const n = c.length;
    for (let i = 0; i < n; i++) {
      const p = c[i];
      if (!p.on) continue;
      const prev = c[(i - 1 + n) % n];
      const next = c[(i + 1) % n];
      let points = null;
      let from = p[other];
      let to = p[other];
      if (next.on && next[axis] === p[axis] && next[other] !== p[other]) {
        points = [base + i, base + ((i + 1) % n)];
        from = Math.min(p[other], next[other]);
        to = Math.max(p[other], next[other]);
      } else if (!prev.on && !next.on && prev[axis] === p[axis] && next[axis] === p[axis]) {
        points = [base + i];
        from = Math.min(prev[other], next[other]);
        to = Math.max(prev[other], next[other]);
      }
      if (!points) continue;
      const mid = (from + to) / 2;
      const probe = (d) => (axis === 'y' ? windingNumber(mid, p.y + d, shapes) : windingNumber(p.x + d, mid, shapes)) !== 0;
      const after = probe(0.5);
      const before = probe(-0.5);
      if (after === before) continue;
      edges.push({ pos: p[axis], kind: after ? 'bottom' : 'top', points, from, to });
    }
    base += n;
  }
  // Merge edges at the same position and side that overlap or touch.
  edges.sort((a, b) => a.pos - b.pos || a.from - b.from);
  const merged = [];
  for (const e of edges) {
    const last = merged[merged.length - 1];
    if (last && last.pos === e.pos && last.kind === e.kind && e.from <= last.to + 1) {
      for (const pt of e.points) if (!last.points.includes(pt)) last.points.push(pt);
      last.to = Math.max(last.to, e.to);
    } else merged.push({ ...e, points: [...e.points] });
  }
  return merged;
}

/**
 * Pairs bottom (or left) edges with the nearest overlapping top (or right)
 * edge to form stems.
 * @param {IntPoint[][]} contours
 * @param {'x' | 'y'} axis
 * @param {number} maxWidth
 * @param {Edge[]} [edges]
 */
export function findStems(contours, axis, maxWidth, edges = findEdges(contours, axis)) {
  const stems = [];
  const used = new Set();
  for (const b of edges) {
    if (b.kind !== 'bottom') continue;
    let best = null;
    for (const t of edges) {
      if (t.kind !== 'top' || t.pos <= b.pos || t.pos - b.pos > maxWidth || used.has(t)) continue;
      if (Math.min(b.to, t.to) < Math.max(b.from, t.from)) continue;
      if (!best || t.pos < best.pos) best = t;
    }
    if (best) {
      used.add(best);
      stems.push({ bottom: b, top: best, pos: b.pos, width: best.pos - b.pos });
    }
  }
  return stems;
}

/* ------------------------------------------------------------------ */
/* TrueType bytecode helpers                                           */
/* ------------------------------------------------------------------ */

const OP = {
  SVTCA_Y: 0x00,
  SVTCA_X: 0x01,
  SRP0: 0x10,
  SLOOP: 0x17,
  SCVTCI: 0x1d,
  DUP: 0x20,
  CALL: 0x2b,
  FDEF: 0x2c,
  ENDF: 0x2d,
  LOOPCALL: 0x2a,
  MDAP_ROUND: 0x2f,
  IUP_Y: 0x30,
  IUP_X: 0x31,
  ALIGNRP: 0x3c,
  MIAP_ROUND: 0x3f,
  WCVTP: 0x44,
  RCVT: 0x45,
  ROUND_GRAY: 0x68,
  SCANCTRL: 0x85,
  SCANTYPE: 0x8d,
  MIRP_STEM: 0xfd, // MIRP[rp0, min distance, round, black]
};

/** Instruction stream builder that tracks the deepest stack it needs. */
class Program {
  constructor() {
    this.w = new Writer();
    this.depth = 0;
    this.maxDepth = 0;
  }

  /** @param {number[]} values */
  push(...values) {
    for (let i = 0; i < values.length;) {
      const chunk = values.slice(i, i + 255);
      const words = chunk.some((v) => v < 0 || v > 255);
      if (chunk.length <= 8) this.w.u8((words ? 0xb8 : 0xb0) + chunk.length - 1);
      else this.w.u8(words ? 0x41 : 0x40).u8(chunk.length);
      for (const v of chunk) {
        if (words) this.w.i16(v);
        else this.w.u8(v);
      }
      i += chunk.length;
    }
    this.depth += values.length;
    this.maxDepth = Math.max(this.maxDepth, this.depth);
    return this;
  }

  /** @param {number} op @param {number} [pops] */
  op(op, pops = 0) {
    this.w.u8(op);
    this.depth = Math.max(0, this.depth - pops);
    return this;
  }

  bytes() {
    return this.w.toBytes();
  }
}

/** fpgm: 0 rounds a CVT entry, 1 places a free stem, 2 places a stem from an anchored edge. */
function buildFpgm() {
  const p = new Program();
  p.push(2, 1, 0);
  p.op(OP.FDEF, 1).op(OP.DUP).op(OP.RCVT).op(OP.ROUND_GRAY).op(OP.WCVTP).op(OP.ENDF);
  p.op(OP.FDEF, 1).op(OP.MDAP_ROUND).op(OP.MIRP_STEM).op(OP.ENDF);
  p.op(OP.FDEF, 1).op(OP.SRP0).op(OP.MIRP_STEM).op(OP.ENDF);
  return p.bytes();
}

/* ------------------------------------------------------------------ */
/* TrueType hinting                                                    */
/* ------------------------------------------------------------------ */

/**
 * Builds fpgm, prep, cvt, gasp and the glyph programs.
 * In `auto` mode stems are detected; in `manual` mode `glyph.hints.stems`
 * are used (and `glyph.hints.instructions`, when present, is used as is).
 * @param {Array<{ contours: IntPoint[][], components: unknown[], source: import('./model.mjs').Glyph }>} glyphs
 * @param {import('./model.mjs').Font} font
 * @param {'auto' | 'manual'} mode
 * @param {(m: string) => void} [warn]
 */
export function buildTrueTypeHinting(glyphs, font, mode, warn = () => {}) {
  const upm = font.meta.unitsPerEm;
  const info = detectZones(font);
  const tol = Math.max(2, Math.round(upm * 0.012));
  /** @type {number[]} */
  const cvt = [];
  const cvtIndex = (v) => {
    let i = cvt.indexOf(v);
    if (i < 0) {
      i = cvt.length;
      cvt.push(v);
    }
    return i;
  };
  const zoneCvts = info.zones.map((z) => ({ zone: z, flat: cvtIndex(z.flat), over: cvtIndex(z.overshoot) }));
  const zoneCount = cvt.length;
  // Stem widths shared across glyphs.
  const maxStem = upm * 0.25;
  const perGlyph = glyphs.map((g) => {
    if (g.components.length || !g.contours.length) return null;
    const edges = findEdges(g.contours, 'y');
    let stems;
    if (mode === 'manual') {
      const wanted = g.source.hints?.stems?.h || [];
      stems = wanted.map(([pos, width]) => {
        const bottom = edges.find((e) => Math.abs(e.pos - pos) <= 1);
        const top = edges.find((e) => Math.abs(e.pos - (pos + width)) <= 1);
        return bottom && top && bottom !== top ? { bottom, top, pos: bottom.pos, width: top.pos - bottom.pos } : null;
      }).filter(Boolean);
    } else stems = findStems(g.contours, 'y', maxStem, edges);
    const vEdges = mode === 'manual' && g.source.hints?.stems?.v?.length ? findEdges(g.contours, 'x') : [];
    const vStems = vEdges.length
      ? /** @type {number[][]} */ (g.source.hints?.stems?.v || []).map(([pos, width]) => {
        const left = vEdges.find((e) => Math.abs(e.pos - pos) <= 1);
        const right = vEdges.find((e) => Math.abs(e.pos - (pos + width)) <= 1);
        return left && right && left !== right ? { bottom: left, top: right, pos: left.pos, width: right.pos - left.pos } : null;
      }).filter(Boolean)
      : [];
    return { edges, stems, vStems };
  });
  const widths = [];
  for (const pg of perGlyph) if (pg) for (const s of [...pg.stems, ...pg.vStems]) widths.push(s.width);
  const stemCvts = clusterWidths(widths, upm).map(cvtIndex);
  const nearestStemCvt = (w) => {
    let best = stemCvts[0];
    for (const i of stemCvts) if (Math.abs(cvt[i] - w) < Math.abs(cvt[best] - w)) best = i;
    return best !== undefined && Math.abs(cvt[best] - w) <= Math.max(2, w * 0.2) ? best : cvtIndex(w);
  };

  /** @type {Map<number, Uint8Array>} */
  const glyphInstructions = new Map();
  let maxStack = 0;
  let maxSize = 0;
  glyphs.forEach((g, gid) => {
    const own = g.source.hints?.instructions;
    if (mode === 'manual' && own && own.length) {
      glyphInstructions.set(gid, own);
      maxSize = Math.max(maxSize, own.length);
      maxStack = Math.max(maxStack, 64);
      return;
    }
    const pg = perGlyph[gid];
    if (!pg) return;
    const p = new Program();
    p.op(OP.SVTCA_Y);
    const anchored = new Set();
    let touched = false;
    for (const e of pg.edges) {
      const z = zoneCvts.find(({ zone }) => zone.kind === e.kind && inZone(e.pos, zone, tol));
      if (!z) continue;
      const exact = Math.abs(e.pos - z.zone.flat) <= tol ? z.flat : z.over;
      p.push(e.points[0], exact).op(OP.MIAP_ROUND, 2);
      alignRest(p, e);
      anchored.add(e);
      touched = true;
    }
    for (const s of pg.stems) {
      const c = nearestStemCvt(s.width);
      if (anchored.has(s.bottom) && anchored.has(s.top)) continue;
      if (anchored.has(s.bottom)) {
        p.push(s.top.points[0], c, s.bottom.points[0], 2).op(OP.CALL, 4);
        alignRest(p, s.top);
      } else if (anchored.has(s.top)) {
        p.push(s.bottom.points[0], c, s.top.points[0], 2).op(OP.CALL, 4);
        alignRest(p, s.bottom);
      } else {
        p.push(s.top.points[0], c, s.bottom.points[0], 1).op(OP.CALL, 4);
        alignRest(p, s.top);
        if (s.bottom.points.length > 1) {
          p.push(...s.bottom.points.slice(1), s.bottom.points.length - 1, s.bottom.points[0]).op(OP.SRP0, 1).op(OP.SLOOP, 1).op(OP.ALIGNRP, s.bottom.points.length - 1);
        }
      }
      anchored.add(s.bottom);
      anchored.add(s.top);
      touched = true;
    }
    if (!touched) return;
    p.op(OP.IUP_Y);
    if (pg.vStems.length) {
      p.op(OP.SVTCA_X);
      for (const s of pg.vStems) {
        p.push(s.top.points[0], nearestStemCvt(s.width), s.bottom.points[0], 1).op(OP.CALL, 4);
        alignRest(p, s.top);
      }
      p.op(OP.IUP_X);
    }
    const bytes = p.bytes();
    glyphInstructions.set(gid, bytes);
    maxStack = Math.max(maxStack, p.maxDepth);
    maxSize = Math.max(maxSize, bytes.length);
  });
  if (mode === 'manual' && !glyphInstructions.size) warn('manual hinting: no glyph had stems or instructions that matched its outline');

  const prep = new Program();
  prep.push(511).op(OP.SCANCTRL, 1);
  prep.push(4).op(OP.SCANTYPE, 1);
  prep.push(68).op(OP.SCVTCI, 1);
  if (zoneCount) {
    const idx = Array.from({ length: zoneCount }, (_, i) => i);
    prep.push(...idx, zoneCount, 0).op(OP.LOOPCALL, zoneCount + 2);
  }
  const cvtW = new Writer(cvt.length * 2);
  for (const v of cvt) cvtW.i16(v);
  const gasp = new Writer(12);
  gasp.u16(1).u16(2).u16(8).u16(0x000a).u16(0xffff).u16(0x000f);
  return {
    fpgm: buildFpgm(),
    prep: prep.bytes(),
    cvt: cvtW.toBytes(),
    gasp: gasp.toBytes(),
    glyphInstructions,
    maxp: {
      maxZones: 2,
      maxTwilightPoints: 0,
      maxStorage: 0,
      maxFunctionDefs: 3,
      maxInstructionDefs: 0,
      maxStackElements: Math.max(maxStack, prep.maxDepth, 3) + 4,
      maxSizeOfInstructions: maxSize,
    },
    cvtValues: cvt,
    zones: info.zones,
  };
}

/** Moves the remaining points of an edge to the reference point (rp0). */
function alignRest(p, e) {
  if (e.points.length < 2) return;
  const rest = e.points.slice(1);
  p.push(...rest, rest.length, e.points[0]).op(OP.SRP0, 1).op(OP.SLOOP, 1).op(OP.ALIGNRP, rest.length);
}

/** @param {number} y @param {Zone} z @param {number} tol */
function inZone(y, z, tol) {
  const lo = Math.min(z.flat, z.overshoot) - tol;
  const hi = Math.max(z.flat, z.overshoot) + tol;
  return y >= lo && y <= hi;
}

/** Groups stem widths and returns the most frequent representatives (at most 6). */
function clusterWidths(widths, upm) {
  const step = Math.max(1, Math.round(upm * 0.005));
  const counts = new Map();
  for (const w of widths) {
    const k = Math.round(w / step) * step;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 6).map(([w]) => w);
}

/* ------------------------------------------------------------------ */
/* CFF hints                                                           */
/* ------------------------------------------------------------------ */

/**
 * Horizontal and vertical stem hints for a CFF charstring.
 * @param {{ flat: IntPoint[][], source: import('./model.mjs').Glyph }} g
 * @param {ZoneInfo} _zones
 * @param {'auto' | 'manual'} mode
 * @returns {{ hstems: Array<[number, number]>, vstems: Array<[number, number]> }}
 */
export function autoHintCFF(g, _zones, mode) {
  if (mode === 'manual') {
    const st = g.source.hints?.stems || {};
    return { hstems: /** @type {Array<[number, number]>} */ (st.h || []), vstems: /** @type {Array<[number, number]>} */ (st.v || []) };
  }
  if (!g.flat.length) return { hstems: [], vstems: [] };
  let maxY = -Infinity;
  let minY = Infinity;
  for (const c of g.flat) for (const p of c) {
    maxY = Math.max(maxY, p.y);
    minY = Math.min(minY, p.y);
  }
  const limit = Math.max(20, (maxY - minY) * 0.6);
  const toPairs = (stems) => stems.map((s) => /** @type {[number, number]} */ ([s.pos, s.width]));
  return { hstems: toPairs(findStems(g.flat, 'y', limit)), vstems: toPairs(findStems(g.flat, 'x', limit)) };
}

/* ------------------------------------------------------------------ */
/* Hint text format                                                    */
/* ------------------------------------------------------------------ */

/**
 * Parses the editor's plain text hint format:
 *
 *     # comments start with a hash
 *     hstem 0 80      horizontal stem: bottom edge at y = 0, 80 units tall
 *     vstem 120 90    vertical stem: left edge at x = 120, 90 units wide
 *
 * @param {string} text
 * @returns {{ stems: { h: Array<[number, number]>, v: Array<[number, number]> } }}
 */
export function parseHintText(text) {
  /** @type {{ h: Array<[number, number]>, v: Array<[number, number]> }} */
  const stems = { h: [], v: [] };
  String(text).split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) return;
    const m = /^(hstem|vstem)\s+(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/i.exec(line);
    if (!m) throw new SyntaxError(`hints line ${i + 1}: expected "hstem <position> <width>" or "vstem <position> <width>"`);
    const entry = /** @type {[number, number]} */ ([Number(m[2]), Number(m[3])]);
    (m[1].toLowerCase() === 'hstem' ? stems.h : stems.v).push(entry);
  });
  return { stems };
}

/**
 * Writes hints back to the text format.
 * @param {{ stems?: { h?: Array<[number, number]>, v?: Array<[number, number]> } }} hints
 */
export function formatHintText(hints) {
  const lines = [];
  for (const [p, w] of hints.stems?.h || []) lines.push(`hstem ${p} ${w}`);
  for (const [p, w] of hints.stems?.v || []) lines.push(`vstem ${p} ${w}`);
  return lines.join('\n');
}
