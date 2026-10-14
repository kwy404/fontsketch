import { describe, expect, it } from 'vitest';
import { exportFont, parseFont, detectZones, findEdges, findStems, parseHintText, formatHintText, addGlyph } from '../src/node.mjs';
import { buildTrueTypeHinting } from '../src/core/hinting.mjs';
import { prepareGlyphs } from '../src/core/compile.mjs';
import { readSfnt } from '../src/core/sfnt.mjs';
import { readMaxp } from '../src/core/tables.mjs';
import { splitGlyf, decodeGlyph } from '../src/core/glyf.mjs';
import { readHead } from '../src/core/tables.mjs';
import { readCFF } from '../src/core/cff.mjs';
import { rect, sampleFont } from './helpers.mjs';

/**
 * A small TrueType bytecode checker: follows the stack through every
 * instruction the hinter emits (including function calls) and reports
 * underflows, unknown opcodes, bad point numbers and bad CVT indexes.
 */
function runProgram(code, ctx, fns = ctx.fns, depth = 0) {
  const stack = ctx.stack;
  let loop = 1;
  const pop = () => {
    if (!stack.length) throw new Error('stack underflow');
    return stack.pop();
  };
  const point = (p) => {
    if (!Number.isInteger(p) || p < 0 || p >= ctx.points) throw new Error(`bad point ${p} (glyph has ${ctx.points})`);
  };
  const cvt = (i) => {
    if (!Number.isInteger(i) || i < 0 || i >= ctx.cvt) throw new Error(`bad cvt ${i}`);
  };
  for (let pc = 0; pc < code.length;) {
    const op = code[pc++];
    if (op >= 0xb0 && op <= 0xb7) {
      for (let k = 0; k <= op - 0xb0; k++) stack.push(code[pc++]);
    } else if (op >= 0xb8 && op <= 0xbf) {
      for (let k = 0; k <= op - 0xb8; k++) {
        stack.push(((code[pc] << 8) | code[pc + 1]) << 16 >> 16);
        pc += 2;
      }
    } else if (op === 0x40) {
      const n = code[pc++];
      for (let k = 0; k < n; k++) stack.push(code[pc++]);
    } else if (op === 0x41) {
      const n = code[pc++];
      for (let k = 0; k < n; k++) {
        stack.push(((code[pc] << 8) | code[pc + 1]) << 16 >> 16);
        pc += 2;
      }
    } else if (op === 0x00 || op === 0x01 || op === 0x30 || op === 0x31) {
      // SVTCA, IUP
    } else if (op === 0x10) point(pop());
    else if (op === 0x17) loop = pop();
    else if (op === 0x1d || op === 0x85 || op === 0x8d) pop();
    else if (op === 0x20) {
      const v = pop();
      stack.push(v, v);
    } else if (op === 0x2c) {
      const n = pop();
      const start = pc;
      while (code[pc] !== 0x2d) pc++;
      fns.set(n, code.subarray(start, pc));
      pc++;
    } else if (op === 0x2b || op === 0x2a) {
      const f = pop();
      const count = op === 0x2a ? pop() : 1;
      if (!fns.has(f)) throw new Error(`call to undefined function ${f}`);
      if (depth > 4) throw new Error('recursion');
      for (let k = 0; k < count; k++) runProgram(fns.get(f), ctx, fns, depth + 1);
    } else if (op === 0x2f) point(pop());
    else if (op === 0x3c) {
      for (let k = 0; k < loop; k++) point(pop());
      loop = 1;
    } else if (op === 0x3f) {
      cvt(pop());
      point(pop());
    } else if (op === 0x44) {
      pop();
      cvt(pop());
    } else if (op === 0x45) {
      cvt(pop());
      stack.push(0);
    } else if (op === 0x68) {
      stack.push(pop());
    } else if (op >= 0xe0) {
      cvt(pop());
      point(pop());
    } else throw new Error(`unexpected opcode 0x${op.toString(16)}`);
    ctx.max = Math.max(ctx.max, stack.length);
  }
}

