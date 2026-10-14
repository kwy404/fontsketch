// Synthetic phone photos of filled handwriting sheets, for robustness tests.
//
// A small single stroke "handwriting" font (centre lines in font units, Y up)
// is drawn into the template cells with a round pen of a chosen colour and
// width; the flat sheet is then photographed by a virtual camera: random
// perspective and rotation, gradient light, a soft shadow, colour cast,
// defocus blur, chroma subsampling like JPEG and sensor noise. The stroke
// geometry is the ground truth that recovered outlines are compared with.

import { findHomography, invertH } from '../src/scan/homography.mjs';
import { pageShapes } from '../src/scan/template.mjs';
import { gaussBlur } from '../src/scan/image.mjs';

// ---- deterministic random numbers -----------------------------------------

/** Mulberry32 generator. @param {number} seed */
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.gauss = () => {
    const u = next() || 1e-9;
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return next;
}

// ---- stroke font -----------------------------------------------------------

const arc = (cx, cy, rx, ry, a0, a1) => {
  const n = Math.max(3, Math.ceil(Math.abs(a1 - a0) / 7));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
};
const P = (...v) => {
  const out = [];
  for (let i = 0; i < v.length; i += 2) out.push([v[i], v[i + 1]]);
  return out;
};
const dot = (x, y) => [[x, y], [x + 1, y + 4]];

