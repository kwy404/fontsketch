import { describe, expect, it } from 'vitest';
import { VariationModel, checkCompatibility, interpolate, namedInstances, normalizeLocation, supportScalar } from '../src/core/variable.mjs';
import { exportFont, parseFont } from '../src/node.mjs';
import { readSfnt } from '../src/core/sfnt.mjs';
import { readName } from '../src/core/tables.mjs';
import { readFvar } from '../src/core/variable.mjs';
import { addGlyph, createFont } from '../src/core/model.mjs';
import { rect, sampleVariableFont } from './helpers.mjs';

const axes = [
  { tag: 'wght', name: 'Weight', min: 100, default: 400, max: 900 },
  { tag: 'wdth', name: 'Width', min: 75, default: 100, max: 125 },
];

describe('normalization and scalars', () => {
  it('maps user coordinates to -1..1 and clamps', () => {
    expect(normalizeLocation(axes, { wght: 400 })).toEqual({});
    expect(normalizeLocation(axes, { wght: 900, wdth: 75 })).toEqual({ wght: 1, wdth: -1 });
    expect(normalizeLocation(axes, { wght: 250 })).toEqual({ wght: -0.5 });
    expect(normalizeLocation(axes, { wght: 2000 })).toEqual({ wght: 1 });
    expect(normalizeLocation(axes, { wght: 650 }, { wght: [[-1, -1], [0, 0], [0.5, 0.8], [1, 1]] }).wght).toBeCloseTo(0.8, 4);
  });

  it('computes region scalars', () => {
    expect(supportScalar({ wght: 0.5 }, { wght: [0, 1, 1] })).toBe(0.5);
    expect(supportScalar({ wght: 0.25 }, { wght: [0, 0.5, 1] })).toBe(0.5);
    expect(supportScalar({ wght: 0.75 }, { wght: [0, 0.5, 1] })).toBe(0.5);
    expect(supportScalar({ wght: -0.5 }, { wght: [0, 1, 1] })).toBe(0);
    expect(supportScalar({ wght: 1, wdth: 0.5 }, { wght: [0, 1, 1], wdth: [0, 1, 1] })).toBe(0.5);
  });
});

describe('VariationModel', () => {
  it('reproduces every master exactly and interpolates linearly between them', () => {
    const locs = [{}, { wght: -1 }, { wght: 1 }, { wght: 0.5 }];
    const values = [100, 40, 300, 150];
    const model = new VariationModel(locs, ['wght']);
    const deltas = model.getDeltas(values);
    locs.forEach((l, i) => expect(model.interpolateFromDeltas(l, deltas)).toBeCloseTo(values[i], 9));
    expect(model.interpolateFromDeltas({ wght: 0.25 }, deltas)).toBeCloseTo(125, 9);
    expect(model.interpolateFromDeltas({ wght: 0.75 }, deltas)).toBeCloseTo(225, 9);
    expect(model.interpolateFromDeltas({ wght: -0.5 }, deltas)).toBeCloseTo(70, 9);
  });

  it('handles two axes with a corner master and arrays of values', () => {
    const locs = [{}, { wght: 1 }, { wdth: 1 }, { wght: 1, wdth: 1 }];
    const values = [[0, 0], [10, 1], [20, 2], [50, 5]];
    const model = new VariationModel(locs, ['wght', 'wdth']);
    const deltas = model.getDeltas(values);
    locs.forEach((l, i) => {
      const v = model.interpolateFromDeltas(l, deltas);
      expect(v[0]).toBeCloseTo(values[i][0], 9);
      expect(v[1]).toBeCloseTo(values[i][1], 9);
    });
    expect(model.interpolateFromDeltas({ wght: 0.5, wdth: 0.5 }, deltas)[0]).toBeCloseTo(20, 9);
    expect(() => new VariationModel([{ wght: 1 }])).toThrow(/default/);
    expect(() => new VariationModel([{}, { wght: 1 }, { wght: 1 }])).toThrow(/same location/);
  });
});

