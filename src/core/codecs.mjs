// Compression codecs used by WOFF and WOFF2.
//
// zlib (WOFF) works everywhere: fontsketch ships its own synchronous
// deflate/inflate, and Node registers its built-in zlib for speed.
// Brotli (WOFF2) comes from Node's built-in zlib, or in browsers from the
// `brotli-wasm` package (Apache-2.0), which is loaded lazily by
// `loadBrotli()` the first time WOFF2 is needed.

import { deflate as jsDeflate, inflate as jsInflate } from './deflate.mjs';

/**
 * @typedef {{
 *   deflate: (data: Uint8Array) => Uint8Array,
 *   inflate: (data: Uint8Array, size?: number) => Uint8Array,
 *   brotliCompress: ((data: Uint8Array) => Uint8Array) | null,
 *   brotliDecompress: ((data: Uint8Array) => Uint8Array) | null,
 * }} Codecs
 */

/** @type {Codecs} */
export const codecs = {
  deflate: jsDeflate,
  inflate: jsInflate,
  brotliCompress: null,
  brotliDecompress: null,
};

/**
 * Replaces codecs, for example with Node's zlib or another Brotli encoder.
 * @param {Partial<Codecs>} next
 */
export function setCodecs(next) {
  Object.assign(codecs, next);
}

/** Pinned CDN build used when `brotli-wasm` cannot be imported by name. */
export const BROTLI_WASM_CDN = 'https://cdn.jsdelivr.net/npm/brotli-wasm@3.0.1/index.web.js';

let loading = null;

/**
 * Makes Brotli available for WOFF2 export and import. In Node it is built in
 * and this resolves at once; in browsers it imports `brotli-wasm` (through
 * your bundler, or from the pinned jsDelivr URL as a fallback).
 * @param {{ url?: string }} [options]
 * @returns {Promise<void>}
 */
export function loadBrotli(options = {}) {
  if (codecs.brotliCompress && codecs.brotliDecompress) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      let mod;
      if (!options.url) {
        try {
          mod = await import(/* @vite-ignore */ 'brotli-wasm');
        } catch {
          mod = null;
        }
      }
      if (!mod) mod = await import(/* @vite-ignore */ options.url || BROTLI_WASM_CDN);
      const ready = await (mod.default ?? mod);
      const api = ready.default && ready.default.compress ? ready.default : ready;
      setCodecs({
        brotliCompress: (data) => api.compress(data, { quality: 11 }),
        brotliDecompress: (data) => api.decompress(data),
      });
    })().catch((err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

/** @returns {(data: Uint8Array) => Uint8Array} */
export function requireBrotli(kind) {
  const fn = kind === 'compress' ? codecs.brotliCompress : codecs.brotliDecompress;
  if (!fn) {
    throw new Error('fontsketch: WOFF2 needs Brotli. In browsers call `await loadBrotli()` once (or use exportFontAsync / parseFontAsync).');
  }
  return fn;
}
