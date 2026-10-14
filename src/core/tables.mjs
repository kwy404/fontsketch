// Required OpenType tables: head, hhea, maxp, OS/2, hmtx, cmap, name, post.
// Each table has a `write*` function returning bytes and a `read*` function
// returning plain data.

import { Reader, Writer, latin1String, macRomanBytes, utf16beBytes, utf16beString } from './binary.mjs';

/* ------------------------------------------------------------------ */
/* head                                                                */
/* ------------------------------------------------------------------ */

/**
 * @typedef {{
 *   fontRevision: number, unitsPerEm: number, created: Date, modified: Date,
 *   xMin: number, yMin: number, xMax: number, yMax: number, macStyle: number,
 *   lowestRecPPEM: number, indexToLocFormat: number, flags: number,
 * }} HeadData
 */

/** @param {HeadData} h */
export function writeHead(h) {
  const w = new Writer(54);
  w.u16(1).u16(0);
  w.fixed(h.fontRevision);
  w.u32(0); // checkSumAdjustment, patched after assembly
  w.u32(0x5f0f3cf5);
  w.u16(h.flags);
  w.u16(h.unitsPerEm);
  w.longDateTime(h.created);
  w.longDateTime(h.modified);
  w.i16(h.xMin).i16(h.yMin).i16(h.xMax).i16(h.yMax);
  w.u16(h.macStyle);
  w.u16(h.lowestRecPPEM);
  w.i16(2); // fontDirectionHint
  w.i16(h.indexToLocFormat);
  w.i16(0); // glyphDataFormat
  return w.toBytes();
}

/** @param {Uint8Array} b */
export function readHead(b) {
  const r = new Reader(b, 0, 'head');
  r.u32();
  const fontRevision = r.fixed();
  const checkSumAdjustment = r.u32();
  const magic = r.u32();
  if (magic !== 0x5f0f3cf5) throw new Error('head: bad magic number');
  const flags = r.u16();
  const unitsPerEm = r.u16();
  const created = r.longDateTime();
  const modified = r.longDateTime();
  const xMin = r.i16();
  const yMin = r.i16();
  const xMax = r.i16();
  const yMax = r.i16();
  const macStyle = r.u16();
  const lowestRecPPEM = r.u16();
  r.i16();
  const indexToLocFormat = r.i16();
  return { fontRevision, checkSumAdjustment, flags, unitsPerEm, created, modified, xMin, yMin, xMax, yMax, macStyle, lowestRecPPEM, indexToLocFormat };
}

/* ------------------------------------------------------------------ */
/* hhea                                                                */
/* ------------------------------------------------------------------ */

/**
 * @param {{ ascender: number, descender: number, lineGap: number, advanceWidthMax: number,
 *   minLeftSideBearing: number, minRightSideBearing: number, xMaxExtent: number,
 *   caretSlopeRise: number, caretSlopeRun: number, numberOfHMetrics: number }} h
 */
export function writeHhea(h) {
  const w = new Writer(36);
  w.u16(1).u16(0);
  w.i16(h.ascender).i16(h.descender).i16(h.lineGap);
  w.u16(h.advanceWidthMax);
  w.i16(h.minLeftSideBearing).i16(h.minRightSideBearing).i16(h.xMaxExtent);
  w.i16(h.caretSlopeRise).i16(h.caretSlopeRun).i16(0);
  w.i16(0).i16(0).i16(0).i16(0);
  w.i16(0);
  w.u16(h.numberOfHMetrics);
  return w.toBytes();
}

/** @param {Uint8Array} b */
export function readHhea(b) {
  const r = new Reader(b, 0, 'hhea');
  r.u32();
  const ascender = r.i16();
  const descender = r.i16();
  const lineGap = r.i16();
  const advanceWidthMax = r.u16();
  const minLeftSideBearing = r.i16();
  const minRightSideBearing = r.i16();
  const xMaxExtent = r.i16();
  const caretSlopeRise = r.i16();
  const caretSlopeRun = r.i16();
  r.pos = 34;
  const numberOfHMetrics = r.u16();
  return { ascender, descender, lineGap, advanceWidthMax, minLeftSideBearing, minRightSideBearing, xMaxExtent, caretSlopeRise, caretSlopeRun, numberOfHMetrics };
}

/* ------------------------------------------------------------------ */
/* maxp                                                                */
/* ------------------------------------------------------------------ */

/**
 * maxp 1.0 for TrueType outlines, 0.5 when `cff` is set.
 * @param {{ numGlyphs: number, cff?: boolean, maxPoints?: number, maxContours?: number,
 *   maxCompositePoints?: number, maxCompositeContours?: number, maxZones?: number,
 *   maxTwilightPoints?: number, maxStorage?: number, maxFunctionDefs?: number,
 *   maxInstructionDefs?: number, maxStackElements?: number, maxSizeOfInstructions?: number,
 *   maxComponentElements?: number, maxComponentDepth?: number }} m
 */
