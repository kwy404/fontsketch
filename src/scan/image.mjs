// Small image toolkit for the scan pipeline. Everything works on plain typed
// arrays so the same code runs in browsers (ImageData) and in Node (a decoded
// RGBA buffer). Hot loops avoid allocations and use integer indexing.

/**
 * @typedef {{ width: number, height: number, data: Uint8ClampedArray | Uint8Array }} RGBAImage
 * An ImageData compatible RGBA image (4 bytes per pixel).
 */

/**
 * @typedef {{ width: number, height: number, data: Float32Array }} FloatImage
 * A single channel float image.
 */

/**
 * Normalizes any supported input into an RGBA image. Accepts ImageData,
 * `{ width, height, data }` with 4 (RGBA), 3 (RGB) or 1 (gray) bytes per pixel,
 * and in browsers ImageBitmap, HTMLImageElement, HTMLCanvasElement,
 * OffscreenCanvas and VideoFrame (drawn through an OffscreenCanvas).
 * @param {any} input
 * @returns {RGBAImage}
 */
export function toRGBA(input) {
  if (!input) throw new TypeError('fontsketch scan: an image is required');
  if (input.data && Number.isInteger(input.width) && Number.isInteger(input.height)) {
    const { width, height, data } = input;
    const n = width * height;
    if (data.length === n * 4) return { width, height, data };
    const out = new Uint8ClampedArray(n * 4);
    if (data.length === n * 3) {
      for (let i = 0, j = 0; i < n; i++, j += 3) {
        out[i * 4] = data[j];
        out[i * 4 + 1] = data[j + 1];
        out[i * 4 + 2] = data[j + 2];
        out[i * 4 + 3] = 255;
      }
      return { width, height, data: out };
    }
    if (data.length === n) {
      for (let i = 0; i < n; i++) {
        out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = data[i];
        out[i * 4 + 3] = 255;
      }
      return { width, height, data: out };
    }
    throw new TypeError(`fontsketch scan: image data has ${data.length} bytes, expected ${n * 4}`);
  }
  const w = input.width || input.naturalWidth || input.videoWidth || input.displayWidth;
  const h = input.height || input.naturalHeight || input.videoHeight || input.displayHeight;
  if (w && h && typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }));
    ctx.drawImage(input, 0, 0);
    return ctx.getImageData(0, 0, w, h);
  }
  throw new TypeError('fontsketch scan: unsupported image input (pass ImageData or { width, height, data })');
}

/**
 * Converts RGBA to a gray float image (0 to 255) while shrinking by an area
 * average so that the longest side is at most `maxSide`. Returns the scale
 * factor (source pixels per output pixel) as well.
 * @param {RGBAImage} img
 * @param {number} maxSide
 * @returns {{ gray: FloatImage, scale: number }}
 */
