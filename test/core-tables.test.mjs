import { describe, expect, it } from 'vitest';
import zlib from 'node:zlib';
import { Reader, Writer, checksum, toUint8, utf16beBytes, utf16beString, write255, writeBase128 } from '../src/core/binary.mjs';
import {
  MAC_GLYPH_NAMES, codePageBits, readCmap, readHead, readHhea, readHmtx, readMaxp, readName, readOS2, readPost,
  unicodeRangeBits, weightFromStyle, writeCmap, writeHead, writeHhea, writeHmtx, writeMaxp, writeName, writeOS2, writePost,
} from '../src/core/tables.mjs';
import { buildGlyfLoca, decodeGlyph, encodeCompositeGlyph, encodeSimpleGlyph, splitGlyf } from '../src/core/glyf.mjs';
import { assembleSfnt, readSfnt, verifyChecksums } from '../src/core/sfnt.mjs';
import { CFF_STANDARD_STRINGS, cleanStems, encodeCharstring, readCFF, runCharstring, writeCFF } from '../src/core/cff.mjs';
import { encodeClassDef, encodeCoverage, readClassDef, readCoverage, readGDEF, readGPOS, readKern, writeGDEF, writeGPOS, writeKern } from '../src/core/layout.mjs';
import { adler32, deflate, deflateRaw, inflate, inflateRaw } from '../src/core/deflate.mjs';

describe('binary', () => {
  it('writes and reads every number type', () => {
    const w = new Writer(2);
    w.u8(255).i8(-5).u16(65535).i16(-32768).u24(0x123456).u32(0xdeadbeef).i32(-7).fixed(1.5).f2dot14(-0.5).tag('OS/2');
    w.longDateTime(new Date('2026-01-01T00:00:00Z'));
    const r = new Reader(w.toBytes());
    expect([r.u8(), r.i8(), r.u16(), r.i16(), r.u24(), r.u32(), r.i32(), r.fixed(), r.f2dot14(), r.tag()]).toEqual([255, -5, 65535, -32768, 0x123456, 0xdeadbeef, -7, 1.5, -0.5, 'OS/2']);
    expect(r.longDateTime().toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(() => r.u8()).toThrow(/unexpected end/);
  });

  it('encodes the WOFF2 variable length integers', () => {
    const w = new Writer();
    for (const v of [0, 127, 128, 16383, 0xffffffff]) writeBase128(w, v);
    for (const v of [0, 252, 253, 505, 506, 761, 762, 65535]) write255(w, v);
    const r = new Reader(w.toBytes());
    expect([0, 1, 2, 3, 4].map(() => r.base128())).toEqual([0, 127, 128, 16383, 0xffffffff]);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(() => r.u255())).toEqual([0, 252, 253, 505, 506, 761, 762, 65535]);
    expect(() => new Reader(new Uint8Array([0x80, 1])).base128()).toThrow(/leading zero/);
  });

  it('computes table checksums with padding and converts strings', () => {
    expect(checksum(new Uint8Array([0, 0, 0, 1, 0, 0, 0, 2]))).toBe(3);
    expect(checksum(new Uint8Array([1]))).toBe(0x01000000);
    expect(checksum(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0, 0, 0, 2]))).toBe(1);
    expect(utf16beString(utf16beBytes('Ação \u{1F600}'))).toBe('Ação \u{1F600}');
    expect(toUint8(new ArrayBuffer(3)).length).toBe(3);
    expect(toUint8(new DataView(new ArrayBuffer(4), 1, 2)).length).toBe(2);
    expect(() => toUint8(/** @type {any} */ ('x'))).toThrow(TypeError);
  });
});

