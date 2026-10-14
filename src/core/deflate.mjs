// A small, synchronous zlib (RFC 1950) and DEFLATE (RFC 1951) codec used for
// WOFF in browsers. Compression uses LZ77 with hash chains, lazy matching
// and dynamic Huffman blocks. In Node, the faster built-in zlib is used
// instead (see codecs.mjs).

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** Length (3..258) to length code index 0..28. */
const LEN_CODE = new Uint8Array(259);
for (let i = 0; i < 29; i++) {
  for (let l = LEN_BASE[i]; l < (i < 28 ? LEN_BASE[i + 1] : 259); l++) LEN_CODE[l] = i;
}
LEN_CODE[258] = 28;

/** @param {number} d distance 1..32768 */
function distCode(d) {
  let lo = 0;
  let hi = 29;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (DIST_BASE[mid] <= d) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/* ------------------------------------------------------------------ */
/* Checksums                                                           */
/* ------------------------------------------------------------------ */

/** @param {Uint8Array} data */
export function adler32(data) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length;) {
    const end = Math.min(i + 3800, data.length);
    for (; i < end; i++) {
      a += data[i];
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/* ------------------------------------------------------------------ */
/* Inflate                                                             */
/* ------------------------------------------------------------------ */

/** Builds a decoding table from code lengths: Map-free canonical decoding. */
function buildDecoder(lengths) {
  const counts = new Uint16Array(16);
  for (const l of lengths) counts[l]++;
  counts[0] = 0;
  const offs = new Uint16Array(16);
  for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
  const symbols = new Uint16Array(lengths.length);
  for (let s = 0; s < lengths.length; s++) if (lengths[s]) symbols[offs[lengths[s]]++] = s;
  return { counts, symbols };
}

/**
 * Decompresses raw DEFLATE data.
 * @param {Uint8Array} input
 * @param {number} [sizeHint]
 * @returns {Uint8Array}
 */
export function inflateRaw(input, sizeHint = 0) {
  let out = new Uint8Array(Math.max(1024, sizeHint || input.length * 4));
  let op = 0;
  let pos = 0;
  let bitBuf = 0;
  let bitCnt = 0;
  const need = (n) => {
    while (bitCnt < n) {
      if (pos >= input.length) throw new RangeError('inflate: unexpected end of data');
      bitBuf |= input[pos++] << bitCnt;
      bitCnt += 8;
    }
  };
  const bits = (n) => {
    if (!n) return 0;
    need(n);
    const v = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitCnt -= n;
    return v;
  };
  const ensure = (n) => {
    if (op + n <= out.length) return;
    let cap = out.length * 2;
    while (cap < op + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(out.subarray(0, op));
    out = next;
  };
  const decode = (dec) => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const count = dec.counts[len];
      if (code - first < count) return dec.symbols[index + code - first];
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    throw new Error('inflate: invalid Huffman code');
  };
  let fixedLit = null;
  let fixedDist = null;
  let final = 0;
  while (!final) {
    final = bits(1);
    const type = bits(2);
    if (type === 0) {
      bitBuf = 0;
      bitCnt = 0;
      if (pos + 4 > input.length) throw new RangeError('inflate: truncated stored block');
      const len = input[pos] | (input[pos + 1] << 8);
      const nlen = input[pos + 2] | (input[pos + 3] << 8);
      if ((len ^ 0xffff) !== nlen) throw new Error('inflate: corrupt stored block length');
      pos += 4;
      if (pos + len > input.length) throw new RangeError('inflate: truncated stored block');
      ensure(len);
      out.set(input.subarray(pos, pos + len), op);
      op += len;
      pos += len;
      continue;
    }
    let lit;
    let dist;
    if (type === 1) {
      if (!fixedLit) {
        const l = new Uint8Array(288);
        l.fill(8, 0, 144);
        l.fill(9, 144, 256);
        l.fill(7, 256, 280);
        l.fill(8, 280, 288);
        fixedLit = buildDecoder(l);
        fixedDist = buildDecoder(new Uint8Array(30).fill(5));
      }
      lit = fixedLit;
      dist = /** @type {any} */ (fixedDist);
    } else if (type === 2) {
      const hlit = bits(5) + 257;
      const hdist = bits(5) + 1;
      const hclen = bits(4) + 4;
      const cl = new Uint8Array(19);
      for (let i = 0; i < hclen; i++) cl[CL_ORDER[i]] = bits(3);
      const clDec = buildDecoder(cl);
      const lengths = new Uint8Array(hlit + hdist);
      for (let i = 0; i < hlit + hdist;) {
        const sym = decode(clDec);
        if (sym < 16) lengths[i++] = sym;
        else {
          let rep = 0;
          let val = 0;
          if (sym === 16) {
            if (!i) throw new Error('inflate: repeat with no previous length');
            val = lengths[i - 1];
            rep = 3 + bits(2);
          } else if (sym === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          if (i + rep > lengths.length) throw new Error('inflate: too many code lengths');
          lengths.fill(val, i, i + rep);
          i += rep;
        }
      }
      lit = buildDecoder(lengths.subarray(0, hlit));
      dist = buildDecoder(lengths.subarray(hlit));
    } else throw new Error('inflate: invalid block type');
    for (;;) {
      const sym = decode(lit);
      if (sym < 256) {
        ensure(1);
        out[op++] = sym;
      } else if (sym === 256) break;
      else {
        const li = sym - 257;
        if (li > 28) throw new Error('inflate: invalid length code');
        const len = LEN_BASE[li] + bits(LEN_EXTRA[li]);
        const di = decode(dist);
        if (di > 29) throw new Error('inflate: invalid distance code');
        const d = DIST_BASE[di] + bits(DIST_EXTRA[di]);
        if (d > op) throw new Error('inflate: distance too far back');
        ensure(len);
        for (let k = 0; k < len; k++, op++) out[op] = out[op - d];
      }
    }
  }
  return out.slice(0, op);
}

/**
 * Decompresses zlib data (checks the header and the Adler-32 checksum).
 * @param {Uint8Array} input
 * @param {number} [sizeHint]
 */
export function inflate(input, sizeHint) {
  if (input.length < 6) throw new RangeError('zlib: data too short');
  const cmf = input[0];
  const flg = input[1];
  if ((cmf & 15) !== 8 || ((cmf << 8) | flg) % 31 !== 0) throw new Error('zlib: bad header');
  if (flg & 0x20) throw new Error('zlib: preset dictionaries are not supported');
  const out = inflateRaw(input.subarray(2, input.length - 4), sizeHint);
  const n = input.length;
  const expected = ((input[n - 4] << 24) | (input[n - 3] << 16) | (input[n - 2] << 8) | input[n - 1]) >>> 0;
  if (adler32(out) !== expected) throw new Error('zlib: checksum mismatch');
  return out;
}

/* ------------------------------------------------------------------ */
/* Deflate                                                             */
/* ------------------------------------------------------------------ */

class BitWriter {
  constructor(size) {
    this.buf = new Uint8Array(Math.max(64, size));
    this.pos = 0;
    this.acc = 0;
    this.cnt = 0;
  }

  /** @param {number} v @param {number} n */
  put(v, n) {
    this.acc |= v << this.cnt;
    this.cnt += n;
    while (this.cnt >= 8) {
      this.byte(this.acc & 255);
      this.acc >>>= 8;
      this.cnt -= 8;
    }
  }

  byte(b) {
    if (this.pos >= this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.pos++] = b;
  }

  flush() {
    if (this.cnt > 0) this.byte(this.acc & 255);
    this.acc = 0;
    this.cnt = 0;
  }
}

/**
 * Huffman code lengths limited to `maxBits` (zlib's overflow fix up).
 * @param {Uint32Array | number[]} freqs
 * @param {number} maxBits
 */
function codeLengths(freqs, maxBits) {
  const n = freqs.length;
  const lengths = new Uint8Array(n);
  const used = [];
  for (let i = 0; i < n; i++) if (freqs[i]) used.push(i);
  if (used.length === 0) return lengths;
  if (used.length === 1) {
    lengths[used[0]] = 1;
    return lengths;
  }
  // Standard Huffman with two sorted queues.
  const leaves = used.map((s) => ({ f: freqs[s], s, l: null, r: null })).sort((a, b) => a.f - b.f || a.s - b.s);
  const merged = [];
  let li = 0;
  let mi = 0;
  const take = () => (mi >= merged.length || (li < leaves.length && leaves[li].f <= merged[mi].f) ? leaves[li++] : merged[mi++]);
  while (leaves.length - li + merged.length - mi > 1) {
    const a = take();
    const b = take();
    merged.push({ f: a.f + b.f, s: -1, l: a, r: b });
  }
  const root = merged[merged.length - 1];
  const depth = new Map();
  const stack = [[root, 0]];
  while (stack.length) {
    const [node, d] = /** @type {[any, number]} */ (stack.pop());
    if (node.s >= 0) depth.set(node.s, d);
    else stack.push([node.l, d + 1], [node.r, d + 1]);
  }
  const blCount = new Array(Math.max(maxBits, 64) + 1).fill(0);
  let overflow = 0;
  for (const s of used) {
    let d = /** @type {number} */ (depth.get(s));
    if (d > maxBits) {
      d = maxBits;
      overflow++;
    }
    blCount[d]++;
  }
  while (overflow > 0) {
    let bits = maxBits - 1;
    while (blCount[bits] === 0) bits--;
    blCount[bits]--;
    blCount[bits + 1] += 2;
    blCount[maxBits]--;
    overflow -= 2;
  }
  // Assign lengths: the least frequent symbols get the longest codes.
  const bySymbol = used.slice().sort((a, b) => freqs[a] - freqs[b] || b - a);
  let k = 0;
  for (let bits = maxBits; bits >= 1; bits--) {
    for (let c = 0; c < blCount[bits]; c++) lengths[bySymbol[k++]] = bits;
  }
  return lengths;
}

/** Canonical codes, bit reversed for LSB first output. @param {Uint8Array} lengths */
function canonicalCodes(lengths) {
  const blCount = new Uint16Array(16);
  for (const l of lengths) if (l) blCount[l]++;
  const next = new Uint16Array(16);
  let code = 0;
  for (let bits = 1; bits < 16; bits++) {
    code = (code + blCount[bits - 1]) << 1;
    next[bits] = code;
  }
  const codes = new Uint16Array(lengths.length);
  for (let s = 0; s < lengths.length; s++) {
    const l = lengths[s];
    if (!l) continue;
    let c = next[l]++;
    let r = 0;
    for (let i = 0; i < l; i++) {
      r = (r << 1) | (c & 1);
      c >>= 1;
    }
    codes[s] = r;
  }
  return codes;
}

/**
 * LZ77 tokens: literals are values 0..255, matches are stored as
 * 256 + length (in `lens`) with their distance in `dists`.
 * @param {Uint8Array} data
 */
function lz77(data) {
  const n = data.length;
  const HASH = 1 << 15;
  const head = new Int32Array(HASH).fill(-1);
  const prev = new Int32Array(Math.max(1, n));
  const lens = new Uint16Array(n);
  const dists = new Uint16Array(n);
  let count = 0;
  const hash = (i) => ((data[i] << 10) ^ (data[i + 1] << 5) ^ data[i + 2]) & (HASH - 1);
  const insert = (i) => {
    if (i + 2 >= n) return;
    const h = hash(i);
    prev[i] = head[h];
    head[h] = i;
  };
  const longest = (i) => {
    if (i + 2 >= n) return [0, 0];
    let best = 0;
    let bestD = 0;
    let cand = head[hash(i)];
    let chain = 128;
    const max = Math.min(258, n - i);
    while (cand >= 0 && i - cand <= 32768 && chain-- > 0) {
      if (data[cand + best] === data[i + best]) {
        let l = 0;
        while (l < max && data[cand + l] === data[i + l]) l++;
        if (l > best) {
          best = l;
          bestD = i - cand;
          if (l === max) break;
        }
      }
      cand = prev[cand];
    }
    return best >= 3 ? [best, bestD] : [0, 0];
  };
  let i = 0;
  while (i < n) {
    const [l, d] = longest(i);
    if (l) {
      // Lazy evaluation: prefer a longer match starting at the next byte.
      insert(i);
      const [l2] = l < 32 ? longest(i + 1) : [0];
      if (l2 > l) {
        lens[count] = data[i];
        dists[count++] = 0;
        i++;
        continue;
      }
      lens[count] = 256 + l;
      dists[count++] = d;
      for (let k = 1; k < l; k++) insert(i + k);
      i += l;
    } else {
      insert(i);
      lens[count] = data[i];
      dists[count++] = 0;
      i++;
    }
  }
  return { lens: lens.subarray(0, count), dists: dists.subarray(0, count) };
}

/**
 * Compresses with raw DEFLATE.
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
export function deflateRaw(data) {
  const out = new BitWriter(data.length / 2 + 64);
  if (!data.length) {
    out.put(1, 1);
    out.put(1, 2);
    out.put(0, 7);
    out.flush();
    return out.buf.slice(0, out.pos);
  }
  const { lens, dists } = lz77(data);
  const BLOCK = 1 << 15;
  for (let start = 0; start < lens.length; start += BLOCK) {
    const end = Math.min(lens.length, start + BLOCK);
    writeDynamicBlock(out, lens.subarray(start, end), dists.subarray(start, end), end === lens.length);
  }
  out.flush();
  return out.buf.slice(0, out.pos);
}

function writeDynamicBlock(out, lens, dists, final) {
  const litFreq = new Uint32Array(286);
  const distFreq = new Uint32Array(30);
  for (let i = 0; i < lens.length; i++) {
    const v = lens[i];
    if (v < 256) litFreq[v]++;
    else {
      litFreq[257 + LEN_CODE[v - 256]]++;
      distFreq[distCode(dists[i])]++;
    }
  }
  litFreq[256] = 1;
  if (!distFreq.some((f) => f)) distFreq[0] = 1;
  const litLen = codeLengths(litFreq, 15);
  const distLen = codeLengths(distFreq, 15);
  const litCodes = canonicalCodes(litLen);
  const distCodes = canonicalCodes(distLen);
  let hlit = 286;
  while (hlit > 257 && !litLen[hlit - 1]) hlit--;
  let hdist = 30;
  while (hdist > 1 && !distLen[hdist - 1]) hdist--;
  // Run length encode the code lengths.
  const all = [...litLen.subarray(0, hlit), ...distLen.subarray(0, hdist)];
  const rle = [];
  for (let i = 0; i < all.length;) {
    const v = all[i];
    let run = 1;
    while (i + run < all.length && all[i + run] === v) run++;
    if (v === 0 && run >= 3) {
      const r = Math.min(run, 138);
      rle.push(r >= 11 ? [18, r - 11, 7] : [17, r - 3, 3]);
      i += r;
    } else if (v !== 0 && run >= 4) {
      rle.push([v, 0, 0]);
      const r = Math.min(run - 1, 6);
      rle.push([16, r - 3, 2]);
      i += r + 1;
    } else {
      rle.push([v, 0, 0]);
      i++;
    }
  }
  const clFreq = new Uint32Array(19);
  for (const [s] of rle) clFreq[s]++;
  const clLen = codeLengths(clFreq, 7);
  const clCodes = canonicalCodes(clLen);
  let hclen = 19;
  while (hclen > 4 && !clLen[CL_ORDER[hclen - 1]]) hclen--;
  out.put(final ? 1 : 0, 1);
  out.put(2, 2);
  out.put(hlit - 257, 5);
  out.put(hdist - 1, 5);
  out.put(hclen - 4, 4);
  for (let i = 0; i < hclen; i++) out.put(clLen[CL_ORDER[i]], 3);
  for (const [s, extra, bits] of rle) {
    out.put(clCodes[s], clLen[s]);
    if (bits) out.put(extra, bits);
  }
  for (let i = 0; i < lens.length; i++) {
    const v = lens[i];
    if (v < 256) out.put(litCodes[v], litLen[v]);
    else {
      const len = v - 256;
      const lc = LEN_CODE[len];
      out.put(litCodes[257 + lc], litLen[257 + lc]);
      if (LEN_EXTRA[lc]) out.put(len - LEN_BASE[lc], LEN_EXTRA[lc]);
      const d = dists[i];
      const dc = distCode(d);
      out.put(distCodes[dc], distLen[dc]);
      if (DIST_EXTRA[dc]) out.put(d - DIST_BASE[dc], DIST_EXTRA[dc]);
    }
  }
  out.put(litCodes[256], litLen[256]);
}

/**
 * Compresses with the zlib wrapper (header and Adler-32).
 * @param {Uint8Array} data
 */
export function deflate(data) {
  const body = deflateRaw(data);
  const out = new Uint8Array(body.length + 6);
  out[0] = 0x78;
  out[1] = 0xda;
  out.set(body, 2);
  const a = adler32(data);
  out[out.length - 4] = a >>> 24;
  out[out.length - 3] = (a >>> 16) & 255;
  out[out.length - 2] = (a >>> 8) & 255;
  out[out.length - 1] = a & 255;
  return out;
}
