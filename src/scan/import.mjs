// Imports without a template: a photo of one drawn character or of a whole
// alphabet written on plain paper (segmented into rows and characters by
// projection profiles), and SVG artwork.

import { glyphNameFor } from '../core/model.mjs';
import { verticalClass } from './charsets.mjs';
import { median, toRGBA } from './image.mjs';
import { normalizeLighting } from './lighting.mjs';
import { binarizeInk, densities, despeckle, estimateInkDirection, strokeWidth, unmix } from './binarize.mjs';
import { cubicToQuads, pathsToContours, shoelace, traceMask } from './trace.mjs';

/** @typedef {import('../core/model.mjs').Contour} Contour */

const DEFAULT_METRICS = { unitsPerEm: 1000, ascender: 800, descender: -200, xHeight: 500, capHeight: 700 };

/**
 * Shrinks an RGBA image (area average) into float planes with the longest
 * side at most `maxSide`.
 * @param {import('./image.mjs').RGBAImage} img @param {number} maxSide
 */
function toPlanes(img, maxSide) {
  const { width: W, height: H, data } = img;
  const f = Math.max(1, Math.max(W, H) / maxSide);
  const w = Math.max(1, Math.round(W / f));
  const h = Math.max(1, Math.round(H / f));
  const r = new Float32Array(w * h);
  const g = new Float32Array(w * h);
  const b = new Float32Array(w * h);
  const n = new Float32Array(w * h);
  for (let y = 0; y < H; y++) {
    const oy = Math.min(h - 1, Math.floor((y * h) / H)) * w;
    for (let x = 0; x < W; x++) {
      const o = oy + Math.min(w - 1, Math.floor((x * w) / W));
      const i = (y * W + x) * 4;
      r[o] += data[i];
      g[o] += data[i + 1];
      b[o] += data[i + 2];
      n[o]++;
    }
  }
  for (let i = 0; i < w * h; i++) {
    r[i] /= n[i];
    g[i] /= n[i];
    b[i] /= n[i];
  }
  return { width: w, height: h, r, g, b, scale: W / w };
}

/**
 * Binarizes a photo of handwriting on plain paper: lighting normalization,
 * ink colour estimation, Sauvola plus half coverage thresholding, despeckle.
 * @param {any} input image (see `scanSheet`)
 * @param {{ maxSide?: number, window?: number, threshold?: number, sensitivity?: number, k?: number }} [options]
 *   `window` is the background window in pixels of the processed image; it
 *   must be wider than the thickest stroke (default a sixth of the short side).
 * @returns {{ mask: Uint8Array, ink: Float32Array, width: number, height: number, scale: number, strokeWidth: number }}
 *   `scale` is source pixels per processed pixel.
 */
export function binarize(input, options = {}) {
  const img = toRGBA(input);
  const planes = toPlanes(img, options.maxSide || 2000);
  const { width: w, height: h } = planes;
  const win = options.window || Math.max(15, Math.round(Math.min(w, h) / 6));
  const norm = normalizeLighting(planes, { window: win });
  const D = densities(norm);
  const est = estimateInkDirection(D, null);
  const { ink } = unmix(D, null, est ? est.dir : [0.577, 0.577, 0.577]);
  const opts = { threshold: options.threshold, sensitivity: options.sensitivity, k: options.k };
  let sw = Math.max(2, Math.min(w, h) / 150);
  let bin = binarizeInk(ink, w, h, { ...opts, strokeWidth: sw });
  const measured = strokeWidth(bin.mask, w, h);
  if (measured > 0 && (measured > sw * 1.4 || measured < sw / 1.4)) {
    sw = Math.max(2, measured);
    bin = binarizeInk(ink, w, h, { ...opts, strokeWidth: sw });
  }
  despeckle(bin.mask, w, h, Math.max(4, Math.round(sw * sw * 0.6)), Math.round(sw * sw * 0.3));
  return { mask: bin.mask, ink, width: w, height: h, scale: planes.scale, strokeWidth: sw };
}

