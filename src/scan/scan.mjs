// Photo of a filled sheet in, glyph outlines out:
//   markers -> homography -> page code -> per cell: rectify, flatten the
//   light, unmix guide and ink colours, binarize, despeckle, trace, place
//   on the font metrics with the template baseline, score confidence.

import { glyphNameFor } from '../core/model.mjs';
import { verticalClass } from './charsets.mjs';
import { components, gaussBlur, quantile, toRGBA } from './image.mjs';
import { applyH, findHomography, localScale, mulH, reprojectionError, warpPerspective } from './homography.mjs';
import { asLayout, decodePageCode, guideLines } from './layout.mjs';
import { findMarkers } from './markers.mjs';
import { normalizeLighting } from './lighting.mjs';
import {
  angleBetween, binarizeInk, coverageFor, densities, despeckle, dotShare, estimateInkDirection, erf, noiseLevel, strokeWidth, trueWidth, unmix,
} from './binarize.mjs';
import { pathsToContours, traceMask } from './trace.mjs';

/** @typedef {import('./layout.mjs').TemplateLayout} TemplateLayout */
/** @typedef {import('./layout.mjs').TemplateCell} TemplateCell */
/** @typedef {import('../core/model.mjs').Contour} Contour */

/**
 * @typedef {{ code: string, message: string, char?: string }} ScanWarning
 * Codes: `few-markers`, `page-code-unreadable`, `sheet-mismatch`,
 * `low-resolution`, `no-guides`, `empty-cell`, `touches-border`, `faint`,
 * `noisy`, `label-overlap`, `off-baseline`.
 */

/**
 * @typedef {{
 *   char: string, name: string, unicodes: number[],
 *   contours: Contour[], advanceWidth: number, leftSideBearing: number,
 *   bbox: { xMin: number, yMin: number, xMax: number, yMax: number } | null,
 *   confidence: number, warnings: ScanWarning[], empty: boolean, shiftX?: number,
 *   stats: { coverage: number, inkArea: number, strokeWidth: number, contrast: number, noise: number, specks: number, components: number },
 * }} ScannedGlyph
 * Coordinates are font units (Y up, baseline at 0) with the glyph already
 * shifted to its left side bearing; `shiftX` is that horizontal shift from
 * the cell position (cell writing area left edge at x = 0).
 */

/**
 * @typedef {{
 *   threshold?: number, sensitivity?: number, k?: number, window?: number,
 *   minSpeck?: number, inset?: number, strokeWidth?: number,
 * }} CellOptions
 * `threshold` is the ink coverage (0.1 to 0.9, default 0.5) that counts as
 * ink: lower is bolder, higher is thinner. `sensitivity` scales the noise
 * floor (below 1 picks up fainter strokes). `k` and `window` tune Sauvola.
 * `minSpeck` is the smallest kept dot in mm squared. `inset` in mm trims the
 * cell border.
 */

const DEFAULT_INSET = 0.9;
const MARGIN = 2.5;

class ScanError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.name = 'ScanError';
    this.code = code;
  }
}

/**
 * Page homography (millimetres to image pixels) from detected markers.
 * @param {TemplateLayout} t @param {import('./markers.mjs').Marker[]} markers
 */
export function pageHomography(t, markers) {
  const src = [];
  const dst = [];
  const S = t.marker.size;
  for (const m of markers) {
    const box = t.marker.boxes[m.id];
    const pagePts = [[box.x, box.y], [box.x + S, box.y], [box.x + S, box.y + S], [box.x, box.y + S]];
    for (let k = 0; k < 4; k++) {
      src.push(pagePts[k]);
      dst.push(m.corners[k]);
    }
  }
  const H = findHomography(src, dst);
  return { H, error: reprojectionError(H, src, dst) };
}

