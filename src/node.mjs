// Package entry for Node: the same API as the browser entry, with Node's
// built-in zlib registered for WOFF (faster) and WOFF2 (Brotli), plus the
// file based helpers used by the CLI.
import zlib from 'node:zlib';
import { setCodecs } from './core/codecs.mjs';

setCodecs({
  deflate: (data) => new Uint8Array(zlib.deflateSync(data, { level: 9 })),
  inflate: (data) => new Uint8Array(zlib.inflateSync(data)),
  brotliCompress: (data) => new Uint8Array(zlib.brotliCompressSync(data, {
    params: {
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_FONT,
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length,
    },
  })),
  brotliDecompress: (data) => new Uint8Array(zlib.brotliDecompressSync(data)),
});

export * from './index.mjs';
export { buildProject, fromSvgFolder, fontInfo, makeInstance, readFontFile } from './core/node-api.mjs';
