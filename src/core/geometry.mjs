// Outline geometry: TrueType quadratic contours, curve fitting, cubic to
// quadratic conversion, direction correction, overlap removal and pressure
// sensitive strokes.
//
// Coordinates are font units with the Y axis pointing up. A clockwise
// contour has a negative signed area here (TrueType outer contours are
// clockwise; CFF outer contours are counter clockwise).

/** @typedef {import('./model.mjs').Contour} Contour */
/** @typedef {import('./model.mjs').Point} Point */
/** @typedef {{ x: number, y: number }} Vec */
/** @typedef {{ x0: number, y0: number, x1: number, y1: number, cx?: number, cy?: number }} Segment */

const EPS = 1e-9;

/* ------------------------------------------------------------------ */
/* Segments                                                            */
/* ------------------------------------------------------------------ */

/**
 * Splits a quadratic contour into line and quadratic segments, expanding the
 * implied on curve points between consecutive off curve points.
 * Segments with a `cx`/`cy` control are quadratic, the others are lines.
 * @param {Contour} contour
 * @returns {Segment[]}
 */
export function contourSegments(contour) {
  const pts = contour.points;
  const n = pts.length;
  if (n === 0) return [];
  // Find an on curve start, or synthesize one between the first two off points.
  let start = pts.findIndex((p) => p.on);
  /** @type {Point[]} */
  let ring;
  if (start < 0) {
    const a = pts[n - 1];
    const b = pts[0];
    ring = [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true }, ...pts];
  } else {
    ring = [...pts.slice(start), ...pts.slice(0, start)];
  }
  const segs = [];
  const m = ring.length;
  let cur = ring[0];
  let ctrl = null;
  const closed = contour.closed !== false;
  const limit = closed ? m + 1 : m;
  for (let k = 1; k < limit; k++) {
    const p = ring[k % m];
    if (p.on) {
      if (ctrl) segs.push({ x0: cur.x, y0: cur.y, cx: ctrl.x, cy: ctrl.y, x1: p.x, y1: p.y });
      else if (p.x !== cur.x || p.y !== cur.y) segs.push({ x0: cur.x, y0: cur.y, x1: p.x, y1: p.y });
      cur = p;
      ctrl = null;
    } else if (ctrl) {
      const mid = { x: (ctrl.x + p.x) / 2, y: (ctrl.y + p.y) / 2, on: true };
      segs.push({ x0: cur.x, y0: cur.y, cx: ctrl.x, cy: ctrl.y, x1: mid.x, y1: mid.y });
      cur = mid;
      ctrl = p;
    } else {
      ctrl = p;
    }
  }
  if (ctrl && !closed) segs.push({ x0: cur.x, y0: cur.y, x1: ctrl.x, y1: ctrl.y });
  return segs;
}

/**
 * Builds a quadratic contour from segments (the inverse of contourSegments).
 * @param {Segment[]} segs
 * @returns {Contour}
 */
export function contourFromSegments(segs) {
  /** @type {Point[]} */
  const points = [];
  for (const s of segs) {
    points.push({ x: s.x0, y: s.y0, on: true });
    if (s.cx !== undefined) points.push({ x: s.cx, y: /** @type {number} */ (s.cy), on: false });
  }
  return { closed: true, points };
}

/** @param {Segment} s @param {number} t @returns {Vec} */
export function segmentPoint(s, t) {
  if (s.cx === undefined) return { x: s.x0 + (s.x1 - s.x0) * t, y: s.y0 + (s.y1 - s.y0) * t };
  const mt = 1 - t;
  return {
    x: mt * mt * s.x0 + 2 * mt * t * s.cx + t * t * s.x1,
    y: mt * mt * s.y0 + 2 * mt * t * /** @type {number} */ (s.cy) + t * t * s.y1,
  };
}

/** @param {Segment} s @param {number} t @returns {Vec} */
function segmentTangent(s, t) {
  if (s.cx === undefined) return { x: s.x1 - s.x0, y: s.y1 - s.y0 };
  const cy = /** @type {number} */ (s.cy);
  let x = 2 * (1 - t) * (s.cx - s.x0) + 2 * t * (s.x1 - s.cx);
  let y = 2 * (1 - t) * (cy - s.y0) + 2 * t * (s.y1 - cy);
  if (Math.abs(x) < EPS && Math.abs(y) < EPS) {
    x = s.x1 - s.x0;
    y = s.y1 - s.y0;
  }
  return { x, y };
}

/** Splits a segment at parameter t into two. @param {Segment} s @param {number} t */
function splitSegment(s, t) {
  const p = segmentPoint(s, t);
  if (s.cx === undefined) {
    return [{ x0: s.x0, y0: s.y0, x1: p.x, y1: p.y }, { x0: p.x, y0: p.y, x1: s.x1, y1: s.y1 }];
  }
  const cy = /** @type {number} */ (s.cy);
  const a = { x: s.x0 + (s.cx - s.x0) * t, y: s.y0 + (cy - s.y0) * t };
  const b = { x: s.cx + (s.x1 - s.cx) * t, y: cy + (s.y1 - cy) * t };
  return [
    { x0: s.x0, y0: s.y0, cx: a.x, cy: a.y, x1: p.x, y1: p.y },
    { x0: p.x, y0: p.y, cx: b.x, cy: b.y, x1: s.x1, y1: s.y1 },
  ];
}

/** Sub segment between parameters t0 < t1. @param {Segment} s @param {number} t0 @param {number} t1 */
function subSegment(s, t0, t1) {
  let seg = s;
  if (t1 < 1) seg = splitSegment(seg, t1)[0];
  if (t0 > 0) seg = splitSegment(seg, t0 / t1)[1];
  return seg;
}

/* ------------------------------------------------------------------ */
/* Measurements                                                        */
/* ------------------------------------------------------------------ */

/**
 * Exact bounding box of contours (curve extrema included). Accepts a list of
 * contours, a single contour or a list of points. Empty input gives zeros.
 * @param {Contour[] | Contour | Vec[]} input
 * @returns {{ xMin: number, yMin: number, xMax: number, yMax: number }}
 */
