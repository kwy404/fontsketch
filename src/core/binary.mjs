// Big endian binary reader and writer used by every font table.

/** Growable big endian byte writer. */
export class Writer {
  constructor(size = 256) {
    this.buf = new Uint8Array(size);
    this.view = new DataView(this.buf.buffer);
    this.length = 0;
  }

  /** @param {number} n */
  ensure(n) {
    if (this.length + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.length + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
    this.view = new DataView(next.buffer);
  }

  /** @param {number} v */
  u8(v) {
    this.ensure(1);
    this.buf[this.length++] = v & 0xff;
    return this;
  }

  /** @param {number} v */
  i8(v) {
    return this.u8(v < 0 ? v + 256 : v);
  }

  /** @param {number} v */
  u16(v) {
    this.ensure(2);
    this.view.setUint16(this.length, v & 0xffff);
    this.length += 2;
    return this;
  }

  /** @param {number} v */
  i16(v) {
    this.ensure(2);
    this.view.setInt16(this.length, clampI16(v));
    this.length += 2;
    return this;
  }

  /** @param {number} v */
  u24(v) {
    return this.u8(v >>> 16).u8(v >>> 8).u8(v);
  }

  /** @param {number} v */
  u32(v) {
    this.ensure(4);
    this.view.setUint32(this.length, v >>> 0);
    this.length += 4;
    return this;
  }

  /** @param {number} v */
  i32(v) {
    this.ensure(4);
    this.view.setInt32(this.length, v | 0);
    this.length += 4;
    return this;
  }

  /** 16.16 fixed. @param {number} v */
  fixed(v) {
    return this.i32(Math.round(v * 65536));
  }

  /** 2.14 fixed. @param {number} v */
  f2dot14(v) {
    return this.i16(Math.round(Math.max(-2, Math.min(1.99993896484375, v)) * 16384));
  }

  /** Seconds since 1904-01-01 as a 64 bit integer. @param {Date} date */
  longDateTime(date) {
    const secs = Math.floor(date.getTime() / 1000) + 2082844800;
    return this.u32(Math.floor(secs / 0x100000000)).u32(secs % 0x100000000);
  }

  /** @param {string} s four character tag */
  tag(s) {
    for (let i = 0; i < 4; i++) this.u8(i < s.length ? s.charCodeAt(i) : 0x20);
    return this;
  }

  /** @param {ArrayLike<number>} bytes */
  bytes(bytes) {
    this.ensure(bytes.length);
    this.buf.set(bytes, this.length);
    this.length += bytes.length;
    return this;
  }

  /** Pads with zeros to a multiple of `n` bytes. @param {number} n */
  pad(n = 4) {
    while (this.length % n) this.u8(0);
    return this;
  }

  /** Writes a u16 at a previous position. @param {number} at @param {number} v */
  setU16(at, v) {
    this.view.setUint16(at, v & 0xffff);
  }

  /** @param {number} at @param {number} v */
  setU32(at, v) {
    this.view.setUint32(at, v >>> 0);
  }

  /** @returns {Uint8Array} a copy of the written bytes */
  toBytes() {
    return this.buf.slice(0, this.length);
  }
}

/** @param {number} v */
export function clampI16(v) {
  return Math.max(-32768, Math.min(32767, Math.round(v)));
}

/** Big endian reader with bounds checks and clear errors. */
export class Reader {
  /**
   * @param {Uint8Array} bytes
   * @param {number} [offset]
   * @param {string} [what] context used in error messages
   */
  constructor(bytes, offset = 0, what = 'font') {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = offset;
    this.what = what;
  }

  /** @param {number} n */
  check(n) {
    if (this.pos < 0 || this.pos + n > this.bytes.length) {
      throw new RangeError(`${this.what}: unexpected end of data at offset ${this.pos}`);
    }
  }

  u8() {
    this.check(1);
    return this.bytes[this.pos++];
  }

  i8() {
    const v = this.u8();
    return v > 127 ? v - 256 : v;
  }

