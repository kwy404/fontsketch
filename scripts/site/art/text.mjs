// Sets text in Quill Hand as SVG path data (no font dependency).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { deserialize, glyphNameFor } = await import('../../../src/core/index.mjs');
const { contoursToSvgPath } = await import('../../../docs/assets/site/stroke.mjs');
export const font = deserialize(readFileSync(`${repo}/docs/assets/fonts/quill-hand.fontsketch.json`, 'utf8'));

const cache = new Map();
function glyphPath(name) {
  if (cache.has(name)) return cache.get(name);
  const g = font.glyphs[name];
  const parts = [];
  const walk = (gl, dx, dy) => {
    if (gl.contours.length) {
      const moved = gl.contours.map((c) => ({ ...c, points: c.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) }));
      parts.push(contoursToSvgPath(moved));
    }
    for (const c of gl.components || []) walk(font.glyphs[c.glyph], dx + c.dx, dy + c.dy);
  };
  if (g) walk(g, 0, 0);
  const v = { d: parts.join(''), adv: g ? g.advanceWidth : 300 };
  cache.set(name, v);
  return v;
}

export function measure(str, size, track = 0) {
  let w = 0, prev = null;
  for (const ch of str) {
    const n = glyphNameFor(ch);
    if (prev) w += (font.kerning.pairs[`${prev}|${n}`] || 0) + track;
    w += glyphPath(n).adv;
    prev = n;
  }
  return (w * size) / 1000;
}

/** Returns path data for str with its baseline at (x, y) and the given size. */
export function textD(str, size, x, y, { anchor = 'start', track = 0 } = {}) {
  const s = size / 1000;
  let cx = 0;
  if (anchor === 'middle') x -= measure(str, size, track) / 2;
  if (anchor === 'end') x -= measure(str, size, track);
  let out = '';
  let prev = null;
  for (const ch of str) {
    const n = glyphNameFor(ch);
    if (prev) cx += (font.kerning.pairs[`${prev}|${n}`] || 0) + track;
    const gp = glyphPath(n);
    if (gp.d) out += transformD(gp.d, s, x + cx * s, y, size < 90 ? 1 : 10);
    cx += gp.adv;
    prev = n;
  }
  return out;
}

function transformD(d, s, tx, ty, q = 10) {
  // d is in font units with Y already flipped around baseline 0
  return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, a, b) => `${Math.round((tx + a * s) * q) / q} ${Math.round((ty + b * s) * q) / q}`);
}

export const text = (str, size, x, y, fill, opts = {}) => `<path d="${textD(str, size, x, y, opts)}" fill="${fill}"${opts.attrs || ''}/>`;
