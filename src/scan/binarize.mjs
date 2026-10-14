// Ink extraction: colour unmixing (dropout of the cyan guides, ink of any
// colour), Sauvola adaptive thresholding refined by a local half coverage
// level, and despeckling.

import { components, localStats, maxFilter, quantile } from './image.mjs';

/** @typedef {import('./lighting.mjs').RGBPlanes} RGBPlanes */

const LN_MIN = 0.02;

/**
 * Optical density per channel of normalized planes (paper = 1): densities
 * add up when layers overlap, which makes guide removal a linear problem.
 * @param {RGBPlanes} n
 * @returns {{ dr: Float32Array, dg: Float32Array, db: Float32Array }}
 */
export function densities(n) {
  const len = n.width * n.height;
  const dr = new Float32Array(len);
  const dg = new Float32Array(len);
  const db = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    dr[i] = n.r[i] >= 1 ? 0 : -Math.log(n.r[i] > LN_MIN ? n.r[i] : LN_MIN);
    dg[i] = n.g[i] >= 1 ? 0 : -Math.log(n.g[i] > LN_MIN ? n.g[i] : LN_MIN);
    db[i] = n.b[i] >= 1 ? 0 : -Math.log(n.b[i] > LN_MIN ? n.b[i] : LN_MIN);
  }
  return { dr, dg, db };
}

const norm3 = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : [0.577, 0.577, 0.577];
};

/** Angle in degrees between two 3D directions. */
export function angleBetween(a, b) {
  const p = norm3(a);
  const q = norm3(b);
  return (Math.acos(Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]))) * 180) / Math.PI;
}

/**
 * Estimates the dominant ink colour as a density direction: the mean
 * direction of strongly coloured pixels after removing the guide component.
 * @param {{ dr: Float32Array, dg: Float32Array, db: Float32Array }} D
 * @param {number[] | null} guide unit density direction of the guides, or null
 * @returns {{ dir: number[], strength: number } | null}
 */
export function estimateInkDirection(D, guide) {
  const { dr, dg, db } = D;
  const len = dr.length;
  const res = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let x = dr[i];
    let y = dg[i];
    let z = db[i];
    if (guide) {
      const p = x * guide[0] + y * guide[1] + z * guide[2];
      x -= p * guide[0];
      y -= p * guide[1];
      z -= p * guide[2];
    }
    res[i] = Math.sqrt(x * x + y * y + z * z);
  }
  // robust maximum (the 20th largest value): tiny glyphs such as a colon
  // cover far less than one percent of a cell
  const hi = quantile(res, Math.max(0.5, 1 - 20 / len), 0, 4, 4096);
  if (!(hi > 0.12)) return null;
  const lim = Math.max(0.1, hi * 0.5);
  const s = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < len; i++) {
    if (res[i] < lim) continue;
    const w = res[i];
    s[0] += dr[i] * w;
    s[1] += dg[i] * w;
    s[2] += db[i] * w;
    n++;
  }
  if (n < 6) return null;
  return { dir: norm3(s), strength: hi };
}

/**
 * Ink amount per pixel by unmixing each density vector into a guide part and
 * an ink part (least squares on two basis directions). Pixels made only of
 * guide colour get zero ink, ink crossing a guide keeps its full strength.
 * @param {{ dr: Float32Array, dg: Float32Array, db: Float32Array }} D
 * @param {number[] | null} guide unit guide direction or null to skip dropout
 * @param {number[]} ink unit ink direction
 * @returns {{ ink: Float32Array, guide: Float32Array }}
 */
export function unmix(D, guide, ink) {
  const { dr, dg, db } = D;
  const len = dr.length;
  const outInk = new Float32Array(len);
  const outGuide = new Float32Array(len);
  const k = norm3(ink);
  // report ink as the density of its strongest channel, so that the
  // transmittance exp(-ink) of a half covered pixel sits half way
  const kmax = Math.max(k[0], k[1], k[2]);
  const g = guide ? norm3(guide) : null;
  const gk = g ? g[0] * k[0] + g[1] * k[1] + g[2] * k[2] : 0;
  const det = 1 - gk * gk;
  if (!g || det < 0.04) {
    // guide and ink colours are too close to separate by colour: plain
    // projection on the ink direction
    for (let i = 0; i < len; i++) {
      const v = (dr[i] * k[0] + dg[i] * k[1] + db[i] * k[2]) * kmax;
      outInk[i] = v > 0 ? v : 0;
    }
    return { ink: outInk, guide: outGuide };
  }
  for (let i = 0; i < len; i++) {
    const pg = dr[i] * g[0] + dg[i] * g[1] + db[i] * g[2];
    const pk = dr[i] * k[0] + dg[i] * k[1] + db[i] * k[2];
    let a = (pg - gk * pk) / det;
    let b = (pk - gk * pg) / det;
    if (a < 0) {
      // not guide coloured at all: all of it is ink
      a = 0;
      b = pk;
    }
    if (b < 0) b = 0;
    outInk[i] = b * kmax;
    outGuide[i] = a;
  }
  return { ink: outInk, guide: outGuide };
}