/** @type {Record<string, Array<Array<[number, number]>>>} */
const BASE = {
  a: [arc(200, 250, 150, 240, 0, 360), P(350, 500, 350, 0)],
  b: [P(60, 740, 60, 0), arc(210, 250, 150, 250, 0, 360)],
  c: [arc(230, 250, 180, 250, 40, 320)],
  d: [arc(200, 250, 150, 250, 0, 360), P(350, 740, 350, 0)],
  e: [[...P(60, 250, 400, 250), ...arc(230, 250, 170, 250, 0, 320)]],
  f: [[...arc(310, 620, 100, 120, 20, 180), [210, 0]], P(90, 470, 330, 470)],
  g: [arc(200, 250, 150, 240, 0, 360), [[350, 500], [350, -80], ...arc(200, -80, 150, 120, 0, -150)]],
  h: [P(60, 740, 60, 0), [[60, 320], ...arc(210, 320, 150, 170, 180, 0), [360, 0]]],
  i: [P(80, 500, 80, 0), dot(80, 640)],
  j: [[[240, 500], [240, -80], ...arc(120, -80, 120, 120, 0, -160)], dot(240, 640)],
  k: [P(60, 740, 60, 0), P(340, 500, 60, 200), P(160, 290, 360, 0)],
  l: [P(80, 740, 80, 0)],
  m: [P(60, 500, 60, 0), [[60, 330], ...arc(170, 330, 110, 160, 180, 0), [280, 0]], [[280, 330], ...arc(390, 330, 110, 160, 180, 0), [500, 0]]],
  n: [P(60, 500, 60, 0), [[60, 320], ...arc(210, 320, 150, 170, 180, 0), [360, 0]]],
  o: [arc(220, 250, 170, 250, 0, 360)],
  p: [P(60, 500, 60, -200), arc(210, 250, 150, 250, 0, 360)],
  q: [arc(200, 250, 150, 250, 0, 360), P(350, 500, 350, -200)],
  r: [P(60, 500, 60, 0), [[60, 300], ...arc(220, 300, 160, 190, 180, 60)]],
  s: [[...arc(200, 375, 140, 125, 20, 270), ...arc(200, 125, 140, 125, 90, -160)]],
  t: [[[170, 700], [170, 60], ...arc(250, 60, 80, 60, 180, 300)], P(60, 500, 320, 500)],
  u: [[[60, 500], [60, 180], ...arc(210, 180, 150, 180, 180, 360)], P(360, 500, 360, 0)],
  v: [P(40, 500, 210, 0, 380, 500)],
  w: [P(30, 500, 150, 0, 280, 380, 410, 0, 530, 500)],
  x: [P(50, 500, 370, 0), P(370, 500, 50, 0)],
  y: [P(40, 500, 210, 0), P(380, 500, 120, -200)],
  z: [P(60, 500, 360, 500, 60, 0, 370, 0)],
  A: [P(40, 0, 270, 700, 500, 0), P(120, 240, 420, 240)],
  B: [P(70, 0, 70, 700), [[70, 700], [300, 700], ...arc(300, 530, 130, 170, 90, -90), [70, 360]], [[70, 360], [330, 360], ...arc(330, 180, 150, 180, 90, -90), [70, 0]]],
  C: [arc(340, 350, 280, 350, 45, 315)],
  D: [P(70, 0, 70, 700), [[70, 700], [250, 700], ...arc(250, 350, 260, 350, 90, -90), [70, 0]]],
  E: [P(400, 700, 70, 700, 70, 0, 400, 0), P(70, 360, 340, 360)],
  F: [P(400, 700, 70, 700, 70, 0), P(70, 360, 330, 360)],
  G: [[...arc(340, 350, 280, 350, 45, 340), [603, 330], [420, 330]]],
  H: [P(70, 0, 70, 700), P(470, 0, 470, 700), P(70, 360, 470, 360)],
  I: [P(80, 0, 80, 700)],
  J: [[[380, 700], [380, 200], ...arc(220, 200, 160, 200, 0, -180)]],
  K: [P(70, 0, 70, 700), P(450, 700, 70, 260), P(200, 400, 470, 0)],
  L: [P(70, 700, 70, 0, 400, 0)],
  M: [P(60, 0, 60, 700, 300, 200, 540, 700, 540, 0)],
  N: [P(70, 0, 70, 700, 470, 0, 470, 700)],
  O: [arc(330, 350, 270, 350, 0, 360)],
  P: [P(70, 0, 70, 700), [[70, 700], [280, 700], ...arc(280, 520, 170, 180, 90, -90), [70, 340]]],
  Q: [arc(330, 350, 270, 350, 0, 360), P(380, 160, 580, -40)],
  R: [P(70, 0, 70, 700), [[70, 700], [280, 700], ...arc(280, 520, 170, 180, 90, -90), [70, 340]], P(260, 340, 460, 0)],
  S: [[...arc(260, 525, 200, 175, 25, 270), ...arc(260, 175, 210, 175, 90, -160)]],
  T: [P(30, 700, 530, 700), P(280, 700, 280, 0)],
  U: [[[70, 700], [70, 250], ...arc(290, 250, 220, 250, 180, 360), [510, 700]]],
  V: [P(30, 700, 270, 0, 510, 700)],
  W: [P(30, 700, 180, 0, 350, 560, 520, 0, 670, 700)],
  X: [P(50, 700, 480, 0), P(480, 700, 50, 0)],
  Y: [P(40, 700, 270, 360, 500, 700), P(270, 360, 270, 0)],
  Z: [P(60, 700, 480, 700, 60, 0, 490, 0)],
  0: [arc(250, 350, 200, 350, 0, 360)],
  1: [P(120, 560, 260, 700, 260, 0)],
  2: [[...arc(250, 510, 190, 190, 160, -30), [60, 0], [440, 0]]],
  3: [arc(240, 530, 180, 170, 150, -90), arc(240, 190, 200, 190, 90, -150)],
  4: [P(360, 0, 360, 700, 40, 220, 470, 220)],
  5: [[[420, 700], [110, 700], [95, 390], ...arc(250, 230, 200, 230, 130, -150)]],
  6: [arc(260, 350, 200, 350, 75, 195), arc(250, 220, 190, 220, 0, 360)],
  7: [P(50, 700, 450, 700, 170, 0)],
  8: [arc(250, 530, 160, 170, 0, 360), arc(250, 180, 200, 180, 0, 360)],
  9: [arc(250, 480, 190, 220, 0, 360), [[440, 480], [440, 250], ...arc(250, 250, 190, 250, 0, -120)]],
  '.': [dot(80, 30)],
  ',': [P(90, 40, 50, -120)],
  '!': [P(80, 700, 80, 200), dot(80, 30)],
  '?': [[...arc(220, 520, 170, 180, 160, -60), [260, 250], [260, 180]], dot(260, 30)],
  '-': [P(60, 280, 320, 280)],
  '(': [arc(330, 270, 250, 520, 120, 240)],
  ')': [arc(-10, 270, 250, 520, 60, -60)],
  "'": [P(80, 720, 80, 520)],
  ':': [dot(80, 420), dot(80, 30)],
  ';': [dot(90, 420), P(90, 40, 50, -120)],
  '/': [P(20, -100, 340, 740)],
  '"': [P(70, 720, 70, 520), P(190, 720, 190, 520)],
};

function width(strokes) {
  let max = 0;
  for (const s of strokes) for (const [x] of s) max = Math.max(max, x);
  return max;
}