describe('required tables', () => {
  it('round trips head, hhea, maxp and hmtx', () => {
    const head = { fontRevision: 1.2, unitsPerEm: 2048, created: new Date('2026-02-03T04:05:06Z'), modified: new Date('2026-02-03T04:05:06Z'), xMin: -10, yMin: -200, xMax: 900, yMax: 1000, macStyle: 1, lowestRecPPEM: 8, indexToLocFormat: 1, flags: 11 };
    const back = readHead(writeHead(head));
    expect(back.fontRevision).toBeCloseTo(1.2, 4);
    expect(back).toMatchObject({ ...head, fontRevision: back.fontRevision });
    const hhea = { ascender: 800, descender: -200, lineGap: 10, advanceWidthMax: 900, minLeftSideBearing: -5, minRightSideBearing: 3, xMaxExtent: 880, caretSlopeRise: 1, caretSlopeRun: 0, numberOfHMetrics: 4 };
    expect(readHhea(writeHhea(hhea))).toEqual(hhea);
    expect(readMaxp(writeMaxp({ numGlyphs: 7, cff: true }))).toEqual({ version: 0x5000, numGlyphs: 7 });
    expect(readMaxp(writeMaxp({ numGlyphs: 7, maxPoints: 40, maxContours: 3, maxStackElements: 12 }))).toMatchObject({ numGlyphs: 7, maxPoints: 40, maxContours: 3, maxZones: 2, maxStackElements: 12 });
    const metrics = [{ advanceWidth: 500, lsb: 0 }, { advanceWidth: 600, lsb: 10 }, { advanceWidth: 600, lsb: -4 }, { advanceWidth: 600, lsb: 7 }];
    const { bytes, numberOfHMetrics } = writeHmtx(metrics);
    expect(numberOfHMetrics).toBe(2);
    expect(bytes.length).toBe(2 * 4 + 2 * 2);
    expect(readHmtx(bytes, numberOfHMetrics, 4)).toEqual(metrics);
  });

  it('writes OS/2 version 4 with ranges and metrics', () => {
    const codes = new Set([0x41, 0x61, 0xe9, 0xe7, 0xe3, 0x10d, 0x159, 0x142, 0x1f600, 0xe000]);
    const os2 = writeOS2({
      xAvgCharWidth: 512, weightClass: 700, unitsPerEm: 1000, unicodeRange: unicodeRangeBits(codes), codePageRange: codePageBits(codes),
      vendorID: 'KWY', fsSelection: 0x20 | 0x80, firstChar: 0x41, lastChar: 0x1f600, typoAscender: 800, typoDescender: -200,
      typoLineGap: 0, winAscent: 950, winDescent: 250, xHeight: 500, capHeight: 700, maxContext: 2,
    });
    expect(os2.length).toBe(96);
    const r = readOS2(os2);
    expect(r).toMatchObject({ version: 4, weightClass: 700, vendorID: 'KWY ', firstChar: 0x41, lastChar: 0xffff, winAscent: 950, xHeight: 500, maxContext: 2 });
    const bits = (words, bit) => (words[bit >> 5] >>> (bit & 31)) & 1;
    for (const bit of [0, 1, 2, 57, 60]) expect(bits(r.unicodeRange, bit)).toBe(1);
    expect(bits(r.unicodeRange, 7)).toBe(0);
    expect(r.codePageRange[0] & 0b11).toBe(0b11);
    expect(codePageBits(new Set([0xe000]))[0]).toBe(1);
    expect(weightFromStyle('ExtraBold Italic')).toBe(800);
    expect(weightFromStyle('Semi Bold')).toBe(600);
    expect(weightFromStyle('Thin')).toBe(100);
    expect(weightFromStyle('Whatever')).toBe(400);
  });

  it('builds cmap format 4 and format 12 subtables', () => {
    const map = new Map([[0x20, 1], [0x41, 2], [0x42, 3], [0x43, 4], [0x61, 9], [0x62, 7], [0x63, 8], [0xe9, 5], [0xffef, 6]]);
    const bmp = writeCmap(map);
    expect(readCmap(bmp)).toEqual(map);
    const astral = new Map([...map, [0x1f600, 10], [0x1f601, 11], [0x10ffff, 12]]);
    const full = writeCmap(astral);
    expect(readCmap(full)).toEqual(astral);
    const r = new Reader(full);
    r.u16();
    expect(r.u16()).toBe(4);
    // Large sparse map stays below the 64 KB limit of format 4.
    const big = new Map();
    for (let i = 0; i < 5000; i++) big.set(0x4e00 + i * 3, i + 1);
    expect(readCmap(writeCmap(big))).toEqual(big);
  });

  it('writes Windows and Mac name records and reads the best one', () => {
    const bytes = writeName([[1, 'Sketch'], [2, 'Regular'], [4, 'Sketch Regular'], [9, 'Designer Ação'], [256, 'Weight']]);
    const names = readName(bytes);
    expect(names).toEqual({ 1: 'Sketch', 2: 'Regular', 4: 'Sketch Regular', 9: 'Designer Ação', 256: 'Weight' });
    const r = new Reader(bytes);
    r.u16();
    expect(r.u16()).toBe(3 + 5);
  });

  it('writes post format 2 and 3', () => {
    expect(MAC_GLYPH_NAMES).toHaveLength(258);
    const names = ['.notdef', 'space', 'A', 'atilde', 'uni0416', 'my.alt', 'uni0416'];
    const p = readPost(writePost({ italicAngle: -12.5, underlinePosition: -100, underlineThickness: 50, isFixedPitch: true, glyphNames: names }));
    expect(p).toMatchObject({ version: 0x20000, italicAngle: -12.5, underlinePosition: -100, isFixedPitch: true, glyphNames: names });
    const v3 = readPost(writePost({ italicAngle: 0, underlinePosition: -75, underlineThickness: 50, isFixedPitch: false }));
    expect(v3.version).toBe(0x30000);
    expect(v3.glyphNames).toBeUndefined();
  });
});