describe('interpolate', () => {
  const vf = sampleVariableFont();

  it('returns the masters at their locations and blends in between', () => {
    const black = interpolate(vf, { wght: 900 });
    expect(black.glyphs.H.contours).toEqual(vf.masters[1].glyphs.H.contours.map((c) => ({ ...c, points: c.points.map((p) => ({ ...p })) })));
    expect(black.glyphs.H.advanceWidth).toBe(700);
    expect(black.meta.style).toBe('Black');
    expect(black.meta.weightClass).toBe(900);
    expect(black.axes).toBeUndefined();
    expect(black.masters).toBeUndefined();
    const mid = interpolate(vf, { wght: 650 });
    expect(mid.glyphs.H.advanceWidth).toBeCloseTo(640 + 60 * (250 / 500), 6);
    const stem = mid.glyphs.I.contours[0].points;
    const width = Math.max(...stem.map((p) => p.x)) - Math.min(...stem.map((p) => p.x));
    expect(width).toBeCloseTo(60 + 90 * 0.5, 6);
    expect(interpolate(vf, { wght: 333 }).meta.style).toBe('W333');
    expect(() => interpolate(vf, { wdth: 100 })).toThrow(/unknown axis/);
    expect(() => interpolate(createFont(), { wght: 1 })).toThrow(/no axes/);
  });

  it('lists named instances from Thin to Black inside the axis range', () => {
    expect(namedInstances(vf).map((i) => i.name)).toEqual(['Thin', 'ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black']);
    const narrow = { ...vf, axes: [{ ...vf.axes[0], min: 300, max: 700 }] };
    expect(namedInstances(narrow).map((i) => i.name)).toEqual(['Light', 'Regular', 'Medium', 'SemiBold', 'Bold']);
    const custom = { ...vf, instances: [{ name: 'Book', location: { wght: 450 } }] };
    expect(namedInstances(custom)).toEqual([{ name: 'Book', location: { wght: 450 } }]);
  });

  it('reports incompatible masters clearly', () => {
    const f = sampleVariableFont();
    f.masters[0].glyphs.o.contours[1].points.pop();
    f.masters[1].glyphs.ghost = { contours: [] };
    f.masters[1].location.opsz = 12;
    const errors = checkCompatibility(f);
    expect(errors).toContain('glyph "o" contour 1: master "Thin" has 15 points, the default has 16');
    expect(errors).toContain('master "Black" has glyph "ghost" which the default master does not have');
    expect(errors).toContain('master "Black" uses axis "opsz" which is not in font.axes');
  });
});

describe('variable tables', () => {
  it('writes axis and instance names and supports two axes and intermediate masters', () => {
    const f = createFont({ family: 'Two Axis' });
    addGlyph(f, { name: 'I', unicodes: [73], advanceWidth: 300, contours: [rect(100, 0, 200, 700)] });
    f.axes = axes;
    const m = (name, location, x0, x1, adv) => ({ name, location, glyphs: { I: { contours: [rect(x0, 0, x1, 700)], advanceWidth: adv } } });
    f.masters = [m('Bold', { wght: 900 }, 80, 260, 360), m('Wide', { wdth: 125 }, 100, 260, 420), m('BoldWide', { wght: 900, wdth: 125 }, 60, 340, 500), m('Semi', { wght: 650 }, 90, 240, 330)];
    const bytes = exportFont(f, { variable: true, timestamp: new Date(0) });
    const { tables } = readSfnt(bytes);
    const names = readName(tables.get('name'));
    const fvar = readFvar(tables.get('fvar'), names);
    expect(fvar.axes.map((a) => [a.tag, a.name])).toEqual([['wght', 'Weight'], ['wdth', 'Width']]);
    expect(fvar.instances.find((i) => i.name === 'Bold').location).toEqual({ wght: 700, wdth: 100 });
    expect(names[25]).toBe('TwoAxis');
    const back = parseFont(bytes);
    for (const loc of [{ wght: 900 }, { wdth: 125 }, { wght: 900, wdth: 125 }, { wght: 650 }, { wght: 520, wdth: 110 }]) {
      const a = interpolate(f, loc).glyphs.I;
      const b = interpolate(back, loc).glyphs.I;
      const xs = (g) => g.contours[0].points.map((p) => p.x).sort((x, y) => x - y);
      xs(a).forEach((x, i) => expect(Math.abs(x - xs(b)[i])).toBeLessThanOrEqual(1));
      expect(Math.abs(a.advanceWidth - b.advanceWidth)).toBeLessThanOrEqual(1);
    }
  });
});
