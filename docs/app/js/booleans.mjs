// Raster boolean operations for freehand editing: the eraser subtracts a
// stroke from the outlines, and union merges overlapping shapes when the core
// vector boolean is not wanted. Shapes are rendered with antialiasing, the
// edge is recovered with sub pixel accuracy by marching squares on the
// coverage values, and the loops are fitted back to quadratic curves.
import { bbox, flatten, polyArea, polygonToContour, reverse, simplifyPoly, tracePath, winding } from './geom.mjs';

const MAX_PX = 2400;

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Renders contours (and an optional cutter polygon) into a coverage grid.
 * Returns { grid: Float32Array (0..1), w, h, toFont(px, py) }.
 */
function rasterize(contours, box, cutters = [], pxPerUnit = 1.5) {
  const pad = 4;
  const bw = box.xMax - box.xMin;
  const bh = box.yMax - box.yMin;
  const s = Math.min(pxPerUnit, (MAX_PX - pad * 2) / Math.max(bw, bh, 1));
  const w = Math.ceil(bw * s) + pad * 2;
  const h = Math.ceil(bh * s) + pad * 2;
  const cv = makeCanvas(w, h);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const tf = (x, y) => [(x - box.xMin) * s + pad, (box.yMax - y) * s + pad];
  ctx.fillStyle = '#000';
  ctx.beginPath();
  tracePath(ctx, contours, tf);
  ctx.fill('nonzero');
  if (cutters.length) {
    ctx.globalCompositeOperation = 'destination-out';
    for (const poly of cutters) {
      ctx.beginPath();
      poly.forEach((p, i) => (i ? ctx.lineTo(...tf(p.x, p.y)) : ctx.moveTo(...tf(p.x, p.y))));
      ctx.closePath();
      ctx.fill('nonzero');
    }
  }
  const data = ctx.getImageData(0, 0, w, h).data;
  const grid = new Float32Array(w * h);
  for (let i = 0; i < grid.length; i++) grid[i] = data[i * 4 + 3] / 255;
  return { grid, w, h, toFont: (px, py) => ({ x: (px - pad) / s + box.xMin, y: box.yMax - (py - pad) / s }), scale: s };
}

/**
 * Marching squares on a coverage grid at level 0.5. Returns closed loops in
 * grid coordinates (pixel centers), each a list of {x, y}.
 */