describe('sfnt container', () => {
  it('assembles a directory with checksums and the head adjustment', () => {
    const head = writeHead({ fontRevision: 1, unitsPerEm: 1000, created: new Date(0), modified: new Date(0), xMin: 0, yMin: 0, xMax: 0, yMax: 0, macStyle: 0, lowestRecPPEM: 8, indexToLocFormat: 0, flags: 3 });
    const tables = new Map([['head', head], ['zzzz', new Uint8Array([1, 2, 3])], ['AAAA', new Uint8Array(5)]]);
    const sfnt = assembleSfnt(tables);
    expect(verifyChecksums(sfnt)).toEqual([]);
    expect(checksum(sfnt)).toBe(0xb1b0afba);
    const back = readSfnt(sfnt);
    expect([...back.tables.keys()]).toEqual(['AAAA', 'head', 'zzzz']);
    expect([...back.tables.get('zzzz')]).toEqual([1, 2, 3]);
    sfnt[sfnt.length - 1] ^= 1;
    expect(verifyChecksums(sfnt).length).toBeGreaterThan(0);
    expect(() => readSfnt(sfnt.subarray(0, 40))).toThrow(/past the end/);
  });
});

describe('glyf', () => {
  it('round trips simple glyphs with compressed flags and coordinates', () => {
    const contours = [
      [{ x: 0, y: 0, on: true }, { x: 0, y: 700, on: true }, { x: 300, y: 700, on: false }, { x: 600, y: 0, on: true }],
      [{ x: 100, y: 100, on: true }, { x: 101, y: 100, on: true }, { x: 101, y: 100, on: true }, { x: 2000, y: -1000, on: false }],
    ];
    const bytes = encodeSimpleGlyph(contours, new Uint8Array([0xb0, 1]));
    const g = decodeGlyph(bytes);
    expect(g.contours).toEqual(contours);
    expect(g.box).toEqual({ xMin: 0, yMin: -1000, xMax: 2000, yMax: 700 });
    expect([...g.instructions]).toEqual([0xb0, 1]);
    // Twenty identical flags collapse into one repeat run.
    const line = Array.from({ length: 20 }, (_, i) => ({ x: i * 10, y: 0, on: true }));
    expect(encodeSimpleGlyph([line]).length).toBeLessThan(10 + 2 + 2 + 4 + 20 + 20);
    expect(encodeSimpleGlyph([]).length).toBe(0);
    expect(decodeGlyph(new Uint8Array(0)).contours).toEqual([]);
  });

  it('round trips composite glyphs with offsets, scales and matrices', () => {
    const comps = [
      { glyphIndex: 3, dx: 10, dy: -20 },
      { glyphIndex: 4, dx: 300, dy: 500, transform: /** @type {[number, number, number, number]} */ ([0.5, 0, 0, 0.5]) },
      { glyphIndex: 5, dx: -1, dy: 1, transform: /** @type {[number, number, number, number]} */ ([1, 0, 0, -1]) },
      { glyphIndex: 6, dx: 0, dy: 0, transform: /** @type {[number, number, number, number]} */ ([0.75, 0.25, -0.25, 0.75]) },
    ];
    const bytes = encodeCompositeGlyph(comps, { xMin: 0, yMin: -10, xMax: 500, yMax: 700 }, new Uint8Array([0x30]), { useMyMetrics: 0 });
    const g = decodeGlyph(bytes);
    expect(g.components.map((c) => ({ glyphIndex: c.glyphIndex, dx: c.dx, dy: c.dy, transform: c.transform }))).toEqual(comps.map((c) => ({ ...c, transform: c.transform })));
    expect([...g.instructions]).toEqual([0x30]);
  });

  it('uses short loca offsets when they fit and long ones otherwise', () => {
    const small = buildGlyfLoca([new Uint8Array(10), new Uint8Array(0), new Uint8Array(6)]);
    expect(small.indexToLocFormat).toBe(0);
    expect(splitGlyf(small.glyf, small.loca, 0, 3).map((r) => r.length)).toEqual([12, 0, 8]);
    const big = buildGlyfLoca(Array.from({ length: 3 }, () => new Uint8Array(70000)));
    expect(big.indexToLocFormat).toBe(1);
    expect(splitGlyf(big.glyf, big.loca, 1, 3).map((r) => r.length)).toEqual([70000, 70000, 70000]);
  });
});

