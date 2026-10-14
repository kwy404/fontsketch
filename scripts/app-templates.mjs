// Generates the starter fonts offered by the editor's Templates panel:
// geometric display, rounded, monospace and an icon font. Every letter is a
// skeleton (centre lines) stroked with the core engine, so the three text
// styles share one design and differ in weight, caps and proportions.
// Output: docs/app/templates/<id>.fontsketch.json
// Usage: node scripts/app-templates.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contourArea, fitContour, removeOverlaps, reverseContour, roundContours, strokeToOutline } from '../src/core/geometry.mjs';
import * as model from '../src/core/model.mjs';
import * as coreIndex from '../src/core/index.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'docs', 'app', 'templates');
mkdirSync(outDir, { recursive: true });

// ---------- Skeleton helpers (centre lines, font units, Y up) ----------

const H = 700; // cap height
const X = 500; // x-height
const ASC = 740;
const DESC = -210;
const rad = (d) => (d * Math.PI) / 180;

/** Points along an elliptical arc from a0 to a1 degrees. */
function arc(cx, cy, rx, ry, a0, a1, step = 6) {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / n);
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}
/** An open polyline from points and arcs. */
const P = (...parts) => ({ pts: parts.flatMap((p) => (Array.isArray(p[0]) ? p : [p])), closed: false });
const L = (...pts) => ({ pts, closed: false });
const E = (cx, cy, rx, ry) => ({ pts: arc(cx, cy, rx, ry, 90, -270, 5).slice(0, -1), closed: true });
const DOT = (x, y) => ({ pts: [[x, y], [x, y + 0.5]], closed: false, dot: true });

/**
 * Glyph skeletons: [width of the centre line drawing, strokes, kind].
 * kind 'u' maps vertically against the cap height, 'l' against the x-height.
 */
