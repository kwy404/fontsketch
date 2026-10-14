// Editor geometry on the shared contour model (quadratic TrueType style:
// on curve points plus off curve controls, two off curve points in a row
// imply an on curve point halfway). Font units, Y up.

/** @typedef {{ x: number, y: number, on: boolean, type?: string }} Pt */
/** @typedef {{ closed: boolean, points: Pt[] }} Contour */

export const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true, implied: true });

/**
 * Splits a contour into drawable segments. Each segment is a line
 * `{ p0, p1 }` or a quadratic `{ p0, c, p1 }`, with implied on curve points
 * resolved. Indices of real points are kept for hit testing.
 * @param {Contour} contour
 */
export function segments(contour) {
  const pts = contour.points;
  const n = pts.length;
  if (!n) return [];
  const out = [];
  const start = pts.findIndex((p) => p.on);
  if (start < 0) {
    // All off curve: every on curve point is implied.
    if (n < 2) return [];
    const first = mid(pts[n - 1], pts[0]);
    let cur = first;
    for (let k = 0; k < n; k++) {
      const c = { ...pts[k], i: k };
      const end = k === n - 1 ? first : mid(pts[k], pts[k + 1]);
      out.push({ p0: cur, c, p1: end, ci: k });
      cur = end;
    }
    return out;
  }
  let cur = { ...pts[start], i: start };
  let ctrl = null;
  const count = contour.closed ? n : n - 1 - start;
  for (let k = 1; k <= count; k++) {
    const idx = (start + k) % n;
    const p = pts[idx];
    if (p.on) {
      out.push(ctrl ? { p0: cur, c: ctrl, p1: { ...p, i: idx }, ci: ctrl.i } : { p0: cur, p1: { ...p, i: idx } });
      cur = { ...p, i: idx };
      ctrl = null;
    } else if (ctrl) {
      const m = mid(ctrl, p);
      out.push({ p0: cur, c: ctrl, p1: m, ci: ctrl.i });
      cur = m;
      ctrl = { ...p, i: idx };
    } else {
      ctrl = { ...p, i: idx };
    }
  }
  return out;
}

/**
 * Adds contours to a canvas path. `tf(x, y)` maps font units to canvas pixels.
 * @param {CanvasRenderingContext2D | Path2D} ctx
 * @param {Contour[]} contours
 * @param {(x: number, y: number) => [number, number]} tf
 */
export function tracePath(ctx, contours, tf) {
  for (const c of contours) {
    const segs = segments(c);
    if (!segs.length) continue;
    const [sx, sy] = tf(segs[0].p0.x, segs[0].p0.y);
    ctx.moveTo(sx, sy);
    for (const s of segs) {
      const [x1, y1] = tf(s.p1.x, s.p1.y);
      if (s.c) {
        const [cx, cy] = tf(s.c.x, s.c.y);
        ctx.quadraticCurveTo(cx, cy, x1, y1);
      } else ctx.lineTo(x1, y1);
    }
    if (c.closed) ctx.closePath();
  }
}

/** SVG path data for contours (font units, Y flipped by `flipY` when given). */
export function svgPath(contours, flipY = null, digits = 1) {
  const r = (v) => +v.toFixed(digits);
  const Y = (y) => (flipY === null ? y : flipY - y);
  let d = '';
  for (const c of contours) {
    const segs = segments(c);
    if (!segs.length) continue;
    d += `M${r(segs[0].p0.x)} ${r(Y(segs[0].p0.y))}`;
    for (const s of segs) d += s.c ? `Q${r(s.c.x)} ${r(Y(s.c.y))} ${r(s.p1.x)} ${r(Y(s.p1.y))}` : `L${r(s.p1.x)} ${r(Y(s.p1.y))}`;
    if (c.closed) d += 'Z';
  }
  return d;
}

/** Flattens a contour to a polygon. @param {Contour} c @param {number} [steps] */
export function flatten(c, steps = 8) {
  const out = [];
  for (const s of segments(c)) {
    if (!out.length) out.push({ x: s.p0.x, y: s.p0.y });
    if (s.c) {
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const u = 1 - t;
        out.push({ x: u * u * s.p0.x + 2 * u * t * s.c.x + t * t * s.p1.x, y: u * u * s.p0.y + 2 * u * t * s.c.y + t * t * s.p1.y });
      }
    } else out.push({ x: s.p1.x, y: s.p1.y });
  }
  if (out.length > 1 && dist(out[0], out[out.length - 1]) < 1e-6) out.pop();
  return out;
}

