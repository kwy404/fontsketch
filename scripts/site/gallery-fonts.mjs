// The example fonts of the gallery, built with the fontsketch engine:
//   Quill Hand Variable  the handwriting strokes expanded with two pen widths
//   Compass Display      a geometric display face made of rings, bars and arcs
//   Atelier Icons        an icon font with Private Use Area code points
import * as core from '../../src/node.mjs';
import { strokesToContours } from '../../docs/assets/site/stroke.mjs';
import { buildQuillHand } from './quill-hand.mjs';

// ---------- geometric primitives (TrueType points, Y up) ----------

const on = (x, y) => ({ x: Math.round(x), y: Math.round(y), on: true });
const off = (x, y) => ({ x: Math.round(x), y: Math.round(y), on: false });

/** Polygon contour from [x, y] pairs, made clockwise unless ccw is set. */
function poly(pts, ccw = false) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  const list = (a > 0) !== ccw ? [...pts].reverse() : pts;
  return { closed: true, points: list.map(([x, y]) => on(x, y)) };
}
const rect = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

/** Thick bar between two points with square ends. */
function bar(x0, y0, x1, y1, w = 130) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
  const nx = (-dy / l) * (w / 2), ny = (dx / l) * (w / 2);
  return poly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]);
}

/** Arc as TrueType points (on, off, on...) every 45 degrees or less. */
function arcPts(cx, cy, rx, ry, a0, a1) {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 45));
  const step = (a1 - a0) / n;
  const out = [];
  const k = 1 / Math.cos(((step / 2) * Math.PI) / 180);
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + step * i) * Math.PI) / 180;
    out.push(on(cx + rx * Math.cos(a), cy + ry * Math.sin(a)));
    if (i < n) {
      const m = ((a0 + step * (i + 0.5)) * Math.PI) / 180;
      out.push(off(cx + rx * k * Math.cos(m), cy + ry * k * Math.sin(m)));
    }
  }
  return out;
}

/** Full ellipse contour; clockwise for outer, counterclockwise for holes. */
function ellipse(cx, cy, rx, ry, hole = false) {
  const pts = arcPts(cx, cy, rx, ry, 0, 360).slice(0, -1);
  return { closed: true, points: hole ? pts : pts.reverse() };
}
const ring = (cx, cy, ro, ri, ry0 = ro, ry1 = ri) => [ellipse(cx, cy, ro, ry0), ellipse(cx, cy, ri, ry1, true)];

/** Annular sector from a0 to a1 (degrees, counterclockwise). */
function sector(cx, cy, ro, ri, a0, a1, ryo = ro, ryi = ri) {
  const outer = arcPts(cx, cy, ro, ryo, a0, a1);
  const inner = arcPts(cx, cy, ri, ryi, a1, a0);
  // counterclockwise outer then inner back: reverse for clockwise
  return { closed: true, points: [...outer, ...inner].reverse() };
}

// ---------- Compass Display ----------