const S = {
  A: [560, [L([0, 0], [280, H], [560, 0]), L([92, 230], [468, 230])], 'u'],
  B: [440, [L([0, 0], [0, H]), P([0, H], [270, H], arc(270, 525, 175, 175, 90, -90), [0, 350]), P([0, 350], [265, 350], arc(265, 175, 175, 175, 90, -90), [0, 0])], 'u'],
  C: [600, [P(arc(300, 350, 300, 350, 42, 318))], 'u'],
  D: [560, [L([0, 0], [0, H]), P([0, H], [210, H], arc(210, 350, 350, 350, 90, -90), [0, 0])], 'u'],
  E: [420, [L([420, H], [0, H], [0, 0], [420, 0]), L([0, 350], [360, 350])], 'u'],
  F: [400, [L([400, H], [0, H], [0, 0]), L([0, 350], [340, 350])], 'u'],
  G: [620, [P(arc(310, 350, 310, 350, 42, 360), [340, 350])], 'u'],
  H: [520, [L([0, 0], [0, H]), L([520, 0], [520, H]), L([0, 350], [520, 350])], 'u'],
  I: [0, [L([0, 0], [0, H])], 'u'],
  J: [380, [P([380, H], [380, 210], arc(190, 210, 190, 210, 0, -180))], 'u'],
  K: [480, [L([0, 0], [0, H]), L([480, H], [0, 250]), L([150, 390], [480, 0])], 'u'],
  L: [400, [L([0, H], [0, 0], [400, 0])], 'u'],
  M: [640, [L([0, 0], [0, H], [320, 170], [640, H], [640, 0])], 'u'],
  N: [540, [L([0, 0], [0, H], [540, 0], [540, H])], 'u'],
  O: [660, [E(330, 350, 330, 350)], 'u'],
  P: [440, [L([0, 0], [0, H]), P([0, H], [230, H], arc(230, 505, 195, 195, 90, -90), [0, 310])], 'u'],
  Q: [660, [E(330, 350, 330, 350), L([420, 170], [640, -40])], 'u'],
  R: [470, [L([0, 0], [0, H]), P([0, H], [250, H], arc(250, 505, 195, 195, 90, -90), [0, 310]), L([230, 310], [470, 0])], 'u'],
  S: [480, [P(arc(240, 525, 230, 175, 25, 270), arc(240, 175, 240, 175, 90, -155))], 'u'],
  T: [500, [L([0, H], [500, H]), L([250, H], [250, 0])], 'u'],
  U: [520, [P([0, H], [0, 260], arc(260, 260, 260, 260, 180, 360), [520, H])], 'u'],
  V: [560, [L([0, H], [280, 0], [560, H])], 'u'],
  W: [820, [L([0, H], [205, 0], [410, 520], [615, 0], [820, H])], 'u'],
  X: [520, [L([0, H], [520, 0]), L([0, 0], [520, H])], 'u'],
  Y: [540, [L([0, H], [270, 320], [540, H]), L([270, 320], [270, 0])], 'u'],
  Z: [480, [L([0, H], [480, H], [0, 0], [480, 0])], 'u'],

  a: [500, [E(250, 250, 250, 250), L([500, X], [500, 0])], 'l'],
  b: [500, [L([0, ASC], [0, 0]), E(250, 250, 250, 250)], 'l'],
  c: [480, [P(arc(250, 250, 250, 250, 42, 318))], 'l'],
  d: [500, [E(250, 250, 250, 250), L([500, ASC], [500, 0])], 'l'],
  e: [500, [P([0, 250], [500, 250], arc(250, 250, 250, 250, 0, 322))], 'l'],
  f: [360, [P(arc(240, 610, 130, 130, 15, 180), [110, 0]), L([0, X], [300, X])], 'l'],
  g: [500, [E(250, 250, 250, 250), P([500, X], [500, -40], arc(250, -40, 250, 170, 0, -175))], 'l'],
  h: [440, [L([0, ASC], [0, 0]), P([0, 280], arc(220, 280, 220, 220, 180, 0), [440, 0])], 'l'],
  i: [0, [L([0, 0], [0, X]), DOT(0, 690)], 'l'],
  j: [210, [P([210, X], [210, -60], arc(60, -60, 150, 150, 0, -150)), DOT(210, 690)], 'l'],
  k: [400, [L([0, ASC], [0, 0]), L([390, X], [0, 170]), L([130, 280], [410, 0])], 'l'],
  l: [0, [L([0, ASC], [0, 0])], 'l'],
  m: [680, [L([0, X], [0, 0]), P([0, 300], arc(170, 300, 170, 200, 180, 0), [340, 0]), P([340, 300], arc(510, 300, 170, 200, 180, 0), [680, 0])], 'l'],
  n: [440, [L([0, X], [0, 0]), P([0, 280], arc(220, 280, 220, 220, 180, 0), [440, 0])], 'l'],
  o: [500, [E(250, 250, 250, 250)], 'l'],
  p: [500, [L([0, X], [0, DESC]), E(250, 250, 250, 250)], 'l'],
  q: [500, [E(250, 250, 250, 250), L([500, X], [500, DESC])], 'l'],
  r: [300, [L([0, X], [0, 0]), P([0, 270], arc(220, 270, 220, 230, 180, 70))], 'l'],
  s: [400, [P(arc(200, 375, 190, 125, 25, 270), arc(200, 125, 200, 125, 90, -155))], 'l'],
  t: [320, [P([110, 680], [110, 120], arc(230, 120, 120, 120, 180, 300)), L([0, X], [300, X])], 'l'],
  u: [440, [P([0, X], [0, 220], arc(220, 220, 220, 220, 180, 360)), L([440, X], [440, 0])], 'l'],
  v: [440, [L([0, X], [220, 0], [440, X])], 'l'],
  w: [680, [L([0, X], [170, 0], [340, 380], [510, 0], [680, X])], 'l'],
  x: [420, [L([0, X], [420, 0]), L([0, 0], [420, X])], 'l'],
  y: [450, [L([0, X], [225, 20]), L([450, X], [120, DESC])], 'l'],
  z: [400, [L([0, X], [400, X], [0, 0], [400, 0])], 'l'],

  zero: [480, [E(240, 350, 240, 350)], 'u'],
  one: [180, [L([0, 560], [180, H], [180, 0])], 'u'],
  two: [460, [P(arc(230, 490, 225, 210, 165, -35), [0, 0], [460, 0])], 'u'],
  three: [440, [P(arc(220, 525, 200, 175, 155, -90)), P(arc(220, 175, 220, 175, 90, -155))], 'u'],
  four: [460, [L([340, 0], [340, H], [0, 210], [460, 210])], 'u'],
  five: [460, [P([420, H], [70, H], [45, 400]), P(arc(230, 230, 230, 230, 140, -155))], 'u'],
  six: [470, [E(235, 235, 235, 235), L([380, H], [40, 300])], 'u'],
  seven: [440, [L([0, H], [440, H], [130, 0])], 'u'],
  eight: [460, [E(230, 530, 190, 170), E(230, 180, 230, 180)], 'u'],
  nine: [470, [E(235, 465, 235, 235), L([430, 400], [90, 0])], 'u'],

  period: [0, [DOT(0, 0)], 'u'],
  comma: [60, [L([60, 30], [0, -130])], 'u'],
  colon: [0, [DOT(0, 0), DOT(0, 440)], 'u'],
  semicolon: [60, [L([60, 30], [0, -130]), DOT(60, 440)], 'u'],
  exclam: [0, [L([0, H], [0, 240]), DOT(0, 0)], 'u'],
  question: [400, [P(arc(200, 520, 200, 180, 160, -40), [200, 280], [200, 230]), DOT(200, 0)], 'u'],
  quotesingle: [0, [L([0, H], [0, 500])], 'u'],
  quotedbl: [180, [L([0, H], [0, 500]), L([180, H], [180, 500])], 'u'],
  hyphen: [260, [L([0, 270], [260, 270])], 'u'],
  underscore: [500, [L([0, -120], [500, -120])], 'u'],
  parenleft: [170, [P(arc(330, 300, 330, 520, 125, 235, 4))], 'u'],
  parenright: [170, [P(arc(-160, 300, 330, 520, 55, -55, 4))], 'u'],
  bracketleft: [180, [L([180, 760], [0, 760], [0, -160], [180, -160])], 'u'],
  bracketright: [180, [L([0, 760], [180, 760], [180, -160], [0, -160])], 'u'],
  slash: [360, [L([0, -100], [360, 780])], 'u'],
  backslash: [360, [L([0, 780], [360, -100])], 'u'],
  plus: [440, [L([0, 300], [440, 300]), L([220, 80], [220, 520])], 'u'],
  equal: [440, [L([0, 390], [440, 390]), L([0, 210], [440, 210])], 'u'],
  less: [400, [L([400, 540], [0, 300], [400, 60])], 'u'],
  greater: [400, [L([0, 540], [400, 300], [0, 60])], 'u'],
  asterisk: [320, [L([160, H], [160, 380]), L([10, 610], [310, 470]), L([10, 470], [310, 610])], 'u'],
  numbersign: [500, [L([160, H], [100, 0]), L([400, H], [340, 0]), L([0, 470], [500, 470]), L([0, 230], [500, 230])], 'u'],
  percent: [600, [E(110, 560, 110, 140), E(490, 140, 110, 140), L([520, H], [80, 0])], 'u'],
  dollar: [480, [P(arc(240, 525, 230, 175, 25, 270), arc(240, 175, 240, 175, 90, -155)), L([240, 790], [240, -90])], 'u'],
  ampersand: [560, [P([560, 0], [150, 470], arc(240, 560, 125, 140, 210, -30), [100, 230], arc(230, 190, 210, 190, 170, 320), [520, 330])], 'u'],
  at: [760, [E(380, 300, 150, 170), P([530, 470], [530, 200], arc(610, 200, 80, 90, 180, 360), arc(380, 300, 380, 400, 0, 330))], 'u'],
  quoteleft: [60, [L([60, 520], [0, 690])], 'u'],
  quoteright: [60, [L([60, 700], [0, 530])], 'u'],
  quotedblleft: [200, [L([60, 520], [0, 690]), L([200, 520], [140, 690])], 'u'],
  quotedblright: [200, [L([60, 700], [0, 530]), L([200, 700], [140, 530])], 'u'],
  bar: [0, [L([0, 780], [0, -180])], 'u'],
  asciitilde: [440, [P(arc(110, 300, 110, 80, 180, 0), arc(330, 300, 110, 80, 180, 360))], 'u'],

  // Marks for accented letters (positioned over the x-height; compose moves them).
  acute: [160, [L([0, 600], [160, 760])], 'm'],
  grave: [160, [L([0, 760], [160, 600])], 'm'],
  circumflex: [300, [L([0, 600], [150, 760], [300, 600])], 'm'],
  caron: [300, [L([0, 760], [150, 600], [300, 760])], 'm'],
  tilde: [340, [P(arc(85, 650, 85, 60, 180, 0), arc(255, 650, 85, 60, 180, 360))], 'm'],
  dieresis: [240, [DOT(0, 680), DOT(240, 680)], 'm'],
  ring: [180, [E(90, 680, 90, 80)], 'm'],
  macron: [300, [L([0, 690], [300, 690])], 'm'],
  cedilla: [170, [P([60, 0], [60, -60], arc(60, -120, 110, 70, 90, -150))], 'm'],
};

