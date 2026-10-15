// Tests for quick mode and the pixel style (docs/app/js/quick.mjs and
// pixel.mjs): cell tracing, the Atelier Pixel bitmaps, and finishing a font
// from hand drawn lowercase letters into one that exports and parses back.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as core from '../src/core/index.mjs';
import { flatten, inkBounds, isClockwise, matrix, polyArea, resolve, status, transformContours } from '../docs/app/js/geom.mjs';
import {
  BITMAPS, bitmapCells, cellKey, cellsFromContours, cellsToContours, isPixelAligned, pixelFont, pixelate, stampCells, stretchCells,
} from '../docs/app/js/pixel.mjs';
import { FILL_CHARS, QUICK_ACCENTS, STYLES, finishQuick, guideFor, quickQueue } from '../docs/app/js/quick.mjs';
import { LOWER, UPPER } from '../docs/app/js/charsets.mjs';

const cells = (...pairs) => new Set(pairs.map(([i, j]) => cellKey(i, j)));
const area = (contours) => contours.reduce((a, c) => a - polyArea(flatten(c)), 0);
const quill = () => core.deserialize(readFileSync(new URL('../docs/assets/fonts/quill-hand.fontsketch.json', import.meta.url), 'utf8'));

describe('pixel cells', () => {
  it('traces one cell as a clockwise square with four corners', () => {
    const [c, ...rest] = cellsToContours(cells([2, 3]), 100);
    expect(rest).toHaveLength(0);
    expect(c.points).toHaveLength(4);
    expect(isClockwise(c)).toBe(true);
    expect(inkBounds([c])).toEqual({ xMin: 200, yMin: 300, xMax: 300, yMax: 400 });
  });
  it('merges a row of cells and keeps a hole in a ring', () => {
    expect(cellsToContours(cells([0, 0], [1, 0], [2, 0]), 10)[0].points).toHaveLength(4);
    const ring = new Set();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== 1 || j !== 1) ring.add(cellKey(i, j));
    const out = cellsToContours(ring, 10);
    expect(out).toHaveLength(2);
    expect(out.filter(isClockwise)).toHaveLength(1);
    expect(area(out)).toBeCloseTo(800);
  });
  it('keeps cells that only touch at a corner apart', () => {
    const out = cellsToContours(cells([0, 0], [1, 1]), 10);
    expect(out).toHaveLength(2);
    expect(out.every(isClockwise)).toBe(true);
  });
  it('samples outlines back into the same cells', () => {
    const set = bitmapCells(BITMAPS.g).cells;
    const back = cellsFromContours(cellsToContours(set, 100), 100);
    expect([...back].sort()).toEqual([...set].sort());
  });
  it('stamps the cells a stroke passes through', () => {
    const line = stampCells([{ x: 10, y: 50 }, { x: 390, y: 50 }], 100);
    expect([...line].sort()).toEqual(['0,0', '1,0', '2,0', '3,0']);
    expect(stampCells([{ x: 150, y: 150 }], 100, 300).size).toBe(9);
  });
  it('makes letters taller by repeating their stem rows', () => {
    const o = bitmapCells(BITMAPS.o).cells;
    const tall = stretchCells(o, 2);
    expect(tall.size).toBe(o.size + 4);
    expect(Math.max(...[...tall].map((k) => +k.split(',')[1]))).toBe(6);
    expect([...tall].sort()).toEqual([...bitmapCells(BITMAPS.O).cells].sort());
    const g = stretchCells(bitmapCells(BITMAPS.g).cells, 2);
    expect(Math.min(...[...g].map((k) => +k.split(',')[1]))).toBe(-2);
  });
  it('snaps any outline to the grid', () => {
    const blob = [{ closed: true, points: [{ x: 10, y: 10, on: true }, { x: 30, y: 390, on: true }, { x: 395, y: 380, on: true }, { x: 380, y: 5, on: true }] }];
    const px = pixelate(blob, 100);
    expect(isPixelAligned(px, 100)).toBe(true);
    expect(isPixelAligned(blob, 100)).toBe(false);
    expect(area(px)).toBe(160000);
  });
});

