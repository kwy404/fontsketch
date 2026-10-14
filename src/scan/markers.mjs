// Fiducial marker detection. Markers are 6x6 module squares: a black border
// ring around a 4x4 bit pattern that tells which corner of the sheet it is
// and how it is rotated. Detection runs on a downscaled gray copy with an
// adaptive threshold (robust to shadows and uneven light), then every corner
// is refined at full resolution by fitting lines to subpixel edge points.

import { boxBlur, components, grayDownscale, sampleBilinear, sampleLuma } from './image.mjs';
import { applyH, findHomography } from './homography.mjs';
import { MARKER_CODES, rotateCode } from './layout.mjs';

/**
 * @typedef {{
 *   id: number,
 *   corners: Array<[number, number]>,
 *   center: [number, number],
 *   errors: number,
 *   contrast: number,
 *   size: number,
 *   refined: boolean,
 *   blur: number,
 *   mirrored: boolean,
 * }} Marker
 * `corners` are in the marker's own order (top left, top right, bottom
 * right, bottom left as printed) in source image pixels. `blur` is the
 * estimated Gaussian blur (sigma, pixels) of the photo around the marker.
 * `mirrored` is true when the marker was read from a mirror image.
 */

const ROTATIONS = MARKER_CODES.map((c) => {
  const r = [c];
  for (let i = 0; i < 3; i++) r.push(rotateCode(r[i]));
  return r;
});

function popcount(v) {
  let n = 0;
  while (v) {
    n += v & 1;
    v >>>= 1;
  }
  return n;
}

/** Convex hull (monotone chain) of points, counter clockwise in y down space. */
function convexHull(pts) {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function polyArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i];
    const [x1, y1] = p[(i + 1) % p.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

/** Four hull vertices enclosing the largest area, in hull order. */
function bestQuad(hull) {
  const n = hull.length;
  if (n < 4) return null;
  const area4 = (i) => polyArea(i.map((k) => hull[k]));
  let cx = 0;
  let cy = 0;
  for (const [x, y] of hull) {
    cx += x;
    cy += y;
  }
  cx /= n;
  cy /= n;
  let a = 0;
  let best = -1;
  hull.forEach(([x, y], i) => {
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d > best) {
      best = d;
      a = i;
    }
  });
  let c = a;
  best = -1;
  hull.forEach(([x, y], i) => {
    const d = (x - hull[a][0]) ** 2 + (y - hull[a][1]) ** 2;
    if (d > best) {
      best = d;
      c = i;
    }
  });
  const side = (i) => {
    const [ax, ay] = hull[a];
    const [bx, by] = hull[c];
    return (bx - ax) * (hull[i][1] - ay) - (by - ay) * (hull[i][0] - ax);
  };
  let b = -1;
  let d = -1;
  let bs = 0;
  let ds = 0;
  for (let i = 0; i < n; i++) {
    const s = side(i);
    if (s > bs) {
      bs = s;
      b = i;
    }
    if (s < ds) {
      ds = s;
      d = i;
    }
  }
  if (b < 0 || d < 0) return null;
  let idx = [a, b, c, d].sort((p, q) => p - q);
  // coordinate ascent: move each corner to the hull vertex maximizing area
  for (let iter = 0; iter < 3; iter++) {
    let changed = false;
    for (let k = 0; k < 4; k++) {
      let bestI = idx[k];
      let bestA = area4(idx);
      const lo = idx[(k + 3) % 4];
      const hi = idx[(k + 1) % 4];
      for (let i = (lo + 1) % n; i !== hi; i = (i + 1) % n) {
        const trial = idx.slice();
        trial[k] = i;
        const ar = area4(trial);
        if (ar > bestA + 1e-9) {
          bestA = ar;
          bestI = i;
        }
      }
      if (bestI !== idx[k]) {
        idx[k] = bestI;
        changed = true;
      }
    }
    idx = idx.slice().sort((p, q) => p - q);
    if (!changed) break;
  }
  return idx.map((k) => hull[k]);
}

/**
 * Tries to read a marker inside a candidate quadrilateral.
 * @param {import('./image.mjs').FloatImage} gray
 * @param {Array<[number, number]>} quad clockwise in image space
 */
