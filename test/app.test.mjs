// Tests for the editor app's pure modules (docs/app/js): contour geometry,
// strokes, the raster boolean tracer, SVG path parsing, the ZIP writer,
// spacing, stem detection, kerning lookup and the undo history.
import { describe, expect, it } from 'vitest';
import * as core from '../src/core/index.mjs';
import {
  bbox, compatible, contourAt, ellipseContour, embolden, flatten, insertPoint, interpolate, isClockwise,
  matrix, polyArea, polygonToContour, rectContour, reverse, segments, stabilize, strokeOutline, transformContours,
} from '../docs/app/js/geom.mjs';
import { loopsToContours, marchingSquares } from '../docs/app/js/booleans.mjs';
import { parsePath } from '../docs/app/js/svg.mjs';
import { crc32, zip } from '../docs/app/js/zip.mjs';
import { charsFor } from '../docs/app/js/charsets.mjs';
import { autoBearings } from '../docs/app/js/panels/spacing.mjs';
import { detectStems } from '../docs/app/js/panels/fontpanel.mjs';
import { P, history, kernValue, loadFont, setCore } from '../docs/app/js/project.mjs';

setCore(core);
const on = (x, y) => ({ x, y, on: true });
const off = (x, y) => ({ x, y, on: false });

describe('segments', () => {
  it('splits lines and quadratics and resolves implied on curve points', () => {
    const c = { closed: true, points: [on(0, 0), off(0, 100), off(100, 100), on(100, 0)] };
    const segs = segments(c);
    expect(segs).toHaveLength(3);
    expect(segs[0].c).toMatchObject({ x: 0, y: 100 });
    expect(segs[0].p1).toMatchObject({ x: 50, y: 100, implied: true });
    expect(segs[2].c).toBeUndefined();
  });
  it('handles contours made only of off curve points', () => {
    const c = { closed: true, points: [off(0, 0), off(0, 10), off(10, 10), off(10, 0)] };
    const segs = segments(c);
    expect(segs).toHaveLength(4);
    expect(segs[3].p1).toMatchObject({ x: 5, y: 0 });
  });
  it('leaves open contours open', () => {
    expect(segments({ closed: false, points: [on(0, 0), on(10, 0), on(10, 10)] })).toHaveLength(2);
  });
});

describe('shapes, direction and transforms', () => {
  it('builds clockwise rectangles and ellipses', () => {
    expect(isClockwise(rectContour(0, 0, 100, 50))).toBe(true);
    const e = ellipseContour(0, 0, 100, 100);
    expect(isClockwise(e)).toBe(true);
    const b = bbox(flatten(e).map((p) => ({ points: [p] })));
    expect(b.xMax).toBeCloseTo(100, 0);
    expect(Math.abs(polyArea(flatten(e, 16))) / (Math.PI * 100 * 100)).toBeCloseTo(1, 1);
  });
  it('mirroring keeps the direction by reversing', () => {
    const r = rectContour(0, 0, 100, 50);
    const [m] = transformContours([r], matrix.scale(-1, 1));
    expect(isClockwise(m)).toBe(true);
    expect(isClockwise(reverse(r))).toBe(false);
  });
  it('rotates about a point', () => {
    const m = matrix.rotate(90, 10, 10);
    const [c] = transformContours([{ closed: true, points: [on(20, 10)] }], m);
    expect(c.points[0].x).toBeCloseTo(10);
    expect(c.points[0].y).toBeCloseTo(20);
  });
  it('finds the contour under a point', () => {
    expect(contourAt(50, 25, [rectContour(0, 0, 100, 50)])).toBe(0);
    expect(contourAt(150, 25, [rectContour(0, 0, 100, 50)])).toBe(-1);
  });
});

describe('insertPoint', () => {
  it('splits a quadratic exactly', () => {
    const c = { closed: true, points: [on(0, 0), off(50, 100), on(100, 0)] };
    const seg = segments(c)[0];
    const before = flatten(c, 32);
    const i = insertPoint(c, seg, 0.5);
    expect(c.points[i]).toMatchObject({ x: 50, y: 50, on: true });
    const after = flatten(c, 32);
    expect(Math.abs(polyArea(after) - polyArea(before))).toBeLessThan(40);
  });
  it('adds a corner on a line', () => {
    const c = rectContour(0, 0, 100, 100);
    const seg = segments(c)[0];
    insertPoint(c, seg, 0.5);
    expect(c.points).toHaveLength(5);
  });
});

describe('masters', () => {
  it('emboldens without changing the point structure', () => {
    const o = ellipseContour(300, 300, 200, 250);
    const hole = reverse(ellipseContour(300, 300, 120, 170));
    const bold = embolden([o, hole], 30);
    expect(compatible([o, hole], bold)).toBe(true);
    expect(Math.abs(polyArea(flatten(bold[0])))).toBeGreaterThan(Math.abs(polyArea(flatten(o))));
    expect(Math.abs(polyArea(flatten(bold[1])))).toBeLessThan(Math.abs(polyArea(flatten(hole))));
    const mid = interpolate([o], [bold[0]], 0.5);
    expect(mid[0].points[0].y).toBeCloseTo((o.points[0].y + bold[0].points[0].y) / 2);
  });
});

