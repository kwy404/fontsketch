// Plane to plane homographies: normalized DLT estimation and perspective
// warping with bilinear (and area supersampled) resampling.

/** @typedef {number[]} Mat3 row major 3x3 */

/**
 * Applies a homography to a point.
 * @param {Mat3} H @param {number} x @param {number} y
 * @returns {[number, number]}
 */
export function applyH(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

/** @param {Mat3} a @param {Mat3} b @returns {Mat3} */
export function mulH(a, b) {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  }
  return o;
}

/** @param {Mat3} m @returns {Mat3} */
export function invertH(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!det) throw new RangeError('homography is singular');
  return [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
  ];
}

/**
 * Similarity transform that moves points to their centroid and scales the
 * mean distance to sqrt(2) (Hartley normalization).
 * @param {Array<[number, number]>} pts
 * @returns {Mat3}
 */
function normalizer(pts) {
  let cx = 0;
  let cy = 0;
  for (const [x, y] of pts) {
    cx += x;
    cy += y;
  }
  cx /= pts.length;
  cy /= pts.length;
  let d = 0;
  for (const [x, y] of pts) d += Math.hypot(x - cx, y - cy);
  d /= pts.length;
  const s = d > 0 ? Math.SQRT2 / d : 1;
  return [s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1];
}

/**
 * Smallest eigenvector of a symmetric 9x9 matrix by Jacobi rotations.
 * @param {Float64Array} M 81 entries, destroyed
 */
function smallestEigenvector(M) {
  const n = 9;
  const V = new Float64Array(81);
  for (let i = 0; i < n; i++) V[i * n + i] = 1;
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += M[p * n + q] * M[p * n + q];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = M[p * n + q];
        if (Math.abs(apq) < 1e-300) continue;
        const app = M[p * n + p];
        const aqq = M[q * n + q];
        const theta = (aqq - app) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = M[k * n + p];
          const akq = M[k * n + q];
          M[k * n + p] = c * akp - s * akq;
          M[k * n + q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = M[p * n + k];
          const aqk = M[q * n + k];
          M[p * n + k] = c * apk - s * aqk;
          M[q * n + k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k * n + p];
          const vkq = V[k * n + q];
          V[k * n + p] = c * vkp - s * vkq;
          V[k * n + q] = s * vkp + c * vkq;
        }
      }
    }
  }
  let best = 0;
  for (let i = 1; i < n; i++) if (M[i * n + i] < M[best * n + best]) best = i;
  const v = new Array(9);
  for (let k = 0; k < n; k++) v[k] = V[k * n + best];
  return v;
}

/**
 * Estimates the homography mapping `src[i]` to `dst[i]` (at least 4 pairs)
 * with the normalized direct linear transform, least squares over all pairs.
 * @param {Array<[number, number]>} src
 * @param {Array<[number, number]>} dst
 * @returns {Mat3}
 */
export function findHomography(src, dst) {
  if (src.length < 4 || src.length !== dst.length) throw new RangeError('findHomography: need at least 4 point pairs');
  const Ts = normalizer(src);
  const Td = normalizer(dst);
  const M = new Float64Array(81);
  const row = new Float64Array(9);
  const accumulate = () => {
    for (let i = 0; i < 9; i++) {
      const ri = row[i];
      if (!ri) continue;
      for (let j = 0; j < 9; j++) M[i * 9 + j] += ri * row[j];
    }
  };
  for (let k = 0; k < src.length; k++) {
    const [x, y] = applyH(Ts, src[k][0], src[k][1]);
    const [u, v] = applyH(Td, dst[k][0], dst[k][1]);
    row.set([-x, -y, -1, 0, 0, 0, u * x, u * y, u]);
    accumulate();
    row.set([0, 0, 0, -x, -y, -1, v * x, v * y, v]);
    accumulate();
  }
  const h = smallestEigenvector(M);
  const H = mulH(mulH(invertH(Td), h), Ts);
  const s = H[8] || 1;
  return H.map((v) => v / s);
}