export function bounds(input) {
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  const add = (x, y) => {
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  };
  /** @type {Contour[]} */
  let contours;
  if (Array.isArray(input) && input.length && 'x' in input[0]) {
    for (const p of /** @type {Vec[]} */ (input)) add(p.x, p.y);
    contours = [];
  } else if (Array.isArray(input)) contours = /** @type {Contour[]} */ (input);
  else contours = input ? [input] : [];
  for (const c of contours) {
    for (const s of contourSegments(c)) {
      add(s.x0, s.y0);
      add(s.x1, s.y1);
      if (s.cx !== undefined) {
        const cy = /** @type {number} */ (s.cy);
        for (const [a, b, cc] of [[s.x0, s.x1, s.cx], [s.y0, s.y1, cy]]) {
          const den = a - 2 * cc + b;
          if (Math.abs(den) > EPS) {
            const t = (a - cc) / den;
            if (t > 0 && t < 1) {
              const p = segmentPoint(s, t);
              add(p.x, p.y);
            }
          }
        }
      }
    }
    if (c.points.length === 1) add(c.points[0].x, c.points[0].y);
  }
  if (xMin === Infinity) return { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
  return { xMin, yMin, xMax, yMax };
}

/**
 * Control box: the bounds of every point, on or off curve. This is what
 * TrueType glyph headers store.
 * @param {Contour[]} contours
 */
export function controlBounds(contours) {
  const pts = [];
  for (const c of contours) for (const p of c.points) pts.push(p);
  return pts.length ? bounds(pts) : { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
}

/**
 * Signed area of a contour (curves included exactly). Positive means counter
 * clockwise with the Y axis up; TrueType outer contours are negative.
 * @param {Contour} contour
 */
export function contourArea(contour) {
  let a = 0;
  for (const s of contourSegments({ ...contour, closed: true })) {
    const chord = s.x0 * s.y1 - s.x1 * s.y0;
    a += chord / 2;
    if (s.cx !== undefined) {
      const cy = /** @type {number} */ (s.cy);
      a += (s.x0 * cy - s.cx * s.y0 + s.cx * s.y1 - s.x1 * cy - chord) / 3;
    }
  }
  return a;
}

/**
 * Flattens a contour into a polygon with at most `tolerance` units of error.
 * @param {Contour} contour
 * @param {number} [tolerance]
 * @returns {Vec[]}
 */
export function flattenContour(contour, tolerance = 0.5) {
  const out = [];
  for (const s of contourSegments(contour)) {
    out.push({ x: s.x0, y: s.y0 });
    if (s.cx !== undefined) {
      const cy = /** @type {number} */ (s.cy);
      const dd = Math.hypot(s.x0 - 2 * s.cx + s.x1, s.y0 - 2 * cy + s.y1);
      const n = Math.max(1, Math.min(64, Math.ceil(Math.sqrt(dd / (4 * tolerance)))));
      for (let i = 1; i < n; i++) out.push(segmentPoint(s, i / n));
    }
  }
  return out;
}

/**
 * Nonzero winding number of a point against contours (curves exact).
 * @param {number} x
 * @param {number} y
 * @param {Contour[] | Segment[][]} contoursOrSegments
 */
export function windingNumber(x, y, contoursOrSegments) {
  let w = 0;
  for (const item of contoursOrSegments) {
    const segs = Array.isArray(item) ? item : contourSegments({ ...item, closed: true });
    for (const s of segs) w += segmentWinding(s, x, y);
  }
  return w;
}

/**
 * Signed crossings of a ray from (x, y) towards +x with a segment. Curves are
 * split into y monotone parts and every part uses the half open [low, high)
 * rule, so a ray through a shared vertex is counted exactly once and a ray
 * that only touches an extremum is not counted. A crossing at parameter
 * `skipT` (the query point itself) is ignored.
 * @param {Segment} s
 * @param {number} x
 * @param {number} y
 * @param {number} [skipT]
 */
function segmentWinding(s, x, y, skipT = -1) {
  if (s.cx === undefined) return skipT >= 0 ? 0 : lineWinding(s.x0, s.y0, s.x1, s.y1, x, y);
  const cy = /** @type {number} */ (s.cy);
  if ((s.y0 < y && cy < y && s.y1 < y) || (s.y0 > y && cy > y && s.y1 > y)) return 0;
  if (s.x0 <= x && s.cx <= x && s.x1 <= x) return 0;
  const a = s.y0 - 2 * cy + s.y1;
  const b = 2 * (cy - s.y0);
  const ts = [0];
  if (Math.abs(a) > 1e-12) {
    const te = -b / (2 * a);
    if (te > 1e-12 && te < 1 - 1e-12) ts.push(te);
  }
  ts.push(1);
  let w = 0;
  for (let k = 0; k + 1 < ts.length; k++) {
    const ta = ts[k];
    const tb = ts[k + 1];
    const ya = k === 0 ? s.y0 : segmentPoint(s, ta).y;
    const yb = k + 2 === ts.length ? s.y1 : segmentPoint(s, tb).y;
    if (ya === yb) continue;
    const up = yb > ya;
    if (y < (up ? ya : yb) || y >= (up ? yb : ya)) continue;
    const t = monotoneRoot(a, b, s.y0 - y, ta, tb);
    if (skipT >= 0 && Math.abs(t - skipT) < 1e-6) continue;
    if (segmentPoint(s, t).x <= x) continue;
    w += up ? 1 : -1;
  }
  return w;
}

/** Root of a t^2 + b t + c inside [ta, tb], where the polynomial is monotone. */
function monotoneRoot(a, b, c, ta, tb) {
  let t;
  if (Math.abs(a) < 1e-12) t = Math.abs(b) > 1e-300 ? -c / b : ta;
  else {
    const disc = Math.max(0, b * b - 4 * a * c);
    const sq = Math.sqrt(disc);
    const q = -0.5 * (b + (b >= 0 ? sq : -sq));
    const r1 = q / a;
    const r2 = q !== 0 ? c / q : r1;
    const mid = (ta + tb) / 2;
    t = Math.abs(r1 - mid) <= Math.abs(r2 - mid) ? r1 : r2;
  }
  return t < ta ? ta : t > tb ? tb : t;
}

function lineWinding(x0, y0, x1, y1, x, y) {
  if (y0 === y1) return 0;
  const up = y1 > y0;
  const lo = up ? y0 : y1;
  const hi = up ? y1 : y0;
  if (y < lo || y >= hi) return 0;
  const t = (y - y0) / (y1 - y0);
  const px = x0 + (x1 - x0) * t;
  if (px <= x) return 0;
  return up ? 1 : -1;
}

/* ------------------------------------------------------------------ */
/* Direction                                                           */
/* ------------------------------------------------------------------ */

/** Reverses a contour, keeping the on/off pattern valid. @param {Contour} contour @returns {Contour} */
export function reverseContour(contour) {
  const pts = contour.points;
  if (pts.length < 2) return { ...contour, points: [...pts] };
  // Keep the first point first so the start point does not move.
  return { ...contour, points: [pts[0], ...pts.slice(1).reverse()] };
}

/**
 * Sets contour directions from their nesting: outer contours clockwise
 * (TrueType convention), holes counter clockwise, islands inside holes
 * clockwise again. Pass `{ clockwiseOuter: false }` for the PostScript
 * convention. Returns new contours; the input is not changed.
 * @param {Contour[]} contours
 * @param {{ clockwiseOuter?: boolean }} [options]
 * @returns {Contour[]}
 */
export function correctDirection(contours, options = {}) {
  const clockwiseOuter = options.clockwiseOuter !== false;
  const polys = contours.map((c) => flattenContour(c, 1));
  const areas = contours.map((c) => contourArea(c));
  return contours.map((c, i) => {
    if (Math.abs(areas[i]) < EPS || c.points.length < 3) return { ...c, points: [...c.points] };
    const probe = interiorProbe(polys[i], areas[i]);
    let depth = 0;
    for (let j = 0; j < contours.length; j++) {
      // Only a larger contour can contain this one.
      if (j === i || Math.abs(areas[j]) <= Math.abs(areas[i])) continue;
      if (polygonContains(polys[j], probe.x, probe.y)) depth++;
    }
    const wantClockwise = depth % 2 === 0 ? clockwiseOuter : !clockwiseOuter;
    const isClockwise = areas[i] < 0;
    return isClockwise === wantClockwise ? { ...c, points: [...c.points] } : reverseContour(c);
  });
}

/** A point just inside a polygon near its first edge. @param {Vec[]} poly @param {number} area */
function interiorProbe(poly, area) {
  // Try edge midpoints, nudged towards the interior side, until one is inside.
  const sign = area > 0 ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const nx = (-dy / len) * sign;
    const ny = (dx / len) * sign;
    const p = { x: (a.x + b.x) / 2 + nx * 0.01, y: (a.y + b.y) / 2 + ny * 0.01 };
    if (polygonContains(poly, p.x, p.y)) return p;
  }
  return poly[0];
}

/** Even odd point in polygon. @param {Vec[]} poly */
function polygonContains(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/* ------------------------------------------------------------------ */
/* SVG path output                                                     */
/* ------------------------------------------------------------------ */

/**
 * SVG path data for contours (`M`, `L`, `Q`, `Z`). With `flipY` the Y axis is
 * flipped for screen coordinates: `true` negates Y and a number `h` maps
 * `y` to `h - y` (pass the ascender to put the top of the em at 0).
 * @param {Contour[] | Contour} contours
 * @param {{ flipY?: boolean | number, decimals?: number }} [options]
 * @returns {string}
 */
export function pathFromPoints(contours, options = {}) {
  const list = Array.isArray(contours) ? contours : [contours];
  const d = options.decimals ?? 2;
  const flip = options.flipY;
  const fy = flip === true ? (y) => -y : typeof flip === 'number' ? (y) => flip - y : (y) => y;
  const f = (v) => {
    const r = Number(v.toFixed(d));
    return String(Object.is(r, -0) ? 0 : r);
  };
  const parts = [];
  for (const c of list) {
    const segs = contourSegments(c);
    if (!segs.length) continue;
    parts.push(`M${f(segs[0].x0)} ${f(fy(segs[0].y0))}`);
    for (const s of segs) {
      if (s.cx !== undefined) parts.push(`Q${f(s.cx)} ${f(fy(/** @type {number} */ (s.cy)))} ${f(s.x1)} ${f(fy(s.y1))}`);
      else parts.push(`L${f(s.x1)} ${f(fy(s.y1))}`);
    }
    if (c.closed !== false) parts.push('Z');
  }
  return parts.join('');
}

/* ------------------------------------------------------------------ */
/* Simplification and curve fitting                                    */
/* ------------------------------------------------------------------ */

/**
 * Ramer Douglas Peucker polyline simplification. Keeps the first and last
 * points and every point farther than `tolerance` from the simplified line.
 * Extra properties on points (such as pressure) are preserved.
 * @template {Vec} T
 * @param {T[]} points
 * @param {number} [tolerance]
 * @returns {T[]}
 */
export function simplify(points, tolerance = 1) {
  if (points.length <= 2) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const tol2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = /** @type {[number, number]} */ (stack.pop());
    let maxD = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segmentDistanceSq(points[i], points[a], points[b]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > tol2) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** @param {Vec} p @param {Vec} a @param {Vec} b */
function segmentDistanceSq(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = a.x + dx * t - p.x;
  const qy = a.y + dy * t - p.y;
  return qx * qx + qy * qy;
}

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add2 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const len = (a) => Math.hypot(a.x, a.y);
const norm = (a) => {
  const l = len(a);
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};

/** @typedef {[Vec, Vec, Vec, Vec]} Cubic */

/**
 * Philip J. Schneider's algorithm ("An Algorithm for Automatically Fitting
 * Digitized Curves", Graphics Gems, 1990): fits a chain of cubic Bezier
 * curves through `points` with at most `error` units of deviation.
 * @param {Vec[]} points
 * @param {number} [error]
 * @param {{ leftTangent?: Vec, rightTangent?: Vec }} [options]
 * @returns {Cubic[]}
 */
export function fitCurves(points, error = 1, options = {}) {
  const d = dedupe(points);
  if (d.length < 2) return [];
  const tHat1 = options.leftTangent ? norm(options.leftTangent) : norm(sub(d[1], d[0]));
  const tHat2 = options.rightTangent ? norm(options.rightTangent) : norm(sub(d[d.length - 2], d[d.length - 1]));
  /** @type {Cubic[]} */
  const out = [];
  fitCubic(d, 0, d.length - 1, tHat1, tHat2, error, out, 0);
  return out;
}

/** @param {Vec[]} points */
function dedupe(points) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 1e-9 || Math.abs(last.y - p.y) > 1e-9) out.push({ x: p.x, y: p.y });
  }
  return out;
}