const MARKS = {
  '́': (cx, y) => [P(cx - 40, y, cx + 60, y + 120)],
  '̀': (cx, y) => [P(cx - 60, y + 120, cx + 40, y)],
  '̂': (cx, y) => [P(cx - 90, y, cx, y + 110, cx + 90, y)],
  '̃': (cx, y) => [Array.from({ length: 13 }, (_, i) => [cx - 100 + (200 * i) / 12, y + 50 + 40 * Math.sin((2 * Math.PI * i) / 12)])],
  '̈': (cx, y) => [dot(cx - 70, y + 50), dot(cx + 70, y + 50)],
  '̧': (cx) => [P(cx, 10, cx + 25, -70, cx - 40, -130)],
};

/**
 * Center line strokes of a character in font units, or null if unknown.
 * @param {string} ch
 * @returns {Array<Array<[number, number]>> | null}
 */
export function strokesFor(ch) {
  if (BASE[ch]) return BASE[ch].map((s) => s.map((p) => [p[0], p[1]]));
  const [base, mark] = ch.normalize('NFD');
  if (!BASE[base] || !MARKS[mark]) return null;
  const strokes = BASE[base].map((s) => s.map((p) => [p[0], p[1]]));
  const cap = /[A-Z]/.test(base);
  const cx = width(BASE[base]) / 2 + 20;
  const top = base === 'i' ? 580 : cap ? 780 : 590;
  return strokes.concat(MARKS[mark](cx, top));
}

/** Characters the stroke font can draw. */
export const DRAWABLE = Object.keys(BASE).concat(
  [...'áàâãéêíóôõúüçÁÃÉÊÓÔÚÇ'],
);

// ---- rasterization ---------------------------------------------------------

/**
 * Coverage (0 to 1) of round pen strokes on a pixel grid, as the max over
 * segments. `toPx` maps font units to pixel coordinates (continuous).
 * @param {Float32Array} cov @param {number} w @param {number} h
 * @param {Array<Array<[number, number]>>} strokes
 * @param {(x: number, y: number) => [number, number]} toPx
 * @param {number} radius pen radius in pixels
 * @param {number[]} [box] grown to the touched pixel bounds `[x0, y0, x1, y1]`
 */
export function strokeCoverage(cov, w, h, strokes, toPx, radius, box) {
  for (const s of strokes) {
    const pts = s.map(([x, y]) => toPx(x, y));
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[Math.min(i + 1, pts.length - 1)];
      if (i > 0 && i === pts.length - 1) break;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - radius - 2));
      const x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0]) + radius + 2));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - radius - 2));
      const y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1]) + radius + 2));
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy;
      const lim2 = (radius + 0.5) * (radius + 0.5);
      if (box) {
        box[0] = Math.min(box[0], x0);
        box[1] = Math.min(box[1], y0);
        box[2] = Math.max(box[2], x1);
        box[3] = Math.max(box[3], y1);
      }
      for (let y = y0; y <= y1; y++) {
        const py = y + 0.5;
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5;
          let t = len2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / len2 : 0;
          if (t < 0) t = 0;
          else if (t > 1) t = 1;
          const ex = px - a[0] - t * dx;
          const ey = py - a[1] - t * dy;
          const d2 = ex * ex + ey * ey;
          if (d2 >= lim2) continue;
          const c = radius + 0.5 - Math.sqrt(d2);
          if (c <= 0) continue;
          const v = c >= 1 ? 1 : c;
          const o = y * w + x;
          if (v > cov[o]) cov[o] = v;
        }
      }
    }
  }
}

/** Filled mask of quadratic contours (nonzero winding) on a grid. */
export function fillContours(contours, w, h, toPx) {
  const edges = [];
  for (const c of contours) {
    const pts = c.points;
    const n = pts.length;
    const poly = [];
    // expand implied on curve points, flatten quadratics
    const start = pts.findIndex((p) => p.on);
    const seq = pts.slice(start).concat(pts.slice(0, start));
    let prev = seq[0];
    poly.push(toPx(prev.x, prev.y));
    for (let i = 1; i <= n; i++) {
      const p = seq[i % n];
      if (p.on) {
        poly.push(toPx(p.x, p.y));
        prev = p;
      } else {
        const nx = seq[(i + 1) % n];
        const end = nx.on ? nx : { x: (p.x + nx.x) / 2, y: (p.y + nx.y) / 2 };
        for (let k = 1; k <= 8; k++) {
          const t = k / 8;
          const u = 1 - t;
          poly.push(toPx(u * u * prev.x + 2 * u * t * p.x + t * t * end.x, u * u * prev.y + 2 * u * t * p.y + t * t * end.y));
        }
        prev = end;
        if (nx.on) i++;
      }
    }
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (a[1] !== b[1]) edges.push(a[1] < b[1] ? [a[0], a[1], b[0], b[1], 1] : [b[0], b[1], a[0], a[1], -1]);
    }
  }
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const py = y + 0.5;
    const xs = [];
    for (const [x0, y0, x1, y1, dir] of edges) {
      if (py < y0 || py >= y1) continue;
      xs.push([x0 + ((py - y0) / (y1 - y0)) * (x1 - x0), dir]);
    }
    xs.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i][1];
      if (!wind) continue;
      const xa = Math.max(0, Math.ceil(xs[i][0] - 0.5));
      const xb = Math.min(w - 1, Math.floor(xs[i + 1][0] - 0.5));
      for (let x = xa; x <= xb; x++) mask[y * w + x] = 1;
    }
  }
  return mask;
}