/** Average luminance of a small disc around a page point (mm). */
function lumaAt(img, H, x, y, r) {
  const { width: w, height: h, data } = img;
  let s = 0;
  let n = 0;
  for (const [ox, oy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
    const [px, py] = applyH(H, x + ox, y + oy);
    const ix = Math.min(w - 1, Math.max(0, Math.floor(px)));
    const iy = Math.min(h - 1, Math.max(0, Math.floor(py)));
    const i = (iy * w + ix) * 4;
    s += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    n++;
  }
  return s / n;
}

/**
 * Reads the page code printed between the top markers.
 * @param {import('./image.mjs').RGBAImage} img @param {number[]} H @param {TemplateLayout} t
 */
export function readPageCode(img, H, t) {
  const { x, y, module: m, bits } = t.code;
  const vals = [];
  for (let i = 0; i < bits + 2; i++) vals.push(lumaAt(img, H, x + (i + 0.5) * m, y + m / 2, m * 0.18));
  const whites = [];
  for (let i = 0; i < bits + 2; i++) whites.push(lumaAt(img, H, x + (i + 0.5) * m, y - m * 0.55, m * 0.12));
  whites.sort((a, b) => a - b);
  const white = whites[Math.floor(whites.length / 2)];
  const black = (vals[0] + vals[bits + 1]) / 2;
  if (white - black < 15) return null;
  const thr = (white + black) / 2;
  const data = vals.slice(1, bits + 1).map((v) => (v < thr ? 1 : 0));
  return decodePageCode(data);
}

/**
 * Pixel grid of a cell region and its warp.
 * @param {any} ctx @param {TemplateCell} cell @param {number} inset
 */
function cellRegion(ctx, cell, inset) {
  const { ppm } = ctx;
  const x0 = cell.x + inset - MARGIN;
  const y0 = cell.y + inset - MARGIN;
  const wmm = cell.w - 2 * inset + 2 * MARGIN;
  const hmm = cell.h - 2 * inset + 2 * MARGIN;
  const W = Math.round(wmm * ppm);
  const Hh = Math.round(hmm * ppm);
  const m = Math.round(MARGIN * ppm);
  // output pixel (continuous) -> page mm -> image pixel
  const S = [1 / ppm, 0, x0, 0, 1 / ppm, y0, 0, 0, 1];
  return { x0, y0, W, H: Hh, m, Hc: mulH(ctx.H, S) };
}

/** Rectified, light normalized densities of a cell. */
function cellDensities(ctx, cell, inset) {
  const reg = cellRegion(ctx, cell, inset);
  const planes = warpPerspective(ctx.img, reg.Hc, reg.W, reg.H, { samples: ctx.samples });
  const norm = normalizeLighting(planes, { window: Math.round(6 * ctx.ppm) });
  const D = densities(norm);
  return { reg, D, paper: norm.paper };
}

/**
 * Guide line positions in region pixels: horizontal rows and the cell border.
 * @param {any} ctx @param {TemplateCell} cell @param {any} reg @param {number} inset
 */
function guideBands(ctx, cell, reg, inset) {
  const t = ctx.t;
  const toRow = (ymm) => (ymm - inset + MARGIN) * ctx.ppm;
  const toCol = (xmm) => (xmm - inset + MARGIN) * ctx.ppm;
  const rows = guideLines(t).map((g) => toRow(g.y));
  rows.push(toRow(0.4), toRow(cell.h - 0.4));
  const cols = [toCol(0.4), toCol(cell.w - 0.4)];
  return { rows, cols };
}

/**
 * Estimates the guide colour (density direction and strength) by sampling
 * the known guide line positions in a few cells.
 * @param {any} ctx @param {TemplateCell[]} cells
 */
function estimateGuide(ctx, cells) {
  const samples = [];
  const inkSamples = { dr: [], dg: [], db: [] };
  const cellStarts = [];
  const pick = cells.length <= 8 ? cells : Array.from({ length: 8 }, (_, i) => cells[Math.floor((i * cells.length) / 8)]);
  const t = ctx.t;
  for (const cell of pick) {
    const { reg, D } = cellDensities(ctx, cell, DEFAULT_INSET);
    const { rows } = guideBands(ctx, cell, reg, DEFAULT_INSET);
    const xStart = Math.round((t.cell.label.x + t.cell.label.w + 1 - DEFAULT_INSET + MARGIN) * ctx.ppm);
    const xEnd = reg.W - reg.m - 2;
    for (const r of rows.slice(0, -2)) {
      const y = Math.round(r - 0.5);
      for (let x = xStart; x < xEnd; x += 2) {
        let best = -1;
        let bi = -1;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= reg.H) continue;
          const i = yy * reg.W + x;
          const mag = D.dr[i] + D.dg[i] + D.db[i];
          if (mag > best) {
            best = mag;
            bi = i;
          }
        }
        if (bi >= 0) samples.push([D.dr[bi], D.dg[bi], D.db[bi]]);
      }
    }
    // keep the inner area densities for a page level ink colour estimate
    cellStarts.push(inkSamples.dr.length);
    for (let y = reg.m; y < reg.H - reg.m; y += 2) {
      for (let x = reg.m; x < reg.W - reg.m; x += 2) {
        const i = y * reg.W + x;
        inkSamples.dr.push(D.dr[i]);
        inkSamples.dg.push(D.dg[i]);
        inkSamples.db.push(D.db[i]);
      }
    }
  }
  let guide = null;
  let level = 0;
  if (samples.length > 20) {
    const mags = samples.map((s) => s[0] + s[1] + s[2]).sort((a, b) => a - b);
    const lo = mags[Math.floor(mags.length * 0.25)];
    const hi = mags[Math.floor(mags.length * 0.7)];
    const sum = [0, 0, 0];
    let n = 0;
    for (const s of samples) {
      const mg = s[0] + s[1] + s[2];
      if (mg < lo || mg > hi) continue;
      sum[0] += s[0];
      sum[1] += s[1];
      sum[2] += s[2];
      n++;
    }
    if (n) {
      const v = [sum[0] / n, sum[1] / n, sum[2] / n];
      level = Math.hypot(v[0], v[1], v[2]);
      if (level > 0.025) guide = v.map((c) => c / level);
    }
  }
  const D = {
    dr: Float32Array.from(inkSamples.dr),
    dg: Float32Array.from(inkSamples.dg),
    db: Float32Array.from(inkSamples.db),
  };
  const colorGuide = guide && angleBetween(guide, [1, 1, 1]) > 12 ? guide : null;
  const ink = estimateInkDirection(D, colorGuide);
  const dir = ink ? ink.dir : [0.577, 0.577, 0.577];
  // full strength of the pen: the darkest ink of each sampled cell (thick
  // spots such as crossings reach it even when thin lines are blurred)
  const kmax = Math.max(...dir);
  const peaks = [];
  cellStarts.push(D.dr.length);
  for (let c = 0; c + 1 < cellStarts.length; c++) {
    const vals = [];
    for (let i = cellStarts[c]; i < cellStarts[c + 1]; i++) vals.push((D.dr[i] * dir[0] + D.dg[i] * dir[1] + D.db[i] * dir[2]) * kmax);
    vals.sort((a, b) => b - a);
    const v = vals[Math.min(vals.length - 1, 8)];
    if (v > 0.15) peaks.push(v);
  }
  peaks.sort((a, b) => a - b);
  const pen = peaks.length ? peaks[Math.floor(peaks.length * 0.6)] : 0;
  return { guide: colorGuide, rawGuide: guide, level, ink: dir, pen };
}