describe('CFF', () => {
  it('has the 391 standard strings', () => {
    expect(CFF_STANDARD_STRINGS).toHaveLength(391);
    expect(CFF_STANDARD_STRINGS[0]).toBe('.notdef');
    expect(CFF_STANDARD_STRINGS[390]).toBe('Semibold');
  });

  it('round trips charstrings with widths, hints, lines and curves', () => {
    const glyph = {
      name: 'o', width: 612,
      contours: [[{ x: 0, y: 0, on: true }, { x: 100, y: 0, on: true }, { x: 100, y: 100, on: false }, { x: 0, y: 100, on: true }]],
      hstems: /** @type {Array<[number, number]>} */ ([[0, 50], [600, 40], [20, 10]]), vstems: /** @type {Array<[number, number]>} */ ([[10, 80]]),
    };
    const cs = encodeCharstring(glyph, 500, 600);
    const r = runCharstring(cs, [], [], 500, 600);
    expect(r.width).toBe(612);
    expect(r.hstems).toEqual([[0, 50], [600, 40]]);
    expect(r.vstems).toEqual([[10, 80]]);
    expect(r.contours).toHaveLength(1);
    expect(r.contours[0][0]).toEqual([0, 0]);
    expect(r.contours[0][1]).toEqual([100, 0]);
    expect(r.contours[0][2]).toEqual([100, 67, 67, 100, 0, 100]);
    expect(cleanStems([[0, 10], [5, 10], [30, -2], [40, 10]])).toEqual([[0, 10], [40, 10]]);
  });

  it('writes a CFF table that reads back', () => {
    const glyphs = [
      { name: '.notdef', width: 500, contours: [] },
      { name: 'A', width: 600, contours: [[{ x: 0, y: 0, on: true }, { x: 300, y: 700, on: true }, { x: 600, y: 0, on: true }]] },
      { name: 'customname', width: 600, contours: [] },
      { name: 'space', width: 250, contours: [] },
    ];
    const bytes = writeCFF({
      psName: 'Sketch-Regular', fullName: 'Sketch Regular', familyName: 'Sketch', weight: 'Regular', notice: 'Note',
      unitsPerEm: 2048, bbox: [0, 0, 600, 700], italicAngle: -10, underlinePosition: -100, underlineThickness: 50, isFixedPitch: false,
      glyphs, blueValues: [-10, 0, 500, 510], otherBlues: [-210, -200], stdHW: 40, stdVW: 80,
    });
    const f = readCFF(bytes);
    expect(f.psName).toBe('Sketch-Regular');
    expect(f.glyphNames).toEqual(['.notdef', 'A', 'customname', 'space']);
    expect(f.unitsPerEm).toBe(2048);
    expect(f.glyphs.map((g) => g.width)).toEqual([500, 600, 600, 250]);
    expect(f.topDict).toMatchObject({ fullName: 'Sketch Regular', familyName: 'Sketch', notice: 'Note', italicAngle: -10 });
    expect(f.privateDict).toMatchObject({ blueValues: [-10, 0, 500, 510], otherBlues: [-210, -200], stdHW: 40, stdVW: 80 });
    expect(f.glyphs[1].contours[0]).toEqual([[0, 0], [300, 700], [600, 0]]);
  });

  it('runs subroutines, flex and the shorthand curve operators', () => {
    const num = (v) => (v >= -107 && v <= 107 ? [v + 139] : [28, (v >> 8) & 255, v & 255]);
    const subr = new Uint8Array([...num(10), ...num(20), 5, 11]);
    const cs = new Uint8Array([
      ...num(0), ...num(0), 21, // rmoveto
      ...num(-107), 10, // callsubr 0 (bias 107): rlineto 10 20
      ...num(5), ...num(5), ...num(5), ...num(5), 31, // hvcurveto
      ...num(1), ...num(1), ...num(1), ...num(1), ...num(1), ...num(1), ...num(1), ...num(1), ...num(1), ...num(1), ...num(1), ...num(1), ...num(50), 12, 35, // flex
      14,
    ]);
    const r = runCharstring(cs, [], [subr], 0, 0);
    const c = r.contours[0];
    expect(c[1]).toEqual([10, 20]);
    expect(c[2]).toEqual([15, 20, 20, 25, 20, 30]);
    expect(c).toHaveLength(5);
  });
});