/**
 * Intersection over union between recovered contours and the ground truth
 * strokes, both in font units. The ground truth (in cell units) is moved by
 * the shift the scanner applied to place the glyph. Vertical placement is
 * checked strictly (the baseline comes from the template); horizontally the
 * best offset within `slack` units is used, because where a character sits
 * across its box does not matter for a font (glyphs are re-spaced by their
 * side bearings).
 * @param {import('../src/core/model.mjs').Contour[]} contours
 * @param {Array<Array<[number, number]>>} strokes ground truth centre lines
 * @param {number} penUnits pen width in font units
 * @param {number} shift the glyph's `shiftX`
 * @param {number} [slack] horizontal tolerance in font units (default 48, about 1 mm)
 */
export function glyphIoU(contours, strokes, penUnits, shift, slack = 48) {
  const gt = strokes.map((s) => s.map(([x, y]) => [x + shift, y]));
  const S = 4; // units per pixel
  const X0 = -300;
  const Y0 = -500;
  const w = 1400 / S;
  const h = 1600 / S;
  const toPx = (x, y) => [(x - X0) / S, (Y0 + 1600 - y) / S];
  const cov = new Float32Array(w * h);
  strokeCoverage(cov, w, h, gt, toPx, penUnits / 2 / S);
  const mine = fillContours(contours, w, h, toPx);
  let gtArea = 0;
  let mineArea = 0;
  for (let i = 0; i < w * h; i++) {
    if (cov[i] >= 0.5) gtArea++;
    if (mine[i]) mineArea++;
  }
  if (!gtArea && !mineArea) return 0;
  let best = 0;
  const k = Math.round(slack / S);
  for (let d = -k; d <= k; d++) {
    let inter = 0;
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = Math.max(0, -d); x < Math.min(w, w - d); x++) if (mine[o + x] && cov[o + x + d] >= 0.5) inter++;
    }
    best = Math.max(best, inter / (gtArea + mineArea - inter));
  }
  return best;
}

// ---- sheet and photo -------------------------------------------------------

/** Ink presets: transmittance per channel at full coverage. */
export const INKS = {
  black: { t: [0.1, 0.1, 0.12] },
  blue: { t: [0.16, 0.26, 0.66] },
  red: { t: [0.78, 0.14, 0.16] },
  green: { t: [0.2, 0.52, 0.3] },
  purple: { t: [0.42, 0.18, 0.55] },
  pencil: { t: [0.58, 0.58, 0.6], grain: 0.35 },
  marker: { t: [0.07, 0.07, 0.09] },
};

/**
 * Renders a filled sheet flat (no camera yet).
 * @param {import('../src/scan/layout.mjs').TemplateLayout} t
 * @param {number} page
 * @param {{ R?: number, ink?: keyof INKS | { t: number[], grain?: number }, pen?: number, seed?: number, skip?: Set<string>, override?: Record<string, Array<Array<[number, number]>>> }} opts
 *   `pen` is the pen width in mm; `skip` leaves cells empty; `override`
 *   draws other strokes (font units) in the named cells.
 * @returns {{ width: number, height: number, r: Float32Array, g: Float32Array, b: Float32Array, R: number, truth: Record<string, { strokes: Array<Array<[number, number]>>, pen: number }> }}
 */
