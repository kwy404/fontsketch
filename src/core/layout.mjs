// OpenType layout: GPOS pair kerning (formats 1 and 2), GDEF glyph classes
// and the legacy kern table.

import { Reader, Writer } from './binary.mjs';

/**
 * @typedef {{ left: number[], right: number[], value: number, leftClass: boolean, rightClass: boolean }} KernRule
 * Glyph ids on each side; `leftClass`/`rightClass` tell whether the side came
 * from a kerning class (format 2) or a single glyph (format 1).
 */

/* ------------------------------------------------------------------ */
/* Coverage and ClassDef                                               */
/* ------------------------------------------------------------------ */

/** @param {number[]} glyphs sorted unique glyph ids */
export function encodeCoverage(glyphs) {
  const ranges = [];
  for (const g of glyphs) {
    const last = ranges[ranges.length - 1];
    if (last && g === last[1] + 1) last[1] = g;
    else ranges.push([g, g]);
  }
  const w = new Writer();
  if (2 + 2 * glyphs.length <= 2 + 6 * ranges.length) {
    w.u16(1).u16(glyphs.length);
    for (const g of glyphs) w.u16(g);
  } else {
    w.u16(2).u16(ranges.length);
    let index = 0;
    for (const [a, b] of ranges) {
      w.u16(a).u16(b).u16(index);
      index += b - a + 1;
    }
  }
  return w.toBytes();
}

/** @param {Uint8Array} b @param {number} off @returns {number[]} */
export function readCoverage(b, off) {
  const r = new Reader(b, off, 'Coverage');
  const fmt = r.u16();
  const n = r.u16();
  const out = [];
  if (fmt === 1) for (let i = 0; i < n; i++) out.push(r.u16());
  else if (fmt === 2) {
    for (let i = 0; i < n; i++) {
      const a = r.u16();
      const z = r.u16();
      r.u16();
      for (let g = a; g <= z; g++) out.push(g);
    }
  } else throw new Error(`Coverage: unknown format ${fmt}`);
  return out;
}

/** @param {Map<number, number>} classes glyph id to class (> 0) */
export function encodeClassDef(classes) {
  const glyphs = [...classes.keys()].sort((a, b) => a - b);
  const w = new Writer();
  if (!glyphs.length) {
    w.u16(2).u16(0);
    return w.toBytes();
  }
  const ranges = [];
  for (const g of glyphs) {
    const c = /** @type {number} */ (classes.get(g));
    const last = ranges[ranges.length - 1];
    if (last && g === last[1] + 1 && c === last[2]) last[1] = g;
    else ranges.push([g, g, c]);
  }
  const first = glyphs[0];
  const span = glyphs[glyphs.length - 1] - first + 1;
  if (6 + span * 2 <= 4 + ranges.length * 6) {
    w.u16(1).u16(first).u16(span);
    for (let g = first; g < first + span; g++) w.u16(classes.get(g) || 0);
  } else {
    w.u16(2).u16(ranges.length);
    for (const [a, b, c] of ranges) w.u16(a).u16(b).u16(c);
  }
  return w.toBytes();
}

