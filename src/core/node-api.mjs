// File based helpers for Node and the CLI: build projects, make icon fonts
// from SVG folders, inspect fonts and write static instances.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { createFont, addGlyph, deserialize } from './model.mjs';
import { compileSfnt, postscriptName } from './compile.mjs';
import { sfntToWoff } from './woff.mjs';
import { sfntToWoff2 } from './woff2.mjs';
import { detectFormat, parseFont, toSfnt } from './parse.mjs';
import { readSfnt, verifyChecksums } from './sfnt.mjs';
import { readHead, readMaxp, readName, readOS2 } from './tables.mjs';
import { readFvar } from './variable.mjs';
import { interpolate } from './variable.mjs';
import { svgToContours } from './svg.mjs';
import { cssFontFace } from './css.mjs';

const EXT = { ttf: 'ttf', otf: 'otf', woff: 'woff', woff2: 'woff2' };

/**
 * Reads a font file (TTF, OTF, WOFF, WOFF2) or a `.fontsketch.json` project.
 * @param {string} path
 * @returns {import('./model.mjs').Font}
 */
export function readFontFile(path) {
  const bytes = new Uint8Array(readFileSync(path));
  if (detectFormat(bytes) !== 'unknown') return parseFont(bytes);
  const text = new TextDecoder().decode(bytes);
  try {
    return deserialize(text);
  } catch (err) {
    throw new Error(`${path}: not a font file or fontsketch project (${/** @type {Error} */ (err).message})`);
  }
}

/**
 * @param {import('./model.mjs').Font} font
 * @param {string} format
 * @param {object} options
 */
function encode(font, format, options) {
  const outlines = format === 'otf' ? 'cff' : format === 'ttf' ? 'truetype' : options.outlines || 'truetype';
  const sfnt = compileSfnt(font, { ...options, outlines });
  if (format === 'woff') return sfntToWoff(sfnt);
  if (format === 'woff2') return sfntToWoff2(sfnt);
  return sfnt;
}

/**
 * Compiles a project into font files (and an @font-face stylesheet).
 * @param {string | import('./model.mjs').Font} project path to a `.fontsketch.json` (or any font file) or a font object
 * @param {{ out?: string, formats?: string[], hinting?: 'auto' | 'manual' | 'none', variable?: boolean,
 *   legacyKern?: boolean, outlines?: 'truetype' | 'cff', css?: boolean, onWarning?: (m: string) => void }} [options]
 * @returns {Array<{ path: string, bytes: number }>}
 */
export function buildProject(project, options = {}) {
  const font = typeof project === 'string' ? readFontFile(project) : project;
  const out = resolve(options.out || 'dist-fonts');
  mkdirSync(out, { recursive: true });
  const formats = options.formats?.length ? options.formats : ['ttf', 'woff2'];
  const base = postscriptName(font.meta.family, font.meta.style || 'Regular') + (options.variable ? '-VF' : '');
  const written = [];
  for (const f of formats) {
    if (!(f in EXT)) throw new Error(`unknown format "${f}" (use ttf, otf, woff or woff2)`);
    if (options.variable && f === 'otf') throw new Error('variable fonts are written as ttf, woff or woff2');
    const bytes = encode(font, f, options);
    const path = join(out, `${base}.${EXT[f]}`);
    writeFileSync(path, bytes);
    written.push({ path, bytes: bytes.length });
  }
  if (options.css !== false) {
    const order = ['woff2', 'woff', 'ttf', 'otf'].filter((f) => formats.includes(f));
    const css = cssFontFace(font, order.map((f) => `./${base}.${EXT[f]}`), { variable: options.variable });
    const path = join(out, `${base}.css`);
    writeFileSync(path, `${css}\n`);
    written.push({ path, bytes: css.length + 1 });
  }
  return written;
}

