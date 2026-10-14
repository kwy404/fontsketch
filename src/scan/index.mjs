// fontsketch scan: printable handwriting sheets, the photo pipeline that
// turns a filled sheet into glyph outlines, and template free imports.

export { createTemplate, pageShapes, shapesToSvg } from './template.mjs';
export {
  templateLayout, guideLines, encodePageCode, decodePageCode, PAGE_SIZES, MARKER_CODES, DROPOUT_COLOR,
} from './layout.mjs';
export { CHARSETS, resolveChars, verticalClass } from './charsets.mjs';
export { scanSheet, scanSheets, rescanCell, segmentCells, prepareSheet, pageHomography, readPageCode, ScanError } from './scan.mjs';
export { findMarkers } from './markers.mjs';
export { findHomography, applyH, invertH, warpPerspective } from './homography.mjs';
export { normalizeLighting } from './lighting.mjs';
export { binarizeInk, sauvola, unmix, densities, despeckle, strokeWidth } from './binarize.mjs';
export { traceBitmap, traceMask, pathsToContours } from './trace.mjs';
export { importImage, importSvg, assignChars, binarize, segmentRows, parsePathData, parseTransform } from './import.mjs';
export { toRGBA } from './image.mjs';
export { writePdf } from './pdf.mjs';
