import { describe, expect, it } from 'vitest';
import {
  bounds, circleContour, contourArea, contourFromCubics, contourSegments, controlBounds, correctDirection, cubicToQuadratic,
  fitContour, fitCurves, flattenContour, pathFromPoints, removeOverlaps, reverseContour, simplify, strokeToOutline,
  transformContours, windingNumber, roundContours, intersectSegments,
} from '../src/core/geometry.mjs';
import { rect } from './helpers.mjs';

const area = (cs) => cs.reduce((a, c) => a + contourArea(c), 0);
const segDist = (p, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
};
const distToPolyline = (p, poly) => {
  let best = Infinity;
  for (let i = 0; i + 1 < poly.length; i++) best = Math.min(best, segDist(p, poly[i], poly[i + 1]));
  return best;
};
const near = (a, b, tol) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('segments and measurements', () => {
  it('expands implied on curve points between off curve points', () => {
    const c = { closed: true, points: [{ x: 0, y: 0, on: true }, { x: 50, y: 100, on: false }, { x: 150, y: 100, on: false }, { x: 200, y: 0, on: true }] };
    const segs = contourSegments(c);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({ x0: 0, y0: 0, cx: 50, cy: 100, x1: 100, y1: 100 });
    expect(segs[2]).toMatchObject({ x0: 200, y0: 0, x1: 0, y1: 0 });
  });

  it('handles contours made only of off curve points', () => {
    const c = { closed: true, points: [{ x: 0, y: 100, on: false }, { x: 100, y: 0, on: false }, { x: 0, y: -100, on: false }, { x: -100, y: 0, on: false }] };
    expect(contourSegments(c)).toHaveLength(4);
    expect(Math.abs(contourArea(c))).toBeGreaterThan(10000);
  });

  it('computes exact bounds including curve extrema', () => {
    const c = circleContour(100, 50, 40);
    const b = bounds([c]);
    expect(b.xMin).toBeCloseTo(60, 6);
    expect(b.xMax).toBeCloseTo(140, 6);
    expect(b.yMin).toBeCloseTo(10, 6);
    expect(b.yMax).toBeCloseTo(90, 6);
    // A curve whose control point sticks out: exact bounds stay inside the control box.
    const bump = { closed: true, points: [{ x: 0, y: 0, on: true }, { x: 50, y: 100, on: false }, { x: 100, y: 0, on: true }] };
    expect(bounds(bump).yMax).toBeCloseTo(50, 6);
    expect(controlBounds([bump]).yMax).toBe(100);
    expect(bounds([])).toEqual({ xMin: 0, yMin: 0, xMax: 0, yMax: 0 });
    expect(bounds([{ x: 3, y: 4 }, { x: -1, y: 9 }])).toEqual({ xMin: -1, yMin: 4, xMax: 3, yMax: 9 });
  });

  it('measures signed areas exactly for lines and curves', () => {
    expect(contourArea(rect(0, 0, 100, 50))).toBe(-5000);
    expect(contourArea(reverseContour(rect(0, 0, 100, 50)))).toBe(5000);
    const bump = { closed: true, points: [{ x: 0, y: 0, on: true }, { x: 100, y: 0, on: true }, { x: 50, y: 100, on: false }] };
    expect(contourArea(bump)).toBeCloseTo((2 / 3) * 100 * 50, 9);
    const r = 100;
    near(Math.abs(contourArea(circleContour(0, 0, r))) / (Math.PI * r * r), 1, 0.005);
    expect(contourArea(circleContour(0, 0, r))).toBeLessThan(0);
  });

  it('flattens curves within tolerance and counts winding', () => {
    const c = circleContour(0, 0, 100);
    const poly = flattenContour(c, 0.25);
    for (const p of poly) expect(Math.abs(Math.hypot(p.x, p.y) - 100)).toBeLessThan(0.8);
    expect(windingNumber(0, 0, [c])).not.toBe(0);
    expect(windingNumber(200, 0, [c])).toBe(0);
    expect(windingNumber(0, 0, [c, reverseContour(circleContour(0, 0, 50))])).toBe(0);
  });
});

