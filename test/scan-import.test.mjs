import { describe, expect, it } from 'vitest';
import { assignChars, binarize, importImage, importSvg, parsePathData, parseTransform, segmentRows } from '../src/scan/import.mjs';
import { shoelace } from '../src/scan/trace.mjs';
import { plainPhoto } from './scan-synth.mjs';

describe('importSvg', () => {
  it('places a filled rectangle on the baseline at cap height', () => {
    const g = importSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="50" height="100"/></svg>', { char: 'I' });
    expect(g.contours).toHaveLength(1);
    expect(g.bbox).toEqual({ xMin: 50, yMin: 0, xMax: 400, yMax: 700 });
    expect(shoelace(g.contours[0].points)).toBeLessThan(0);
    expect(g.name).toBe('I');
    expect(g.advanceWidth).toBe(450);
  });

  it('orients even odd holes and keeps nonzero directions', () => {
    const ring = '<svg viewBox="0 0 100 100"><path fill-rule="evenodd" d="M50 10a40 40 0 1 0 0.01 0zM50 30a20 20 0 1 0 0.01 0z"/></svg>';
    const g = importSvg(ring, { fit: 'capHeight' });
    expect(g.contours).toHaveLength(2);
    const areas = g.contours.map((c) => shoelace(c.points)).sort((a, b) => a - b);
    expect(areas[0]).toBeLessThan(0);
    expect(areas[1]).toBeGreaterThan(0);
    expect(g.bbox.yMax - g.bbox.yMin).toBeGreaterThan(690);
    // arcs become quadratic curves
    expect(g.contours[0].points.some((p) => !p.on)).toBe(true);
    const nz = importSvg('<svg><path d="M0 0H100V100H0Z M20 20V80H80V20Z"/></svg>');
    const nzAreas = nz.contours.map((c) => shoelace(c.points)).sort((a, b) => a - b);
    expect(nzAreas[0]).toBeLessThan(0);
    expect(nzAreas[1]).toBeGreaterThan(0);
  });

  it('maps the viewBox onto the em and applies transforms', () => {
    const svg = '<svg viewBox="0 0 1000 1000"><g transform="translate(100 0) scale(2)"><rect x="0" y="0" width="100" height="100"/></g></svg>';
    const g = importSvg(svg);
    // the top of the viewBox is the ascender (800); the rect spans 200 SVG units
    expect(g.bbox.yMax).toBe(800);
    expect(g.bbox.yMin).toBe(600);
    expect(importSvg(svg, { fit: { scale: 1, dx: 0, dy: 0 } }).bbox).toEqual({ xMin: 100, yMin: -200, xMax: 300, yMax: 0 });
  });

  it('skips stroke only shapes with a warning and handles empty input', () => {
    const g = importSvg('<svg><path d="M0 0L10 10" fill="none" stroke="black"/><circle cx="5" cy="5" r="5" style="fill: red"/></svg>');
    expect(g.warnings.map((w) => w.code)).toContain('stroke-ignored');
    expect(g.contours).toHaveLength(1);
    expect(importSvg('<svg></svg>').warnings[0].code).toBe('empty');
  });

  it('supports polygons, ellipses and rounded rectangles', () => {
    const g = importSvg('<svg><polygon points="0,0 10,0 5,10"/><ellipse cx="30" cy="5" rx="5" ry="3"/><rect x="50" width="10" height="10" rx="2"/></svg>');
    expect(g.contours).toHaveLength(3);
  });
});