describe('layout tables', () => {
  it('encodes Coverage and ClassDef in the smaller format', () => {
    expect(readCoverage(encodeCoverage([1, 5, 9]), 0)).toEqual([1, 5, 9]);
    const range = Array.from({ length: 100 }, (_, i) => i + 10);
    const cov = encodeCoverage(range);
    expect(cov[1]).toBe(2);
    expect(readCoverage(cov, 0)).toEqual(range);
    const classes = new Map([[3, 1], [4, 1], [5, 2], [40, 3]]);
    expect(readClassDef(encodeClassDef(classes), 0)).toEqual(classes);
    const dense = new Map([[3, 1], [4, 2], [5, 1], [6, 2]]);
    expect(encodeClassDef(dense)[1]).toBe(1);
    expect(readClassDef(encodeClassDef(dense), 0)).toEqual(dense);
  });

  it('writes pair kerning with glyph exceptions before class pairs', () => {
    const gpos = /** @type {Uint8Array} */ (writeGPOS([
      { left: [1], right: [2], value: -80, leftClass: false, rightClass: false },
      { left: [3, 4], right: [5, 6], value: -20, leftClass: true, rightClass: true },
      { left: [3], right: [5], value: 0, leftClass: false, rightClass: false },
      { left: [4], right: [7, 8], value: -9, leftClass: false, rightClass: true },
    ]));
    const { pairs, classPairs } = readGPOS(gpos);
    const lookup = new Map(pairs.map(([l, r, v]) => [`${l},${r}`, v]));
    expect(lookup.get('1,2')).toBe(-80);
    expect(lookup.get('3,5')).toBe(0);
    expect(lookup.get('4,7')).toBe(-9);
    expect(lookup.get('4,8')).toBe(-9);
    expect(classPairs).toEqual([{ left: [3, 4], right: [5, 6], value: -20 }]);
    expect(writeGPOS([])).toBeNull();
    expect(writeGPOS([{ left: [1], right: [2], value: 0, leftClass: false, rightClass: false }])).toBeNull();
  });

  it('splits overlapping classes and switches to extension lookups when large', () => {
    const rules = [
      { left: [1, 2], right: [3], value: -5, leftClass: true, rightClass: true },
      { left: [2, 9], right: [4], value: -7, leftClass: true, rightClass: true },
    ];
    const { classPairs } = readGPOS(/** @type {Uint8Array} */ (writeGPOS(rules)));
    expect(classPairs).toHaveLength(2);
    const many = [];
    for (let l = 1; l < 400; l++) for (let r = 1; r < 60; r++) many.push({ left: [l], right: [r + 1000], value: -((l + r) % 50) - 1, leftClass: false, rightClass: false });
    const big = /** @type {Uint8Array} */ (writeGPOS(many));
    const back = readGPOS(big);
    expect(back.pairs).toHaveLength(many.length);
    const lookupType = new Reader(big, 10 + 0).u16();
    expect(lookupType).toBeGreaterThan(0);
  });

  it('writes GDEF glyph classes and the legacy kern table', () => {
    const gdef = writeGDEF(new Map([[1, 1], [2, 3]]));
    expect(readGDEF(gdef)).toEqual(new Map([[1, 1], [2, 3]]));
    const kern = /** @type {{ bytes: Uint8Array, dropped: number }} */ (writeKern([[2, 3, -40], [1, 2, -10], [1, 1, 0]]));
    expect(readKern(kern.bytes)).toEqual([[1, 2, -10], [2, 3, -40]]);
    const huge = [];
    for (let i = 0; i < 11000; i++) huge.push([i, i + 1, -1]);
    expect(/** @type {any} */ (writeKern(huge)).dropped).toBe(80);
    expect(writeKern([])).toBeNull();
  });
});

