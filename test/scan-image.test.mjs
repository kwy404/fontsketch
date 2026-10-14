import { describe, expect, it } from 'vitest';
import {
  boxBlur, components, gaussBlur, grayDownscale, localStats, maxFilter, median, minFilter, quantile, toRGBA,
} from '../src/scan/image.mjs';
import { applyH, findHomography, invertH, localScale, mulH, reprojectionError, warpPerspective } from '../src/scan/homography.mjs';
import { normalizeLighting } from '../src/scan/lighting.mjs';
import {
  binarizeInk, coverageFor, densities, despeckle, dotShare, edgeCoverage, erf, estimateInkDirection, sauvola,
  strokeWidth, trueWidth, unmix,
} from '../src/scan/binarize.mjs';
import { rng } from './scan-synth.mjs';

const randomArray = (n, seed) => {
  const r = rng(seed);
  return Float32Array.from({ length: n }, () => r() * 255);
};

describe('image helpers', () => {
  it('accepts RGBA, RGB and gray buffers', () => {
    expect(toRGBA({ width: 1, height: 1, data: new Uint8Array([1, 2, 3, 4]) }).data).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(Array.from(toRGBA({ width: 1, height: 1, data: new Uint8Array([1, 2, 3]) }).data)).toEqual([1, 2, 3, 255]);
    expect(Array.from(toRGBA({ width: 2, height: 1, data: new Uint8Array([9, 7]) }).data)).toEqual([9, 9, 9, 255, 7, 7, 7, 255]);
    expect(() => toRGBA({ width: 2, height: 2, data: new Uint8Array(5) })).toThrow(TypeError);
    expect(() => toRGBA(null)).toThrow(TypeError);
  });

  it('box blur, max and min filters match brute force', () => {
    const w = 23;
    const h = 17;
    const src = randomArray(w * h, 1);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const r = 3;
    const blur = boxBlur(src, w, h, r);
    const mx = maxFilter(new Float32Array(src), w, h, 2 * r + 1);
    const mn = minFilter(new Float32Array(src), w, h, 2 * r + 1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        let a = -Infinity;
        let b = Infinity;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            s += src[clamp(y + dy, 0, h - 1) * w + clamp(x + dx, 0, w - 1)];
            const yy = y + dy;
            const xx = x + dx;
            if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
            a = Math.max(a, src[yy * w + xx]);
            b = Math.min(b, src[yy * w + xx]);
          }
        }
        expect(blur[y * w + x]).toBeCloseTo(s / (2 * r + 1) ** 2, 2);
        expect(mx[y * w + x]).toBe(a);
        expect(mn[y * w + x]).toBe(b);
      }
    }
  });

  it('local statistics match brute force', () => {
    const w = 12;
    const h = 9;
    const src = randomArray(w * h, 2);
    const { mean, std } = localStats(src, w, h, 2);
    const x = 5;
    const y = 4;
    const vals = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) vals.push(src[(y + dy) * w + x + dx]);
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length);
    expect(mean[y * w + x]).toBeCloseTo(m, 3);
    expect(std[y * w + x]).toBeCloseTo(sd, 3);
  });

  it('gaussian blur keeps the mean and smooths', () => {
    const w = 40;
    const h = 30;
    const src = randomArray(w * h, 3);
    for (const sigma of [0.5, Math.SQRT1_2, 1.2, 3]) {
      const out = gaussBlur(src, w, h, sigma);
      const m0 = src.reduce((a, b) => a + b, 0) / src.length;
      const m1 = out.reduce((a, b) => a + b, 0) / out.length;
      expect(Math.abs(m1 - m0)).toBeLessThan(2);
      const sd = (a) => Math.sqrt(a.reduce((s, v) => s + (v - m0) ** 2, 0) / a.length);
      expect(sd(out)).toBeLessThan(sd(src));
    }
  });

  it('labels 4 and 8 connected components', () => {
    const mask = Uint8Array.from([
      1, 0, 0, 1,
      0, 1, 0, 1,
      0, 0, 0, 0,
      1, 1, 0, 1,
    ]);
    expect(components(mask, 4, 4, true).count).toBe(4);
    expect(components(mask, 4, 4, false).count).toBe(5);
    const cc = components(mask, 4, 4, true);
    expect(cc.areas.reduce((a, b) => a + b, 0)).toBe(7);
    expect(cc.boxes[0]).toEqual([0, 0, 1, 1]);
  });

  it('downscales to gray by area averaging', () => {
    const w = 8;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) data.set([200, 100, 50, 255], i * 4);
    const { gray, scale } = grayDownscale({ width: w, height: h, data }, 4);
    expect(gray.width).toBe(4);
    expect(scale).toBe(2);
    expect(gray.data[0]).toBeCloseTo(0.299 * 200 + 0.587 * 100 + 0.114 * 50, 3);
  });

  it('computes medians and quantiles', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(Number.isNaN(median([]))).toBe(true);
    const v = Float32Array.from({ length: 1001 }, (_, i) => i / 1000);
    expect(quantile(v, 0.5, 0, 1)).toBeCloseTo(0.5, 2);
    expect(quantile(v, 0.9, 0, 1)).toBeCloseTo(0.9, 2);
  });
});