export function renderSheet(t, page, opts = {}) {
  const R = opts.R || 8;
  const rand = rng(opts.seed || 1);
  const W = Math.round(t.width * R);
  const H = Math.round(t.height * R);
  const paper = [rand.range(238, 250), rand.range(236, 248), rand.range(228, 244)];
  const r = new Float32Array(W * H).fill(paper[0]);
  const g = new Float32Array(W * H).fill(paper[1]);
  const b = new Float32Array(W * H).fill(paper[2]);
  const cov = new Float32Array(W * H);
  let box = [W, H, -1, -1];
  const apply = (trans, grain) => {
    for (let y = Math.max(0, box[1]); y <= Math.min(H - 1, box[3]); y++) {
      for (let x = Math.max(0, box[0]); x <= Math.min(W - 1, box[2]); x++) {
        const i = y * W + x;
        let c = cov[i];
        if (!c) continue;
        if (grain) c *= 1 - grain * rand();
        r[i] *= 1 - c * (1 - trans[0]);
        g[i] *= 1 - c * (1 - trans[1]);
        b[i] *= 1 - c * (1 - trans[2]);
        cov[i] = 0;
      }
    }
    box = [W, H, -1, -1];
  };
  // printed template
  for (const s of pageShapes(t, page)) {
    if (s.t === 'rect' && s.fill && s.w >= t.width) continue;
    if (s.t === 'rect' && s.fill) {
      const x0 = Math.round(s.x * R);
      const y0 = Math.round(s.y * R);
      const x1 = Math.round((s.x + s.w) * R);
      const y1 = Math.round((s.y + s.h) * R);
      for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) cov[y * W + x] = 1;
      box = [x0, y0, x1, y1];
      if (s.fill[0] === 255) {
        // white cut out on the printed black: back to paper
        for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
          for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
            const i = y * W + x;
            r[i] = paper[0];
            g[i] = paper[1];
            b[i] = paper[2];
            cov[i] = 0;
          }
        }
        box = [W, H, -1, -1];
      } else apply(s.fill.map((v) => Math.max(0.03, v / 255)), 0);
    } else if (s.t === 'rect' && s.stroke) {
      const lines = [[s.x, s.y, s.x + s.w, s.y], [s.x + s.w, s.y, s.x + s.w, s.y + s.h], [s.x + s.w, s.y + s.h, s.x, s.y + s.h], [s.x, s.y + s.h, s.x, s.y]];
      strokeCoverage(cov, W, H, lines.map(([a, bb, c, d]) => [[a, bb], [c, d]]), (x, y) => [x * R, y * R], ((s.sw || 0.2) * R) / 2, box);
      apply(s.stroke.map((v) => v / 255), 0);
    } else if (s.t === 'line') {
      const segs = [];
      const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      if (s.dash) {
        let pos = 0;
        let on = true;
        let k = 0;
        while (pos < len) {
          const d = s.dash[k % s.dash.length];
          const e = Math.min(len, pos + d);
          if (on) segs.push([[s.x1 + ((s.x2 - s.x1) * pos) / len, s.y1 + ((s.y2 - s.y1) * pos) / len], [s.x1 + ((s.x2 - s.x1) * e) / len, s.y1 + ((s.y2 - s.y1) * e) / len]]);
          pos = e;
          on = !on;
          k++;
        }
      } else segs.push([[s.x1, s.y1], [s.x2, s.y2]]);
      strokeCoverage(cov, W, H, segs, (x, y) => [x * R, y * R], (s.sw * R) / 2, box);
      apply(s.stroke.map((v) => v / 255), 0);
    } else if (s.t === 'text') {
      // printed text drawn with the stroke font (cap height about 0.7 size)
      const sc = s.size / 1000;
      let x = s.x - (s.anchor === 'middle' ? (s.text.length * 0.55 * s.size) / 2 : 0);
      for (const ch of s.text) {
        const st = strokesFor(ch) || strokesFor(ch.toLowerCase());
        if (st) {
          const ox = x;
          strokeCoverage(cov, W, H, st, (gx, gy) => [(ox + gx * sc) * R, (s.y - gy * sc) * R], Math.max(0.6, 0.08 * s.size * R) / 2, box);
        }
        x += 0.55 * s.size;
      }
      apply(s.fill.map((v) => Math.max(0.05, v / 255)), 0);
    }
  }
  // handwriting
  const ink = typeof opts.ink === 'object' ? opts.ink : INKS[opts.ink || 'black'];
  const pen = opts.pen || 0.6;
  const truth = {};
  const upm = t.cell.unitsPerMm;
  for (const cell of t.pages[page].cells) {
    if (opts.skip && opts.skip.has(cell.char)) continue;
    const st = (opts.override && opts.override[cell.char]) || strokesFor(cell.char);
    if (!st) continue;
    // natural variation: slant, size, horizontal position (in font units)
    const slant = rand.range(-0.12, 0.12);
    const scale = rand.range(0.9, 1.05);
    const gw = width(st);
    const room = (cell.w - 2 * t.cell.pad) * upm - gw * scale;
    const ox = Math.max(0, room) * rand.range(0.4, 0.65);
    const strokes = st.map((s) => s.map(([x, y]) => [ox + (x + slant * y) * scale, y * scale]));
    const penUnits = pen * upm;
    truth[cell.char] = { strokes, pen: penUnits };
    const toPx = (x, y) => [(cell.x + t.cell.pad + x / upm) * R, (cell.y + t.cell.baseline - y / upm) * R];
    strokeCoverage(cov, W, H, strokes, toPx, (pen * R) / 2, box);
    apply(ink.t, ink.grain || 0);
  }
  return { width: W, height: H, r, g, b, R, truth };
}