/** Runs of values above `thr` in a profile, merging gaps shorter than `minGap`. */
function runs(profile, thr, minGap) {
  const out = [];
  let start = -1;
  for (let i = 0; i <= profile.length; i++) {
    const on = i < profile.length && profile[i] > thr;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      out.push([start, i - 1]);
      start = -1;
    }
  }
  const merged = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r[0] - last[1] - 1 < minGap) last[1] = r[1];
    else merged.push(r.slice());
  }
  return merged;
}

/**
 * Splits a binary mask into text rows and characters with projection
 * profiles. Thin rows (accents, i dots, punctuation above the line) are
 * merged into the row they belong to.
 * @param {Uint8Array} mask @param {number} w @param {number} h @param {number} sw stroke width in pixels
 * @returns {Array<{ y0: number, y1: number, items: Array<{ x0: number, y0: number, x1: number, y1: number }> }>}
 */
export function segmentRows(mask, w, h, sw) {
  const rowProf = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) s += mask[y * w + x];
    rowProf[y] = s;
  }
  let rows = runs(rowProf, 0, Math.max(1, Math.round(sw * 0.5)));
  if (!rows.length) return [];
  // merge thin bands into the closest neighbour (usually the row below)
  const heights = rows.map((r) => r[1] - r[0] + 1);
  const typical = median(heights.filter((v) => v > sw * 2)) || median(heights);
  let changed = true;
  while (changed && rows.length > 1) {
    changed = false;
    for (let i = 0; i < rows.length; i++) {
      const hgt = rows[i][1] - rows[i][0] + 1;
      if (hgt >= typical * 0.45) continue;
      const below = rows[i + 1];
      const above = rows[i - 1];
      const gapB = below ? below[0] - rows[i][1] : Infinity;
      const gapA = above ? rows[i][0] - above[1] : Infinity;
      // marks above the line belong to the row below unless that is far away
      const target = gapB <= Math.max(gapA, typical * 0.6) ? i + 1 : i - 1;
      if (!rows[target] || Math.min(gapA, gapB) > typical * 1.2) continue;
      const a = Math.min(rows[i][0], rows[target][0]);
      const b = Math.max(rows[i][1], rows[target][1]);
      rows[target] = [a, b];
      rows.splice(i, 1);
      changed = true;
      break;
    }
  }
  rows = rows.filter((r) => r[1] - r[0] + 1 >= Math.max(2, sw));
  return rows.map(([y0, y1]) => {
    const colProf = new Float32Array(w);
    for (let y = y0; y <= y1; y++) for (let x = 0; x < w; x++) colProf[x] += mask[y * w + x];
    const cols = runs(colProf, 0, Math.max(1, Math.round(sw * 0.6)));
    const items = [];
    for (const [x0, x1] of cols) {
      let iy0 = y1;
      let iy1 = y0;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (mask[y * w + x]) {
            if (y < iy0) iy0 = y;
            if (y > iy1) iy1 = y;
          }
        }
      }
      if (iy1 >= iy0) items.push({ x0, y0: iy0, x1, y1: iy1 });
    }
    return { y0, y1, items };
  });
}

function crop(mask, w, box, pad) {
  const cw = box.x1 - box.x0 + 1 + 2 * pad;
  const ch = box.y1 - box.y0 + 1 + 2 * pad;
  const out = new Uint8Array(cw * ch);
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) out[(y - box.y0 + pad) * cw + (x - box.x0 + pad)] = mask[y * w + x];
  }
  return { data: out, width: cw, height: ch };
}

const metricValue = (m, name) => (name === 'baseline' ? 0 : name === 'descender' ? m.descender : name === 'mid' ? m.xHeight / 2 : m[name]);

