// SVG import: path data, basic shapes and transforms to font contours.
// Used for icon fonts (`fontsketch from-svg`) and for pasting artwork into
// the editor.

import { contourFromCubics, removeOverlaps } from './geometry.mjs';

/** @typedef {[number, number, number, number, number, number]} Matrix */
/** @typedef {{ x: number, y: number }} Vec */

const IDENTITY = /** @type {Matrix} */ ([1, 0, 0, 1, 0, 0]);

/** @param {Matrix} m @param {Matrix} n @returns {Matrix} m * n */
function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/**
 * Parses an SVG transform attribute.
 * @param {string} text
 * @returns {Matrix}
 */
export function parseTransform(text) {
  let m = IDENTITY;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let hit;
  while ((hit = re.exec(text || ''))) {
    const v = (hit[2].match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || []).map(Number);
    /** @type {Matrix} */
    let t = IDENTITY;
    switch (hit[1]) {
      case 'matrix':
        if (v.length === 6) t = /** @type {Matrix} */ (v);
        break;
      case 'translate':
        t = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
        break;
      case 'scale':
        t = [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0];
        break;
      case 'rotate': {
        const a = ((v[0] || 0) * Math.PI) / 180;
        const r = /** @type {Matrix} */ ([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
        t = v.length >= 3 ? multiply(multiply([1, 0, 0, 1, v[1], v[2]], r), [1, 0, 0, 1, -v[1], -v[2]]) : r;
        break;
      }
      case 'skewX':
        t = [1, 0, Math.tan(((v[0] || 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case 'skewY':
        t = [1, Math.tan(((v[0] || 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    m = multiply(m, t);
  }
  return m;
}

/**
 * Parses SVG path data into subpaths of cubic segments (lines and
 * quadratic curves are raised to cubics, arcs are approximated).
 * @param {string} d
 * @returns {Array<{ closed: boolean, start: Vec, cubics: Array<[Vec, Vec, Vec, Vec]> }>}
 */
export function parsePathData(d) {
  const tokens = String(d).match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  const subpaths = [];
  let i = 0;
  let cmd = '';
  let cur = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let lastCtrl = null;
  let lastQuad = null;
  let sub = null;
  const num = () => {
    if (i >= tokens.length || /^[A-Za-z]$/.test(tokens[i])) throw new SyntaxError(`SVG path: expected a number after "${cmd}"`);
    return parseFloat(tokens[i++]);
  };
  // Arc flags may be written without separators ("a1 1 0 01 1 1").
  const flag = () => {
    const t = tokens[i];
    if (t === '0' || t === '1') {
      i++;
      return Number(t);
    }
    if (/^[01]/.test(t)) {
      tokens[i] = t.slice(1);
      return Number(t[0]);
    }
    return num() ? 1 : 0;
  };
  const ensureSub = () => {
    if (!sub) {
      sub = { closed: false, start: { ...cur }, cubics: [] };
      subpaths.push(sub);
    }
    return sub;
  };
  const line = (p) => {
    ensureSub().cubics.push([cur, { x: cur.x + (p.x - cur.x) / 3, y: cur.y + (p.y - cur.y) / 3 }, { x: cur.x + (2 * (p.x - cur.x)) / 3, y: cur.y + (2 * (p.y - cur.y)) / 3 }, p]);
    cur = p;
  };
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) throw new SyntaxError('SVG path: data must start with a command');
    const rel = cmd === cmd.toLowerCase();
    const at = (x, y) => (rel ? { x: cur.x + x, y: cur.y + y } : { x, y });
    switch (cmd.toUpperCase()) {
      case 'M': {
        cur = at(num(), num());
        start = { ...cur };
        sub = { closed: false, start: { ...cur }, cubics: [] };
        subpaths.push(sub);
        cmd = rel ? 'l' : 'L';
        lastCtrl = lastQuad = null;
        break;
      }
      case 'L':
        line(at(num(), num()));
        lastCtrl = lastQuad = null;
        break;
      case 'H': {
        const x = num();
        line({ x: rel ? cur.x + x : x, y: cur.y });
        lastCtrl = lastQuad = null;
        break;
      }
      case 'V': {
        const y = num();
        line({ x: cur.x, y: rel ? cur.y + y : y });
        lastCtrl = lastQuad = null;
        break;
      }
      case 'C': {
        const c1 = at(num(), num());
        const c2 = at(num(), num());
        const p = at(num(), num());
        ensureSub().cubics.push([cur, c1, c2, p]);
        lastCtrl = c2;
        lastQuad = null;
        cur = p;
        break;
      }
      case 'S': {
        const c1 = lastCtrl ? { x: 2 * cur.x - lastCtrl.x, y: 2 * cur.y - lastCtrl.y } : { ...cur };
        const c2 = at(num(), num());
        const p = at(num(), num());
        ensureSub().cubics.push([cur, c1, c2, p]);
        lastCtrl = c2;
        lastQuad = null;
        cur = p;
        break;
      }
      case 'Q':
      case 'T': {
        const q = cmd.toUpperCase() === 'Q' ? at(num(), num()) : lastQuad ? { x: 2 * cur.x - lastQuad.x, y: 2 * cur.y - lastQuad.y } : { ...cur };
        const p = at(num(), num());
        ensureSub().cubics.push([cur, { x: cur.x + (2 / 3) * (q.x - cur.x), y: cur.y + (2 / 3) * (q.y - cur.y) }, { x: p.x + (2 / 3) * (q.x - p.x), y: p.y + (2 / 3) * (q.y - p.y) }, p]);
        lastQuad = q;
        lastCtrl = null;
        cur = p;
        break;
      }
      case 'A': {
        const rx = Math.abs(num());
        const ry = Math.abs(num());
        const rot = num();
        const large = flag();
        const sweep = flag();
        const p = at(num(), num());
        for (const c of arcToCubics(cur, p, rx, ry, rot, large, sweep)) ensureSub().cubics.push(c);
        cur = p;
        lastCtrl = lastQuad = null;
        break;
      }
      case 'Z': {
        if (sub) {
          if (Math.hypot(cur.x - start.x, cur.y - start.y) > 1e-9) line({ ...start });
          sub.closed = true;
        }
        cur = { ...start };
        sub = null;
        lastCtrl = lastQuad = null;
        break;
      }
      default:
        throw new SyntaxError(`SVG path: unknown command "${cmd}"`);
    }
  }
  return subpaths;
}

/** SVG arc (endpoint form) to cubic segments of at most 90 degrees. */
function arcToCubics(p0, p1, rx, ry, rotDeg, large, sweep) {
  if (!rx || !ry || (p0.x === p1.x && p0.y === p1.y)) {
    return p0.x === p1.x && p0.y === p1.y ? [] : [[p0, p0, p1, p1]];
  }
  const phi = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (p0.x - p1.x) / 2;
  const dy = (p0.y - p1.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const sign = large === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const coef = sign * Math.sqrt(Math.max(0, num / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
  const cx1 = (coef * rx * y1) / ry;
  const cy1 = (-coef * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (p0.x + p1.x) / 2;
  const cy = sin * cx1 + cos * cy1 + (p0.y + p1.y) / 2;
  const ang = (ux, uy, vx, vy) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const theta1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let delta = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const point = (t) => ({ x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos });
  const deriv = (t) => ({ x: -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, y: -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos });
  const out = [];
  let a = theta1;
  let prev = p0;
  for (let s = 0; s < n; s++) {
    const b = a + step;
    const pa = prev;
    const pb = s === n - 1 ? p1 : point(b);
    const da = deriv(a);
    const db = deriv(b);
    out.push([pa, { x: pa.x + k * da.x, y: pa.y + k * da.y }, { x: pb.x - k * db.x, y: pb.y - k * db.y }, pb]);
    prev = pb;
    a = b;
  }
  return out;
}

/** @param {string} tag */
function attributes(tag) {
  /** @type {Record<string, string>} */
  const out = {};
  const re = /([:\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(tag))) out[m[1]] = m[3] ?? m[4] ?? '';
  // Inline style declarations override presentation attributes.
  if (out.style) {
    for (const decl of out.style.split(';')) {
      const [k, v] = decl.split(':').map((s) => s && s.trim());
      if (k && v) out[k] = v;
    }
  }
  return out;
}

const n = (v, d = 0) => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : d;
};

/** Path data for basic shapes. @param {string} name @param {Record<string, string>} a */
function shapeToPath(name, a) {
  switch (name) {
    case 'path':
      return a.d || '';
    case 'rect': {
      const x = n(a.x);
      const y = n(a.y);
      const w = n(a.width);
      const h = n(a.height);
      if (w <= 0 || h <= 0) return '';
      let rx = a.rx !== undefined ? n(a.rx) : a.ry !== undefined ? n(a.ry) : 0;
      let ry = a.ry !== undefined ? n(a.ry) : rx;
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      if (!rx || !ry) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}` +
        `H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
    }
    case 'circle':
    case 'ellipse': {
      const cx = n(a.cx);
      const cy = n(a.cy);
      const rx = name === 'circle' ? n(a.r) : n(a.rx);
      const ry = name === 'circle' ? n(a.r) : n(a.ry);
      if (rx <= 0 || ry <= 0) return '';
      return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
    }
    case 'polygon':
    case 'polyline': {
      const pts = (a.points || '').match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
      if (pts.length < 4) return '';
      let d = `M${pts[0]} ${pts[1]}`;
      for (let i = 2; i + 1 < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
      return `${d}Z`;
    }
    default:
      return '';
  }
}

/**
 * Converts an SVG document to font contours. The viewBox height is mapped
 * to the em box (from the descender up to the ascender, unless `height` and
 * `baseline` are given); the Y axis is flipped. Filled shapes are imported,
 * strokes and `fill="none"` shapes are skipped (and reported in `warnings`).
 * Overlaps are removed with the shape's fill rule.
 * @param {string} svg
 * @param {{ unitsPerEm?: number, ascender?: number, descender?: number, tolerance?: number }} [options]
 * @returns {{ contours: import('./model.mjs').Contour[], advanceWidth: number, warnings: string[] }}
 */
export function svgToContours(svg, options = {}) {
  const upm = options.unitsPerEm ?? 1000;
  const ascender = options.ascender ?? upm * 0.8;
  const descender = options.descender ?? -upm * 0.2;
  const warnings = [];
  const root = /<svg\b[^>]*>/i.exec(svg);
  if (!root) throw new Error('SVG: no <svg> element found');
  const ra = attributes(root[0]);
  let vb = (ra.viewBox || ra.viewbox || '').split(/[\s,]+/).filter(Boolean).map(Number);
  if (vb.length !== 4 || vb.some((v) => !Number.isFinite(v)) || vb[2] <= 0 || vb[3] <= 0) {
    const w = n(ra.width, 0);
    const h = n(ra.height, 0);
    if (w > 0 && h > 0) vb = [0, 0, w, h];
    else throw new Error('SVG: needs a viewBox or a width and height');
  }
  const [minX, minY, vw, vh] = vb;
  const scale = (ascender - descender) / vh;
  /** @type {Matrix} */
  const toFont = [scale, 0, 0, -scale, -minX * scale, ascender + minY * scale];
  const body = svg.slice(root.index + root[0].length);
  const tagRe = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
  /** @type {Array<{ name: string, m: Matrix, fill: string, rule: string, skip: boolean }>} */
  const stack = [{ name: 'svg', m: multiply(toFont, parseTransform(ra.transform)), fill: ra.fill ?? '', rule: ra['fill-rule'] ?? 'nonzero', skip: false }];
  const groups = { nonzero: [], evenodd: [] };
  let t;
  while ((t = tagRe.exec(body))) {
    const [, closing, rawName, rest, selfClose] = t;
    const name = rawName.toLowerCase();
    const top = stack[stack.length - 1];
    if (closing) {
      if (stack.length > 1 && top.name === name) stack.pop();
      continue;
    }
    const a = attributes(rest);
    const m = multiply(top.m, parseTransform(a.transform));
    const fill = a.fill ?? top.fill;
    const rule = a['fill-rule'] ?? top.rule;
    const skip = top.skip || ['defs', 'clippath', 'mask', 'symbol', 'pattern', 'marker', 'style', 'title', 'desc', 'metadata', 'lineargradient', 'radialgradient'].includes(name);
    if (!selfClose && !['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'use', 'stop'].includes(name)) {
      stack.push({ name, m, fill, rule, skip });
      continue;
    }
    if (skip) continue;
    if (name === 'line' || (name === 'polyline' && fill === 'none')) {
      warnings.push(`<${name}> is a stroke and was skipped`);
      continue;
    }
    if (name === 'use') {
      warnings.push('<use> references are not followed');
      continue;
    }
    if (fill === 'none') {
      warnings.push(`<${name}> has fill="none" and was skipped`);
      continue;
    }
    const d = shapeToPath(name, a);
    if (!d) continue;
    let subpaths;
    try {
      subpaths = parsePathData(d);
    } catch (err) {
      warnings.push(/** @type {Error} */ (err).message);
      continue;
    }
    for (const sp of subpaths) {
      if (!sp.cubics.length) continue;
      const cubics = sp.cubics.map((c) => /** @type {[Vec, Vec, Vec, Vec]} */ (c.map((p) => apply(m, p))));
      const first = cubics[0][0];
      const last = cubics[cubics.length - 1][3];
      if (Math.hypot(first.x - last.x, first.y - last.y) > 1e-6) {
        cubics.push([last, last, first, first]);
      }
      const contour = contourFromCubics(cubics, { tolerance: options.tolerance ?? 0.5, closed: true });
      (rule === 'evenodd' ? groups.evenodd : groups.nonzero).push(contour);
    }
  }
  const contours = [
    ...(groups.nonzero.length ? removeOverlaps(groups.nonzero) : []),
    ...(groups.evenodd.length ? removeOverlaps(groups.evenodd, { fillRule: 'evenodd' }) : []),
  ];
  const merged = groups.nonzero.length && groups.evenodd.length ? removeOverlaps(contours) : contours;
  const rounded = merged.map((c) => ({ ...c, points: c.points.map((p) => ({ ...p, x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 })) }));
  return { contours: rounded, advanceWidth: Math.round(vw * scale), warnings };
}

/** @param {Matrix} m @param {Vec} p */
function apply(m, p) {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}