// ---------- Strokers ----------

const norm = (x, y) => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

/** Flat cap end points for an endpoint P with outward direction d. */
function flatCap(p, d, n, w, side) {
  const h = w / 2;
  const base = [p[0] + n[0] * h * side, p[1] + n[1] * h * side];
  if (Math.abs(d[1]) >= Math.abs(d[0])) {
    const target = p[1] + Math.sign(d[1]) * h;
    const t = (target - base[1]) / d[1];
    return [base[0] + d[0] * t, base[1] + d[1] * t];
  }
  const target = p[0] + Math.sign(d[0]) * h;
  const t = (target - base[0]) / d[0];
  return [base[0] + d[0] * t, base[1] + d[1] * t];
}

/** Offsets a polyline to one side with miter joins (limited, then beveled). */
function offsetSide(pts, w, side, closed) {
  const h = (w / 2) * side;
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
    const next = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    const p = pts[i];
    const d0 = i === 0 && !closed ? norm(next[0] - p[0], next[1] - p[1]) : norm(p[0] - prev[0], p[1] - prev[1]);
    const d1 = i === n - 1 && !closed ? d0 : norm(next[0] - p[0], next[1] - p[1]);
    const n0 = [-d0[1], d0[0]];
    const n1 = [-d1[1], d1[0]];
    let m = norm(n0[0] + n1[0], n0[1] + n1[1]);
    const cos = m[0] * n1[0] + m[1] * n1[1];
    if (cos < 0.5) {
      // Bevel very sharp joins.
      out.push([p[0] + n0[0] * h, p[1] + n0[1] * h], [p[0] + n1[0] * h, p[1] + n1[1] * h]);
      continue;
    }
    m = [m[0] / cos, m[1] / cos];
    out.push([p[0] + m[0] * h, p[1] + m[1] * h]);
  }
  return out;
}

