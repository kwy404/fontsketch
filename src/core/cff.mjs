// CFF (Compact Font Format, version 1) writer and reader with Type 2
// charstrings. Used for OpenType fonts with PostScript outlines (.otf).

import { Reader, Writer, latin1String } from './binary.mjs';

/** The 391 standard strings of CFF (Adobe Technical Note 5176, appendix A). */
export const CFF_STANDARD_STRINGS = (
  '.notdef space exclam quotedbl numbersign dollar percent ampersand quoteright parenleft parenright asterisk ' +
  'plus comma hyphen period slash zero one two three four five six seven eight nine colon semicolon less equal ' +
  'greater question at A B C D E F G H I J K L M N O P Q R S T U V W X Y Z bracketleft backslash bracketright ' +
  'asciicircum underscore quoteleft a b c d e f g h i j k l m n o p q r s t u v w x y z braceleft bar braceright ' +
  'asciitilde exclamdown cent sterling fraction yen florin section currency quotesingle quotedblleft ' +
  'guillemotleft guilsinglleft guilsinglright fi fl endash dagger daggerdbl periodcentered paragraph bullet ' +
  'quotesinglbase quotedblbase quotedblright guillemotright ellipsis perthousand questiondown grave acute ' +
  'circumflex tilde macron breve dotaccent dieresis ring cedilla hungarumlaut ogonek caron emdash AE ' +
  'ordfeminine Lslash Oslash OE ordmasculine ae dotlessi lslash oslash oe germandbls onesuperior logicalnot mu ' +
  'trademark Eth onehalf plusminus Thorn onequarter divide brokenbar degree thorn threequarters twosuperior ' +
  'registered minus eth multiply threesuperior copyright Aacute Acircumflex Adieresis Agrave Aring Atilde ' +
  'Ccedilla Eacute Ecircumflex Edieresis Egrave Iacute Icircumflex Idieresis Igrave Ntilde Oacute Ocircumflex ' +
  'Odieresis Ograve Otilde Scaron Uacute Ucircumflex Udieresis Ugrave Yacute Ydieresis Zcaron aacute ' +
  'acircumflex adieresis agrave aring atilde ccedilla eacute ecircumflex edieresis egrave iacute icircumflex ' +
  'idieresis igrave ntilde oacute ocircumflex odieresis ograve otilde scaron uacute ucircumflex udieresis ' +
  'ugrave yacute ydieresis zcaron exclamsmall Hungarumlautsmall dollaroldstyle dollarsuperior ampersandsmall ' +
  'Acutesmall parenleftsuperior parenrightsuperior twodotenleader onedotenleader zerooldstyle oneoldstyle ' +
  'twooldstyle threeoldstyle fouroldstyle fiveoldstyle sixoldstyle sevenoldstyle eightoldstyle nineoldstyle ' +
  'commasuperior threequartersemdash periodsuperior questionsmall asuperior bsuperior centsuperior dsuperior ' +
  'esuperior isuperior lsuperior msuperior nsuperior osuperior rsuperior ssuperior tsuperior ff ffi ffl ' +
  'parenleftinferior parenrightinferior Circumflexsmall hyphensuperior Gravesmall Asmall Bsmall Csmall Dsmall ' +
  'Esmall Fsmall Gsmall Hsmall Ismall Jsmall Ksmall Lsmall Msmall Nsmall Osmall Psmall Qsmall Rsmall Ssmall ' +
  'Tsmall Usmall Vsmall Wsmall Xsmall Ysmall Zsmall colonmonetary onefitted rupiah Tildesmall exclamdownsmall ' +
  'centoldstyle Lslashsmall Scaronsmall Zcaronsmall Dieresissmall Brevesmall Caronsmall Dotaccentsmall ' +
  'Macronsmall figuredash hypheninferior Ogoneksmall Ringsmall Cedillasmall questiondownsmall oneeighth ' +
  'threeeighths fiveeighths seveneighths onethird twothirds zerosuperior foursuperior fivesuperior sixsuperior ' +
  'sevensuperior eightsuperior ninesuperior zeroinferior oneinferior twoinferior threeinferior fourinferior ' +
  'fiveinferior sixinferior seveninferior eightinferior nineinferior centinferior dollarinferior ' +
  'periodinferior commainferior Agravesmall Aacutesmall Acircumflexsmall Atildesmall Adieresissmall ' +
  'Aringsmall AEsmall Ccedillasmall Egravesmall Eacutesmall Ecircumflexsmall Edieresissmall Igravesmall ' +
  'Iacutesmall Icircumflexsmall Idieresissmall Ethsmall Ntildesmall Ogravesmall Oacutesmall ' +
  'Ocircumflexsmall Otildesmall Odieresissmall OEsmall Oslashsmall Ugravesmall Uacutesmall Ucircumflexsmall ' +
  'Udieresissmall Yacutesmall Thornsmall Ydieresissmall 001.000 001.001 001.002 001.003 Black Bold Book Light ' +
  'Medium Regular Roman Semibold'
).split(' ');