const COMPASS = {
  A: [620, () => [bar(70, 0, 310, 700), bar(310, 700, 550, 0), rect(170, 170, 450, 290), poly([[245, 640], [375, 640], [310, 720]])]],
  B: [560, () => [rect(60, 0, 190, 700), rect(60, 570, 330, 700), rect(60, 310, 330, 440), rect(60, 0, 330, 130), sector(330, 505, 195, 65, -90, 90), sector(330, 220, 220, 90, -90, 90)]],
  C: [650, () => [sector(370, 350, 330, 200, 45, 315, 350, 220)]],
  D: [640, () => [rect(60, 0, 190, 700), rect(60, 570, 260, 700), rect(60, 0, 260, 130), sector(260, 350, 320, 190, -90, 90, 350, 220)]],
  E: [520, () => [rect(60, 0, 190, 700), rect(60, 570, 460, 700), rect(60, 290, 400, 410), rect(60, 0, 470, 130)]],
  F: [500, () => [rect(60, 0, 190, 700), rect(60, 570, 460, 700), rect(60, 290, 400, 410)]],
  G: [680, () => [sector(370, 350, 330, 200, 40, 350, 350, 220), rect(380, 280, 700, 400), rect(570, 60, 700, 400)]],
  H: [640, () => [rect(60, 0, 190, 700), rect(450, 0, 580, 700), rect(60, 290, 580, 410)]],
  I: [250, () => [rect(60, 0, 190, 700)]],
  J: [520, () => [rect(330, 240, 460, 700), sector(220, 240, 240, 110, 180, 360)]],
  K: [600, () => [rect(60, 0, 190, 700), bar(150, 300, 520, 700), bar(250, 380, 560, 0)]],
  L: [480, () => [rect(60, 0, 190, 700), rect(60, 0, 450, 130)]],
  M: [780, () => [rect(60, 0, 190, 700), rect(590, 0, 720, 700), bar(125, 680, 390, 220), bar(390, 220, 655, 680)]],
  N: [660, () => [rect(60, 0, 190, 700), rect(470, 0, 600, 700), bar(125, 680, 535, 20, 150)]],
  O: [720, () => ring(360, 350, 320, 190, 350, 220)],
  P: [540, () => [rect(60, 0, 190, 700), rect(60, 570, 300, 700), rect(60, 300, 300, 430), sector(300, 500, 200, 70, -90, 90)]],
  Q: [720, () => [...ring(360, 350, 320, 190, 350, 220), bar(430, 200, 680, -60)]],
  R: [580, () => [rect(60, 0, 190, 700), rect(60, 570, 300, 700), rect(60, 300, 300, 430), sector(300, 500, 200, 70, -90, 90), bar(270, 330, 540, 0)]],
  S: [560, () => [sector(290, 520, 210, 80, 30, 270), sector(290, 180, 220, 90, -150, 90), rect(280, 310, 300, 440)]],
  T: [560, () => [rect(30, 570, 530, 700), rect(215, 0, 345, 700)]],
  U: [640, () => [rect(60, 280, 190, 700), rect(450, 280, 580, 700), sector(320, 280, 260, 130, 180, 360, 280, 150)]],
  V: [620, () => [bar(70, 700, 310, 0), bar(310, 0, 550, 700), poly([[245, 60], [375, 60], [310, -20]])]],
  W: [880, () => [bar(60, 700, 250, 0), bar(250, 0, 440, 560), bar(440, 560, 630, 0), bar(630, 0, 820, 700)]],
  X: [600, () => [bar(70, 700, 530, 0, 140), bar(530, 700, 70, 0, 140)]],
  Y: [600, () => [bar(70, 700, 300, 330), bar(530, 700, 300, 330), rect(235, 0, 365, 360)]],
  Z: [560, () => [rect(50, 570, 510, 700), rect(50, 0, 520, 130), bar(470, 640, 90, 60, 150)]],
  zero: [580, () => ring(290, 350, 250, 120, 350, 220)],
  one: [380, () => [rect(170, 0, 300, 700), bar(60, 520, 240, 660)]],
  two: [560, () => [sector(280, 480, 220, 90, -40, 180), bar(440, 350, 80, 60, 140), rect(60, 0, 500, 130)]],
  three: [560, () => [sector(260, 520, 200, 70, -110, 160), sector(260, 200, 220, 90, -160, 100), rect(200, 290, 280, 420)]],
  four: [580, () => [bar(380, 700, 60, 220, 140), rect(60, 160, 540, 290), rect(360, 0, 490, 560)]],
  five: [560, () => [rect(90, 570, 480, 700), rect(90, 360, 220, 700), sector(270, 230, 230, 100, -150, 120)]],
  six: [580, () => [...ring(290, 230, 230, 100), bar(120, 260, 380, 700, 140)]],
  seven: [540, () => [rect(50, 570, 500, 700), bar(450, 640, 160, 0, 150)]],
  eight: [580, () => [...ring(290, 535, 185, 65, 165, 50), ...ring(290, 205, 230, 100, 205, 80)]],
  nine: [580, () => [...ring(290, 470, 230, 100), bar(460, 440, 200, 0, 140)]],
  period: [250, () => [rect(60, 0, 190, 130)]],
  comma: [250, () => [rect(60, 0, 190, 130), poly([[60, 0], [190, 0], [100, -150]])]],
  exclam: [250, () => [rect(60, 230, 190, 700), rect(60, 0, 190, 130)]],
  question: [540, () => [sector(270, 490, 210, 80, -60, 180), rect(205, 230, 335, 360), rect(205, 0, 335, 130)]],
  hyphen: [420, () => [rect(60, 290, 360, 410)]],
  colon: [250, () => [rect(60, 0, 190, 130), rect(60, 360, 190, 490)]],
  ampersand: [640, () => [...ring(260, 230, 220, 90, 230, 100), bar(150, 450, 600, 0, 140), sector(280, 540, 160, 40, 0, 230)]],
  quotesingle: [250, () => [rect(60, 470, 190, 700)]],
};

export function buildCompass() {
  const font = core.createFont({
    family: 'Compass Display', style: 'Regular', designer: 'Alexandre Kohler', designerURL: 'https://github.com/kwy404',
    license: 'MIT License', licenseURL: 'https://github.com/kwy404/fontsketch/blob/main/LICENSE', copyright: 'Copyright (c) 2026 Alexandre Kohler',
    description: 'Compass Display, a geometric display face built from shapes with fontsketch.',
    ascender: 860, descender: -200, xHeight: 700, capHeight: 700,
  });
  for (const [name, [adv, fn]] of Object.entries(COMPASS)) {
    const unicodes = [core.unicodeFor(name)];
    if (/^[A-Z]$/.test(name)) unicodes.push(name.toLowerCase().charCodeAt(0));
    core.addGlyph(font, { name, unicodes, advanceWidth: adv, contours: fn() });
  }
  font.glyphs.space.advanceWidth = 260;
  font.kerning.pairs = { 'A|V': -60, 'V|A': -60, 'A|T': -40, 'T|A': -40, 'L|T': -60, 'A|Y': -40, 'Y|A': -40, 'T|O': -20, 'P|A': -40, 'F|A': -30 };
  return font;
}