describe('SVG path data', () => {
  it('parses every command, relative forms and implicit line tos', () => {
    const subs = parsePathData('m10 10 20 0 v10 h-5 c0 5 5 5 5 0 s5 -5 5 0 q5 5 10 0 t10 0 a5 5 0 0 1 10 0 L0 0 z M1 1 2 2');
    expect(subs).toHaveLength(2);
    const types = subs[0].segs.map((s) => s[0]);
    expect(types.slice(0, 7)).toEqual(['L', 'L', 'L', 'C', 'C', 'Q', 'Q']);
    expect(subs[0].segs[0]).toEqual(['L', 30, 10]);
    expect(subs[0].segs[2]).toEqual(['L', 25, 20]);
    // the smooth curve reflects the previous control point
    expect(subs[0].segs[4].slice(1, 3)).toEqual([30, 15]);
    expect(subs[0].closed).toBe(true);
    expect(subs[1].segs).toEqual([['L', 2, 2]]);
  });

  it('parses transform lists', () => {
    expect(parseTransform('translate(5,6)')).toEqual([1, 0, 0, 1, 5, 6]);
    const r = parseTransform('rotate(90)');
    expect(r[0]).toBeCloseTo(0, 9);
    expect(r[1]).toBeCloseTo(1, 9);
    expect(parseTransform('scale(2) translate(1 1)')).toEqual([2, 0, 0, 2, 2, 2]);
    expect(parseTransform('matrix(1 2 3 4 5 6)')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(parseTransform('')).toEqual([1, 0, 0, 1, 0, 0]);
  });
});

describe('importImage', () => {
  it('imports one drawn character onto its metric lines', () => {
    const photo = plainPhoto(['g'], { size: 400, pen: 70, width: 500, height: 800, ink: 'black' });
    const r = importImage(photo, { char: 'g' });
    expect(r.mode).toBe('single');
    const g = r.glyphs.g;
    expect(g.contours.length).toBe(2);
    // g spans the x-height down to the descender
    expect(g.bbox.yMax).toBeGreaterThan(450);
    expect(g.bbox.yMax).toBeLessThan(560);
    expect(g.bbox.yMin).toBeLessThan(-150);
  });

  it('segments a photographed alphabet into rows and characters', () => {
    const rows = ['abcdefg', 'hijklmn', 'ABCDEFG', '0123456'];
    const photo = plainPhoto(rows, { size: 90, pen: 70, width: 1100, height: 820, ink: 'blue', seed: 5 });
    const chars = rows.join('');
    const r = importImage(photo, { chars });
    expect(r.mode).toBe('alphabet');
    expect(r.rows).toHaveLength(4);
    expect(r.items).toHaveLength(chars.length);
    expect(r.warnings).toEqual([]);
    // reading order matches the drawing; i and j keep their dots
    r.items.forEach((it, k) => {
      expect(Math.abs(it.box.x - photo.boxes[k].x0)).toBeLessThan(12);
    });
    expect(r.glyphs.i.contours.length).toBe(2);
    expect(r.glyphs.j.contours.length).toBe(2);
    // baselines and scale come from the row: descenders below, caps tall
    expect(r.glyphs.g.bbox.yMin).toBeLessThan(-100);
    expect(Math.abs(r.glyphs.a.bbox.yMin)).toBeLessThan(40);
    expect(r.glyphs.A.bbox.yMax).toBeGreaterThan(620);
    expect(r.glyphs.A.bbox.yMax).toBeLessThan(780);
    // assign later, without knowing the characters up front
    const unknown = importImage(photo);
    expect(unknown.items).toHaveLength(chars.length);
    const glyphs = assignChars(unknown, [...chars].map((c) => (c === 'b' ? null : c)));
    expect(glyphs.b).toBeUndefined();
    expect(glyphs.c.name).toBe('c');
  });

  it('warns on a count mismatch and reports empty images', () => {
    const photo = plainPhoto(['abc'], { size: 90, pen: 60, width: 500, height: 300 });
    expect(importImage(photo, { chars: 'ab' }).warnings[0].code).toBe('count-mismatch');
    const blank = { width: 200, height: 100, data: new Uint8ClampedArray(200 * 100 * 4).fill(240) };
    expect(importImage(blank).warnings[0].code).toBe('empty');
  });

  it('binarizes and segments with the lower level helpers', () => {
    const photo = plainPhoto(['ab', 'cd'], { size: 80, pen: 60, width: 400, height: 400 });
    const bin = binarize(photo);
    expect(bin.width).toBe(400);
    const rows = segmentRows(bin.mask, bin.width, bin.height, bin.strokeWidth);
    expect(rows.map((r) => r.items.length)).toEqual([2, 2]);
  });
});