/**
 * Width of a stroke (or dot) whose blurred peak reaches `ratio` of the full
 * ink strength.
 * @param {number} ratio @param {number} sigma @param {'stroke' | 'dot'} shape
 */
function widthFromPeak(ratio, sigma, shape) {
  if (shape === 'dot') return 2 * sigma * Math.sqrt(-2 * Math.log(1 - ratio));
  let lo = 0;
  let hi = 6;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (erf(mid) < ratio) lo = mid;
    else hi = mid;
  }
  return 2 * Math.SQRT2 * sigma * lo;
}

/**
 * Copy of a mask with only the components that look like the glyph: not
 * tiny and about as dark as the darkest component (faint shadow edges and
 * paper texture would bias stroke width estimates).
 * @param {Uint8Array} mask @param {Float32Array} ink @param {number} w @param {number} h @param {number} minArea
 */
function dominantMask(mask, ink, w, h, minArea) {
  const cc = components(mask, w, h, true);
  const sum = new Float64Array(cc.count + 1);
  for (let i = 0; i < w * h; i++) if (cc.labels[i]) sum[cc.labels[i]] += ink[i];
  let best = 0;
  for (let c = 1; c <= cc.count; c++) if (cc.areas[c - 1] >= minArea) best = Math.max(best, sum[c] / cc.areas[c - 1]);
  const keep = new Uint8Array(cc.count + 1);
  for (let c = 1; c <= cc.count; c++) keep[c] = cc.areas[c - 1] >= minArea && sum[c] / cc.areas[c - 1] >= best * 0.4 ? 1 : 0;
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = keep[cc.labels[i]];
  return out;
}