describe('homography', () => {
  const H = [1.2, 0.1, 30, -0.05, 0.9, 12, 0.0004, -0.0002, 1];

  it('recovers a homography exactly from 4 points and robustly from many noisy ones', () => {
    const src = [[0, 0], [210, 0], [210, 297], [0, 297]];
    const dst = src.map(([x, y]) => applyH(H, x, y));
    const E = findHomography(src, dst);
    for (let i = 0; i < 9; i++) expect(E[i]).toBeCloseTo(H[i], 6);
    const r = rng(5);
    const many = Array.from({ length: 40 }, () => [r() * 210, r() * 297]);
    const noisy = many.map(([x, y]) => {
      const [u, v] = applyH(H, x, y);
      return [u + r.gauss() * 0.2, v + r.gauss() * 0.2];
    });
    const F = findHomography(many, noisy);
    expect(reprojectionError(F, many, noisy)).toBeLessThan(0.3);
    const [px, py] = applyH(F, 100, 150);
    const [qx, qy] = applyH(H, 100, 150);
    expect(Math.hypot(px - qx, py - qy)).toBeLessThan(0.15);
    expect(() => findHomography(src.slice(0, 3), dst.slice(0, 3))).toThrow(RangeError);
  });

  it('inverts, composes and measures scale', () => {
    const I = mulH(H, invertH(H));
    for (let i = 0; i < 9; i++) expect(I[i] / I[8]).toBeCloseTo(i % 4 === 0 ? 1 : 0, 9);
    expect(localScale([2, 0, 0, 0, 2, 0, 0, 0, 1], 5, 5)).toBeCloseTo(2, 9);
    expect(() => invertH([0, 0, 0, 0, 0, 0, 0, 0, 0])).toThrow(RangeError);
  });

  it('warps with bilinear resampling and supersampling', () => {
    const w = 16;
    const h = 16;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([x * 10, y * 10, 128, 255], (y * w + x) * 4);
    const img = { width: w, height: h, data };
    const id = warpPerspective(img, [1, 0, 0, 0, 1, 0, 0, 0, 1], w, h);
    for (let i = 0; i < w * h; i++) {
      expect(id.r[i]).toBeCloseTo(data[i * 4], 3);
      expect(id.g[i]).toBeCloseTo(data[i * 4 + 1], 3);
    }
    // half size with 2x2 supersampling averages pairs of pixels
    const half = warpPerspective(img, [2, 0, 0, 0, 2, 0, 0, 0, 1], 8, 8, { samples: 2 });
    expect(half.r[1]).toBeCloseTo((20 + 30) / 2, 0);
    // outside the source: fill colour
    const out = warpPerspective(img, [1, 0, 100, 0, 1, 0, 0, 0, 1], 2, 2, { fill: [1, 2, 3] });
    expect([out.r[0], out.g[0], out.b[0]]).toEqual([1, 2, 3]);
  });
});