/**
 * Traces one character box into a placed glyph.
 * @param {Uint8Array} mask @param {number} w
 * @param {{ x0: number, y0: number, x1: number, y1: number }} box
 * @param {number} baseline pixel row of the baseline
 * @param {number} unitsPerPx
 * @param {number} sb side bearing in units
 */
function traceItem(mask, w, box, baseline, unitsPerPx, sb) {
  const pad = 2;
  const c = crop(mask, w, box, pad);
  const paths = traceMask(c.data, c.width, c.height, { minArea: 2 });
  const x0 = box.x0 - pad;
  const y0 = box.y0 - pad;
  const map = (x, y) => /** @type {[number, number]} */ ([(x + x0 - box.x0) * unitsPerPx + sb, (baseline - (y + y0)) * unitsPerPx]);
  const contours = pathsToContours(paths, map, { tolerance: 1 });
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const ct of contours) {
    for (const p of ct.points) {
      xMin = Math.min(xMin, p.x);
      xMax = Math.max(xMax, p.x);
      yMin = Math.min(yMin, p.y);
      yMax = Math.max(yMax, p.y);
    }
  }
  const dx = Number.isFinite(xMin) ? Math.round(sb - xMin) : 0;
  for (const ct of contours) for (const p of ct.points) p.x += dx;
  const bbox = Number.isFinite(xMin) ? { xMin: xMin + dx, yMin, xMax: xMax + dx, yMax } : null;
  return { contours, bbox, advanceWidth: bbox ? Math.round(bbox.xMax - bbox.xMin + 2 * sb) : 0, leftSideBearing: sb };
}

/**
 * Imports handwriting from a photo without a template.
 *
 * `mode: 'single'` treats all ink as one character (pass `char` to place it
 * on the right metric lines). `mode: 'alphabet'` (the default when the photo
 * has several marks) finds rows and characters by projection profiles; pass
 * `chars` to assign them in reading order, or assign later with
 * `assignChars`.
 *
 * @param {any} input image
 * @param {{
 *   mode?: 'auto' | 'single' | 'alphabet', char?: string, chars?: string | string[],
 *   metrics?: Partial<typeof DEFAULT_METRICS>, maxSide?: number, threshold?: number, sensitivity?: number,
 * }} [options]
 */