export function writeMaxp(m) {
  const w = new Writer(32);
  if (m.cff) {
    w.u32(0x00005000).u16(m.numGlyphs);
    return w.toBytes();
  }
  w.u32(0x00010000).u16(m.numGlyphs);
  w.u16(m.maxPoints || 0).u16(m.maxContours || 0);
  w.u16(m.maxCompositePoints || 0).u16(m.maxCompositeContours || 0);
  w.u16(m.maxZones ?? 2).u16(m.maxTwilightPoints || 0).u16(m.maxStorage || 0);
  w.u16(m.maxFunctionDefs || 0).u16(m.maxInstructionDefs || 0).u16(m.maxStackElements || 0);
  w.u16(m.maxSizeOfInstructions || 0).u16(m.maxComponentElements || 0).u16(m.maxComponentDepth || 0);
  return w.toBytes();
}

/** @param {Uint8Array} b */
export function readMaxp(b) {
  const r = new Reader(b, 0, 'maxp');
  const version = r.u32();
  const numGlyphs = r.u16();
  if (version === 0x00005000) return { version, numGlyphs };
  const names = ['maxPoints', 'maxContours', 'maxCompositePoints', 'maxCompositeContours', 'maxZones', 'maxTwilightPoints',
    'maxStorage', 'maxFunctionDefs', 'maxInstructionDefs', 'maxStackElements', 'maxSizeOfInstructions',
    'maxComponentElements', 'maxComponentDepth'];
  /** @type {Record<string, number>} */
  const out = { version, numGlyphs };
  for (const n of names) out[n] = r.u16();
  return out;
}

/* ------------------------------------------------------------------ */
/* OS/2                                                                */
/* ------------------------------------------------------------------ */