describe('direction', () => {
  it('makes outer contours clockwise and holes counter clockwise', () => {
    const outer = reverseContour(rect(0, 0, 300, 300));
    const hole = rect(50, 50, 250, 250);
    const island = reverseContour(rect(100, 100, 200, 200));
    const fixed = correctDirection([hole, outer, island]);
    expect(contourArea(fixed[1])).toBeLessThan(0);
    expect(contourArea(fixed[0])).toBeGreaterThan(0);
    expect(contourArea(fixed[2])).toBeLessThan(0);
    const ps = correctDirection([hole, outer], { clockwiseOuter: false });
    expect(contourArea(ps[1])).toBeGreaterThan(0);
    expect(contourArea(ps[0])).toBeLessThan(0);
  });

  it('keeps the start point when reversing and flips direction for mirrored transforms', () => {
    const r = rect(0, 0, 10, 10);
    expect(reverseContour(r).points[0]).toEqual(r.points[0]);
    const mirrored = transformContours([r], [-1, 0, 0, 1, 0, 0]);
    expect(contourArea(mirrored[0])).toBeLessThan(0);
    const scaled = transformContours([r], [2, 0, 0, 3, 5, 5]);
    expect(contourArea(scaled[0])).toBe(-600);
    expect(roundContours([{ closed: true, points: [{ x: 1.4, y: 2.6, on: true }] }])[0].points[0]).toMatchObject({ x: 1, y: 3 });
  });
});

describe('fitting and conversion', () => {
  it('simplifies polylines and keeps extra properties', () => {
    const pts = [];
    for (let i = 0; i <= 100; i++) pts.push({ x: i, y: i % 2 ? 0.2 : 0, pressure: i / 100 });
    const s = simplify(pts, 1);
    expect(s).toHaveLength(2);
    expect(s[1].pressure).toBe(1);
    const corner = [{ x: 0, y: 0 }, { x: 50, y: 0.1 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    expect(simplify(corner, 1)).toHaveLength(3);
  });

  it('fits cubic curves through samples within the error bound', () => {
    const pts = [];
    for (let i = 0; i <= 80; i++) {
      const t = (i / 80) * Math.PI;
      pts.push({ x: Math.cos(t) * 200, y: Math.sin(t) * 120 });
    }
    const cubics = fitCurves(pts, 0.5);
    expect(cubics.length).toBeGreaterThan(0);
    expect(cubics.length).toBeLessThan(8);
    const contour = contourFromCubics(cubics, { closed: false, tolerance: 0.25 });
    const poly = flattenContour({ ...contour, closed: false }, 0.05);
    poly.push(pts[pts.length - 1]);
    for (const p of pts) expect(distToPolyline(p, poly)).toBeLessThan(1);
    expect(fitCurves([{ x: 0, y: 0 }], 1)).toEqual([]);
  });

  it('converts cubic curves to quadratic ones within tolerance', () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 0, y: 552 };
    const p2 = { x: 448, y: 1000 };
    const p3 = { x: 1000, y: 1000 };
    for (const tol of [5, 1, 0.25]) {
      const q = cubicToQuadratic(p0, p1, p2, p3, tol);
      expect(q[q.length - 1]).toMatchObject({ x: 1000, y: 1000, on: true });
      const contour = { closed: false, points: [{ x: 0, y: 0, on: true }, ...q] };
      const flat = flattenContour(contour, 0.01);
      flat.push({ x: 1000, y: 1000 });
      for (let i = 0; i <= 50; i++) {
        const t = i / 50;
        const mt = 1 - t;
        const x = mt ** 3 * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t ** 3 * p3.x;
        const y = mt ** 3 * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t ** 3 * p3.y;
        expect(distToPolyline({ x, y }, flat)).toBeLessThan(tol + 0.1);
      }
    }
    // A degree elevated quadratic converts back to one exact quadratic.
    const q = { x: 40, y: 90 };
    const c1 = { x: (2 / 3) * q.x, y: (2 / 3) * q.y };
    const c2 = { x: 100 + (2 / 3) * (q.x - 100), y: (2 / 3) * q.y };
    const back = cubicToQuadratic({ x: 0, y: 0 }, c1, c2, { x: 100, y: 0 }, 0.01);
    expect(back).toHaveLength(2);
    expect(back[0].x).toBeCloseTo(40, 9);
    expect(back[0].y).toBeCloseTo(90, 9);
  });

  it('fits closed contours and keeps sharp corners', () => {
    const pts = [];
    for (let i = 0; i < 40; i++) pts.push({ x: i * 5, y: 0 });
    for (let i = 0; i < 40; i++) pts.push({ x: 200, y: i * 5 });
    for (let i = 0; i < 40; i++) pts.push({ x: 200 - i * 5, y: 200 });
    for (let i = 0; i < 40; i++) pts.push({ x: 0, y: 200 - i * 5 });
    const c = fitContour(pts, { error: 1 });
    const b = bounds(c);
    expect(b.xMin).toBeCloseTo(0, 0);
    expect(b.xMax).toBeCloseTo(200, 0);
    expect(c.points.filter((p) => p.on && p.type === 'corner').length).toBeGreaterThanOrEqual(4);
    const circle = [];
    for (let i = 0; i < 90; i++) circle.push({ x: Math.cos((i / 90) * 2 * Math.PI) * 100, y: Math.sin((i / 90) * 2 * Math.PI) * 100 });
    const round = fitContour(circle, { error: 0.5 });
    near(Math.abs(contourArea(round)) / (Math.PI * 10000), 1, 0.01);
  });
});