  u16() {
    this.check(2);
    const v = this.view.getUint16(this.pos);
    this.pos += 2;
    return v;
  }

  i16() {
    this.check(2);
    const v = this.view.getInt16(this.pos);
    this.pos += 2;
    return v;
  }

  u24() {
    return (this.u8() << 16) | (this.u8() << 8) | this.u8();
  }

  u32() {
    this.check(4);
    const v = this.view.getUint32(this.pos);
    this.pos += 4;
    return v;
  }

  i32() {
    this.check(4);
    const v = this.view.getInt32(this.pos);
    this.pos += 4;
    return v;
  }

  fixed() {
    return this.i32() / 65536;
  }

  f2dot14() {
    return this.i16() / 16384;
  }

  longDateTime() {
    const hi = this.u32();
    const lo = this.u32();
    return new Date((hi * 0x100000000 + lo - 2082844800) * 1000);
  }

  tag() {
    let s = '';
    for (let i = 0; i < 4; i++) s += String.fromCharCode(this.u8());
    return s;
  }

  /** @param {number} n */
  take(n) {
    this.check(n);
    const out = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  /** UIntBase128 as used by WOFF2. */
  base128() {
    let v = 0;
    for (let i = 0; i < 5; i++) {
      const b = this.u8();
      if (i === 0 && b === 0x80) throw new RangeError(`${this.what}: UIntBase128 with a leading zero`);
      if (v & 0xfe000000) throw new RangeError(`${this.what}: UIntBase128 overflow`);
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) return v >>> 0;
    }
    throw new RangeError(`${this.what}: UIntBase128 longer than 5 bytes`);
  }

  /** 255UInt16 as used by WOFF2. */
  u255() {
    const code = this.u8();
    if (code === 253) return this.u16();
    if (code === 255) return this.u8() + 253;
    if (code === 254) return this.u8() + 506;
    return code;
  }
}

/**
 * OpenType table checksum (sum of big endian u32 words, zero padded).
 * @param {Uint8Array} bytes
 */
export function checksum(bytes) {
  let sum = 0;
  const n = bytes.length;
  const full = n - (n % 4);
  for (let i = 0; i < full; i += 4) {
    sum = (sum + ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3])) >>> 0;
  }
  if (full < n) {
    let last = 0;
    for (let i = 0; i < 4; i++) last = (last << 8) | (full + i < n ? bytes[full + i] : 0);
    sum = (sum + (last >>> 0)) >>> 0;
  }
  return sum >>> 0;
}

/** Writes a UIntBase128. @param {Writer} w @param {number} v */
export function writeBase128(w, v) {
  const parts = [];
  let x = v >>> 0;
  do {
    parts.unshift(x & 0x7f);
    x >>>= 7;
  } while (x);
  parts.forEach((p, i) => w.u8(i < parts.length - 1 ? p | 0x80 : p));
}

/** Writes a 255UInt16. @param {Writer} w @param {number} v */
export function write255(w, v) {
  if (v < 253) w.u8(v);
  else if (v < 506) w.u8(255).u8(v - 253);
  else if (v < 762) w.u8(254).u8(v - 506);
  else w.u8(253).u16(v);
}

/** @param {Uint8Array | ArrayBuffer | ArrayBufferView} input */
export function toUint8(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError('expected a Uint8Array or ArrayBuffer');
}

/** @param {string} s */
export function utf16beBytes(s) {
  const out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[i * 2] = c >> 8;
    out[i * 2 + 1] = c & 255;
  }
  return out;
}

/** @param {Uint8Array} b */
export function utf16beString(b) {
  let s = '';
  for (let i = 0; i + 1 < b.length; i += 2) s += String.fromCharCode((b[i] << 8) | b[i + 1]);
  return s;
}

/** Mac Roman (ASCII subset, others become "?"). @param {string} s */
export function macRomanBytes(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[i] = c < 128 ? c : 63;
  }
  return out;
}

/** @param {Uint8Array} b */
export function latin1String(b) {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}
