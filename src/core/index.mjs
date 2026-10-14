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
/** @type {(contours: import('./model.mjs').Contour[]) => string} */
export const pathFromPoints = pending('pathFromPoints');
/** @type {(points: Array<{x:number,y:number}>, tolerance?: number) => Array<{x:number,y:number}>} */
export const simplify = pending('simplify');
/** @type {(points: Array<{x:number,y:number}>, error?: number) => Array<[{x:number,y:number},{x:number,y:number},{x:number,y:number},{x:number,y:number}]>} */
export const fitCurves = pending('fitCurves');
/** @type {(p0: {x:number,y:number}, p1: {x:number,y:number}, p2: {x:number,y:number}, p3: {x:number,y:number}, tolerance?: number) => Array<{x:number,y:number,on:boolean}>} */
export const cubicToQuadratic = pending('cubicToQuadratic');
/** @type {(contour: import('./model.mjs').Contour) => number} */
export const contourArea = pending('contourArea');
/** @type {(contours: import('./model.mjs').Contour[]) => import('./model.mjs').Contour[]} */
export const correctDirection = pending('correctDirection');
/** @type {(contours: import('./model.mjs').Contour[]) => import('./model.mjs').Contour[]} */
export const removeOverlaps = pending('removeOverlaps');
/** @type {(contours: import('./model.mjs').Contour[]) => { xMin: number, yMin: number, xMax: number, yMax: number }} */
export const bounds = pending('bounds');