const toVec = (pts) => pts.map(([x, y]) => ({ x, y }));
const fit = (poly) => fitContour(toVec(poly), { error: 0.8, closed: true, cornerAngle: 20 });
const area = (poly) => {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] - poly[i][0]) * (poly[j][1] + poly[i][1]);
  return a / 2;
};
const cw = (poly) => (area(poly) > 0 ? poly.slice().reverse() : poly);
const ccw = (poly) => (area(poly) < 0 ? poly.slice().reverse() : poly);

/** Turn angle at vertex i of a polyline, in degrees. */
function turnAt(pts, i) {
  const a = pts[i - 1];
  const b = pts[i];
  const c = pts[i + 1];
  const d0 = norm(b[0] - a[0], b[1] - a[1]);
  const d1 = norm(c[0] - b[0], c[1] - b[1]);
  return (Math.acos(Math.max(-1, Math.min(1, d0[0] * d1[0] + d0[1] * d1[1]))) * 180) / Math.PI;
}

/** One smooth run: offset both sides; ends are flat caps or butt ends. */
function runPolygon(pts, w, capStart, capEnd) {
  const left = offsetSide(pts, w, 1, false);
  const right = offsetSide(pts, w, -1, false);
  const n = pts.length;
  const dS = norm(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
  const dE = norm(pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]);
  const nS = [dS[1], -dS[0]];
  const nE = [-dE[1], dE[0]];
  if (capStart) {
    left[0] = flatCap(pts[0], dS, nS, w, 1);
    right[0] = flatCap(pts[0], dS, nS, w, -1);
  }
  if (capEnd) {
    left[n - 1] = flatCap(pts[n - 1], dE, nE, w, 1);
    right[n - 1] = flatCap(pts[n - 1], dE, nE, w, -1);
  }
  return cw([...left, ...right.reverse()]);
}