/**
 * Builds an icon font from a folder of SVG files. Each file becomes a glyph
 * named after the file; code points start at U+E000 (Private Use Area)
 * unless the file name ends with a code point such as `home-uE001.svg`.
 * Writes the fonts, a stylesheet with one class per icon and an HTML
 * preview page.
 * @param {string} dir
 * @param {{ family?: string, out?: string, formats?: string[], start?: number, prefix?: string,
 *   hinting?: 'auto' | 'none', onWarning?: (m: string) => void }} [options]
 * @returns {{ font: import('./model.mjs').Font, files: Array<{ path: string, bytes: number }>, icons: Array<{ name: string, code: number, file: string }> }}
 */
export function fromSvgFolder(dir, options = {}) {
  const family = options.family || 'Icons';
  const prefix = options.prefix || 'icon';
  const files = readdirSync(dir).filter((f) => extname(f).toLowerCase() === '.svg').sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0));
  if (!files.length) throw new Error(`${dir}: no .svg files found`);
  const font = createFont({ family, ascender: 850, descender: -150, xHeight: 500, capHeight: 700 });
  let next = options.start ?? 0xe000;
  const used = new Set();
  const icons = [];
  const warn = options.onWarning || (() => {});
  for (const file of files) {
    const stem = basename(file, extname(file));
    const fixed = /[-_]u([0-9a-f]{4,6})$/i.exec(stem);
    let code;
    if (fixed) code = parseInt(fixed[1], 16);
    else {
      while (used.has(next)) next++;
      code = next++;
    }
    used.add(code);
    const label = (fixed ? stem.slice(0, fixed.index) : stem).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `icon${code.toString(16)}`;
    let name = label.replace(/-/g, '_');
    if (/^[0-9]/.test(name)) name = `_${name}`;
    while (font.glyphs[name]) name = `${name}_`;
    const svg = readFileSync(join(dir, file), 'utf8');
    const { contours, advanceWidth, warnings } = svgToContours(svg, { unitsPerEm: 1000, ascender: 850, descender: -150 });
    for (const w of warnings) warn(`${file}: ${w}`);
    addGlyph(font, { name, unicodes: [code], advanceWidth, contours });
    icons.push({ name: label, code, file });
  }
  const out = resolve(options.out || 'dist-icons');
  const written = buildProject(font, { out, formats: options.formats?.length ? options.formats : ['woff2', 'woff', 'ttf'], hinting: options.hinting || 'none', css: false, onWarning: warn });
  const base = postscriptName(family, 'Regular');
  const formats = options.formats?.length ? options.formats : ['woff2', 'woff', 'ttf'];
  const order = ['woff2', 'woff', 'ttf', 'otf'].filter((f) => formats.includes(f));
  const css = [
    cssFontFace(font, order.map((f) => `./${base}.${EXT[f]}`), { display: 'block' }),
    '',
    `.${prefix} {`,
    `  font-family: "${family.replace(/"/g, '')}";`,
    '  font-style: normal;',
    '  font-weight: normal;',
    '  line-height: 1;',
    '  speak: never;',
    '  -webkit-font-smoothing: antialiased;',
    '  -moz-osx-font-smoothing: grayscale;',
    '}',
    '',
    ...icons.map((i) => `.${prefix}-${i.name}::before { content: "\\${i.code.toString(16)}"; }`),
    '',
  ].join('\n');
  const cssPath = join(out, `${base}.css`);
  writeFileSync(cssPath, css);
  const html = previewHtml(family, `./${base}.css`, prefix, icons);
  const htmlPath = join(out, 'index.html');
  writeFileSync(htmlPath, html);
  written.push({ path: cssPath, bytes: css.length }, { path: htmlPath, bytes: html.length });
  return { font, files: written, icons };
}

