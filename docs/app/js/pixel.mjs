// Pixel letters: glyphs made of square cells on a grid in font units. Cells
// are kept as a Set of "column,row" keys (row 0 sits on the baseline), traced
// into clockwise outlines with holes, stamped from brush strokes and sampled
// back from any outline. Also holds Atelier Pixel, a 5 by 7 bitmap font drawn
// cell by cell, used as the pixel style template.
import { flatten, inkBounds, winding } from './geom.mjs';

export const cellKey = (i, j) => `${i},${j}`;
const parseKey = (k) => k.split(',').map(Number);

/**
 * Traces a set of cells into outlines: outer shapes clockwise, holes
 * counterclockwise, only corner points. Cells that touch at a corner become
 * separate shapes.
 * @param {Set<string>} cells
 * @param {number} size cell size in font units
 */
export function cellsToContours(cells, size) {
  const edges = [];
  const has = (i, j) => cells.has(cellKey(i, j));
  for (const k of cells) {
    const [i, j] = parseKey(k);
    // Filled side on the right of each edge, Y up.
    if (!has(i - 1, j)) edges.push([i, j, i, j + 1]);
    if (!has(i, j + 1)) edges.push([i, j + 1, i + 1, j + 1]);
    if (!has(i + 1, j)) edges.push([i + 1, j + 1, i + 1, j]);
    if (!has(i, j - 1)) edges.push([i + 1, j, i, j]);
  }
  const from = new Map();
  edges.forEach((e, n) => {
    const key = cellKey(e[0], e[1]);
    if (!from.has(key)) from.set(key, []);
    from.get(key).push(n);
  });
  const used = new Uint8Array(edges.length);
  const out = [];
  for (let start = 0; start < edges.length; start++) {
    if (used[start]) continue;
    const loop = [];
    let n = start;
    while (n >= 0 && !used[n]) {
      used[n] = 1;
      const e = edges[n];
      loop.push([e[0], e[1]]);
      const dx = e[2] - e[0];
      const dy = e[3] - e[1];
      const next = (from.get(cellKey(e[2], e[3])) || []).filter((m) => !used[m]);
      if (!next.length) break;
      // At a corner shared by two diagonal cells, turn right so each cell
      // keeps its own outline.
      const turn = (m) => {
        const f = edges[m];
        const ex = f[2] - f[0];
        const ey = f[3] - f[1];
        if (ex === dy && ey === -dx) return 0;
        if (ex === dx && ey === dy) return 1;
        return 2;
      };
      next.sort((a, b) => turn(a) - turn(b));
      n = next[0];
    }
    const pts = [];
    for (let q = 0; q < loop.length; q++) {
      const a = loop[(q + loop.length - 1) % loop.length];
      const b = loop[q];
      const c = loop[(q + 1) % loop.length];
      const collinear = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) === 0;
      if (!collinear) pts.push({ x: b[0] * size, y: b[1] * size, on: true });
    }
    if (pts.length >= 4) out.push({ closed: true, points: pts });
  }
  return out;
}

/**
 * Samples outlines into cells: a cell is filled when at least `coverage` of
 * it is inside the shape (nonzero), measured on a small grid of samples.
 */
export function cellsFromContours(contours, size, { coverage = 0.5, samples = 4 } = {}) {
  const cells = new Set();
  const box = inkBounds(contours);
  if (!box) return cells;
  const polys = contours.map((c) => flatten(c, 8));
  const i0 = Math.floor(box.xMin / size);
  const i1 = Math.ceil(box.xMax / size);
  const j0 = Math.floor(box.yMin / size);
  const j1 = Math.ceil(box.yMax / size);
  const need = Math.max(1, Math.ceil(coverage * samples * samples - 1e-9));
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      let hit = 0;
      for (let v = 0; v < samples; v++) {
        for (let u = 0; u < samples; u++) {
          if (winding((i + (u + 0.5) / samples) * size, (j + (v + 0.5) / samples) * size, polys) !== 0) hit++;
        }
      }
      if (hit >= need) cells.add(cellKey(i, j));
    }
  }
  return cells;
}

/**
 * Cells under a brush stroke: every cell the pen passes through, widened to a
 * square of `brush` units (rounded to whole cells).
 * @param {Array<{x: number, y: number}>} samples stroke points in font units
 */
export function stampCells(samples, size, brush = size) {
  const cells = new Set();
  if (!samples.length) return cells;
  const k = Math.max(1, Math.round(brush / size));
  const lo = Math.floor((k - 1) / 2);
  const stamp = (x, y) => {
    const ci = Math.floor(x / size) - lo;
    const cj = Math.floor(y / size) - lo;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) cells.add(cellKey(ci + i, cj + j));
  };
  stamp(samples[0].x, samples[0].y);
  for (let n = 1; n < samples.length; n++) {
    const a = samples[n - 1];
    const b = samples[n];
    const steps = Math.max(1, Math.ceil((Math.hypot(b.x - a.x, b.y - a.y) / size) * 4));
    for (let s = 1; s <= steps; s++) stamp(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps);
  }
  return cells;
}