/** Miter (or bevel) wedge filling the outside of a sharp join at b. */
function joinPolygon(a, b, c, w) {
  const h = w / 2;
  const d0 = norm(b[0] - a[0], b[1] - a[1]);
  const d1 = norm(c[0] - b[0], c[1] - b[1]);
  const cross = d0[0] * d1[1] - d0[1] * d1[0];
  const side = cross > 0 ? -1 : 1; // the outer side of the turn
  const n0 = [-d0[1] * side, d0[0] * side];
  const n1 = [-d1[1] * side, d1[0] * side];
  const p0 = [b[0] + n0[0] * h, b[1] + n0[1] * h];
  const p1 = [b[0] + n1[0] * h, b[1] + n1[1] * h];
  const m = norm(n0[0] + n1[0], n0[1] + n1[1]);
  const cos = m[0] * n1[0] + m[1] * n1[1];
  const poly = [b, p0];
  if (cos > 0.38) poly.push([b[0] + (m[0] * h) / cos, b[1] + (m[1] * h) / cos]);
  poly.push(p1);
  return cw(poly);
}

/** Flat capped, miter joined stroke of one skeleton part. */
function flatStroke(part, w) {
  const pts = dedupe(part.pts);
  if (part.dot || pts.length < 2) {
    const [x, y] = pts[0];
    const h = w / 2;
    return [fit(cw([[x - h, y - h], [x - h, y + h], [x + h, y + h], [x + h, y - h]]))];
  }
  if (part.closed) {
    const outer = offsetSide(pts, w, 1, true);
    const inner = offsetSide(pts, w, -1, true);
    const a = Math.abs(area(outer)) > Math.abs(area(inner)) ? outer : inner;
    const b = a === outer ? inner : outer;
    return [fit(cw(a)), fit(ccw(b))];
  }
  // Split at sharp corners so each run offsets cleanly, then add joins.
  const cuts = [0];
  for (let i = 1; i < pts.length - 1; i++) if (turnAt(pts, i) > 25) cuts.push(i);
  cuts.push(pts.length - 1);
  const out = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const run = pts.slice(cuts[k], cuts[k + 1] + 1);
    out.push(fit(runPolygon(run, w, k === 0, k === cuts.length - 2)));
  }
  for (let k = 1; k < cuts.length - 1; k++) {
    const i = cuts[k];
    out.push(fit(joinPolygon(pts[i - 1], pts[i], pts[i + 1], w)));
  }
  return out;
}

/** Round capped stroke with the core outliner. */
function roundStroke(part, w) {
  const pts = dedupe(part.pts);
  const path = part.closed ? [...pts, pts[0], pts[1]] : pts;
  return strokeToOutline(toVec(path), w, { error: 0.6, smoothing: 0 });
}

function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const l = out[out.length - 1];
    if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 0.01) out.push(p);
  }
  return out;
}

// ---------- Styles ----------

const STYLES = {
  geometric: {
    family: 'Atelier Geometric', style: 'Black', weight: 150, sb: 46, xScale: 1.08, round: false,
    description: 'A heavy geometric display face built from circles and straight strokes.',
  },
  rounded: {
    family: 'Atelier Rounded', style: 'Regular', weight: 92, sb: 52, xScale: 1, round: true,
    description: 'A friendly monoline sans with round ends.',
  },
  mono: {
    family: 'Atelier Mono', style: 'Regular', weight: 76, sb: 0, xScale: 1, round: false, mono: 600,
    description: 'A monospaced monoline font for code and tables.',
  },
};