describe('removeOverlaps', () => {
  it('unions overlapping squares', () => {
    const out = removeOverlaps([rect(0, 0, 100, 100), rect(50, 50, 150, 150)]);
    expect(out).toHaveLength(1);
    expect(area(out)).toBe(-17500);
    expect(out[0].points).toHaveLength(8);
  });

  it('unions curves exactly and keeps them quadratic', () => {
    const out = removeOverlaps([circleContour(0, 0, 100), circleContour(100, 0, 100)]);
    expect(out).toHaveLength(1);
    expect(out[0].points.some((p) => !p.on)).toBe(true);
    const lens = 2 * 100 * 100 * Math.acos(0.5) - 50 * Math.sqrt(30000);
    expect(Math.abs(area(out))).toBeCloseTo(2 * Math.abs(contourArea(circleContour(0, 0, 100))) - lens * 1.003, -2);
    const b = bounds(out);
    expect(b.xMin).toBeCloseTo(-100, 6);
    expect(b.xMax).toBeCloseTo(200, 6);
  });

  it('keeps holes, drops contained duplicates and supports even odd', () => {
    const withHole = removeOverlaps([rect(0, 0, 100, 100), reverseContour(rect(20, 20, 80, 80))]);
    expect(withHole.map(contourArea).sort((a, b) => a - b)).toEqual([-10000, 3600]);
    const nested = removeOverlaps([rect(0, 0, 100, 100), rect(20, 20, 80, 80)]);
    expect(nested.map(contourArea)).toEqual([-10000]);
    const evenodd = removeOverlaps([rect(0, 0, 100, 100), rect(20, 20, 80, 80)], { fillRule: 'evenodd' });
    expect(evenodd.map(contourArea).sort((a, b) => a - b)).toEqual([-10000, 3600]);
    expect(removeOverlaps([])).toEqual([]);
  });

  it('handles shared edges, touching corners and self intersections', () => {
    const shared = removeOverlaps([rect(0, 0, 100, 100), rect(100, 0, 200, 100)]);
    expect(shared).toHaveLength(1);
    expect(area(shared)).toBe(-20000);
    const touching = removeOverlaps([rect(0, 0, 100, 100), rect(100, 100, 200, 200)]);
    expect(area(touching)).toBe(-20000);
    const bowtie = { closed: true, points: [{ x: 0, y: 0, on: true }, { x: 100, y: 100, on: true }, { x: 100, y: 0, on: true }, { x: 0, y: 100, on: true }] };
    const fixed = removeOverlaps([bowtie]);
    expect(fixed).toHaveLength(2);
    for (const c of fixed) expect(contourArea(c)).toBeLessThan(0);
    expect(Math.abs(area(fixed))).toBeCloseTo(5000, 6);
  });

  it('intersects every segment kind', () => {
    const line = { x0: 0, y0: 50, x1: 100, y1: 50 };
    const quad = { x0: 0, y0: 0, cx: 50, cy: 200, x1: 100, y1: 0 };
    const quad2 = { x0: 0, y0: 100, cx: 50, cy: -100, x1: 100, y1: 100 };
    expect(intersectSegments(line, { x0: 50, y0: 0, x1: 50, y1: 100 })).toEqual([[0.5, 0.5]]);
    expect(intersectSegments(line, quad)).toHaveLength(2);
    expect(intersectSegments(quad, line)).toHaveLength(2);
    const qq = intersectSegments(quad, quad2);
    expect(qq).toHaveLength(2);
    for (const [s] of qq) {
      const y = 2 * (1 - s) * s * 200;
      expect(y).toBeCloseTo(50, 3);
    }
  });
});