/**
 * Photographs a flat sheet with a virtual phone camera.
 * @param {ReturnType<typeof renderSheet>} sheet
 * @param {{
 *   seed?: number, width?: number, height?: number, rotate?: number, perspective?: number, fill?: number,
 *   gradient?: number, shadow?: number, tint?: number[], blur?: number, blurRamp?: boolean, chroma?: boolean, noise?: number,
 *   curl?: number,
 * }} o
 *   `curl` displaces the middle of the sheet by up to that many millimetres
 *   (paper that is not flat) while the corners stay put.
 * @returns {{ width: number, height: number, data: Uint8ClampedArray, H: number[] }}
 */
export function photograph(sheet, o = {}) {
  const rand = rng(o.seed || 7);
  const PW = o.width || 2400;
  const PH = o.height || 1800;
  const { width: SW, height: SH, R } = sheet;
  // where the sheet lands: rotated, scaled to fill, corners jittered
  const ang = ((o.rotate || 0) * Math.PI) / 180;
  const fill = o.fill || 0.85;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const bw = Math.abs(SW * cos) + Math.abs(SH * sin);
  const bh = Math.abs(SW * sin) + Math.abs(SH * cos);
  const sc = Math.min((PW * fill) / bw, (PH * fill) / bh);
  const cx = PW / 2 + rand.range(-0.03, 0.03) * PW;
  const cy = PH / 2 + rand.range(-0.03, 0.03) * PH;
  const src = [[0, 0], [SW, 0], [SW, SH], [0, SH]];
  const persp = o.perspective || 0;
  const dst = src.map(([x, y]) => {
    const dx = (x - SW / 2) * sc;
    const dy = (y - SH / 2) * sc;
    return [
      cx + dx * cos - dy * sin + rand.range(-persp, persp) * SW * sc,
      cy + dx * sin + dy * cos + rand.range(-persp, persp) * SH * sc,
    ];
  });
  const Hs = findHomography(src, dst);
  const Hi = invertH(Hs);
  const n = PW * PH;
  const pr = new Float32Array(n);
  const pg = new Float32Array(n);
  const pb = new Float32Array(n);
  const samples = sc < 0.8 ? 2 : 1;
  const curl = o.curl || 0;
  const curlAngle = rand.range(0, Math.PI * 2);
  const curlX = curl * R * Math.cos(curlAngle);
  const curlY = curl * R * Math.sin(curlAngle);
  const table = [rand.range(60, 120), rand.range(50, 95), rand.range(35, 70)];
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let inside = 0;
      for (let j = 0; j < samples; j++) {
        for (let i = 0; i < samples; i++) {
          const qx = x + (i + 0.5) / samples;
          const qy = y + (j + 0.5) / samples;
          const qw = Hi[6] * qx + Hi[7] * qy + Hi[8];
          let u = (Hi[0] * qx + Hi[1] * qy + Hi[2]) / qw;
          let v = (Hi[3] * qx + Hi[4] * qy + Hi[5]) / qw;
          if (curl) {
            // a sheet that bulges in the middle: zero at the edges and corners
            const bump = Math.sin((Math.PI * u) / SW) * Math.sin((Math.PI * v) / SH);
            if (bump > 0) {
              u += curlX * bump;
              v += curlY * bump;
            }
          }
          if (u < 0 || v < 0 || u >= SW || v >= SH) continue;
          const fx = Math.min(SW - 1.001, Math.max(0, u - 0.5));
          const fy = Math.min(SH - 1.001, Math.max(0, v - 0.5));
          const x0 = fx | 0;
          const y0 = fy | 0;
          const ax = fx - x0;
          const ay = fy - y0;
          const k = y0 * SW + x0;
          const w00 = (1 - ax) * (1 - ay);
          const w10 = ax * (1 - ay);
          const w01 = (1 - ax) * ay;
          const w11 = ax * ay;
          sr += sheet.r[k] * w00 + sheet.r[k + 1] * w10 + sheet.r[k + SW] * w01 + sheet.r[k + SW + 1] * w11;
          sg += sheet.g[k] * w00 + sheet.g[k + 1] * w10 + sheet.g[k + SW] * w01 + sheet.g[k + SW + 1] * w11;
          sb += sheet.b[k] * w00 + sheet.b[k + 1] * w10 + sheet.b[k + SW] * w01 + sheet.b[k + SW + 1] * w11;
          inside++;
        }
      }
      const o2 = y * PW + x;
      const tot = samples * samples;
      const wood = 0.85 + 0.15 * Math.sin(y * 0.05 + Math.sin(x * 0.01) * 3);
      pr[o2] = (sr + (tot - inside) * table[0] * wood) / tot;
      pg[o2] = (sg + (tot - inside) * table[1] * wood) / tot;
      pb[o2] = (sb + (tot - inside) * table[2] * wood) / tot;
    }
  }
  // light: gradient, vignette, colour cast and a soft shadow
  const grad = o.gradient || 0;
  const gdir = rand.range(0, Math.PI * 2);
  const tint = o.tint || [1, 1, 1];
  const shadow = o.shadow || 0;
  const sdir = rand.range(0, Math.PI * 2);
  const soff = rand.range(-0.15, 0.25) * Math.min(PW, PH);
  const ssoft = rand.range(4, 40);
  const gc = Math.cos(gdir);
  const gs = Math.sin(gdir);
  const sc2 = Math.cos(sdir);
  const ss2 = Math.sin(sdir);
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      const nx = (x - PW / 2) / PW;
      const ny = (y - PH / 2) / PH;
      let L = 1 - grad * (0.5 + nx * gc + ny * gs);
      L *= 1 - 0.25 * (nx * nx + ny * ny);
      if (shadow) {
        const d = (x - PW / 2) * sc2 + (y - PH / 2) * ss2 - soff;
        const s = d <= -ssoft ? 1 : d >= ssoft ? 0 : 0.5 - (0.5 * d) / ssoft;
        L *= 1 - shadow * s;
      }
      const i = y * PW + x;
      pr[i] *= L * tint[0];
      pg[i] *= L * tint[1];
      pb[i] *= L * tint[2];
    }
  }
  // optics: defocus (optionally stronger on one side)
  let R1 = pr;
  let G1 = pg;
  let B1 = pb;
  if (o.blur) {
    const br = gaussBlur(pr, PW, PH, o.blur);
    const bg = gaussBlur(pg, PW, PH, o.blur);
    const bb = gaussBlur(pb, PW, PH, o.blur);
    if (o.blurRamp) {
      for (let y = 0; y < PH; y++) {
        for (let x = 0; x < PW; x++) {
          const a = Math.min(1, Math.max(0, x / PW));
          const i = y * PW + x;
          pr[i] = pr[i] * (1 - a) + br[i] * a;
          pg[i] = pg[i] * (1 - a) + bg[i] * a;
          pb[i] = pb[i] * (1 - a) + bb[i] * a;
        }
      }
    } else {
      R1 = br;
      G1 = bg;
      B1 = bb;
    }
  }
  // chroma subsampling like JPEG 4:2:0
  if (o.chroma) {
    const Y = new Float32Array(n);
    const Cb = new Float32Array(n);
    const Cr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      Y[i] = 0.299 * R1[i] + 0.587 * G1[i] + 0.114 * B1[i];
      Cb[i] = B1[i] - Y[i];
      Cr[i] = R1[i] - Y[i];
    }
    const cb = gaussBlur(Cb, PW, PH, 1.2);
    const cr = gaussBlur(Cr, PW, PH, 1.2);
    R1 = new Float32Array(n);
    G1 = new Float32Array(n);
    B1 = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      R1[i] = Y[i] + cr[i];
      B1[i] = Y[i] + cb[i];
      G1[i] = (Y[i] - 0.299 * R1[i] - 0.114 * B1[i]) / 0.587;
    }
  }
  const data = new Uint8ClampedArray(n * 4);
  const sigma = o.noise || 0;
  // a table of normal deviates walked with a random stride keeps this fast
  const gaussTable = new Float32Array(65536);
  for (let i = 0; i < gaussTable.length; i++) gaussTable[i] = sigma * rand.gauss();
  let k = 0;
  const stride = 2 * rand.int(1000, 30000) + 1;
  for (let i = 0; i < n; i++) {
    data[i * 4] = R1[i] + gaussTable[(k += stride) & 65535];
    data[i * 4 + 1] = G1[i] + gaussTable[(k += stride) & 65535];
    data[i * 4 + 2] = B1[i] + gaussTable[(k += stride) & 65535];
    data[i * 4 + 3] = 255;
  }
  // H maps sheet pixels to photo pixels; expose it in page millimetres too
  return { width: PW, height: PH, data, H: Hs, R };
}

