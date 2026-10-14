import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';
import {
  addGlyph, bounds, composeAll, contourArea, createFont, cssFontFace, detectFormat, exportFont, exportFontAsync, interpolate,
  parseFont, parseFontAsync, setCodecs, sfntToWoff, sfntToWoff2, toSfnt, unicodeRange, verifyChecksums, woff2ToSfnt, woffToSfnt,
  inflate, deflate, MIME_TYPES,
} from '../src/node.mjs';
import { readSfnt } from '../src/core/sfnt.mjs';
import { readName, readOS2 } from '../src/core/tables.mjs';
import { flatKerning, rect, sampleFont, sampleVariableFont } from './helpers.mjs';

const T = new Date('2026-03-04T05:06:07Z');
const fixture = (name) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

/** Shape summary that ignores start point and direction choices. */
function shape(font, name) {
  const g = font.glyphs[name];
  const flat = [...g.contours];
  for (const c of g.components || []) {
    const sub = font.glyphs[c.glyph];
    const s = c.scale ?? 1;
    for (const ct of sub.contours) flat.push({ ...ct, points: ct.points.map((p) => ({ ...p, x: p.x * s + c.dx, y: p.y * s + c.dy })) });
  }
  return { area: flat.reduce((a, c) => a + Math.abs(contourArea(c)), 0), box: flat.length ? bounds(flat) : null, count: flat.length };
}

function expectSameOutlines(a, b, tol, merged = false) {
  expect(Object.keys(b.glyphs).sort()).toEqual(Object.keys(a.glyphs).sort());
  for (const name of Object.keys(a.glyphs)) {
    const x = shape(a, name);
    const y = shape(b, name);
    if (!merged) expect(y.count, name).toBe(x.count);
    if (!x.box) continue;
    for (const k of ['xMin', 'yMin', 'xMax', 'yMax']) expect(Math.abs(y.box[k] - x.box[k]), `${name} ${k}`).toBeLessThanOrEqual(tol);
    if (!merged) expect(Math.abs(y.area - x.area) / Math.max(1, x.area), `${name} area`).toBeLessThan(0.01);
    expect(b.glyphs[name].advanceWidth).toBe(Math.round(a.glyphs[name].advanceWidth));
    expect(b.glyphs[name].unicodes).toEqual(a.glyphs[name].unicodes);
  }
}