/**
 * Blur (Gaussian sigma) at a cell in processing pixels: the photo blur
 * measured at the markers, interpolated by inverse distance, scaled to the
 * processing resolution, plus the blur added by resampling.
 * @param {any} ctx @param {TemplateCell} cell
 */
function blurAt(ctx, cell) {
  const [x, y] = applyH(ctx.H, cell.x + cell.w / 2, cell.y + cell.h / 2);
  let sw = 0;
  let sb = 0;
  for (const m of ctx.markers) {
    const d = Math.hypot(m.center[0] - x, m.center[1] - y) + 1;
    const wt = 1 / (d * d);
    sw += wt;
    sb += wt * m.blur;
  }
  const photo = sw ? sb / sw : 0.7;
  const f = ctx.ppm / ctx.native;
  return Math.sqrt((photo * f) ** 2 + (0.35 * Math.max(f, 1)) ** 2);
}

/**
 * Processes one cell into a glyph.
 * @param {any} ctx @param {TemplateCell} cell @param {CellOptions} [opts]
 * @returns {ScannedGlyph & { debug?: any }}
 */
function processCell(ctx, cell, opts = {}) {
  const t = ctx.t;
  const inset = opts.inset ?? DEFAULT_INSET;
  const ppm = ctx.ppm;
  const { reg, D } = cellDensities(ctx, cell, inset);
  const { W, H: Hh, m } = reg;
  const warnings = [];
  const warn = (code, message) => warnings.push({ code, message, char: cell.char });

  // ink colour: this cell's own estimate when it has clear ink, else the page's
  let inkDir = ctx.guideInfo.ink;
  const own = estimateInkDirection(D, ctx.guideInfo.guide);
  if (own && own.strength > 0.2) inkDir = own.dir;
  let guideDir = ctx.guideInfo.guide;
  if (guideDir && angleBetween(guideDir, inkDir) < 14) guideDir = null;
  const { ink } = unmix(D, guideDir, inkDir);

  // guide bands: suppress whatever guide colour survives the unmixing (for
  // example chroma lost to JPEG subsampling or a gray printed sheet)
  const bands = guideBands(ctx, cell, reg, inset);
  const half = Math.max(1.2, 0.35 * ppm);
  const bandLevel = Math.max(0.06, ctx.guideInfo.level * (guideDir ? 0.6 : 1.6));
  const bandMask = new Uint8Array(W * Hh);
  for (const r of bands.rows) {
    const ya = Math.max(0, Math.floor(r - half));
    const yb = Math.min(Hh - 1, Math.ceil(r + half));
    for (let y = ya; y <= yb; y++) bandMask.fill(1, y * W, y * W + W);
  }
  for (const c of bands.cols) {
    const xa = Math.max(0, Math.floor(c - half));
    const xb = Math.min(W - 1, Math.ceil(c + half));
    for (let y = 0; y < Hh; y++) bandMask.fill(1, y * W + xa, y * W + xb + 1);
  }
  for (let i = 0; i < W * Hh; i++) if (bandMask[i] && ink[i] < bandLevel) ink[i] = 0;

  // printed reference character
  const lab = t.cell.label;
  const lx0 = Math.max(0, Math.floor((lab.x - 0.5 - inset + MARGIN) * ppm));
  const ly0 = Math.max(0, Math.floor((lab.y - 0.5 - inset + MARGIN) * ppm));
  const lx1 = Math.min(W - 1, Math.ceil((lab.x + lab.w + 0.5 - inset + MARGIN) * ppm));
  const ly1 = Math.min(Hh - 1, Math.ceil((lab.y + lab.h + 0.5 - inset + MARGIN) * ppm));
  for (let y = ly0; y <= ly1; y++) ink.fill(0, y * W + lx0, y * W + lx1 + 1);

  // binarize the whole region (context for Sauvola), keep the inner part.
  // First a lightly smoothed pass measures the stroke width; the blur model
  // turns it into the true pen width and the coverage level that puts the
  // threshold on the real stroke edge.
  const noise = noiseLevel(ink);
  // coloured ink lives partly in the chroma channels, which phone JPEGs keep
  // at half resolution: count that extra blur in proportion to the colour
  const chroma = Math.sin((angleBetween(inkDir, [1, 1, 1]) * Math.PI) / 180);
  const sigmaP = Math.hypot(blurAt(ctx, cell), chroma * 1.0 * (ppm / ctx.native));
  // grainy marks (pencil, rough paper, sensor noise) need more smoothing
  const roughPeak = quantile(ink, Math.max(0.5, 1 - 40 / ink.length), 0, 5, 4096);
  const roughSnr = roughPeak / Math.max(noise, 1e-3);
  const grainy = roughSnr < 9;
  const S0 = grainy ? 1.1 : Math.SQRT1_2;
  const smooth = gaussBlur(ink, W, Hh, S0);
  let sw = opts.strokeWidth ? opts.strokeWidth * ppm : 0.8 * ppm;
  const binOpts = { k: opts.k, window: opts.window, noise, sensitivity: opts.sensitivity };
  const first = binarizeInk(smooth, W, Hh, { ...binOpts, strokeWidth: sw, threshold: 0.5, noise: noiseLevel(smooth), sauvola: false });
  const dom = dominantMask(first.mask, smooth, W, Hh, Math.max(4, 0.15 * ppm * ppm));
  const domCC = components(dom, W, Hh, true);
  const shape = dotShare(dom, W, Hh, domCC) > 0.5 ? 'dot' : 'stroke';
  const observed = strokeWidth(dom, W, Hh, domCC);
  const sigma0 = Math.hypot(sigmaP, S0);
  let pen = observed > 0 ? trueWidth(observed, sigma0, shape) : 0;
  if (pen < 2.5 * sigma0 && ctx.guideInfo.pen > 1 && first.core > 0) {
    // the width barely constrains strokes close to the blur size; the drop
    // of their peak below the pen's full strength does. Only for dark pens:
    // pencil and faint ink vary in strength along the stroke.
    const ratio = (1 - Math.exp(-first.core)) / (1 - Math.exp(-ctx.guideInfo.pen));
    if (ratio < 0.97) pen = widthFromPeak(ratio, sigma0, shape);
  }
  if (!opts.strokeWidth && pen > 0) sw = Math.max(2, pen);
  // noisy photos: a little smoothing keeps thin strokes in one piece
  const noisy = grainy || first.core / Math.max(noise, 1e-3) < 25;
  const S1 = grainy ? 1.1 : noisy ? Math.SQRT1_2 : 0;
  const finalInk = noisy ? gaussBlur(ink, W, Hh, S1) : ink;
  const coverage = opts.threshold ?? coverageFor(pen, Math.hypot(sigmaP, S1), shape);
  const bin = binarizeInk(finalInk, W, Hh, { ...binOpts, strokeWidth: sw, threshold: coverage, noise: noisy ? noiseLevel(finalInk) : noise });
  const iw = W - 2 * m;
  const ih = Hh - 2 * m;
  const mask = new Uint8Array(iw * ih);
  for (let y = 0; y < ih; y++) mask.set(bin.mask.subarray((y + m) * W + m, (y + m) * W + m + iw), y * iw);

  const px2 = ppm * ppm;
  const minSpeck = Math.max(3, (opts.minSpeck ?? 0.06) * px2);
  const specks = despeckle(mask, iw, ih, minSpeck, 0.04 * px2);
  // drop fragments much fainter than the glyph that are small or sit on the
  // crop border: shadow edges, smudges, guide residue, a neighbour's tail
  let cc = components(mask, iw, ih, true);
  {
    const sum = new Float64Array(cc.count + 1);
    for (let y = 0; y < ih; y++) {
      for (let x = 0; x < iw; x++) {
        const l = cc.labels[y * iw + x];
        if (l) sum[l] += ink[(y + m) * W + x + m];
      }
    }
    let best = 0;
    let total = 0;
    for (let c = 1; c <= cc.count; c++) {
      best = Math.max(best, sum[c] / cc.areas[c - 1]);
      total += cc.areas[c - 1];
    }
    let dropped = 0;
    for (let c = 1; c <= cc.count; c++) {
      const [x0, y0, x1, y1] = cc.boxes[c - 1];
      const onBorder = x0 === 0 || y0 === 0 || x1 === iw - 1 || y1 === ih - 1;
      const faint = sum[c] / cc.areas[c - 1] < best * 0.3;
      if (faint && (onBorder || cc.areas[c - 1] < total * 0.2)) {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (cc.labels[y * iw + x] === c) mask[y * iw + x] = 0;
        dropped++;
      }
    }
    if (dropped) cc = components(mask, iw, ih, true);
  }
  let inkArea = 0;
  for (const a of cc.areas) inkArea += a;

  let touches = false;
  for (let x = 0; x < iw && !touches; x++) if (mask[x] || mask[(ih - 1) * iw + x]) touches = true;
  for (let y = 0; y < ih && !touches; y++) if (mask[y * iw] || mask[y * iw + iw - 1]) touches = true;
  // ink right next to the removed label box
  let labelTouch = false;
  const ilx1 = lx1 + 1 - m;
  const ily1 = ly1 + 1 - m;
  if (ilx1 >= 0 && ily1 >= 0) {
    for (let y = 0; y <= Math.min(ih - 1, ily1) && !labelTouch; y++) if (ilx1 < iw && mask[y * iw + ilx1]) labelTouch = true;
    for (let x = 0; x <= Math.min(iw - 1, ilx1) && !labelTouch; x++) if (ily1 < ih && mask[ily1 * iw + x]) labelTouch = true;
  }

  const contrast = bin.core;
  const stats = {
    coverage,
    inkArea: inkArea / px2,
    strokeWidth: sw / ppm,
    contrast,
    noise,
    specks,
    components: cc.count,
  };
  const name = glyphNameFor(cell.char);
  const unicodes = [/** @type {number} */ (cell.char.codePointAt(0))];
  const sb = Math.round(Math.max(25, Math.min(80, 0.1 * t.metrics.xHeight)));
  if (inkArea < Math.max(3, 0.02 * px2)) {
    warn('empty-cell', `No handwriting found in the box for "${cell.char}".`);
    return {
      char: cell.char, name, unicodes, contours: [], advanceWidth: Math.round(t.metrics.unitsPerEm * 0.5),
      leftSideBearing: 0, bbox: null, confidence: 0, warnings, empty: true, stats,
    };
  }

  // trace and map pixels of the inner crop to font units
  const upm = t.cell.unitsPerMm;
  // inner pixel x -> region pixel x + m -> cell mm inset - MARGIN + (x + m) / ppm
  const ox = inset - MARGIN + m / ppm - t.cell.pad;
  const oy = t.cell.baseline - (inset - MARGIN + m / ppm);
  const paths = traceMask(mask, iw, ih, { minArea: minSpeck });
  const map = (x, y) => /** @type {[number, number]} */ ([(x / ppm + ox) * upm, (oy - y / ppm) * upm]);
  const raw = pathsToContours(paths, map, { tolerance: 1, round: false });
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  for (const c of raw) {
    for (const p of c.points) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
  }
  const dx = sb - xMin;
  const contours = raw.map((c) => ({
    closed: true,
    points: c.points.map((p) => {
      const q = { x: Math.round(p.x + dx), y: Math.round(p.y), on: p.on };
      if (p.type) q.type = p.type;
      return q;
    }),
  }));
  const bbox = { xMin: Math.round(xMin + dx), yMin: Math.round(yMin), xMax: Math.round(xMax + dx), yMax: Math.round(yMax) };
  const advanceWidth = Math.round(bbox.xMax - bbox.xMin + 2 * sb);

  // confidence
  let conf = 1;
  if (contrast < 0.35) {
    conf *= 0.55 + contrast;
    if (contrast < 0.18) warn('faint', `The strokes of "${cell.char}" are very faint; write darker or rescan this cell with a lower threshold.`);
  }
  const snr = contrast / Math.max(noise, 1e-3);
  if (snr < 12) conf *= Math.max(0.4, snr / 12);
  if (touches) {
    conf *= 0.6;
    warn('touches-border', `The ink of "${cell.char}" touches the box border and may be cut off.`);
  }
  if (labelTouch) {
    conf *= 0.8;
    warn('label-overlap', `The ink of "${cell.char}" runs into the printed reference character.`);
  }
  if (cc.count > 6) {
    conf *= 0.8;
    warn('noisy', `The box of "${cell.char}" has ${cc.count} separate marks.`);
  }
  if (specks > 12) conf *= 0.9;
  const cls = verticalClass(cell.char);
  const xh = t.metrics.xHeight;
  if (cls.bottom === 'baseline' && cls.top !== 'mid' && (yMin > 0.25 * xh || yMin < -0.3 * xh)) {
    conf *= 0.85;
    warn('off-baseline', `"${cell.char}" does not sit on the baseline (bottom at ${Math.round(yMin)} units).`);
  }
  conf *= ctx.pageConfidence;
  return {
    char: cell.char, name, unicodes, contours, advanceWidth, leftSideBearing: sb, bbox, shiftX: dx,
    confidence: Math.round(Math.max(0, Math.min(1, conf)) * 100) / 100, warnings, empty: false, stats,
  };
}

