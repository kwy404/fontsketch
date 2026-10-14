// Printable handwriting sheets: SVG for screens and a self written PDF for
// printers. The geometry comes from layout.mjs so the scanner knows exactly
// where every marker, code module, cell and guide line is.

import {
  LABEL_COLOR, encodePageCode, guideLines, markerModules, templateLayout,
} from './layout.mjs';
import { textWidthEm, writePdf } from './pdf.mjs';

/** @typedef {import('./layout.mjs').TemplateLayout} TemplateLayout */
/** @typedef {import('./pdf.mjs').Shape} Shape */

const BLACK = [0, 0, 0];
const TEXT = [60, 60, 60];

/**
 * Shapes of one page.
 * @param {TemplateLayout} t @param {number} pageIndex
 * @returns {Shape[]}
 */
export function pageShapes(t, pageIndex) {
  const page = t.pages[pageIndex];
  const guide = t.dropoutColor;
  /** @type {Shape[]} */
  const shapes = [{ t: 'rect', x: 0, y: 0, w: t.width, h: t.height, fill: [255, 255, 255] }];

  // corner markers: a solid black square with the white modules cut out, so
  // no seams appear between neighbouring black modules
  const mod = t.marker.module;
  for (const box of t.marker.boxes) {
    shapes.push({ t: 'rect', x: box.x, y: box.y, w: t.marker.size, h: t.marker.size, fill: BLACK });
    const black = new Set(markerModules(box.id).map(([cx, cy]) => cy * 6 + cx));
    for (let cy = 1; cy < 5; cy++) {
      for (let cx = 1; cx < 5; cx++) {
        if (black.has(cy * 6 + cx)) continue;
        // runs of white modules in a row become one rectangle
        let end = cx;
        while (end + 1 < 5 && !black.has(cy * 6 + end + 1)) end++;
        shapes.push({ t: 'rect', x: box.x + cx * mod, y: box.y + cy * mod, w: (end - cx + 1) * mod, h: mod, fill: [255, 255, 255] });
        cx = end;
      }
    }
  }

  // page code: guard, 32 data bits, guard
  const bits = [1, ...encodePageCode(t.id, pageIndex, t.pages.length), 1];
  const cm = t.code.module;
  const inset = cm * 0.12;
  bits.forEach((b, i) => {
    if (b) shapes.push({ t: 'rect', x: t.code.x + i * cm + inset, y: t.code.y + inset, w: cm - 2 * inset, h: cm - 2 * inset, fill: BLACK });
  });

  // header and footer text, kept clear of the markers' quiet zones
  const left = t.marker.boxes[0].x + t.marker.size + 4;
  shapes.push({ t: 'text', x: left, y: t.marker.boxes[0].y + 5, size: 3.4, text: t.title, fill: TEXT, bold: true });
  shapes.push({
    t: 'text', x: left, y: t.marker.boxes[0].y + 10, size: 2.6, fill: TEXT,
    text: `page ${pageIndex + 1} of ${t.pages.length}   sheet ${t.id.toString(16).toUpperCase().padStart(4, '0')}`,
  });
  const footY = t.marker.boxes[3].y + t.marker.size / 2 + 1;
  shapes.push({
    t: 'text', x: t.width / 2, y: footY, size: 2.6, fill: TEXT, anchor: 'middle',
    text: 'Write one character per box, sitting on the baseline. Any dark pen or pencil works.',
  });
  shapes.push({
    t: 'text', x: t.width / 2, y: footY + 3.6, size: 2.3, fill: TEXT, anchor: 'middle',
    text: 'Keep the four corner squares visible and flat when you take the photo.',
  });

  // cells
  const lines = guideLines(t);
  const { pad, label } = t.cell;
  for (const c of page.cells) {
    shapes.push({ t: 'rect', x: c.x + 0.4, y: c.y + 0.4, w: c.w - 0.8, h: c.h - 0.8, stroke: guide, sw: 0.3 });
    for (const g of lines) {
      const y = c.y + g.y;
      const isBase = g.name === 'baseline';
      shapes.push({
        t: 'line', x1: c.x + pad, y1: y, x2: c.x + c.w - pad, y2: y, stroke: guide,
        sw: isBase ? 0.35 : 0.2, dash: isBase ? undefined : g.name === 'descender' ? [0.6, 1.2] : [2, 1.2],
      });
    }
    const size = 3.4;
    const lx = c.x + label.x + label.w / 2;
    const ly = c.y + label.y + label.h / 2 + size * 0.36;
    shapes.push({ t: 'text', x: lx, y: ly, size, text: c.char, fill: [...LABEL_COLOR], anchor: 'middle' });
  }
  return shapes;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const n = (v) => String(Math.round(v * 1000) / 1000);

/**
 * Renders shapes as a standalone SVG document sized in millimetres.
 * @param {Shape[]} shapes @param {number} width @param {number} height @param {string} title
 */
export function shapesToSvg(shapes, width, height, title) {
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}mm" height="${n(height)}mm" viewBox="0 0 ${n(width)} ${n(height)}">`,
    `<title>${esc(title)}</title>`,
  ];
  for (const s of shapes) {
    if (s.t === 'rect') {
      const fill = s.fill ? `fill="${rgb(s.fill)}"` : 'fill="none"';
      const stroke = s.stroke ? ` stroke="${rgb(s.stroke)}" stroke-width="${n(s.sw || 0.2)}"${s.dash ? ` stroke-dasharray="${s.dash.map(n).join(' ')}"` : ''}` : '';
      out.push(`<rect x="${n(s.x)}" y="${n(s.y)}" width="${n(s.w)}" height="${n(s.h)}" ${fill}${stroke}/>`);
    } else if (s.t === 'line') {
      out.push(`<line x1="${n(s.x1)}" y1="${n(s.y1)}" x2="${n(s.x2)}" y2="${n(s.y2)}" stroke="${rgb(s.stroke)}" stroke-width="${n(s.sw)}"${s.dash ? ` stroke-dasharray="${s.dash.map(n).join(' ')}"` : ''}/>`);
    } else if (s.t === 'text') {
      const anchor = s.anchor && s.anchor !== 'start' ? ` text-anchor="${s.anchor}"` : '';
      out.push(`<text x="${n(s.x)}" y="${n(s.y)}" font-family="Helvetica, Arial, sans-serif" font-size="${n(s.size)}"${s.bold ? ' font-weight="700"' : ''} fill="${rgb(s.fill)}"${anchor}>${esc(s.text)}</text>`);
    }
  }
  out.push('</svg>');
  return out.join('\n');
}

/**
 * Creates a printable handwriting sheet set.
 *
 * @param {Parameters<typeof templateLayout>[0]} [options]
 *   `chars`: a string, a named set (`basicLatin`, `portuguese`, `digits`,
 *   `punctuation`, `lowercase`, `uppercase`, `essential`) or an array of both;
 *   `cols` (default 7), `rows` (auto), `pageSize` `'A4'` or `'Letter'`,
 *   `guides` (false or flags for baseline, xHeight, capHeight, descender,
 *   ascender), `metrics` (font metrics in units), `title`.
 * @returns {{ svg: string, svgPages: string[], pdf: Uint8Array, template: TemplateLayout, pages: number }}
 *   Pass `template` (or the whole result) to `scanSheet`.
 */
export function createTemplate(options = {}) {
  const template = templateLayout(options);
  const shapes = template.pages.map((_, i) => pageShapes(template, i));
  const svgPages = shapes.map((s, i) => shapesToSvg(s, template.width, template.height, `${template.title}, page ${i + 1}`));
  const pdf = writePdf(shapes, template.width, template.height, { title: template.title });
  return { svg: svgPages[0], svgPages, pdf, template, pages: template.pages.length };
}

export { textWidthEm };