describe('strokeToOutline', () => {
  it('outlines a straight stroke with round caps', () => {
    const out = strokeToOutline([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }], 40);
    expect(out).toHaveLength(1);
    const b = bounds(out);
    near(b.xMin, -20, 1.5);
    near(b.xMax, 220, 1.5);
    near(b.yMin, -20, 1.5);
    near(b.yMax, 20, 1.5);
    near(Math.abs(area(out)) / (200 * 40 + Math.PI * 400), 1, 0.02);
    expect(contourArea(out[0])).toBeLessThan(0);
  });

  it('follows pressure and keeps loops as holes', () => {
    const pts = [];
    for (let i = 0; i <= 60; i++) pts.push({ x: i * 5, y: Math.sin(i / 8) * 60, pressure: i / 60 });
    const out = strokeToOutline(pts);
    expect(out).toHaveLength(1);
    const b = bounds(out);
    expect(b.xMax).toBeGreaterThan(300 + 40);
    expect(b.xMin).toBeGreaterThan(-10);
    const loop = [];
    for (let i = 0; i <= 80; i++) {
      const t = (i / 80) * 2.2 * Math.PI;
      loop.push({ x: Math.cos(t) * 150, y: Math.sin(t) * 150 });
    }
    const ring = strokeToOutline(loop, 20);
    expect(ring.length).toBe(2);
    expect(ring.some((c) => contourArea(c) > 0)).toBe(true);
    expect(strokeToOutline([], 10)).toEqual([]);
    expect(strokeToOutline([{ x: 5, y: 5 }], 10)).toHaveLength(1);
  });
});

describe('pathFromPoints', () => {
  it('writes SVG path data and flips Y on request', () => {
    expect(pathFromPoints([rect(0, 0, 10, 10)])).toBe('M0 0L0 10L10 10L10 0L0 0Z');
    expect(pathFromPoints(rect(0, 0, 10, 10), { flipY: 800 })).toBe('M0 800L0 790L10 790L10 800L0 800Z');
    expect(pathFromPoints(rect(0, 0, 10, 10), { flipY: true })).toBe('M0 0L0 -10L10 -10L10 0L0 0Z');
    const q = { closed: true, points: [{ x: 0, y: 0, on: true }, { x: 5, y: 10.123, on: false }, { x: 10, y: 0, on: true }] };
    expect(pathFromPoints([q], { decimals: 1 })).toBe('M0 0Q5 10.1 10 0L0 0Z');
  });
});

describe('direction with overlapping contours', () => {
  it('keeps the drawn direction of shapes that overlap', () => {
    const bowl = circleContour(200, 200, 150);
    const stem = rect(300, 0, 380, 450);
    const fixed = correctDirection([bowl, stem]);
    expect(contourArea(fixed[0])).toBeLessThan(0);
    expect(contourArea(fixed[1])).toBeLessThan(0);
    expect(contourArea(correctDirection([bowl, reverseContour(stem)])[1])).toBeGreaterThan(0);
  });
});

describe('direction of crossing contours', () => {
  it('leaves contours that cross others as drawn', () => {
    const outer = circleContour(270, 250, 220);
    const hole = reverseContour(circleContour(270, 250, 140));
    const bar = rect(70, 230, 470, 300);
    const fixed = correctDirection([outer, hole, bar]);
    expect(contourArea(fixed[0])).toBeLessThan(0);
    expect(contourArea(fixed[1])).toBeGreaterThan(0);
    expect(contourArea(fixed[2])).toBeLessThan(0);
    // A clean nested pair is still fixed.
    const nested = correctDirection([reverseContour(circleContour(0, 0, 100)), reverseContour(circleContour(0, 0, 50))]);
    expect(contourArea(nested[0])).toBeLessThan(0);
    expect(contourArea(nested[1])).toBeGreaterThan(0);
  });
});