// OpenType ulUnicodeRange bits: [bit, start, end, start, end, ...]
const UNICODE_RANGES = [
  [0, 0x0000, 0x007f], [1, 0x0080, 0x00ff], [2, 0x0100, 0x017f], [3, 0x0180, 0x024f],
  [4, 0x0250, 0x02af, 0x1d00, 0x1dbf], [5, 0x02b0, 0x02ff, 0xa700, 0xa71f], [6, 0x0300, 0x036f, 0x1dc0, 0x1dff],
  [7, 0x0370, 0x03ff], [8, 0x2c80, 0x2cff], [9, 0x0400, 0x052f, 0x2de0, 0x2dff, 0xa640, 0xa69f], [10, 0x0530, 0x058f],
  [11, 0x0590, 0x05ff], [12, 0xa500, 0xa63f], [13, 0x0600, 0x06ff, 0x0750, 0x077f], [14, 0x07c0, 0x07ff],
  [15, 0x0900, 0x097f], [16, 0x0980, 0x09ff], [17, 0x0a00, 0x0a7f], [18, 0x0a80, 0x0aff], [19, 0x0b00, 0x0b7f],
  [20, 0x0b80, 0x0bff], [21, 0x0c00, 0x0c7f], [22, 0x0c80, 0x0cff], [23, 0x0d00, 0x0d7f], [24, 0x0e00, 0x0e7f],
  [25, 0x0e80, 0x0eff], [26, 0x10a0, 0x10ff, 0x2d00, 0x2d2f], [27, 0x1b00, 0x1b7f], [28, 0x1100, 0x11ff],
  [29, 0x1e00, 0x1eff, 0x2c60, 0x2c7f, 0xa720, 0xa7ff], [30, 0x1f00, 0x1fff], [31, 0x2000, 0x206f, 0x2e00, 0x2e7f],
  [32, 0x2070, 0x209f], [33, 0x20a0, 0x20cf], [34, 0x20d0, 0x20ff], [35, 0x2100, 0x214f], [36, 0x2150, 0x218f],
  [37, 0x2190, 0x21ff, 0x27f0, 0x27ff, 0x2900, 0x297f, 0x2b00, 0x2bff],
  [38, 0x2200, 0x22ff, 0x2a00, 0x2aff, 0x27c0, 0x27ef, 0x2980, 0x29ff], [39, 0x2300, 0x23ff], [40, 0x2400, 0x243f],
  [41, 0x2440, 0x245f], [42, 0x2460, 0x24ff], [43, 0x2500, 0x257f], [44, 0x2580, 0x259f], [45, 0x25a0, 0x25ff],
  [46, 0x2600, 0x26ff], [47, 0x2700, 0x27bf], [48, 0x3000, 0x303f], [49, 0x3040, 0x309f], [50, 0x30a0, 0x30ff, 0x31f0, 0x31ff],
  [51, 0x3100, 0x312f, 0x31a0, 0x31bf], [52, 0x3130, 0x318f], [53, 0xa840, 0xa87f], [54, 0x3200, 0x32ff], [55, 0x3300, 0x33ff],
  [56, 0xac00, 0xd7af], [58, 0x10900, 0x1091f],
  [59, 0x4e00, 0x9fff, 0x2e80, 0x2fdf, 0x2ff0, 0x2fff, 0x3400, 0x4dbf, 0x20000, 0x2a6df, 0x3190, 0x319f],
  [60, 0xe000, 0xf8ff], [61, 0x31c0, 0x31ef, 0xf900, 0xfaff, 0x2f800, 0x2fa1f], [62, 0xfb00, 0xfb4f], [63, 0xfb50, 0xfdff],
  [64, 0xfe20, 0xfe2f], [65, 0xfe10, 0xfe1f, 0xfe30, 0xfe4f], [66, 0xfe50, 0xfe6f], [67, 0xfe70, 0xfeff], [68, 0xff00, 0xffef],
  [69, 0xfff0, 0xffff], [70, 0x0f00, 0x0fff], [71, 0x0700, 0x074f], [72, 0x0780, 0x07bf], [73, 0x0d80, 0x0dff],
  [74, 0x1000, 0x109f], [75, 0x1200, 0x139f, 0x2d80, 0x2ddf], [76, 0x13a0, 0x13ff], [77, 0x1400, 0x167f], [78, 0x1680, 0x169f],
  [79, 0x16a0, 0x16ff], [80, 0x1780, 0x17ff, 0x19e0, 0x19ff], [81, 0x1800, 0x18af], [82, 0x2800, 0x28ff], [83, 0xa000, 0xa4cf],
  [84, 0x1700, 0x177f], [85, 0x10300, 0x1032f], [86, 0x10330, 0x1034f], [87, 0x10400, 0x1044f], [88, 0x1d000, 0x1d24f],
  [89, 0x1d400, 0x1d7ff], [90, 0xf0000, 0x10fffd], [91, 0xfe00, 0xfe0f, 0xe0100, 0xe01ef], [92, 0xe0000, 0xe007f],
  [93, 0x1900, 0x194f], [94, 0x1950, 0x197f], [95, 0x1980, 0x19df], [96, 0x1a00, 0x1a1f], [97, 0x2c00, 0x2c5f],
  [98, 0x2d30, 0x2d7f], [99, 0x4dc0, 0x4dff], [100, 0xa800, 0xa82f], [101, 0x10000, 0x1013f], [102, 0x10140, 0x1018f],
  [103, 0x10380, 0x1039f], [104, 0x103a0, 0x103df], [105, 0x10450, 0x1047f], [106, 0x10480, 0x104af], [107, 0x10800, 0x1083f],
  [108, 0x10a00, 0x10a5f], [109, 0x1d300, 0x1d35f], [110, 0x12000, 0x1247f], [111, 0x1d360, 0x1d37f], [112, 0x1b80, 0x1bbf],
  [113, 0x1c00, 0x1c4f], [114, 0x1c50, 0x1c7f], [115, 0xa880, 0xa8df], [116, 0xa900, 0xa92f], [117, 0xa930, 0xa95f],
  [118, 0xaa00, 0xaa5f], [119, 0x10190, 0x101cf], [120, 0x101d0, 0x101ff], [121, 0x102a0, 0x102df, 0x10280, 0x1029f, 0x10920, 0x1093f],
  [122, 0x1f000, 0x1f09f],
];

/**
 * The four ulUnicodeRange words for a set of code points.
 * @param {Iterable<number>} codes
 * @returns {[number, number, number, number]}
 */
export function unicodeRangeBits(codes) {
  const words = [0, 0, 0, 0];
  const set = (bit) => {
    words[bit >> 5] = (words[bit >> 5] | (1 << (bit & 31))) >>> 0;
  };
  for (const c of codes) {
    if (c > 0xffff) set(57);
    for (const range of UNICODE_RANGES) {
      let hit = false;
      for (let i = 1; i < range.length; i += 2) {
        if (c >= range[i] && c <= range[i + 1]) {
          hit = true;
          break;
        }
      }
      if (hit) {
        set(range[0]);
        break;
      }
    }
  }
  return /** @type {[number, number, number, number]} */ (words);
}

/**
 * ulCodePageRange words from the characters a font covers.
 * @param {Set<number>} codes
 * @returns {[number, number]}
 */
