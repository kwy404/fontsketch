// Bitmap to smooth outlines, following the potrace method (Selinger 2003):
//   1. decompose the bitmap boundary into closed lattice paths (holes run the
//      opposite way, diagonal pixels count as connected),
//   2. find the optimal polygon (fewest straight segments, then least
//      squared deviation),
//   3. move each vertex to the best fit of its two neighbouring segments
//      within its unit square,
//   4. turn the polygon into Bezier curves, keeping sharp turns as corners,
//   5. merge runs of curves that a single cubic describes within tolerance.
// The result is converted to the quadratic TrueType contours of the model.

import { cubicToQuadratic } from '../core/geometry.mjs';

/**
 * @typedef {{ x: number, y: number }} Pt
 * @typedef {{ type: 'corner', vertex: Pt, end: Pt } | { type: 'curve', c1: Pt, c2: Pt, end: Pt }} Segment
 * @typedef {{ sign: 1 | -1, area: number, segments: Segment[] }} TracedPath
 * `sign` is 1 for an outer boundary and -1 for a hole; segments start at the
 * end point of the last segment.
 */

const mod = (a, n) => (a >= n ? a % n : a >= 0 ? a : n - 1 - ((-1 - a) % n));
const sign = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
const xprod = (p1x, p1y, p2x, p2y) => p1x * p2y - p1y * p2x;
const cyclic = (a, b, c) => (a <= c ? a <= b && b < c : a <= b || b < c);

/**
 * Decomposes a binary mask into closed boundary paths on the pixel corner
 * lattice. Ink is kept on the right of the walking direction (y down), so
 * outer boundaries run clockwise on screen and holes counter clockwise.
 * @param {Uint8Array} mask
 * @param {number} w
 * @param {number} h
 * @returns {Array<{ pts: Int32Array, sign: 1 | -1, area: number }>} pts holds x,y pairs
 */
export function decompose(mask, w, h) {
  const ink = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] !== 0;
  // horizontal edge (x,y)-(x+1,y): +1 east when the pixel below is ink, -1 west
  const W1 = w + 1;
  const hEdge = new Int8Array(w * (h + 1));
  const vEdge = new Int8Array(W1 * h);
  for (let y = 0; y <= h; y++) {
    for (let x = 0; x < w; x++) {
      const below = ink(x, y);
      const above = ink(x, y - 1);
      if (below !== above) hEdge[y * w + x] = below ? 1 : -1;
    }
  }
  // vertical edge (x,y)-(x,y+1): +1 north when the pixel on the right is ink, -1 south
  for (let y = 0; y < h; y++) {
    for (let x = 0; x <= w; x++) {
      const right = ink(x, y);
      const left = ink(x - 1, y);
      if (right !== left) vEdge[y * W1 + x] = right ? 1 : -1;
    }
  }
  const hSeen = new Uint8Array(hEdge.length);
  const vSeen = new Uint8Array(vEdge.length);
  // outgoing edge from vertex (x, y) in direction d (0 E, 1 S, 2 W, 3 N)
  const has = (x, y, d) => {
    if (d === 0) return x < w && y <= h && hEdge[y * w + x] === 1 && !hSeen[y * w + x];
    if (d === 2) return x > 0 && y <= h && hEdge[y * w + x - 1] === -1 && !hSeen[y * w + x - 1];
    if (d === 1) return y < h && x <= w && vEdge[y * W1 + x] === -1 && !vSeen[y * W1 + x];
    return y > 0 && x <= w && vEdge[(y - 1) * W1 + x] === 1 && !vSeen[(y - 1) * W1 + x];
  };
  const mark = (x, y, d) => {
    if (d === 0) hSeen[y * w + x] = 1;
    else if (d === 2) hSeen[y * w + x - 1] = 1;
    else if (d === 1) vSeen[y * W1 + x] = 1;
    else vSeen[(y - 1) * W1 + x] = 1;
  };
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  const paths = [];
  const buf = [];
  for (let sy = 0; sy <= h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const e = hEdge[sy * w + sx];
      if (!e || hSeen[sy * w + sx]) continue;
      // start on this horizontal edge, walking in its direction
      let x = e === 1 ? sx : sx + 1;
      let y = sy;
      let d = e === 1 ? 0 : 2;
      buf.length = 0;
      let area = 0;
      for (let guard = 0; guard < 4 * (w + 1) * (h + 1); guard++) {
        mark(x, y, d);
        buf.push(x, y);
        const nx = x + DX[d];
        const ny = y + DY[d];
        area += x * ny - nx * y;
        x = nx;
        y = ny;
        // at a saddle prefer the left turn: diagonal ink pixels connect
        const left = (d + 3) & 3;
        const right = (d + 1) & 3;
        if (has(x, y, left)) d = left;
        else if (has(x, y, d)) {
          /* straight */
        } else if (has(x, y, right)) d = right;
        else break;
      }
      paths.push({ pts: Int32Array.from(buf), sign: area > 0 ? 1 : -1, area: Math.abs(area) / 2 });
    }
  }
  return paths;
}

