// WOFF 2.0 writer and reader, including the glyf/loca transform (which
// usually saves another 20 to 30 percent) and the hmtx transform (read only).

import { Reader, Writer, write255, writeBase128 } from './binary.mjs';
import { assembleSfnt, readSfnt } from './sfnt.mjs';
import { requireBrotli } from './codecs.mjs';
import { buildGlyfLoca, decodeGlyph, encodeSimpleGlyph, splitGlyf, HAS_INSTRUCTIONS, MORE_COMPONENTS, ARG_WORDS, HAS_SCALE, HAS_XY_SCALE, HAS_2X2 } from './glyf.mjs';

const KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG',
  'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH',
  'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar',
  'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

/* ------------------------------------------------------------------ */
/* Writer                                                              */
/* ------------------------------------------------------------------ */

/**
 * Converts an sfnt binary to WOFF2. TrueType fonts get the glyf/loca
 * transform; CFF fonts are stored with the null transform.
 * @param {Uint8Array} sfnt
 * @param {{ transform?: boolean }} [options]
 * @returns {Uint8Array}
 */
export function sfntToWoff2(sfnt, options = {}) {
  const compress = requireBrotli('compress');
  const { flavor, tables } = readSfnt(sfnt);
  const tags = [...tables.keys()].sort();
  const transform = options.transform !== false && tables.has('glyf') && tables.has('loca');
  let glyfTransformed = null;
  if (transform) glyfTransformed = transformGlyf(sfnt, tables);
  const dir = new Writer();
  const stream = new Writer(sfnt.length);
  for (const tag of tags) {
    const data = /** @type {Uint8Array} */ (tables.get(tag));
    const known = KNOWN_TAGS.indexOf(tag);
    let version = 0;
    let body = data;
    if (tag === 'glyf' || tag === 'loca') {
      version = transform ? 0 : 3;
      if (transform) body = tag === 'glyf' ? /** @type {Uint8Array} */ (glyfTransformed) : new Uint8Array(0);
    }
    dir.u8((known >= 0 ? known : 63) | (version << 6));
    if (known < 0) dir.tag(tag);
    writeBase128(dir, data.length);
    if (transform && (tag === 'glyf' || tag === 'loca')) writeBase128(dir, body.length);
    stream.bytes(body);
  }
  const compressed = compress(stream.toBytes());
  let totalSfntSize = 12 + 16 * tags.length;
  for (const tag of tags) totalSfntSize += (/** @type {Uint8Array} */ (tables.get(tag)).length + 3) & ~3;
  const dirBytes = dir.toBytes();
  const headerSize = 48;
  const length = (headerSize + dirBytes.length + compressed.length + 3) & ~3;
  const w = new Writer(length);
  w.tag('wOF2').u32(flavor).u32(length).u16(tags.length).u16(0).u32(totalSfntSize).u32(compressed.length);
  w.u16(1).u16(0).u32(0).u32(0).u32(0).u32(0).u32(0);
  w.bytes(dirBytes).bytes(compressed).pad(4);
  return w.toBytes();
}

/** Triplet encoding of one point delta (WOFF2 section 5.2). */
function writeTriplet(flags, glyph, onCurve, x, y) {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const on = onCurve ? 0 : 128;
  const xs = x < 0 ? 0 : 1;
  const ys = y < 0 ? 0 : 1;
  const xy = xs + 2 * ys;
  if (x === 0 && ay < 1280) {
    flags.push(on + ((ay & 0xf00) >> 7) + ys);
    glyph.u8(ay & 0xff);
  } else if (y === 0 && ax < 1280) {
    flags.push(on + 10 + ((ax & 0xf00) >> 7) + xs);
    glyph.u8(ax & 0xff);
  } else if (ax < 65 && ay < 65) {
    flags.push(on + 20 + ((ax - 1) & 0x30) + (((ay - 1) & 0x30) >> 2) + xy);
    glyph.u8((((ax - 1) & 0xf) << 4) | ((ay - 1) & 0xf));
  } else if (ax < 769 && ay < 769) {
    flags.push(on + 84 + 12 * (((ax - 1) & 0x300) >> 8) + (((ay - 1) & 0x300) >> 6) + xy);
    glyph.u8((ax - 1) & 0xff).u8((ay - 1) & 0xff);
  } else if (ax < 4096 && ay < 4096) {
    flags.push(on + 120 + xy);
    glyph.u8(ax >> 4).u8(((ax & 0xf) << 4) | (ay >> 8)).u8(ay & 0xff);
  } else {
    flags.push(on + 124 + xy);
    glyph.u8(ax >> 8).u8(ax & 0xff).u8(ay >> 8).u8(ay & 0xff);
  }
}