describe('blue zones and stems', () => {
  it('derives zones from metrics and reference glyphs', () => {
    const z = detectZones(sampleFont());
    const byName = Object.fromEntries(z.zones.map((x) => [x.name, x]));
    expect(byName.baseline).toMatchObject({ kind: 'bottom', flat: 0 });
    expect(byName.baseline.overshoot).toBe(-12);
    expect(byName.xheight).toMatchObject({ kind: 'top', flat: 500, overshoot: 510 });
    expect(byName.capheight).toMatchObject({ flat: 700, overshoot: 712 });
    expect(byName.ascender.flat).toBe(760);
    expect(byName.descender.flat).toBe(-220);
    expect(z.blueValues.slice(0, 2)).toEqual([-12, 0]);
    expect(z.blueValues).toEqual([...z.blueValues].sort((a, b) => a - b));
    expect(z.otherBlues).toEqual([-220, -220]);
    expect(z.stdHW).toBe(80);
    expect(z.stdVW).toBe(80);
  });

  it('finds edges with their ink side and pairs them into stems', () => {
    const H = sampleFont().glyphs.H.contours.map((c) => c.points.map((p) => ({ x: p.x, y: p.y, on: p.on })));
    const edges = findEdges(H, 'y');
    expect(edges.map((e) => [e.pos, e.kind])).toEqual([[0, 'bottom'], [0, 'bottom'], [310, 'bottom'], [390, 'top'], [700, 'top'], [700, 'top']]);
    const stems = findStems(H, 'y', 200);
    expect(stems.map((s) => [s.pos, s.width])).toEqual([[310, 80]]);
    const v = findStems(H, 'x', 200);
    expect(v.map((s) => [s.pos, s.width])).toEqual([[60, 80], [500, 80]]);
  });
});

