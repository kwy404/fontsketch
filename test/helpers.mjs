// Shared fixtures for the core tests: a small but realistic font built from
// rectangles, rings and diagonals.
import { addGlyph, createFont } from '../src/core/model.mjs';
import { circleContour, reverseContour } from '../src/core/geometry.mjs';

export const rect = (x0, y0, x1, y1) => ({
  closed: true,
  points: [{ x: x0, y: y0, on: true }, { x: x0, y: y1, on: true }, { x: x1, y: y1, on: true }, { x: x1, y: y0, on: true }],
});

export const ring = (cx, cy, rx, ry, t) => {
  const outer = circleContour(0, 0, 1);
  const scale = (c, sx, sy) => ({ ...c, points: c.points.map((p) => ({ ...p, x: Math.round(cx + p.x * sx), y: Math.round(cy + p.y * sy) })) });
  return [scale(outer, rx, ry), reverseContour(scale(outer, rx - t, ry - t))];
};

const poly = (pts) => ({ closed: true, points: pts.map(([x, y]) => ({ x, y, on: true })) });

/**
 * @param {{ weight?: number, family?: string }} [opts] weight scales the stems
 */
export function sampleFont(opts = {}) {
  const s = opts.weight ?? 80;
  const font = createFont({ family: opts.family ?? 'Sketch Test', designer: 'Test Designer', license: 'MIT', version: '1.200' });
  addGlyph(font, { name: 'H', unicodes: [0x48], advanceWidth: 640, contours: [rect(60, 0, 60 + s, 700), rect(580 - s, 0, 580, 700), rect(60 + s, 310, 580 - s, 310 + s)] });
  addGlyph(font, { name: 'I', unicodes: [0x49], advanceWidth: 260, contours: [rect(90, 0, 90 + s, 700)] });
  addGlyph(font, { name: 'O', unicodes: [0x4f], advanceWidth: 720, contours: ring(360, 350, 300, 362, s) });
  addGlyph(font, { name: 'o', unicodes: [0x6f], advanceWidth: 560, contours: ring(280, 250, 230, 260, s) });
  addGlyph(font, { name: 'l', unicodes: [0x6c], advanceWidth: 240, contours: [rect(80, 0, 80 + s, 760)] });
  addGlyph(font, { name: 'x', unicodes: [0x78], advanceWidth: 520, contours: [poly([[40, 0], [480 - s * 1.4, 500], [480, 500], [40 + s * 1.4, 0]]), poly([[480 - s * 1.4, 0], [40, 500], [40 + s * 1.4, 500], [480, 0]])] });
  addGlyph(font, { name: 'n', unicodes: [0x6e], advanceWidth: 580, contours: [rect(70, 0, 70 + s, 500), rect(500 - s, 0, 500, 420), rect(70 + s, 420, 500, 500)] });
  addGlyph(font, { name: 'p', unicodes: [0x70], advanceWidth: 580, contours: [rect(70, -220, 70 + s, 500), ...ring(320, 250, 190, 250, s)] });
  addGlyph(font, { name: 'V', unicodes: [0x56], advanceWidth: 640, contours: [poly([[20, 700], [300, 0], [340, 0], [620, 700], [540, 700], [320, 120], [100, 700]].reverse())] });
  addGlyph(font, { name: 'A', unicodes: [0x41], advanceWidth: 640, contours: [poly([[20, 0], [300, 700], [340, 700], [620, 0], [540, 0], [320, 580], [100, 0]])] });
  addGlyph(font, { name: 'a', unicodes: [0x61], advanceWidth: 540, contours: [...ring(260, 230, 200, 230, s), rect(460 - s, 0, 460, 500)] });
  addGlyph(font, { name: 'e', unicodes: [0x65], advanceWidth: 540, contours: [...ring(270, 250, 220, 250, s), rect(70, 230, 470, 230 + s)] });
  addGlyph(font, { name: 'acute', unicodes: [0xb4], advanceWidth: 300, contours: [poly([[120, 560], [180, 560], [260, 700], [200, 700]].reverse())], anchors: { _top: { x: 190, y: 560 } } });
  addGlyph(font, { name: 'tilde', unicodes: [0x2dc], advanceWidth: 300, contours: [poly([[60, 560], [240, 600], [240, 640], [60, 600]].reverse())] });
  addGlyph(font, { name: 'grave', unicodes: [0x60], advanceWidth: 300, contours: [poly([[200, 560], [140, 560], [60, 700], [120, 700]])] });
  addGlyph(font, { name: 'cedilla', unicodes: [0xb8], advanceWidth: 300, contours: [poly([[130, 0], [170, 0], [190, -180], [110, -180]].reverse())] });
  addGlyph(font, { name: 'c', unicodes: [0x63], advanceWidth: 500, contours: ring(260, 250, 210, 250, s).slice(0, 1) });
  addGlyph(font, { name: 'aacute', unicodes: [0xe1], advanceWidth: 540, contours: [], components: [{ glyph: 'a', dx: 0, dy: 0 }, { glyph: 'acute', dx: 80, dy: 0 }] });
  addGlyph(font, { name: 'Oslashlike', unicodes: [0xe000], advanceWidth: 720, contours: [rect(100, -20, 140, 720)], components: [{ glyph: 'O', dx: 0, dy: 0 }] });
  addGlyph(font, { name: 'smiley', unicodes: [0x1f642], advanceWidth: 800, contours: [...ring(400, 300, 300, 300, 50), rect(300, 380, 340, 460), rect(460, 380, 500, 460)] });
  font.kerning.pairs['A|V'] = -80;
  font.kerning.pairs['V|A'] = -70;
  font.kerning.pairs['@round|@round'] = -20;
  font.kerning.pairs['o|x'] = -15;
  font.kerning.pairs['@round|x'] = -30;
  font.kerning.classes['@round'] = ['o', 'O', 'e', 'c'];
  return font;
}

/** The variable sample: default stems 60 (wght 400), Thin 20 (100), Black 150 (900). */
export function sampleVariableFont() {
  const vf = sampleFont({ weight: 60 });
  const thin = sampleFont({ weight: 20 });
  const black = sampleFont({ weight: 150 });
  black.glyphs.H.advanceWidth = 700;
  vf.axes = [{ tag: 'wght', name: 'Weight', min: 100, default: 400, max: 900 }];
  const pick = (f) => Object.fromEntries(Object.entries(f.glyphs).map(([k, g]) => [k, { contours: g.contours, advanceWidth: g.advanceWidth }]));
  vf.masters = [
    { name: 'Thin', location: { wght: 100 }, glyphs: pick(thin) },
    { name: 'Black', location: { wght: 900 }, glyphs: pick(black) },
  ];
  return vf;
}

/** Glyph pair to kerning value, with classes resolved like GPOS does. */
export function flatKerning(font) {
  const classes = font.kerning.classes;
  const sideOf = (s) => (classes[s] ? { ids: classes[s], cls: true } : { ids: [s], cls: false });
  const rank = (l, r) => (!l.cls && !r.cls ? 4 : !l.cls ? 3 : !r.cls ? 2 : 1);
  const best = new Map();
  for (const [key, v] of Object.entries(font.kerning.pairs)) {
    const [a, b] = key.split('|');
    const l = sideOf(a);
    const r = sideOf(b);
    const k = rank(l, r);
    for (const x of l.ids) for (const y of r.ids) {
      const prev = best.get(`${x}|${y}`);
      if (!prev || prev.k <= k) best.set(`${x}|${y}`, { k, v });
    }
  }
  return Object.fromEntries([...best].filter(([, e]) => e.v !== 0).map(([key, e]) => [key, e.v]).sort());
}
