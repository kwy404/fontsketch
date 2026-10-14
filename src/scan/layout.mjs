// Geometry of the handwriting sheet, shared by the template renderer and the
// scanner. All lengths are millimetres on the page, Y pointing down.

import { resolveChars } from './charsets.mjs';

/** Page sizes in millimetres. */
export const PAGE_SIZES = Object.freeze({
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
});

/**
 * Inner 4x4 bit patterns of the four corner markers (bit `y * 4 + x`, 1 is
 * black), in the order top left, top right, bottom right, bottom left. Every
 * pattern differs from every rotation of itself and of the others in at least
 * 6 bits, so up to 2 misread modules are corrected and orientation is never
 * ambiguous.
 */
export const MARKER_CODES = Object.freeze([0xa2b2, 0x3926, 0xf4a1, 0x6ba5]);

/** Light cyan used for every guide; the scanner removes it. */
export const DROPOUT_COLOR = Object.freeze([159, 216, 238]);

/** Gray of the small reference character printed in each cell. */
export const LABEL_COLOR = Object.freeze([110, 110, 110]);

const CODE_BITS = 32;

/**
 * Rotates a 4x4 bit pattern by 90 degrees clockwise.
 * @param {number} c
 */
export function rotateCode(c) {
  let o = 0;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if ((c >> (y * 4 + x)) & 1) o |= 1 << (x * 4 + (3 - y));
    }
  }
  return o;
}