function fitCubic(d, first, last, tHat1, tHat2, error, out, depth) {
  const nPts = last - first + 1;
  if (nPts === 2 || depth > 40) {
    const dist = len(sub(d[last], d[first])) / 3;
    out.push([d[first], add2(d[first], mul(tHat1, dist)), add2(d[last], mul(tHat2, dist)), d[last]]);
    return;
  }
  let u = chordLengthParameterize(d, first, last);
  let bez = generateBezier(d, first, last, u, tHat1, tHat2);
  let [maxError, split] = computeMaxError(d, first, last, bez, u);
  if (maxError < error * error) {
    out.push(bez);
    return;
  }
  if (maxError < error * error * 16) {
    for (let i = 0; i < 20; i++) {
      const uPrime = reparameterize(d, first, last, u, bez);
      bez = generateBezier(d, first, last, uPrime, tHat1, tHat2);
      [maxError, split] = computeMaxError(d, first, last, bez, uPrime);
      if (maxError < error * error) {
        out.push(bez);
        return;
      }
      u = uPrime;
    }
  }
  let tHatCenter = norm(sub(d[split - 1], d[split + 1]));
  if (len(tHatCenter) < EPS) tHatCenter = norm({ x: -(d[split].y - d[split - 1].y), y: d[split].x - d[split - 1].x });
  fitCubic(d, first, split, tHat1, tHatCenter, error, out, depth + 1);
  fitCubic(d, split, last, mul(tHatCenter, -1), tHat2, error, out, depth + 1);
}

function chordLengthParameterize(d, first, last) {
  const u = [0];
  for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1] + len(sub(d[i], d[i - 1])));
  const total = u[u.length - 1] || 1;
  return u.map((v) => v / total);
}

function bezierPoint(bez, t) {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const e = t * t * t;
  return { x: a * bez[0].x + b * bez[1].x + c * bez[2].x + e * bez[3].x, y: a * bez[0].y + b * bez[1].y + c * bez[2].y + e * bez[3].y };
}