export function grayDownscale(img, maxSide) {
  const { width: W, height: H, data } = img;
  const scale = Math.max(1, Math.max(W, H) / maxSide);
  const w = Math.max(1, Math.round(W / scale));
  const h = Math.max(1, Math.round(H / scale));
  const out = new Float32Array(w * h);
  if (scale === 1) {
    for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
    return { gray: { width: w, height: h, data: out }, scale };
  }
  // Area average: accumulate every source pixel into its destination cell.
  const sx = w / W;
  const sy = h / H;
  const acc = new Float32Array(w * h);
  const cnt = new Float32Array(w * h);
  const colIndex = new Int32Array(W);
  for (let x = 0; x < W; x++) colIndex[x] = Math.min(w - 1, Math.floor(x * sx));
  for (let y = 0; y < H; y++) {
    const row = Math.min(h - 1, Math.floor(y * sy)) * w;
    let j = y * W * 4;
    for (let x = 0; x < W; x++, j += 4) {
      const o = row + colIndex[x];
      acc[o] += 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
      cnt[o] += 1;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = cnt[i] ? acc[i] / cnt[i] : 0;
  return { gray: { width: w, height: h, data: out }, scale: W / w };
}

/**
 * Separable box blur with radius `r` (window 2r+1), edges clamped. O(1) per
 * pixel regardless of the radius.
 * @param {Float32Array} src
 * @param {number} w
 * @param {number} h
 * @param {number} r
 * @param {Float32Array} [out]
 * @returns {Float32Array}
 */
export function boxBlur(src, w, h, r, out) {
  const dst = out || new Float32Array(w * h);
  if (r < 1) {
    dst.set(src);
    return dst;
  }
  const tmp = new Float32Array(w * h);
  const line = new Float32Array(Math.max(w, h) + 2 * r + 2);
  const norm = 1 / (2 * r + 1);
  // horizontal
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let i = -r; i < w + r; i++) line[i + r] = src[o + (i < 0 ? 0 : i >= w ? w - 1 : i)];
    let s = 0;
    for (let i = 0; i < 2 * r + 1; i++) s += line[i];
    for (let x = 0; x < w; x++) {
      tmp[o + x] = s * norm;
      s += line[x + 2 * r + 1] - line[x];
    }
  }
  // vertical, row by row with running column sums (cache friendly)
  const col = new Float64Array(w);
  for (let i = -r; i <= r; i++) {
    const o = (i < 0 ? 0 : i >= h ? h - 1 : i) * w;
    for (let x = 0; x < w; x++) col[x] += tmp[o + x];
  }
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) dst[o + x] = col[x] * norm;
    const add = (y + r + 1 >= h ? h - 1 : y + r + 1) * w;
    const sub = (y - r < 0 ? 0 : y - r) * w;
    for (let x = 0; x < w; x++) col[x] += tmp[add + x] - tmp[sub + x];
  }
  return dst;
}

/**
 * Approximate Gaussian blur by three box blurs.
 * @param {Float32Array} src
 * @param {number} w
 * @param {number} h
 * @param {number} sigma
 * @returns {Float32Array}
 */
export function gaussBlur(src, w, h, sigma) {
  if (sigma < 0.3) return new Float32Array(src);
  if (Math.abs(sigma - Math.SQRT1_2) < 1e-6) return binomial3(src, w, h);
  if (sigma < 2) return gaussDirect(src, w, h, sigma);
  // box radius giving the requested variance after 3 passes
  const r = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
  let a = boxBlur(src, w, h, r);
  a = boxBlur(a, w, h, r, a === src ? undefined : new Float32Array(w * h));
  return boxBlur(a, w, h, r);
}

/**
 * [1 2 1] / 4 binomial filter in both directions (a Gaussian of sigma
 * 1/sqrt(2)), the cheapest useful smoothing.
 * @param {Float32Array} src @param {number} w @param {number} h
 */
function binomial3(src, w, h) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    tmp[o] = (3 * src[o] + src[o + (w > 1 ? 1 : 0)]) * 0.25;
    for (let x = 1; x < w - 1; x++) tmp[o + x] = (src[o + x - 1] + 2 * src[o + x] + src[o + x + 1]) * 0.25;
    if (w > 1) tmp[o + w - 1] = (src[o + w - 2] + 3 * src[o + w - 1]) * 0.25;
  }
  for (let y = 0; y < h; y++) {
    const a = (y > 0 ? y - 1 : 0) * w;
    const b = y * w;
    const c = (y < h - 1 ? y + 1 : h - 1) * w;
    for (let x = 0; x < w; x++) out[b + x] = (tmp[a + x] + 2 * tmp[b + x] + tmp[c + x]) * 0.25;
  }
  return out;
}

/**
 * Exact separable Gaussian for small sigmas (direct convolution).
 * @param {Float32Array} src @param {number} w @param {number} h @param {number} sigma
 */
function gaussDirect(src, w, h, sigma) {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) {
        const xx = x + i < 0 ? 0 : x + i >= w ? w - 1 : x + i;
        a += src[o + xx] * k[i + r];
      }
      tmp[o + x] = a;
    }
  }
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) out[o + x] = 0;
    for (let i = -r; i <= r; i++) {
      const yy = y + i < 0 ? 0 : y + i >= h ? h - 1 : y + i;
      const kv = k[i + r];
      const oo = yy * w;
      for (let x = 0; x < w; x++) out[o + x] += tmp[oo + x] * kv;
    }
  }
  return out;
}

