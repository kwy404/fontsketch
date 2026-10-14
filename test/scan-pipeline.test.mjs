import { describe, expect, it } from 'vitest';
import { createTemplate } from '../src/scan/template.mjs';
import { findMarkers } from '../src/scan/markers.mjs';
import { applyH } from '../src/scan/homography.mjs';
import {
  ScanError, rescanCell, scanSheet, scanSheets, segmentCells,
} from '../src/scan/scan.mjs';
import { handle } from '../src/scan/worker.mjs';
import * as scan from '../src/scan/index.mjs';
import { glyphIoU, photograph, renderSheet } from './scan-synth.mjs';

const CHARS = 'opgAB.';
const tpl = createTemplate({ chars: CHARS, cols: 6 });
const sheet = renderSheet(tpl.template, 0, { ink: 'blue', pen: 0.8, seed: 21, skip: new Set(['.']) });
const photo = photograph(sheet, {
  seed: 4, width: 2000, height: 1500, rotate: 9, perspective: 0.05, gradient: 0.35, shadow: 0.35, blur: 0.8, chroma: true, noise: 3,
});
const result = scanSheet(photo, { template: tpl });

describe('marker detection', () => {
  it('finds all four markers with sub pixel corners', () => {
    const markers = findMarkers(photo);
    expect(markers.map((m) => m.id)).toEqual([0, 1, 2, 3]);
    const { R } = sheet;
    const S = tpl.template.marker.size;
    for (const m of markers) {
      const box = tpl.template.marker.boxes[m.id];
      const truth = [[box.x, box.y], [box.x + S, box.y], [box.x + S, box.y + S], [box.x, box.y + S]]
        .map(([x, y]) => applyH(photo.H, x * R, y * R));
      m.corners.forEach(([x, y], k) => {
        expect(Math.hypot(x - truth[k][0], y - truth[k][1])).toBeLessThan(0.6);
      });
      expect(m.refined).toBe(true);
      expect(m.errors).toBe(0);
      expect(m.blur).toBeGreaterThan(0.3);
    }
  });

  it('works upside down and sideways', () => {
    for (const rotate of [180, 90]) {
      const p = photograph(sheet, { seed: 8, width: 1500, height: 1500, rotate, blur: 0.6, noise: 2 });
      const r = scanSheet(p, { template: tpl });
      expect(r.markers).toHaveLength(4);
      expect(r.page).toBe(0);
      expect(r.glyphs.o.contours.length).toBe(2);
    }
  }, 60000);

  it('reads mirrored photos the right way round', () => {
    const p = photograph(sheet, { seed: 6, width: 1600, height: 1300, rotate: -8, blur: 0.6, noise: 2 });
    const { width: w, height: h, data } = p;
    const flipped = new Uint8ClampedArray(data.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) flipped.set(data.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), (y * w + (w - 1 - x)) * 4);
    }
    const r = scanSheet({ width: w, height: h, data: flipped }, { template: tpl });
    expect(r.markers.every((m) => m.mirrored)).toBe(true);
    expect(r.warnings.map((x) => x.code)).toContain('mirrored');
    const g = r.glyphs.A;
    expect(glyphIoU(g.contours, sheet.truth.A.strokes, sheet.truth.A.pen, g.shiftX)).toBeGreaterThan(0.8);
  });

  it('keeps going with one marker hidden', () => {
    const p = photograph(sheet, { seed: 4, width: 2000, height: 1500, rotate: 4, blur: 0.6, noise: 2 });
    const { R } = sheet;
    const box = tpl.template.marker.boxes[2];
    const [cx, cy] = applyH(p.H, (box.x + 6) * R, (box.y + 6) * R);
    // a thumb over the bottom right marker
    for (let y = Math.round(cy - 60); y < cy + 60; y++) {
      for (let x = Math.round(cx - 60); x < cx + 60; x++) {
        if (x < 0 || y < 0 || x >= p.width || y >= p.height || Math.hypot(x - cx, y - cy) > 60) continue;
        p.data.set([196, 150, 128], (y * p.width + x) * 4);
      }
    }
    const r = scanSheet(p, { template: tpl });
    expect(r.markers.map((m) => m.id)).toEqual([0, 1, 3]);
    expect(r.warnings.map((w) => w.code)).toContain('few-markers');
    const g = r.glyphs.A;
    expect(glyphIoU(g.contours, sheet.truth.A.strokes, sheet.truth.A.pen, g.shiftX)).toBeGreaterThan(0.8);
  });

  it('refuses photos without a sheet', () => {
    const blank = { width: 400, height: 300, data: new Uint8ClampedArray(400 * 300 * 4).fill(230) };
    expect(findMarkers(blank)).toEqual([]);
    expect(() => scanSheet(blank, { template: tpl })).toThrow(ScanError);
    try {
      scanSheet(blank, { template: tpl });
    } catch (e) {
      expect(e.code).toBe('markers-not-found');
    }
  });
});