/** Size of the component records of a composite glyph (without instructions). */
function compositeSize(rec) {
  let p = 10;
  let flags;
  do {
    flags = (rec[p] << 8) | rec[p + 1];
    p += 4;
    p += flags & ARG_WORDS ? 4 : 2;
    if (flags & HAS_SCALE) p += 2;
    else if (flags & HAS_XY_SCALE) p += 4;
    else if (flags & HAS_2X2) p += 8;
  } while (flags & MORE_COMPONENTS);
  return { end: p, hasInstructions: (flags & HAS_INSTRUCTIONS) !== 0 };
}

/** @param {Uint8Array} sfnt @param {Map<string, Uint8Array>} tables */
function transformGlyf(sfnt, tables) {
  void sfnt;
  const head = /** @type {Uint8Array} */ (tables.get('head'));
  const maxp = /** @type {Uint8Array} */ (tables.get('maxp'));
  const indexFormat = (head[50] << 8) | head[51];
  const numGlyphs = (maxp[4] << 8) | maxp[5];
  const records = splitGlyf(/** @type {Uint8Array} */ (tables.get('glyf')), /** @type {Uint8Array} */ (tables.get('loca')), indexFormat, numGlyphs);
  const nContour = new Writer();
  const nPoints = new Writer();
  /** @type {number[]} */
  const flagList = [];
  const glyphS = new Writer();
  const composite = new Writer();
  const bboxBitmap = new Uint8Array(4 * Math.floor((numGlyphs + 31) / 32));
  const bboxValues = new Writer();
  const instr = new Writer();
  records.forEach((rec, gid) => {
    if (!rec.length) {
      nContour.i16(0);
      return;
    }
    const n = (rec[0] << 8) | rec[1];
    const count = n > 0x7fff ? n - 0x10000 : n;
    nContour.i16(count);
    if (count < 0) {
      bboxBitmap[gid >> 3] |= 0x80 >> (gid & 7);
      bboxValues.bytes(rec.subarray(2, 10));
      const { end, hasInstructions } = compositeSize(rec);
      composite.bytes(rec.subarray(10, end));
      if (hasInstructions) {
        const len = (rec[end] << 8) | rec[end + 1];
        write255(glyphS, len);
        instr.bytes(rec.subarray(end + 2, end + 2 + len));
      }
      return;
    }
    const g = decodeGlyph(rec);
    let px = 0;
    let py = 0;
    for (const c of g.contours) write255(nPoints, c.length);
    for (const c of g.contours) {
      for (const p of c) {
        writeTriplet(flagList, glyphS, p.on, p.x - px, p.y - py);
        px = p.x;
        py = p.y;
      }
    }
    write255(glyphS, g.instructions.length);
    instr.bytes(g.instructions);
    // Keep the stored bounding box when it differs from the computed one.
    const pts = g.contours.flat();
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const computed = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const stored = [g.box.xMin, g.box.yMin, g.box.xMax, g.box.yMax];
    if (computed.some((v, i) => v !== stored[i])) {
      bboxBitmap[gid >> 3] |= 0x80 >> (gid & 7);
      bboxValues.bytes(rec.subarray(2, 10));
    }
  });
  const streams = [nContour.toBytes(), nPoints.toBytes(), Uint8Array.from(flagList), glyphS.toBytes(), composite.toBytes(),
    concat(bboxBitmap, bboxValues.toBytes()), instr.toBytes()];
  const w = new Writer();
  w.u16(0).u16(0).u16(numGlyphs).u16(indexFormat);
  for (const s of streams) w.u32(s.length);
  for (const s of streams) w.bytes(s);
  return w.toBytes();
}

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

/* ------------------------------------------------------------------ */
/* Reader                                                              */
/* ------------------------------------------------------------------ */

/**
 * Converts WOFF2 back to an sfnt binary (glyf, loca and hmtx transforms are
 * reconstructed).
 * @param {Uint8Array} woff2
 * @returns {Uint8Array}
 */