/**
 * Running max or min over a 1D window of `size` samples (van Herk / Gil
 * Werman), applied along rows (`stride` 1) or columns (`stride` w). Works in
 * place on `buf` through a scratch line.
 * @param {Float32Array} buf
 * @param {number} w
 * @param {number} h
 * @param {number} size odd window size
 * @param {boolean} isMax
 * @param {boolean} vertical
 */
function vanHerk(buf, w, h, size, isMax, vertical) {
  const n = vertical ? h : w;
  const lines = vertical ? w : h;
  const r = size >> 1;
  const len = n + 2 * r;
  const padded = Math.ceil(len / size) * size;
  const f = new Float32Array(padded);
  const g = new Float32Array(padded);
  const pad = new Float32Array(padded);
  const fill = isMax ? -Infinity : Infinity;
  for (let l = 0; l < lines; l++) {
    const base = vertical ? l : l * w;
    const step = vertical ? w : 1;
    for (let i = 0; i < padded; i++) {
      const k = i - r;
      pad[i] = k >= 0 && k < n ? buf[base + k * step] : fill;
    }
    for (let b = 0; b < padded; b += size) {
      f[b] = pad[b];
      for (let i = 1; i < size; i++) {
        const v = pad[b + i];
        const p = f[b + i - 1];
        f[b + i] = isMax ? (v > p ? v : p) : v < p ? v : p;
      }
      const e = b + size - 1;
      g[e] = pad[e];
      for (let i = size - 2; i >= 0; i--) {
        const v = pad[b + i];
        const p = g[b + i + 1];
        g[b + i] = isMax ? (v > p ? v : p) : v < p ? v : p;
      }
    }
    // window [k, k + size - 1] in padded coordinates is centred on output k
    for (let k = 0; k < n; k++) {
      const a = g[k];
      const c = f[k + size - 1];
      buf[base + k * step] = isMax ? (a > c ? a : c) : a < c ? a : c;
    }
  }
}

/**
 * Square max filter (gray dilation) of odd `size`, in place.
 * @param {Float32Array} buf @param {number} w @param {number} h @param {number} size
 */
export function maxFilter(buf, w, h, size) {
  if (size < 2) return buf;
  vanHerk(buf, w, h, size | 1, true, false);
  vanHerk(buf, w, h, size | 1, true, true);
  return buf;
}

/**
 * Square min filter (gray erosion) of odd `size`, in place.
 * @param {Float32Array} buf @param {number} w @param {number} h @param {number} size
 */
export function minFilter(buf, w, h, size) {
  if (size < 2) return buf;
  vanHerk(buf, w, h, size | 1, false, false);
  vanHerk(buf, w, h, size | 1, false, true);
  return buf;
}

/**
 * Bilinear sample of a float image with clamped edges.
 * @param {Float32Array} d @param {number} w @param {number} h @param {number} x @param {number} y
 */
export function sampleBilinear(d, w, h, x, y) {
  if (x < 0) x = 0;
  else if (x > w - 1) x = w - 1;
  if (y < 0) y = 0;
  else if (y > h - 1) y = h - 1;
  const x0 = x | 0;
  const y0 = y | 0;
  const x1 = x0 + 1 < w ? x0 + 1 : x0;
  const y1 = y0 + 1 < h ? y0 + 1 : y0;
  const fx = x - x0;
  const fy = y - y0;
  const a = d[y0 * w + x0];
  const b = d[y0 * w + x1];
  const c = d[y1 * w + x0];
  const e = d[y1 * w + x1];
  return (a + (b - a) * fx) * (1 - fy) + (c + (e - c) * fx) * fy;
}

/**
 * Bilinear sample of the luminance of an RGBA image (0 to 255).
 * @param {RGBAImage} img @param {number} x @param {number} y
 */
