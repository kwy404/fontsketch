// Public API of the fontsketch core (browser and Node).

import { compileSfnt } from './compile.mjs';
import { sfntToWoff } from './woff.mjs';
import { sfntToWoff2 } from './woff2.mjs';
import { detectFormat, parseFont } from './parse.mjs';
import { loadBrotli } from './codecs.mjs';
import { toUint8 } from './binary.mjs';

export {
  createFont, addGlyph, removeGlyph, glyphNameFor, unicodeFor, serialize, deserialize,
  cloneFont, validateFont, isValidGlyphName, notdefGlyph, DEFAULT_META,
} from './model.mjs';
export {
  pathFromPoints, simplify, fitCurves, fitContour, cubicToQuadratic, contourFromCubics, contourArea,
  correctDirection, reverseContour, removeOverlaps, bounds, controlBounds, strokeToOutline, circleContour,
  flattenContour, windingNumber, transformContours, roundContours, contourSegments,
} from './geometry.mjs';
export { compose, composeAll, decompose, COMPOSABLE, PORTUGUESE } from './compose.mjs';
export { parseFont, detectFormat, toSfnt } from './parse.mjs';
export { cssFontFace, unicodeRange } from './css.mjs';
export { interpolate, namedInstances, normalizeLocation, checkCompatibility, VariationModel } from './variable.mjs';
export { detectZones, findEdges, findStems, parseHintText, formatHintText } from './hinting.mjs';
export { svgToContours, parsePathData, parseTransform } from './svg.mjs';
export { loadBrotli, setCodecs, BROTLI_WASM_CDN } from './codecs.mjs';
export { sfntToWoff, woffToSfnt } from './woff.mjs';
export { sfntToWoff2, woff2ToSfnt } from './woff2.mjs';
export { verifyChecksums } from './sfnt.mjs';
export { inflate, deflate } from './deflate.mjs';

/**
 * @typedef {{
 *   format?: 'ttf' | 'otf' | 'woff' | 'woff2',
 *   variable?: boolean,
 *   hinting?: 'auto' | 'manual' | 'none',
 *   outlines?: 'truetype' | 'cff',
 *   legacyKern?: boolean,
 *   correctDirections?: boolean,
 *   removeOverlaps?: boolean,
 *   optimize?: boolean,
 *   timestamp?: Date | number,
 *   onWarning?: (message: string) => void,
 * }} ExportOptions
 * `outlines` picks TrueType or CFF outlines inside WOFF and WOFF2 (TTF is
 * always TrueType and OTF always CFF). Variable fonts use TrueType outlines.
 * `removeOverlaps` merges overlapping contours; it is on by default for CFF
 * outlines (PostScript rasterizers need it) and off for TrueType, which
 * renders overlaps correctly. `correctDirections` (default on) fixes the
 * direction of nested contours. `optimize` (default on) drops implied on
 * curve points.
 */

/**
 * Compiles a font to TTF, OTF, WOFF or WOFF2 bytes.
 *
 * WOFF2 needs Brotli: it is built into Node; in browsers call
 * `await loadBrotli()` once first, or use `exportFontAsync`.
 * @param {import('./model.mjs').Font} font
 * @param {ExportOptions} [options]
 * @returns {Uint8Array}
 */
export function exportFont(font, options = {}) {
  const format = options.format || 'ttf';
  if (!['ttf', 'otf', 'woff', 'woff2'].includes(format)) throw new TypeError(`exportFont: unknown format "${format}"`);
  const outlines = format === 'otf' ? 'cff' : format === 'ttf' ? 'truetype' : options.outlines || 'truetype';
  if (options.variable && format === 'otf') throw new Error('exportFont: variable fonts are exported as "ttf", "woff" or "woff2" (TrueType outlines)');
  const sfnt = compileSfnt(font, { ...options, outlines });
  if (format === 'woff') return sfntToWoff(sfnt);
  if (format === 'woff2') return sfntToWoff2(sfnt);
  return sfnt;
}

/**
 * Like `exportFont`, but loads the Brotli codec first when WOFF2 is asked
 * for, so it also works in browsers without any setup.
 * @param {import('./model.mjs').Font} font
 * @param {ExportOptions} [options]
 * @returns {Promise<Uint8Array>}
 */
export async function exportFontAsync(font, options = {}) {
  if ((options.format || 'ttf') === 'woff2') await loadBrotli();
  return exportFont(font, options);
}

/**
 * Like `parseFont`, but loads the Brotli codec first for WOFF2 input.
 * @param {Uint8Array | ArrayBuffer} bytes
 * @returns {Promise<import('./model.mjs').Font>}
 */
export async function parseFontAsync(bytes) {
  const b = toUint8(bytes);
  if (detectFormat(b) === 'woff2') await loadBrotli();
  return parseFont(b);
}

/** MIME type for each export format. */
export const MIME_TYPES = Object.freeze({ ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' });
