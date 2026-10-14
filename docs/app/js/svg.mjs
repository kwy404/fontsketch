// SVG import: parses path data and basic shapes (with every transform
// applied) into cubic segments, converts them to quadratic contours, and
// outlines stroked shapes. Handles single drawings, sheets of named drawings
// (id="A", data-char="b", inkscape:label, "glyph-A", "uni0041") and SVG fonts.

const NUM = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

/** Parses path data into absolute subpaths of cubic segments. */
export function parsePath(d) {
  const tokens = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let m;
  while ((m = re.exec(d))) tokens.push(m[1] || +m[2]);
  const subpaths = [];
  let cur = null;
  let x = 0, y = 0, sx = 0, sy = 0;
  let lastC = null;
  let lastQ = null;
  let cmd = null;
  let i = 0;
  const num = () => {
    const v = tokens[i++];
    if (typeof v !== 'number') throw new Error('bad path data');
    return v;
  };
  const flag = () => {
    // Arc flags may be packed without separators ("a1 1 0 011 1").
    const v = tokens[i];
    if (typeof v === 'number' && (v === 0 || v === 1)) return i++, v;
    if (typeof v === 'number') {
      const s = String(v);
      tokens.splice(i, 1, +s[0], +s.slice(1));
      return +tokens[i++];
    }
    throw new Error('bad arc flag');
  };
  const start = (nx, ny) => {
    cur = { start: { x: nx, y: ny }, segs: [], closed: false };
    subpaths.push(cur);
  };
  const cubic = (c1x, c1y, c2x, c2y, ex, ey) => {
    if (!cur) start(x, y);
    cur.segs.push([{ x, y }, { x: c1x, y: c1y }, { x: c2x, y: c2y }, { x: ex, y: ey }]);
    x = ex;
    y = ey;
  };
  const line = (ex, ey) => cubic(x + (ex - x) / 3, y + (ey - y) / 3, x + (2 * (ex - x)) / 3, y + (2 * (ey - y)) / 3, ex, ey);
  while (i < tokens.length) {
    if (typeof tokens[i] === 'string') cmd = tokens[i++];
    else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
    if (!cmd) break;
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M': {
        x = num() + ox;
        y = num() + oy;
        sx = x;
        sy = y;
        start(x, y);
        lastC = lastQ = null;
        break;
      }
      case 'L':
        line(num() + ox, num() + oy);
        lastC = lastQ = null;
        break;
      case 'H':
        line(num() + ox, y);
        lastC = lastQ = null;
        break;
      case 'V':
        line(x, num() + oy);
        lastC = lastQ = null;
        break;
      case 'C': {
        const a = [num() + ox, num() + oy, num() + ox, num() + oy, num() + ox, num() + oy];
        cubic(...a);
        lastC = { x: a[2], y: a[3] };
        lastQ = null;
        break;
      }
      case 'S': {
        const c1x = lastC ? 2 * x - lastC.x : x;
        const c1y = lastC ? 2 * y - lastC.y : y;
        const a = [num() + ox, num() + oy, num() + ox, num() + oy];
        cubic(c1x, c1y, ...a);
        lastC = { x: a[0], y: a[1] };
        lastQ = null;
        break;
      }
      case 'Q': {
        const qx = num() + ox, qy = num() + oy, ex = num() + ox, ey = num() + oy;
        cubic(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey);
        lastQ = { x: qx, y: qy };
        lastC = null;
        break;
      }
      case 'T': {
        const qx = lastQ ? 2 * x - lastQ.x : x;
        const qy = lastQ ? 2 * y - lastQ.y : y;
        const ex = num() + ox, ey = num() + oy;
        cubic(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey);
        lastQ = { x: qx, y: qy };
        lastC = null;
        break;
      }
      case 'A': {
        const rx = num(), ry = num(), rot = num();
        const large = flag(), sweep = flag();
        const ex = num() + ox, ey = num() + oy;
        for (const c of arcToCubics(x, y, rx, ry, rot, large, sweep, ex, ey)) cubic(...c);
        lastC = lastQ = null;
        break;
      }
      case 'Z':
        if (cur) {
          if (Math.hypot(x - sx, y - sy) > 1e-9) line(sx, sy);
          cur.closed = true;
        }
        x = sx;
        y = sy;
        cur = null;
        lastC = lastQ = null;
        break;
      default:
        i++;
    }
  }
  return subpaths.filter((s) => s.segs.length);
}