/** Vertical mapping so ink sits on the baseline and reaches cap and x-height. */
function mapY(y, kind, w) {
  const h = w / 2;
  if (y < 0) return y + h;
  if (kind === 'l') return y <= X ? h + (y * (X - w)) / X : y - h;
  if (kind === 'm') return y - h;
  return y <= H ? h + (y * (H - w)) / H : y - h;
}

const MONO_EXTRA = {
  I: [L([-150, H], [150, H]), L([-150, 0], [150, 0])],
  i: [L([-160, X], [0, X]), L([-170, 0], [170, 0])],
  l: [L([-160, ASC], [0, ASC]), L([-170, 0], [170, 0])],
  j: [L([60, X], [210, X])],
  one: [L([-10, 0], [370, 0])],
  r: [L([-120, 0], [200, 0])],
};

function buildText(id) {
  const st = STYLES[id];
  const w = st.weight;
  const font = model.createFont({
    family: st.family, style: st.style, designer: 'Alexandre Kohler', license: 'SIL Open Font License 1.1',
    description: st.description, ascender: 800, descender: -220, xHeight: X, capHeight: H, version: '1.000',
  });
  if (st.style === 'Black') font.meta.weightClass = 900;
  for (const [name, [width, parts0, kind]] of Object.entries(S)) {
    let parts = parts0;
    let bodyW = width;
    let sx = st.xScale;
    if (st.mono) {
      const extra = MONO_EXTRA[name] || [];
      parts = [...parts0, ...extra];
      const xs = parts.flatMap((p) => p.pts.map((q) => q[0]));
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const room = st.mono - w - 70;
      sx = maxX - minX > room ? room / (maxX - minX) : 1;
      bodyW = (maxX - minX) * sx;
      const shift = -minX * sx;
      parts = parts.map((p) => ({ ...p, pts: p.pts.map(([x, y]) => [x * sx + shift, y]) }));
      sx = 1;
    }
    const mapped = parts.map((p) => ({ ...p, pts: p.pts.map(([x, y]) => [x * sx, mapY(y, kind, w)]) }));
    let contours = [];
    for (const part of mapped) contours.push(...(st.round ? roundStroke(part, w) : flatStroke(part, w)));
    if (process.env.DUMP === `${id}:${name}`) writeFileSync(join(root, 'tmp', 'dump.json'), JSON.stringify(contours));
    contours = roundContours(removeOverlaps(contours));
    const inkW = (st.mono ? bodyW : width * sx) + w;
    const adv = st.mono ? st.mono : Math.round(inkW + st.sb * 2);
    const left = st.mono ? (st.mono - inkW) / 2 : st.sb;
    const dx = Math.round(left + w / 2);
    contours = contours.map((c) => ({ ...c, points: c.points.map((p) => ({ ...p, x: Math.round(p.x + dx) })) }));
    model.addGlyph(font, { name, advanceWidth: adv, contours });
  }
  font.glyphs.space.advanceWidth = st.mono ? st.mono : Math.round(260 + w);
  addAnchors(font);
  composeAccents(font);
  kernBasics(font, id);
  return font;
}

/** Top and bottom anchors so compose centres marks over each base. */
function addAnchors(font) {
  for (const g of Object.values(font.glyphs)) {
    if (!g.contours.length) continue;
    let xMin = Infinity, xMax = -Infinity, yMax = -Infinity;
    for (const c of g.contours) for (const p of c.points) {
      xMin = Math.min(xMin, p.x);
      xMax = Math.max(xMax, p.x);
      yMax = Math.max(yMax, p.y);
    }
    const cx = Math.round((xMin + xMax) / 2);
    const marks = ['acute', 'grave', 'circumflex', 'caron', 'tilde', 'dieresis', 'ring', 'macron', 'cedilla'];
    if (marks.includes(g.name)) {
      g.anchors = g.name === 'cedilla' ? { _bottom: { x: cx, y: 0 } } : { _top: { x: cx, y: Math.round(font.meta.xHeight + 60) } };
    } else {
      g.anchors = { top: { x: cx, y: Math.round(Math.max(yMax, font.meta.xHeight) + 60) }, bottom: { x: cx, y: 0 } };
    }
  }
}

