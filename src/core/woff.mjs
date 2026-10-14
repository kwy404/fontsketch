// WOFF 1.0 (zlib compressed tables) writer and reader.

import { Reader, Writer } from './binary.mjs';
import { assembleSfnt, readSfnt } from './sfnt.mjs';
import { codecs } from './codecs.mjs';

/**
 * Wraps an sfnt binary as WOFF. Each table is zlib compressed when that
 * makes it smaller, as the format requires.
 * @param {Uint8Array} sfnt
 * @returns {Uint8Array}
 */
export function sfntToWoff(sfnt) {
  const { flavor, tables, checksums } = readSfnt(sfnt);
  const tags = [...tables.keys()].sort();
  const entries = tags.map((tag) => {
    const data = /** @type {Uint8Array} */ (tables.get(tag));
    const packed = data.length ? codecs.deflate(data) : data;
    const body = packed.length < data.length ? packed : data;
    return { tag, data: body, origLength: data.length, checksum: /** @type {number} */ (checksums.get(tag)) };
  });
  let totalSfntSize = 12 + 16 * tags.length;
  for (const e of entries) totalSfntSize += (e.origLength + 3) & ~3;
  let offset = 44 + 20 * entries.length;
  const offsets = entries.map((e) => {
    const o = offset;
    offset += (e.data.length + 3) & ~3;
    return o;
  });
  const total = offset;
  const w = new Writer(total);
  w.tag('wOFF').u32(flavor).u32(total).u16(entries.length).u16(0).u32(totalSfntSize);
  w.u16(1).u16(0).u32(0).u32(0).u32(0).u32(0).u32(0);
  entries.forEach((e, i) => w.tag(e.tag).u32(offsets[i]).u32(e.data.length).u32(e.origLength).u32(e.checksum));
  for (const e of entries) {
    w.bytes(e.data);
    w.pad(4);
  }
  return w.toBytes();
}

/**
 * Unwraps a WOFF file into an sfnt binary.
 * @param {Uint8Array} woff
 * @returns {Uint8Array}
 */
export function woffToSfnt(woff) {
  const r = new Reader(woff, 0, 'WOFF');
  if (r.tag() !== 'wOFF') throw new Error('WOFF: bad signature');
  const flavor = r.u32();
  const length = r.u32();
  if (length !== woff.length) throw new Error('WOFF: length field does not match the file size');
  const numTables = r.u16();
  r.pos = 44;
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const tag = r.tag();
    const offset = r.u32();
    const compLength = r.u32();
    const origLength = r.u32();
    const checksum = r.u32();
    if (offset + compLength > woff.length) throw new RangeError(`WOFF: table "${tag}" is out of range`);
    const raw = woff.subarray(offset, offset + compLength);
    const data = compLength < origLength ? codecs.inflate(raw, origLength) : raw;
    if (data.length !== origLength) throw new Error(`WOFF: table "${tag}" did not decompress to its original size`);
    void checksum;
    tables.push({ tag, data });
  }
  return assembleSfnt(new Map(tables.map((t) => [t.tag, t.data])), flavor);
}