/**
 * Locates the sheet in a photo and prepares the per cell context.
 * @param {any} input @param {{ template: any, page?: number, resolution?: number, ignoreSheetId?: boolean }} options
 */
export function prepareSheet(input, options) {
  const t = asLayout(options && options.template);
  const img = toRGBA(input);
  const warnings = [];
  const markers = findMarkers(img);
  if (markers.length < 2) {
    throw new ScanError('markers-not-found', `Found ${markers.length} of the 4 corner markers. Make sure the whole sheet is in the photo, flat and in focus.`);
  }
  if (markers.length < 4) {
    warnings.push({ code: 'few-markers', message: `Only ${markers.length} of 4 corner markers were found; the result may be slightly distorted.` });
  }
  const { H, error } = pageHomography(t, markers);
  // native resolution in pixels per mm around the page centre
  const native = localScale(H, t.width / 2, t.height / 2);
  if (native < 3) warnings.push({ code: 'low-resolution', message: `The sheet is only ${native.toFixed(1)} pixels per mm in the photo; move closer for cleaner outlines.` });
  const code = readPageCode(img, H, t);
  let page = options.page ?? 0;
  if (code) {
    if (code.id !== t.id && !options.ignoreSheetId) {
      throw new ScanError('sheet-mismatch', `This photo shows sheet ${code.id.toString(16).toUpperCase()} but the template is ${t.id.toString(16).toUpperCase()}. Use the template the sheet was printed from.`);
    }
    if (options.page === undefined) page = code.page;
  } else {
    warnings.push({ code: 'page-code-unreadable', message: `Could not read the page code; assuming page ${page + 1}.` });
  }
  if (!t.pages[page]) throw new ScanError('page-out-of-range', `The template has no page ${page + 1}.`);
  const ppm = Math.max(4, Math.min(options.resolution || 8, Math.max(5, native)));
  const samples = native > ppm * 1.6 ? 2 : 1;
  let pageConfidence = 1;
  if (markers.length === 3) pageConfidence *= 0.9;
  if (markers.length === 2) pageConfidence *= 0.7;
  const errMm = error / Math.max(native, 1e-6);
  if (errMm > 0.4) pageConfidence *= 0.85;
  if (native < 3) pageConfidence *= 0.85;
  const ctx = { t, img, H, ppm, samples, page, pageConfidence, guideInfo: null, markers, native };
  ctx.guideInfo = estimateGuide(ctx, t.pages[page].cells);
  if (!ctx.guideInfo.rawGuide) warnings.push({ code: 'no-guides', message: 'The cyan guide lines are not visible; they are removed by position instead of colour.' });
  return {
    ctx,
    warnings,
    info: {
      page, pageCount: t.pages.length, sheetId: code ? code.id : null, markers, homography: H,
      reprojectionError: error, pixelsPerMm: native, resolution: ppm,
    },
  };
}