function generateBezier(d, first, last, u, tHat1, tHat2) {
  const p0 = d[first];
  const p3 = d[last];
  let c00 = 0;
  let c01 = 0;
  let c11 = 0;
  let x0 = 0;
  let x1 = 0;
  for (let i = 0; i < u.length; i++) {
    const t = u[i];
    const mt = 1 - t;
    const b0 = mt * mt * mt;
    const b1 = 3 * t * mt * mt;
    const b2 = 3 * t * t * mt;
    const b3 = t * t * t;
    const a0 = mul(tHat1, b1);
    const a1 = mul(tHat2, b2);
    c00 += dot(a0, a0);
    c01 += dot(a0, a1);
    c11 += dot(a1, a1);
    const tmp = sub(d[first + i], add2(mul(p0, b0 + b1), mul(p3, b2 + b3)));
    x0 += dot(a0, tmp);
    x1 += dot(a1, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  let alphaL = Math.abs(det) > 1e-12 ? (x0 * c11 - x1 * c01) / det : 0;
  let alphaR = Math.abs(det) > 1e-12 ? (c00 * x1 - c01 * x0) / det : 0;
  const segLength = len(sub(p3, p0));
  const epsilon = 1e-6 * segLength;
  if (alphaL < epsilon || alphaR < epsilon) {
    alphaL = segLength / 3;
    alphaR = segLength / 3;
  }
  return /** @type {Cubic} */ ([p0, add2(p0, mul(tHat1, alphaL)), add2(p3, mul(tHat2, alphaR)), p3]);
}

function computeMaxError(d, first, last, bez, u) {
  let maxDist = 0;
  let split = Math.floor((last - first + 1) / 2) + first;
  for (let i = first + 1; i < last; i++) {
    const p = bezierPoint(bez, u[i - first]);
    const v = sub(p, d[i]);
    const dist = dot(v, v);
    if (dist >= maxDist) {
      maxDist = dist;
      split = i;
    }
  }
  if (split <= first) split = first + 1;
  if (split >= last) split = last - 1;
  return [maxDist, split];
}

function reparameterize(d, first, last, u, bez) {
  return u.map((t, i) => newtonRoot(bez, d[first + i], t));
}

function newtonRoot(q, p, t) {
  const mt = 1 - t;
  const qt = bezierPoint(q, t);
  const q1 = [mul(sub(q[1], q[0]), 3), mul(sub(q[2], q[1]), 3), mul(sub(q[3], q[2]), 3)];
  const q2 = [mul(sub(q1[1], q1[0]), 2), mul(sub(q1[2], q1[1]), 2)];
  const q1t = add2(add2(mul(q1[0], mt * mt), mul(q1[1], 2 * mt * t)), mul(q1[2], t * t));
  const q2t = add2(mul(q2[0], mt), mul(q2[1], t));
  const diff = sub(qt, p);
  const num = dot(diff, q1t);
  const den = dot(q1t, q1t) + dot(diff, q2t);
  if (Math.abs(den) < 1e-12) return t;
  const r = t - num / den;
  return Math.max(0, Math.min(1, r));
}

/**
 * Converts one cubic Bezier into quadratic TrueType points with at most
 * `tolerance` units of error. The result excludes the start point `p0`
 * and ends with `p3` as an on curve point.
 * @param {Vec} p0
 * @param {Vec} p1
 * @param {Vec} p2
 * @param {Vec} p3
 * @param {number} [tolerance]
 * @returns {Point[]}
 */
export function cubicToQuadratic(p0, p1, p2, p3, tolerance = 1) {
  /** @type {Cubic} */
  const cubic = [p0, p1, p2, p3];
  for (let n = 1; n <= 16; n++) {
    const pieces = splitCubicEvenly(cubic, n);
    const quads = pieces.map(quadForCubic);
    let ok = true;
    for (let i = 0; i < n && ok; i++) {
      if (cubicQuadError(pieces[i], quads[i]) > tolerance) ok = false;
    }
    if (ok || n === 16) {
      /** @type {Point[]} */
      const out = [];
      for (let i = 0; i < n; i++) {
        out.push({ x: quads[i].x, y: quads[i].y, on: false });
        const end = pieces[i][3];
        out.push({ x: end.x, y: end.y, on: true });
      }
      return dropImpliedPoints(out, p0);
    }
  }
  return [{ x: p3.x, y: p3.y, on: true }];
}

/** Removes on curve points that sit exactly between two off curve neighbours. */
function dropImpliedPoints(points, start) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];
    const next = points[i + 1];
    if (p.on && prev && next && !prev.on && !next.on &&
      Math.abs((prev.x + next.x) / 2 - p.x) < 1e-6 && Math.abs((prev.y + next.y) / 2 - p.y) < 1e-6) continue;
    out.push(p);
  }
  void start;
  return out;
}

function quadForCubic(c) {
  // Least squares single quadratic control: average of the two tangent based guesses.
  return {
    x: (3 * (c[1].x + c[2].x) - c[0].x - c[3].x) / 4,
    y: (3 * (c[1].y + c[2].y) - c[0].y - c[3].y) / 4,
  };
}

function cubicQuadError(c, q) {
  let max = 0;
  for (let i = 1; i < 16; i++) {
    const t = i / 16;
    const a = bezierPoint(c, t);
    const mt = 1 - t;
    const b = { x: mt * mt * c[0].x + 2 * mt * t * q.x + t * t * c[3].x, y: mt * mt * c[0].y + 2 * mt * t * q.y + t * t * c[3].y };
    max = Math.max(max, Math.hypot(a.x - b.x, a.y - b.y));
  }
  return max;
}

/** @param {Cubic} c @param {number} t @returns {[Cubic, Cubic]} */
function splitCubic(c, t) {
  const lerp = (a, b) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const ab = lerp(c[0], c[1]);
  const bc = lerp(c[1], c[2]);
  const cd = lerp(c[2], c[3]);
  const abc = lerp(ab, bc);
  const bcd = lerp(bc, cd);
  const m = lerp(abc, bcd);
  return [[c[0], ab, abc, m], [m, bcd, cd, c[3]]];
}

/** @param {Cubic} c @param {number} n */
function splitCubicEvenly(c, n) {
  const out = [];
  let rest = c;
  for (let i = n; i > 1; i--) {
    const [a, b] = splitCubic(rest, 1 / i);
    out.push(a);
    rest = b;
  }
  out.push(rest);
  return out;
}

/**
 * Turns a chain of cubics (as returned by fitCurves) into a quadratic contour.
 * @param {Cubic[]} cubics
 * @param {{ tolerance?: number, closed?: boolean }} [options]
 * @returns {Contour}
 */
