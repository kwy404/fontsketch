import { describe, expect, it } from 'vitest';
import { cubicToQuads, decompose, pathsToContours, shoelace, traceBitmap, traceMask } from '../src/scan/trace.mjs';
import { fillContours } from './scan-synth.mjs';

/** Mask from a predicate over pixel centres. */
function mask(w, h, inside) {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + 0.5, y + 0.5)) m[y * w + x] = 1;
  return m;
}

/** Area enclosed by contours, measured by filling them on a fine grid. */
function filledArea(contours, w, h, scale = 4) {
  const filled = fillContours(contours, w * scale, h * scale, (x, y) => [x * scale, (h - y) * scale]);
  let n = 0;
  for (const v of filled) n += v;
  return n / (scale * scale);
}

const pixels = (m) => m.reduce((a, b) => a + b, 0);

describe('path decomposition', () => {
  it('finds outer boundaries and holes with opposite signs', () => {
    const m = mask(20, 20, (x, y) => x > 3 && x < 16 && y > 3 && y < 16 && !(x > 7 && x < 12 && y > 7 && y < 12));
    const paths = decompose(m, 20, 20);
    expect(paths).toHaveLength(2);
    expect(paths.map((p) => p.sign).sort()).toEqual([-1, 1]);
    expect(paths.find((p) => p.sign === 1).area).toBe(169);
    expect(paths.find((p) => p.sign === -1).area).toBe(25);
  });

  it('joins diagonal pixels into one shape', () => {
    const m = Uint8Array.from([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]);
    const paths = decompose(m, 3, 3);
    expect(paths).toHaveLength(1);
    expect(paths[0].area).toBe(3);
  });
});

describe('potrace style tracing', () => {
  it('traces a square into four sharp corners', () => {
    const m = mask(30, 30, (x, y) => x > 5 && x < 25 && y > 8 && y < 22);
    const contours = traceBitmap(m, 30, 30);
    expect(contours).toHaveLength(1);
    const pts = contours[0].points;
    expect(pts.every((p) => p.on)).toBe(true);
    expect(pts.filter((p) => p.type === 'corner').length).toBeGreaterThanOrEqual(4);
    // outer contours run clockwise in the y up font space
    expect(shoelace(pts)).toBeLessThan(0);
    expect(filledArea(contours, 30, 30)).toBeCloseTo(pixels(m), -1);
  });

  it('traces a disc into a smooth curve with the right area', () => {
    const R = 20;
    const m = mask(60, 60, (x, y) => Math.hypot(x - 30, y - 30) <= R);
    const contours = traceBitmap(m, 60, 60);
    expect(contours).toHaveLength(1);
    const pts = contours[0].points;
    expect(pts.some((p) => !p.on)).toBe(true);
    expect(pts.filter((p) => p.type === 'corner')).toHaveLength(0);
    expect(Math.abs(filledArea(contours, 60, 60) - Math.PI * R * R) / (Math.PI * R * R)).toBeLessThan(0.02);
    // every point stays close to the true circle
    for (const p of pts.filter((q) => q.on)) expect(Math.abs(Math.hypot(p.x - 30, p.y - 30) - R)).toBeLessThan(1);
  });

  it('keeps holes as counter clockwise contours (o, B)', () => {
    const ring = mask(50, 50, (x, y) => {
      const r = Math.hypot(x - 25, y - 25);
      return r <= 20 && r >= 12;
    });
    const o = traceBitmap(ring, 50, 50);
    expect(o).toHaveLength(2);
    const areas = o.map((c) => shoelace(c.points)).sort((a, b) => a - b);
    expect(areas[0]).toBeLessThan(0);
    expect(areas[1]).toBeGreaterThan(0);
    expect(Math.abs(filledArea(o, 50, 50) - Math.PI * (400 - 144)) / (Math.PI * 256)).toBeLessThan(0.04);
    // a B like shape: two stacked frames sharing the stem, two holes
    const B = mask(60, 80, (x, y) => {
      const top = x > 8 && x < 40 && y > 6 && y < 41 && !(x > 16 && x < 32 && y > 14 && y < 32);
      const bot = x > 8 && x < 44 && y > 38 && y < 74 && !(x > 16 && x < 36 && y > 46 && y < 66);
      return top || bot;
    });
    const b = traceBitmap(B, 60, 80);
    expect(b).toHaveLength(3);
    expect(b.filter((c) => shoelace(c.points) > 0)).toHaveLength(2);
  });

  it('merges curves to keep outlines compact', () => {
    const m = mask(200, 200, (x, y) => Math.hypot(x - 100, y - 100) <= 80);
    const optimized = traceMask(m, 200, 200);
    const raw = traceMask(m, 200, 200, { optimize: false });
    expect(optimized[0].segments.length).toBeLessThan(raw[0].segments.length / 2);
    expect(optimized[0].segments.length).toBeGreaterThanOrEqual(4);
  });

  it('maps pixels through a custom transform and accepts an image object', () => {
    const m = mask(40, 40, (x, y) => x > 5 && x < 35 && y > 5 && y < 35);
    const scaled = traceBitmap({ width: 40, height: 40, data: m }, { scale: 100 });
    const xs = scaled[0].points.map((p) => p.x);
    expect(Math.min(...xs)).toBe(500);
    expect(Math.max(...xs)).toBe(3500);
    const shifted = pathsToContours(traceMask(m, 40, 40), (x, y) => [x + 1000, -y], { round: false });
    expect(Math.min(...shifted[0].points.map((p) => p.x))).toBeCloseTo(1005, 6);
    // every contour starts on an on curve point
    expect(shifted[0].points[0].on).toBe(true);
  });

  it('ignores specks below the minimum area', () => {
    const m = mask(20, 20, (x, y) => (x > 10 && x < 18 && y > 10 && y < 18) || (x > 1 && x < 3 && y > 1 && y < 3));
    expect(traceBitmap(m, 20, 20)).toHaveLength(2);
    expect(traceBitmap(m, 20, 20, { minArea: 5 })).toHaveLength(1);
  });
});