const ACCENTED = '\u00c0\u00c1\u00c2\u00c3\u00c4\u00c5\u00c7\u00c8\u00c9\u00ca\u00cb\u00cc\u00cd\u00ce\u00cf\u00d1\u00d2\u00d3\u00d4\u00d5\u00d6\u00d9\u00da\u00db\u00dc\u00dd\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5\u00e7\u00e8\u00e9\u00ea\u00eb\u00ec\u00ed\u00ee\u00ef\u00f1\u00f2\u00f3\u00f4\u00f5\u00f6\u00f9\u00fa\u00fb\u00fc\u00fd\u00ff';
function composeAccents(font) {
  if (typeof coreIndex.compose !== 'function') return;
  let made = 0;
  for (const ch of ACCENTED) {
    try {
      const g = coreIndex.compose(font, ch);
      if (g) made++;
    } catch {
      // compose not available yet or the base is missing
    }
  }
  return made;
}

function kernBasics(font, id) {
  if (id === 'mono') return;
  const k = id === 'geometric' ? 1.3 : 1;
  const pairs = { 'A|V': -60, 'V|A': -60, 'A|T': -50, 'T|A': -50, 'T|o': -70, 'T|a': -60, 'T|e': -60, 'L|T': -70, 'L|V': -60, 'P|A': -50, 'Y|o': -60, 'V|o': -40, 'W|o': -30, 'r|period': -60, 'r|comma': -60, 'F|A': -40, 'A|Y': -50, 'Y|A': -50, 'T|period': -60, 'P|period': -80 };
  for (const [key, v] of Object.entries(pairs)) font.kerning.pairs[key] = Math.round(v * k);
}

// ---------- Icons ----------