export function importImage(input, options = {}) {
  const m = { ...DEFAULT_METRICS, ...(options.metrics || {}) };
  const bin = binarize(input, options);
  const { mask, width: w, height: h, strokeWidth: sw } = bin;
  const sb = Math.round(Math.max(25, Math.min(80, 0.1 * m.xHeight)));
  const warnings = [];
  let rows = segmentRows(mask, w, h, sw);
  const itemCount = rows.reduce((s, r) => s + r.items.length, 0);
  const mode = options.mode && options.mode !== 'auto' ? options.mode : options.char || itemCount <= 1 ? 'single' : 'alphabet';
  if (!itemCount) {
    return { mode, items: [], rows: [], glyphs: {}, warnings: [{ code: 'empty', message: 'No handwriting found in the image.' }], strokeWidth: sw };
  }
  if (mode === 'single') {
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (const r of rows) {
      for (const it of r.items) {
        x0 = Math.min(x0, it.x0);
        y0 = Math.min(y0, it.y0);
        x1 = Math.max(x1, it.x1);
        y1 = Math.max(y1, it.y1);
      }
    }
    const cls = verticalClass(options.char || 'H');
    const top = metricValue(m, cls.top);
    const bottom = metricValue(m, cls.bottom);
    const unitsPerPx = (top - bottom) / Math.max(1, y1 - y0 + 1);
    const baseline = y1 + 1 + bottom / unitsPerPx;
    const g = traceItem(mask, w, { x0, y0, x1, y1 }, baseline, unitsPerPx, sb);
    const item = { index: 0, row: 0, box: scaleBox({ x0, y0, x1, y1 }, bin.scale), char: options.char, ...g };
    const glyphs = options.char ? { [options.char]: toGlyph(options.char, g) } : {};
    return { mode, items: [item], rows: [{ y0: y0 * bin.scale, y1: y1 * bin.scale, baseline: baseline * bin.scale }], glyphs, warnings, strokeWidth: sw * bin.scale };
  }

  const chars = options.chars === undefined ? null : Array.isArray(options.chars) ? options.chars : [...options.chars];
  if (chars && chars.length !== itemCount) {
    warnings.push({ code: 'count-mismatch', message: `Found ${itemCount} characters but ${chars.length} were given; assign them by hand with assignChars.` });
  }
  const items = [];
  const rowInfo = [];
  let k = 0;
  rows.forEach((r, ri) => {
    const known = r.items.map((it, j) => (chars && chars.length === itemCount ? chars[k + j] : null));
    // baseline: median bottom of characters that sit on it
    const bottoms = r.items
      .map((it, j) => ({ b: it.y1 + 1, c: known[j] }))
      .filter((v) => !v.c || verticalClass(v.c).bottom === 'baseline')
      .map((v) => v.b);
    const baseline = median(bottoms.length ? bottoms : r.items.map((it) => it.y1 + 1));
    // scale: known characters vote with their expected top, otherwise the
    // tall characters of the row are taken as cap height
    const votes = [];
    r.items.forEach((it, j) => {
      const c = known[j];
      if (!c) return;
      const cls = verticalClass(c);
      if (cls.bottom !== 'baseline' || cls.top === 'mid') return;
      const hgt = baseline - it.y0;
      if (hgt > 0) votes.push(metricValue(m, cls.top) / hgt);
    });
    let unitsPerPx = median(votes);
    if (!Number.isFinite(unitsPerPx)) {
      const hs = r.items.map((it) => baseline - it.y0).filter((v) => v > 0).sort((a, b) => a - b);
      const tall = hs[Math.min(hs.length - 1, Math.floor(hs.length * 0.8))] || 1;
      unitsPerPx = m.capHeight / tall;
    }
    rowInfo.push({ y0: r.y0 * bin.scale, y1: r.y1 * bin.scale, baseline: baseline * bin.scale, unitsPerPx: unitsPerPx / bin.scale });
    r.items.forEach((it, j) => {
      const g = traceItem(mask, w, it, baseline, unitsPerPx, sb);
      items.push({ index: k + j, row: ri, box: scaleBox(it, bin.scale), char: known[j] || undefined, ...g });
    });
    k += r.items.length;
  });
  const glyphs = {};
  for (const it of items) if (it.char) glyphs[it.char] = toGlyph(it.char, it);
  return { mode, items, rows: rowInfo, glyphs, warnings, strokeWidth: sw * bin.scale };
}

function scaleBox(b, s) {
  return { x: b.x0 * s, y: b.y0 * s, width: (b.x1 - b.x0 + 1) * s, height: (b.y1 - b.y0 + 1) * s };
}

function toGlyph(char, g) {
  return {
    char, name: glyphNameFor(char), unicodes: [/** @type {number} */ (char.codePointAt(0))],
    contours: g.contours, advanceWidth: g.advanceWidth, leftSideBearing: g.leftSideBearing, bbox: g.bbox,
  };
}

/**
 * Assigns characters to the items of an `importImage` result (reading
 * order), returning glyphs keyed by character. `null` or `''` skips an item.
 * @param {ReturnType<typeof importImage>} result @param {Array<string | null> | string} chars
 */
export function assignChars(result, chars) {
  const list = Array.isArray(chars) ? chars : [...chars];
  const glyphs = {};
  result.items.forEach((it, i) => {
    const c = list[i];
    if (!c) return;
    it.char = c;
    glyphs[c] = toGlyph(c, it);
  });
  result.glyphs = glyphs;
  return glyphs;
}

// ---- SVG -----------------------------------------------------------------