// ---------- Atelier Icons ----------

function star(cx, cy, ro, ri, n = 5, rot = 90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const r = i % 2 ? ri : ro;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return poly(pts);
}

export const ICONS = [
  ['star', 'Star', () => [star(500, 380, 420, 180)]],
  ['heart', 'Heart', () => [ellipse(330, 520, 200, 200), ellipse(670, 520, 200, 200), poly([[150, 440], [850, 440], [500, 30]])]],
  ['check', 'Check', () => [bar(130, 380, 390, 120, 150), bar(340, 120, 880, 660, 150)]],
  ['close', 'Close', () => [bar(170, 130, 830, 790, 150), bar(830, 130, 170, 790, 150)]],
  ['plus', 'Plus', () => [rect(425, 120, 575, 800), rect(160, 385, 840, 535)]],
  ['arrow-right', 'Arrow right', () => [rect(120, 390, 640, 530), poly([[560, 180], [900, 460], [560, 740]])]],
  ['download', 'Download', () => [rect(430, 300, 570, 800), poly([[260, 380], [740, 380], [500, 120]]), rect(140, 20, 860, 130)]],
  ['search', 'Search', () => [...ring(420, 520, 290, 170), bar(610, 330, 880, 60, 150)]],
  ['home', 'Home', () => [poly([[90, 440], [500, 840], [910, 440], [800, 440], [500, 730], [200, 440]]), rect(210, 40, 790, 470), poly([[420, 40], [580, 40], [580, 270], [420, 270]], true)]],
  ['camera', 'Camera', () => [poly([[80, 120], [920, 120], [920, 640], [700, 640], [630, 760], [370, 760], [300, 640], [80, 640]]), ellipse(500, 380, 190, 190, true), ellipse(500, 380, 110, 110)]],
  ['sun', 'Sun', () => [ellipse(500, 440, 200, 200), ...Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return bar(500 + Math.cos(a) * 280, 440 + Math.sin(a) * 280, 500 + Math.cos(a) * 400, 440 + Math.sin(a) * 400, 90);
  })]],
  ['moon', 'Moon', () => [{ closed: true, points: [...arcPts(500, 440, 380, 380, 60, 300), ...arcPts(640, 440, 300, 330, 228, 132)].reverse() }]],
  ['pen-nib', 'Pen nib', () => [poly([[500, 860], [800, 480], [640, 60], [360, 60], [200, 480]]), ellipse(500, 420, 70, 70, true), poly([[475, 480], [525, 480], [525, 860], [475, 860]], true)]],
  ['brush', 'Brush', () => [bar(560, 400, 880, 830, 150), poly([[170, 60], [420, 90], [560, 330], [430, 470], [260, 360]])]],
  ['letter', 'Letter A', () => [...ring(500, 440, 420, 320), bar(330, 230, 500, 680, 100), bar(500, 680, 670, 230, 100), rect(400, 360, 600, 430)]],
  ['bookmark', 'Bookmark', () => [poly([[220, 840], [780, 840], [780, 20], [500, 250], [220, 20]])]],
];

export function buildIcons() {
  const font = core.createFont({
    family: 'Atelier Icons', style: 'Regular', designer: 'Alexandre Kohler', designerURL: 'https://github.com/kwy404',
    license: 'MIT License', licenseURL: 'https://github.com/kwy404/fontsketch/blob/main/LICENSE', copyright: 'Copyright (c) 2026 Alexandre Kohler',
    description: 'Atelier Icons, an icon font built with fontsketch.', ascender: 880, descender: -120, xHeight: 500, capHeight: 700,
  });
  ICONS.forEach(([name, , fn], i) => core.addGlyph(font, { name: `icon-${name}`.replace(/-/g, '_'), unicodes: [0xe000 + i], advanceWidth: 1000, contours: fn() }));
  return font;
}

/** Quill Hand with a weight axis: Thin and Black masters around the Regular. */
export function buildQuillVariable() {
  const { font, strokeData } = buildQuillHand({ removeOverlaps: false });
  font.meta.family = 'Quill Hand Variable';
  font.axes = [{ tag: 'wght', name: 'Weight', min: 100, default: 400, max: 900 }];
  const master = (width) => {
    const glyphs = {};
    for (const [name, d] of Object.entries(strokeData)) {
      if (!font.glyphs[name] || !d.strokes.length) continue;
      glyphs[name] = { contours: strokesToContours(d.strokes, { width, swell: width * 0.3, taper: 0.2 }) };
    }
    return glyphs;
  };
  font.masters = [
    { name: 'Thin', location: { wght: 100 }, glyphs: master(26) },
    { name: 'Black', location: { wght: 900 }, glyphs: master(138) },
  ];
  font.instances = [
    { name: 'Thin', location: { wght: 100 } }, { name: 'Light', location: { wght: 300 } }, { name: 'Regular', location: { wght: 400 } },
    { name: 'Bold', location: { wght: 700 } }, { name: 'Black', location: { wght: 900 } },
  ];
  return font;
}
