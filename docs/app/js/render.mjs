// Drawing helpers shared by the glyph grid, the context strip, the kerning
// view and the weight preview: glyph thumbnails and kerned text runs drawn
// straight from the outlines (no font compile needed).
import { interpolate, resolve, tracePath } from './geom.mjs';
import { P, glyphFor, kernValue } from './project.mjs';

export const css = (name, el = document.documentElement) => getComputedStyle(el).getPropertyValue(name).trim();

/** Sizes a canvas for its CSS box and the device pixel ratio; returns the 2D context. */
export function fitCanvas(cv, w = cv.clientWidth, h = cv.clientHeight) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const W = Math.max(1, Math.round(w * dpr));
  const H = Math.max(1, Math.round(h * dpr));
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * Outlines of a glyph at a weight position t (0 = default master, 1 = the
 * first extra master). Components are resolved.
 */
export function outlines(font, glyph, t = 0) {
  const base = resolve(font, glyph);
  if (!t || !font.masters?.length) return base;
  const other = resolve(font, glyph, 0, font.masters[0].glyphs);
  return interpolate(base, other, t);
}

export function advanceAt(font, glyph, t = 0) {
  const m = font.masters?.[0]?.glyphs?.[glyph.name];
  if (!t || !m || m.advanceWidth === undefined) return glyph.advanceWidth;
  return glyph.advanceWidth + (m.advanceWidth - glyph.advanceWidth) * t;
}

/** Draws one glyph centered in a w x h box. */
export function drawThumb(ctx, font, glyph, w, h, color) {
  ctx.clearRect(0, 0, w, h);
  if (!glyph) return;
  const m = font.meta;
  const em = m.ascender - m.descender || m.unitsPerEm;
  const s = (h * 0.8) / em;
  const ox = (w - glyph.advanceWidth * s) / 2;
  const base = h * 0.1 + m.ascender * s;
  ctx.fillStyle = color;
  ctx.beginPath();
  tracePath(ctx, resolve(font, glyph), (x, y) => [ox + x * s, base - y * s]);
  ctx.fill('nonzero');
}

/**
 * Lays out a line of text: [{ glyph, x, ch }] in font units, with kerning.
 * Characters without a glyph are returned with glyph undefined and a
 * fallback advance so the caller can draw a placeholder.
 */
export function layout(font, text, t = 0) {
  const out = [];
  let x = 0;
  let prev = null;
  for (const ch of text) {
    const g = glyphFor(ch);
    if (prev && g) x += kernValue(font, prev.name, g.name);
    const adv = g ? advanceAt(font, g, t) : font.meta.unitsPerEm * 0.5;
    out.push({ glyph: g, x, ch, adv });
    x += adv;
    prev = g || null;
  }
  return { items: out, width: x };
}

/** Draws a text line. Missing glyphs are drawn as faint boxes. */
export function drawLine(ctx, font, text, { x = 0, baseline, size, color, t = 0, missing = 'rgba(128,128,128,.35)', highlight = null, hiColor = null }) {
  const s = size / font.meta.unitsPerEm;
  const { items, width } = layout(font, text, t);
  for (const it of items) {
    const ox = x + it.x * s;
    if (!it.glyph || (!it.glyph.contours?.length && !it.glyph.components?.length)) {
      if (it.ch.trim()) {
        ctx.strokeStyle = missing;
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + it.adv * s * 0.12, baseline - font.meta.xHeight * s, it.adv * s * 0.76, font.meta.xHeight * s);
      }
      continue;
    }
    ctx.fillStyle = highlight && it.glyph.name === highlight ? hiColor || color : color;
    ctx.beginPath();
    tracePath(ctx, outlines(font, it.glyph, t), (gx, gy) => [ox + gx * s, baseline - gy * s]);
    ctx.fill('nonzero');
  }
  return width * s;
}

export const fontRef = () => P.font;