/* ------------------------------------------------------------------ */
/* INDEX and DICT encoding                                             */
/* ------------------------------------------------------------------ */

/** @param {Uint8Array[]} items */
function encodeIndex(items) {
  const w = new Writer();
  w.u16(items.length);
  if (!items.length) return w.toBytes();
  let total = 1;
  for (const it of items) total += it.length;
  const offSize = total < 0x100 ? 1 : total < 0x10000 ? 2 : total < 0x1000000 ? 3 : 4;
  w.u8(offSize);
  let off = 1;
  const put = (v) => {
    if (offSize === 1) w.u8(v);
    else if (offSize === 2) w.u16(v);
    else if (offSize === 3) w.u24(v);
    else w.u32(v);
  };
  put(off);
  for (const it of items) {
    off += it.length;
    put(off);
  }
  for (const it of items) w.bytes(it);
  return w.toBytes();
}

/** @param {Reader} r */
function readIndex(r) {
  const count = r.u16();
  if (count === 0) return [];
  const offSize = r.u8();
  if (offSize < 1 || offSize > 4) throw new Error('CFF: bad INDEX offset size');
  const offs = [];
  for (let i = 0; i <= count; i++) {
    let v = 0;
    for (let k = 0; k < offSize; k++) v = v * 256 + r.u8();
    offs.push(v);
  }
  const base = r.pos - 1;
  const items = [];
  for (let i = 0; i < count; i++) {
    const a = base + offs[i];
    const b = base + offs[i + 1];
    if (b < a || b > r.bytes.length) throw new RangeError('CFF: INDEX item out of range');
    items.push(r.bytes.subarray(a, b));
  }
  r.pos = base + offs[count];
  return items;
}

/** DICT integer; `fixed5` forces the 5 byte form so offsets can be patched. */
function dictInt(w, v, fixed5 = false) {
  if (!fixed5 && v >= -107 && v <= 107) w.u8(v + 139);
  else if (!fixed5 && v >= 108 && v <= 1131) {
    const x = v - 108;
    w.u8((x >> 8) + 247).u8(x & 255);
  } else if (!fixed5 && v >= -1131 && v <= -108) {
    const x = -v - 108;
    w.u8((x >> 8) + 251).u8(x & 255);
  } else if (!fixed5 && v >= -32768 && v <= 32767) w.u8(28).i16(v);
  else w.u8(29).i32(v);
}

/** DICT real number in packed BCD. */
function dictReal(w, v) {
  let s = Number(v.toPrecision(10)).toString().toLowerCase();
  if (s.includes('e')) s = s.replace('e-', 'm').replace('e+', 'e');
  const nibbles = [];
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') nibbles.push(Number(ch));
    else if (ch === '.') nibbles.push(0xa);
    else if (ch === 'e') nibbles.push(0xb);
    else if (ch === 'm') nibbles.push(0xc);
    else if (ch === '-') nibbles.push(0xe);
  }
  nibbles.push(0xf);
  if (nibbles.length % 2) nibbles.push(0xf);
  w.u8(30);
  for (let i = 0; i < nibbles.length; i += 2) w.u8((nibbles[i] << 4) | nibbles[i + 1]);
}

/**
 * @param {Array<[number | [number, number], Array<number | { real: number } | { fixed5: number }>]>} entries
 */
function encodeDict(entries) {
  const w = new Writer();
  for (const [op, args] of entries) {
    for (const a of args) {
      if (typeof a === 'number') {
        if (Number.isInteger(a)) dictInt(w, a);
        else dictReal(w, a);
      } else if ('real' in a) dictReal(w, a.real);
      else dictInt(w, a.fixed5, true);
    }
    if (Array.isArray(op)) w.u8(op[0]).u8(op[1]);
    else w.u8(op);
  }
  return w.toBytes();
}