export function marchingSquares(grid, w, h, level = 0.5) {
  const v = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : grid[y * w + x]);
  // Edge ids: horizontal edge (x,y)-(x+1,y) = 2*(y*(w+1)+x); vertical edge (x,y)-(x,y+1) = 2*(...)+1.
  const W = w + 2;
  const hEdge = (x, y) => 2 * (y * W + x + W + 1);
  const vEdge = (x, y) => 2 * (y * W + x + W + 1) + 1;
  const point = new Map();
  const edgePoint = (id, ax, ay, bx, by) => {
    let p = point.get(id);
    if (!p) {
      const va = v(ax, ay);
      const vb = v(bx, by);
      const t = va === vb ? 0.5 : (level - va) / (vb - va);
      p = { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
      point.set(id, p);
    }
    return p;
  };
  const next = new Map(); // edge id -> next edge id (directed, inside on the right)
  for (let y = -1; y < h; y++) {
    for (let x = -1; x < w; x++) {
      const tl = v(x, y) >= level ? 1 : 0;
      const tr = v(x + 1, y) >= level ? 1 : 0;
      const br = v(x + 1, y + 1) >= level ? 1 : 0;
      const bl = v(x, y + 1) >= level ? 1 : 0;
      const idx = (tl << 3) | (tr << 2) | (br << 1) | bl;
      if (idx === 0 || idx === 15) continue;
      const top = hEdge(x, y);
      const bottom = hEdge(x, y + 1);
      const left = vEdge(x, y);
      const right = vEdge(x + 1, y);
      edgePoint(top, x, y, x + 1, y);
      edgePoint(bottom, x, y + 1, x + 1, y + 1);
      edgePoint(left, x, y, x, y + 1);
      edgePoint(right, x + 1, y, x + 1, y + 1);
      const link = (a, b) => next.set(a, b);
      const center = (v(x, y) + v(x + 1, y) + v(x + 1, y + 1) + v(x, y + 1)) / 4 >= level;
      switch (idx) {
        case 1: link(bottom, left); break;
        case 2: link(right, bottom); break;
        case 3: link(right, left); break;
        case 4: link(top, right); break;
        case 5:
          if (center) { link(top, left); link(bottom, right); } else { link(top, right); link(bottom, left); }
          break;
        case 6: link(top, bottom); break;
        case 7: link(top, left); break;
        case 8: link(left, top); break;
        case 9: link(bottom, top); break;
        case 10:
          if (center) { link(left, bottom); link(right, top); } else { link(left, top); link(right, bottom); }
          break;
        case 11: link(right, top); break;
        case 12: link(left, right); break;
        case 13: link(bottom, right); break;
        case 14: link(left, bottom); break;
      }
    }
  }
  const loops = [];
  const seen = new Set();
  for (const startId of next.keys()) {
    if (seen.has(startId)) continue;
    const loop = [];
    let id = startId;
    while (id !== undefined && !seen.has(id)) {
      seen.add(id);
      loop.push(point.get(id));
      id = next.get(id);
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

/** Simplifies a closed loop: split at the point farthest from the start. */
function simplifyClosed(loop, tol) {
  if (loop.length < 4) return loop.slice();
  let k = 0;
  let best = -1;
  for (let i = 1; i < loop.length; i++) {
    const d = (loop[i].x - loop[0].x) ** 2 + (loop[i].y - loop[0].y) ** 2;
    if (d > best) {
      best = d;
      k = i;
    }
  }
  const a = simplifyPoly(loop.slice(0, k + 1), tol);
  const b = simplifyPoly([...loop.slice(k), loop[0]], tol);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

/** Converts traced loops (font units) to oriented quadratic contours. */
export function loopsToContours(loops, core, { tolerance = 0.6, fitError = 1.5, minArea = 6 } = {}) {
  const polys = loops.map((l) => simplifyClosed(l, tolerance)).filter((p) => p.length >= 3 && Math.abs(polyArea(p)) >= minArea);
  const out = [];
  polys.forEach((poly, i) => {
    let depth = 0;
    const probe = poly[0];
    polys.forEach((other, j) => {
      if (j !== i && winding(probe.x, probe.y, [other]) !== 0) depth++;
    });
    const wantClockwise = depth % 2 === 0;
    const c = polygonToContour(poly, core, fitError);
    if (!c) return;
    const cw = polyArea(flatten(c)) < 0;
    out.push(cw === wantClockwise ? c : reverse(c));
  });
  return out;
}

function trace(contours, box, cutters, core) {
  const r = rasterize(contours, box, cutters);
  const loops = marchingSquares(r.grid, r.w, r.h).map((l) => l.map((p) => r.toFont(p.x + 0.5, p.y + 0.5)));
  return loopsToContours(loops, core, { tolerance: Math.max(0.35, 0.6 / r.scale), fitError: Math.max(1, 1.2 / r.scale) });
}

const overlaps = (a, b) => a && b && a.xMin <= b.xMax && b.xMin <= a.xMax && a.yMin <= b.yMax && b.yMin <= a.yMax;

/**
 * Subtracts polygons (font units) from contours. Contours that do not touch
 * the cutters are returned unchanged.
 */
export function subtract(contours, cutters, core) {
  const cb = bbox(cutters.map((p) => ({ points: p })));
  if (!cb) return contours;
  const touched = [];
  const kept = [];
  for (const c of contours) (overlaps(bbox([c]), cb) ? touched : kept).push(c);
  if (!touched.length) return contours;
  const box = bbox(touched);
  return [...kept, ...trace(touched, box, cutters, core)];
}

/** Union of all contours by raster tracing (used when a vector union fails). */
export function rasterUnion(contours, core) {
  const box = bbox(contours);
  if (!box) return contours;
  return trace(contours, box, [], core);
}

/** Traces an image (ImageData) into contours in a target box, by luminance threshold. */
export function traceImage(imageData, { threshold = 0.5, invert = false, box }, core) {
  const { width: w, height: h, data } = imageData;
  const grid = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3] / 255;
    const lum = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
    const ink = 1 - (lum * a + (1 - a));
    grid[i] = invert ? 1 - ink : ink;
  }
  const s = Math.min((box.xMax - box.xMin) / w, (box.yMax - box.yMin) / h);
  const ox = box.xMin + ((box.xMax - box.xMin) - w * s) / 2;
  const loops = marchingSquares(grid, w, h, Math.min(0.95, Math.max(0.05, threshold))).map((l) => l.map((p) => ({ x: ox + (p.x + 0.5) * s, y: box.yMax - (p.y + 0.5) * s })));
  return loopsToContours(loops, core, { tolerance: Math.max(0.6, s * 0.4), fitError: Math.max(1.5, s * 0.8), minArea: s * s * 6 });
}