describe('Atelier Pixel', () => {
  it('has rectangular bitmaps made of # and .', () => {
    for (const [ch, bm] of Object.entries(BITMAPS)) {
      const rows = Array.isArray(bm) ? bm : bm.r;
      expect(new Set(rows.map((r) => r.length)).size, ch).toBe(1);
      expect(rows.join('').replace(/[#.]/g, ''), ch).toBe('');
      expect(rows.join('').includes('#'), ch).toBe(true);
    }
  });
  it('covers the letters, digits, punctuation and marks quick mode needs', () => {
    for (const ch of [...LOWER, ...UPPER, ...FILL_CHARS]) expect(BITMAPS[ch], ch).toBeDefined();
  });
  it('builds a valid font whose accents stay on the grid', () => {
    const font = pixelFont(core);
    expect(core.validateFont(font)).toEqual([]);
    expect(font.glyphs.atilde.components.every((c) => c.dx % 100 === 0 && c.dy % 100 === 0)).toBe(true);
    for (const ch of QUICK_ACCENTS.filter((c) => !'\u00c5\u00e5'.includes(c))) expect(status(font.glyphs[core.glyphNameFor(ch)]), ch).toBe('composed');
    const i = font.glyphs.i;
    expect(i.contours).toHaveLength(2);
    const back = core.parseFont(core.exportFont(font, { format: 'ttf' }));
    expect(Object.keys(back.glyphs).length).toBe(Object.keys(font.glyphs).length);
  });
});

describe('quick mode', () => {
  it('asks for the lowercase letters, capitals on request', () => {
    expect(quickQueue()).toHaveLength(26);
    expect(quickQueue({ capitals: true }).slice(26).join('')).toBe(UPPER);
    expect(STYLES.map((s) => s.id)).toEqual(['script', 'block', 'pixel']);
  });

  it('finishes a font from 26 hand drawn lowercase letters', () => {
    const src = quill();
    const font = core.createFont({ family: 'Quick Test' });
    // Pretend the letters were drawn anywhere in the box, as people do.
    for (const ch of LOWER) {
      const g = src.glyphs[ch];
      const contours = transformContours(resolve(src, g), matrix.translate(180, 0));
      core.addGlyph(font, { name: ch, unicodes: [ch.codePointAt(0)], advanceWidth: 600, contours });
    }
    const report = finishQuick(font, core, { source: src, spacing: 55 });
    expect(report.drawn).toHaveLength(26);
    expect(report.capitals).toHaveLength(26);
    expect(report.filled).toEqual(expect.arrayContaining([...'0123456789.,!?']));
    expect(report.composed).toEqual(expect.arrayContaining([...'\u00e1\u00e3\u00e7\u00e9\u00ed\u00f5\u00c1\u00c3\u00c7']));
    expect(report.missing).toEqual([]);
    // Capitals reach the cap height and every letter is spaced from its shape.
    expect(inkBounds(font.glyphs.O.contours).yMax).toBeGreaterThan(font.meta.capHeight * 0.9);
    for (const ch of [...LOWER, ...UPPER]) {
      const g = font.glyphs[ch];
      const ib = inkBounds(resolve(font, g));
      expect(ib.xMin, ch).toBeGreaterThanOrEqual(0);
      expect(ib.xMin, ch).toBeLessThan(80);
      expect(g.advanceWidth - ib.xMax, ch).toBeGreaterThanOrEqual(0);
    }
    expect(core.validateFont(font)).toEqual([]);
    const back = core.parseFont(core.exportFont(font, { format: 'otf' }));
    const cmap = new Set(Object.values(back.glyphs).flatMap((g) => g.unicodes));
    for (const ch of 'Hello, World! 123 \u00e1\u00e7\u00e3o') expect(cmap.has(ch.codePointAt(0)), ch).toBe(true);
  });

  it('keeps your own capitals and digits', () => {
    const src = quill();
    const font = core.createFont();
    const box = [{ closed: true, points: [{ x: 0, y: 0, on: true }, { x: 0, y: 700, on: true }, { x: 100, y: 700, on: true }, { x: 100, y: 0, on: true }] }];
    core.addGlyph(font, { name: 'l', unicodes: [0x6c], advanceWidth: 300, contours: box });
    core.addGlyph(font, { name: 'L', unicodes: [0x4c], advanceWidth: 300, contours: box });
    core.addGlyph(font, { name: 'one', unicodes: [0x31], advanceWidth: 300, contours: box });
    const report = finishQuick(font, core, { source: src });
    expect(report.capitals).toEqual(['I']);
    expect(report.filled).not.toContain('1');
    expect(font.glyphs.one.contours).toHaveLength(1);
  });

  it('keeps a pixel font on its grid', () => {
    const src = pixelFont(core);
    const font = core.createFont({ family: 'Pixel Test' });
    for (const ch of LOWER) {
      const { cells: set } = bitmapCells(BITMAPS[ch]);
      const contours = transformContours(cellsToContours(set, 100), matrix.translate(300, 0));
      core.addGlyph(font, { name: ch, unicodes: [ch.codePointAt(0)], advanceWidth: 800, contours });
    }
    const report = finishQuick(font, core, { source: src, pixel: 100 });
    expect(report.capitals).toHaveLength(26);
    for (const ch of [...LOWER, ...UPPER, ...'0123456789?']) expect(isPixelAligned(font.glyphs[core.glyphNameFor(ch)].contours, 100), ch).toBe(true);
    expect(inkBounds(font.glyphs.O.contours).yMax).toBe(700);
    expect([...cellsFromContours(font.glyphs.O.contours, 100)].sort()).toEqual([...bitmapCells(BITMAPS.O).cells].sort());
    expect(font.glyphs.a.advanceWidth % 100).toBe(0);
    expect(inkBounds(font.glyphs.a.contours).xMin).toBe(0);
    expect(font.glyphs.eacute.components.every((c) => c.dx % 100 === 0 && c.dy % 100 === 0)).toBe(true);
    expect(font.glyphs.space.advanceWidth).toBe(300);
  });

  it('gives a faint guide letter scaled to the font', () => {
    const src = quill();
    const font = core.createFont({ capHeight: 350 });
    const guide = guideFor(font, src, 'H');
    expect(inkBounds(guide.contours).yMax).toBeCloseTo(inkBounds(src.glyphs.H.contours).yMax / 2, 0);
    expect(guideFor(font, src, '\u4e00')).toBeNull();
    expect(guideFor(font, null, 'a')).toBeNull();
  });
});