describe('export and parse round trips', () => {
  const font = sampleFont();
  composeAll(font, { chars: [...'áãÁç'] });

  for (const format of ['ttf', 'otf', 'woff', 'woff2']) {
    it(`round trips ${format}`, () => {
      const bytes = exportFont(font, { format, timestamp: T });
      expect(detectFormat(bytes)).toBe(format);
      const back = parseFont(bytes);
      expectSameOutlines(font, back, format === 'otf' ? 1 : 0.5, format === 'otf');
      if (format === 'otf') expect(back.glyphs.H.contours).toHaveLength(1);
      expect(back.meta).toMatchObject({ family: 'Sketch Test', style: 'Regular', version: '1.200', designer: 'Test Designer', license: 'MIT', unitsPerEm: 1000, ascender: 800, descender: -200, lineGap: 0, xHeight: 500, capHeight: 700, weightClass: 400 });
      expect(flatKerning(back)).toEqual(flatKerning(font));
      if (format !== 'otf') {
        expect(back.glyphs.aacute.components.map((c) => c.glyph)).toEqual(['a', 'acute']);
        expect(back.glyphs.aacute.contours).toEqual([]);
      } else {
        expect(back.glyphs.aacute.components).toBeUndefined();
        expect(back.glyphs.aacute.contours.length).toBeGreaterThan(1);
      }
      expect(verifyChecksums(toSfnt(bytes))).toEqual([]);
    });
  }

  it('keeps exact points in TrueType when optimisation is off', () => {
    const back = parseFont(exportFont(font, { format: 'ttf', optimize: false, correctDirections: false, timestamp: T }));
    for (const name of ['H', 'O', 'o', 'x', 'V', 'smiley']) {
      expect(back.glyphs[name].contours.map((c) => c.points.map((p) => [p.x, p.y, p.on]))).toEqual(font.glyphs[name].contours.map((c) => c.points.map((p) => [Math.round(p.x), Math.round(p.y), p.on])));
    }
  });

  it('is deterministic for a fixed timestamp and reports warnings', () => {
    const a = exportFont(font, { format: 'woff2', hinting: 'auto', timestamp: T });
    const b = exportFont(font, { format: 'woff2', hinting: 'auto', timestamp: T });
    expect(a).toEqual(b);
    const warnings = [];
    const f2 = sampleFont();
    f2.kerning.pairs['A|missing'] = -10;
    f2.kerning.pairs['nobar'] = -10;
    f2.kerning.classes['@x'] = ['A', 'ghost'];
    f2.kerning.pairs['@x|V'] = -5;
    exportFont(f2, { onWarning: (m) => warnings.push(m), timestamp: T });
    expect(warnings.join('\n')).toMatch(/missing glyph or class/);
    expect(warnings.join('\n')).toMatch(/left\|right/);
    expect(warnings.join('\n')).toMatch(/ghost/);
  });

  it('writes the legacy kern table on request', () => {
    const plain = readSfnt(exportFont(font, { timestamp: T })).tables;
    const legacy = readSfnt(exportFont(font, { legacyKern: true, timestamp: T })).tables;
    expect(plain.has('kern')).toBe(false);
    expect(legacy.has('kern')).toBe(true);
    const back = parseFont(exportFont({ ...font, kerning: font.kerning }, { legacyKern: true, timestamp: T }));
    expect(flatKerning(back)).toEqual(flatKerning(font));
  });

  it('rejects invalid fonts with a clear message', () => {
    const bad = createFont({ family: '' });
    addGlyph(bad, { name: 'a', unicodes: [32], advanceWidth: 10, contours: [] });
    expect(() => exportFont(bad)).toThrow(/meta\.family is empty[\s\S]*U\+0020 is mapped by both/);
    expect(() => exportFont(font, { format: /** @type {any} */ ('svg') })).toThrow(/unknown format/);
    const loop = sampleFont();
    addGlyph(loop, { name: 'loop1', advanceWidth: 10, contours: [], components: [{ glyph: 'loop2', dx: 0, dy: 0 }] });
    addGlyph(loop, { name: 'loop2', advanceWidth: 10, contours: [], components: [{ glyph: 'loop1', dx: 0, dy: 0 }] });
    expect(() => exportFont(loop)).toThrow(/contains itself/);
  });

  it('names styles outside Regular, Bold and Italic with typographic names', () => {
    const f = sampleFont();
    f.meta.style = 'Light Italic';
    f.meta.italicAngle = -10;
    const { tables } = readSfnt(exportFont(f, { timestamp: T }));
    const names = readName(tables.get('name'));
    expect(names[1]).toBe('Sketch Test Light');
    expect(names[2]).toBe('Italic');
    expect(names[16]).toBe('Sketch Test');
    expect(names[17]).toBe('Light Italic');
    expect(names[6]).toBe('SketchTest-LightItalic');
    const os2 = readOS2(tables.get('OS/2'));
    expect(os2.weightClass).toBe(300);
    expect(os2.fsSelection & 1).toBe(1);
    const back = parseFont(exportFont(f, { timestamp: T }));
    expect(back.meta.style).toBe('Light Italic');
    expect(back.meta.italicAngle).toBe(-10);
  });

  it('supports other units per em in CFF and TrueType', () => {
    const f = createFont({ family: 'Big', unitsPerEm: 2048, ascender: 1600, descender: -448, xHeight: 1000, capHeight: 1400 });
    addGlyph(f, { name: 'I', unicodes: [73], advanceWidth: 600, contours: [rect(100, 0, 300, 1400)] });
    for (const format of ['otf', 'ttf']) {
      const back = parseFont(exportFont(f, { format, timestamp: T }));
      expect(back.meta.unitsPerEm).toBe(2048);
      expect(bounds(back.glyphs.I.contours)).toEqual({ xMin: 100, yMin: 0, xMax: 300, yMax: 1400 });
    }
  });

  it('switches to long loca and format 12 cmap for large fonts', () => {
    const f = createFont({ family: 'Large' });
    for (let i = 0; i < 900; i++) {
      const pts = [];
      for (let k = 0; k < 60; k++) pts.push({ x: 300 + Math.round(Math.cos(k / 9.5) * (200 + k * 3)), y: 300 + Math.round(Math.sin(k / 9.5) * (200 + k * 5)), on: k % 3 !== 1 });
      addGlyph(f, { name: `u${(0x20000 + i).toString(16).toUpperCase()}`, unicodes: [0x20000 + i], advanceWidth: 1000, contours: [{ closed: true, points: pts }] });
    }
    const bytes = exportFont(f, { timestamp: T, optimize: false, correctDirections: false });
    const { tables } = readSfnt(bytes);
    expect(tables.get('head')[51]).toBe(1);
    const back = parseFont(bytes);
    expect(Object.keys(back.glyphs)).toHaveLength(902);
    expect(back.glyphs.u20383.unicodes).toEqual([0x20383]);
    expect(back.glyphs.u20383.contours[0].points).toEqual(f.glyphs.u20383.contours[0].points);
    expect(parseFont(exportFont(f, { format: 'woff2', timestamp: T })).glyphs.u20383.contours[0].points.length).toBe(60);
  });
});