function decodeQuad(gray, quad) {
  const H = findHomography([[0, 0], [6, 0], [6, 6], [0, 6]], quad);
  const { width: w, height: h, data } = gray;
  const at = (gx, gy) => {
    let s = 0;
    for (const [ox, oy] of [[0, 0], [-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
      const [x, y] = applyH(H, gx + ox, gy + oy);
      s += sampleBilinear(data, w, h, x - 0.5, y - 0.5);
    }
    return s / 5;
  };
  const border = [];
  const inner = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      const v = at(x + 0.5, y + 0.5);
      if (x === 0 || y === 0 || x === 5 || y === 5) border.push(v);
      else inner.push(v);
    }
  }
  const outside = [];
  for (let i = 0; i < 6; i++) {
    const t = i + 0.5;
    outside.push(at(t, -0.75), at(t, 6.75), at(-0.75, t), at(6.75, t));
  }
  border.sort((a, b) => a - b);
  outside.sort((a, b) => a - b);
  const black = border[10];
  const white = outside[Math.floor(outside.length * 0.6)];
  const contrast = white - black;
  if (contrast < 18 || white < black * 1.35) return null;
  const thr = (black + white) / 2;
  let darkBorder = 0;
  for (const v of border) if (v < thr) darkBorder++;
  if (darkBorder < 17) return null;
  let code = 0;
  inner.forEach((v, i) => {
    if (v < thr) code |= 1 << i;
  });
  let best = null;
  for (let id = 0; id < 4; id++) {
    for (let r = 0; r < 4; r++) {
      const errors = popcount(ROTATIONS[id][r] ^ code);
      // ROTATIONS[id][r] is the printed pattern turned r times clockwise; when
      // it matches, the printed top left corner sits at quad[r].
      if (!best || errors < best.errors) best = { id, r, errors };
    }
  }
  if (!best || best.errors > 2) return null;
  const corners = [0, 1, 2, 3].map((k) => quad[(k + best.r) % 4]);
  return { id: best.id, errors: best.errors, contrast, corners };
}

/**
 * Refines marker corners on the full resolution image: subpixel edge points
 * along each side, robust line fits, then line intersections.
 * @param {import('./image.mjs').RGBAImage} img
 * @param {Array<[number, number]>} corners
 */