/** Signed area of a polygon (positive when counterclockwise with Y up). */
export function polyArea(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j].x - poly[i].x) * (poly[j].y + poly[i].y);
  return a / 2;
}

/** Winding number of a point against polygons. */
export function winding(x, y, polys) {
  let w = 0;
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j];
      const b = poly[i];
      if (a.y <= y) {
        if (b.y > y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) > 0) w++;
      } else if (b.y <= y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) < 0) w--;
    }
  }
  return w;
}

/** Index of the contour whose filled area contains the point, or -1. */
export function contourAt(x, y, contours) {
  for (let i = contours.length - 1; i >= 0; i--) if (winding(x, y, [flatten(contours[i])]) !== 0) return i;
  return -1;
}

export function bbox(contours) {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const c of contours) {
    for (const p of c.points) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
  }
  return xMin === Infinity ? null : { xMin, yMin, xMax, yMax };
}

/** Tight bounds using flattened curves. */
export function inkBounds(contours) {
  return bbox(contours.map((c) => ({ closed: true, points: flatten(c, 6).map((p) => ({ ...p, on: true })) })));
}

/** Reverses a contour keeping the same start point. */
export function reverse(c) {
  if (!c.points.length) return c;
  const [first, ...rest] = c.points;
  return { ...c, points: [first, ...rest.reverse()] };
}

export function isClockwise(c) {
  return polyArea(flatten(c)) < 0;
}

/** Applies an affine matrix [a, b, c, d, e, f] (x' = a x + c y + e, y' = b x + d y + f). */
export function transformContours(contours, m) {
  const flip = m[0] * m[3] - m[1] * m[2] < 0;
  return contours.map((c) => {
    const out = { ...c, points: c.points.map((p) => ({ ...p, x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] })) };
    return flip ? reverse(out) : out;
  });
}

export const matrix = {
  translate: (dx, dy) => [1, 0, 0, 1, dx, dy],
  scale: (sx, sy, ox = 0, oy = 0) => [sx, 0, 0, sy, ox - sx * ox, oy - sy * oy],
  rotate: (deg, ox = 0, oy = 0) => {
    const r = (deg * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    return [c, s, -s, c, ox - c * ox + s * oy, oy - s * ox - c * oy];
  },
};

/**
 * All contours of a glyph with its components resolved (recursive, guarded
 * against cycles). Component scale is uniform around the component origin.
 */
export function resolve(font, glyph, depth = 0, masterGlyphs = null) {
  if (!glyph) return [];
  const own = masterGlyphs && masterGlyphs[glyph.name] ? masterGlyphs[glyph.name].contours : glyph.contours || [];
  let out = own.slice();
  if (depth < 6) {
    for (const comp of glyph.components || []) {
      const base = font.glyphs[comp.glyph];
      if (!base) continue;
      const s = comp.scale ?? 1;
      out = out.concat(transformContours(resolve(font, base, depth + 1, masterGlyphs), [s, 0, 0, s, comp.dx || 0, comp.dy || 0]));
    }
  }
  return out;
}

export const status = (g) => (!g ? 'empty' : g.contours?.length ? 'drawn' : g.components?.length ? 'composed' : 'empty');

// ---------- Primitive shapes (clockwise, Y up) ----------

export function rectContour(x0, y0, x1, y1) {
  const [l, r] = x0 < x1 ? [x0, x1] : [x1, x0];
  const [b, t] = y0 < y1 ? [y0, y1] : [y1, y0];
  return { closed: true, points: [{ x: l, y: b, on: true }, { x: l, y: t, on: true }, { x: r, y: t, on: true }, { x: r, y: b, on: true }].map(roundPt) };
}

/** An ellipse as 8 quadratic arcs, clockwise. */
export function ellipseContour(cx, cy, rx, ry) {
  const pts = [];
  const k = 1 / Math.cos(Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 2 - (i * Math.PI) / 4; // start at the top, go clockwise
    const b = a - Math.PI / 8;
    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), on: true, type: 'smooth' });
    pts.push({ x: cx + rx * k * Math.cos(b), y: cy + ry * k * Math.sin(b), on: false });
  }
  return { closed: true, points: pts.map(roundPt) };
}