/**
 * Makes a pixel letter `extra` rows taller by repeating its emptiest inner
 * rows (the ones that are mostly stems), so strokes stay one cell thick.
 * Rows below the baseline are left alone.
 */
export function stretchCells(cells, extra) {
  const pts = [...cells].map(parseKey);
  if (!pts.length || extra <= 0) return new Set(cells);
  const top = Math.max(...pts.map((p) => p[1])) + 1;
  const count = new Map();
  for (const [, j] of pts) count.set(j, (count.get(j) || 0) + 1);
  const mid = (top - 1) / 2;
  const rows = [];
  for (let j = 1; j < top - 1; j++) rows.push(j);
  if (!rows.length) for (let j = 0; j < top; j++) rows.push(j);
  rows.sort((a, b) => (count.get(a) || 0) - (count.get(b) || 0) || Math.abs(a - mid) - Math.abs(b - mid) || a - b);
  const dup = new Map();
  for (let k = 0; k < extra; k++) dup.set(rows[k % rows.length], (dup.get(rows[k % rows.length]) || 0) + 1);
  const out = new Set();
  for (const [i, j] of pts) {
    if (j < 0) {
      out.add(cellKey(i, j));
      continue;
    }
    let shift = 0;
    for (const [r, n] of dup) if (r < j) shift += n;
    for (let c = 0; c <= (dup.get(j) || 0); c++) out.add(cellKey(i, j + shift + c));
  }
  return out;
}

/** True when every point is an on curve corner on the grid. */
export function isPixelAligned(contours, size) {
  const near = (v) => Math.abs(v / size - Math.round(v / size)) < 1e-3;
  return contours.every((c) => c.points.every((p) => p.on && near(p.x) && near(p.y)));
}

/** Snaps any outline to the grid. */
export function pixelate(contours, size, coverage = 0.5) {
  return cellsToContours(cellsFromContours(contours, size, { coverage }), size);
}

// ---------- Atelier Pixel ----------

/**
 * Bitmaps for Atelier Pixel, top row first. `b` is the row of the bottom line
 * (0 is the baseline, negative rows hang below it). Capitals are 7 rows tall,
 * the x-height is 5 rows and marks sit one row above the x-height.
 */