function refineCorners(img, corners) {
  const side = Math.sqrt(polyArea(corners));
  const modulePx = side / 6;
  const R = Math.max(2.5, Math.min(modulePx * 0.7, 40));
  const step = Math.max(0.25, R / 24);
  const lines = [];
  const spreads = [];
  let cx = 0;
  let cy = 0;
  for (const [x, y] of corners) {
    cx += x / 4;
    cy += y / 4;
  }
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = corners[k];
    const [bx, by] = corners[(k + 1) % 4];
    const len = Math.hypot(bx - ax, by - ay);
    let nx = -(by - ay) / len;
    let ny = (bx - ax) / len;
    // outward normal: away from the marker centre
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    if ((mx - cx) * nx + (my - cy) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const pts = [];
    const N = 20;
    for (let i = 0; i < N; i++) {
      const t = 0.14 + (0.72 * i) / (N - 1);
      const px = ax + (bx - ax) * t;
      const py = ay + (by - ay) * t;
      const prof = [];
      for (let s = -R; s <= R + 1e-9; s += step) prof.push(sampleLuma(img, px + nx * s - 0.5, py + ny * s - 0.5));
      const q = Math.max(2, Math.floor(prof.length / 4));
      let dark = 0;
      let light = 0;
      for (let j = 0; j < q; j++) {
        dark += prof[j];
        light += prof[prof.length - 1 - j];
      }
      dark /= q;
      light /= q;
      if (light - dark < 12) continue;
      const level = (dark + light) / 2;
      let bestS = null;
      for (let j = 0; j + 1 < prof.length; j++) {
        if (prof[j] < level && prof[j + 1] >= level) {
          const s = -R + step * (j + (level - prof[j]) / (prof[j + 1] - prof[j]));
          if (bestS === null || Math.abs(s) < Math.abs(bestS)) bestS = s;
        }
      }
      if (bestS !== null) {
        pts.push([px + nx * bestS, py + ny * bestS]);
        // edge spread: distance between the 25 % and 75 % levels around the edge
        const l25 = dark + (light - dark) * 0.25;
        const l75 = dark + (light - dark) * 0.75;
        const j0 = Math.round((bestS + R) / step);
        let a = j0;
        let b = j0;
        while (a > 0 && prof[a] > l25) a--;
        while (b < prof.length - 1 && prof[b] < l75) b++;
        if (a > 0 && b < prof.length - 1 && prof[a] <= l25 && prof[b] >= l75) {
          const sa = a + (l25 - prof[a]) / Math.max(1e-6, prof[a + 1] - prof[a]);
          const sb = b - 1 + (l75 - prof[b - 1]) / Math.max(1e-6, prof[b] - prof[b - 1]);
          spreads.push(((sb - sa) * step) / 1.349);
        }
      }
    }
    lines.push(fitLine(pts));
  }
  spreads.sort((p, q) => p - q);
  // bilinear sampling of the profile itself adds about 0.4 px of spread
  const raw = spreads.length ? spreads[Math.floor(spreads.length / 2)] : 1;
  const blur = Math.sqrt(Math.max(0.09, raw * raw - 0.16));
  const out = [];
  for (let k = 0; k < 4; k++) {
    const l1 = lines[(k + 3) % 4];
    const l2 = lines[k];
    const p = l1 && l2 ? intersect(l1, l2) : null;
    if (!p || Math.hypot(p[0] - corners[k][0], p[1] - corners[k][1]) > modulePx * 1.2 + 3) return { corners, refined: false, blur };
    out.push(p);
  }
  return { corners: out, refined: true, blur };
}

/** Total least squares line through points with one round of outlier removal. */
function fitLine(pts) {
  if (pts.length < 5) return null;
  const fit = (p) => {
    let mx = 0;
    let my = 0;
    for (const [x, y] of p) {
      mx += x;
      my += y;
    }
    mx /= p.length;
    my /= p.length;
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (const [x, y] of p) {
      sxx += (x - mx) ** 2;
      sxy += (x - mx) * (y - my);
      syy += (y - my) ** 2;
    }
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const dx = Math.cos(theta);
    const dy = Math.sin(theta);
    return { mx, my, dx, dy };
  };
  let l = fit(pts);
  const res = pts.map(([x, y]) => Math.abs(-(x - l.mx) * l.dy + (y - l.my) * l.dx));
  const sorted = res.slice().sort((a, b) => a - b);
  const lim = Math.max(0.75, sorted[Math.floor(sorted.length / 2)] * 3);
  const kept = pts.filter((_, i) => res[i] <= lim);
  if (kept.length >= 5 && kept.length < pts.length) l = fit(kept);
  return l;
}

function intersect(a, b) {
  const det = a.dx * b.dy - a.dy * b.dx;
  if (Math.abs(det) < 1e-6) return null;
  const t = ((b.mx - a.mx) * b.dy - (b.my - a.my) * b.dx) / det;
  return [a.mx + a.dx * t, a.my + a.dy * t];
}

/**
 * Finds the corner markers of a fontsketch sheet in a photo.
 * @param {import('./image.mjs').RGBAImage} img
 * @param {{ maxSide?: number, refine?: boolean }} [options]
 * @returns {Marker[]} at most one marker per id, sorted by id
 */
