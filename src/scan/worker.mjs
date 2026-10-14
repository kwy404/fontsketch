// Optional Web Worker entry: runs the scan pipeline off the main thread.
//
//   const worker = new Worker(new URL('fontsketch/scan/worker', import.meta.url), { type: 'module' });
//   worker.postMessage({ id: 1, type: 'scan', image: imageData, template });
//   worker.onmessage = (e) => console.log(e.data.result.glyphs);
//
// Messages: `{ id, type: 'scan' | 'rescan' | 'import' | 'importSvg', ... }`.
// `scan` takes `image` (ImageData or ImageBitmap) and `template` plus scan
// options and keeps the last result so `rescan` can re-run one cell with
// `{ char, options }`. Replies are `{ id, ok: true, result }` or
// `{ id, ok: false, error, code }`.

import { importImage, importSvg, scanSheet } from './index.mjs';

let last = null;

/** @param {any} data */
export function handle(data) {
  const { type } = data;
  if (type === 'scan') {
    last = scanSheet(data.image, { ...(data.options || {}), template: data.template });
    return strip(last);
  }
  if (type === 'rescan') {
    if (!last) throw new Error('rescan: scan a sheet first');
    return last.rescan(data.char, data.options || {});
  }
  if (type === 'import') return importImage(data.image, data.options || {});
  if (type === 'importSvg') return importSvg(data.svg, data.options || {});
  throw new Error(`unknown message type ${type}`);
}

function strip(result) {
  const { glyphs, warnings, page, pageCount, sheetId, reprojectionError, pixelsPerMm, resolution, markers } = result;
  return {
    glyphs, warnings, page, pageCount, sheetId, reprojectionError, pixelsPerMm, resolution,
    markers: markers.map((m) => ({ id: m.id, corners: m.corners, errors: m.errors })),
  };
}

const scope = typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof window === 'undefined' ? self : null;
if (scope) {
  scope.onmessage = (e) => {
    const { id } = e.data || {};
    try {
      scope.postMessage({ id, ok: true, result: handle(e.data) });
    } catch (err) {
      scope.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err), code: err && err.code });
    }
  };
}