function buildIcons() {
  const font = model.createFont({
    family: 'Atelier Icons', style: 'Regular', designer: 'Alexandre Kohler', license: 'SIL Open Font License 1.1',
    description: 'A starter icon font. Each icon sits in the Private Use Area from U+E000.', ascender: 850, descender: -150, xHeight: 500, capHeight: 700,
  });
  const w = 74;
  const S2 = (part) => roundStroke(part, w);
  const filled = (poly) => [fit(cw(poly))];
  const ring = (cx, cy, r) => [fit(cw(arc(cx, cy, r, r, 90, -270, 5).slice(0, -1)))];
  const hole = (cx, cy, r) => [fit(ccw(arc(cx, cy, r, r, 90, -270, 5).slice(0, -1)))];
  const star = (cx, cy, r1, r2, n) => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = rad(90 - (i * 180) / n);
      const r = i % 2 ? r2 : r1;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  };
  const ICONS = [
    ['heart', () => [...ring(250, 480, 190), ...ring(550, 480, 190), ...filled([[83, 400], [400, 20], [717, 400], [400, 560]])]],
    ['star', () => filled(star(400, 380, 400, 165, 5))],
    ['check', () => S2(P([110, 360], [320, 150], [700, 600]))],
    ['close', () => [...S2(L([150, 100], [650, 600])), ...S2(L([650, 100], [150, 600]))]],
    ['plus', () => [...S2(L([400, 70], [400, 630])), ...S2(L([120, 350], [680, 350]))]],
    ['minus', () => S2(L([120, 350], [680, 350]))],
    ['arrowright', () => [...S2(L([100, 350], [660, 350])), ...S2(L([430, 600], [680, 350], [430, 100]))]],
    ['arrowleft', () => [...S2(L([700, 350], [140, 350])), ...S2(L([370, 600], [120, 350], [370, 100]))]],
    ['arrowup', () => [...S2(L([400, 40], [400, 620])), ...S2(L([150, 400], [400, 650], [650, 400]))]],
    ['arrowdown', () => [...S2(L([400, 660], [400, 80])), ...S2(L([150, 300], [400, 50], [650, 300]))]],
    ['home', () => [...filled([[60, 380], [400, 700], [740, 380], [650, 380], [650, 0], [480, 0], [480, 230], [320, 230], [320, 0], [150, 0], [150, 380]])]],
    ['search', () => [...S2(E(330, 420, 220, 220)), ...S2(L([500, 250], [720, 30]))]],
    ['mail', () => [...S2({ pts: [[80, 80], [80, 620], [720, 620], [720, 80]], closed: true }), ...S2(L([90, 600], [400, 330], [710, 600]))]],
    ['user', () => [...ring(400, 520, 170), ...filled([...arc(400, 0, 320, 300, 180, 0, 6), [720, -10], [80, -10]])]],
    ['bell', () => [...filled([[100, 120], [180, 220], [180, 420], ...arc(400, 420, 220, 230, 180, 0, 6), [620, 220], [700, 120]]), ...ring(400, 40, 80)]],
    ['play', () => filled([[170, 40], [170, 660], [680, 350]])],
    ['pause', () => [...filled([[150, 40], [150, 660], [330, 660], [330, 40]]), ...filled([[470, 40], [470, 660], [650, 660], [650, 40]])]],
    ['download', () => [...S2(L([400, 680], [400, 220])), ...S2(L([200, 400], [400, 200], [600, 400])), ...S2(L([90, 160], [90, 30], [710, 30], [710, 160]))]],
    ['lock', () => [...filled([[110, 0], [110, 380], [690, 380], [690, 0]]), ...hole(400, 190, 60), ...S2(P([210, 380], arc(400, 480, 190, 190, 180, 0), [590, 380]))]],
    ['trash', () => [...S2(L([90, 600], [710, 600])), ...S2(L([300, 620], [300, 690], [500, 690], [500, 620])), ...filled([[150, 540], [650, 540], [600, 0], [200, 0]])]],
    ['cloud', () => [...ring(260, 260, 170), ...ring(450, 380, 220), ...ring(600, 240, 150), ...filled([[260, 90], [600, 90], [600, 260], [260, 260]])]],
    ['sun', () => {
      const out = [...ring(400, 350, 170)];
      for (let i = 0; i < 8; i++) {
        const a = rad(i * 45);
        out.push(...S2(L([400 + 260 * Math.cos(a), 350 + 260 * Math.sin(a)], [400 + 340 * Math.cos(a), 350 + 340 * Math.sin(a)])));
      }
      return out;
    }],
    ['moon', () => filled([...arc(400, 350, 330, 330, 60, 300, 4), ...arc(560, 350, 260, 290, 240, 120, 4)])],
    ['musicnote', () => [...ring(230, 120, 130), ...S2(L([345, 120], [345, 650], [640, 700], [640, 560]))]],
    ['pin', () => [...filled([[400, 0], ...arc(400, 470, 250, 250, -50, 230, 5)]), ...hole(400, 470, 95)]],
    ['camera', () => [...filled([[60, 60], [60, 520], [220, 520], [290, 640], [510, 640], [580, 520], [740, 520], [740, 60]]), ...hole(400, 300, 150)]],
  ];
  let code = 0xe000;
  const map = {};
  for (const [name, make] of ICONS) {
    let contours = make();
    contours = roundContours(removeOverlaps(contours));
    contours = contours.map((c) => ({ ...c, points: c.points.map((p) => ({ ...p, x: p.x + 100, y: p.y })) }));
    model.addGlyph(font, { name, unicodes: [code], advanceWidth: 1000, contours });
    map[name] = code++;
  }
  return font;
}

// ---------- Write ----------

const write = (id, font) => {
  const problems = model.validateFont(font);
  if (problems.length) console.warn(`${id}: ${problems.join('; ')}`);
  const text = model.serialize(font);
  writeFileSync(join(outDir, `${id}.fontsketch.json`), text);
  const drawn = Object.values(font.glyphs).filter((g) => g.contours.length || g.components?.length).length;
  console.log(`templates: ${id} ${drawn} glyphs, ${(text.length / 1024).toFixed(0)} KB`);
};

for (const id of Object.keys(STYLES)) write(id, buildText(id));
write('icons', buildIcons());
void contourArea;
void reverseContour;