/** @typedef {number[]} Affine [a, b, c, d, e, f] like SVG matrix() */

const mulA = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

/** Parses an SVG transform attribute. @param {string} text @returns {Affine} */
export function parseTransform(text) {
  let m = [1, 0, 0, 1, 0, 0];
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let t;
  while ((t = re.exec(text || ''))) {
    const v = t[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let n = [1, 0, 0, 1, 0, 0];
    if (t[1] === 'matrix' && v.length === 6) n = v;
    else if (t[1] === 'translate') n = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
    else if (t[1] === 'scale') n = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else if (t[1] === 'rotate') {
      const a = ((v[0] || 0) * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      n = [c, s, -s, c, 0, 0];
      if (v.length === 3) n = mulA(mulA([1, 0, 0, 1, v[1], v[2]], n), [1, 0, 0, 1, -v[1], -v[2]]);
    } else if (t[1] === 'skewX') n = [1, 0, Math.tan(((v[0] || 0) * Math.PI) / 180), 1, 0, 0];
    else if (t[1] === 'skewY') n = [1, Math.tan(((v[0] || 0) * Math.PI) / 180), 0, 1, 0, 0];
    m = mulA(m, n);
  }
  return m;
}

function attrs(text) {
  const out = {};
  const re = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let a;
  while ((a = re.exec(text))) out[a[1]] = a[3] ?? a[4];
  // style="fill: none; fill-rule: evenodd" overrides attributes
  if (out.style) {
    for (const decl of out.style.split(';')) {
      const [k, v] = decl.split(':').map((s) => s && s.trim());
      if (k && v) out[k] = v;
    }
  }
  return out;
}

/**
 * Parses SVG path data into subpaths of absolute segments. Arcs become
 * cubics. Each subpath: `{ start: [x, y], segs: Array<['L', x, y] | ['Q', x1, y1, x, y] | ['C', x1, y1, x2, y2, x, y]>, closed }`.
 * @param {string} d
 */
export function parsePathData(d) {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  const subs = [];
  let cur = null;
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let cmd = '';
  let lastC = null;
  let lastQ = null;
  let i = 0;
  const num = () => Number(tokens[i++]);
  const isNum = () => i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i]);
  const ensure = () => {
    if (!cur) {
      cur = { start: [x, y], segs: [], closed: false };
      subs.push(cur);
    }
  };
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) {
      i++;
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'Z') {
      if (cur) {
        cur.closed = true;
        x = sx;
        y = sy;
      }
      cur = null;
      lastC = lastQ = null;
      if (!isNum()) continue;
      continue;
    }
    if (!isNum()) continue;
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (C === 'M') {
      x = ox + num();
      y = oy + num();
      sx = x;
      sy = y;
      cur = { start: [x, y], segs: [], closed: false };
      subs.push(cur);
      cmd = rel ? 'l' : 'L';
      lastC = lastQ = null;
      continue;
    }
    ensure();
    if (C === 'L') {
      x = ox + num();
      y = oy + num();
      cur.segs.push(['L', x, y]);
      lastC = lastQ = null;
    } else if (C === 'H') {
      x = ox + num();
      cur.segs.push(['L', x, y]);
      lastC = lastQ = null;
    } else if (C === 'V') {
      y = oy + num();
      cur.segs.push(['L', x, y]);
      lastC = lastQ = null;
    } else if (C === 'C' || C === 'S') {
      let x1;
      let y1;
      if (C === 'C') {
        x1 = ox + num();
        y1 = oy + num();
      } else {
        x1 = lastC ? 2 * x - lastC[0] : x;
        y1 = lastC ? 2 * y - lastC[1] : y;
      }
      const x2 = ox + num();
      const y2 = oy + num();
      x = ox + num();
      y = oy + num();
      cur.segs.push(['C', x1, y1, x2, y2, x, y]);
      lastC = [x2, y2];
      lastQ = null;
    } else if (C === 'Q' || C === 'T') {
      let x1;
      let y1;
      if (C === 'Q') {
        x1 = ox + num();
        y1 = oy + num();
      } else {
        x1 = lastQ ? 2 * x - lastQ[0] : x;
        y1 = lastQ ? 2 * y - lastQ[1] : y;
      }
      x = ox + num();
      y = oy + num();
      cur.segs.push(['Q', x1, y1, x, y]);
      lastQ = [x1, y1];
      lastC = null;
    } else if (C === 'A') {
      const rx = num();
      const ry = num();
      const rot = num();
      const large = num();
      const sweep = num();
      const ex = ox + num();
      const ey = oy + num();
      for (const c of arcToCubics(x, y, rx, ry, rot, large, sweep, ex, ey)) cur.segs.push(['C', ...c]);
      x = ex;
      y = ey;
      lastC = lastQ = null;
    } else i++;
  }
  return subs;
}