describe('strokes', () => {
  const line = Array.from({ length: 30 }, (_, i) => ({ x: i * 10, y: 0, p: 0.7 }));
  it('outlines a round stroke clockwise with the given width', () => {
    const poly = strokeOutline(line, { size: 40, shape: 'round', pressure: false });
    expect(polyArea(poly)).toBeLessThan(0);
    const ys = poly.map((p) => p.y);
    expect(Math.max(...ys)).toBeCloseTo(20, 0);
  });
  it('makes a broad nib thin along its angle', () => {
    const flat = strokeOutline(line, { size: 60, shape: 'calligraphy', angle: 0, pressure: false });
    const steep = strokeOutline(line, { size: 60, shape: 'calligraphy', angle: 90, pressure: false });
    expect(Math.abs(polyArea(flat))).toBeLessThan(Math.abs(polyArea(steep)) / 3);
  });
  it('stabilizes jitter and still ends at the pen up point', () => {
    const noisy = line.map((p, i) => ({ ...p, y: i % 2 ? 8 : -8 }));
    const s = stabilize(noisy, 0.8);
    const spread = Math.max(...s.slice(5, -8).map((p) => Math.abs(p.y)));
    expect(spread).toBeLessThan(8);
    expect(s[s.length - 1]).toMatchObject({ x: noisy[noisy.length - 1].x });
  });
  it('fits a polygon to a smooth quadratic contour', () => {
    const pts = Array.from({ length: 64 }, (_, i) => ({ x: 200 * Math.cos((i / 64) * Math.PI * 2), y: 200 * Math.sin((i / 64) * Math.PI * 2) }));
    const c = polygonToContour(pts, core, 1);
    expect(c.points.length).toBeLessThan(40);
    expect(c.points.some((p) => !p.on)).toBe(true);
  });
});

describe('raster tracing', () => {
  it('traces a filled square and its hole with orientation', () => {
    const w = 40;
    const grid = new Float32Array(w * w);
    for (let y = 5; y < 35; y++) for (let x = 5; x < 35; x++) grid[y * w + x] = x > 14 && x < 25 && y > 14 && y < 25 ? 0 : 1;
    const loops = marchingSquares(grid, w, w);
    expect(loops).toHaveLength(2);
    const contours = loopsToContours(loops.map((l) => l.map((p) => ({ x: p.x * 10, y: -p.y * 10 }))), core);
    expect(contours).toHaveLength(2);
    const outer = contours.find((c) => Math.abs(polyArea(flatten(c))) > 50000);
    const inner = contours.find((c) => c !== outer);
    expect(isClockwise(outer)).toBe(true);
    expect(isClockwise(inner)).toBe(false);
  });
});

describe('SVG paths', () => {
  it('parses relative commands, smooth curves and closes', () => {
    const [sp] = parsePath('m10 10 h 20 v 20 h-20 z');
    expect(sp.closed).toBe(true);
    expect(sp.segs).toHaveLength(4);
    expect(sp.segs[1][3]).toMatchObject({ x: 30, y: 30 });
  });
  it('turns arcs into cubics on the circle', () => {
    const [sp] = parsePath('M0 0 A50 50 0 0 1 100 0');
    const end = sp.segs[sp.segs.length - 1][3];
    expect(end.x).toBeCloseTo(100);
    for (const c of sp.segs) expect(Math.hypot(c[3].x - 50, c[3].y)).toBeCloseTo(50, 3);
  });
  it('reads packed arc flags and quadratic shorthand', () => {
    expect(parsePath('M0 0a5 5 0 105 5')[0].segs.length).toBeGreaterThan(0);
    const [q] = parsePath('M0 0 Q 10 10 20 0 T 40 0');
    expect(q.segs).toHaveLength(2);
  });
});

describe('zip', () => {
  it('computes CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('writes a stored archive with a central directory', () => {
    const z = zip([{ name: 'a.txt', data: 'hi' }, { name: 'fonts/b.bin', data: new Uint8Array([1, 2, 3]) }]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(z.length - 22 + 10, true)).toBe(2);
  });
});

describe('charsets', () => {
  it('deduplicates and appends custom characters', () => {
    const chars = charsFor('letters', 'aZñ');
    expect(chars).toHaveLength(53);
    expect(chars[chars.length - 1]).toBe('ñ');
  });
});

describe('spacing and stems', () => {
  const meta = { unitsPerEm: 1000, xHeight: 500, capHeight: 700, ascender: 800, descender: -200 };
  it('gives straight sides more room than round ones', () => {
    const stem = autoBearings([rectContour(0, 0, 80, 700)], meta, 60);
    const round = autoBearings([ellipseContour(300, 350, 300, 350)], meta, 60);
    expect(stem.lsb).toBeGreaterThan(round.lsb);
    expect(stem.lsb).toBe(stem.rsb);
  });
  it('finds the stems of an H', () => {
    const h = [rectContour(0, 0, 80, 700), rectContour(400, 0, 480, 700), rectContour(80, 320, 400, 390)];
    const st = detectStems(h, meta);
    expect(st.v).toEqual([[0, 80], [400, 80]]);
  });
});

describe('project', () => {
  it('looks up kerning through classes', () => {
    const font = core.createFont();
    font.kerning = { pairs: { 'A|V': -80, '@round|T': -40 }, classes: { '@round': ['O', 'C'] } };
    expect(kernValue(font, 'A', 'V')).toBe(-80);
    expect(kernValue(font, 'C', 'T')).toBe(-40);
    expect(kernValue(font, 'T', 'C')).toBe(0);
  });
  it('undoes and redoes glyph changes', () => {
    const font = core.createFont();
    core.addGlyph(font, { name: 'a', advanceWidth: 500, contours: [] });
    loadFont(font);
    history.run('Draw', ['a'], () => P.font.glyphs.a.contours.push(rectContour(0, 0, 10, 10)));
    expect(P.font.glyphs.a.contours).toHaveLength(1);
    history.undo();
    expect(P.font.glyphs.a.contours).toHaveLength(0);
    history.redo();
    expect(P.font.glyphs.a.contours).toHaveLength(1);
    history.run('Meta', 'meta', () => (P.font.meta.family = 'X'));
    history.undo();
    expect(P.font.meta.family).not.toBe('X');
  });
});