describe('cubic to quadratic conversion', () => {
  it('approximates within the tolerance', () => {
    const p0 = [0, 0];
    const c1 = [0, 300];
    const c2 = [400, 300];
    const p3 = [400, 0];
    for (const tol of [5, 1, 0.25]) {
      const q = cubicToQuads(p0, c1, c2, p3, tol);
      const raw = [{ x: 0, y: 0, on: true }, ...q, { x: 400, y: 0, on: true }];
      // restore the on curve points implied between two off curve points
      const pts = [];
      raw.forEach((p, i) => {
        const prev = raw[i - 1];
        if (prev && !prev.on && !p.on) pts.push({ x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2, on: true });
        pts.push(p);
      });
      // sample the quadratic chain and compare with the cubic
      let worst = 0;
      let prev = pts[0];
      for (let i = 1; i < pts.length; i += 2) {
        const ctrl = pts[i];
        const end = pts[i + 1];
        for (let k = 0; k <= 10; k++) {
          const t = k / 10;
          const x = (1 - t) ** 2 * prev.x + 2 * (1 - t) * t * ctrl.x + t * t * end.x;
          const y = (1 - t) ** 2 * prev.y + 2 * (1 - t) * t * ctrl.y + t * t * end.y;
          let best = Infinity;
          for (let s = 0; s <= 400; s++) {
            const u = s / 400;
            const cx = 3 * (1 - u) * u * u * 400 + u ** 3 * 400;
            const cy = 3 * (1 - u) ** 2 * u * 300 + 3 * (1 - u) * u * u * 300;
            best = Math.min(best, Math.hypot(cx - x, cy - y));
          }
          worst = Math.max(worst, best);
        }
        prev = end;
      }
      expect(worst).toBeLessThan(tol * 1.5 + 0.5);
    }
  });
});