/**
 * Sauvola threshold of a gray image where paper is bright: a pixel is
 * foreground when `v < mean * (1 + k * (std / R - 1))` over a window.
 * @param {import('./image.mjs').FloatImage} img values roughly in [0, 1]
 * @param {{ window?: number, k?: number, R?: number }} [options]
 * @returns {Uint8Array} mask, 1 for foreground
 */
export function sauvola(img, options = {}) {
  const { width: w, height: h, data } = img;
  const win = Math.max(3, Math.round(options.window || 25));
  const k = options.k ?? 0.25;
  const R = options.R ?? 0.5;
  const { mean, std } = localStats(data, w, h, win >> 1);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const t = mean[i] * (1 + k * (std[i] / R - 1));
    out[i] = data[i] < t ? 1 : 0;
  }
  return out;
}

/**
 * Robust noise level (standard deviation) of the near zero part of an ink map.
 * @param {Float32Array} ink
 */
export function noiseLevel(ink) {
  // the paper is most of any cell: the median absolute value tracks noise
  const med = quantile(ink, 0.5, 0, 1, 2048);
  const q80 = quantile(ink, 0.8, 0, 1, 2048);
  return Math.max(0.006, (q80 - med) * 1.2 + med * 0.5);
}

/**
 * Binarizes an ink amount map (0 = paper, larger = more ink).
 *
 * Two complementary tests are combined: Sauvola on the transmittance
 * `exp(-ink)` finds faint and strong strokes alike, and a local half
 * coverage level (half way, in transmittance, between paper and the darkest
 * ink nearby) places stroke edges where the true outline is, whatever the
 * pen thickness or blur. A noise floor rejects paper texture.
 * @param {Float32Array} ink
 * @param {number} w
 * @param {number} h
 * @param {{ strokeWidth?: number, k?: number, window?: number, threshold?: number, noise?: number, sensitivity?: number, sauvola?: boolean }} [options]
 *   `threshold` (0 to 1, default 0.5) is the coverage level that counts as
 *   ink; lower values give bolder results. `sensitivity` scales the noise floor.
 * @returns {{ mask: Uint8Array, noise: number, core: number }}
 */