/** SVG elliptical arc (endpoint form) to cubic segments. */
function arcToCubics(x1, y1, rx, ry, rotDeg, large, sweep, x2, y2) {
  if (!rx || !ry) return [[x1, y1, x2, y2, x2, y2]];
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (rotDeg * Math.PI) / 180;
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy;
  const y1p = -sp * dx + cp * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) co = -co;
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2;
  const cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.ceil(Math.abs(dt) / (Math.PI / 2));
  const out = [];
  const step = dt / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const pt = (t) => [cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp];
  const dv = (t) => [-rx * Math.sin(t) * cp - ry * Math.cos(t) * sp, -rx * Math.sin(t) * sp + ry * Math.cos(t) * cp];
  for (let i = 0; i < n; i++) {
    const a = t1 + i * step;
    const b = a + step;
    const p0 = pt(a);
    const p3 = i === n - 1 ? [x2, y2] : pt(b);
    const d0 = dv(a);
    const d3 = dv(b);
    out.push([p0[0] + k * d0[0], p0[1] + k * d0[1], p3[0] - k * d3[0], p3[1] - k * d3[1], p3[0], p3[1]]);
  }
  return out;
}

const n4 = (v) => (v === undefined ? 0 : parseFloat(v) || 0);

/** Basic shapes as path data. */
function shapeToPath(tag, a) {
  if (tag === 'path') return a.d || '';
  if (tag === 'rect') {
    const x = n4(a.x);
    const y = n4(a.y);
    const w = n4(a.width);
    const h = n4(a.height);
    let rx = a.rx !== undefined ? n4(a.rx) : n4(a.ry);
    let ry = a.ry !== undefined ? n4(a.ry) : rx;
    rx = Math.min(rx, w / 2);
    ry = Math.min(ry, h / 2);
    if (!rx || !ry) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
    return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}` +
      `H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
  }
  if (tag === 'circle' || tag === 'ellipse') {
    const cx = n4(a.cx);
    const cy = n4(a.cy);
    const rx = tag === 'circle' ? n4(a.r) : n4(a.rx);
    const ry = tag === 'circle' ? n4(a.r) : n4(a.ry);
    return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
  }
  if (tag === 'polygon' || tag === 'polyline') {
    const v = (a.points || '').split(/[\s,]+/).filter(Boolean).map(Number);
    if (v.length < 4) return '';
    let d = `M${v[0]} ${v[1]}`;
    for (let i = 2; i + 1 < v.length; i += 2) d += `L${v[i]} ${v[i + 1]}`;
    return d + 'Z';
  }
  return '';
}