describe('containers', () => {
  const sfnt = exportFont(sampleFont(), { timestamp: T, hinting: 'auto' });

  it('wraps and unwraps WOFF with either deflate implementation', () => {
    const woff = sfntToWoff(sfnt);
    expect(woff.length).toBeLessThan(sfnt.length);
    const back = woffToSfnt(woff);
    expect(verifyChecksums(back)).toEqual([]);
    expect(readSfnt(back).tables.get('glyf')).toEqual(readSfnt(sfnt).tables.get('glyf'));
    // Browser codec (pure JavaScript) produces data Node's zlib accepts and vice versa.
    setCodecs({ deflate, inflate });
    try {
      const jsWoff = sfntToWoff(sfnt);
      const { tables } = readSfnt(woffToSfnt(jsWoff));
      expect(tables.get('glyf')).toEqual(readSfnt(sfnt).tables.get('glyf'));
      expect(parseFont(woff).glyphs.H.advanceWidth).toBe(640);
    } finally {
      setCodecs({
        deflate: (d) => new Uint8Array(zlib.deflateSync(d, { level: 9 })),
        inflate: (d) => new Uint8Array(zlib.inflateSync(d)),
      });
    }
  });

  it('writes WOFF2 with and without the glyf transform', () => {
    const transformed = sfntToWoff2(sfnt);
    const plain = sfntToWoff2(sfnt, { transform: false });
    expect(transformed.length).toBeLessThan(plain.length);
    for (const w of [transformed, plain]) {
      const back = woff2ToSfnt(w);
      expect(verifyChecksums(back)).toEqual([]);
      const a = parseFont(back);
      expect(a.glyphs.O.contours).toEqual(parseFont(sfnt).glyphs.O.contours);
    }
    expect(() => woff2ToSfnt(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0x74, 0x74, 0x63, 0x66, 0, 0, 0, 0]))).toThrow(/collections/);
  });

  it('reads WOFF2 files encoded by another tool, including the hmtx transform', () => {
    const font = sampleFont();
    composeAll(font, { chars: [...'áãÁ'] });
    const back = parseFont(fixture('fonttools-hmtx.woff2'));
    expectSameOutlines(font, back, 0.5);
  });

  it('reads subroutinized CFF fonts from another tool', () => {
    const font = sampleFont();
    composeAll(font, { chars: [...'áãÁ'] });
    const back = parseFont(fixture('fonttools.otf'));
    expectSameOutlines(font, back, 1);
  });

  it('detects formats and rejects unknown data', () => {
    expect(detectFormat(new Uint8Array([0, 1, 0, 0]))).toBe('ttf');
    expect(detectFormat(new TextEncoder().encode('OTTO'))).toBe('otf');
    expect(detectFormat(new TextEncoder().encode('true'))).toBe('ttf');
    expect(detectFormat(new TextEncoder().encode('ttcf'))).toBe('ttc');
    expect(detectFormat(new Uint8Array([1, 2]))).toBe('unknown');
    expect(() => parseFont(new TextEncoder().encode('hello world'))).toThrow(/not a TTF/);
    expect(() => parseFont(new TextEncoder().encode('ttcf....'))).toThrow(/collections/);
    expect(MIME_TYPES.woff2).toBe('font/woff2');
  });

  it('has async helpers that load Brotli when needed', async () => {
    const bytes = await exportFontAsync(sampleFont(), { format: 'woff2', timestamp: T });
    expect(detectFormat(bytes)).toBe('woff2');
    expect((await parseFontAsync(bytes)).meta.family).toBe('Sketch Test');
    expect((await parseFontAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))).glyphs.H.advanceWidth).toBe(640);
  });
});

