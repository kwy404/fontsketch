// TrueType glyf and loca tables: simple and composite glyph encoding.

import { Reader, Writer } from './binary.mjs';

const ON_CURVE = 0x01;
const X_SHORT = 0x02;
const Y_SHORT = 0x04;
const REPEAT = 0x08;
const X_SAME = 0x10;
const Y_SAME = 0x20;
const OVERLAP_SIMPLE = 0x40;

export const ARG_WORDS = 0x0001;
export const ARGS_XY = 0x0002;
export const ROUND_XY = 0x0004;
export const HAS_SCALE = 0x0008;
export const MORE_COMPONENTS = 0x0020;
export const HAS_XY_SCALE = 0x0040;
export const HAS_2X2 = 0x0080;
export const HAS_INSTRUCTIONS = 0x0100;
export const USE_MY_METRICS = 0x0200;
export const OVERLAP_COMPOUND = 0x0400;

/** @typedef {{ x: number, y: number, on: boolean }} IntPoint */
/** @typedef {{ xMin: number, yMin: number, xMax: number, yMax: number }} Box */
/**
 * @typedef {{ glyphIndex: number, dx: number, dy: number, transform?: [number, number, number, number],
 *   flags?: number, matchPoints?: [number, number] }} GlyfComponent
 */

/** @param {IntPoint[][]} contours */
export function pointBounds(contours) {
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  for (const c of contours) {
    for (const p of c) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
  }
  return xMin === Infinity ? { xMin: 0, yMin: 0, xMax: 0, yMax: 0 } : { xMin, yMin, xMax, yMax };
}

/**
 * Encodes a simple glyph. Contours must hold integer coordinates.
 * @param {IntPoint[][]} contours
 * @param {Uint8Array} [instructions]
 * @param {{ overlap?: boolean }} [options]
 * @returns {Uint8Array}
 */
export function encodeSimpleGlyph(contours, instructions = new Uint8Array(0), options = {}) {
  const list = contours.filter((c) => c.length > 0);
  if (!list.length) return new Uint8Array(0);
  const box = pointBounds(list);
  const w = new Writer();
  w.i16(list.length).i16(box.xMin).i16(box.yMin).i16(box.xMax).i16(box.yMax);
  let end = -1;
  for (const c of list) {
    end += c.length;
    w.u16(end);
  }
  w.u16(instructions.length).bytes(instructions);
  const flags = [];
  const xs = new Writer();
  const ys = new Writer();
  let px = 0;
  let py = 0;
  for (const c of list) {
    for (const p of c) {
      let f = p.on ? ON_CURVE : 0;
      const dx = p.x - px;
      const dy = p.y - py;
      if (dx === 0) f |= X_SAME;
      else if (dx >= -255 && dx <= 255) {
        f |= X_SHORT;
        if (dx > 0) f |= X_SAME;
        xs.u8(Math.abs(dx));
      } else xs.i16(dx);
      if (dy === 0) f |= Y_SAME;
      else if (dy >= -255 && dy <= 255) {
        f |= Y_SHORT;
        if (dy > 0) f |= Y_SAME;
        ys.u8(Math.abs(dy));
      } else ys.i16(dy);
      flags.push(f);
      px = p.x;
      py = p.y;
    }
  }
  if (options.overlap && flags.length) flags[0] |= OVERLAP_SIMPLE;
  for (let i = 0; i < flags.length;) {
    let run = 1;
    while (i + run < flags.length && flags[i + run] === flags[i] && run < 256) run++;
    if (run > 1) {
      w.u8(flags[i] | REPEAT).u8(run - 1);
    } else w.u8(flags[i]);
    i += run;
  }
  w.bytes(xs.toBytes()).bytes(ys.toBytes());
  return w.toBytes();
}

/**
 * Encodes a composite glyph.
 * @param {GlyfComponent[]} components
 * @param {Box} box
 * @param {Uint8Array} [instructions]
 * @param {{ useMyMetrics?: number, overlap?: boolean, roundToGrid?: boolean }} [options]
 */