export function contourFromCubics(cubics, options = {}) {
  const tol = options.tolerance ?? 1;
  /** @type {Point[]} */
  const points = [];
  if (!cubics.length) return { closed: options.closed !== false, points };
  points.push({ x: cubics[0][0].x, y: cubics[0][0].y, on: true, type: 'corner' });
  for (const c of cubics) {
    const isLine = c[1].x === c[0].x && c[1].y === c[0].y && c[2].x === c[3].x && c[2].y === c[3].y;
    if (isLine || segmentDistanceSq(c[1], c[0], c[3]) + segmentDistanceSq(c[2], c[0], c[3]) < 1e-6) {
      points.push({ x: c[3].x, y: c[3].y, on: true });
    } else {
      points.push(...cubicToQuadratic(c[0], c[1], c[2], c[3], tol));
    }
  }
  const closed = options.closed !== false;
  if (closed && points.length > 1) {
    const a = points[0];
    const b = points[points.length - 1];
    if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) points.pop();
  }
  markSmoothPoints(points);
  return { closed, points };
}

/** Tags on curve points whose neighbours are collinear through them as smooth. @param {Point[]} points */
function markSmoothPoints(points) {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (!p.on) continue;
    const a = points[(i - 1 + n) % n];
    const b = points[(i + 1) % n];
    const u = norm(sub(p, a));
    const v = norm(sub(b, p));
    p.type = (!a.on || !b.on) && dot(u, v) > 0.995 ? 'smooth' : 'corner';
  }
}

/**
 * Fits a smooth quadratic contour through sampled points (for example a
 * traced bitmap edge or a freehand stroke). Corners sharper than
 * `cornerAngle` degrees are kept sharp.
 * @param {Vec[]} points
 * @param {{ error?: number, closed?: boolean, cornerAngle?: number, tolerance?: number }} [options]
 * @returns {Contour}
 */
export function fitContour(points, options = {}) {
  const error = options.error ?? 2;
  const closed = options.closed !== false;
  let pts = dedupe(points);
  if (closed && pts.length > 2) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) pts.pop();
  }
  if (pts.length < 3) return { closed, points: pts.map((p) => ({ x: p.x, y: p.y, on: true })) };
  const cornerCos = Math.cos(((options.cornerAngle ?? 60) * Math.PI) / 180);
  const n = pts.length;
  const corners = [];
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) continue;
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const u = norm(sub(pts[i], a));
    const v = norm(sub(b, pts[i]));
    if (dot(u, v) < cornerCos) corners.push(i);
  }
  /** @type {Cubic[]} */
  let cubics = [];
  if (!closed) {
    const cuts = [0, ...corners, n - 1];
    for (let k = 0; k + 1 < cuts.length; k++) cubics.push(...fitCurves(pts.slice(cuts[k], cuts[k + 1] + 1), error));
  } else if (!corners.length) {
    const ring = [...pts, pts[0]];
    const t = norm(sub(pts[1], pts[n - 1]));
    cubics = fitCurves(ring, error, { leftTangent: t, rightTangent: mul(t, -1) });
  } else {
    pts = [...pts.slice(corners[0]), ...pts.slice(0, corners[0])];
    const shifted = corners.map((c) => c - corners[0]);
    shifted.push(n);
    const ring = [...pts, pts[0]];
    for (let k = 0; k + 1 < shifted.length; k++) cubics.push(...fitCurves(ring.slice(shifted[k], shifted[k + 1] + 1), error));
  }
  return contourFromCubics(cubics, { tolerance: options.tolerance ?? Math.min(1, error / 2), closed });
}

/* ------------------------------------------------------------------ */
/* Overlap removal                                                     */
/* ------------------------------------------------------------------ */

/**
 * Boolean union of contours under the nonzero fill rule: splits every
 * segment at its intersections, keeps the pieces that separate filled from
 * empty space and links them into new contours. Curves stay exact
 * quadratics. Output contours follow the TrueType direction convention
 * (outer clockwise). Pass `{ fillRule: 'evenodd' }` to union with the even
 * odd rule instead.
 * @param {Contour[]} contours
 * @param {{ fillRule?: 'nonzero' | 'evenodd', minArea?: number }} [options]
 * @returns {Contour[]}
 */