export const roundPt = (p) => ({ ...p, x: Math.round(p.x), y: Math.round(p.y) });
export const roundContours = (cs) => cs.map((c) => ({ ...c, points: c.points.map(roundPt) }));

// ---------- Hit testing ----------

/** Closest point on a quadratic or line segment to (x, y): { t, x, y, d }. */
export function closestOnSegment(s, x, y) {
  let best = { t: 0, x: s.p0.x, y: s.p0.y, d: Infinity };
  const steps = s.c ? 24 : 1;
  const at = (t) => {
    const u = 1 - t;
    return s.c
      ? { x: u * u * s.p0.x + 2 * u * t * s.c.x + t * t * s.p1.x, y: u * u * s.p0.y + 2 * u * t * s.c.y + t * t * s.p1.y }
      : { x: s.p0.x + (s.p1.x - s.p0.x) * t, y: s.p0.y + (s.p1.y - s.p0.y) * t };
  };
  for (let k = 0; k < steps; k++) {
    // Project onto the chord of each sub step.
    const a = at(k / steps);
    const b = at((k + 1) / steps);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    let u = ((x - a.x) * dx + (y - a.y) * dy) / len2;
    u = Math.max(0, Math.min(1, u));
    const px = a.x + dx * u;
    const py = a.y + dy * u;
    const d = Math.hypot(px - x, py - y);
    if (d < best.d) best = { t: (k + u) / steps, x: px, y: py, d };
  }
  return best;
}

/**
 * Inserts an on curve point on a segment at parameter t. For quadratic
 * segments the curve is split exactly (de Casteljau), keeping its shape.
 * Returns the index of the new on curve point.
 */
export function insertPoint(contour, seg, t) {
  const pts = contour.points;
  const n = pts.length;
  if (!seg.c) {
    const p = roundPt({ x: seg.p0.x + (seg.p1.x - seg.p0.x) * t, y: seg.p0.y + (seg.p1.y - seg.p0.y) * t, on: true, type: 'corner' });
    const at = seg.p1.i === 0 ? n : seg.p1.i;
    pts.splice(at, 0, p);
    return at;
  }
  const c1 = { x: seg.p0.x + (seg.c.x - seg.p0.x) * t, y: seg.p0.y + (seg.c.y - seg.p0.y) * t, on: false };
  const c2 = { x: seg.c.x + (seg.p1.x - seg.c.x) * t, y: seg.c.y + (seg.p1.y - seg.c.y) * t, on: false };
  const p = { x: c1.x + (c2.x - c1.x) * t, y: c1.y + (c2.y - c1.y) * t, on: true, type: 'smooth' };
  // Replace the single control (index ci) with c1, p, c2. Implied end points
  // become real ones so the neighbouring curves keep their shape.
  const before = seg.p0.implied ? [roundPt({ x: seg.p0.x, y: seg.p0.y, on: true, type: 'smooth' })] : [];
  const after = seg.p1.implied ? [roundPt({ x: seg.p1.x, y: seg.p1.y, on: true, type: 'smooth' })] : [];
  pts.splice(seg.ci, 1, ...before, roundPt(c1), roundPt(p), roundPt(c2), ...after);
  return seg.ci + before.length + 1;
}

// ---------- Interpolation and emboldening (point compatible) ----------

export function compatible(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((c, i) => c.points.length === b[i].points.length && c.points.every((p, j) => p.on === b[i].points[j].on));
}