/** SVG elliptical arc to cubic Beziers (endpoint parameterization). */
function arcToCubics(x1, y1, rx, ry, phiDeg, fa, fs, x2, y2) {
  if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2]];
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const sign = fa === fs ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI;
  else if (fs && dt < 0) dt += 2 * Math.PI;
  const n = Math.ceil(Math.abs(dt) / (Math.PI / 2));
  const out = [];
  const step = dt / n;
  const k = (4 / 3) * Math.tan(step / 4);
  let a = t1;
  const pt = (t) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const der = (t) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  for (let i = 0; i < n; i++) {
    const b = a + step;
    const [ax, ay] = pt(a);
    const [bx, by] = pt(b);
    const [dax, day] = der(a);
    const [dbx, dby] = der(b);
    out.push([ax + k * dax, ay + k * day, bx - k * dbx, by - k * dby, bx, by]);
    a = b;
  }
  return out;
}

const shapeToD = (el) => {
  const n = (a) => parseFloat(el.getAttribute(a)) || 0;
  switch (el.tagName.toLowerCase()) {
    case 'path':
      return el.getAttribute('d') || '';
    case 'rect': {
      const x = n('x'), y = n('y'), w = n('width'), h = n('height');
      let rx = Math.min(n('rx') || n('ry'), w / 2);
      let ry = Math.min(n('ry') || n('rx'), h / 2);
      if (!rx || !ry) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
    }
    case 'circle': {
      const cx = n('cx'), cy = n('cy'), r = n('r');
      return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
    }
    case 'ellipse': {
      const cx = n('cx'), cy = n('cy'), rx = n('rx'), ry = n('ry');
      return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
    }
    case 'polygon':
    case 'polyline': {
      const v = (el.getAttribute('points') || '').match(NUM) || [];
      if (v.length < 4) return '';
      let d = `M${v[0]} ${v[1]}`;
      for (let i = 2; i + 1 < v.length; i += 2) d += `L${v[i]} ${v[i + 1]}`;
      return el.tagName.toLowerCase() === 'polygon' ? `${d}Z` : d;
    }
    case 'line':
      return `M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`;
    default:
      return '';
  }
};

const SHAPES = 'path, rect, circle, ellipse, polygon, polyline, line';

/**
 * Collects drawable shapes under a root element in the root SVG's user
 * space: [{ subpaths (cubics, y down), fill, stroke, strokeWidth }].
 * The SVG must be attached to the document so transforms can be read.
 */
export function collectShapes(root, svg) {
  const out = [];
  const els = root.matches?.(SHAPES) ? [root] : [...root.querySelectorAll(SHAPES)];
  const rootM = svg.getCTM() || svg.createSVGMatrix();
  const inv = rootM.inverse();
  for (const el of els) {
    if (el.closest('defs, clipPath, mask, symbol:not(:root), marker, pattern')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const d = shapeToD(el);
    if (!d) continue;
    let subpaths;
    try {
      subpaths = parsePath(d);
    } catch {
      continue;
    }
    const m = inv.multiply(el.getCTM() || svg.createSVGMatrix());
    const tf = (p) => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f });
    for (const sp of subpaths) sp.segs = sp.segs.map((c) => c.map(tf));
    const fill = cs.fill && cs.fill !== 'none' && el.tagName.toLowerCase() !== 'line' && el.tagName.toLowerCase() !== 'polyline';
    const stroke = cs.stroke && cs.stroke !== 'none';
    const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
    out.push({ subpaths, fill: fill || (!stroke && el.tagName.toLowerCase() !== 'line'), stroke, strokeWidth: (parseFloat(cs.strokeWidth) || 1) * scale, fillRule: cs.fillRule });
  }
  return out;
}

export function shapesBounds(shapes) {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const s of shapes) {
    const pad = s.stroke && !s.fill ? s.strokeWidth / 2 : 0;
    for (const sp of s.subpaths) for (const c of sp.segs) for (const p of [c[0], c[3]]) {
      xMin = Math.min(xMin, p.x - pad);
      xMax = Math.max(xMax, p.x + pad);
      yMin = Math.min(yMin, p.y - pad);
      yMax = Math.max(yMax, p.y + pad);
    }
  }
  return xMin === Infinity ? null : { xMin, yMin, xMax, yMax };
}