function previewHtml(family, cssHref, prefix, icons) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const cards = icons.map((i) => `    <li><i class="${prefix} ${prefix}-${esc(i.name)}" aria-hidden="true"></i><code>.${prefix}-${esc(i.name)}</code><small>U+${i.code.toString(16).toUpperCase()}</small></li>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(family)} icons</title>
<link rel="stylesheet" href="${esc(cssHref)}">
<style>
  :root { color-scheme: light dark; --bg: #fbfaf7; --fg: #1d1b16; --card: #ffffff; --line: #e5e1d8; }
  @media (prefers-color-scheme: dark) { :root { --bg: #16150f; --fg: #f1ede4; --card: #211f18; --line: #39352b; } }
  body { margin: 0; padding: 32px 16px; font: 15px/1.5 system-ui, sans-serif; background: var(--bg); color: var(--fg); }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p { margin: 0 0 24px; opacity: 0.75; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  li { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 18px 10px; display: grid; justify-items: center; gap: 6px; }
  li i { font-size: 40px; }
  code { font-size: 12px; word-break: break-all; text-align: center; }
  small { opacity: 0.6; }
</style>
</head>
<body>
  <h1>${esc(family)}</h1>
  <p>${icons.length} icons. Use <code>&lt;i class="${prefix} ${prefix}-name"&gt;&lt;/i&gt;</code>.</p>
  <ul>
${cards}
  </ul>
</body>
</html>
`;
}

/**
 * Summary of a font file: format, names, metrics, tables and features.
 * @param {Uint8Array} bytes
 */
export function fontInfo(bytes) {
  const format = detectFormat(bytes);
  const sfnt = toSfnt(bytes);
  const { tables, flavor } = readSfnt(sfnt);
  const names = tables.has('name') ? readName(/** @type {Uint8Array} */ (tables.get('name'))) : {};
  const head = readHead(/** @type {Uint8Array} */ (tables.get('head')));
  const maxp = readMaxp(/** @type {Uint8Array} */ (tables.get('maxp')));
  const os2 = tables.has('OS/2') ? readOS2(/** @type {Uint8Array} */ (tables.get('OS/2'))) : null;
  const font = parseFont(sfnt);
  const fvar = tables.has('fvar') ? readFvar(/** @type {Uint8Array} */ (tables.get('fvar')), names) : null;
  return {
    format,
    outlines: flavor === 0x4f54544f ? 'cff' : 'truetype',
    size: bytes.length,
    family: font.meta.family,
    style: font.meta.style,
    fullName: names[4] || '',
    postscriptName: names[6] || '',
    version: names[5] || font.meta.version,
    designer: font.meta.designer,
    license: font.meta.license,
    unitsPerEm: head.unitsPerEm,
    ascender: font.meta.ascender,
    descender: font.meta.descender,
    lineGap: font.meta.lineGap,
    xHeight: font.meta.xHeight,
    capHeight: font.meta.capHeight,
    weightClass: os2?.weightClass,
    glyphs: maxp.numGlyphs,
    characters: Object.values(font.glyphs).reduce((a, g) => a + g.unicodes.length, 0),
    kerningPairs: Object.keys(font.kerning.pairs).length,
    kerningClasses: Object.keys(font.kerning.classes).length,
    hinted: tables.has('fpgm') || tables.has('prep') || (tables.has('CFF ') && Object.values(font.glyphs).some((g) => g.hints)),
    variable: !!fvar,
    axes: fvar?.axes || [],
    instances: fvar?.instances || [],
    tables: [...tables].map(([tag, data]) => ({ tag, length: data.length })),
    checksumProblems: format === 'ttf' || format === 'otf' ? verifyChecksums(sfnt) : [],
  };
}

/**
 * Writes a static instance of a variable font or project.
 * @param {Uint8Array | import('./model.mjs').Font} input
 * @param {Record<string, number>} location user coordinates such as `{ wght: 700 }`
 * @param {{ format?: 'ttf' | 'otf' | 'woff' | 'woff2', hinting?: 'auto' | 'none' }} [options]
 */
export function makeInstance(input, location, options = {}) {
  const font = input instanceof Uint8Array ? parseFont(input) : input;
  const instance = interpolate(font, location);
  return { font: instance, bytes: encode(instance, options.format || 'ttf', { hinting: options.hinting || 'none' }) };
}
