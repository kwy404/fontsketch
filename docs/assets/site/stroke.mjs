// Pen stroke expansion shared by the site hero (browser) and the font
// generator (Node). A stroke is a list of spine points in font units (Y up);
// the pen turns it into a filled outline with round ends, a slight swell on
// downstrokes and a soft taper at both ends, like a felt or fountain pen.

/** @typedef {[number, number]} Pt */
/** @typedef {{ pts: Pt[], w?: number }} Stroke */

export const PEN = Object.freeze({ width: 66, swell: 20, taper: 0.2 });

/**
 * Centripetal Catmull-Rom spline through the points, sampled so that
 * consecutive samples are roughly `step` units apart.
 * @param {Pt[]} pts
 * @param {number} [step]
 * @returns {Pt[]}
 */
export function spine(pts, step = 64) {
  if (pts.length === 1) return [pts[0], [pts[0][0] + 0.5, pts[0][1] + 0.5]];
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || mirror(pts[i + 1], pts[i]);
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || mirror(pts[i], pts[i + 1]);
    for (let k = 0; k < 12; k++) dense.push(catmull(p0, p1, p2, p3, k / 12));
  }
  dense.push(pts[pts.length - 1]);
  // resample evenly by arc length
  const acc = [0];
  for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = acc[acc.length - 1];
  const n = Math.max(2, Math.ceil(total / step));
  const out = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const target = (total * k) / n;
    while (j < dense.length - 2 && acc[j + 1] < target) j++;
    const seg = acc[j + 1] - acc[j] || 1;
    const u = Math.min(Math.max((target - acc[j]) / seg, 0), 1);
    out.push([dense[j][0] + (dense[j + 1][0] - dense[j][0]) * u, dense[j][1] + (dense[j + 1][1] - dense[j][1]) * u]);
  }
  return out;
}

/** @param {Pt} a @param {Pt} b @returns {Pt} */
function mirror(a, b) {
  return [2 * b[0] - a[0], 2 * b[1] - a[1]];
}

/** Barry and Goldman pyramid for a centripetal Catmull-Rom segment. */
function catmull(p0, p1, p2, p3, u) {
  const d = (a, b) => Math.max(Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])), 1e-4);
  const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
  const t = t1 + (t2 - t1) * u;
  const lerp = (a, b, ta, tb) => {
    const k = (t - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };
  const a1 = lerp(p0, p1, t0, t1), a2 = lerp(p1, p2, t1, t2), a3 = lerp(p2, p3, t2, t3);
  const b1 = lerp(a1, a2, t0, t2), b2 = lerp(a2, a3, t1, t3);
  return lerp(b1, b2, t1, t2);
}

/**
 * Expands one stroke into a closed polygon (clockwise with Y up).
 * @param {Stroke | Pt[]} stroke
 * @param {{ width: number, swell: number, taper: number }} [pen]
 * @returns {Pt[]}
 */
export function expandStroke(stroke, pen = PEN) {
  const pts = Array.isArray(stroke) ? stroke : stroke.pts;
  const mult = Array.isArray(stroke) ? 1 : stroke.w || 1;
  const s = spine(pts);
  const n = s.length;
  // cumulative length for the taper
  const acc = [0];
  for (let i = 1; i < n; i++) acc.push(acc[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]));
  const total = acc[n - 1] || 1;
  const tang = s.map((p, i) => {
    const a = s[Math.max(i - 1, 0)], b = s[Math.min(i + 1, n - 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  });
  const half = s.map((_, i) => {
    const t = acc[i] / total;
    const edge = Math.min(acc[i], total - acc[i]) / Math.max(Math.min(total * 0.18, 120), 1);
    const ease = edge >= 1 ? 1 : edge * edge * (3 - 2 * edge);
    const down = Math.max(0, -tang[i][1]);
    const w = (pen.width + pen.swell * Math.pow(down, 1.5)) * mult * (1 - pen.taper + pen.taper * ease);
    void t;
    return w / 2;
  });
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const nx = -tang[i][1], ny = tang[i][0];
    L.push([s[i][0] + nx * half[i], s[i][1] + ny * half[i]]);
    R.push([s[i][0] - nx * half[i], s[i][1] - ny * half[i]]);
  }
  const cap = (c, tg, h) => {
    const out = [];
    const nx = -tg[1], ny = tg[0];
    for (let k = 1; k < 4; k++) {
      const a = (Math.PI * k) / 4;
      out.push([c[0] + nx * h * Math.cos(a) + tg[0] * h * Math.sin(a), c[1] + ny * h * Math.cos(a) + tg[1] * h * Math.sin(a)]);
    }
    return out;
  };
  const poly = [...L, ...cap(s[n - 1], tang[n - 1], half[n - 1]), ...R.reverse(), ...cap(s[0], [-tang[0][0], -tang[0][1]], half[0])];
  if (area(poly) > 0) poly.reverse();
  return poly;
}

/** Signed area (positive is counterclockwise with Y up). @param {Pt[]} poly */
export function area(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/**
 * Turns a polygon into a smooth TrueType contour: every polygon vertex is an
 * off curve control and an explicit on curve point sits halfway between
 * every second pair, so the outline is a smooth quadratic B-spline.
 * @param {Pt[]} poly
 */
export function polygonToContour(poly) {
  const points = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    points.push({ x: Math.round(p[0]), y: Math.round(p[1]), on: false });
    if (i % 2 === 1) points.push({ x: Math.round((p[0] + q[0]) / 2), y: Math.round((p[1] + q[1]) / 2), on: true, type: 'smooth' });
  }
  // start on an on curve point
  const first = points.findIndex((p) => p.on);
  return { closed: true, points: [...points.slice(first), ...points.slice(0, first)] };
}

/**
 * @param {Array<Stroke | Pt[]>} strokes
 * @param {{ width: number, swell: number, taper: number }} [pen]
 */
export function strokesToContours(strokes, pen = PEN) {
  return strokes.map((st) => polygonToContour(expandStroke(st, pen)));
}

/**
 * SVG path data for a contour list (Y up flipped with the given baseline).
 * @param {Array<{ points: Array<{ x: number, y: number, on: boolean }> }>} contours
 * @param {number} [baseline]
 */
export function contoursToSvgPath(contours, baseline = 0) {
  let d = '';
  const f = (v) => Math.round(v * 10) / 10;
  for (const c of contours) {
    const pts = c.points;
    if (!pts.length) continue;
    const n = pts.length;
    const start = pts.findIndex((p) => p.on);
    const s = start < 0 ? 0 : start;
    const at = (i) => pts[(s + i) % n];
    const first = start < 0 ? { x: (pts[0].x + pts[n - 1].x) / 2, y: (pts[0].y + pts[n - 1].y) / 2 } : at(0);
    d += `M${f(first.x)} ${f(baseline - first.y)}`;
    let ctrl = null;
    for (let i = 1; i <= n; i++) {
      const p = i === n ? first : at(i);
      if (i < n && !p.on) {
        if (ctrl) {
          const mx = (ctrl.x + p.x) / 2, my = (ctrl.y + p.y) / 2;
          d += `Q${f(ctrl.x)} ${f(baseline - ctrl.y)} ${f(mx)} ${f(baseline - my)}`;
        }
        ctrl = p;
      } else {
        d += ctrl ? `Q${f(ctrl.x)} ${f(baseline - ctrl.y)} ${f(p.x)} ${f(baseline - p.y)}` : `L${f(p.x)} ${f(baseline - p.y)}`;
        ctrl = null;
      }
    }
    d += 'Z';
  }
  return d;
}
