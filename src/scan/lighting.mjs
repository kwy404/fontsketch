// Lighting normalization: estimate the paper (background) per colour channel
// with a large morphological closing, then divide. This flattens gradients,
// removes soft shadows and white balances in one step, so the paper becomes
// 1.0 in every channel whatever the light colour was.

import { boxBlur, maxFilter, minFilter } from './image.mjs';

/**
 * @typedef {{ width: number, height: number, r: Float32Array, g: Float32Array, b: Float32Array }} RGBPlanes
 */

/**
 * Background of one channel: closing (max then min filter) removes dark ink
 * thinner than the window while keeping steps such as shadow edges, then a
 * light blur removes the blockiness. Computed at a reduced resolution
 * (`shrink`) for speed and upsampled bilinearly.
 * @param {Float32Array} ch @param {number} w @param {number} h @param {number} size @param {number} shrink
 */
function background(ch, w, h, size, shrink) {
  const sw = Math.max(1, Math.ceil(w / shrink));
  const sh = Math.max(1, Math.ceil(h / shrink));
  const small = new Float32Array(sw * sh);
  const count = new Float32Array(sw * sh);
  // mean pooling averages the noise away; the closing below removes the ink
  for (let y = 0; y < h; y++) {
    const sy = (y / shrink) | 0;
    for (let x = 0; x < w; x++) {
      const o = sy * sw + ((x / shrink) | 0);
      small[o] += ch[y * w + x];
      count[o]++;
    }
  }
  for (let i = 0; i < small.length; i++) small[i] /= count[i] || 1;
  const k = Math.max(3, Math.round(size / shrink) | 1);
  maxFilter(small, sw, sh, k);
  minFilter(small, sw, sh, k);
  // a light blur only: closing already keeps steps such as shadow edges, a
  // wide blur would smear them into false ink next to the edge
  const blurred = boxBlur(small, sw, sh, 1);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let fy = (y + 0.5) / shrink - 0.5;
    if (fy < 0) fy = 0;
    if (fy > sh - 1) fy = sh - 1;
    const y0 = fy | 0;
    const y1 = y0 + 1 < sh ? y0 + 1 : y0;
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      let fx = (x + 0.5) / shrink - 0.5;
      if (fx < 0) fx = 0;
      if (fx > sw - 1) fx = sw - 1;
      const x0 = fx | 0;
      const x1 = x0 + 1 < sw ? x0 + 1 : x0;
      const tx = fx - x0;
      const a = blurred[y0 * sw + x0];
      const b = blurred[y0 * sw + x1];
      const c = blurred[y1 * sw + x0];
      const d = blurred[y1 * sw + x1];
      out[y * w + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

/**
 * Normalizes lighting of RGB planes. Returns new planes where paper is about
 * 1.0 in every channel (values are clamped to [0, 1.25]).
 * @param {RGBPlanes} planes
 * @param {{ window?: number, shrink?: number }} [options] `window` is the
 *   closing size in pixels; it must exceed the thickest stroke.
 * @returns {RGBPlanes & { paper: [number, number, number] }}
 */
export function normalizeLighting(planes, options = {}) {
  const { width: w, height: h } = planes;
  const size = Math.max(5, Math.round(options.window || Math.min(w, h) / 6));
  const shrink = Math.max(1, Math.round(options.shrink || (size >= 24 ? 2 : 1)));
  const out = { width: w, height: h, r: new Float32Array(w * h), g: new Float32Array(w * h), b: new Float32Array(w * h), paper: [0, 0, 0] };
  ['r', 'g', 'b'].forEach((name, c) => {
    const src = planes[name];
    const bg = background(src, w, h, size, shrink);
    const dst = out[name];
    let sum = 0;
    for (let i = 0; i < w * h; i++) {
      const bv = bg[i] > 4 ? bg[i] : 4;
      let v = src[i] / bv;
      if (v > 1.25) v = 1.25;
      dst[i] = v;
      sum += bv;
    }
    out.paper[c] = sum / (w * h);
  });
  return out;
}
