// Public API of the fontsketch core. Early stub: the model helpers are real,
// the compiler and geometry entries below are being filled in.
export {
  createFont, addGlyph, removeGlyph, glyphNameFor, unicodeFor, serialize, deserialize,
  cloneFont, validateFont, isValidGlyphName, notdefGlyph, DEFAULT_META,
} from './model.mjs';

const pending = (name) => () => {
  throw new Error(`fontsketch: ${name} is not implemented yet`);
};

/** @type {(font: import('./model.mjs').Font, accentedChar: string) => import('./model.mjs').Glyph} */
export const compose = pending('compose');
/** @type {(font: import('./model.mjs').Font, options?: { format?: 'ttf'|'otf'|'woff'|'woff2', variable?: boolean, hinting?: 'auto'|'manual'|'none' }) => Uint8Array} */
export const exportFont = pending('exportFont');
/** @type {(bytes: Uint8Array | ArrayBuffer) => import('./model.mjs').Font} */
export const parseFont = pending('parseFont');
/** @type {(font: import('./model.mjs').Font, url: string, options?: object) => string} */
export const cssFontFace = pending('cssFontFace');
export {
  pathFromPoints, simplify, fitCurves, fitContour, cubicToQuadratic, contourFromCubics, contourArea,
  correctDirection, reverseContour, removeOverlaps, bounds, controlBounds, strokeToOutline, circleContour,
  flattenContour, windingNumber, transformContours, roundContours, contourSegments,
} from './geometry.mjs';