/** @param {Uint8Array} b @returns {Map<number, number[]>} keys are op or 1200 + escaped op */
function decodeDict(b) {
  const r = new Reader(b, 0, 'CFF DICT');
  /** @type {Map<number, number[]>} */
  const out = new Map();
  let operands = [];
  while (r.pos < b.length) {
    const b0 = r.u8();
    if (b0 <= 21) {
      const op = b0 === 12 ? 1200 + r.u8() : b0;
      out.set(op, operands);
      operands = [];
    } else if (b0 === 28) operands.push(r.i16());
    else if (b0 === 29) operands.push(r.i32());
    else if (b0 === 30) {
      let s = '';
      for (;;) {
        const byte = r.u8();
        let done = false;
        for (const nib of [byte >> 4, byte & 15]) {
          if (nib <= 9) s += nib;
          else if (nib === 0xa) s += '.';
          else if (nib === 0xb) s += 'e';
          else if (nib === 0xc) s += 'e-';
          else if (nib === 0xe) s += '-';
          else if (nib === 0xf) {
            done = true;
            break;
          }
        }
        if (done) break;
      }
      operands.push(parseFloat(s));
    } else if (b0 >= 32 && b0 <= 246) operands.push(b0 - 139);
    else if (b0 >= 247 && b0 <= 250) operands.push((b0 - 247) * 256 + r.u8() + 108);
    else if (b0 >= 251 && b0 <= 254) operands.push(-(b0 - 251) * 256 - r.u8() - 108);
    else throw new Error(`CFF: bad DICT byte ${b0}`);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Charstring encoding                                                 */
/* ------------------------------------------------------------------ */

/** @param {Writer} w @param {number} v */
function csNumber(w, v) {
  if (!Number.isInteger(v)) {
    w.u8(255).i32(Math.round(v * 65536));
    return;
  }
  if (v >= -107 && v <= 107) w.u8(v + 139);
  else if (v >= 108 && v <= 1131) {
    const x = v - 108;
    w.u8((x >> 8) + 247).u8(x & 255);
  } else if (v >= -1131 && v <= -108) {
    const x = -v - 108;
    w.u8((x >> 8) + 251).u8(x & 255);
  } else w.u8(28).i16(v);
}

/**
 * @typedef {{
 *   name: string, width: number,
 *   contours: Array<Array<{ x: number, y: number, on: boolean }>>,
 *   hstems?: Array<[number, number]>, vstems?: Array<[number, number]>,
 * }} CffGlyph
 * Contours are quadratic TrueType style in PostScript direction (outer
 * counter clockwise). They are converted to cubic curves exactly.
 */

/**
 * Encodes one Type 2 charstring.
 * @param {CffGlyph} g
 * @param {number} defaultWidthX
 * @param {number} nominalWidthX
 */
export function encodeCharstring(g, defaultWidthX, nominalWidthX) {
  const w = new Writer();
  const args = [];
  let widthPending = g.width !== defaultWidthX;
  const flush = (op) => {
    if (widthPending) {
      args.unshift(g.width - nominalWidthX);
      widthPending = false;
    }
    for (const a of args) csNumber(w, a);
    args.length = 0;
    if (op >= 1200) w.u8(12).u8(op - 1200);
    else w.u8(op);
  };
  const stems = (list, op) => {
    const clean = cleanStems(list);
    if (!clean.length) return;
    let prev = 0;
    for (const [pos, width] of clean) {
      args.push(pos - prev, width);
      prev = pos + width;
    }
    flush(op);
  };
  stems(g.hstems || [], 1);
  stems(g.vstems || [], 3);
  let cx = 0;
  let cy = 0;
  for (const contour of g.contours) {
    const segs = cubicSegments(contour);
    if (!segs.length) continue;
    const [sx, sy] = segs[0].start;
    args.push(sx - cx, sy - cy);
    flush(21);
    cx = sx;
    cy = sy;
    let mode = 0;
    for (const s of segs) {
      const kind = s.c1 ? 8 : 5;
      const maxArgs = kind === 8 ? 48 : 48;
      if (mode && (mode !== kind || args.length + (kind === 8 ? 6 : 2) > maxArgs)) flush(mode);
      mode = kind;
      if (s.c1 && s.c2) {
        const [x1, y1] = s.c1;
        const [x2, y2] = s.c2;
        const [x3, y3] = s.end;
        args.push(x1 - cx, y1 - cy, x2 - x1, y2 - y1, x3 - x2, y3 - y2);
        cx = x3;
        cy = y3;
      } else {
        args.push(s.end[0] - cx, s.end[1] - cy);
        cx = s.end[0];
        cy = s.end[1];
      }
    }
    if (mode) flush(mode);
  }
  flush(14);
  return w.toBytes();
}

/** Sorts stems, drops invalid ones and keeps a non overlapping subset (max 23). */
export function cleanStems(list) {
  const sorted = list.filter(([, wd]) => wd > 0).map(([p, wd]) => [Math.round(p), Math.round(wd)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s[0] <= last[0] + last[1]) continue;
    out.push(s);
    if (out.length === 23) break;
  }
  return out;
}

/**
 * Converts a quadratic contour to cubic segments with integer coordinates.
 * @param {Array<{ x: number, y: number, on: boolean }>} pts
 */
function cubicSegments(pts) {
  const n = pts.length;
  if (!n) return [];
  let start = pts.findIndex((p) => p.on);
  /** @type {Array<{ x: number, y: number, on: boolean }>} */
  let ring;
  if (start < 0) {
    const a = pts[n - 1];
    const b = pts[0];
    ring = [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true }, ...pts];
  } else ring = [...pts.slice(start), ...pts.slice(0, start)];
  const rnd = (v) => Math.round(v);
  const segs = [];
  let cur = ring[0];
  let ctrl = null;
  const first = [rnd(cur.x), rnd(cur.y)];
  const emitQuad = (p0, q, p1) => {
    const c1 = [rnd(p0.x + (2 / 3) * (q.x - p0.x)), rnd(p0.y + (2 / 3) * (q.y - p0.y))];
    const c2 = [rnd(p1.x + (2 / 3) * (q.x - p1.x)), rnd(p1.y + (2 / 3) * (q.y - p1.y))];
    segs.push({ start: [rnd(p0.x), rnd(p0.y)], c1, c2, end: [rnd(p1.x), rnd(p1.y)] });
  };
  for (let k = 1; k <= ring.length; k++) {
    const p = ring[k % ring.length];
    if (p.on) {
      if (ctrl) emitQuad(cur, ctrl, p);
      else if (rnd(p.x) !== rnd(cur.x) || rnd(p.y) !== rnd(cur.y) || k === ring.length) {
        if (k < ring.length) segs.push({ start: [rnd(cur.x), rnd(cur.y)], end: [rnd(p.x), rnd(p.y)] });
      }
      cur = p;
      ctrl = null;
    } else if (ctrl) {
      const mid = { x: (ctrl.x + p.x) / 2, y: (ctrl.y + p.y) / 2, on: true };
      emitQuad(cur, ctrl, mid);
      cur = mid;
      ctrl = p;
    } else ctrl = p;
  }
  if (segs.length) segs[0].start = first;
  return segs;
}

/* ------------------------------------------------------------------ */
/* Font writer                                                          */
/* ------------------------------------------------------------------ */

/**
 * @param {{
 *   psName: string, fullName: string, familyName: string, weight: string, notice?: string, copyright?: string,
 *   unitsPerEm: number, bbox: [number, number, number, number], italicAngle: number,
 *   underlinePosition: number, underlineThickness: number, isFixedPitch: boolean,
 *   glyphs: CffGlyph[],
 *   blueValues?: number[], otherBlues?: number[], stdHW?: number, stdVW?: number,
 *   stemSnapH?: number[], stemSnapV?: number[], blueScale?: number,
 * }} font
 * @returns {Uint8Array}
 */
export function writeCFF(font) {
  const strings = [];
  const stringIndex = new Map();
  const std = new Map(CFF_STANDARD_STRINGS.map((s, i) => [s, i]));
  const sid = (s) => {
    const known = std.get(s);
    if (known !== undefined) return known;
    let i = stringIndex.get(s);
    if (i === undefined) {
      i = strings.length;
      strings.push(s);
      stringIndex.set(s, i);
    }
    return 391 + i;
  };
  // Widths: the most common width is the default, nominal is the median of the rest.
  const counts = new Map();
  for (const g of font.glyphs) counts.set(g.width, (counts.get(g.width) || 0) + 1);
  let defaultWidthX = 0;
  let best = -1;
  for (const [wd, c] of counts) if (c > best) {
    best = c;
    defaultWidthX = wd;
  }
  const others = font.glyphs.map((g) => g.width).filter((wd) => wd !== defaultWidthX).sort((a, b) => a - b);
  const nominalWidthX = others.length ? others[Math.floor(others.length / 2)] : defaultWidthX;

  const charstrings = font.glyphs.map((g) => encodeCharstring(g, defaultWidthX, nominalWidthX));
  const top = [
    [0, [sid('1.0')]],
    ...(font.notice ? [[1, [sid(font.notice)]]] : []),
    ...(font.copyright ? [[[12, 0], [sid(font.copyright)]]] : []),
    [2, [sid(font.fullName)]],
    [3, [sid(font.familyName)]],
    [4, [sid(font.weight)]],
    ...(font.isFixedPitch ? [[[12, 1], [1]]] : []),
    ...(font.italicAngle ? [[[12, 2], [font.italicAngle]]] : []),
    [[12, 3], [font.underlinePosition]],
    [[12, 4], [font.underlineThickness]],
    ...(font.unitsPerEm !== 1000 ? [[[12, 7], [{ real: 1 / font.unitsPerEm }, 0, 0, { real: 1 / font.unitsPerEm }, 0, 0]]] : []),
    [5, font.bbox],
  ];
  const priv = [];
  const deltas = (arr) => arr.map((v, i) => (i ? v - arr[i - 1] : v));
  if (font.blueValues && font.blueValues.length) priv.push([6, deltas(font.blueValues)]);
  if (font.otherBlues && font.otherBlues.length) priv.push([7, deltas(font.otherBlues)]);
  if (font.blueScale) priv.push([[12, 9], [{ real: font.blueScale }]]);
  if (font.stdHW) priv.push([10, [font.stdHW]]);
  if (font.stdVW) priv.push([11, [font.stdVW]]);
  if (font.stemSnapH && font.stemSnapH.length) priv.push([[12, 12], deltas(font.stemSnapH)]);
  if (font.stemSnapV && font.stemSnapV.length) priv.push([[12, 13], deltas(font.stemSnapV)]);
  priv.push([20, [defaultWidthX]], [21, [nominalWidthX]]);
  const privBytes = encodeDict(/** @type {any} */ (priv));

  // Charset format 0 (glyph SIDs, .notdef omitted); names are resolved before
  // the string INDEX is frozen.
  const charsetSids = font.glyphs.slice(1).map((g) => sid(g.name));
  const header = new Uint8Array([1, 0, 4, 4]);
  const nameIndex = encodeIndex([latin1Bytes(font.psName)]);
  const stringIdx = encodeIndex(strings.map(latin1Bytes));
  const gsubrs = encodeIndex([]);
  const charsetW = new Writer();
  charsetW.u8(0);
  for (const s of charsetSids) charsetW.u16(s);
  const charset = charsetW.toBytes();
  const csIndex = encodeIndex(charstrings);

  // Top DICT with fixed size offsets, then lay everything out.
  const buildTop = (charsetOff, csOff, privOff) => encodeDict(/** @type {any} */ ([
    ...top,
    [15, [{ fixed5: charsetOff }]],
    [17, [{ fixed5: csOff }]],
    [18, [{ fixed5: privBytes.length }, { fixed5: privOff }]],
  ]));
  const topLen = encodeIndex([buildTop(0, 0, 0)]).length;
  const base = header.length + nameIndex.length + topLen + stringIdx.length + gsubrs.length;
  const charsetOff = base;
  const csOff = charsetOff + charset.length;
  const privOff = csOff + csIndex.length;
  const topIndex = encodeIndex([buildTop(charsetOff, csOff, privOff)]);
  const w = new Writer(privOff + privBytes.length);
  w.bytes(header).bytes(nameIndex).bytes(topIndex).bytes(stringIdx).bytes(gsubrs);
  w.bytes(charset).bytes(csIndex).bytes(privBytes);
  return w.toBytes();
}

/** @param {string} s */
function latin1Bytes(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

/* ------------------------------------------------------------------ */
/* Reader                                                              */
/* ------------------------------------------------------------------ */

/**
 * @typedef {{
 *   psName: string, glyphNames: string[], unitsPerEm: number, fontMatrix: number[],
 *   glyphs: Array<{ width: number, contours: Array<Array<[number, number, number, number, number, number] | [number, number]>>,
 *     hstems: Array<[number, number]>, vstems: Array<[number, number]> }>,
 *   topDict: Record<string, any>, privateDict: Record<string, any>,
 * }} CffFont
 * Contours are lists of points: a 2 item entry is a move/line target, a 6
 * item entry is a cubic curve (c1, c2, end).
 */

/**
 * Parses a CFF table (CID keyed fonts are read through their FDArray).
 * @param {Uint8Array} b
 * @returns {CffFont}
 */
export function readCFF(b) {
  const r = new Reader(b, 0, 'CFF');
  const major = r.u8();
  if (major !== 1) throw new Error(`CFF: unsupported major version ${major}`);
  r.u8();
  const hdrSize = r.u8();
  r.pos = hdrSize;
  const names = readIndex(r).map(latin1String);
  const tops = readIndex(r);
  const strings = readIndex(r).map(latin1String);
  const gsubrs = readIndex(r);
  const str = (id) => (id < 391 ? CFF_STANDARD_STRINGS[id] : strings[id - 391] ?? '');
  const top = decodeDict(tops[0]);
  const csOff = top.get(17)?.[0];
  if (csOff === undefined) throw new Error('CFF: missing CharStrings');
  const charstrings = readIndex(new Reader(b, csOff, 'CFF CharStrings'));
  const nGlyphs = charstrings.length;
  const isCID = top.has(1230);
  // charset
  const glyphNames = ['.notdef'];
  const charsetOff = top.get(15)?.[0] ?? 0;
  if (charsetOff > 2) {
    const cr = new Reader(b, charsetOff, 'CFF charset');
    const fmt = cr.u8();
    if (fmt === 0) {
      while (glyphNames.length < nGlyphs) glyphNames.push(isCID ? `cid${cr.u16()}` : str(cr.u16()));
    } else {
      while (glyphNames.length < nGlyphs) {
        const first = cr.u16();
        const left = fmt === 1 ? cr.u8() : cr.u16();
        for (let i = 0; i <= left && glyphNames.length < nGlyphs; i++) glyphNames.push(isCID ? `cid${first + i}` : str(first + i));
      }
    }
  } else {
    for (let i = 1; i < nGlyphs; i++) glyphNames.push(str(i));
  }
  const fontMatrix = top.get(1207) || [0.001, 0, 0, 0.001, 0, 0];
  const readPrivate = (dict) => {
    const p = dict.get(18);
    if (!p) return { priv: new Map(), subrs: [] };
    const [size, off] = p;
    const priv = decodeDict(b.subarray(off, off + size));
    const subrOff = priv.get(19)?.[0];
    const subrs = subrOff ? readIndex(new Reader(b, off + subrOff, 'CFF Subrs')) : [];
    return { priv, subrs };
  };
  /** @type {Array<{ priv: Map<number, number[]>, subrs: Uint8Array[] }>} */
  let fds = [];
  let fdSelect = null;
  if (isCID) {
    const fdArray = readIndex(new Reader(b, top.get(1236)?.[0] ?? 0, 'CFF FDArray')).map((d) => readPrivate(decodeDict(d)));
    fds = fdArray;
    fdSelect = readFDSelect(b, top.get(1237)?.[0] ?? 0, nGlyphs);
  } else fds = [readPrivate(top)];
  const glyphs = charstrings.map((cs, gid) => {
    const fd = fds[fdSelect ? fdSelect[gid] : 0] || fds[0];
    const dflt = fd.priv.get(20)?.[0] ?? 0;
    const nominal = fd.priv.get(21)?.[0] ?? 0;
    return runCharstring(cs, gsubrs, fd.subrs, dflt, nominal);
  });
  const priv = fds[0]?.priv ?? new Map();
  const unpackDeltas = (arr) => {
    const out = [];
    let acc = 0;
    for (const v of arr || []) {
      acc += v;
      out.push(acc);
    }
    return out;
  };
  return {
    psName: names[0] || '',
    glyphNames,
    unitsPerEm: Math.round(1 / (fontMatrix[0] || 0.001)),
    fontMatrix,
    glyphs,
    topDict: {
      fullName: top.has(2) ? str(top.get(2)[0]) : '',
      familyName: top.has(3) ? str(top.get(3)[0]) : '',
      weight: top.has(4) ? str(top.get(4)[0]) : '',
      notice: top.has(1) ? str(top.get(1)[0]) : '',
      copyright: top.has(1200) ? str(top.get(1200)[0]) : '',
      bbox: top.get(5) || [0, 0, 0, 0],
      italicAngle: top.get(1202)?.[0] ?? 0,
      isCID,
    },
    privateDict: {
      blueValues: unpackDeltas(priv.get(6)),
      otherBlues: unpackDeltas(priv.get(7)),
      stdHW: priv.get(10)?.[0],
      stdVW: priv.get(11)?.[0],
      stemSnapH: unpackDeltas(priv.get(1212)),
      stemSnapV: unpackDeltas(priv.get(1213)),
      blueScale: priv.get(1209)?.[0],
      defaultWidthX: priv.get(20)?.[0] ?? 0,
      nominalWidthX: priv.get(21)?.[0] ?? 0,
    },
  };
}

function readFDSelect(b, off, nGlyphs) {
  const r = new Reader(b, off, 'CFF FDSelect');
  const fmt = r.u8();
  const out = new Uint8Array(nGlyphs);
  if (fmt === 0) {
    for (let i = 0; i < nGlyphs; i++) out[i] = r.u8();
  } else if (fmt === 3) {
    const n = r.u16();
    let first = r.u16();
    for (let i = 0; i < n; i++) {
      const fd = r.u8();
      const next = r.u16();
      for (let g = first; g < next && g < nGlyphs; g++) out[g] = fd;
      first = next;
    }
  }
  return out;
}

function subrBias(n) {
  return n < 1240 ? 107 : n < 33900 ? 1131 : 32768;
}

/**
 * Executes a Type 2 charstring and returns its width, contours and stems.
 * @param {Uint8Array} cs
 * @param {Uint8Array[]} gsubrs
 * @param {Uint8Array[]} subrs
 * @param {number} defaultWidthX
 * @param {number} nominalWidthX
 */
export function runCharstring(cs, gsubrs, subrs, defaultWidthX, nominalWidthX) {
  const stack = [];
  const contours = [];
  /** @type {any[] | null} */
  let current = null;
  let x = 0;
  let y = 0;
  let width = null;
  let nStems = 0;
  const hstems = [];
  const vstems = [];
  const transient = [];
  let ended = false;
  const moveTo = (dx, dy) => {
    x += dx;
    y += dy;
    current = [[x, y]];
    contours.push(current);
  };
  const lineTo = (dx, dy) => {
    x += dx;
    y += dy;
    if (!current) moveTo(0, 0);
    /** @type {any[]} */ (current).push([x, y]);
  };
  const curveTo = (a, b2, c, d, e, f) => {
    const x1 = x + a;
    const y1 = y + b2;
    const x2 = x1 + c;
    const y2 = y1 + d;
    x = x2 + e;
    y = y2 + f;
    if (!current) moveTo(0, 0);
    /** @type {any[]} */ (current).push([x1, y1, x2, y2, x, y]);
  };
  // The first stack clearing operator may carry the advance width as an
  // extra leading argument (odd argument count for stems and rmoveto).
  const takeWidth = () => {
    if (width === null) width = stack.length % 2 === 1 ? stack.shift() + nominalWidthX : defaultWidthX;
  };
  const addStems = (list) => {
    takeWidth();
    let pos = 0;
    for (let i = 0; i + 1 < stack.length; i += 2) {
      pos += stack[i];
      list.push([pos, stack[i + 1]]);
      pos += stack[i + 1];
    }
    nStems += stack.length >> 1;
    stack.length = 0;
  };
  let depth = 0;
  const exec = (code) => {
    if (++depth > 10) throw new Error('CFF: subroutine nesting too deep');
    const r = new Reader(code, 0, 'charstring');
    while (r.pos < code.length && !ended) {
      const b0 = r.u8();
      if (b0 >= 32 || b0 === 28) {
        if (b0 === 28) stack.push(r.i16());
        else if (b0 <= 246) stack.push(b0 - 139);
        else if (b0 <= 250) stack.push((b0 - 247) * 256 + r.u8() + 108);
        else if (b0 <= 254) stack.push(-(b0 - 251) * 256 - r.u8() - 108);
        else stack.push(r.i32() / 65536);
        continue;
      }
      switch (b0) {
        case 1:
        case 18:
          addStems(hstems);
          break;
        case 3:
        case 23:
          addStems(vstems);
          break;
        case 19:
        case 20:
          if (stack.length) addStems(vstems);
          takeWidth();
          r.pos += (nStems + 7) >> 3;
          break;
        case 21:
          takeWidth();
          moveTo(stack[stack.length - 2], stack[stack.length - 1]);
          stack.length = 0;
          break;
        case 22:
          if (width === null) width = stack.length > 1 ? stack.shift() + nominalWidthX : defaultWidthX;
          moveTo(stack[stack.length - 1], 0);
          stack.length = 0;
          break;
        case 4:
          if (width === null) width = stack.length > 1 ? stack.shift() + nominalWidthX : defaultWidthX;
          moveTo(0, stack[stack.length - 1]);
          stack.length = 0;
          break;
        case 5:
          for (let i = 0; i + 1 < stack.length; i += 2) lineTo(stack[i], stack[i + 1]);
          stack.length = 0;
          break;
        case 6:
        case 7: {
          let horizontal = b0 === 6;
          for (const v of stack) {
            if (horizontal) lineTo(v, 0);
            else lineTo(0, v);
            horizontal = !horizontal;
          }
          stack.length = 0;
          break;
        }
        case 8:
          for (let i = 0; i + 5 < stack.length; i += 6) curveTo(stack[i], stack[i + 1], stack[i + 2], stack[i + 3], stack[i + 4], stack[i + 5]);
          stack.length = 0;
          break;
        case 24: {
          let i = 0;
          for (; i + 7 < stack.length; i += 6) curveTo(stack[i], stack[i + 1], stack[i + 2], stack[i + 3], stack[i + 4], stack[i + 5]);
          lineTo(stack[i], stack[i + 1]);
          stack.length = 0;
          break;
        }
        case 25: {
          let i = 0;
          for (; i + 7 < stack.length; i += 2) lineTo(stack[i], stack[i + 1]);
          curveTo(stack[i], stack[i + 1], stack[i + 2], stack[i + 3], stack[i + 4], stack[i + 5]);
          stack.length = 0;
          break;
        }
        case 26: {
          let i = 0;
          let dx1 = 0;
          if (stack.length % 2) dx1 = stack[i++];
          for (; i + 3 < stack.length; i += 4) {
            curveTo(dx1, stack[i], stack[i + 1], stack[i + 2], 0, stack[i + 3]);
            dx1 = 0;
          }
          stack.length = 0;
          break;
        }
        case 27: {
          let i = 0;
          let dy1 = 0;
          if (stack.length % 2) dy1 = stack[i++];
          for (; i + 3 < stack.length; i += 4) {
            curveTo(stack[i], dy1, stack[i + 1], stack[i + 2], stack[i + 3], 0);
            dy1 = 0;
          }
          stack.length = 0;
          break;
        }
        case 30:
        case 31: {
          let horizontal = b0 === 31;
          let i = 0;
          while (i + 3 < stack.length) {
            const last = stack.length - i === 5;
            if (horizontal) curveTo(stack[i], 0, stack[i + 1], stack[i + 2], last ? stack[i + 4] : 0, stack[i + 3]);
            else curveTo(0, stack[i], stack[i + 1], stack[i + 2], stack[i + 3], last ? stack[i + 4] : 0);
            i += last ? 5 : 4;
            horizontal = !horizontal;
          }
          stack.length = 0;
          break;
        }
        case 10:
        case 29: {
          const list = b0 === 10 ? subrs : gsubrs;
          const idx = stack.pop() + subrBias(list.length);
          if (!list[idx]) throw new Error('CFF: missing subroutine');
          exec(list[idx]);
          break;
        }
        case 11:
          depth--;
          return;
        case 14:
          if (width === null) width = stack.length % 2 === 1 || stack.length === 5 ? stack.shift() + nominalWidthX : defaultWidthX;
          ended = true;
          break;
        case 12: {
          const op = r.u8();
          const s = stack;
          if (op === 35) {
            curveTo(s[0], s[1], s[2], s[3], s[4], s[5]);
            curveTo(s[6], s[7], s[8], s[9], s[10], s[11]);
          } else if (op === 34) {
            const y0 = y;
            curveTo(s[0], 0, s[1], s[2], s[3], 0);
            curveTo(s[4], 0, s[5], y0 - y, s[6], 0);
          } else if (op === 36) {
            curveTo(s[0], s[1], s[2], s[3], s[4], 0);
            curveTo(s[5], 0, s[6], s[7], s[8], -(s[1] + s[3] + s[7]));
          } else if (op === 37) {
            const dx = s[0] + s[2] + s[4] + s[6] + s[8];
            const dy = s[1] + s[3] + s[5] + s[7] + s[9];
            curveTo(s[0], s[1], s[2], s[3], s[4], s[5]);
            if (Math.abs(dx) > Math.abs(dy)) curveTo(s[6], s[7], s[8], s[9], s[10], -dy);
            else curveTo(s[6], s[7], s[8], s[9], -dx, s[10]);
          } else arithmetic(op, stack, transient);
          if (op >= 34 && op <= 37) stack.length = 0;
          break;
        }
        default:
          stack.length = 0;
      }
    }
    depth--;
  };
  exec(cs);
  return { width: width ?? defaultWidthX, contours, hstems, vstems };
}

function arithmetic(op, s, transient) {
  const pop = () => s.pop() ?? 0;
  switch (op) {
    case 3: {
      const b = pop();
      const a = pop();
      s.push(a && b ? 1 : 0);
      break;
    }
    case 4: {
      const b = pop();
      const a = pop();
      s.push(a || b ? 1 : 0);
      break;
    }
    case 5:
      s.push(pop() ? 0 : 1);
      break;
    case 9:
      s.push(Math.abs(pop()));
      break;
    case 10:
      s.push(pop() + pop());
      break;
    case 11: {
      const b = pop();
      s.push(pop() - b);
      break;
    }
    case 12: {
      const b = pop();
      s.push(pop() / b);
      break;
    }
    case 14:
      s.push(-pop());
      break;
    case 15: {
      const b = pop();
      s.push(pop() === b ? 1 : 0);
      break;
    }
    case 18:
      pop();
      break;
    case 20: {
      const i = pop();
      transient[i] = pop();
      break;
    }
    case 21:
      s.push(transient[pop()] ?? 0);
      break;
    case 22: {
      const v2 = pop();
      const v1 = pop();
      const s2 = pop();
      const s1 = pop();
      s.push(v1 <= v2 ? s1 : s2);
      break;
    }
    case 23:
      s.push(0.5);
      break;
    case 24:
      s.push(pop() * pop());
      break;
    case 26:
      s.push(Math.sqrt(pop()));
      break;
    case 27: {
      const v = pop();
      s.push(v, v);
      break;
    }
    case 28: {
      const b = pop();
      const a = pop();
      s.push(b, a);
      break;
    }
    case 29: {
      const i = pop();
      s.push(s[s.length - 1 - Math.max(0, i)] ?? 0);
      break;
    }
    case 30: {
      const j = pop();
      const n = pop();
      if (n > 0) {
        const part = s.splice(s.length - n, n);
        const k = ((j % n) + n) % n;
        s.push(...part.slice(n - k), ...part.slice(0, n - k));
      }
      break;
    }
    default:
      s.length = 0;
  }
}