/**
 * A photo of handwriting on plain paper (no template): rows of characters
 * drawn with the stroke font, gradient light and noise.
 * @param {string[]} rows one string per text row
 * @param {{ seed?: number, pen?: number, ink?: keyof INKS, size?: number, width?: number, height?: number, noise?: number }} [o]
 *   `size` is pixels per 1000 font units; `pen` is in font units.
 * @returns {{ width: number, height: number, data: Uint8ClampedArray, boxes: Array<{ char: string, x0: number, x1: number, baseline: number }> }}
 */
export function plainPhoto(rows, o = {}) {
  const rand = rng(o.seed || 3);
  const W = o.width || 1400;
  const H = o.height || 900;
  const size = o.size || 110;
  const sc = size / 1000;
  const pen = o.pen || 60;
  const ink = INKS[o.ink || 'blue'];
  const cov = new Float32Array(W * H);
  const boxes = [];
  rows.forEach((row, ri) => {
    const baseline = 80 + (ri + 1) * size * 1.6;
    let x = 60;
    for (const ch of row) {
      const st = strokesFor(ch);
      if (!st) {
        x += 0.4 * size;
        continue;
      }
      const gw = width(st);
      const ox = x;
      strokeCoverage(cov, W, H, st, (gx, gy) => [ox + gx * sc, baseline - gy * sc], (pen * sc) / 2);
      boxes.push({ char: ch, x0: ox, x1: ox + gw * sc, baseline });
      x += gw * sc + size * 0.35 + rand.range(0, size * 0.1);
    }
  });
  const data = new Uint8ClampedArray(W * H * 4);
  const noise = o.noise ?? 3;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const L = 0.75 + 0.25 * (x / W) - 0.1 * (y / H);
      const c = cov[i];
      for (let k = 0; k < 3; k++) {
        const paper = [246, 242, 232][k] * L;
        data[i * 4 + k] = paper * (1 - c * (1 - ink.t[k])) + noise * rand.gauss();
      }
      data[i * 4 + 3] = 255;
    }
  }
  return { width: W, height: H, data, boxes };
}