describe('scanSheet', () => {
  it('recovers every glyph on the template baseline', () => {
    expect(result.page).toBe(0);
    expect(result.sheetId).toBe(tpl.template.id);
    expect(result.reprojectionError).toBeLessThan(0.5);
    for (const ch of 'opgAB') {
      const g = result.glyphs[ch];
      const truth = sheet.truth[ch];
      expect(glyphIoU(g.contours, truth.strokes, truth.pen, g.shiftX)).toBeGreaterThan(0.8);
      expect(g.confidence).toBeGreaterThan(0.7);
      expect(g.name).toBe(ch);
      expect(g.unicodes).toEqual([ch.codePointAt(0)]);
      expect(g.bbox.xMin).toBe(g.leftSideBearing);
      expect(g.advanceWidth).toBe(g.bbox.xMax - g.bbox.xMin + 2 * g.leftSideBearing);
    }
    // holes: o has one, B has two, g has one in the bowl
    expect(result.glyphs.o.contours).toHaveLength(2);
    expect(result.glyphs.B.contours).toHaveLength(3);
    // baseline from the template: o sits on it, p and g go below
    expect(Math.abs(result.glyphs.o.bbox.yMin)).toBeLessThan(40);
    expect(result.glyphs.p.bbox.yMin).toBeLessThan(-150);
    expect(result.glyphs.g.bbox.yMin).toBeLessThan(-150);
    expect(result.glyphs.A.bbox.yMax).toBeGreaterThan(600);
  });

  it('reports empty cells', () => {
    const g = result.glyphs['.'];
    expect(g.empty).toBe(true);
    expect(g.confidence).toBe(0);
    expect(g.contours).toEqual([]);
    expect(result.warnings.find((w) => w.char === '.').code).toBe('empty-cell');
  });

  it('re-runs a single cell with another threshold', () => {
    const before = result.glyphs.o.stats.inkArea;
    const bolder = result.rescan('o', { threshold: 0.2 });
    expect(bolder.stats.inkArea).toBeGreaterThan(before * 1.1);
    const thinner = rescanCell(result, 'o', { threshold: 0.85 });
    expect(thinner.stats.inkArea).toBeLessThan(before);
    expect(result.glyphs.o).toBe(thinner);
    expect(() => result.rescan('Z')).toThrow(RangeError);
  });

  it('accepts RGB buffers and a subset of cells', () => {
    const rgb = new Uint8Array(photo.width * photo.height * 3);
    for (let i = 0; i < photo.width * photo.height; i++) {
      rgb[i * 3] = photo.data[i * 4];
      rgb[i * 3 + 1] = photo.data[i * 4 + 1];
      rgb[i * 3 + 2] = photo.data[i * 4 + 2];
    }
    const r = scanSheet({ width: photo.width, height: photo.height, data: rgb }, { template: tpl.template, chars: ['A'] });
    expect(Object.keys(r.glyphs)).toEqual(['A']);
  });

  it('warns when ink crosses the cell border', () => {
    const tall = [[[200, -480], [200, 900]]];
    const s = renderSheet(tpl.template, 0, { ink: 'black', pen: 0.8, seed: 2, override: { A: tall } });
    const p = photograph(s, { seed: 3, width: 1800, height: 1400, rotate: -5, noise: 2, blur: 0.5 });
    const r = scanSheet(p, { template: tpl, chars: ['A'] });
    expect(r.glyphs.A.warnings.map((w) => w.code)).toContain('touches-border');
    expect(r.glyphs.A.confidence).toBeLessThan(0.7);
  });

  it('refuses a sheet printed from another template', () => {
    const other = createTemplate({ chars: 'xyz' });
    expect(() => scanSheet(photo, { template: other })).toThrow(/template/);
    const forced = scanSheet(photo, { template: other, ignoreSheetId: true, chars: [] });
    expect(forced.sheetId).toBe(tpl.template.id);
  });

  it('exposes rectified cell masks', () => {
    const cells = segmentCells(photo, { template: tpl });
    expect(cells).toHaveLength(CHARS.length);
    const o = cells.find((c) => c.cell.char === 'o');
    expect(o.mask.length).toBe(o.width * o.height);
    expect(o.mask.reduce((a, b) => a + b, 0)).toBeGreaterThan(100);
    expect(o.pixelsPerMm).toBeGreaterThan(4);
  });
});

describe('multi page sets', () => {
  const big = createTemplate({ chars: 'abcdefghijklmnopqrstuvwxyz', cols: 5, rows: 3 });

  it('reads the page number from the code and merges pages', () => {
    expect(big.pages).toBe(2);
    const shots = [1, 0].map((page) => photograph(renderSheet(big.template, page, { seed: page + 1, pen: 0.9 }), {
      seed: page + 9, width: 1600, height: 1600, rotate: page ? -7 : 6, noise: 2, blur: 0.6,
    }));
    const first = scanSheet(shots[0], { template: big });
    expect(first.page).toBe(1);
    expect(first.pageCount).toBe(2);
    expect(Object.keys(first.glyphs)).toEqual(big.template.pages[1].cells.map((c) => c.char));
    const merged = scanSheets(shots, { template: big });
    expect(Object.keys(merged.glyphs).sort().join('')).toBe('abcdefghijklmnopqrstuvwxyz');
    expect(merged.missingPages).toEqual([]);
    const partial = scanSheets([shots[0]], { template: big });
    expect(partial.missingPages).toEqual([0]);
    expect(partial.warnings.map((w) => w.code)).toContain('missing-page');
  }, 120000);
});

describe('worker entry and public exports', () => {
  it('scans and rescans through the message handler', () => {
    const r = handle({ type: 'scan', image: photo, template: tpl.template, options: { chars: ['o'] } });
    expect(Object.keys(r.glyphs)).toEqual(['o']);
    expect(r.markers[0]).not.toHaveProperty('blur');
    const g = handle({ type: 'rescan', char: 'o', options: { threshold: 0.4 } });
    expect(g.contours.length).toBe(2);
    expect(() => handle({ type: 'nope' })).toThrow(/unknown/);
  });

  it('exports the documented API', () => {
    for (const name of ['createTemplate', 'scanSheet', 'findMarkers', 'warpPerspective', 'normalizeLighting', 'binarize',
      'segmentCells', 'traceBitmap', 'importImage', 'importSvg', 'scanSheets', 'rescanCell', 'templateLayout', 'CHARSETS']) {
      expect(scan[name], name).toBeDefined();
    }
  });
});