/**
 * Converts shapes to font contours with a mapping (svg x, y) -> font (x, y).
 * Fills become contours; strokes without fill are outlined.
 */
export function shapesToContours(shapes, map, scale, core) {
  const out = [];
  for (const s of shapes) {
    if (s.fill) {
      const filled = [];
      for (const sp of s.subpaths) {
        const pts = [];
        const first = map(sp.segs[0][0]);
        pts.push({ x: first.x, y: first.y, on: true });
        for (const c of sp.segs) {
          const [a, b, cc, d] = c.map(map);
          const isLine = Math.abs((b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x)) < 0.05 * Math.hypot(d.x - a.x, d.y - a.y) && Math.abs((cc.x - a.x) * (d.y - a.y) - (cc.y - a.y) * (d.x - a.x)) < 0.05 * Math.hypot(d.x - a.x, d.y - a.y);
          if (isLine) pts.push({ x: d.x, y: d.y, on: true });
          else pts.push(...core.cubicToQuadratic(a, b, cc, d, 0.5));
        }
        const last = pts[pts.length - 1];
        if (pts.length > 1 && Math.abs(last.x - pts[0].x) < 0.01 && Math.abs(last.y - pts[0].y) < 0.01) pts.pop();
        if (pts.length >= 3) filled.push({ closed: true, points: pts.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), on: p.on !== false })) });
      }
      if (s.fillRule === 'evenodd' && filled.length > 1) {
        try {
          out.push(...core.removeOverlaps(filled, { fillRule: 'evenodd' }));
          continue;
        } catch {
          // fall through and keep them as they are
        }
      }
      out.push(...filled);
    } else if (s.stroke) {
      const w = s.strokeWidth * scale;
      for (const sp of s.subpaths) {
        const samples = [];
        for (const c of sp.segs) {
          const [a, b, cc, d] = c.map(map);
          for (let k = samples.length ? 1 : 0; k <= 8; k++) {
            const t = k / 8;
            const u = 1 - t;
            samples.push({ x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * cc.x + t * t * t * d.x, y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * cc.y + t * t * t * d.y });
          }
        }
        if (sp.closed && samples.length > 2) samples.push(samples[1]);
        out.push(...core.strokeToOutline(samples, w, { error: 0.6, smoothing: 0 }));
      }
    }
  }
  return out.map((c) => ({ ...c, points: c.points.map((p) => ({ ...p, x: Math.round(p.x), y: Math.round(p.y) })) }));
}

/** Parses SVG text, attaching it offscreen. Returns { svg, cleanup }. */
export function attachSvg(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('This file is not a valid SVG');
  // Strip scripts and event handlers before attaching.
  root.querySelectorAll('script, foreignObject').forEach((n) => n.remove());
  for (const el of [root, ...root.querySelectorAll('*')]) for (const a of [...el.attributes]) if (/^on/i.test(a.name)) el.removeAttribute(a.name);
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-10000px;top:0;width:1000px;height:1000px;overflow:hidden;opacity:0;pointer-events:none';
  host.setAttribute('aria-hidden', 'true');
  const svg = document.importNode(root, true);
  host.append(svg);
  document.body.append(host);
  return { svg, cleanup: () => host.remove() };
}

/** Name hints for sheet items. */
export function nameHint(el) {
  const attrs = ['data-char', 'data-glyph', 'data-name', 'inkscape:label', 'aria-label', 'id'];
  for (const a of attrs) {
    let v = el.getAttribute(a);
    if (!v) continue;
    v = v.trim();
    const m = /^(?:glyph|char|letter|g)[-_ ]?(.+)$/i.exec(v);
    if (m && a === 'id') v = m[1];
    if ([...v].length === 1) return { char: v };
    if (/^(?:uni|U\+|u)([0-9A-Fa-f]{4,6})$/.test(v)) return { char: String.fromCodePoint(parseInt(/([0-9A-Fa-f]{4,6})$/.exec(v)[1], 16)) };
    if (/^[A-Za-z_.][A-Za-z0-9_.-]*$/.test(v)) return { name: v };
  }
  return null;
}