/** Point in polygon (even odd) for nesting depth. */
function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/**
 * Imports filled SVG artwork as a glyph. Supports path (all commands,
 * arcs included), rect, circle, ellipse, polygon and polyline, nested
 * groups and transforms. Stroke only shapes are skipped with a warning.
 *
 * Placement (`fit`): `'viewBox'` maps the viewBox height onto the em box
 * (top at the ascender, bottom at the descender), `'capHeight'` (default
 * without a viewBox) scales the artwork to the cap height on the baseline,
 * `'xHeight'` likewise, or pass `{ scale, dx, dy }` (units per SVG unit
 * and offsets in font units).
 * @param {string} svg
 * @param {{ char?: string, fit?: 'viewBox' | 'capHeight' | 'xHeight' | { scale: number, dx?: number, dy?: number }, metrics?: Partial<typeof DEFAULT_METRICS>, sideBearing?: number }} [options]
 */
export function importSvg(svg, options = {}) {
  const m = { ...DEFAULT_METRICS, ...(options.metrics || {}) };
  const warnings = [];
  const stack = [{ m: [1, 0, 0, 1, 0, 0], fill: 'black', rule: 'nonzero' }];
  let viewBox = null;
  const shapes = [];
  const re = /<\s*(\/?)\s*([a-zA-Z]+)([^>]*?)(\/?)\s*>/g;
  let t;
  const clean = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<(defs|clipPath|mask|symbol|style|title|desc|metadata)\b[\s\S]*?<\/\1>/g, '');
  while ((t = re.exec(clean))) {
    const [, closing, tagRaw, rest, selfClose] = t;
    const tag = tagRaw.toLowerCase();
    if (closing) {
      if ((tag === 'g' || tag === 'svg' || tag === 'a') && stack.length > 1) stack.pop();
      continue;
    }
    const a = attrs(rest);
    const top = stack[stack.length - 1];
    const state = {
      m: mulA(top.m, parseTransform(a.transform)),
      fill: a.fill ?? top.fill,
      rule: a['fill-rule'] ?? top.rule,
    };
    if (tag === 'svg') {
      if (!viewBox && a.viewBox) {
        const v = a.viewBox.split(/[\s,]+/).map(Number);
        if (v.length === 4) viewBox = v;
      }
      if (!selfClose) stack.push({ ...state, m: top.m });
      continue;
    }
    if (tag === 'g' || tag === 'a') {
      if (!selfClose) stack.push(state);
      continue;
    }
    const d = shapeToPath(tag, a);
    if (!d) continue;
    if (state.fill === 'none' || state.fill === 'transparent') {
      warnings.push({ code: 'stroke-ignored', message: `A <${tag}> without fill was skipped; convert strokes to outlines first.` });
      continue;
    }
    if (tag === 'polyline') warnings.push({ code: 'polyline-closed', message: 'A <polyline> was closed to make a filled shape.' });
    shapes.push({ subs: parsePathData(d), m: state.m, rule: state.rule });
  }
  // flatten to absolute points with transforms
  const tx = (mm, x, y) => [mm[0] * x + mm[2] * y + mm[4], mm[1] * x + mm[3] * y + mm[5]];
  const raw = [];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const sh of shapes) {
    for (const sub of sh.subs) {
      if (!sub.segs.length) continue;
      const start = tx(sh.m, sub.start[0], sub.start[1]);
      const segs = sub.segs.map((s) => {
        const pts = [];
        for (let i = 1; i < s.length; i += 2) pts.push(tx(sh.m, s[i], s[i + 1]));
        return { type: s[0], pts };
      });
      for (const p of [start, ...segs.flatMap((s) => s.pts)]) {
        x0 = Math.min(x0, p[0]);
        y0 = Math.min(y0, p[1]);
        x1 = Math.max(x1, p[0]);
        y1 = Math.max(y1, p[1]);
      }
      raw.push({ start, segs, rule: sh.rule });
    }
  }
  if (!raw.length) {
    warnings.push({ code: 'empty', message: 'The SVG has no filled shapes.' });
    return { contours: [], advanceWidth: 0, leftSideBearing: 0, bbox: null, warnings };
  }
  const fit = options.fit || (viewBox ? 'viewBox' : 'capHeight');
  let scale;
  let dy;
  if (typeof fit === 'object') {
    scale = fit.scale;
    dy = fit.dy || 0;
  } else if (fit === 'viewBox' && viewBox) {
    scale = (m.ascender - m.descender) / viewBox[3];
    dy = m.ascender + viewBox[1] * scale; // y_font = dy - y_svg * scale
  } else {
    const target = fit === 'xHeight' ? m.xHeight : m.capHeight;
    scale = target / Math.max(1e-9, y1 - y0);
    dy = y1 * scale;
  }
  const sb = options.sideBearing ?? Math.round(Math.max(25, Math.min(80, 0.1 * m.xHeight)));
  const dx = typeof fit === 'object' && fit.dx !== undefined ? fit.dx : sb - x0 * scale;
  const map = (p) => [p[0] * scale + dx, dy - p[1] * scale];
  const contours = [];
  const polys = [];
  for (const r of raw) {
    const pts = [];
    let cur = map(r.start);
    pts.push({ x: cur[0], y: cur[1], on: true });
    const poly = [cur];
    for (const s of r.segs) {
      const P = s.pts.map(map);
      if (s.type === 'L') {
        pts.push({ x: P[0][0], y: P[0][1], on: true });
      } else if (s.type === 'Q') {
        pts.push({ x: P[0][0], y: P[0][1], on: false }, { x: P[1][0], y: P[1][1], on: true });
      } else {
        for (const q of cubicToQuads(cur, P[0], P[1], P[2], 0.5)) pts.push(q);
        pts.push({ x: P[2][0], y: P[2][1], on: true });
      }
      cur = P[P.length - 1];
      poly.push(...P);
    }
    const last = pts[pts.length - 1];
    if (pts.length > 1 && last.on && Math.abs(last.x - pts[0].x) < 1e-6 && Math.abs(last.y - pts[0].y) < 1e-6) pts.pop();
    if (pts.length < 3) continue;
    const rounded = pts.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), on: p.on }));
    contours.push({ closed: true, points: rounded, rule: r.rule });
    polys.push(poly);
  }
  // directions: even odd shapes by nesting depth; nonzero keeps relative
  // directions and only makes the outermost contour clockwise
  const out = [];
  let biggest = -1;
  let bigArea = 0;
  contours.forEach((c, i) => {
    const area = Math.abs(shoelace(c.points));
    if (area > bigArea) {
      bigArea = area;
      biggest = i;
    }
  });
  const flipAll = biggest >= 0 && shoelace(contours[biggest].points) > 0;
  contours.forEach((c, i) => {
    let pts = c.points;
    if (c.rule === 'evenodd') {
      let depth = 0;
      polys.forEach((p, j) => {
        if (j !== i && inside(polys[i][0], p)) depth++;
      });
      const wantCW = depth % 2 === 0;
      if ((shoelace(pts) < 0) !== wantCW) pts = pts.slice().reverse();
    } else if (flipAll) pts = pts.slice().reverse();
    const s = pts.findIndex((p) => p.on);
    if (s > 0) pts = pts.slice(s).concat(pts.slice(0, s));
    out.push({ closed: true, points: pts });
  });
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (const c of out) {
    for (const p of c.points) {
      bx0 = Math.min(bx0, p.x);
      by0 = Math.min(by0, p.y);
      bx1 = Math.max(bx1, p.x);
      by1 = Math.max(by1, p.y);
    }
  }
  const bbox = { xMin: bx0, yMin: by0, xMax: bx1, yMax: by1 };
  const advanceWidth = Math.round(bx1 + sb);
  const result = { contours: out, advanceWidth, leftSideBearing: bx0, bbox, warnings };
  if (options.char) {
    Object.assign(result, { char: options.char, name: glyphNameFor(options.char), unicodes: [options.char.codePointAt(0)] });
  }
  return result;
}