export const BITMAPS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  a: ['.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['.###.', '#....', '#....', '#...#', '.###.'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##', '.#..', '####', '.#..', '.#..', '.#..', '.#..'],
  g: { r: ['.####', '#...#', '#...#', '#...#', '.####', '....#', '.###.'], b: -2 },
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'],
  j: { r: ['...#', '....', '..##', '...#', '...#', '...#', '...#', '#..#', '.##.'], b: -2 },
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  l: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  m: ['##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  p: { r: ['####.', '#...#', '#...#', '#...#', '####.', '#....', '#....'], b: -2 },
  q: { r: ['.####', '#...#', '#...#', '#...#', '.####', '....#', '....#'], b: -2 },
  r: ['#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.####', '#....', '.###.', '....#', '####.'],
  t: ['.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
  u: ['#...#', '#...#', '#...#', '#..##', '.##.#'],
  v: ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: { r: ['#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'], b: -2 },
  z: ['#####', '...#.', '..#..', '.#...', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '.': ['#'],
  ',': { r: ['.#', '#.'], b: -1 },
  ':': ['#', '.', '.', '#'],
  ';': { r: ['.#', '..', '..', '.#', '#.'], b: -1 },
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": { r: ['#', '#'], b: 5 },
  '"': { r: ['#.#', '#.#'], b: 5 },
  '-': { r: ['###'], b: 2 },
  '(': ['..#', '.#.', '#..', '#..', '#..', '.#.', '..#'],
  ')': ['#..', '.#.', '..#', '..#', '..#', '.#.', '#..'],
  '[': ['##', '#.', '#.', '#.', '#.', '#.', '##'],
  ']': ['##', '.#', '.#', '.#', '.#', '.#', '##'],
  '{': ['..##', '.#..', '.#..', '#...', '.#..', '.#..', '..##'],
  '}': ['##..', '..#.', '..#.', '...#', '..#.', '..#.', '##..'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '\\': ['#....', '.#...', '.#...', '..#..', '...#.', '...#.', '....#'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '%': ['##...', '##..#', '...#.', '..#..', '.#...', '#..##', '...##'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '*': { r: ['..#..', '#.#.#', '.###.', '#.#.#', '..#..'], b: 1 },
  '+': { r: ['..#..', '..#..', '#####', '..#..', '..#..'], b: 1 },
  '=': { r: ['#####', '.....', '#####'], b: 2 },
  '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
  '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  _: { r: ['#####'], b: -1 },
  '~': { r: ['.#...', '#.#.#', '...#.'], b: 2 },
  '^': { r: ['.#.', '#.#'], b: 5 },
  '`': { r: ['#.', '.#'], b: 6 },
  '|': { r: ['#', '#', '#', '#', '#', '#', '#', '#'], b: -1 },
  '\u00a1': { r: ['#', '.', '#', '#', '#', '#', '#'], b: -2 },
  '\u00bf': { r: ['..#..', '.....', '..#..', '.#...', '#....', '#...#', '.###.'], b: -2 },
  '\u00ab': ['..#.#', '.#.#.', '#.#..', '.#.#.', '..#.#'],
  '\u00bb': ['#.#..', '.#.#.', '..#.#', '.#.#.', '#.#..'],
  '\u2018': { r: ['#.', '.#'], b: 5 },
  '\u2019': { r: ['.#', '#.'], b: 5 },
  '\u201c': { r: ['#.#.', '.#.#'], b: 5 },
  '\u201d': { r: ['.#.#', '#.#.'], b: 5 },
  '\u2026': ['#.#.#'],
  '\u2022': { r: ['.#.', '###', '.#.'], b: 1 },
  '\u00b7': { r: ['#'], b: 2 },
  '\u00b0': { r: ['.#.', '#.#', '.#.'], b: 4 },
  '\u20ac': ['..###', '.#...', '####.', '.#...', '####.', '.#...', '..###'],
  '\u00a3': ['..##.', '.#..#', '.#...', '###..', '.#...', '.#...', '#####'],
  '\u00a9': ['.#####.', '#.....#', '#.###.#', '#.#...#', '#.###.#', '#.....#', '.#####.'],
  '\u00ae': ['.#####.', '#.....#', '#.##..#', '#.#.#.#', '#.##..#', '#.#.#.#', '.#####.'],
  // Marks for accented letters, one row above the x-height (cedilla below).
  '\u00b4': { r: ['.#', '#.'], b: 6 },
  '\u02c6': { r: ['.#.', '#.#'], b: 6 },
  '\u02dc': { r: ['.#.#', '#.#.'], b: 6 },
  '\u00a8': { r: ['#.#'], b: 6 },
  '\u02da': { r: ['.#.', '#.#', '.#.'], b: 6 },
  '\u00b8': { r: ['.#', '##'], b: -2 },
  '\u02c7': { r: ['#.#', '.#.'], b: 6 },
  '\u00af': { r: ['###'], b: 6 },
  '\u02d8': { r: ['#..#', '.##.'], b: 6 },
  '\u02d9': { r: ['#'], b: 6 },
};

/** Cells of a bitmap, its left column at x = 0. */
export function bitmapCells(bitmap) {
  const rows = Array.isArray(bitmap) ? bitmap : bitmap.r;
  const bottom = Array.isArray(bitmap) ? 0 : bitmap.b;
  const cells = new Set();
  rows.forEach((row, r) => {
    const j = bottom + rows.length - 1 - r;
    [...row].forEach((ch, i) => ch === '#' && cells.add(cellKey(i, j)));
  });
  return { cells, width: Math.max(...rows.map((r) => r.length)) };
}

/**
 * Builds Atelier Pixel with the core: every bitmap above, one empty column
 * after each glyph, and accented letters composed from the marks.
 * @param {any} core the fontsketch core (createFont, addGlyph, glyphNameFor, composeAll)
 */
export function pixelFont(core, size = 100) {
  const font = core.createFont({
    family: 'Atelier Pixel',
    style: 'Regular',
    designer: 'Alexandre Kohler',
    license: 'SIL Open Font License 1.1',
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    xHeight: 5 * size,
    capHeight: 7 * size,
  });
  font.meta.description = 'A 5 by 7 pixel font drawn cell by cell.';
  font.glyphs.space.advanceWidth = 3 * size;
  for (const [ch, bitmap] of Object.entries(BITMAPS)) {
    const { cells, width } = bitmapCells(bitmap);
    core.addGlyph(font, { name: core.glyphNameFor(ch), unicodes: [ch.codePointAt(0)], advanceWidth: (width + 1) * size, contours: cellsToContours(cells, size) });
  }
  snapComponents(font, core.composeAll(font, { chars: ACCENTED }).created, size);
  return font;
}

/** Latin-1 letters with accents that pixel fonts compose. */
const ACCENTED = [...'\u00c0\u00c1\u00c2\u00c3\u00c4\u00c5\u00c7\u00c8\u00c9\u00ca\u00cb\u00cc\u00cd\u00ce\u00cf\u00d1\u00d2\u00d3\u00d4\u00d5\u00d6\u00d9\u00da\u00db\u00dc\u00dd\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5\u00e7\u00e8\u00e9\u00ea\u00eb\u00ec\u00ed\u00ee\u00ef\u00f1\u00f2\u00f3\u00f4\u00f5\u00f6\u00f9\u00fa\u00fb\u00fc\u00fd\u00ff'];

/** Rounds component offsets to whole cells so composed letters stay on the grid. */
export function snapComponents(font, names, size) {
  for (const name of names) {
    for (const c of font.glyphs[name]?.components || []) {
      c.dx = Math.round((c.dx || 0) / size) * size;
      c.dy = Math.round((c.dy || 0) / size) * size;
    }
  }
}