/** CRC-8 (polynomial 0x07) of a list of bytes. @param {number[]} bytes */
export function crc8(bytes) {
  let c = 0;
  for (const b of bytes) {
    c ^= b & 255;
    for (let i = 0; i < 8; i++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 255 : (c << 1) & 255;
  }
  return c;
}

/**
 * Bits of the page code: 16 bit sheet id, 4 bit page index, 4 bit page
 * count minus one, 8 bit CRC. Most significant bit first.
 * @param {number} id @param {number} page @param {number} count
 * @returns {number[]}
 */
export function encodePageCode(id, page, count) {
  const b0 = (id >> 8) & 255;
  const b1 = id & 255;
  const b2 = ((page & 15) << 4) | ((count - 1) & 15);
  const crc = crc8([b0, b1, b2]);
  const bits = [];
  for (const byte of [b0, b1, b2, crc]) for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  return bits;
}

/**
 * Inverse of `encodePageCode`; returns null when the CRC does not match.
 * @param {number[]} bits
 * @returns {{ id: number, page: number, count: number } | null}
 */
export function decodePageCode(bits) {
  if (bits.length !== CODE_BITS) return null;
  const bytes = [0, 0, 0, 0];
  for (let i = 0; i < CODE_BITS; i++) bytes[i >> 3] = (bytes[i >> 3] << 1) | (bits[i] ? 1 : 0);
  if (crc8(bytes.slice(0, 3)) !== bytes[3]) return null;
  return { id: (bytes[0] << 8) | bytes[1], page: bytes[2] >> 4, count: (bytes[2] & 15) + 1 };
}

/** 16 bit FNV-1a style hash folded from 32 bits. @param {string} text */
function hash16(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ((h >>> 16) ^ (h & 0xffff)) & 0xffff;
}

/**
 * @typedef {{
 *   char: string, page: number, row: number, col: number,
 *   x: number, y: number, w: number, h: number,
 * }} TemplateCell
 */

/**
 * @typedef {{
 *   kind: 'fontsketch-template', version: 1, id: number,
 *   pageSize: 'A4' | 'Letter', width: number, height: number,
 *   cols: number, rows: number, chars: string[], title: string,
 *   metrics: { unitsPerEm: number, ascender: number, descender: number, xHeight: number, capHeight: number, top: number, bottom: number },
 *   guides: { baseline: boolean, xHeight: boolean, capHeight: boolean, descender: boolean, ascender: boolean },
 *   marker: { size: number, module: number, quiet: number, boxes: Array<{ id: number, x: number, y: number }> },
 *   code: { x: number, y: number, module: number, bits: number },
 *   cell: { width: number, height: number, pad: number, unitsPerMm: number, baseline: number, label: { x: number, y: number, w: number, h: number } },
 *   grid: { x: number, y: number, width: number, height: number },
 *   pages: Array<{ index: number, cells: TemplateCell[] }>,
 *   dropoutColor: number[],
 * }} TemplateLayout
 */

/**
 * Computes the sheet geometry without rendering anything. The same options
 * always give the same layout and sheet id, so a layout can be rebuilt from
 * saved options.
 * @param {{
 *   chars?: string | string[], cols?: number, rows?: number, pageSize?: 'A4' | 'Letter',
 *   guides?: false | Partial<Record<'baseline'|'xHeight'|'capHeight'|'descender'|'ascender', boolean>>,
 *   metrics?: Partial<{ unitsPerEm: number, ascender: number, descender: number, xHeight: number, capHeight: number }>,
 *   title?: string, maxPages?: number,
 * }} [options]
 * @returns {TemplateLayout}
 */
export function templateLayout(options = {}) {
  const pageSize = options.pageSize === 'Letter' ? 'Letter' : 'A4';
  if (options.pageSize && !PAGE_SIZES[options.pageSize]) throw new RangeError(`createTemplate: unknown page size ${options.pageSize}`);
  const { width, height } = PAGE_SIZES[pageSize];
  const chars = resolveChars(options.chars);
  if (!chars.length) throw new RangeError('createTemplate: no characters to place');
  const cols = Math.round(options.cols || 7);
  if (cols < 2 || cols > 12) throw new RangeError('createTemplate: cols must be between 2 and 12');
  const m = {
    unitsPerEm: 1000, ascender: 800, descender: -200, xHeight: 500, capHeight: 700,
    ...(options.metrics || {}),
  };
  const top = Math.round(Math.max(m.ascender, m.capHeight) + 0.2 * m.capHeight);
  const bottom = Math.round(m.descender - 0.05 * m.unitsPerEm);
  const g = options.guides === false
    ? { baseline: false, xHeight: false, capHeight: false, descender: false, ascender: false }
    : { baseline: true, xHeight: true, capHeight: true, descender: true, ascender: false, ...(options.guides || {}) };

  const margin = 8;
  const size = 12;
  const quiet = 3;
  const gridX = margin;
  const gridY = margin + size + quiet;
  const gridW = width - 2 * margin;
  const gridH = height - 2 * (margin + size + quiet);
  const cw = gridW / cols;
  const rows = Math.round(options.rows || Math.max(2, Math.round(gridH / (cw * 1.1))));
  if (rows < 1 || rows > 16) throw new RangeError('createTemplate: rows must be between 1 and 16');
  const ch = gridH / rows;
  const pad = 1.2;
  const unitsPerMm = (top - bottom) / (ch - 2 * pad);
  const perPage = rows * cols;
  const pageCount = Math.ceil(chars.length / perPage);
  const maxPages = Math.min(15, options.maxPages || 15);
  if (pageCount > maxPages) {
    throw new RangeError(`createTemplate: ${chars.length} characters need ${pageCount} pages, more than ${maxPages}`);
  }
  const title = String(options.title || 'fontsketch handwriting sheet').slice(0, 60);
  const id = hash16(JSON.stringify([chars.join(''), pageSize, cols, rows, m, g, 1]));

  const pages = [];
  for (let p = 0; p < pageCount; p++) {
    const cells = [];
    for (let i = 0; i < perPage; i++) {
      const k = p * perPage + i;
      if (k >= chars.length) break;
      const row = Math.floor(i / cols);
      const col = i % cols;
      cells.push({ char: chars[k], page: p, row, col, x: gridX + col * cw, y: gridY + row * ch, w: cw, h: ch });
    }
    pages.push({ index: p, cells });
  }
  const codeModule = 2.5;
  return {
    kind: 'fontsketch-template',
    version: 1,
    id,
    pageSize,
    width,
    height,
    cols,
    rows,
    chars,
    title,
    metrics: { unitsPerEm: m.unitsPerEm, ascender: m.ascender, descender: m.descender, xHeight: m.xHeight, capHeight: m.capHeight, top, bottom },
    guides: g,
    marker: {
      size,
      module: size / 6,
      quiet,
      boxes: [
        { id: 0, x: margin, y: margin },
        { id: 1, x: width - margin - size, y: margin },
        { id: 2, x: width - margin - size, y: height - margin - size },
        { id: 3, x: margin, y: height - margin - size },
      ],
    },
    code: {
      x: width - margin - size - 4 - (CODE_BITS + 2) * codeModule,
      y: margin + size / 2 - codeModule / 2,
      module: codeModule,
      bits: CODE_BITS,
    },
    cell: {
      width: cw,
      height: ch,
      pad,
      unitsPerMm,
      baseline: pad + top / unitsPerMm,
      label: { x: pad, y: pad, w: 4.6, h: 4.6 },
    },
    grid: { x: gridX, y: gridY, width: gridW, height: gridH },
    pages,
    dropoutColor: [...DROPOUT_COLOR],
  };
}

/**
 * Y position (mm from the cell top) of a metric line in font units.
 * @param {TemplateLayout} t @param {number} units
 */
export function unitsToCellY(t, units) {
  return t.cell.baseline - units / t.cell.unitsPerMm;
}

/**
 * Guide lines of a cell as `{ name, y }` in mm from the cell top.
 * @param {TemplateLayout} t
 */
export function guideLines(t) {
  const out = [];
  const add = (name, units) => {
    if (t.guides[name]) out.push({ name, y: unitsToCellY(t, units) });
  };
  add('ascender', t.metrics.ascender);
  add('capHeight', t.metrics.capHeight);
  add('xHeight', t.metrics.xHeight);
  add('baseline', 0);
  add('descender', t.metrics.descender);
  return out;
}

/**
 * Black modules of a marker as `[col, row]` in a 6x6 grid (border included).
 * @param {number} id
 */
export function markerModules(id) {
  const code = MARKER_CODES[id];
  const out = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      const border = x === 0 || y === 0 || x === 5 || y === 5;
      if (border || (code >> ((y - 1) * 4 + (x - 1))) & 1) out.push([x, y]);
    }
  }
  return out;
}

/**
 * Resolves whatever the caller passed as `template` into a layout.
 * @param {any} t
 * @returns {TemplateLayout}
 */
export function asLayout(t) {
  if (!t) throw new TypeError('scanSheet: options.template is required (the object returned by createTemplate)');
  const layout = t.kind === 'fontsketch-template' ? t : t.template || t.layout;
  if (!layout || layout.kind !== 'fontsketch-template') throw new TypeError('scanSheet: options.template is not a fontsketch template');
  return layout;
}