export function removeOverlaps(contours, options = {}) {
  const evenOdd = options.fillRule === 'evenodd';
  const minArea = options.minArea ?? 0.5;
  /** @type {Segment[][]} */
  const rings = contours.filter((c) => c.points.length >= 2).map((c) => contourSegments({ ...c, closed: true }).filter((s) => !isDegenerate(s)));
  const all = [];
  rings.forEach((ring, r) => ring.forEach((s, i) => all.push({ s, r, i, n: ring.length, cuts: [] })));
  if (!all.length) return [];
  const scale = Math.max(1, ...all.map(({ s }) => Math.max(Math.abs(s.x0), Math.abs(s.y0), Math.abs(s.x1), Math.abs(s.y1))));
  const tolT = 1e-9;
  // Bounding boxes for quick rejection.
  const boxes = all.map(({ s }) => segBox(s));
  // Sweep along x: only pairs whose boxes overlap in x are tested.
  const order = all.map((_, i) => i).sort((p, q) => boxes[p].x0 - boxes[q].x0);
  const slack = 1e-7 * scale;
  for (let oa = 0; oa < order.length; oa++) {
    const a = order[oa];
    for (let ob = oa + 1; ob < order.length; ob++) {
      const b = order[ob];
      if (boxes[b].x0 > boxes[a].x1 + slack) break;
      if (!boxOverlap(boxes[a], boxes[b], slack)) continue;
      const A = all[Math.min(a, b)];
      const B = all[Math.max(a, b)];
      const adjacent = A.r === B.r && (Math.abs(A.i - B.i) === 1 || Math.abs(A.i - B.i) === A.n - 1);
      for (const [ta, tb] of intersectSegments(A.s, B.s)) {
        if (adjacent) {
          const shared = (A.i + 1) % A.n === B.i ? ta > 1 - 1e-7 && tb < 1e-7 : ta < 1e-7 && tb > 1 - 1e-7;
          if (shared) continue;
        }
        const pa = segmentPoint(A.s, ta);
        const pb = segmentPoint(B.s, tb);
        const p = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
        A.cuts.push({ t: ta, p });
        B.cuts.push({ t: tb, p });
      }
    }
  }
  // Split into pieces. Nearby vertices are merged so shared end points are
  // identical, which makes linking exact.
  const snapTol = Math.max(1e-6, scale * 1e-7);
  const grid = new Map();
  /** @type {Vec[]} */
  const vertices = [];
  const cellKey = (gx, gy) => gx * 134217728 + gy;
  const canon = (p) => {
    const gx = Math.round(p.x / snapTol);
    const gy = Math.round(p.y / snapTol);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const hit = grid.get(cellKey(gx + dx, gy + dy));
        if (hit !== undefined && Math.hypot(vertices[hit].x - p.x, vertices[hit].y - p.y) <= snapTol * 1.5) return hit;
      }
    }
    vertices.push({ x: p.x, y: p.y });
    grid.set(cellKey(gx, gy), vertices.length - 1);
    return vertices.length - 1;
  };
  const pieces = [];
  for (const item of all) {
    const cuts = item.cuts.filter((c) => c.t > tolT && c.t < 1 - tolT).sort((x, y) => x.t - y.t);
    const ts = [{ t: 0, v: canon({ x: item.s.x0, y: item.s.y0 }) }];
    for (const c of cuts) ts.push({ t: c.t, v: canon(c.p) });
    ts.push({ t: 1, v: canon({ x: item.s.x1, y: item.s.y1 }) });
    for (let k = 0; k + 1 < ts.length; k++) {
      if (ts[k + 1].t - ts[k].t < 1e-12) continue;
      if (ts[k].v === ts[k + 1].v) continue;
      const piece = /** @type {any} */ (subSegment(item.s, ts[k].t, ts[k + 1].t));
      piece.a = ts[k].v;
      piece.b = ts[k + 1].v;
      piece.x0 = vertices[piece.a].x;
      piece.y0 = vertices[piece.a].y;
      piece.x1 = vertices[piece.b].x;
      piece.y1 = vertices[piece.b].y;
      pieces.push(piece);
    }
  }
  // Classify each piece by the fill on both sides of its midpoint. The
  // winding number on the piece itself is computed with exact ray casting
  // (no offsets), so thin slivers and near tangent touches stay consistent.
  // Coincident pieces are grouped and judged together.
  const filled = (w) => (evenOdd ? (w & 1) === 1 : w !== 0);
  const ctrlKey = (q) => (q.cx === undefined ? '' : `${Math.round(q.cx / snapTol)},${Math.round(q.cy / snapTol)}`);
  const groups = new Map();
  for (const q of pieces) {
    const k = q.a < q.b ? `${q.a}|${q.b}|${ctrlKey(q)}` : `${q.b}|${q.a}|${ctrlKey(q)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(q);
  }
  const rotated = pieces.map(rotateSegment);
  const index = new RowIndex(pieces);
  const rotIndex = new RowIndex(rotated);
  pieces.forEach((q, i) => {
    q.index = i;
  });
  const kept = [];
  for (const group of groups.values()) {
    const rep = group[0];
    let net = 0;
    for (const q of group) net += q.a === rep.a ? 1 : -1;
    const tan = segmentTangent(rep, 0.5);
    const rot = Math.abs(tan.y) < 0.3 * Math.hypot(tan.x, tan.y);
    const list = rot ? rotated : pieces;
    const r = rot ? rotated[rep.index] : rep;
    const m = segmentPoint(r, 0.5);
    const up = (rot ? tan.x : tan.y) > 0;
    const members = new Set(group.map((q) => q.index));
    let base = 0;
    for (const i of (rot ? rotIndex : index).query(m.y)) {
      if (!members.has(i)) base += segmentWinding(list[i], m.x, m.y);
    }
    base += net * segmentWinding(r, m.x, m.y, 0.5);
    const wLeft = up ? base + net : base;
    const wRight = up ? base : base - net;
    const fl = filled(wLeft);
    if (fl === filled(wRight)) continue;
    // Keep filled area on the right (clockwise outer contours).
    kept.push(fl ? { ...reverseSegment(rep), a: rep.b, b: rep.a } : rep);
  }
  return linkPieces(kept).filter((c) => Math.abs(contourArea(c)) >= minArea);
}

/** Buckets segments by their y range so ray casting only visits candidates. */
class RowIndex {
  /** @param {Segment[]} segs */
  constructor(segs) {
    let lo = Infinity;
    let hi = -Infinity;
    const ranges = segs.map((q) => {
      const a = Math.min(q.y0, q.y1, q.cy ?? q.y0);
      const b = Math.max(q.y0, q.y1, q.cy ?? q.y0);
      if (a < lo) lo = a;
      if (b > hi) hi = b;
      return [a, b];
    });
    this.lo = lo;
    this.count = Math.max(1, Math.min(4096, Math.ceil(Math.sqrt(segs.length) * 2)));
    this.size = (hi - lo) / this.count || 1;
    /** @type {number[][]} */
    this.buckets = Array.from({ length: this.count }, () => []);
    ranges.forEach(([a, b], i) => {
      const from = this.bucket(a);
      const to = this.bucket(b);
      for (let k = from; k <= to; k++) this.buckets[k].push(i);
    });
  }

  /** @param {number} y */
  bucket(y) {
    return Math.max(0, Math.min(this.count - 1, Math.floor((y - this.lo) / this.size)));
  }

  /** @param {number} y */
  query(y) {
    return this.buckets[this.bucket(y)];
  }
}

/** Rotates a segment by 90 degrees counter clockwise (winding numbers are unchanged). @param {Segment} s */
function rotateSegment(s) {
  const out = { x0: -s.y0, y0: s.x0, x1: -s.y1, y1: s.x1 };
  if (s.cx !== undefined) Object.assign(out, { cx: -(/** @type {number} */ (s.cy)), cy: s.cx });
  return out;
}

/** @param {Segment} s */
function isDegenerate(s) {
  const d = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
  if (s.cx === undefined) return d < 1e-7;
  return d < 1e-7 && Math.hypot(s.cx - s.x0, /** @type {number} */ (s.cy) - s.y0) < 1e-7;
}

/** @param {Segment} s @returns {Segment} */
function reverseSegment(s) {
  return s.cx === undefined
    ? { x0: s.x1, y0: s.y1, x1: s.x0, y1: s.y0 }
    : { x0: s.x1, y0: s.y1, cx: s.cx, cy: s.cy, x1: s.x0, y1: s.y0 };
}

/** @param {Segment} s */
function segBox(s) {
  const xs = [s.x0, s.x1];
  const ys = [s.y0, s.y1];
  if (s.cx !== undefined) {
    xs.push(s.cx);
    ys.push(/** @type {number} */ (s.cy));
  }
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function boxOverlap(a, b, e) {
  return a.x0 <= b.x1 + e && b.x0 <= a.x1 + e && a.y0 <= b.y1 + e && b.y0 <= a.y1 + e;
}

/**
 * Intersection parameters of two segments.
 * @param {Segment} a
 * @param {Segment} b
 * @returns {Array<[number, number]>}
 */
export function intersectSegments(a, b) {
  const aLine = a.cx === undefined;
  const bLine = b.cx === undefined;
  if (aLine && bLine) return intersectLines(a, b);
  if (aLine) return intersectLineQuad(a, b);
  if (bLine) return intersectLineQuad(b, a).map(([tb, ta]) => [ta, tb]);
  return intersectQuads(a, b);
}

function intersectLines(a, b) {
  const dax = a.x1 - a.x0;
  const day = a.y1 - a.y0;
  const dbx = b.x1 - b.x0;
  const dby = b.y1 - b.y0;
  const den = dax * dby - day * dbx;
  const ex = b.x0 - a.x0;
  const ey = b.y0 - a.y0;
  const la = Math.hypot(dax, day);
  const lb = Math.hypot(dbx, dby);
  if (Math.abs(den) <= 1e-12 * la * lb) {
    // Parallel. Collinear overlaps contribute their end points as cuts.
    if (Math.abs(ex * day - ey * dax) > 1e-9 * la * (la + 1)) return [];
    const out = [];
    const projA = (x, y) => ((x - a.x0) * dax + (y - a.y0) * day) / (la * la);
    const projB = (x, y) => ((x - b.x0) * dbx + (y - b.y0) * dby) / (lb * lb);
    for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y1]]) {
      const t = projA(x, y);
      if (t > 1e-9 && t < 1 - 1e-9) out.push([t, projB(x, y)]);
    }
    for (const [x, y] of [[a.x0, a.y0], [a.x1, a.y1]]) {
      const t = projB(x, y);
      if (t > 1e-9 && t < 1 - 1e-9) out.push([projA(x, y), t]);
    }
    return out;
  }
  const ta = (ex * dby - ey * dbx) / den;
  const tb = (ex * day - ey * dax) / den;
  const e = 1e-10;
  if (ta < -e || ta > 1 + e || tb < -e || tb > 1 + e) return [];
  return [[clamp01(ta), clamp01(tb)]];
}

function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function intersectLineQuad(line, q) {
  const dx = line.x1 - line.x0;
  const dy = line.y1 - line.y0;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-18) return [];
  // Signed distance of quad points from the line, as a quadratic in t.
  const dist = (x, y) => (x - line.x0) * dy - (y - line.y0) * dx;
  const d0 = dist(q.x0, q.y0);
  const d1 = dist(q.cx, q.cy);
  const d2 = dist(q.x1, q.y1);
  const A = d0 - 2 * d1 + d2;
  const B = 2 * (d1 - d0);
  const C = d0;
  const roots = solveQuadratic(A, B, C);
  const out = [];
  for (const t of roots) {
    if (t < -1e-10 || t > 1 + 1e-10) continue;
    const tq = clamp01(t);
    const p = segmentPoint(q, tq);
    const tl = ((p.x - line.x0) * dx + (p.y - line.y0) * dy) / l2;
    if (tl < -1e-10 || tl > 1 + 1e-10) continue;
    out.push([clamp01(tl), tq]);
  }
  return out;
}

function solveQuadratic(a, b, c) {
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
  if (scale === 0) return [];
  if (Math.abs(a) < 1e-12 * scale) {
    if (Math.abs(b) < 1e-12 * scale) return [];
    return [-c / b];
  }
  const disc = b * b - 4 * a * c;
  if (disc < -1e-12 * scale * scale) return [];
  if (disc <= 0) return [-b / (2 * a)];
  const sq = Math.sqrt(disc);
  const q = -0.5 * (b + Math.sign(b || 1) * sq);
  const r1 = q / a;
  const r2 = Math.abs(q) > 1e-300 ? c / q : -b / a - r1;
  return [r1, r2];
}

function intersectQuads(a, b) {
  const found = [];
  const recurse = (sa, a0, a1, sb, b0, b1, depth) => {
    const ax0 = Math.min(sa.x0, sa.cx, sa.x1);
    const ax1 = Math.max(sa.x0, sa.cx, sa.x1);
    const ay0 = Math.min(sa.y0, sa.cy, sa.y1);
    const ay1 = Math.max(sa.y0, sa.cy, sa.y1);
    const bx0 = Math.min(sb.x0, sb.cx, sb.x1);
    const bx1 = Math.max(sb.x0, sb.cx, sb.x1);
    const by0 = Math.min(sb.y0, sb.cy, sb.y1);
    const by1 = Math.max(sb.y0, sb.cy, sb.y1);
    if (ax0 > bx1 + 1e-9 || bx0 > ax1 + 1e-9 || ay0 > by1 + 1e-9 || by0 > ay1 + 1e-9) return;
    const sizeA = Math.max(ax1 - ax0, ay1 - ay0);
    const sizeB = Math.max(bx1 - bx0, by1 - by0);
    if ((sizeA < 0.05 && sizeB < 0.05) || depth > 48) {
      const hit = intersectLines({ x0: sa.x0, y0: sa.y0, x1: sa.x1, y1: sa.y1 }, { x0: sb.x0, y0: sb.y0, x1: sb.x1, y1: sb.y1 });
      const [ta, tb] = hit[0] || [0.5, 0.5];
      found.push([a0 + (a1 - a0) * ta, b0 + (b1 - b0) * tb]);
      return;
    }
    if (sizeA >= sizeB) {
      const [l, r] = splitSegment(sa, 0.5);
      const am = (a0 + a1) / 2;
      recurse(l, a0, am, sb, b0, b1, depth + 1);
      recurse(r, am, a1, sb, b0, b1, depth + 1);
    } else {
      const [l, r] = splitSegment(sb, 0.5);
      const bm = (b0 + b1) / 2;
      recurse(sa, a0, a1, l, b0, bm, depth + 1);
      recurse(sa, a0, a1, r, bm, b1, depth + 1);
    }
  };
  recurse(a, 0, 1, b, 0, 1, 0);
  // Newton refinement of A(s) - B(t) = 0, then merge duplicates.
  const out = [];
  for (let [s, t] of found) {
    for (let k = 0; k < 20; k++) {
      const pa = segmentPoint(a, s);
      const pb = segmentPoint(b, t);
      const fx = pa.x - pb.x;
      const fy = pa.y - pb.y;
      if (fx * fx + fy * fy < 1e-24) break;
      const da = segmentTangent(a, s);
      const db = segmentTangent(b, t);
      const det = -da.x * db.y + da.y * db.x;
      if (Math.abs(det) < 1e-14) break;
      const ds = (-db.y * fx + db.x * fy) / det;
      const dt = (da.x * fy - da.y * fx) / det;
      s = clamp01(s - ds);
      t = clamp01(t - dt);
    }
    const pa = segmentPoint(a, s);
    const pb = segmentPoint(b, t);
    if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > 1e-3) continue;
    if (out.some(([s2, t2]) => Math.abs(s2 - s) < 1e-7 && Math.abs(t2 - t) < 1e-7)) continue;
    out.push([s, t]);
  }
  return out.length > 4 ? [] : out; // coincident curves: no reliable crossing
}

/**
 * Links directed pieces (with vertex ids `a` to `b`) into closed contours.
 * At vertices with several exits it takes the sharpest right turn, which
 * keeps contours that only touch at a point separate.
 */
function linkPieces(pieces) {
  const byStart = new Map();
  pieces.forEach((s, i) => {
    if (!byStart.has(s.a)) byStart.set(s.a, []);
    byStart.get(s.a).push(i);
  });
  const used = new Uint8Array(pieces.length);
  const contours = [];
  for (let i = 0; i < pieces.length; i++) {
    if (used[i]) continue;
    const chain = [];
    let cur = i;
    let closed = false;
    while (cur >= 0 && !used[cur]) {
      used[cur] = 1;
      const s = pieces[cur];
      chain.push(s);
      if (s.b === pieces[i].a) {
        closed = true;
        break;
      }
      const options = (byStart.get(s.b) || []).filter((j) => !used[j]);
      if (!options.length) break;
      cur = options[0];
      if (options.length > 1) {
        const inDir = norm(segmentTangent(s, 1));
        let bestAngle = Infinity;
        for (const j of options) {
          const outDir = norm(segmentTangent(pieces[j], 0));
          const angle = Math.atan2(inDir.x * outDir.y - inDir.y * outDir.x, dot(inDir, outDir));
          if (angle < bestAngle) {
            bestAngle = angle;
            cur = j;
          }
        }
      }
    }
    // An open chain is a sliver too thin to resolve: drop it.
    if (!closed) continue;
    if (chain.length >= 2) contours.push(mergeCollinear(contourFromSegments(chain)));
  }
  return contours;
}

/** Drops on curve points between two collinear lines. @param {Contour} c */
function mergeCollinear(c) {
  const pts = c.points;
  if (pts.length <= 3) return c;
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    if (p.on && a.on && b.on) {
      const cross = (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x);
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      if (Math.abs(cross) < 1e-6 * Math.max(1, l) && dot(sub(p, a), sub(b, p)) > 0) continue;
    }
    out.push(p);
  }
  return { ...c, points: out };
}

/* ------------------------------------------------------------------ */
/* Strokes                                                             */
/* ------------------------------------------------------------------ */

/**
 * Outlines a freehand stroke. `points` are samples along the pen path
 * (optionally with `pressure` between 0 and 1); `widthFn` returns the
 * stroke width at each sample (a number gives a constant width, and the
 * default uses `10 + pressure * 80`). The outline is the exact union of a
 * disc at every sample and the tangent hull between neighbouring discs,
 * which gives round caps and round joins at any width, and is then refitted
 * with smooth quadratic curves. Contours are clockwise (holes, where the
 * stroke crosses itself and encloses space, are counter clockwise).
 * @param {Array<Vec & { pressure?: number }>} points
 * @param {number | ((point: Vec & { pressure?: number }, index: number, count: number) => number)} [widthFn]
 * @param {{ error?: number, smoothing?: number }} [options]
 * @returns {Contour[]}
 */
export function strokeToOutline(points, widthFn, options = {}) {
  const width = typeof widthFn === 'function' ? widthFn
    : typeof widthFn === 'number' ? () => /** @type {number} */ (widthFn)
      : (p) => 10 + 80 * (p.pressure ?? 0.5);
  const raw = [];
  points.forEach((p, i) => {
    const r = Math.max(0.5, width(p, i, points.length) / 2);
    const last = raw[raw.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 0.5) raw.push({ x: p.x, y: p.y, r });
    else last.r = Math.max(last.r, r);
  });
  if (!raw.length) return [];
  if (raw.length === 1) return [circleContour(raw[0].x, raw[0].y, raw[0].r)];
  const error = options.error ?? 1;
  // Fewer, smoother samples: drop points that change neither position nor width much.
  const smooth = smoothPolyline(raw, options.smoothing ?? 2);
  const pts = [smooth[0]];
  for (let i = 1; i < smooth.length - 1; i++) {
    const a = pts[pts.length - 1];
    const p = smooth[i];
    if (Math.hypot(p.x - a.x, p.y - a.y) >= Math.max(error, Math.min(a.r, p.r) * 0.25) || Math.abs(p.r - a.r) > error) pts.push(p);
  }
  pts.push(smooth[smooth.length - 1]);
  /** @type {Contour[]} */
  const parts = pts.map((p) => circleContour(p.x, p.y, p.r));
  for (let i = 0; i + 1 < pts.length; i++) {
    const hull = discHull(pts[i], pts[i + 1]);
    if (hull) parts.push(hull);
  }
  const union = removeOverlaps(parts);
  const fitted = union.map((c) => {
    const poly = flattenContour(c, error / 4);
    const out = fitContour(poly, { error, closed: true, cornerAngle: 70 });
    const flipped = Math.sign(contourArea(out)) !== Math.sign(contourArea(c));
    return flipped ? reverseContour(out) : out;
  });
  return fitted.filter((c) => c.points.length >= 3);
}

/**
 * Clockwise quadrilateral bounded by the outer tangents of two discs, or
 * null when one disc contains the other.
 */
function discHull(a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  if (d <= Math.abs(a.r - b.r) + 1e-9) return null;
  const u = { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
  const nrm = { x: -u.y, y: u.x };
  const k = (a.r - b.r) / d;
  const s = Math.sqrt(Math.max(0, 1 - k * k));
  const mL = { x: u.x * k + nrm.x * s, y: u.y * k + nrm.y * s };
  const mR = { x: u.x * k - nrm.x * s, y: u.y * k - nrm.y * s };
  const pt = (c, m) => ({ x: c.x + m.x * c.r, y: c.y + m.y * c.r, on: true });
  // a-left, b-left, b-right, a-right runs clockwise (left is +normal).
  return { closed: true, points: [pt(a, mL), pt(b, mL), pt(b, mR), pt(a, mR)] };
}

/** Moving average smoothing that keeps the end points. */
function smoothPolyline(pts, passes) {
  let cur = pts.map((p) => ({ ...p }));
  for (let k = 0; k < passes; k++) {
    const next = cur.map((p) => ({ ...p }));
    for (let i = 1; i + 1 < cur.length; i++) {
      next[i].x = (cur[i - 1].x + 2 * cur[i].x + cur[i + 1].x) / 4;
      next[i].y = (cur[i - 1].y + 2 * cur[i].y + cur[i + 1].y) / 4;
      next[i].r = (cur[i - 1].r + 2 * cur[i].r + cur[i + 1].r) / 4;
    }
    cur = next;
  }
  return cur;
}

/**
 * A clockwise circle made of eight quadratic arcs.
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @returns {Contour}
 */
export function circleContour(cx, cy, r) {
  const points = [];
  const k = r / Math.cos(Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const a = -(i * Math.PI) / 4;
    const m = a - Math.PI / 8;
    points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, on: true, type: 'smooth' });
    points.push({ x: cx + Math.cos(m) * k, y: cy + Math.sin(m) * k, on: false });
  }
  return { closed: true, points: /** @type {Point[]} */ (points) };
}

/**
 * Applies an affine transform `[a, b, c, d, e, f]` (x' = a x + c y + e,
 * y' = b x + d y + f) to contours.
 * @param {Contour[]} contours
 * @param {[number, number, number, number, number, number]} m
 * @returns {Contour[]}
 */
export function transformContours(contours, m) {
  const [a, b, c, d, e, f] = m;
  const flips = a * d - b * c < 0;
  return contours.map((ct) => {
    const out = { ...ct, points: ct.points.map((p) => ({ ...p, x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f })) };
    return flips ? reverseContour(out) : out;
  });
}

/**
 * Rounds every coordinate to an integer (TrueType stores integers).
 * @param {Contour[]} contours
 * @returns {Contour[]}
 */
export function roundContours(contours) {
  return contours.map((c) => ({ ...c, points: c.points.map((p) => ({ ...p, x: Math.round(p.x), y: Math.round(p.y) })) }));
}