/**
 * Randomized photo conditions for robustness tests (deterministic per seed).
 * @param {number} seed
 */
export function randomCase(seed) {
  const r = rng(seed * 7919 + 13);
  const inkName = r.pick(['black', 'blue', 'blue', 'red', 'green', 'purple', 'pencil', 'pencil', 'marker', 'black']);
  const pen = inkName === 'pencil' ? r.range(0.4, 0.6) : inkName === 'marker' ? r.range(1.6, 2.4) : r.range(0.5, 1.1);
  const landscape = r() < 0.5;
  const long = r.int(2000, 3200);
  const short = Math.round(long * 0.75);
  const chars = [];
  const pool = DRAWABLE.slice();
  for (let i = 0; i < 18; i++) chars.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
  const photo = {
    seed: seed + 100, width: landscape ? long : short, height: landscape ? short : long,
    rotate: r.range(-15, 15) + (r() < 0.1 ? 180 : 0), perspective: r.range(0, 0.08), fill: r.range(0.7, 0.95),
    gradient: r.range(0, 0.6), shadow: r() < 0.5 ? r.range(0.2, 0.55) : 0,
    tint: r() < 0.5 ? [1, r.range(0.88, 1), r.range(0.72, 1)] : [r.range(0.85, 1), r.range(0.92, 1), 1],
    blur: r.range(0.3, 1.6), blurRamp: r() < 0.3, chroma: r() < 0.7, noise: r.range(1, 7),
  };
  const pageSize = r() < 0.5 ? 'A4' : 'Letter';
  const cols = r.int(5, 7);
  // drawn last so earlier draws (and the cases they define) stay the same
  photo.curl = r() < 0.35 ? r.range(0.5, 1.6) : 0;
  return { seed, inkName, pen, chars: chars.join(''), photo, pageSize, cols };
}