export function encodeCompositeGlyph(components, box, instructions, options = {}) {
  const w = new Writer();
  w.i16(-1).i16(box.xMin).i16(box.yMin).i16(box.xMax).i16(box.yMax);
  components.forEach((c, i) => {
    let flags = ARGS_XY;
    if (options.roundToGrid !== false) flags |= ROUND_XY;
    const words = c.dx < -128 || c.dx > 127 || c.dy < -128 || c.dy > 127;
    if (words) flags |= ARG_WORDS;
    const t = c.transform;
    if (t && !(t[0] === 1 && t[1] === 0 && t[2] === 0 && t[3] === 1)) {
      if (t[1] === 0 && t[2] === 0) flags |= t[0] === t[3] ? HAS_SCALE : HAS_XY_SCALE;
      else flags |= HAS_2X2;
    }
    if (i < components.length - 1) flags |= MORE_COMPONENTS;
    if (i === components.length - 1 && instructions && instructions.length) flags |= HAS_INSTRUCTIONS;
    if (options.useMyMetrics === i) flags |= USE_MY_METRICS;
    if (i === 0 && options.overlap) flags |= OVERLAP_COMPOUND;
    w.u16(flags).u16(c.glyphIndex);
    if (words) w.i16(c.dx).i16(c.dy);
    else w.i8(c.dx).i8(c.dy);
    if (flags & HAS_SCALE) w.f2dot14(/** @type {number[]} */ (t)[0]);
    else if (flags & HAS_XY_SCALE) w.f2dot14(/** @type {number[]} */ (t)[0]).f2dot14(/** @type {number[]} */ (t)[3]);
    else if (flags & HAS_2X2) {
      const m = /** @type {number[]} */ (t);
      w.f2dot14(m[0]).f2dot14(m[1]).f2dot14(m[2]).f2dot14(m[3]);
    }
  });
  if (instructions && instructions.length) w.u16(instructions.length).bytes(instructions);
  return w.toBytes();
}

/**
 * Decodes one glyph record.
 * @param {Uint8Array} b
 * @returns {{ contours: IntPoint[][], components: GlyfComponent[], instructions: Uint8Array, box: Box, overlap: boolean }}
 */
