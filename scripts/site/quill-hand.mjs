// Builds Quill Hand, the default handwritten font of the fontsketch site and
// editor, from the spine strokes in quill-hand-strokes.mjs. Writes the
// project file (docs/assets/fonts/quill-hand.fontsketch.json), the strokes
// used by the hero stage (quill-hand.strokes.json) and, when the compiler is
// available, the WOFF2 and TTF files.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../../src/core/index.mjs';
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
    'A|V': -50, 'V|A': -50, 'A|T': -40, 'T|A': -40, 'A|Y': -40, 'Y|A': -40, 'A|W': -30, 'W|A': -30,
    'T|o': -60, 'T|a': -60, 'T|e': -60, 'T|y': -30, 'T|r': -30, 'V|o': -40, 'V|a': -40, 'V|e': -40,
    'Y|o': -50, 'Y|a': -50, 'Y|e': -50, 'P|a': -30, 'P|o': -30, 'F|o': -30, 'F|a': -30, 'L|T': -60,
    'L|V': -50, 'L|Y': -50, 'r|period': -40, 'r|comma': -40, 'f|o': -10, 'y|period': -30, 'v|period': -30,
    'quoteright|s': -20, 'W|o': -30, 'W|a': -30,
  };
  font.kerning.pairs = k;
  return { font, strokeData };
}

export function writeQuillHand() {
  const { font, strokeData } = buildQuillHand();
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'quill-hand.fontsketch.json'), core.serialize(font));
  writeFileSync(resolve(out, 'quill-hand.strokes.json'), JSON.stringify({ slant: SLANT, glyphs: strokeData }));
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