export function binarizeInk(ink, w, h, options = {}) {
  const len = w * h;
  const noise = options.noise ?? noiseLevel(ink);
  const floor = noise * 4 * (options.sensitivity ?? 1);
  const coverage = Math.min(0.9, Math.max(0.1, options.threshold ?? 0.5));
  const sw = Math.max(2, options.strokeWidth || 6);
  // Sauvola on transmittance stretched so the darkest ink is 0 and paper 1:
  // the classic parameters then suit faint pencil as well as black marker
  const hiInk = Math.max(floor * 2, quantile(ink, Math.max(0.5, 1 - 20 / len), 0, 5, 4096));
  const tCore = Math.exp(-hiInk);
  const t = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const v = (Math.exp(-ink[i]) - tCore) / (1 - tCore);
    t[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  const win = Math.max(9, Math.round(options.window || sw * 4)) | 1;
  const sv = options.sauvola === false ? null : sauvola({ width: w, height: h, data: t }, { window: win, k: options.k ?? 0.2, R: 0.5 });
  // local darkest ink (dilation of the ink map)
  const localMax = new Float32Array(ink);
  maxFilter(localMax, w, h, Math.max(3, Math.round(sw * 1.6)) | 1);
  // hysteresis: weak pixels (above the edge level and twice the noise) are
  // kept when they connect to strong ones (past the noise floor and the
  // Sauvola test), so faint pencil strokes stay in one piece
  const mask = new Uint8Array(len);
  const strongMark = new Uint8Array(len);
  const low = Math.max(noise * 2, floor * 0.5);
  for (let i = 0; i < len; i++) {
    const v = ink[i];
    if (v <= low) continue;
    const m = localMax[i];
    // transmittance half way between paper (1) and the local core
    const level = -Math.log(1 - coverage * (1 - Math.exp(-m)));
    if (v < level) continue;
    mask[i] = 1;
    if (v > floor && ((sv ? sv[i] : v > floor * 2) || v > floor * 3)) strongMark[i] = 1;
  }
  const cc = components(mask, w, h, true);
  const keep = new Uint8Array(cc.count + 1);
  for (let i = 0; i < len; i++) if (strongMark[i]) keep[cc.labels[i]] = 1;
  let coreSum = 0;
  let coreN = 0;
  for (let i = 0; i < len; i++) {
    if (!mask[i]) continue;
    if (!keep[cc.labels[i]]) {
      mask[i] = 0;
      continue;
    }
    coreSum += localMax[i];
    coreN++;
  }
  return { mask, noise, core: coreN ? coreSum / coreN : 0 };
}

/**
 * Removes foreground components smaller than `minArea` pixels and fills
 * background holes smaller than `maxHole` pixels, in place.
 * @param {Uint8Array} mask @param {number} w @param {number} h @param {number} minArea @param {number} [maxHole]
 * @returns {number} removed component count
 */
export function despeckle(mask, w, h, minArea, maxHole = 0) {
  let removed = 0;
  if (minArea > 1) {
    const cc = components(mask, w, h, true);
    const kill = new Uint8Array(cc.count + 1);
    for (let i = 0; i < cc.count; i++) {
      if (cc.areas[i] < minArea) {
        kill[i + 1] = 1;
        removed++;
      }
    }
    if (removed) for (let i = 0; i < w * h; i++) if (kill[cc.labels[i]]) mask[i] = 0;
  }
  if (maxHole > 0) {
    const inv = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) inv[i] = mask[i] ? 0 : 1;
    const cc = components(inv, w, h, false);
    for (let i = 0; i < cc.count; i++) {
      const [x0, y0, x1, y1] = cc.boxes[i];
      const touches = x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1;
      if (!touches && cc.areas[i] <= maxHole) {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (cc.labels[y * w + x] === i + 1) mask[y * w + x] = 1;
      }
    }
  }
  return removed;
}

/**
 * Typical stroke width of a mask in pixels. Per connected component: dots
 * (area close to their largest inscribed disc) use that disc, strokes use
 * the area over half the perimeter, which is exact for long strokes and not
 * fooled by thick junctions. The result is the area weighted median.
 * @param {Uint8Array} mask @param {number} w @param {number} h
 * @param {ReturnType<typeof components>} [cc] precomputed components of `mask`
 */
export function strokeWidth(mask, w, h, cc = components(mask, w, h, true)) {
  if (!cc.count) return 0;
  // chamfer distance to the background
  const d = new Float32Array(w * h);
  const INF = 1e9;
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;
  const b = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      v = Math.min(v, x > 0 ? d[i - 1] + 1 : 1);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 1);
        if (x > 0) v = Math.min(v, d[i - w - 1] + b);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + b);
      } else v = Math.min(v, 1);
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      v = Math.min(v, x < w - 1 ? d[i + 1] + 1 : 1);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 1);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + b);
        if (x > 0) v = Math.min(v, d[i + w - 1] + b);
      } else v = Math.min(v, 1);
      d[i] = v;
    }
  }
  const dmax = new Float32Array(cc.count + 1);
  const edges = new Float64Array(cc.count + 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const l = cc.labels[i];
      if (!l) continue;
      if (d[i] > dmax[l]) dmax[l] = d[i];
      if (x === 0 || !mask[i - 1]) edges[l]++;
      if (x === w - 1 || !mask[i + 1]) edges[l]++;
      if (y === 0 || !mask[i - w]) edges[l]++;
      if (y === h - 1 || !mask[i + w]) edges[l]++;
    }
  }
  const list = [];
  for (let c = 1; c <= cc.count; c++) {
    const area = cc.areas[c - 1];
    const perimeter = edges[c] * (Math.PI / 4);
    const byDisc = 2 * dmax[c] - 0.5;
    // a dot is about as big as its inscribed disc; a stroke is much longer
    const dot = area < Math.PI * dmax[c] * dmax[c] * 1.8;
    const byShape = (2 * area) / Math.max(1, perimeter);
    list.push([Math.max(1, dot ? byDisc : Math.min(byShape, byDisc)), area]);
  }
  list.sort((p, q) => p[0] - q[0]);
  const total = list.reduce((s2, v) => s2 + v[1], 0);
  let acc = 0;
  for (const [v, a] of list) {
    acc += a;
    if (acc >= total / 2) return v;
  }
  return list[list.length - 1][0];
}