describe('lighting and ink', () => {
  /** Paper with a strong light gradient, a dark stroke and a cyan guide line. */
  function scene() {
    const w = 120;
    const h = 80;
    const r = new Float32Array(w * h);
    const g = new Float32Array(w * h);
    const b = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const L = 0.45 + 0.5 * (x / w);
        let c = [240 * L, 230 * L, 200 * L];
        if (y === 40 || y === 41) c = [c[0] * 0.62, c[1] * 0.85, c[2] * 0.93];
        if (x >= 60 && x < 64) c = [c[0] * 0.15, c[1] * 0.25, c[2] * 0.7];
        r[y * w + x] = c[0];
        g[y * w + x] = c[1];
        b[y * w + x] = c[2];
      }
    }
    return { width: w, height: h, r, g, b };
  }

  it('flattens gradients and white balances the paper', () => {
    const n = normalizeLighting(scene(), { window: 15 });
    for (const x of [5, 30, 100]) {
      expect(n.r[10 * 120 + x]).toBeCloseTo(1, 1);
      expect(n.b[10 * 120 + x]).toBeCloseTo(1, 1);
    }
    expect(n.r[10 * 120 + 61]).toBeLessThan(0.3);
  });

  it('separates guide colour from ink colour', () => {
    const n = normalizeLighting(scene(), { window: 15 });
    const D = densities(n);
    const guide = [-Math.log(0.62), -Math.log(0.85), -Math.log(0.93)];
    const gl = Math.hypot(...guide);
    const gdir = guide.map((v) => v / gl);
    const ink = estimateInkDirection(D, gdir);
    expect(ink).not.toBeNull();
    const { ink: amount } = unmix(D, gdir, ink.dir);
    const at = (x, y) => amount[y * 120 + x];
    expect(at(20, 40)).toBeLessThan(0.05); // guide only
    expect(at(61, 10)).toBeGreaterThan(1.2); // ink only
    expect(at(61, 40)).toBeGreaterThan(1.2); // ink crossing the guide
    // without a guide colour the guide shows up as ink
    const plain = unmix(D, null, ink.dir).ink;
    expect(plain[40 * 120 + 20]).toBeGreaterThan(0.1);
  });

  it('binarizes faint and strong strokes and despeckles', () => {
    const w = 80;
    const h = 60;
    const ink = new Float32Array(w * h);
    const r = rng(9);
    for (let i = 0; i < w * h; i++) ink[i] = Math.abs(r.gauss() * 0.01);
    for (let y = 10; y < 50; y++) {
      for (let x = 20; x < 24; x++) ink[y * w + x] = 2.2; // marker
      for (let x = 50; x < 53; x++) ink[y * w + x] = 0.25; // pencil
    }
    ink[5 * w + 70] = 1.5; // speck
    const { mask } = binarizeInk(ink, w, h, { strokeWidth: 4 });
    expect(mask[30 * w + 21]).toBe(1);
    expect(mask[30 * w + 51]).toBe(1);
    expect(mask[30 * w + 35]).toBe(0);
    const removed = despeckle(mask, w, h, 3);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(mask[5 * w + 70]).toBe(0);
    // holes get filled
    const ring = new Uint8Array(25).fill(1);
    ring[12] = 0;
    despeckle(ring, 5, 5, 0, 2);
    expect(ring[12]).toBe(1);
  });

  it('runs Sauvola on a gray image', () => {
    const w = 30;
    const data = new Float32Array(w * w).fill(0.9);
    for (let y = 5; y < 25; y++) data[y * w + 15] = 0.2;
    const m = sauvola({ width: w, height: w, data }, { window: 9 });
    expect(m[10 * w + 15]).toBe(1);
    expect(m[10 * w + 5]).toBe(0);
  });

  it('measures stroke width of strokes and dots', () => {
    const w = 120;
    const h = 120;
    const bar = new Uint8Array(w * h);
    for (let y = 20; y < 26; y++) for (let x = 10; x < 110; x++) bar[y * w + x] = 1;
    expect(strokeWidth(bar, w, h)).toBeGreaterThan(5);
    expect(strokeWidth(bar, w, h)).toBeLessThan(7);
    const dot = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.hypot(x - 60, y - 60) <= 6) dot[y * w + x] = 1;
    expect(strokeWidth(dot, w, h)).toBeGreaterThan(10);
    expect(dotShare(dot, w, h)).toBe(1);
    expect(dotShare(bar, w, h)).toBe(0);
    expect(strokeWidth(new Uint8Array(4), 2, 2)).toBe(0);
  });

  it('models blur to put thresholds on the true stroke edge', () => {
    expect(erf(0)).toBeCloseTo(0, 6);
    expect(erf(1)).toBeCloseTo(0.8427, 4);
    expect(erf(-1)).toBeCloseTo(-0.8427, 4);
    // sharp images keep the classic half level
    expect(edgeCoverage(10, 0.3)).toBeCloseTo(0.5, 2);
    // a thin stroke under blur: the level rises, and the true width is recovered
    expect(edgeCoverage(4, 1.2)).toBeGreaterThan(0.5);
    const w = trueWidth(5, 1.5);
    expect(w).toBeLessThan(5);
    expect(w).toBeGreaterThan(2);
    expect(trueWidth(2, 2)).toBe(0);
    expect(coverageFor(0, 1)).toBe(0.6);
    expect(coverageFor(3, 1, 'dot')).toBeGreaterThanOrEqual(0.5);
  });
});