/**
 * Root mean square reprojection error of a homography over point pairs.
 * @param {Mat3} H @param {Array<[number, number]>} src @param {Array<[number, number]>} dst
 */
export function reprojectionError(H, src, dst) {
  let s = 0;
  for (let i = 0; i < src.length; i++) {
    const [x, y] = applyH(H, src[i][0], src[i][1]);
    s += (x - dst[i][0]) ** 2 + (y - dst[i][1]) ** 2;
  }
  return Math.sqrt(s / Math.max(1, src.length));
}

/**
 * Local scale of a homography at a point: how many destination units one
 * source unit covers (geometric mean of the Jacobian singular values).
 * @param {Mat3} H @param {number} x @param {number} y
 */
export function localScale(H, x, y) {
  const [ax, ay] = applyH(H, x, y);
  const [bx, by] = applyH(H, x + 1, y);
  const [cx, cy] = applyH(H, x, y + 1);
  const det = Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  return Math.sqrt(det);
}

/**
 * Perspective warp of an RGBA image into planar float channels.
 *
 * `H` maps output pixel coordinates (pixel centres at +0.5) to source pixel
 * coordinates. With `samples` greater than 1 each output pixel averages a
 * `samples x samples` grid, which avoids aliasing when shrinking.
 * @param {import('./image.mjs').RGBAImage} img
 * @param {Mat3} H
 * @param {number} outW
 * @param {number} outH
 * @param {{ samples?: number, fill?: number[] }} [options]
 * @returns {{ width: number, height: number, r: Float32Array, g: Float32Array, b: Float32Array }}
 */
export function warpPerspective(img, H, outW, outH, options = {}) {
  const { width: W, height: Hh, data } = img;
  const n = Math.max(1, Math.min(4, Math.round(options.samples || 1)));
  const fill = options.fill || [255, 255, 255];
  const R = new Float32Array(outW * outH);
  const G = new Float32Array(outW * outH);
  const B = new Float32Array(outW * outH);
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = H;
  const inv = 1 / (n * n);
  const W1 = W - 1;
  const H1 = Hh - 1;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (let j = 0; j < n; j++) {
        const py = y + (j + 0.5) / n;
        for (let i = 0; i < n; i++) {
          const px = x + (i + 0.5) / n;
          const w = h6 * px + h7 * py + h8;
          // source pixel centres sit at integer + 0.5
          let sx = (h0 * px + h1 * py + h2) / w - 0.5;
          let sy = (h3 * px + h4 * py + h5) / w - 0.5;
          if (sx < -1 || sy < -1 || sx > W || sy > Hh) {
            sr += fill[0];
            sg += fill[1];
            sb += fill[2];
            continue;
          }
          if (sx < 0) sx = 0;
          else if (sx > W1) sx = W1;
          if (sy < 0) sy = 0;
          else if (sy > H1) sy = H1;
          const x0 = sx | 0;
          const y0 = sy | 0;
          const fx = sx - x0;
          const fy = sy - y0;
          const x1 = x0 < W1 ? x0 + 1 : x0;
          const y1 = y0 < H1 ? y0 + 1 : y0;
          const a = (y0 * W + x0) << 2;
          const b = (y0 * W + x1) << 2;
          const c = (y1 * W + x0) << 2;
          const d = (y1 * W + x1) << 2;
          const w00 = (1 - fx) * (1 - fy);
          const w10 = fx * (1 - fy);
          const w01 = (1 - fx) * fy;
          const w11 = fx * fy;
          sr += data[a] * w00 + data[b] * w10 + data[c] * w01 + data[d] * w11;
          sg += data[a + 1] * w00 + data[b + 1] * w10 + data[c + 1] * w01 + data[d + 1] * w11;
          sb += data[a + 2] * w00 + data[b + 2] * w10 + data[c + 2] * w01 + data[d + 2] * w11;
        }
      }
      const o = y * outW + x;
      R[o] = sr * inv;
      G[o] = sg * inv;
      B[o] = sb * inv;
    }
  }
  return { width: outW, height: outH, r: R, g: G, b: B };
}