export function codePageBits(codes) {
  let lo = 0;
  const hasAll = (list) => list.every((c) => codes.has(c));
  const latin = codes.has(0x41) && codes.has(0x61);
  if (latin && hasAll([0xe9, 0xe7, 0xe3])) lo |= 1 << 0; // 1252 Latin 1
  if (latin && hasAll([0x10d, 0x159, 0x142])) lo |= 1 << 1; // 1250 Latin 2
  if (hasAll([0x410, 0x430, 0x44f])) lo |= 1 << 2; // 1251 Cyrillic
  if (hasAll([0x391, 0x3b1, 0x3c9])) lo |= 1 << 3; // 1253 Greek
  if (latin && hasAll([0x11e, 0x11f, 0x130, 0x131, 0x15e, 0x15f])) lo |= 1 << 4; // 1254 Turkish
  if (latin && hasAll([0x100, 0x101, 0x16b, 0x173])) lo |= 1 << 7; // 1257 Baltic
  if (latin) lo |= 1 << 29; // Mac Roman
  if (!lo) lo = 1; // Symbol and icon fonts: Latin 1 is the safest choice for Windows.
  return [lo >>> 0, 0];
}

/** @param {string} style */
export function weightFromStyle(style) {
  const s = style.toLowerCase().replace(/[\s_-]/g, '');
  const table = [
    ['hairline', 100], ['thin', 100], ['extralight', 200], ['ultralight', 200], ['light', 300], ['book', 400],
    ['regular', 400], ['normal', 400], ['medium', 500], ['semibold', 600], ['demibold', 600], ['extrabold', 800],
    ['ultrabold', 800], ['bold', 700], ['heavy', 900], ['black', 900],
  ];
  for (const [k, v] of table) if (s.includes(/** @type {string} */ (k))) return /** @type {number} */ (v);
  return 400;
}

/**
 * @param {{
 *   xAvgCharWidth: number, weightClass: number, widthClass?: number, fsType?: number,
 *   unitsPerEm: number, unicodeRange: number[], codePageRange: number[], vendorID: string,
 *   fsSelection: number, firstChar: number, lastChar: number, typoAscender: number,
 *   typoDescender: number, typoLineGap: number, winAscent: number, winDescent: number,
 *   xHeight: number, capHeight: number, defaultChar?: number, breakChar?: number,
 *   maxContext: number, panose?: number[],
 * }} o
 */
export function writeOS2(o) {
  const upm = o.unitsPerEm;
  const w = new Writer(96);
  w.u16(4);
  w.i16(o.xAvgCharWidth);
  w.u16(o.weightClass).u16(o.widthClass ?? 5).u16(o.fsType ?? 0);
  // Subscript and superscript metrics follow the common 65 percent convention.
  const subX = Math.round(upm * 0.65);
  const subY = Math.round(upm * 0.6);
  w.i16(subX).i16(subY).i16(0).i16(Math.round(upm * 0.075));
  w.i16(subX).i16(subY).i16(0).i16(Math.round(upm * 0.35));
  w.i16(Math.round(upm * 0.05)).i16(Math.round(o.xHeight * 0.5 + upm * 0.025));
  w.i16(0); // sFamilyClass
  const panose = o.panose || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 10; i++) w.u8(panose[i] || 0);
  for (const word of o.unicodeRange) w.u32(word);
  w.tag((o.vendorID || 'NONE').padEnd(4, ' ').slice(0, 4));
  w.u16(o.fsSelection);
  w.u16(Math.min(0xffff, o.firstChar)).u16(Math.min(0xffff, o.lastChar));
  w.i16(o.typoAscender).i16(o.typoDescender).i16(o.typoLineGap);
  w.u16(Math.max(0, o.winAscent)).u16(Math.max(0, o.winDescent));
  w.u32(o.codePageRange[0]).u32(o.codePageRange[1]);
  w.i16(o.xHeight).i16(o.capHeight);
  w.u16(o.defaultChar ?? 0).u16(o.breakChar ?? 32);
  w.u16(o.maxContext);
  return w.toBytes();
}