export function findMarkers(img, options = {}) {
  const maxSide = options.maxSide || 1200;
  const { gray, scale } = grayDownscale(img, maxSide);
  const { width: w, height: h, data } = gray;
  const longSide = Math.max(w, h);
  /** @type {Map<number, any>} */
  const found = new Map();
  const passes = [
    { win: 0.08, ratio: 0.72 },
    { win: 0.035, ratio: 0.75 },
    { win: 0.16, ratio: 0.82 },
    { win: 0.05, ratio: 0.88 },
  ];
  const mask = new Uint8Array(w * h);
  for (const pass of passes) {
    const r = Math.max(4, Math.round(longSide * pass.win));
    const mean = boxBlur(data, w, h, r);
    for (let i = 0; i < w * h; i++) mask[i] = data[i] < mean[i] * pass.ratio && data[i] < mean[i] - 10 ? 1 : 0;
    const cc = components(mask, w, h, true);
    const minSide = 10;
    const maxSideC = longSide * 0.35;
    for (let c = 0; c < cc.count; c++) {
      const [x0, y0, x1, y1] = cc.boxes[c];
      const bw = x1 - x0 + 1;
      const bh = y1 - y0 + 1;
      if (bw < minSide || bh < minSide || bw > maxSideC || bh > maxSideC) continue;
      if (bw > bh * 4 || bh > bw * 4) continue;
      const area = cc.areas[c];
      if (area < 60) continue;
      const label = c + 1;
      const pts = [];
      for (let y = y0; y <= y1; y++) {
        let lo = -1;
        let hi = -1;
        const row = y * w;
        for (let x = x0; x <= x1; x++) {
          if (cc.labels[row + x] === label) {
            if (lo < 0) lo = x;
            hi = x;
          }
        }
        if (lo >= 0) pts.push([lo, y], [lo, y + 1], [hi + 1, y], [hi + 1, y + 1]);
      }
      const hull = convexHull(pts);
      const hullArea = polyArea(hull);
      if (area / hullArea < 0.3) continue;
      const quad = bestQuad(hull);
      if (!quad) continue;
      const qa = polyArea(quad);
      if (qa / hullArea < 0.86) continue;
      const sides = quad.map((p, i) => Math.hypot(quad[(i + 1) % 4][0] - p[0], quad[(i + 1) % 4][1] - p[1]));
      if (Math.min(...sides) < Math.max(...sides) * 0.3) continue;
      // clockwise in image space (y down): sort by angle around the centroid
      const qcx = quad.reduce((s, p) => s + p[0], 0) / 4;
      const qcy = quad.reduce((s, p) => s + p[1], 0) / 4;
      quad.sort((a, b) => Math.atan2(a[1] - qcy, a[0] - qcx) - Math.atan2(b[1] - qcy, b[0] - qcx));
      // a mirrored photo (front camera, photo of a reflection) reads correctly
      // with the corners taken the other way round; the codes are chosen so
      // only one of the two readings can match
      const straight = decodeQuad(gray, /** @type {Array<[number, number]>} */ (quad));
      const flipped = decodeQuad(gray, /** @type {Array<[number, number]>} */ ([quad[0], quad[3], quad[2], quad[1]]));
      const mirrored = !!flipped && (!straight || flipped.errors < straight.errors);
      const dec = mirrored ? flipped : straight;
      if (!dec) continue;
      const prev = found.get(dec.id);
      const score = dec.errors * 1000 - dec.contrast;
      if (!prev || score < prev.score) found.set(dec.id, { ...dec, score, side: Math.sqrt(qa), mirrored });
    }
    if (found.size === 4 && [...found.values()].every((m) => m.errors === 0)) break;
  }
  // drop size outliers (false positives far from the typical marker size)
  const sizes = [...found.values()].map((m) => m.side).sort((a, b) => a - b);
  const typical = sizes[Math.floor(sizes.length / 2)] || 0;
  const out = [];
  for (const m of found.values()) {
    if (sizes.length >= 3 && (m.side > typical * 2.5 || m.side < typical / 2.5)) continue;
    let corners = m.corners.map(([x, y]) => /** @type {[number, number]} */ ([x * scale, y * scale]));
    let refined = false;
    let blur = scale * 0.7;
    if (options.refine !== false) ({ corners, refined, blur } = refineCorners(img, corners));
    const center = /** @type {[number, number]} */ ([
      corners.reduce((s, p) => s + p[0], 0) / 4,
      corners.reduce((s, p) => s + p[1], 0) / 4,
    ]);
    out.push({ id: m.id, corners, center, errors: m.errors, contrast: m.contrast, size: m.side * scale, refined, blur, mirrored: m.mirrored });
  }
  return out.sort((a, b) => a.id - b.id);
}