export function interpolate(a, b, t) {
  if (!compatible(a, b)) return t < 0.5 ? a : b;
  return a.map((c, i) => ({
    ...c,
    points: c.points.map((p, j) => {
      const q = b[i].points[j];
      return { ...p, x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
    }),
  }));
}

/**
 * Moves every point along its outward normal (away from the ink) by `amount`
 * units horizontally and `amount * vertical` vertically. Point structure is
 * unchanged, so the result interpolates with the source.
 */
export function embolden(contours, amount, vertical = 0.5) {
  const polys = contours.map((c) => flatten(c));
  return contours.map((c, ci) => {
    const pts = c.points;
    const n = pts.length;
    if (n < 3) return clone(c);
    const area = polyArea(polys[ci]);
    // Depth: how many other contours contain this one. Odd depth is a hole.
    const probe = polys[ci][0];
    let depth = 0;
    polys.forEach((p, j) => {
      if (j !== ci && winding(probe.x, probe.y, [p]) !== 0) depth++;
    });
    const sign = (area > 0 ? 1 : -1) * (depth % 2 ? -1 : 1);
    const normal = (a, b) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      return sign > 0 ? { x: dy / len, y: -dx / len } : { x: -dy / len, y: dx / len };
    };
    return {
      ...c,
      points: pts.map((p, i) => {
        let prev = pts[(i - 1 + n) % n];
        let next = pts[(i + 1) % n];
        for (let k = 2; dist(prev, p) < 0.01 && k < n; k++) prev = pts[(i - k + n) % n];
        for (let k = 2; dist(next, p) < 0.01 && k < n; k++) next = pts[(i + k) % n];
        const n1 = normal(prev, p);
        const n2 = normal(p, next);
        let nx = n1.x + n2.x;
        let ny = n1.y + n2.y;
        const len = Math.hypot(nx, ny);
        if (len < 1e-6) {
          nx = n1.x;
          ny = n1.y;
        } else {
          nx /= len;
          ny /= len;
        }
        const cos = Math.max(0.35, nx * n1.x + ny * n1.y);
        return { ...p, x: Math.round(p.x + (nx * amount) / cos), y: Math.round(p.y + (ny * amount * vertical) / cos) };
      }),
    };
  });
}

// ---------- Freehand strokes ----------

/**
 * Stabilizes raw pointer samples. `amount` 0 keeps them, 1 smooths heavily
 * (a lazy brush: each point is pulled toward the previous smoothed point).
 */
export function stabilize(samples, amount) {
  if (amount <= 0 || samples.length < 3) return samples.slice();
  const k = 1 - Math.min(0.95, amount * 0.92);
  const out = [samples[0]];
  for (let i = 1; i < samples.length; i++) {
    const p = out[i - 1];
    const s = samples[i];
    out.push({ ...s, x: p.x + (s.x - p.x) * k, y: p.y + (s.y - p.y) * k });
  }
  // Catch up to the last real sample so the stroke ends where the pen lifted.
  const last = samples[samples.length - 1];
  const tail = out[out.length - 1];
  const steps = Math.ceil(dist(tail, last) / 6);
  for (let i = 1; i <= steps; i++) out.push({ ...last, x: tail.x + ((last.x - tail.x) * i) / steps, y: tail.y + ((last.y - tail.y) * i) / steps });
  return out;
}

/** Resamples a polyline to roughly even spacing, interpolating pressure. */
export function resample(samples, spacing) {
  if (samples.length < 2) return samples.slice();
  const out = [samples[0]];
  let prev = samples[0];
  let carry = 0;
  for (let i = 1; i < samples.length; i++) {
    const s = samples[i];
    const d = dist(prev, s);
    if (d < 1e-9) continue;
    let t = spacing - carry;
    while (t <= d) {
      const u = t / d;
      out.push({ x: prev.x + (s.x - prev.x) * u, y: prev.y + (s.y - prev.y) * u, p: prev.p + (s.p - prev.p) * u, tilt: s.tilt });
      t += spacing;
    }
    carry = d - (t - spacing);
    prev = s;
  }
  const last = samples[samples.length - 1];
  if (dist(out[out.length - 1], last) > spacing * 0.3) out.push(last);
  return out;
}

/**
 * Converts a freehand stroke into an outline polygon (font units, clockwise).
 * Samples carry x, y and pressure p (0..1). Brushes:
 *   round        width follows pressure, round caps
 *   chisel       a flat nib at a fixed angle, width follows pressure
 *   calligraphy  a broad nib at `angle`, thin when moving along the nib
 * @param {Array<{x:number,y:number,p:number}>} raw
 * @param {{ size: number, shape?: 'round'|'chisel'|'calligraphy', angle?: number, pressure?: boolean, taper?: number }} o
 * @returns {Array<{x:number,y:number}>}
 */
