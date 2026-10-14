// Geometry helpers for generating the fontsketch art.
export const r = (n) => Math.round(n * 2) / 2;
export const P = (p) => `${r(p[0])} ${r(p[1])}`;

/** Catmull-Rom spline through pts (open), sampled n times. */
export function spline(pts, n = 60) {
  const out = [];
  const segs = pts.length - 1;
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * segs;
    const k = Math.min(Math.floor(u), segs - 1);
    const t = u - k;
    const p0 = pts[Math.max(k - 1, 0)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(k + 2, pts.length - 1)];
    const t2 = t * t, t3 = t2 * t;
    const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

/** Smooth closed path through polygon points (Catmull-Rom to cubic). */
export function smoothClosed(pts) {
  const n = pts.length;
  let d = `M${P(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return d + 'Z';
}

/** Smooth open path through points. */
export function smoothOpen(pts) {
  const n = pts.length;
  let d = `M${P(pts[0])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n - 1)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return d;
}

function tangents(s) {
  return s.map((p, i) => {
    const a = s[Math.max(i - 1, 0)], b = s[Math.min(i + 1, s.length - 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  });
}

/**
 * Tapered stroke along a spline: width(t, tangent) gives full width.
 * Returns a smooth closed path with round ends.
 */
export function taper(pts, width, { n = 28, capStart = true, capEnd = true } = {}) {
  const s = spline(pts, n);
  const tg = tangents(s);
  const L = [], R = [];
  s.forEach((p, i) => {
    const t = i / n;
    const w = width(t, tg[i]) / 2;
    const nx = -tg[i][1], ny = tg[i][0];
    L.push([p[0] + nx * w, p[1] + ny * w]);
    R.push([p[0] - nx * w, p[1] - ny * w]);
  });
  const poly = [...L];
  const cap = (c, tan, w, steps) => {
    // semicircle from L side to R side going around the tangent direction
    const out = [];
    const nx = -tan[1], ny = tan[0];
    for (let k = 1; k < steps; k++) {
      const a = (Math.PI * k) / steps;
      const ca = Math.cos(a), sa = Math.sin(a);
      out.push([c[0] + nx * w * ca + tan[0] * w * sa, c[1] + ny * w * ca + tan[1] * w * sa]);
    }
    return out;
  };
  const we = width(1, tg[n]) / 2;
  if (capEnd) poly.push(...cap(s[n], tg[n], we, 4));
  poly.push(...R.reverse());
  const ws = width(0, tg[0]) / 2;
  if (capStart) poly.push(...cap(s[0], [-tg[0][0], -tg[0][1]], ws, 4).map((p) => p));
  // the start cap above goes from R side back to L side because tangent is reversed
  return smoothClosed(poly);
}

/** Broad nib stroke: union of parallelograms swept by a flat nib at angle deg. */
export function broadNib(pts, nibWidth, angleDeg, { n = 60 } = {}) {
  const s = spline(pts, n);
  const a = (angleDeg * Math.PI) / 180;
  const v = [Math.cos(a) * nibWidth / 2, -Math.sin(a) * nibWidth / 2];
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = s[i], q = s[i + 1];
    let quad = [[p[0] + v[0], p[1] + v[1]], [q[0] + v[0], q[1] + v[1]], [q[0] - v[0], q[1] - v[1]], [p[0] - v[0], p[1] - v[1]]];
    let area = 0;
    for (let k = 0; k < 4; k++) {
      const u = quad[k], w = quad[(k + 1) % 4];
      area += u[0] * w[1] - w[0] * u[1];
    }
    if (Math.abs(area) < 1e-6) continue;
    if (area < 0) quad = quad.reverse();
    d += `M${quad.map(P).join('L')}Z`;
  }
  return d;
}

/** Seeded random. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Ink blob: wobbly circle. */
export function blob(cx, cy, rad, seed = 1, k = 9, wob = 0.18) {
  const rand = rng(seed);
  const pts = [];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2;
    const rr = rad * (1 + (rand() - 0.5) * 2 * wob);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return smoothClosed(pts);
}

/** Ink splat: blob plus a few satellite droplets. */
export function splat(cx, cy, rad, seed, fill) {
  const rand = rng(seed * 7 + 3);
  let out = `<path d="${blob(cx, cy, rad, seed, 10, 0.22)}" fill="${fill}"/>`;
  const m = 3;
  for (let i = 0; i < m; i++) {
    const a = rand() * Math.PI * 2;
    const dist = rad * (1.5 + rand() * 0.9);
    const rr = rad * (0.16 + rand() * 0.2);
    out += `<circle cx="${r(cx + Math.cos(a) * dist)}" cy="${r(cy + Math.sin(a) * dist)}" r="${r(rr)}" fill="${fill}"/>`;
  }
  return out;
}

export const sticker = (id, rim, rad, shadow, box = null) => `<filter id="${id}" ${box ? `filterUnits="userSpaceOnUse" x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}"` : 'x="-15%" y="-15%" width="130%" height="130%"'} color-interpolation-filters="sRGB">
<feGaussianBlur in="SourceAlpha" stdDeviation="${rad}"/>
<feComponentTransfer result="d"><feFuncA type="linear" slope="14" intercept="-0.7"/></feComponentTransfer>
<feFlood flood-color="${rim}"/><feComposite in2="d" operator="in" result="rim"/>${shadow ? `
<feGaussianBlur in="d" stdDeviation="3" result="b"/><feOffset in="b" dy="5" result="bo"/>
<feFlood flood-color="${shadow}" flood-opacity=".2"/><feComposite in2="bo" operator="in" result="sh"/>
<feMerge><feMergeNode in="sh"/><feMergeNode in="rim"/><feMergeNode in="SourceGraphic"/></feMerge>` : `
<feMerge><feMergeNode in="rim"/><feMergeNode in="SourceGraphic"/></feMerge>`}
</filter>`;
