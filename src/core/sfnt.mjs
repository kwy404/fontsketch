// The sfnt container: table directory, alignment and checksums.

import { Reader, Writer, checksum } from './binary.mjs';

/** Recommended table order for TrueType and CFF fonts (faster loading). */
const ORDER = ['head', 'hhea', 'maxp', 'OS/2', 'hmtx', 'LTSH', 'VDMX', 'hdmx', 'cmap', 'fpgm', 'prep', 'cvt ', 'loca', 'glyf',
  'kern', 'name', 'post', 'gasp', 'PCLT', 'CFF ', 'CFF2', 'GDEF', 'GPOS', 'GSUB', 'STAT', 'fvar', 'avar', 'gvar', 'HVAR', 'MVAR'];

/**
 * Assembles tables into an sfnt binary with a sorted directory, 4 byte
 * alignment, per table checksums and the head checkSumAdjustment.
 * @param {Map<string, Uint8Array>} tables
 * @param {number} [flavor] 0x00010000 for TrueType, 0x4F54544F ("OTTO") for CFF
 * @returns {Uint8Array}
 */
export function assembleSfnt(tables, flavor = 0x00010000) {
  const tags = [...tables.keys()].sort();
  const numTables = tags.length;
  let searchRange = 1;
  let entrySelector = 0;
  while (searchRange * 2 <= numTables) {
    searchRange *= 2;
    entrySelector++;
  }
  searchRange *= 16;
  const headerSize = 12 + numTables * 16;
  const layout = [...tags].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1));
  /** @type {Map<string, number>} */
  const offsets = new Map();
  let offset = headerSize;
  for (const tag of layout) {
    offsets.set(tag, offset);
    offset += (/** @type {Uint8Array} */ (tables.get(tag)).length + 3) & ~3;
  }
  const w = new Writer(offset);
  w.u32(flavor).u16(numTables).u16(searchRange).u16(entrySelector).u16(numTables * 16 - searchRange);
  for (const tag of tags) {
    const data = /** @type {Uint8Array} */ (tables.get(tag));
    const sum = tag === 'head' ? checksum(withZeroAdjustment(data)) : checksum(data);
    w.tag(tag).u32(sum).u32(/** @type {number} */ (offsets.get(tag))).u32(data.length);
  }
  for (const tag of layout) {
    w.bytes(/** @type {Uint8Array} */ (tables.get(tag)));
    w.pad(4);
  }
  const out = w.toBytes();
  if (tables.has('head')) {
    const headAt = /** @type {number} */ (offsets.get('head'));
    out.set([0, 0, 0, 0], headAt + 8);
    const adjust = (0xb1b0afba - checksum(out)) >>> 0;
    new DataView(out.buffer).setUint32(headAt + 8, adjust);
  }
  return out;
}

function rank(tag) {
  const i = ORDER.indexOf(tag);
  return i < 0 ? ORDER.length : i;
}

/** @param {Uint8Array} head */
function withZeroAdjustment(head) {
  const copy = head.slice();
  if (copy.length >= 12) copy.set([0, 0, 0, 0], 8);
  return copy;
}

/**
 * Reads an sfnt table directory. Throws on truncated tables.
 * @param {Uint8Array} bytes
 * @returns {{ flavor: number, tables: Map<string, Uint8Array>, checksums: Map<string, number> }}
 */
export function readSfnt(bytes) {
  const r = new Reader(bytes, 0, 'sfnt');
  const flavor = r.u32();
  const numTables = r.u16();
  r.pos += 6;
  /** @type {Map<string, Uint8Array>} */
  const tables = new Map();
  /** @type {Map<string, number>} */
  const checksums = new Map();
  for (let i = 0; i < numTables; i++) {
    const tag = r.tag();
    const sum = r.u32();
    const offset = r.u32();
    const length = r.u32();
    if (offset + length > bytes.length) throw new RangeError(`sfnt: table "${tag}" extends past the end of the file`);
    tables.set(tag, bytes.subarray(offset, offset + length));
    checksums.set(tag, sum);
  }
  return { flavor, tables, checksums };
}

/**
 * Verifies table checksums and the whole font checksum. Returns a list of
 * problems (empty when everything matches).
 * @param {Uint8Array} bytes
 */
export function verifyChecksums(bytes) {
  const { tables, checksums } = readSfnt(bytes);
  const problems = [];
  for (const [tag, data] of tables) {
    const expected = tag === 'head' ? checksum(withZeroAdjustment(data)) : checksum(data);
    if (expected !== checksums.get(tag)) problems.push(`checksum mismatch in "${tag}"`);
  }
  if (tables.has('head') && checksum(bytes) !== 0xb1b0afba) problems.push('font checksum (checkSumAdjustment) mismatch');
  return problems;
}