/** @param {Uint8Array} b @param {number} off @returns {Map<number, number>} */
export function readClassDef(b, off) {
  const r = new Reader(b, off, 'ClassDef');
  const fmt = r.u16();
  /** @type {Map<number, number>} */
  const out = new Map();
  if (fmt === 1) {
    const start = r.u16();
    const n = r.u16();
    for (let i = 0; i < n; i++) {
      const c = r.u16();
      if (c) out.set(start + i, c);
    }
  } else if (fmt === 2) {
    const n = r.u16();
    for (let i = 0; i < n; i++) {
      const a = r.u16();
      const z = r.u16();
      const c = r.u16();
      if (c) for (let g = a; g <= z; g++) out.set(g, c);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* GPOS writer                                                         */
/* ------------------------------------------------------------------ */

/**
 * Builds GPOS with one `kern` lookup. Glyph to glyph pairs go into format 1
 * subtables first (so they act as exceptions), class pairs into format 2
 * subtables. Glyphs that belong to several classes on the same side are
 * split into separate subtables automatically.
 * @param {KernRule[]} rules
 * @returns {Uint8Array | null}
 */
export function writeGPOS(rules) {
  // Zero valued glyph pairs are kept: they switch off a class pair.
  const active = rules.filter((r) => r.left.length && r.right.length && (r.value !== 0 || !(r.leftClass && r.rightClass)));
  if (!active.some((r) => r.value !== 0)) return null;
  // Glyph to glyph pairs win over glyph to class pairs, which win over class
  // to glyph pairs; all of them become format 1 exceptions. Only class to
  // class rules use format 2.
  const glyphPairs = new Map();
  const priority = new Map();
  const classRules = [];
  for (const r of active) {
    if (r.leftClass && r.rightClass) {
      classRules.push(r);
      continue;
    }
    const rank = !r.leftClass && !r.rightClass ? 3 : !r.leftClass ? 2 : 1;
    for (const l of r.left) {
      for (const g of r.right) {
        const key = l * 65536 + g;
        if ((priority.get(key) || 0) > rank) continue;
        priority.set(key, rank);
        glyphPairs.set(key, r.value);
      }
    }
  }
  /** @type {Uint8Array[]} */
  const subtables = [];
  if (glyphPairs.size) subtables.push(...pairFormat1(glyphPairs));
  if (classRules.length) subtables.push(...pairFormat2(classRules));
  const lookup = buildLookup(2, subtables);
  return buildLayoutTable('kern', [lookup]);
}

/** @param {Map<number, number>} pairs key = left * 65536 + right */
function pairFormat1(pairs) {
  const byLeft = new Map();
  for (const [key, value] of pairs) {
    const left = Math.floor(key / 65536);
    if (!byLeft.has(left)) byLeft.set(left, []);
    byLeft.get(left).push([key % 65536, value]);
  }
  const lefts = [...byLeft.keys()].sort((a, b) => a - b);
  // Split so each subtable stays well below the 64 KB offset limit.
  const chunks = [];
  let chunk = [];
  let size = 10;
  for (const l of lefts) {
    const add = 2 + 2 + byLeft.get(l).length * 4 + 2;
    if (chunk.length && size + add > 60000) {
      chunks.push(chunk);
      chunk = [];
      size = 10;
    }
    chunk.push(l);
    size += add;
  }
  if (chunk.length) chunks.push(chunk);
  return chunks.map((ls) => {
    const coverage = encodeCoverage(ls);
    const sets = ls.map((l) => {
      const list = byLeft.get(l).sort((a, b) => a[0] - b[0]);
      const w = new Writer();
      w.u16(list.length);
      for (const [g, v] of list) w.u16(g).i16(v);
      return w.toBytes();
    });
    const head = 10 + 2 * ls.length;
    const w = new Writer();
    let off = head;
    const setOffsets = sets.map((s) => {
      const o = off;
      off += s.length;
      return o;
    });
    w.u16(1).u16(off).u16(0x0004).u16(0).u16(ls.length);
    for (const o of setOffsets) w.u16(o);
    for (const s of sets) w.bytes(s);
    w.bytes(coverage);
    return w.toBytes();
  });
}

/** @param {KernRule[]} rules */
function pairFormat2(rules) {
  /** @type {Array<{ leftOf: Map<number, string>, rightOf: Map<number, string>, rules: KernRule[] }>} */
  const groups = [];
  const keyOf = (list) => list.slice().sort((a, b) => a - b).join(',');
  for (const rule of rules) {
    const lk = keyOf(rule.left);
    const rk = keyOf(rule.right);
    let target = null;
    for (const g of groups) {
      const fitsLeft = rule.left.every((gid) => !g.leftOf.has(gid) || g.leftOf.get(gid) === lk);
      const fitsRight = rule.right.every((gid) => !g.rightOf.has(gid) || g.rightOf.get(gid) === rk);
      if (fitsLeft && fitsRight) {
        target = g;
        break;
      }
    }
    if (!target) {
      target = { leftOf: new Map(), rightOf: new Map(), rules: [] };
      groups.push(target);
    }
    for (const gid of rule.left) target.leftOf.set(gid, lk);
    for (const gid of rule.right) target.rightOf.set(gid, rk);
    target.rules.push(rule);
  }
  const out = [];
  for (const g of groups) {
    const leftKeys = [...new Set(g.leftOf.values())];
    const rightKeys = [...new Set(g.rightOf.values())];
    // Split very large class matrices to keep offsets in range.
    const maxLeft = Math.max(1, Math.floor(30000 / (rightKeys.length + 1)));
    for (let i = 0; i < leftKeys.length; i += maxLeft) {
      const part = new Set(leftKeys.slice(i, i + maxLeft));
      out.push(encodeFormat2(g, [...part], rightKeys));
    }
  }
  return out;
}

function encodeFormat2(group, leftKeys, rightKeys) {
  const leftIndex = new Map(leftKeys.map((k, i) => [k, i + 1]));
  const rightIndex = new Map(rightKeys.map((k, i) => [k, i + 1]));
  const cd1 = new Map();
  for (const [gid, k] of group.leftOf) if (leftIndex.has(k)) cd1.set(gid, leftIndex.get(k));
  const cd2 = new Map();
  for (const [gid, k] of group.rightOf) cd2.set(gid, rightIndex.get(k));
  const c1 = leftKeys.length + 1;
  const c2 = rightKeys.length + 1;
  const matrix = new Int16Array(c1 * c2);
  const keyOf = (list) => list.slice().sort((a, b) => a - b).join(',');
  for (const rule of group.rules) {
    const li = leftIndex.get(keyOf(rule.left));
    if (!li) continue;
    matrix[li * c2 + /** @type {number} */ (rightIndex.get(keyOf(rule.right)))] = rule.value;
  }
  const coverage = encodeCoverage([...cd1.keys()].sort((a, b) => a - b));
  const classDef1 = encodeClassDef(cd1);
  const classDef2 = encodeClassDef(cd2);
  const head = 16 + matrix.length * 2;
  const w = new Writer();
  w.u16(2).u16(head).u16(0x0004).u16(0).u16(head + coverage.length).u16(head + coverage.length + classDef1.length);
  w.u16(c1).u16(c2);
  for (const v of matrix) w.i16(v);
  w.bytes(coverage).bytes(classDef1).bytes(classDef2);
  const bytes = w.toBytes();
  if (head + coverage.length + classDef1.length > 0xffff) throw new RangeError('GPOS: kerning class table too large');
  return bytes;
}

/**
 * Builds a lookup; switches to Extension subtables (type 9) when offsets
 * would overflow 16 bits.
 * @param {number} type
 * @param {Uint8Array[]} subtables
 */
export function buildLookup(type, subtables) {
  const head = 6 + subtables.length * 2;
  const total = head + subtables.reduce((a, s) => a + s.length, 0);
  const w = new Writer();
  if (total <= 0xffff) {
    w.u16(type).u16(0).u16(subtables.length);
    let off = head;
    for (const s of subtables) {
      w.u16(off);
      off += s.length;
    }
    for (const s of subtables) w.bytes(s);
    return w.toBytes();
  }
  w.u16(9).u16(0).u16(subtables.length);
  let off = head;
  for (let i = 0; i < subtables.length; i++) {
    w.u16(off);
    off += 8;
  }
  let dataOff = head + subtables.length * 8;
  subtables.forEach((s, i) => {
    w.u16(1).u16(type).u32(dataOff - (head + i * 8));
    dataOff += s.length;
  });
  for (const s of subtables) w.bytes(s);
  return w.toBytes();
}

/**
 * Builds a GPOS or GSUB table with DFLT and latn scripts and one feature.
 * @param {string} featureTag
 * @param {Uint8Array[]} lookups
 */
export function buildLayoutTable(featureTag, lookups) {
  // ScriptList
  const langSys = new Writer();
  langSys.u16(0).u16(0xffff).u16(1).u16(0);
  const ls = langSys.toBytes();
  const script = new Writer();
  script.u16(4).u16(0).bytes(ls);
  const sc = script.toBytes();
  const scriptList = new Writer();
  const tags = ['DFLT', 'latn'];
  scriptList.u16(tags.length);
  tags.forEach((t, i) => scriptList.tag(t).u16(2 + tags.length * 6 + i * sc.length));
  for (let i = 0; i < tags.length; i++) scriptList.bytes(sc);
  // FeatureList
  const featureList = new Writer();
  featureList.u16(1).tag(featureTag).u16(8);
  featureList.u16(0).u16(lookups.length);
  for (let i = 0; i < lookups.length; i++) featureList.u16(i);
  // LookupList
  const lookupList = new Writer();
  lookupList.u16(lookups.length);
  let off = 2 + lookups.length * 2;
  for (const l of lookups) {
    lookupList.u16(off);
    off += l.length;
  }
  for (const l of lookups) lookupList.bytes(l);
  const sl = scriptList.toBytes();
  const fl = featureList.toBytes();
  const ll = lookupList.toBytes();
  const w = new Writer();
  w.u32(0x00010000).u16(10).u16(10 + sl.length).u16(10 + sl.length + fl.length);
  w.bytes(sl).bytes(fl).bytes(ll);
  return w.toBytes();
}

/* ------------------------------------------------------------------ */
/* GPOS reader                                                         */
/* ------------------------------------------------------------------ */

/**
 * Reads pair kerning (lookup type 2, also through Extension lookups) from
 * the lookups used by the `kern` feature (or all pair lookups when there is
 * no kern feature). XAdvance values of the first glyph are returned.
 * @param {Uint8Array} b
 * @returns {{ pairs: Array<[number, number, number]>, classPairs: Array<{ left: number[], right: number[], value: number }> }}
 */
export function readGPOS(b) {
  const r = new Reader(b, 0, 'GPOS');
  r.u32();
  const scriptListOff = r.u16();
  const featureListOff = r.u16();
  const lookupListOff = r.u16();
  void scriptListOff;
  const fr = new Reader(b, featureListOff, 'GPOS FeatureList');
  const nf = fr.u16();
  const kernLookups = new Set();
  for (let i = 0; i < nf; i++) {
    const tag = fr.tag();
    const off = fr.u16();
    if (tag !== 'kern' && tag !== 'dist') continue;
    const ft = new Reader(b, featureListOff + off, 'GPOS Feature');
    ft.u16();
    const n = ft.u16();
    for (let k = 0; k < n; k++) kernLookups.add(ft.u16());
  }
  const lr = new Reader(b, lookupListOff, 'GPOS LookupList');
  const nl = lr.u16();
  const lookupOffsets = [];
  for (let i = 0; i < nl; i++) lookupOffsets.push(lookupListOff + lr.u16());
  const pairs = [];
  const classPairs = [];
  const seen = new Set();
  lookupOffsets.forEach((lo, li) => {
    if (kernLookups.size && !kernLookups.has(li)) return;
    const l = new Reader(b, lo, 'GPOS Lookup');
    let type = l.u16();
    l.u16();
    const ns = l.u16();
    for (let s = 0; s < ns; s++) {
      let st = lo + new Reader(b, lo + 6 + s * 2, 'GPOS Lookup').u16();
      if (type === 9) {
        const er = new Reader(b, st, 'GPOS Extension');
        er.u16();
        const ext = er.u16();
        const off = er.u32();
        if (ext !== 2) continue;
        st += off;
      } else if (type !== 2) continue;
      readPairSubtable(b, st, pairs, classPairs, seen);
    }
    if (type === 9) type = 2;
  });
  return { pairs, classPairs };
}

/** Size in bytes of a ValueRecord with the given format. */
function valueSize(fmt) {
  let n = 0;
  for (let i = 0; i < 8; i++) if (fmt & (1 << i)) n += 2;
  return n;
}

/** XAdvance from a value record (0 if absent). */
function readXAdvance(r, fmt) {
  let x = 0;
  for (let i = 0; i < 8; i++) {
    if (!(fmt & (1 << i))) continue;
    const v = r.i16();
    if (i === 2) x = v;
  }
  return x;
}

function readPairSubtable(b, st, pairs, classPairs, seen) {
  const r = new Reader(b, st, 'PairPos');
  const fmt = r.u16();
  const covOff = r.u16();
  const vf1 = r.u16();
  const vf2 = r.u16();
  const coverage = readCoverage(b, st + covOff);
  if (fmt === 1) {
    const n = r.u16();
    for (let i = 0; i < n && i < coverage.length; i++) {
      const setOff = r.u16();
      const sr = new Reader(b, st + setOff, 'PairSet');
      const count = sr.u16();
      for (let k = 0; k < count; k++) {
        const second = sr.u16();
        const v = readXAdvance(sr, vf1);
        sr.pos += valueSize(vf2);
        const key = coverage[i] * 65536 + second;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push([coverage[i], second, v]);
      }
    }
  } else if (fmt === 2) {
    const cd1 = readClassDef(b, st + r.u16());
    const cd2 = readClassDef(b, st + r.u16());
    const c1 = r.u16();
    const c2 = r.u16();
    const size1 = valueSize(vf1);
    const size2 = valueSize(vf2);
    const covered = new Set(coverage);
    const leftMembers = Array.from({ length: c1 }, () => []);
    for (const g of coverage) leftMembers[cd1.get(g) || 0].push(g);
    const rightMembers = Array.from({ length: c2 }, () => []);
    for (const [g, c] of cd2) if (c < c2) rightMembers[c].push(g);
    for (let i = 0; i < c1; i++) {
      for (let k = 0; k < c2; k++) {
        const rec = new Reader(b, r.pos, 'PairPos class record');
        const v = readXAdvance(rec, vf1);
        r.pos += size1 + size2;
        if (!v || !leftMembers[i].length || k === 0) continue;
        const left = leftMembers[i].filter((g) => covered.has(g));
        const right = rightMembers[k];
        if (left.length && right.length) classPairs.push({ left, right, value: v });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* GDEF                                                                */
/* ------------------------------------------------------------------ */

/**
 * GDEF with a glyph class definition (1 base, 2 ligature, 3 mark, 4 component).
 * @param {Map<number, number>} classes
 */
export function writeGDEF(classes) {
  const cd = encodeClassDef(classes);
  const w = new Writer();
  w.u32(0x00010000).u16(12).u16(0).u16(0).u16(0).bytes(cd);
  return w.toBytes();
}

/** @param {Uint8Array} b */
export function readGDEF(b) {
  const r = new Reader(b, 0, 'GDEF');
  r.u32();
  const off = r.u16();
  return off ? readClassDef(b, off) : new Map();
}

/* ------------------------------------------------------------------ */
/* Legacy kern                                                         */
/* ------------------------------------------------------------------ */

/**
 * Legacy kern table (format 0) from flattened glyph pairs. Older software
 * reads at most one subtable of 10920 pairs; extra pairs are dropped and
 * reported through `dropped`.
 * @param {Array<[number, number, number]>} pairs
 * @returns {{ bytes: Uint8Array, dropped: number } | null}
 */
export function writeKern(pairs) {
  const list = pairs.filter((p) => p[2] !== 0).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (!list.length) return null;
  const max = 10920;
  const kept = list.slice(0, max);
  const n = kept.length;
  let searchRange = 1;
  let entrySelector = 0;
  while (searchRange * 2 <= n) {
    searchRange *= 2;
    entrySelector++;
  }
  searchRange *= 6;
  const w = new Writer();
  w.u16(0).u16(1);
  w.u16(0).u16(14 + n * 6).u16(0x0001);
  w.u16(n).u16(searchRange).u16(entrySelector).u16(n * 6 - searchRange);
  for (const [l, r, v] of kept) w.u16(l).u16(r).i16(v);
  return { bytes: w.toBytes(), dropped: list.length - n };
}

/** @param {Uint8Array} b @returns {Array<[number, number, number]>} */
export function readKern(b) {
  const r = new Reader(b, 0, 'kern');
  const version = r.u16();
  const out = [];
  if (version === 0) {
    const n = r.u16();
    for (let t = 0; t < n; t++) {
      const start = r.pos;
      r.u16();
      const length = r.u16();
      const coverage = r.u16();
      if ((coverage >> 8) === 0 && (coverage & 1)) {
        const np = r.u16();
        r.pos += 6;
        for (let i = 0; i < np; i++) out.push([r.u16(), r.u16(), r.i16()]);
      }
      r.pos = start + length;
    }
  }
  return /** @type {Array<[number, number, number]>} */ (out);
}