/**
 * Scans a photo of a filled fontsketch sheet.
 *
 * @param {any} input ImageData, `{ width, height, data }` (RGBA, RGB or gray
 *   bytes) or, in browsers, an ImageBitmap, canvas or loaded image element
 * @param {{ template: any, page?: number, resolution?: number, chars?: string[], ignoreSheetId?: boolean } & CellOptions} options
 *   `template` is the object returned by `createTemplate` (or its `template`).
 *   `page` overrides the page read from the sheet code. `resolution` is the
 *   processing resolution in pixels per mm (default 8). `chars` limits the
 *   cells processed. Cell options apply to every cell.
 * @returns {{
 *   glyphs: Record<string, ScannedGlyph>, warnings: ScanWarning[], page: number, pageCount: number,
 *   sheetId: number | null, markers: import('./markers.mjs').Marker[], homography: number[],
 *   reprojectionError: number, pixelsPerMm: number, resolution: number,
 *   rescan: (char: string, options?: CellOptions) => ScannedGlyph,
 * }}
 */
export function scanSheet(input, options) {
  const { ctx, warnings, info } = prepareSheet(input, options);
  const glyphs = {};
  const only = options.chars ? new Set(options.chars) : null;
  const cellOpts = pickCellOptions(options);
  for (const cell of ctx.t.pages[ctx.page].cells) {
    if (only && !only.has(cell.char)) continue;
    const g = processCell(ctx, cell, cellOpts);
    glyphs[cell.char] = g;
    warnings.push(...g.warnings);
  }
  const result = {
    glyphs,
    warnings,
    ...info,
    /** @param {string} char @param {CellOptions} [opts] */
    rescan(char, opts = {}) {
      const cell = ctx.t.pages[ctx.page].cells.find((c) => c.char === char);
      if (!cell) throw new RangeError(`rescan: "${char}" is not on page ${ctx.page + 1}`);
      const g = processCell(ctx, cell, { ...cellOpts, ...opts });
      result.glyphs[char] = g;
      return g;
    },
  };
  Object.defineProperty(result, 'rescan', { enumerable: false });
  return result;
}

