// Builds Quill Hand, the default handwritten font of the fontsketch site and
// editor, from the spine strokes in quill-hand-strokes.mjs. Writes the
// project file (docs/assets/fonts/quill-hand.fontsketch.json), the strokes
// used by the hero stage (quill-hand.strokes.json) and, when the compiler is
// available, the WOFF2 and TTF files.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../../src/node.mjs';
import { strokesToContours } from '../../docs/assets/site/stroke.mjs';
import { GLYPHS, MARKS, ACCENTED } from './quill-hand-strokes.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'docs/assets/fonts');

export const SLANT = 0.1;
const XH = 480, CAP = 700;
const MARK_CODES = { grave: 0x300, acute: 0x301, circumflex: 0x302, tilde: 0x303, dieresis: 0x308, ring: 0x30a, cedilla: 0x327 };

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function seedOf(name) {
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Applies a small natural wobble and the slant to a glyph's spine strokes. */
export function finishStrokes(name, strokes, amount = 5) {
  const rand = rng(seedOf(name));
  return strokes.map((st) => {
    const pts = Array.isArray(st) ? st : st.pts;
    const w = Array.isArray(st) ? undefined : st.w;
    const moved = pts.map(([x, y]) => {
      const jx = (rand() - 0.5) * 2 * amount, jy = (rand() - 0.5) * 2 * amount;
      const nx = x + jx, ny = y + jy;
      return [Math.round(nx + ny * SLANT), Math.round(ny)];
    });
    return w ? { pts: moved, w } : { pts: moved };
  });
}

function spineBounds(strokes) {
  let x0 = Infinity, x1 = -Infinity;
  for (const st of strokes) for (const [x] of Array.isArray(st) ? st : st.pts) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
  }
  return [x0, x1];
}

export function buildQuillHand() {
  const font = core.createFont({
    family: 'Quill Hand',
    style: 'Regular',
    version: '1.000',
    designer: 'Alexandre Kohler',
    designerURL: 'https://github.com/kwy404',
    vendorURL: 'https://kwy404.github.io/fontsketch/',
    license: 'MIT License. Free for personal and commercial use.',
    licenseURL: 'https://github.com/kwy404/fontsketch/blob/main/LICENSE',
    copyright: 'Copyright (c) 2026 Alexandre Kohler',
    description: 'Quill Hand, a friendly handwritten font drawn with fontsketch.',
    unitsPerEm: 1000,
    ascender: 900,
    descender: -260,
    xHeight: XH,
    capHeight: CAP,
    lineGap: 0,
  });
  /** @type {Record<string, { advance: number, strokes: any[] }>} */
  const strokeData = {};
  for (const [name, [advance, raw]] of Object.entries(GLYPHS)) {
    const strokes = finishStrokes(name, raw);
    strokeData[name] = { advance, strokes };
    const [x0, x1] = spineBounds(raw);
    const cx = (x0 + x1) / 2;
    const isCap = /^[A-Z]$/.test(name);
    const h = isCap ? CAP : XH;
    core.addGlyph(font, {
      name,
      advanceWidth: advance,
      contours: strokesToContours(strokes),
      anchors: { top: { x: Math.round(cx + h * SLANT), y: h }, bottom: { x: Math.round(cx), y: 0 } },
    });
  }
  core.addGlyph(font, { name: 'uni00A0', unicodes: [0xa0], advanceWidth: font.glyphs.space.advanceWidth, contours: [] });
  for (const [mark, code] of Object.entries(MARK_CODES)) {
    const name = core.glyphNameFor(code);
    const strokes = finishStrokes(name, MARKS[`${mark}comb`], 3);
    strokeData[name] = { advance: 0, strokes };
    const anchors = mark === 'cedilla' ? { _bottom: { x: -10, y: 0 } } : { _top: { x: Math.round(XH * SLANT + 16), y: XH } };
    core.addGlyph(font, { name, unicodes: [code], advanceWidth: 0, contours: strokesToContours(strokes), anchors });
  }
  for (const [base, , ch, mark] of ACCENTED) {
    const composed = (ch + String.fromCodePoint(MARK_CODES[mark])).normalize('NFC');
    const name = core.glyphNameFor(composed);
    const b = font.glyphs[base];
    const m = font.glyphs[core.glyphNameFor(MARK_CODES[mark])];
    const below = mark === 'cedilla';
    const anchorB = below ? b.anchors.bottom : b.anchors.top;
    const anchorM = below ? m.anchors._bottom : m.anchors._top;
    core.addGlyph(font, {
      name,
      unicodes: [/** @type {number} */ (composed.codePointAt(0))],
      advanceWidth: b.advanceWidth,
      contours: [],
      components: [
        { glyph: base, dx: 0, dy: 0 },
        { glyph: m.name, dx: anchorB.x - anchorM.x, dy: anchorB.y - anchorM.y },
      ],
    });
  }
  // A little kerning for the pairs handwriting gets wrong most.
  const k = {
    'A|V': -90, 'V|A': -90, 'A|T': -70, 'T|A': -70, 'A|Y': -70, 'Y|A': -70, 'A|W': -50, 'W|A': -50,
    'T|o': -90, 'T|a': -90, 'T|e': -90, 'T|y': -60, 'T|r': -50, 'T|u': -50, 'V|o': -60, 'V|a': -60, 'V|e': -60,
    'Y|o': -70, 'Y|a': -70, 'Y|e': -70, 'P|a': -40, 'P|o': -40, 'F|o': -40, 'F|a': -40, 'L|T': -80,
    'L|V': -70, 'L|Y': -70, 'r|period': -50, 'r|comma': -50, 'f|o': -15, 'y|period': -40, 'v|period': -40,
    'quoteright|s': -30, 'W|o': -60, 'W|a': -60, 'W|e': -50,
  };
  font.kerning.pairs = k;
  return { font, strokeData };
}