describe('deflate and inflate', () => {
  const samples = [
    new Uint8Array(0),
    new TextEncoder().encode('abracadabra '.repeat(2000)),
    Uint8Array.from({ length: 70000 }, (_, i) => (i * 7919) % 251),
    Uint8Array.from({ length: 50000 }, () => Math.floor(Math.random() * 256)),
    Uint8Array.from({ length: 300000 }, (_, i) => (i % 1000 < 500 ? 0 : i & 255)),
  ];

  it('round trips through its own codec', () => {
    for (const s of samples) {
      expect(inflate(deflate(s))).toEqual(s);
      expect(inflateRaw(deflateRaw(s))).toEqual(s);
    }
  });

  it('interoperates with zlib in both directions', () => {
    for (const s of samples) {
      expect(new Uint8Array(zlib.inflateSync(deflate(s)))).toEqual(s);
      expect(inflate(new Uint8Array(zlib.deflateSync(s, { level: 9 })))).toEqual(s);
      expect(inflate(new Uint8Array(zlib.deflateSync(s, { level: 0 })))).toEqual(s);
      expect(inflate(new Uint8Array(zlib.deflateSync(s, { level: 1, strategy: zlib.constants.Z_FIXED })))).toEqual(s);
    }
    const text = samples[1];
    expect(deflate(text).length).toBeLessThan(text.length / 20);
  });

  it('checks headers and checksums', () => {
    expect(adler32(new TextEncoder().encode('Wikipedia'))).toBe(0x11e60398);
    const good = deflate(new TextEncoder().encode('hello hello hello'));
    const bad = good.slice();
    bad[bad.length - 1] ^= 0xff;
    expect(() => inflate(bad)).toThrow(/checksum/);
    expect(() => inflate(new Uint8Array([0x78, 0x00, 0, 0, 0, 0]))).toThrow(/header/);
    expect(() => inflateRaw(new Uint8Array([0x07]))).toThrow();
  });
});