/** Rotates a lattice path so that it starts at a direction change. */
function startAtCorner(pts) {
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const p = mod(i - 1, n);
    const q = mod(i + 1, n);
    const dx1 = pts[2 * i] - pts[2 * p];
    const dy1 = pts[2 * i + 1] - pts[2 * p + 1];
    const dx2 = pts[2 * q] - pts[2 * i];
    const dy2 = pts[2 * q + 1] - pts[2 * i + 1];
    if (dx1 !== dx2 || dy1 !== dy2) {
      if (i === 0) return pts;
      const out = new Int32Array(pts.length);
      out.set(pts.subarray(2 * i));
      out.set(pts.subarray(0, 2 * i), pts.length - 2 * i);
      return out;
    }
  }
  return pts;
}

/**
 * Potrace stages 2 to 4 for one lattice path.
 * @param {Int32Array} raw x,y pairs
 * @param {number} alphaMax corner threshold (potrace default 1)
 * @returns {{ vertex: Pt[], segments: Segment[] } | null}
 */
function tracePath(raw, alphaMax) {
  const ptsArr = startAtCorner(raw);
  const n = ptsArr.length / 2;
  if (n < 4) return null;
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    px[i] = ptsArr[2 * i];
    py[i] = ptsArr[2 * i + 1];
  }
  const x0 = px[0];
  const y0 = py[0];
  // prefix sums relative to the first point
  const sx = new Float64Array(n + 1);
  const sy = new Float64Array(n + 1);
  const sx2 = new Float64Array(n + 1);
  const sxy = new Float64Array(n + 1);
  const sy2 = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const x = px[i] - x0;
    const y = py[i] - y0;
    sx[i + 1] = sx[i] + x;
    sy[i + 1] = sy[i] + y;
    sx2[i + 1] = sx2[i] + x * x;
    sxy[i + 1] = sxy[i] + x * y;
    sy2[i + 1] = sy2[i] + y * y;
  }

  // ---- calc_lon: longest straight subpaths
  const nc = new Int32Array(n);
  const pivk = new Int32Array(n);
  const lon = new Int32Array(n);
  let k = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (px[i] !== px[k] && py[i] !== py[k]) k = i + 1;
    nc[i] = k;
  }
  const ct = [0, 0, 0, 0];
  for (let i = n - 1; i >= 0; i--) {
    ct[0] = ct[1] = ct[2] = ct[3] = 0;
    let dir = (3 + 3 * (px[mod(i + 1, n)] - px[i]) + (py[mod(i + 1, n)] - py[i])) / 2;
    ct[dir]++;
    let c0x = 0;
    let c0y = 0;
    let c1x = 0;
    let c1y = 0;
    k = nc[i];
    let k1 = i;
    let found = false;
    for (;;) {
      dir = (3 + 3 * sign(px[k] - px[k1]) + sign(py[k] - py[k1])) / 2;
      ct[dir]++;
      if (ct[0] && ct[1] && ct[2] && ct[3]) {
        pivk[i] = k1;
        found = true;
        break;
      }
      const curx = px[k] - px[i];
      const cury = py[k] - py[i];
      if (xprod(c0x, c0y, curx, cury) < 0 || xprod(c1x, c1y, curx, cury) > 0) break;
      if (Math.abs(curx) <= 1 && Math.abs(cury) <= 1) {
        /* no constraint */
      } else {
        let offx = curx + (cury >= 0 && (cury > 0 || curx < 0) ? 1 : -1);
        let offy = cury + (curx <= 0 && (curx < 0 || cury < 0) ? 1 : -1);
        if (xprod(c0x, c0y, offx, offy) >= 0) {
          c0x = offx;
          c0y = offy;
        }
        offx = curx + (cury <= 0 && (cury < 0 || curx < 0) ? 1 : -1);
        offy = cury + (curx >= 0 && (curx > 0 || cury < 0) ? 1 : -1);
        if (xprod(c1x, c1y, offx, offy) <= 0) {
          c1x = offx;
          c1y = offy;
        }
      }
      k1 = k;
      k = nc[k1];
      if (!cyclic(k, i, k1)) break;
    }
    if (found) continue;
    const dkx = sign(px[k] - px[k1]);
    const dky = sign(py[k] - py[k1]);
    const curx = px[k1] - px[i];
    const cury = py[k1] - py[i];
    const a = xprod(c0x, c0y, curx, cury);
    const b = xprod(c0x, c0y, dkx, dky);
    const c = xprod(c1x, c1y, curx, cury);
    const d = xprod(c1x, c1y, dkx, dky);
    let j = 10000000;
    if (b < 0) j = Math.floor(a / -b);
    if (d > 0) j = Math.min(j, Math.floor(-c / d));
    pivk[i] = mod(k1 + j, n);
  }
  let j = pivk[n - 1];
  lon[n - 1] = j;
  for (let i = n - 2; i >= 0; i--) {
    if (cyclic(i + 1, pivk[i], j)) j = pivk[i];
    lon[i] = j;
  }
  for (let i = n - 1; cyclic(mod(i + 1, n), j, lon[n - 1]); i--) lon[i] = j;

  // ---- bestpolygon
  const penalty3 = (i, jj) => {
    let r = 0;
    if (jj >= n) {
      jj -= n;
      r = 1;
    }
    let x;
    let y;
    let x2;
    let xy;
    let y2;
    let kk;
    if (r === 0) {
      x = sx[jj + 1] - sx[i];
      y = sy[jj + 1] - sy[i];
      x2 = sx2[jj + 1] - sx2[i];
      xy = sxy[jj + 1] - sxy[i];
      y2 = sy2[jj + 1] - sy2[i];
      kk = jj + 1 - i;
    } else {
      x = sx[jj + 1] - sx[i] + sx[n];
      y = sy[jj + 1] - sy[i] + sy[n];
      x2 = sx2[jj + 1] - sx2[i] + sx2[n];
      xy = sxy[jj + 1] - sxy[i] + sxy[n];
      y2 = sy2[jj + 1] - sy2[i] + sy2[n];
      kk = jj + 1 - i + n;
    }
    const ppx = (px[i] + px[jj]) / 2 - x0;
    const ppy = (py[i] + py[jj]) / 2 - y0;
    const ey = px[jj] - px[i];
    const ex = -(py[jj] - py[i]);
    const A = (x2 - 2 * x * ppx) / kk + ppx * ppx;
    const B = (xy - x * ppy - y * ppx) / kk + ppx * ppy;
    const C = (y2 - 2 * y * ppy) / kk + ppy * ppy;
    const s = ex * ex * A + 2 * ex * ey * B + ey * ey * C;
    return Math.sqrt(s > 0 ? s : 0);
  };
  const clip0 = new Int32Array(n);
  const clip1 = new Int32Array(n + 1);
  const seg0 = new Int32Array(n + 1);
  const seg1 = new Int32Array(n + 1);
  const pen = new Float64Array(n + 1);
  const prev = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) {
    let c = mod(lon[mod(i - 1, n)] - 1, n);
    if (c === i) c = mod(i + 1, n);
    clip0[i] = c < i ? n : c;
  }
  j = 1;
  for (let i = 0; i < n; i++) {
    while (j <= clip0[i]) {
      clip1[j] = i;
      j++;
    }
  }
  let i = 0;
  for (j = 0; i < n; j++) {
    seg0[j] = i;
    i = clip0[i];
  }
  seg0[j] = n;
  const m = j;
  i = n;
  for (j = m; j > 0; j--) {
    seg1[j] = i;
    i = clip1[i];
  }
  seg1[0] = 0;
  pen[0] = 0;
  for (j = 1; j <= m; j++) {
    for (i = seg1[j]; i <= seg0[j]; i++) {
      let best = -1;
      for (k = seg0[j - 1]; k >= clip1[i]; k--) {
        const thispen = penalty3(k, i) + pen[k];
        if (best < 0 || thispen < best) {
          prev[i] = k;
          best = thispen;
        }
      }
      pen[i] = best;
    }
  }
  const po = new Int32Array(m);
  for (i = n, j = m - 1; i > 0; j--) {
    i = prev[i];
    po[j] = i;
  }

  // ---- adjust_vertices
  const pointslope = (a, b) => {
    let r = 0;
    while (b >= n) {
      b -= n;
      r += 1;
    }
    while (a >= n) {
      a -= n;
      r -= 1;
    }
    while (b < 0) {
      b += n;
      r -= 1;
    }
    while (a < 0) {
      a += n;
      r += 1;
    }
    const x = sx[b + 1] - sx[a] + r * sx[n];
    const y = sy[b + 1] - sy[a] + r * sy[n];
    const x2 = sx2[b + 1] - sx2[a] + r * sx2[n];
    const xy = sxy[b + 1] - sxy[a] + r * sxy[n];
    const y2 = sy2[b + 1] - sy2[a] + r * sy2[n];
    const kk = b + 1 - a + r * n;
    const ctr = { x: x / kk, y: y / kk };
    let A = (x2 - (x * x) / kk) / kk;
    const B = (xy - (x * y) / kk) / kk;
    let C = (y2 - (y * y) / kk) / kk;
    const lambda2 = (A + C + Math.sqrt((A - C) * (A - C) + 4 * B * B)) / 2;
    A -= lambda2;
    C -= lambda2;
    let dir = { x: 0, y: 0 };
    if (Math.abs(A) >= Math.abs(C)) {
      const l = Math.sqrt(A * A + B * B);
      if (l !== 0) dir = { x: -B / l, y: A / l };
    } else {
      const l = Math.sqrt(C * C + B * B);
      if (l !== 0) dir = { x: -C / l, y: B / l };
    }
    return { ctr, dir };
  };
  const q = [];
  for (i = 0; i < m; i++) {
    let jj = po[mod(i + 1, m)];
    jj = mod(jj - po[i], n) + po[i];
    const { ctr, dir } = pointslope(po[i], jj);
    const Q = new Float64Array(9);
    const d = dir.x * dir.x + dir.y * dir.y;
    if (d !== 0) {
      const v = [dir.y, -dir.x, 0];
      v[2] = -v[1] * ctr.y - v[0] * ctr.x;
      for (let l = 0; l < 3; l++) for (let kk = 0; kk < 3; kk++) Q[l * 3 + kk] = (v[l] * v[kk]) / d;
    }
    q.push(Q);
  }
  const quadform = (Q, wx, wy) => {
    const v = [wx, wy, 1];
    let s = 0;
    for (let l = 0; l < 3; l++) for (let kk = 0; kk < 3; kk++) s += v[l] * Q[l * 3 + kk] * v[kk];
    return s;
  };
  /** @type {Pt[]} */
  const vertex = [];
  for (i = 0; i < m; i++) {
    const s = { x: px[po[i]] - x0, y: py[po[i]] - y0 };
    const jj = mod(i - 1, m);
    const Q = new Float64Array(9);
    for (let l = 0; l < 9; l++) Q[l] = q[jj][l] + q[i][l];
    let w = { x: 0, y: 0 };
    for (;;) {
      const det = Q[0] * Q[4] - Q[1] * Q[3];
      if (det !== 0) {
        w = { x: (-Q[2] * Q[4] + Q[5] * Q[1]) / det, y: (Q[2] * Q[3] - Q[5] * Q[0]) / det };
        break;
      }
      let v0;
      let v1;
      if (Q[0] > Q[4]) {
        v0 = -Q[1];
        v1 = Q[0];
      } else if (Q[4]) {
        v0 = -Q[4];
        v1 = Q[3];
      } else {
        v0 = 1;
        v1 = 0;
      }
      const d = v0 * v0 + v1 * v1;
      const v = [v0, v1, -v1 * s.y - v0 * s.x];
      for (let l = 0; l < 3; l++) for (let kk = 0; kk < 3; kk++) Q[l * 3 + kk] += (v[l] * v[kk]) / d;
    }
    if (Math.abs(w.x - s.x) <= 0.5 && Math.abs(w.y - s.y) <= 0.5) {
      vertex.push({ x: w.x + x0, y: w.y + y0 });
      continue;
    }
    let min = quadform(Q, s.x, s.y);
    let xmin = s.x;
    let ymin = s.y;
    if (Q[0] !== 0) {
      for (let z = 0; z < 2; z++) {
        const wy = s.y - 0.5 + z;
        const wx = -(Q[1] * wy + Q[2]) / Q[0];
        const cand = quadform(Q, wx, wy);
        if (Math.abs(wx - s.x) <= 0.5 && cand < min) {
          min = cand;
          xmin = wx;
          ymin = wy;
        }
      }
    }
    if (Q[4] !== 0) {
      for (let z = 0; z < 2; z++) {
        const wx = s.x - 0.5 + z;
        const wy = -(Q[3] * wx + Q[5]) / Q[4];
        const cand = quadform(Q, wx, wy);
        if (Math.abs(wy - s.y) <= 0.5 && cand < min) {
          min = cand;
          xmin = wx;
          ymin = wy;
        }
      }
    }
    for (let l = 0; l < 2; l++) {
      for (let kk = 0; kk < 2; kk++) {
        const wx = s.x - 0.5 + l;
        const wy = s.y - 0.5 + kk;
        const cand = quadform(Q, wx, wy);
        if (cand < min) {
          min = cand;
          xmin = wx;
          ymin = wy;
        }
      }
    }
    vertex.push({ x: xmin + x0, y: ymin + y0 });
  }

  // ---- smooth: corners or curves
  const lerp = (t, a, b) => ({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
  /** @type {Segment[]} */
  const segments = new Array(m);
  for (i = 0; i < m; i++) {
    const jj = mod(i + 1, m);
    const kk = mod(i + 2, m);
    const p4 = lerp(0.5, vertex[kk], vertex[jj]);
    const a = vertex[i];
    const b = vertex[jj];
    const c = vertex[kk];
    // ddenom: L-infinity normalised distance from b to the line a c
    const rX = -sign(c.y - a.y);
    const rY = sign(c.x - a.x);
    const denom = rY * (c.x - a.x) - rX * (c.y - a.y);
    let alpha;
    if (denom !== 0) {
      let dd = xprod(b.x - a.x, b.y - a.y, c.x - a.x, c.y - a.y) / denom;
      dd = Math.abs(dd);
      alpha = dd > 1 ? 1 - 1 / dd : 0;
      alpha /= 0.75;
    } else alpha = 4 / 3;
    if (alpha >= alphaMax) {
      segments[jj] = { type: 'corner', vertex: b, end: p4 };
    } else {
      if (alpha < 0.55) alpha = 0.55;
      else if (alpha > 1) alpha = 1;
      segments[jj] = { type: 'curve', c1: lerp(0.5 + 0.5 * alpha, a, b), c2: lerp(0.5 + 0.5 * alpha, c, b), end: p4 };
    }
  }
  return { vertex, segments };
}

// ---- curve optimization -------------------------------------------------

function bezierPoint(p0, c1, c2, p3, t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * c1.x + c * c2.x + d * p3.x, y: a * p0.y + b * c1.y + c * c2.y + d * p3.y };
}