export function strokeOutline(raw, o) {
  const size = Math.max(2, o.size);
  const usePressure = o.pressure !== false;
  const pts = resample(raw.map((s) => ({ ...s, p: s.p ?? 0.5 })), Math.max(2, size / 8));
  if (pts.length === 1) pts.push({ ...pts[0], x: pts[0].x + 0.5 });
  const n = pts.length;
  const taper = o.taper ?? 0;
  const widthAt = (i) => {
    const pr = usePressure ? 0.3 + 0.7 * Math.min(1, Math.max(0, pts[i].p)) : 1;
    let w = size * pr * (1 + 0.6 * (pts[i].tilt || 0));
    if (taper > 0) {
      const t = Math.min(i, n - 1 - i) / Math.max(1, Math.min(n / 2, 12));
      w *= Math.min(1, 1 - taper + taper * t);
    }
    return Math.max(1, w);
  };
  const shape = o.shape || 'round';
  if (shape === 'round') {
    const left = [];
    const right = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const h = widthAt(i) / 2;
      left.push({ x: pts[i].x - dy * h, y: pts[i].y + dx * h });
      right.push({ x: pts[i].x + dy * h, y: pts[i].y - dx * h });
    }
    const cap = (c, from, to, h, dir) => {
      const out = [];
      const a0 = Math.atan2(from.y - c.y, from.x - c.x);
      for (let k = 1; k < 8; k++) {
        const a = a0 + (dir * Math.PI * k) / 8;
        out.push({ x: c.x + Math.cos(a) * h, y: c.y + Math.sin(a) * h });
      }
      return out;
    };
    const endCap = cap(pts[n - 1], left[n - 1], right[n - 1], widthAt(n - 1) / 2, -1);
    const startCap = cap(pts[0], right[0], left[0], widthAt(0) / 2, -1);
    const poly = [...left, ...endCap, ...right.reverse(), ...startCap];
    return polyArea(poly) > 0 ? poly.reverse() : poly;
  }
  // Nib brushes: the nib is a segment at a fixed angle. The swept outline is
  // traced along both nib ends, which is exact for a straight nib as long as
  // the stroke does not reverse across the nib direction (the union pass that
  // follows cleans up the rare self overlaps).
  const ang = ((o.angle ?? (shape === 'chisel' ? 30 : 40)) * Math.PI) / 180;
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const thin = shape === 'chisel' ? 0.22 : 0.08;
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const h = widthAt(i) / 2;
    // A nib has some thickness: offset a little across the nib as well.
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const side = Math.sign(dx * uy - dy * ux) || 1;
    const tx = -uy * h * thin * side;
    const ty = ux * h * thin * side;
    left.push({ x: pts[i].x + ux * h + tx, y: pts[i].y + uy * h + ty });
    right.push({ x: pts[i].x - ux * h - tx, y: pts[i].y - uy * h - ty });
  }
  const poly = [...left, ...right.reverse()];
  return polyArea(poly) > 0 ? poly.reverse() : poly;
}

/** Douglas Peucker polyline simplification (closed polygons). */
export function simplifyPoly(poly, tol) {
  if (poly.length < 4) return poly.slice();
  const keep = new Uint8Array(poly.length);
  keep[0] = 1;
  keep[poly.length - 1] = 1;
  const stack = [[0, poly.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1;
    let bd = tol;
    const A = poly[a];
    const B = poly[b];
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((poly[i].x - A.x) * dy - (poly[i].y - A.y) * dx) / len;
      if (d > bd) {
        bd = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return poly.filter((_, i) => keep[i]);
}

/**
 * A closed polygon to a smooth quadratic contour with the core fitter
 * (Schneider cubic fitting, then cubic to quadratic conversion). Corners
 * sharper than 60 degrees stay crisp.
 */
export function polygonToContour(poly, core, error = 2) {
  const pts = poly.map((p) => ({ x: p.x, y: p.y }));
  if (pts.length < 3) return null;
  const c = core.fitContour(pts, { error, closed: true, cornerAngle: 60 });
  const clean = [];
  for (const p of c.points.map(roundPt)) {
    const last = clean[clean.length - 1];
    if (last && last.on && p.on && last.x === p.x && last.y === p.y) continue;
    clean.push(p);
  }
  while (clean.length > 1 && clean[0].on && clean[clean.length - 1].on && clean[0].x === clean[clean.length - 1].x && clean[0].y === clean[clean.length - 1].y) clean.pop();
  return clean.length >= 3 ? { closed: true, points: clean } : null;
}

/** Makes a contour clockwise (outer) or counterclockwise. */
export function orient(c, clockwise = true) {
  return isClockwise(c) === clockwise ? c : reverse(c);
}