/**
 * Share of the ink area (0 to 1) that sits in dot like components.
 * @param {Uint8Array} mask @param {number} w @param {number} h
 * @param {ReturnType<typeof components>} [cc] precomputed components of `mask`
 */
export function dotShare(mask, w, h, cc = components(mask, w, h, true)) {
  let dots = 0;
  let total = 0;
  for (let c = 0; c < cc.count; c++) {
    const [x0, y0, x1, y1] = cc.boxes[c];
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const area = cc.areas[c];
    total += area;
    // compact and roughly round: fills most of a near square box
    if (bw < bh * 1.8 && bh < bw * 1.8 && area > 0.55 * bw * bh) dots += area;
  }
  return total ? dots / total : 0;
}

/** Error function (Abramowitz and Stegun 7.1.26, error below 1.5e-7). @param {number} x */
export function erf(x) {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}

/** Profile of a stroke of width `w` blurred by a Gaussian of `sigma`, at offset `x`. */
function blurredBar(x, w, sigma) {
  const k = Math.SQRT2 * sigma;
  return 0.5 * (erf((x + w / 2) / k) - erf((x - w / 2) / k));
}

/** Exponentially scaled modified Bessel function I0(z) e^-z, z >= 0. */
function i0e(z) {
  if (z < 3.75) {
    const t = (z / 3.75) ** 2;
    return (1 + t * (3.5156229 + t * (3.0899424 + t * (1.2067492 + t * (0.2659732 + t * (0.0360768 + t * 0.0045813)))))) * Math.exp(-z);
  }
  const t = 3.75 / z;
  return (0.39894228 + t * (0.01328592 + t * (0.00225319 + t * (-0.00157565 + t * (0.00916281 +
    t * (-0.02057706 + t * (0.02635537 + t * (-0.01647633 + t * 0.00392377)))))))) / Math.sqrt(z);
}

/** Radial profile of a dot of diameter `w` blurred by a Gaussian of `sigma`, at radius `x`. */
function blurredDot(x, w, sigma) {
  const rho = w / 2;
  const n = 48;
  const s2 = sigma * sigma;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const s = ((i + 0.5) / n) * rho;
    sum += (s / s2) * Math.exp(-((s - x) ** 2) / (2 * s2)) * i0e((s * x) / s2);
  }
  return (sum * rho) / n;
}

/** Width at half of the peak of a blurred stroke (or dot). */
function halfPeakWidth(w, sigma, profile = blurredBar) {
  const half = profile(0, w, sigma) / 2;
  let lo = 0;
  let hi = w / 2 + 6 * sigma;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (profile(mid, w, sigma) > half) lo = mid;
    else hi = mid;
  }
  return 2 * lo;
}

/**
 * True width of a stroke (or dot) from its width measured at half of its
 * blurred peak, by inverting the blur model. Returns 0 when the mark is
 * narrower than the blur can resolve.
 * @param {number} observed @param {number} sigma @param {'stroke' | 'dot'} [shape]
 */
export function trueWidth(observed, sigma, shape = 'stroke') {
  if (!(sigma > 0.05)) return observed;
  const profile = shape === 'dot' ? blurredDot : blurredBar;
  let lo = 0.02 * sigma;
  if (halfPeakWidth(lo, sigma, profile) >= observed * 0.97) return 0;
  let hi = Math.max(observed, lo * 2);
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (halfPeakWidth(mid, sigma, profile) < observed) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Coverage level, relative to the local peak, that puts the threshold on
 * the true edge of a stroke of width `w` blurred by `sigma`. Sharp images
 * give 0.5; a stroke only a little wider than the blur needs a higher level
 * because the blur both lowers its peak and widens it. Marks below the
 * resolvable size (w = 0) get a moderate 0.6.
 * @param {number} w @param {number} sigma @param {'stroke' | 'dot'} [shape]
 */
export function coverageFor(w, sigma, shape = 'stroke') {
  if (!(w > 0)) return 0.6;
  if (!(sigma > 0.05)) return 0.5;
  const profile = shape === 'dot' ? blurredDot : blurredBar;
  const r = profile(w / 2, w, sigma) / profile(0, w, sigma);
  return Math.min(0.75, Math.max(0.5, r));
}

/**
 * `coverageFor(trueWidth(observed, sigma))` in one call.
 * @param {number} observed @param {number} sigma @param {'stroke' | 'dot'} [shape]
 */
export function edgeCoverage(observed, sigma, shape = 'stroke') {
  return coverageFor(trueWidth(observed, sigma, shape), sigma, shape);
}