/** Samples of a run of curve segments starting at `start`. */
function sampleRun(start, run, per) {
  const out = [start];
  let p = start;
  for (const s of run) {
    for (let k = 1; k <= per; k++) out.push(bezierPoint(p, s.c1, s.c2, s.end, k / per));
    p = s.end;
  }
  return out;
}

/**
 * Fits one cubic from p0 to p3 with fixed end tangents to sample points
 * (least squares on the two tangent lengths, chord length parameters).
 */
function fitCubic(points, t0, t3) {
  const n = points.length;
  const p0 = points[0];
  const p3 = points[n - 1];
  const u = [0];
  for (let i = 1; i < n; i++) u.push(u[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = u[n - 1] || 1;
  for (let i = 0; i < n; i++) u[i] /= total;
  let c00 = 0;
  let c01 = 0;
  let c11 = 0;
  let x0 = 0;
  let x1 = 0;
  for (let i = 0; i < n; i++) {
    const t = u[i];
    const s = 1 - t;
    const b1 = 3 * s * s * t;
    const b2 = 3 * s * t * t;
    const a1 = { x: t0.x * b1, y: t0.y * b1 };
    const a2 = { x: t3.x * b2, y: t3.y * b2 };
    c00 += a1.x * a1.x + a1.y * a1.y;
    c01 += a1.x * a2.x + a1.y * a2.y;
    c11 += a2.x * a2.x + a2.y * a2.y;
    const b0 = s * s * s + b1;
    const b3 = b2 + t * t * t;
    const tx = points[i].x - (p0.x * b0 + p3.x * b3);
    const ty = points[i].y - (p0.y * b0 + p3.y * b3);
    x0 += a1.x * tx + a1.y * ty;
    x1 += a2.x * tx + a2.y * ty;
  }
  const det = c00 * c11 - c01 * c01;
  const chord = Math.hypot(p3.x - p0.x, p3.y - p0.y);
  let l0;
  let l3;
  if (Math.abs(det) > 1e-12) {
    l0 = (x0 * c11 - x1 * c01) / det;
    l3 = (c00 * x1 - c01 * x0) / det;
  }
  if (!(l0 > chord * 0.01) || !(l3 > chord * 0.01)) l0 = l3 = chord / 3;
  const c1 = { x: p0.x + t0.x * l0, y: p0.y + t0.y * l0 };
  const c2 = { x: p3.x + t3.x * l3, y: p3.y + t3.y * l3 };
  let err = 0;
  for (let i = 0; i < n; i++) {
    const b = bezierPoint(p0, c1, c2, p3, u[i]);
    const e = Math.hypot(b.x - points[i].x, b.y - points[i].y);
    if (e > err) err = e;
  }
  return { c1, c2, err };
}

/**
 * Merges consecutive curve segments that bend the same way and turn less
 * than ~150 degrees in total into single cubics when the fit stays within
 * `tolerance` pixels.
 * @param {Segment[]} segs
 * @param {number} tolerance
 * @returns {Segment[]}
 */
function optimizeCurves(segs, tolerance) {
  const m = segs.length;
  if (m < 3) return segs;
  const startOf = (i) => segs[mod(i - 1, m)].end;
  // rotate so that the list starts right after a corner if there is one
  let first = segs.findIndex((s) => s.type === 'corner');
  first = first < 0 ? 0 : (first + 1) % m;
  const order = [];
  for (let k = 0; k < m; k++) order.push((first + k) % m);
  /** @type {Segment[]} */
  const out = [];
  let k = 0;
  while (k < m) {
    const i = order[k];
    const s = segs[i];
    if (s.type !== 'curve') {
      out.push(s);
      k++;
      continue;
    }
    const p0 = startOf(i);
    const t0 = norm({ x: s.c1.x - p0.x, y: s.c1.y - p0.y });
    let best = null;
    let bestLen = 1;
    let turn = 0;
    let convex = 0;
    for (let len = 2; k + len <= m; len++) {
      const last = segs[order[k + len - 1]];
      if (last.type !== 'curve') break;
      const prevSeg = segs[order[k + len - 2]];
      const a = startOf(order[k + len - 2]);
      const cr = xprod(prevSeg.end.x - a.x, prevSeg.end.y - a.y, last.end.x - prevSeg.end.x, last.end.y - prevSeg.end.y);
      const sg = sign(cr);
      if (sg) {
        if (convex && sg !== convex) break;
        convex = sg;
      }
      const ta = norm({ x: prevSeg.end.x - prevSeg.c2.x, y: prevSeg.end.y - prevSeg.c2.y });
      const tb = norm({ x: last.end.x - last.c2.x, y: last.end.y - last.c2.y });
      turn += Math.acos(Math.max(-1, Math.min(1, ta.x * tb.x + ta.y * tb.y)));
      if (turn > 2.6) break;
      const run = order.slice(k, k + len).map((o) => segs[o]);
      const pts = sampleRun(p0, run, 6);
      const t3 = norm({ x: last.c2.x - last.end.x, y: last.c2.y - last.end.y });
      const fit = fitCubic(pts, t0, t3);
      if (fit.err > tolerance) break;
      best = { type: 'curve', c1: fit.c1, c2: fit.c2, end: last.end };
      bestLen = len;
    }
    if (best) {
      out.push(/** @type {Segment} */ (best));
      k += bestLen;
    } else {
      out.push(s);
      k++;
    }
  }
  return out;
}

function norm(v) {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}

/**
 * Traces a binary mask into smooth outlines (pixel coordinates, y down).
 * @param {Uint8Array} mask
 * @param {number} w
 * @param {number} h
 * @param {{ alphaMax?: number, optimize?: boolean, tolerance?: number, minArea?: number }} [options]
 * @returns {TracedPath[]}
 */
export function traceMask(mask, w, h, options = {}) {
  const alphaMax = options.alphaMax ?? 1;
  const out = [];
  for (const p of decompose(mask, w, h)) {
    if (p.area < (options.minArea ?? 1)) continue;
    const r = tracePath(p.pts, alphaMax);
    if (!r) continue;
    const segments = options.optimize === false ? r.segments : optimizeCurves(r.segments, options.tolerance ?? 0.3);
    out.push({ sign: p.sign, area: p.area, segments });
  }
  return out;
}

// ---- conversion to model contours ---------------------------------------

/**
 * Converts traced paths to quadratic contours of the font model, mapping
 * every point through `map` (for example pixels to font units). Outer
 * contours come out clockwise and holes counter clockwise in the Y up font
 * space, as TrueType expects.
 * @param {TracedPath[]} paths
 * @param {(x: number, y: number) => [number, number]} map
 * @param {{ tolerance?: number, round?: boolean }} [options] tolerance in output units
 * @returns {import('../core/model.mjs').Contour[]}
 */
export function pathsToContours(paths, map, options = {}) {
  const tol = options.tolerance ?? 1;
  const round = options.round !== false;
  const R = (v) => (round ? Math.round(v) : Math.round(v * 100) / 100);
  const contours = [];
  for (const path of paths) {
    const segs = path.segments;
    if (!segs.length) continue;
    /** @type {Array<{ x: number, y: number, on: boolean, type?: 'corner' | 'smooth' }>} */
    const pts = [];
    const P = (x, y) => map(x, y);
    let cur = P(segs[segs.length - 1].end.x, segs[segs.length - 1].end.y);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const next = segs[(i + 1) % segs.length];
      const endType = s.type === 'curve' && next.type === 'curve' ? 'smooth' : 'corner';
      if (s.type === 'corner') {
        const v = P(s.vertex.x, s.vertex.y);
        const e = P(s.end.x, s.end.y);
        pts.push({ x: v[0], y: v[1], on: true, type: 'corner' });
        pts.push({ x: e[0], y: e[1], on: true, type: endType });
        cur = e;
      } else {
        const c1 = P(s.c1.x, s.c1.y);
        const c2 = P(s.c2.x, s.c2.y);
        const e = P(s.end.x, s.end.y);
        for (const q of cubicToQuads(cur, c1, c2, e, tol)) pts.push(q);
        pts.push({ x: e[0], y: e[1], on: true, type: endType });
        cur = e;
      }
    }
    // the last point equals the start point implied by the first segment: the
    // contour is closed, so drop the duplicate at the end and rotate
    const last = pts.pop();
    pts.unshift(last);
    const cleaned = [];
    for (const p of pts) {
      const q = { x: R(p.x), y: R(p.y), on: p.on };
      if (p.on && p.type) q.type = p.type;
      const prev = cleaned[cleaned.length - 1];
      if (prev && prev.on && q.on && prev.x === q.x && prev.y === q.y) continue;
      cleaned.push(q);
    }
    if (cleaned.length > 1) {
      const a = cleaned[0];
      const b = cleaned[cleaned.length - 1];
      if (a.on && b.on && a.x === b.x && a.y === b.y) cleaned.pop();
    }
    if (cleaned.filter((p) => p.on).length < 2 && cleaned.length < 3) continue;
    // orientation: outer clockwise in y up (negative shoelace), holes positive
    const area = shoelace(cleaned);
    const wantNegative = path.sign === 1;
    if ((area < 0) !== wantNegative && area !== 0) cleaned.reverse();
    // a reversed list must still start on an on curve point
    const startOn = cleaned.findIndex((p) => p.on);
    const rotated = startOn > 0 ? cleaned.slice(startOn).concat(cleaned.slice(0, startOn)) : cleaned;
    contours.push({ closed: true, points: rotated });
  }
  return contours;
}

/** Signed area of a quadratic contour (control polygon, y up positive = CCW). */
export function shoelace(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/**
 * Approximates a cubic by quadratic pieces within `tol` (through the core
 * geometry `cubicToQuadratic`); returns the off curve controls interleaved
 * with on curve split points, without the final end point.
 * @param {number[]} p0 @param {number[]} c1 @param {number[]} c2 @param {number[]} p3 @param {number} tol
 * @returns {Array<{ x: number, y: number, on: boolean, type?: 'smooth' }>}
 */
export function cubicToQuads(p0, c1, c2, p3, tol) {
  const P = (a) => ({ x: a[0], y: a[1] });
  const pts = cubicToQuadratic(P(p0), P(c1), P(c2), P(p3), tol);
  pts.pop();
  return pts.map((p) => (p.on ? { x: p.x, y: p.y, on: true, type: 'smooth' } : { x: p.x, y: p.y, on: false }));
}

/**
 * Potrace style tracer: binary mask in, model contours out.
 * @param {Uint8Array | { width: number, height: number, data: Uint8Array }} mask
 *   1 (or any non zero) for ink, row major
 * @param {number | object} [w]
 * @param {number} [h]
 * @param {{ map?: (x: number, y: number) => [number, number], scale?: number, alphaMax?: number, optimize?: boolean, tolerance?: number, minArea?: number }} [options]
 *   Without `map`, pixels become font units with `scale` units per pixel and the
 *   Y axis flipped about the bitmap bottom.
 * @returns {import('../core/model.mjs').Contour[]}
 */
export function traceBitmap(mask, w, h, options) {
  if (!(mask instanceof Uint8Array)) {
    options = /** @type {any} */ (w);
    ({ width: w, height: h } = mask);
    mask = mask.data;
  }
  const opts = options || {};
  const width = /** @type {number} */ (w);
  const height = /** @type {number} */ (h);
  const scale = opts.scale ?? 1;
  const map = opts.map || ((x, y) => [x * scale, (height - y) * scale]);
  const paths = traceMask(/** @type {Uint8Array} */ (mask), width, height, opts);
  return pathsToContours(paths, map, { tolerance: Math.max(0.25, scale * 0.25) });
}