/** @param {Uint8Array} b */
export function readOS2(b) {
  const r = new Reader(b, 0, 'OS/2');
  const version = r.u16();
  const xAvgCharWidth = r.i16();
  const weightClass = r.u16();
  const widthClass = r.u16();
  const fsType = r.u16();
  r.pos = 30;
  r.i16(); // family class
  const panose = Array.from(r.take(10));
  const unicodeRange = [r.u32(), r.u32(), r.u32(), r.u32()];
  const vendorID = r.tag();
  const fsSelection = r.u16();
  const firstChar = r.u16();
  const lastChar = r.u16();
  /** @type {Record<string, any>} */
  const out = { version, xAvgCharWidth, weightClass, widthClass, fsType, panose, unicodeRange, vendorID, fsSelection, firstChar, lastChar };
  if (b.length >= 78) {
    out.typoAscender = r.i16();
    out.typoDescender = r.i16();
    out.typoLineGap = r.i16();
    out.winAscent = r.u16();
    out.winDescent = r.u16();
  }
  if (version >= 1 && b.length >= 86) out.codePageRange = [r.u32(), r.u32()];
  if (version >= 2 && b.length >= 96) {
    out.xHeight = r.i16();
    out.capHeight = r.i16();
    out.defaultChar = r.u16();
    out.breakChar = r.u16();
    out.maxContext = r.u16();
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* hmtx                                                                */
/* ------------------------------------------------------------------ */

/**
 * @param {Array<{ advanceWidth: number, lsb: number }>} metrics
 * @returns {{ bytes: Uint8Array, numberOfHMetrics: number }}
 */
export function writeHmtx(metrics) {
  let n = metrics.length;
  while (n > 1 && metrics[n - 1].advanceWidth === metrics[n - 2].advanceWidth) n--;
  const w = new Writer(n * 4 + (metrics.length - n) * 2);
  for (let i = 0; i < metrics.length; i++) {
    if (i < n) w.u16(Math.max(0, Math.round(metrics[i].advanceWidth)));
    w.i16(metrics[i].lsb);
  }
  return { bytes: w.toBytes(), numberOfHMetrics: n };
}

/** @param {Uint8Array} b @param {number} numberOfHMetrics @param {number} numGlyphs */
export function readHmtx(b, numberOfHMetrics, numGlyphs) {
  const r = new Reader(b, 0, 'hmtx');
  const out = [];
  let last = 0;
  for (let i = 0; i < numGlyphs; i++) {
    if (i < numberOfHMetrics) last = r.u16();
    const lsb = r.pos + 2 <= b.length ? r.i16() : 0;
    out.push({ advanceWidth: last, lsb });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* cmap                                                                */
/* ------------------------------------------------------------------ */

/**
 * Builds a cmap with format 4 subtables for the BMP (Unicode and Windows
 * platforms) and format 12 subtables when any code point is above U+FFFF.
 * @param {Map<number, number>} map code point to glyph id
 */
export function writeCmap(map) {
  const codes = [...map.keys()].sort((a, b) => a - b);
  const bmp = codes.filter((c) => c <= 0xffff);
  const needs12 = codes.some((c) => c > 0xffff);
  const f4 = format4(bmp, map);
  const f12 = needs12 ? format12(codes, map) : null;
  /** @type {Array<[number, number, Uint8Array]>} */
  const records = needs12
    ? [[0, 3, f4], [0, 4, /** @type {Uint8Array} */ (f12)], [3, 1, f4], [3, 10, /** @type {Uint8Array} */ (f12)]]
    : [[0, 3, f4], [3, 1, f4]];
  const w = new Writer();
  w.u16(0).u16(records.length);
  let offset = 4 + records.length * 8;
  /** @type {Map<Uint8Array, number>} */
  const placed = new Map();
  const bodies = [];
  for (const [platform, encoding, data] of records) {
    let at = placed.get(data);
    if (at === undefined) {
      at = offset;
      placed.set(data, at);
      bodies.push(data);
      offset += data.length;
    }
    w.u16(platform).u16(encoding).u32(at);
  }
  for (const body of bodies) w.bytes(body);
  return w.toBytes();
}

/** @param {number[]} codes sorted BMP code points @param {Map<number, number>} map */
function format4(codes, map) {
  // Segments of consecutive code points; a segment uses idDelta when its
  // glyph ids are consecutive too, otherwise a glyphIdArray range.
  const segs = [];
  for (const c of codes) {
    const last = segs[segs.length - 1];
    if (last && c === last.end + 1) last.end = c;
    else segs.push({ start: c, end: c });
  }
  // Split segments where switching between delta runs saves space.
  const finalSegs = [];
  for (const s of segs) {
    let runStart = s.start;
    for (let c = s.start + 1; c <= s.end + 1; c++) {
      const broken = c > s.end || /** @type {number} */ (map.get(c)) - /** @type {number} */ (map.get(c - 1)) !== 1;
      if (broken) {
        finalSegs.push({ start: runStart, end: c - 1 });
        runStart = c;
      }
    }
  }
  // Merge tiny delta runs back into array segments when cheaper (each segment costs 8 bytes).
  const merged = [];
  for (const s of finalSegs) {
    const last = merged[merged.length - 1];
    if (last && s.start === last.end + 1 && (s.end - s.start + 1) <= 4 && (last.array || last.end - last.start + 1 <= 4)) {
      last.end = s.end;
      last.array = true;
    } else merged.push({ ...s, array: false });
  }
  merged.push({ start: 0xffff, end: 0xffff, array: false, terminator: true });
  const segCountX2 = merged.length * 2;
  let searchRange = 2;
  let entrySelector = 0;
  while (searchRange * 2 <= segCountX2) {
    searchRange *= 2;
    entrySelector++;
  }
  const glyphIds = [];
  const idDelta = [];
  const idRangeOffset = [];
  merged.forEach((s, i) => {
    if (s.terminator) {
      idDelta.push(1);
      idRangeOffset.push(0);
    } else if (s.array) {
      idDelta.push(0);
      idRangeOffset.push((merged.length - i + glyphIds.length) * 2);
      for (let c = s.start; c <= s.end; c++) glyphIds.push(map.get(c) || 0);
    } else {
      idDelta.push(((map.get(s.start) || 0) - s.start) & 0xffff);
      idRangeOffset.push(0);
    }
  });
  const w = new Writer();
  w.u16(4).u16(0).u16(0);
  w.u16(segCountX2).u16(searchRange).u16(entrySelector).u16(segCountX2 - searchRange);
  for (const s of merged) w.u16(s.end);
  w.u16(0);
  for (const s of merged) w.u16(s.start);
  for (const d of idDelta) w.u16(d);
  for (const o of idRangeOffset) w.u16(o);
  for (const g of glyphIds) w.u16(g);
  const bytes = w.toBytes();
  if (bytes.length > 0xffff) throw new RangeError('cmap: format 4 subtable larger than 64 KB');
  bytes[2] = bytes.length >> 8;
  bytes[3] = bytes.length & 255;
  return bytes;
}

/** @param {number[]} codes @param {Map<number, number>} map */
function format12(codes, map) {
  const groups = [];
  for (const c of codes) {
    const g = /** @type {number} */ (map.get(c));
    const last = groups[groups.length - 1];
    if (last && c === last.end + 1 && g === last.glyph + (c - last.start)) last.end = c;
    else groups.push({ start: c, end: c, glyph: g });
  }
  const w = new Writer();
  w.u16(12).u16(0).u32(16 + groups.length * 12).u32(0).u32(groups.length);
  for (const gr of groups) w.u32(gr.start).u32(gr.end).u32(gr.glyph);
  return w.toBytes();
}

/**
 * Reads the best Unicode subtable of a cmap: (3,10) or (0,4) format 12 first,
 * then (3,1), (0,3) and other Unicode subtables, then (3,0) symbol fonts.
 * @param {Uint8Array} b
 * @returns {Map<number, number>} code point to glyph id
 */
export function readCmap(b) {
  const r = new Reader(b, 0, 'cmap');
  r.u16();
  const n = r.u16();
  const subs = [];
  for (let i = 0; i < n; i++) subs.push({ platform: r.u16(), encoding: r.u16(), offset: r.u32() });
  const rank = (s) => {
    const fmt = b.length >= s.offset + 2 ? (b[s.offset] << 8) | b[s.offset + 1] : -1;
    if (fmt === 12 && (s.platform === 3 || s.platform === 0)) return 0;
    if (fmt === 4 && s.platform === 3 && s.encoding === 1) return 1;
    if (fmt === 4 && s.platform === 0) return 2;
    if ((fmt === 6 || fmt === 0) && s.platform === 0) return 3;
    if (s.platform === 3 && s.encoding === 0) return 4;
    return 9;
  };
  const sorted = subs.filter((s) => rank(s) < 9).sort((a, c) => rank(a) - rank(c));
  /** @type {Map<number, number>} */
  const map = new Map();
  if (!sorted.length) return map;
  const s = sorted[0];
  const rr = new Reader(b, s.offset, 'cmap subtable');
  const format = rr.u16();
  if (format === 4) {
    rr.u16();
    rr.u16();
    const segX2 = rr.u16();
    rr.pos += 6;
    const segs = segX2 / 2;
    const base = rr.pos;
    for (let i = 0; i < segs; i++) {
      const at = (k) => new Reader(b, base + k * segX2 + (k >= 1 ? 2 : 0) + i * 2, 'cmap format 4');
      const end = at(0).u16();
      const start = at(1).u16();
      const delta = at(2).i16();
      const roPos = base + 3 * segX2 + 2 + i * 2;
      const ro = new Reader(b, roPos, 'cmap format 4').u16();
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let g;
        if (ro === 0) g = (c + delta) & 0xffff;
        else {
          const p = roPos + ro + (c - start) * 2;
          if (p + 2 > b.length) continue;
          g = (b[p] << 8) | b[p + 1];
          if (g) g = (g + delta) & 0xffff;
        }
        if (g) map.set(c, g);
      }
    }
  } else if (format === 12) {
    rr.u16();
    rr.u32();
    rr.u32();
    const groups = rr.u32();
    for (let i = 0; i < groups; i++) {
      const start = rr.u32();
      const end = rr.u32();
      const g = rr.u32();
      for (let c = start; c <= end && c - start < 0x110000; c++) map.set(c, g + (c - start));
    }
  } else if (format === 6) {
    rr.u16();
    rr.u16();
    const first = rr.u16();
    const count = rr.u16();
    for (let i = 0; i < count; i++) {
      const g = rr.u16();
      if (g) map.set(first + i, g);
    }
  } else if (format === 0) {
    rr.u16();
    rr.u16();
    for (let c = 0; c < 256; c++) {
      const g = rr.u8();
      if (g) map.set(c, g);
    }
  }
  if (s.platform === 3 && s.encoding === 0) {
    // Symbol fonts map U+F0xx; expose the ASCII equivalents too.
    for (const [c, g] of [...map]) if (c >= 0xf020 && c <= 0xf0ff && !map.has(c - 0xf000)) map.set(c - 0xf000, g);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* name                                                                */
/* ------------------------------------------------------------------ */

/**
 * Writes Windows (3, 1, 0x409) records plus Mac Roman (1, 0, 0) copies of the
 * basic family names for older software.
 * @param {Array<[number, string]>} records name id and text
 */
export function writeName(records) {
  const entries = [];
  for (const [id, text] of records) {
    if (text === undefined || text === null || text === '') continue;
    if ((id <= 6 || id === 16 || id === 17) && /^[ -~]*$/.test(text)) entries.push({ platform: 1, encoding: 0, language: 0, id, bytes: macRomanBytes(text) });
    entries.push({ platform: 3, encoding: 1, language: 0x409, id, bytes: utf16beBytes(text) });
  }
  entries.sort((a, b) => a.platform - b.platform || a.encoding - b.encoding || a.language - b.language || a.id - b.id);
  const w = new Writer();
  w.u16(0).u16(entries.length).u16(6 + entries.length * 12);
  let offset = 0;
  const pool = new Writer();
  /** @type {Map<string, number>} */
  const shared = new Map();
  for (const e of entries) {
    const key = Array.from(e.bytes).join(',');
    let at = shared.get(key);
    if (at === undefined) {
      at = offset;
      shared.set(key, at);
      pool.bytes(e.bytes);
      offset += e.bytes.length;
    }
    w.u16(e.platform).u16(e.encoding).u16(e.language).u16(e.id).u16(e.bytes.length).u16(at);
  }
  w.bytes(pool.toBytes());
  return w.toBytes();
}

/**
 * Reads name records, preferring Windows English, then any Windows record,
 * then Mac Roman.
 * @param {Uint8Array} b
 * @returns {Record<number, string>}
 */
export function readName(b) {
  const r = new Reader(b, 0, 'name');
  r.u16();
  const count = r.u16();
  const storage = r.u16();
  /** @type {Record<number, { text: string, score: number }>} */
  const best = {};
  for (let i = 0; i < count; i++) {
    const platform = r.u16();
    const encoding = r.u16();
    const language = r.u16();
    const id = r.u16();
    const length = r.u16();
    const offset = r.u16();
    const start = storage + offset;
    if (start + length > b.length) continue;
    const raw = b.subarray(start, start + length);
    let text;
    let score;
    if (platform === 3 || platform === 0) {
      text = utf16beString(raw);
      score = platform === 3 && language === 0x409 ? 3 : 2;
    } else if (platform === 1 && encoding === 0) {
      text = latin1String(raw);
      score = 1;
    } else continue;
    if (!best[id] || best[id].score < score) best[id] = { text, score };
  }
  /** @type {Record<number, string>} */
  const out = {};
  for (const [id, v] of Object.entries(best)) out[Number(id)] = v.text;
  return out;
}

/* ------------------------------------------------------------------ */
/* post                                                                */
/* ------------------------------------------------------------------ */

/** The 258 standard Macintosh glyph names used by post table format 2. */
export const MAC_GLYPH_NAMES = (
  '.notdef .null nonmarkingreturn space exclam quotedbl numbersign dollar percent ampersand quotesingle ' +
  'parenleft parenright asterisk plus comma hyphen period slash zero one two three four five six seven eight ' +
  'nine colon semicolon less equal greater question at A B C D E F G H I J K L M N O P Q R S T U V W X Y Z ' +
  'bracketleft backslash bracketright asciicircum underscore grave a b c d e f g h i j k l m n o p q r s t u ' +
  'v w x y z braceleft bar braceright asciitilde Adieresis Aring Ccedilla Eacute Ntilde Odieresis Udieresis ' +
  'aacute agrave acircumflex adieresis atilde aring ccedilla eacute egrave ecircumflex edieresis iacute igrave ' +
  'icircumflex idieresis ntilde oacute ograve ocircumflex odieresis otilde uacute ugrave ucircumflex udieresis ' +
  'dagger degree cent sterling section bullet paragraph germandbls registered copyright trademark acute ' +
  'dieresis notequal AE Oslash infinity plusminus lessequal greaterequal yen mu partialdiff summation product ' +
  'pi integral ordfeminine ordmasculine Omega ae oslash questiondown exclamdown logicalnot radical florin ' +
  'approxequal Delta guillemotleft guillemotright ellipsis nonbreakingspace Agrave Atilde Otilde OE oe endash ' +
  'emdash quotedblleft quotedblright quoteleft quoteright divide lozenge ydieresis Ydieresis fraction currency ' +
  'guilsinglleft guilsinglright fi fl daggerdbl periodcentered quotesinglbase quotedblbase perthousand ' +
  'Acircumflex Ecircumflex Aacute Edieresis Egrave Iacute Icircumflex Idieresis Igrave Oacute Ocircumflex ' +
  'apple Ograve Uacute Ucircumflex Ugrave dotlessi circumflex tilde macron breve dotaccent ring cedilla ' +
  'hungarumlaut ogonek caron Lslash lslash Scaron scaron Zcaron zcaron brokenbar Eth eth Yacute yacute Thorn ' +
  'thorn minus multiply onesuperior twosuperior threesuperior onehalf onequarter threequarters franc Gbreve ' +
  'gbreve Idotaccent Scedilla scedilla Cacute cacute Ccaron ccaron dcroat'
).split(' ');

const MAC_INDEX = new Map(MAC_GLYPH_NAMES.map((n, i) => [n, i]));

/**
 * post table. Format 2 (with glyph names) or format 3 (no names).
 * @param {{ italicAngle: number, underlinePosition: number, underlineThickness: number,
 *   isFixedPitch: boolean, glyphNames?: string[], version?: 2 | 3 }} p
 */
export function writePost(p) {
  const w = new Writer();
  const v3 = p.version === 3 || !p.glyphNames;
  w.u32(v3 ? 0x00030000 : 0x00020000);
  w.fixed(p.italicAngle);
  w.i16(p.underlinePosition).i16(p.underlineThickness);
  w.u32(p.isFixedPitch ? 1 : 0);
  w.u32(0).u32(0).u32(0).u32(0);
  if (v3) return w.toBytes();
  const names = /** @type {string[]} */ (p.glyphNames);
  w.u16(names.length);
  const extra = [];
  const extraIndex = new Map();
  for (const name of names) {
    const mac = MAC_INDEX.get(name);
    if (mac !== undefined) w.u16(mac);
    else {
      let idx = extraIndex.get(name);
      if (idx === undefined) {
        idx = extra.length;
        extra.push(name);
        extraIndex.set(name, idx);
      }
      w.u16(258 + idx);
    }
  }
  for (const name of extra) {
    const bytes = macRomanBytes(name.slice(0, 255));
    w.u8(bytes.length).bytes(bytes);
  }
  return w.toBytes();
}

/** @param {Uint8Array} b */
export function readPost(b) {
  const r = new Reader(b, 0, 'post');
  const version = r.u32();
  const italicAngle = r.fixed();
  const underlinePosition = r.i16();
  const underlineThickness = r.i16();
  const isFixedPitch = r.u32() !== 0;
  /** @type {{ version: number, italicAngle: number, underlinePosition: number, underlineThickness: number, isFixedPitch: boolean, glyphNames?: string[] }} */
  const out = { version, italicAngle, underlinePosition, underlineThickness, isFixedPitch };
  if (version === 0x00020000 && b.length >= 34) {
    r.pos = 32;
    const n = r.u16();
    const idx = [];
    for (let i = 0; i < n; i++) idx.push(r.u16());
    const extra = [];
    while (r.pos < b.length) {
      const len = r.u8();
      if (r.pos + len > b.length) break;
      extra.push(latin1String(r.take(len)));
    }
    out.glyphNames = idx.map((i) => (i < 258 ? MAC_GLYPH_NAMES[i] : extra[i - 258] ?? ''));
  } else if (version === 0x00010000) {
    out.glyphNames = MAC_GLYPH_NAMES.slice();
  }
  return out;
}
