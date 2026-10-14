import { describe, expect, it } from 'vitest';
import { COMPOSABLE, PORTUGUESE, compose, composeAll, decompose } from '../src/core/compose.mjs';
import { addGlyph, createFont } from '../src/core/model.mjs';
import { exportFont, parseFont } from '../src/node.mjs';
import { rect, sampleFont } from './helpers.mjs';

function latinFont() {
  const f = sampleFont();
  // i and j with dots, u, C, uppercase E, U, plus caron and dieresis marks.
  addGlyph(f, { name: 'i', unicodes: [0x69], advanceWidth: 240, contours: [rect(80, 0, 160, 500), rect(80, 600, 160, 680)] });
  addGlyph(f, { name: 'j', unicodes: [0x6a], advanceWidth: 240, contours: [rect(80, -200, 160, 500), rect(80, 600, 160, 680)] });
  for (const [n, u] of [['u', 0x75], ['E', 0x45], ['U', 0x55], ['C', 0x43], ['d', 0x64], ['g', 0x67]]) {
    addGlyph(f, { name: n, unicodes: [u], advanceWidth: 560, contours: [rect(70, 0, 480, n === n.toUpperCase() ? 700 : n === 'd' ? 760 : 500)] });
  }
  addGlyph(f, { name: 'circumflex', unicodes: [0x2c6], advanceWidth: 300, contours: [rect(80, 560, 220, 640)] });
  addGlyph(f, { name: 'dieresis', unicodes: [0xa8], advanceWidth: 300, contours: [rect(60, 580, 120, 640), rect(180, 580, 240, 640)] });
  addGlyph(f, { name: 'caron', unicodes: [0x2c7], advanceWidth: 300, contours: [rect(80, 560, 220, 640)] });
  addGlyph(f, { name: 'ogonek', unicodes: [0x2db], advanceWidth: 200, contours: [rect(60, -180, 140, 0)] });
  addGlyph(f, { name: 'commaaccent', unicodes: [0xf6c3], advanceWidth: 200, contours: [rect(80, -200, 120, -60)] });
  addGlyph(f, { name: 'acute.cap', advanceWidth: 300, contours: [rect(120, 740, 200, 800)] });
  addGlyph(f, { name: 'periodcentered', unicodes: [0xb7], advanceWidth: 200, contours: [rect(70, 300, 130, 360)] });
  return f;
}

describe('compose', () => {
  it('knows what it can build', () => {
    expect(decompose(0xe3)).toEqual({ base: 'a', marks: [0x303] });
    expect(decompose(0x141)).toBeNull();
    expect(decompose(0x13f)?.special).toBe('middot');
    expect(COMPOSABLE.length).toBeGreaterThan(150);
    expect(COMPOSABLE).not.toContain(0xd7);
    expect(PORTUGUESE).toHaveLength(26);
  });

  it('places marks with metric based defaults', () => {
    const f = latinFont();
    const atilde = compose(f, 'ã');
    expect(atilde).toMatchObject({ name: 'atilde', unicodes: [0xe3], advanceWidth: 540, contours: [] });
    expect(atilde.components[0]).toEqual({ glyph: 'a', dx: 0, dy: 0 });
    expect(atilde.components[1].glyph).toBe('tilde');
    // Raised by the base height above the x-height (a reaches 460 + overshoot at most).
    const A = compose(f, 'Ã');
    expect(A.components[1].dy).toBe(200);
    // Centered horizontally on the base.
    expect(atilde.components[1].dx).toBe(Math.round(260 - 150));
    // Cedilla below at the baseline.
    expect(compose(f, 'ç').components[1]).toMatchObject({ glyph: 'cedilla', dy: 0 });
  });

  it('uses anchors, cap variants and dotless forms', () => {
    const f = latinFont();
    f.glyphs.e.anchors = { top: { x: 300, y: 520 } };
    const eacute = compose(f, 'é');
    expect(eacute.components[1]).toEqual({ glyph: 'acute', dx: 300 - 190, dy: 520 - 560 });
    expect(compose(f, 'Á').components[1].glyph).toBe('acute.cap');
    const iacute = compose(f, 'í');
    expect(iacute.components[0].glyph).toBe('dotlessi');
    expect(f.glyphs.dotlessi.contours).toHaveLength(1);
    expect(f.glyphs.dotlessi.unicodes).toEqual([0x131]);
    expect(compose(f, 'ĵ').components[0].glyph).toBe('dotlessj');
    expect(compose(f, 'ģ').components[1].glyph).toBe('commaaccent');
    expect(compose(f, 'ą').components[1].glyph).toBe('ogonek');
    const ldot = compose(f, 'ŀ');
    expect(ldot.components.map((c) => c.glyph)).toEqual(['l', 'periodcentered']);
    expect(ldot.advanceWidth).toBeGreaterThan(f.glyphs.l.advanceWidth);
    expect(compose(f, 'ď').components[1].glyph).toBe('caron');
  });

  it('covers every Portuguese letter and exports them as composites', () => {
    const f = latinFont();
    const { created, skipped } = composeAll(f, { chars: PORTUGUESE });
    expect(skipped).toEqual([]);
    expect(created).toHaveLength(26);
    const back = parseFont(exportFont(f, { timestamp: new Date(0) }));
    for (const ch of PORTUGUESE) {
      const g = Object.values(back.glyphs).find((x) => x.unicodes.includes(ch.codePointAt(0)));
      expect(g?.components?.length, ch).toBe(2);
    }
  });

  it('composes the whole Latin range it has parts for and explains the rest', () => {
    const f = latinFont();
    const { created, skipped } = composeAll(f);
    expect(created.length).toBeGreaterThan(60);
    expect(composeAll(f, { chars: ['Ł'] }).skipped[0].reason).toMatch(/draw it directly/);
    expect(skipped.find((s) => s.char === 'Ñ')?.reason).toMatch(/base glyph "N"/);
    const again = composeAll(f);
    expect(again.created.length).toBe(created.length);
    expect(() => compose(createFont(), 'á')).toThrow(/base glyph "a"/);
    const noMark = sampleFont();
    delete noMark.glyphs.tilde;
    expect(() => compose(noMark, 'ã')).toThrow(/tilde/);
  });
});
