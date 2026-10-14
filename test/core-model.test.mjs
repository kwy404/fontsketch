import { describe, expect, it } from 'vitest';
import {
  addGlyph, createFont, deserialize, glyphNameFor, removeGlyph, serialize, unicodeFor, validateFont,
} from '../src/core/model.mjs';

describe('model', () => {
  it('creates a font with .notdef and space', () => {
    const font = createFont({ family: 'Test' });
    expect(font.meta.unitsPerEm).toBe(1000);
    expect(font.meta.family).toBe('Test');
    expect(Object.keys(font.glyphs)).toEqual(['.notdef', 'space']);
    expect(font.glyphs.space.unicodes).toEqual([32]);
    expect(validateFont(font)).toEqual([]);
  });

  it('names glyphs like production fonts', () => {
    expect(glyphNameFor('a')).toBe('a');
    expect(glyphNameFor('\u00e3')).toBe('atilde');
    expect(glyphNameFor('\u00c7')).toBe('Ccedilla');
    expect(glyphNameFor(' ')).toBe('space');
    expect(glyphNameFor('\u0416')).toBe('uni0416');
    expect(glyphNameFor(0x1f600)).toBe('u1F600');
    expect(glyphNameFor(0x17f)).toBe('longs');
    expect(glyphNameFor(0x131)).toBe('dotlessi');
  });

  it('maps names back to code points', () => {
    expect(unicodeFor('atilde')).toBe(0xe3);
    expect(unicodeFor('uni0416')).toBe(0x416);
    expect(unicodeFor('u1F600')).toBe(0x1f600);
    expect(unicodeFor('a.alt')).toBeUndefined();
    expect(unicodeFor('.notdef')).toBeUndefined();
    for (let c = 0x20; c < 0x180; c++) {
      if (c > 0x7e && c < 0xa0) continue;
      expect(unicodeFor(glyphNameFor(c))).toBe(c);
    }
  });

  it('adds glyphs with derived code points and removes them with their kerning', () => {
    const font = createFont();
    addGlyph(font, { name: 'A', advanceWidth: 600, contours: [] });
    addGlyph(font, { name: 'V', advanceWidth: 600, contours: [] });
    expect(font.glyphs.A.unicodes).toEqual([65]);
    font.kerning.pairs['A|V'] = -80;
    font.kerning.classes['@round'] = ['A', 'O'];
    removeGlyph(font, 'A');
    expect(font.kerning.pairs).toEqual({});
    expect(font.kerning.classes['@round']).toEqual(['O']);
    expect(() => addGlyph(font, { name: '9bad' })).toThrow(TypeError);
  });

  it('round trips projects including hint bytes', () => {
    const font = createFont({ family: 'Round' });
    addGlyph(font, {
      name: 'a', advanceWidth: 500, unicodes: [97],
      contours: [{ closed: true, points: [{ x: 0, y: 0, on: true }, { x: 100, y: 0, on: true }, { x: 50, y: 80, on: false }] }],
      hints: { stems: { v: [[10, 80]] }, instructions: new Uint8Array([0xb0, 1, 2, 255]) },
    });
    const back = deserialize(serialize(font));
    expect(back.glyphs.a.hints.instructions).toEqual(new Uint8Array([0xb0, 1, 2, 255]));
    expect(back.glyphs.a.contours).toEqual(font.glyphs.a.contours);
    expect(back.meta).toEqual(font.meta);
  });

  it('reports validation problems', () => {
    const font = createFont();
    addGlyph(font, { name: 'x', unicodes: [32], advanceWidth: 10, components: [{ glyph: 'nope', dx: 0, dy: 0 }] });
    const problems = validateFont(font);
    expect(problems.some((p) => p.includes('U+0020'))).toBe(true);
    expect(problems.some((p) => p.includes('nope'))).toBe(true);
  });
});