export function decodeGlyph(b) {
  const empty = { contours: [], components: [], instructions: new Uint8Array(0), box: { xMin: 0, yMin: 0, xMax: 0, yMax: 0 }, overlap: false };
  if (b.length === 0) return empty;
  const r = new Reader(b, 0, 'glyf');
  const n = r.i16();
  const box = { xMin: r.i16(), yMin: r.i16(), xMax: r.i16(), yMax: r.i16() };
  if (n >= 0) {
    const ends = [];
    for (let i = 0; i < n; i++) ends.push(r.u16());
    const count = n ? ends[n - 1] + 1 : 0;
    const instructions = r.take(r.u16()).slice();
    const flags = new Uint8Array(count);
    for (let i = 0; i < count;) {
      const f = r.u8();
      flags[i++] = f;
      if (f & REPEAT) {
        let k = r.u8();
        while (k-- > 0 && i < count) flags[i++] = f;
      }
    }
    const xs = new Int32Array(count);
    const ys = new Int32Array(count);
    let v = 0;
    for (let i = 0; i < count; i++) {
      const f = flags[i];
      if (f & X_SHORT) v += f & X_SAME ? r.u8() : -r.u8();
      else if (!(f & X_SAME)) v += r.i16();
      xs[i] = v;
    }
    v = 0;
    for (let i = 0; i < count; i++) {
      const f = flags[i];
      if (f & Y_SHORT) v += f & Y_SAME ? r.u8() : -r.u8();
      else if (!(f & Y_SAME)) v += r.i16();
      ys[i] = v;
    }
    const contours = [];
    let start = 0;
    for (const end of ends) {
      const c = [];
      for (let i = start; i <= end; i++) c.push({ x: xs[i], y: ys[i], on: (flags[i] & ON_CURVE) !== 0 });
      contours.push(c);
      start = end + 1;
    }
    return { contours, components: [], instructions, box, overlap: count > 0 && (flags[0] & OVERLAP_SIMPLE) !== 0 };
  }
  const components = [];
  let flags;
  let overlap = false;
  do {
    flags = r.u16();
    const glyphIndex = r.u16();
    let a1;
    let a2;
    if (flags & ARG_WORDS) {
      if (flags & ARGS_XY) {
        a1 = r.i16();
        a2 = r.i16();
      } else {
        a1 = r.u16();
        a2 = r.u16();
      }
    } else if (flags & ARGS_XY) {
      a1 = r.i8();
      a2 = r.i8();
    } else {
      a1 = r.u8();
      a2 = r.u8();
    }
    /** @type {[number, number, number, number] | undefined} */
    let transform;
    if (flags & HAS_SCALE) {
      const s = r.f2dot14();
      transform = [s, 0, 0, s];
    } else if (flags & HAS_XY_SCALE) {
      const sx = r.f2dot14();
      const sy = r.f2dot14();
      transform = [sx, 0, 0, sy];
    } else if (flags & HAS_2X2) {
      transform = [r.f2dot14(), r.f2dot14(), r.f2dot14(), r.f2dot14()];
    }
    if (flags & OVERLAP_COMPOUND) overlap = true;
    /** @type {GlyfComponent} */
    const comp = flags & ARGS_XY ? { glyphIndex, dx: a1, dy: a2, flags } : { glyphIndex, dx: 0, dy: 0, flags, matchPoints: [a1, a2] };
    if (transform) comp.transform = transform;
    components.push(comp);
  } while (flags & MORE_COMPONENTS);
  const instructions = flags & HAS_INSTRUCTIONS ? r.take(r.u16()).slice() : new Uint8Array(0);
  return { contours: [], components, instructions, box, overlap };
}

/**
 * Concatenates glyph records into glyf and builds loca (short offsets when
 * they fit).
 * @param {Uint8Array[]} records
 * @returns {{ glyf: Uint8Array, loca: Uint8Array, indexToLocFormat: number }}
 */
export function buildGlyfLoca(records) {
  const offsets = [0];
  let total = 0;
  for (const rec of records) {
    total += (rec.length + 3) & ~3;
    offsets.push(total);
  }
  const short = total / 2 <= 0xffff;
  const glyf = new Uint8Array(total);
  let at = 0;
  for (const rec of records) {
    glyf.set(rec, at);
    at += (rec.length + 3) & ~3;
  }
  const w = new Writer(offsets.length * (short ? 2 : 4));
  for (const o of offsets) {
    if (short) w.u16(o / 2);
    else w.u32(o);
  }
  return { glyf, loca: w.toBytes(), indexToLocFormat: short ? 0 : 1 };
}

/**
 * Splits glyf into records using loca.
 * @param {Uint8Array} glyf
 * @param {Uint8Array} loca
 * @param {number} indexToLocFormat
 * @param {number} numGlyphs
 */
export function splitGlyf(glyf, loca, indexToLocFormat, numGlyphs) {
  const r = new Reader(loca, 0, 'loca');
  const offsets = [];
  for (let i = 0; i <= numGlyphs; i++) {
    if (r.pos >= loca.length) {
      offsets.push(offsets[offsets.length - 1] ?? 0);
      continue;
    }
    offsets.push(indexToLocFormat ? r.u32() : r.u16() * 2);
  }
  const out = [];
  for (let i = 0; i < numGlyphs; i++) {
    const a = Math.min(offsets[i], glyf.length);
    const b = Math.min(Math.max(offsets[i + 1], a), glyf.length);
    out.push(glyf.subarray(a, b));
  }
  return out;
}