describe('variable fonts', () => {
  const vf = sampleVariableFont();

  it('round trips axes, instances and masters through TTF and WOFF2', () => {
    for (const format of ['ttf', 'woff2']) {
      const back = parseFont(exportFont(vf, { format, variable: true, timestamp: T }));
      expect(back.axes).toEqual([{ tag: 'wght', name: 'Weight', min: 100, default: 400, max: 900 }]);
      expect(back.instances.map((i) => i.name)).toEqual(['Thin', 'ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black']);
      expect(back.masters.map((m) => m.name).sort()).toEqual(['Black', 'Thin']);
      for (const w of [100, 300, 400, 650, 900]) {
        const a = interpolate(vf, { wght: w });
        const b = interpolate(back, { wght: w });
        for (const name of ['H', 'o', 'x', 'V', 'smiley']) {
          const pa = shape(a, name);
          const pb = shape(b, name);
          for (const k of ['xMin', 'yMin', 'xMax', 'yMax']) expect(Math.abs(pb.box[k] - pa.box[k]), `${format} ${w} ${name}`).toBeLessThanOrEqual(1);
          expect(Math.abs(b.glyphs[name].advanceWidth - a.glyphs[name].advanceWidth)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('reads IUP optimized sparse deltas and shared tuples written by another tool', () => {
    const back = parseFont(fixture('fonttools-iup.ttf'));
    for (const w of [100, 250, 650, 900]) {
      const a = interpolate(vf, { wght: w });
      const b = interpolate(back, { wght: w });
      for (const name of ['H', 'O', 'o', 'x', 'p', 'a', 'e']) {
        const pa = a.glyphs[name].contours.flatMap((c) => c.points);
        const pb = b.glyphs[name].contours.flatMap((c) => c.points);
        expect(pb.length).toBe(pa.length);
        let worst = 0;
        pa.forEach((p, i) => {
          worst = Math.max(worst, Math.abs(p.x - pb[i].x), Math.abs(p.y - pb[i].y));
        });
        expect(worst, `${name} at ${w}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('refuses CFF variable output and incompatible masters', () => {
    expect(() => exportFont(vf, { format: 'otf', variable: true })).toThrow(/variable fonts/);
    expect(() => exportFont(sampleFont(), { variable: true })).toThrow(/font\.axes/);
    const broken = sampleVariableFont();
    broken.masters[1].glyphs.H.contours = broken.masters[1].glyphs.H.contours.slice(1);
    expect(() => exportFont(broken, { variable: true })).toThrow(/glyph "H": master "Black" has 2 contours, the default has 3/);
    const flags = sampleVariableFont();
    flags.masters[0].glyphs.o.contours[0].points[1] = { ...flags.masters[0].glyphs.o.contours[0].points[1], on: true };
    expect(() => exportFont(flags, { variable: true })).toThrow(/point 1: on curve in one master and off curve in "Thin"/);
  });

  it('warns that hinting is skipped for variable fonts', () => {
    const warnings = [];
    const { tables } = readSfnt(exportFont(vf, { variable: true, hinting: 'auto', onWarning: (m) => warnings.push(m), timestamp: T }));
    expect(tables.has('fpgm')).toBe(false);
    expect(warnings[0]).toMatch(/not applied to variable fonts/);
    expect(['fvar', 'gvar', 'STAT', 'HVAR'].every((t) => tables.has(t))).toBe(true);
  });
});

describe('css', () => {
  it('builds @font-face rules', () => {
    const font = sampleFont();
    const css = cssFontFace(font, ['/f/sketch.woff2', { url: '/f/sketch.bin', format: 'truetype' }, '/f/x.otf?v=2']);
    expect(css).toContain('font-family: "Sketch Test";');
    expect(css).toContain('url("/f/sketch.woff2") format("woff2")');
    expect(css).toContain('url("/f/sketch.bin") format("truetype")');
    expect(css).toContain('url("/f/x.otf?v=2") format("opentype")');
    expect(css).toContain('font-weight: 400;');
    expect(css).toContain('font-display: swap;');
    expect(cssFontFace(sampleVariableFont(), 'a.woff2')).toContain('font-weight: 100 900;');
    const bold = sampleFont();
    bold.meta.style = 'Bold Italic';
    bold.meta.family = 'Say "Hi"';
    const c2 = cssFontFace(bold, 'b.ttf', { display: 'block', unicodeRange: unicodeRange(bold) });
    expect(c2).toContain('font-family: "Say \\"Hi\\"";');
    expect(c2).toContain('font-weight: 700;');
    expect(c2).toContain('font-style: italic;');
    expect(c2).toContain('unicode-range: U+0020, U+0041, U+0048-0049');
  });
});