describe('TrueType autohinting', () => {
  const font = sampleFont();
  const bytes = exportFont(font, { hinting: 'auto', timestamp: new Date(0) });
  const { tables } = readSfnt(bytes);

  it('writes fpgm, prep, cvt and gasp and flags the head', () => {
    for (const t of ['fpgm', 'prep', 'cvt ', 'gasp']) expect(tables.has(t)).toBe(true);
    expect(readHead(tables.get('head')).flags & 8).toBe(8);
    const gasp = tables.get('gasp');
    expect([...gasp]).toEqual([0, 1, 0, 2, 0, 8, 0, 10, 255, 255, 0, 15]);
    const cvt = tables.get('cvt ');
    const values = [];
    for (let i = 0; i < cvt.length; i += 2) values.push(((cvt[i] << 8) | cvt[i + 1]) << 16 >> 16);
    expect(values).toEqual(expect.arrayContaining([0, -12, 500, 510, 700, 712, 760, -220, 80]));
  });

  it('emits programs that keep the stack balanced and only touch real points', () => {
    const maxp = readMaxp(tables.get('maxp'));
    const head = readHead(tables.get('head'));
    const cvtCount = tables.get('cvt ').length / 2;
    const fns = new Map();
    const fctx = { stack: [], fns, points: 0, cvt: cvtCount, max: 0 };
    runProgram(tables.get('fpgm'), fctx);
    expect([...fns.keys()].sort()).toEqual([0, 1, 2]);
    expect(fns.size).toBeLessThanOrEqual(maxp.maxFunctionDefs);
    const pctx = { stack: [], fns, points: 0, cvt: cvtCount, max: 0 };
    runProgram(tables.get('prep'), pctx);
    expect(pctx.stack).toEqual([]);
    const records = splitGlyf(tables.get('glyf'), tables.get('loca'), head.indexToLocFormat, maxp.numGlyphs);
    let hinted = 0;
    for (const rec of records) {
      const g = decodeGlyph(rec);
      if (!g.instructions.length) continue;
      hinted++;
      const points = g.contours.reduce((a, c) => a + c.length, 0);
      const ctx = { stack: [], fns, points, cvt: cvtCount, max: 0 };
      runProgram(g.instructions, ctx);
      expect(ctx.stack).toEqual([]);
      expect(ctx.max).toBeLessThanOrEqual(maxp.maxStackElements);
      expect(g.instructions.length).toBeLessThanOrEqual(maxp.maxSizeOfInstructions);
      expect(g.instructions[0]).toBe(0x00);
      expect(g.instructions[g.instructions.length - 1]).toBe(0x30);
    }
    expect(hinted).toBeGreaterThan(10);
  });

  it('snaps points on zones with MIAP and links stems with MIRP', () => {
    const order = Object.keys(font.glyphs);
    const prepared = prepareGlyphs(order.map((n) => font.glyphs[n]), new Map(order.map((n, i) => [n, i])), { cff: false, correct: true, optimize: true });
    const result = buildTrueTypeHinting(prepared, font, 'auto');
    const H = result.glyphInstructions.get(order.indexOf('H'));
    expect(H.includes(0x3f)).toBe(true);
    expect(H.includes(0x2b)).toBe(true);
    expect(result.maxp.maxFunctionDefs).toBe(3);
    // Glyphs without outlines and composites get no program.
    expect(result.glyphInstructions.has(order.indexOf('space'))).toBe(false);
  });

  it('hints manually from stems and passes author programs through', () => {
    const f = sampleFont();
    f.glyphs.H.hints = parseHintText('# crossbar\nhstem 310 80\nvstem 60 80\n');
    f.glyphs.I.hints = { instructions: new Uint8Array([0x00, 0x30]) };
    const back = readSfnt(exportFont(f, { hinting: 'manual', timestamp: new Date(0) })).tables;
    const maxp = readMaxp(back.get('maxp'));
    const head = readHead(back.get('head'));
    const recs = splitGlyf(back.get('glyf'), back.get('loca'), head.indexToLocFormat, maxp.numGlyphs);
    const order = ['.notdef', ...Object.keys(f.glyphs).filter((n) => n !== '.notdef')];
    const hInstr = decodeGlyph(recs[order.indexOf('H')]).instructions;
    expect(hInstr.includes(0x01)).toBe(true);
    expect(hInstr.includes(0x31)).toBe(true);
    expect([...decodeGlyph(recs[order.indexOf('I')]).instructions]).toEqual([0x00, 0x30]);
    expect(formatHintText(f.glyphs.H.hints)).toBe('hstem 310 80\nvstem 60 80');
    expect(() => parseHintText('stem 1 2')).toThrow(/line 1/);
  });

  it('hints large glyphs with word sized pushes', () => {
    const f = sampleFont();
    const pts = [];
    for (let i = 0; i < 300; i++) pts.push({ x: i * 2, y: i % 2 ? 0 : 3, on: true });
    pts.push({ x: 600, y: 700, on: true }, { x: 0, y: 700, on: true });
    addGlyph(f, { name: 'big', unicodes: [0xe100], advanceWidth: 700, contours: [rect(0, 0, 600, 80), { closed: true, points: pts.reverse() }] });
    const bytes = exportFont(f, { hinting: 'auto', timestamp: new Date(0) });
    expect(parseFont(bytes).glyphs.big.contours).toHaveLength(2);
  });
});

describe('CFF hints', () => {
  it('writes stems in charstrings and blue values in the private dict', () => {
    const f = sampleFont();
    const cff = readCFF(readSfnt(exportFont(f, { format: 'otf', hinting: 'auto', timestamp: new Date(0) })).tables.get('CFF '));
    const H = cff.glyphs[cff.glyphNames.indexOf('H')];
    expect(H.hstems).toEqual([[310, 80]]);
    expect(H.vstems).toEqual([[60, 80], [500, 80]]);
    expect(cff.privateDict.blueValues.slice(0, 2)).toEqual([-12, 0]);
    expect(cff.privateDict.stdVW).toBe(80);
    const parsed = parseFont(exportFont(f, { format: 'otf', hinting: 'auto', timestamp: new Date(0) }));
    expect(parsed.glyphs.H.hints.stems.h).toEqual([[310, 80]]);
    const manual = sampleFont();
    manual.glyphs.I.hints = { stems: { h: [[0, 20]], v: [[90, 80]] } };
    const m = readCFF(readSfnt(exportFont(manual, { format: 'otf', hinting: 'manual' })).tables.get('CFF '));
    expect(m.glyphs[m.glyphNames.indexOf('I')].vstems).toEqual([[90, 80]]);
    const none = readCFF(readSfnt(exportFont(f, { format: 'otf' })).tables.get('CFF '));
    expect(none.glyphs[none.glyphNames.indexOf('H')].hstems).toEqual([]);
    expect(none.privateDict.blueValues).toEqual([]);
  });
});