export function sampleLuma(img, x, y) {
  const { width: w, height: h, data } = img;
  if (x < 0) x = 0;
  else if (x > w - 1) x = w - 1;
  if (y < 0) y = 0;
  else if (y > h - 1) y = h - 1;
  const x0 = x | 0;
  const y0 = y | 0;
  const x1 = x0 + 1 < w ? x0 + 1 : x0;
  const y1 = y0 + 1 < h ? y0 + 1 : y0;
  const fx = x - x0;
  const fy = y - y0;
  const l = (i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  const a = l((y0 * w + x0) * 4);
  const b = l((y0 * w + x1) * 4);
  const c = l((y1 * w + x0) * 4);
  const e = l((y1 * w + x1) * 4);
  return (a + (b - a) * fx) * (1 - fy) + (c + (e - c) * fx) * fy;
}

/**
 * Local mean and standard deviation over a (2r+1) square window through
 * integral images (Float64 for the squared sums to stay exact).
 * @param {Float32Array} src @param {number} w @param {number} h @param {number} r
 * @returns {{ mean: Float32Array, std: Float32Array }}
 */
export function localStats(src, w, h, r) {
  const W1 = w + 1;
  const s1 = new Float64Array(W1 * (h + 1));
  const s2 = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let a = 0;
    let b = 0;
    const o = y * w;
    const io = (y + 1) * W1;
    for (let x = 0; x < w; x++) {
      const v = src[o + x];
      a += v;
      b += v * v;
      s1[io + x + 1] = s1[io - W1 + x + 1] + a;
      s2[io + x + 1] = s2[io - W1 + x + 1] + b;
    }
  }
  const mean = new Float32Array(w * h);
  const std = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = y - r < 0 ? 0 : y - r;
    const y1 = y + r + 1 > h ? h : y + r + 1;
    for (let x = 0; x < w; x++) {
      const x0 = x - r < 0 ? 0 : x - r;
      const x1 = x + r + 1 > w ? w : x + r + 1;
      const n = (x1 - x0) * (y1 - y0);
      const A = y0 * W1 + x0;
      const B = y0 * W1 + x1;
      const C = y1 * W1 + x0;
      const D = y1 * W1 + x1;
      const m = (s1[D] - s1[B] - s1[C] + s1[A]) / n;
      const v = (s2[D] - s2[B] - s2[C] + s2[A]) / n - m * m;
      mean[y * w + x] = m;
      std[y * w + x] = v > 0 ? Math.sqrt(v) : 0;
    }
  }
  return { mean, std };
}

/**
 * Connected components of a binary mask (non zero = foreground).
 * @param {Uint8Array} mask
 * @param {number} w
 * @param {number} h
 * @param {boolean} [eight] use 8 connectivity (default true)
 * @returns {{ labels: Int32Array, count: number, areas: number[], boxes: number[][] }}
 * `boxes[i]` is `[x0, y0, x1, y1]` inclusive for label `i + 1`.
 */
export function components(mask, w, h, eight = true) {
  const labels = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  const areas = [];
  const boxes = [];
  let count = 0;
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || labels[start]) continue;
    count++;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = count;
    let area = 0;
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    while (sp) {
      const p = stack[--sp];
      area++;
      const x = p % w;
      const y = (p - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (!eight && dx && dy) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (mask[q] && !labels[q]) {
            labels[q] = count;
            stack[sp++] = q;
          }
        }
      }
    }
    areas.push(area);
    boxes.push([x0, y0, x1, y1]);
  }
  return { labels, count, areas, boxes };
}

/**
 * Median of a numeric array (copy sorted). Returns NaN for empty input.
 * @param {ArrayLike<number>} values
 */
export function median(values) {
  const n = values.length;
  if (!n) return NaN;
  const a = Array.from(values).sort((p, q) => p - q);
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
}

/**
 * Value at quantile `q` (0 to 1) of a typed array, by histogram over
 * [lo, hi] with `bins` buckets. Fast and allocation light. `step` samples
 * every n-th value.
 * @param {ArrayLike<number>} values @param {number} q @param {number} lo @param {number} hi @param {number} [bins] @param {number} [step]
 */
export function quantile(values, q, lo, hi, bins = 1024, step = 1) {
  const hist = new Uint32Array(bins);
  const span = hi - lo || 1;
  let n = 0;
  for (let i = 0; i < values.length; i += step) {
    const v = values[i];
    if (v !== v) continue;
    let b = Math.floor(((v - lo) / span) * bins);
    if (b < 0) b = 0;
    else if (b >= bins) b = bins - 1;
    hist[b]++;
    n++;
  }
  if (!n) return NaN;
  const target = q * (n - 1);
  let acc = 0;
  for (let b = 0; b < bins; b++) {
    acc += hist[b];
    if (acc > target) return lo + ((b + 0.5) / bins) * span;
  }
  return hi;
}