export function woff2ToSfnt(woff2) {
  const decompress = requireBrotli('decompress');
  const r = new Reader(woff2, 0, 'WOFF2');
  if (r.tag() !== 'wOF2') throw new Error('WOFF2: bad signature');
  const flavor = r.u32();
  if (flavor === 0x74746366) throw new Error('WOFF2: font collections are not supported');
  r.u32();
  const numTables = r.u16();
  r.u16();
  r.u32();
  const compressedSize = r.u32();
  r.pos = 48;
  const entries = [];
  for (let i = 0; i < numTables; i++) {
    const flags = r.u8();
    const tag = (flags & 63) === 63 ? r.tag() : KNOWN_TAGS[flags & 63];
    const version = flags >> 6;
    const origLength = r.base128();
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    const length = transformed ? r.base128() : origLength;
    entries.push({ tag, version, origLength, length, transformed });
  }
  if (r.pos + compressedSize > woff2.length) throw new RangeError('WOFF2: compressed data out of range');
  const data = decompress(woff2.subarray(r.pos, r.pos + compressedSize));
  let off = 0;
  /** @type {Map<string, Uint8Array>} */
  const raw = new Map();
  for (const e of entries) {
    if (off + e.length > data.length) throw new RangeError(`WOFF2: table "${e.tag}" out of range`);
    raw.set(e.tag, data.subarray(off, off + e.length));
    off += e.length;
  }
  /** @type {Map<string, Uint8Array>} */
  const out = new Map();
  let xMins = null;
  for (const e of entries) {
    if (e.tag === 'glyf' && e.transformed) {
      const rebuilt = reconstructGlyf(/** @type {Uint8Array} */ (raw.get('glyf')));
      out.set('glyf', rebuilt.glyf);
      out.set('loca', rebuilt.loca);
      xMins = rebuilt.xMins;
      const head = raw.get('head');
      if (head && head.length >= 54) {
        const patched = head.slice();
        patched[50] = 0;
        patched[51] = rebuilt.indexToLocFormat;
        raw.set('head', patched);
      }
    } else if (!(e.tag === 'loca' && e.transformed)) out.set(e.tag, /** @type {Uint8Array} */ (raw.get(e.tag)));
  }
  if (out.has('head')) out.set('head', /** @type {Uint8Array} */ (raw.get('head')));
  const hmtxEntry = entries.find((e) => e.tag === 'hmtx');
  if (hmtxEntry && hmtxEntry.transformed) {
    if (!xMins) throw new Error('WOFF2: transformed hmtx needs a transformed glyf table');
    out.set('hmtx', reconstructHmtx(/** @type {Uint8Array} */ (raw.get('hmtx')), out, xMins));
  }
  return assembleSfnt(out, flavor);
}