/**
 * Re-runs one cell of a previous `scanSheet` result with different options.
 * @param {ReturnType<typeof scanSheet>} result @param {string} char @param {CellOptions} [options]
 */
export function rescanCell(result, char, options) {
  return result.rescan(char, options);
}

/**
 * Scans several photos of one template (any order, any subset of pages) and
 * merges the glyphs. Pages that were not photographed are reported.
 * @param {any[]} inputs
 * @param {Parameters<typeof scanSheet>[1]} options
 */
export function scanSheets(inputs, options) {
  const glyphs = {};
  const warnings = [];
  const pages = [];
  for (const input of inputs) {
    const r = scanSheet(input, options);
    pages.push(r);
    Object.assign(glyphs, r.glyphs);
    warnings.push(...r.warnings.map((w) => ({ ...w, page: r.page })));
  }
  const t = asLayout(options.template);
  const seen = new Set(pages.map((p) => p.page));
  const missing = t.pages.map((p) => p.index).filter((i) => !seen.has(i));
  for (const i of missing) warnings.push({ code: 'missing-page', message: `Page ${i + 1} of ${t.pages.length} was not scanned.`, page: i });
  return { glyphs, warnings, pages, missingPages: missing };
}

/** @param {any} o */
function pickCellOptions(o) {
  const out = {};
  for (const k of ['threshold', 'sensitivity', 'k', 'window', 'minSpeck', 'inset', 'strokeWidth']) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

/**
 * Lower level: rectified, normalized ink maps and masks of every cell of a
 * page, before tracing. Useful for previews and custom processing.
 * @param {any} input
 * @param {{ template: any, page?: number, resolution?: number } & CellOptions} options
 * @returns {Array<{ cell: TemplateCell, width: number, height: number, ink: Float32Array, mask: Uint8Array, pixelsPerMm: number }>}
 */
export function segmentCells(input, options) {
  const { ctx } = prepareSheet(input, options);
  const inset = options.inset ?? DEFAULT_INSET;
  return ctx.t.pages[ctx.page].cells.map((cell) => {
    const { reg, D } = cellDensities(ctx, cell, inset);
    const { ink } = unmix(D, ctx.guideInfo.guide, ctx.guideInfo.ink);
    const { mask } = binarizeInk(ink, reg.W, reg.H, { strokeWidth: 0.8 * ctx.ppm, threshold: options.threshold });
    const iw = reg.W - 2 * reg.m;
    const ih = reg.H - 2 * reg.m;
    const innerInk = new Float32Array(iw * ih);
    const innerMask = new Uint8Array(iw * ih);
    for (let y = 0; y < ih; y++) {
      innerInk.set(ink.subarray((y + reg.m) * reg.W + reg.m, (y + reg.m) * reg.W + reg.m + iw), y * iw);
      innerMask.set(mask.subarray((y + reg.m) * reg.W + reg.m, (y + reg.m) * reg.W + reg.m + iw), y * iw);
    }
    return { cell, width: iw, height: ih, ink: innerInk, mask: innerMask, pixelsPerMm: ctx.ppm };
  });
}

export { ScanError, quantile };