export function writeQuillHand() {
  const { font, strokeData } = buildQuillHand();
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'quill-hand.fontsketch.json'), core.serialize(font));
  // Compact data for the site studio: spines, code points, composites and kerning.
  const glyphs = {};
  const composites = {};
  for (const g of Object.values(font.glyphs)) {
    if (g.components?.length) composites[g.name] = { u: g.unicodes, adv: g.advanceWidth, comps: g.components.map((c) => [c.glyph, c.dx, c.dy]) };
    else if (strokeData[g.name]) glyphs[g.name] = { u: g.unicodes, adv: strokeData[g.name].advance, s: strokeData[g.name].strokes.map((st) => (st.w ? { p: st.pts, w: st.w } : st.pts)) };
    else if (g.name !== '.notdef') glyphs[g.name] = { u: g.unicodes, adv: g.advanceWidth, s: [] };
  }
  const { family, ...meta } = font.meta;
  void family;
  writeFileSync(resolve(out, 'quill-hand.strokes.json'), JSON.stringify({ meta, slant: SLANT, glyphs, composites, kerning: font.kerning.pairs }));
  const files = ['quill-hand.fontsketch.json', 'quill-hand.strokes.json'];
  for (const format of ['woff2', 'ttf']) {
    try {
      const bytes = core.exportFont(font, { format, hinting: 'auto' });
      if (bytes && typeof bytes.then === 'function') continue;
      writeFileSync(resolve(out, `quill-hand.${format}`), bytes);
      files.push(`quill-hand.${format}`);
    } catch (err) {
      console.warn(`quill-hand: ${format} skipped (${/** @type {Error} */ (err).message})`);
    }
  }
  return { font, files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { font, files } = writeQuillHand();
  console.log(`quill-hand: ${Object.keys(font.glyphs).length} glyphs, wrote ${files.join(', ')}`);
}