/** @param {Uint8Array} b */
function reconstructGlyf(b) {
  const r = new Reader(b, 0, 'WOFF2 glyf');
  r.u16();
  const optionFlags = r.u16();
  const numGlyphs = r.u16();
  const indexFormat = r.u16();
  const sizes = [];
  for (let i = 0; i < 7; i++) sizes.push(r.u32());
  let at = r.pos;
  const streams = sizes.map((s) => {
    const sub = b.subarray(at, at + s);
    if (at + s > b.length) throw new RangeError('WOFF2 glyf: stream out of range');
    at += s;
    return new Reader(sub, 0, 'WOFF2 glyf stream');
  });
  const [nContourS, nPointsS, flagS, glyphS, compositeS, bboxS, instrS] = streams;
  const overlapBitmap = optionFlags & 1 ? b.subarray(at, at + ((numGlyphs + 7) >> 3)) : null;
  const bitmapLen = 4 * Math.floor((numGlyphs + 31) / 32);
  const bboxBitmap = bboxS.take(bitmapLen);
  const records = [];
  const xMins = new Int16Array(numGlyphs);
  for (let gid = 0; gid < numGlyphs; gid++) {
    const nContours = nContourS.i16();
    const hasBox = (bboxBitmap[gid >> 3] & (0x80 >> (gid & 7))) !== 0;
    if (nContours === 0) {
      if (hasBox) throw new Error('WOFF2 glyf: empty glyph with a bounding box');
      records.push(new Uint8Array(0));
      continue;
    }
    if (nContours < 0) {
      if (!hasBox) throw new Error('WOFF2 glyf: composite glyph without a bounding box');
      const box = bboxS.take(8);
      const start = compositeS.pos;
      let flags;
      do {
        flags = compositeS.u16();
        compositeS.u16();
        compositeS.pos += flags & ARG_WORDS ? 4 : 2;
        if (flags & HAS_SCALE) compositeS.pos += 2;
        else if (flags & HAS_XY_SCALE) compositeS.pos += 4;
        else if (flags & HAS_2X2) compositeS.pos += 8;
      } while (flags & MORE_COMPONENTS);
      const comps = compositeS.bytes.subarray(start, compositeS.pos);
      const w = new Writer();
      w.i16(-1).bytes(box).bytes(comps);
      if (flags & HAS_INSTRUCTIONS) {
        const len = glyphS.u255();
        w.u16(len).bytes(instrS.take(len));
      }
      records.push(w.toBytes());
      xMins[gid] = (box[0] << 8 | box[1]) << 16 >> 16;
      continue;
    }
    const counts = [];
    for (let c = 0; c < nContours; c++) counts.push(nPointsS.u255());
    const contours = [];
    let x = 0;
    let y = 0;
    for (const n of counts) {
      const pts = [];
      for (let k = 0; k < n; k++) {
        let flag = flagS.u8();
        const on = (flag & 0x80) === 0;
        flag &= 0x7f;
        let dx;
        let dy;
        const sign = (f, v) => (f & 1 ? v : -v);
        if (flag < 10) {
          dx = 0;
          dy = sign(flag, ((flag & 14) << 7) + glyphS.u8());
        } else if (flag < 20) {
          dx = sign(flag, (((flag - 10) & 14) << 7) + glyphS.u8());
          dy = 0;
        } else if (flag < 84) {
          const b0 = flag - 20;
          const b1 = glyphS.u8();
          dx = sign(flag, 1 + (b0 & 0x30) + (b1 >> 4));
          dy = sign(flag >> 1, 1 + ((b0 & 0x0c) << 2) + (b1 & 0x0f));
        } else if (flag < 120) {
          const b0 = flag - 84;
          dx = sign(flag, 1 + (Math.floor(b0 / 12) << 8) + glyphS.u8());
          dy = sign(flag >> 1, 1 + (((b0 % 12) >> 2) << 8) + glyphS.u8());
        } else if (flag < 124) {
          const a = glyphS.u8();
          const b2 = glyphS.u8();
          const c = glyphS.u8();
          dx = sign(flag, (a << 4) + (b2 >> 4));
          dy = sign(flag >> 1, ((b2 & 0x0f) << 8) + c);
        } else {
          const a = glyphS.u16();
          const c = glyphS.u16();
          dx = sign(flag, a);
          dy = sign(flag >> 1, c);
        }
        x += dx;
        y += dy;
        pts.push({ x, y, on });
      }
      contours.push(pts);
    }
    const ilen = glyphS.u255();
    const instructions = instrS.take(ilen).slice();
    const overlap = overlapBitmap ? (overlapBitmap[gid >> 3] & (0x80 >> (gid & 7))) !== 0 : false;
    const rec = encodeSimpleGlyph(contours, instructions, { overlap });
    if (hasBox) rec.set(bboxS.take(8), 2);
    records.push(rec);
    xMins[gid] = (rec[2] << 8 | rec[3]) << 16 >> 16;
  }
  const { glyf, loca, indexToLocFormat } = buildGlyfLoca(records);
  void indexFormat;
  return { glyf, loca, xMins, indexToLocFormat };
}

/** Rebuilds hmtx from the transformed form (WOFF2 section 5.4). */
function reconstructHmtx(b, tables, xMins) {
  const hhea = /** @type {Uint8Array} */ (tables.get('hhea'));
  const maxp = /** @type {Uint8Array} */ (tables.get('maxp'));
  const numberOfHMetrics = (hhea[34] << 8) | hhea[35];
  const numGlyphs = (maxp[4] << 8) | maxp[5];
  const r = new Reader(b, 0, 'WOFF2 hmtx');
  const flags = r.u8();
  const advances = [];
  for (let i = 0; i < numberOfHMetrics; i++) advances.push(r.u16());
  const lsbs = [];
  for (let i = 0; i < numberOfHMetrics; i++) lsbs.push(flags & 1 ? xMins[i] : r.i16());
  for (let i = numberOfHMetrics; i < numGlyphs; i++) lsbs.push(flags & 2 ? xMins[i] : r.i16());
  const w = new Writer();
  for (let i = 0; i < numGlyphs; i++) {
    if (i < numberOfHMetrics) w.u16(advances[i]);
    w.i16(lsbs[i]);
  }
  return w.toBytes();
}
