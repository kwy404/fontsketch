import { describe, expect, it } from 'vitest';
import { parsePathData, parseTransform, svgToContours } from '../src/core/svg.mjs';
import { bounds, contourArea } from '../src/core/geometry.mjs';

describe('SVG path data', () => {
  it('parses every command in absolute and relative form', () => {
    const subs = parsePathData('M10 10 L20 10 l0 10 H10 h5 V5 v5 C10 0 20 0 20 10 c0 5 -5 5 -5 0 S0 0 5 5 s5 5 0 0 Q10 10 20 20 q5 5 10 0 T40 20 t5 5 A5 5 0 0 1 60 20 a5 5 0 1 0 10 0 Z m5 5 l5 0z');
    expect(subs).toHaveLength(2);
    expect(subs[0].closed).toBe(true);
    expect(subs[0].cubics.length).toBeGreaterThan(14);
    expect(subs[1].start).toEqual({ x: 15, y: 15 });
    expect(parsePathData('M0,0L1e1,0.5.5,1z')[0].cubics.length).toBe(3);
    expect(() => parsePathData('0 0')).toThrow(/start with a command/);
    expect(() => parsePathData('M0 0 L5')).toThrow(/expected a number/);
  });

  it('approximates arcs closely', () => {
    const sub = parsePathData('M0 0 A50 50 0 0 1 100 0')[0];
    let worst = 0;
    for (const c of sub.cubics) {
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const mt = 1 - t;
        const x = mt ** 3 * c[0].x + 3 * mt * mt * t * c[1].x + 3 * mt * t * t * c[2].x + t ** 3 * c[3].x;
        const y = mt ** 3 * c[0].y + 3 * mt * mt * t * c[1].y + 3 * mt * t * t * c[2].y + t ** 3 * c[3].y;
        worst = Math.max(worst, Math.abs(Math.hypot(x - 50, y) - 50));
      }
    }
    expect(worst).toBeLessThan(0.05);
    // Compact flags: "a1 1 0 01 1 1".
    expect(parsePathData('M0 0a1 1 0 01 1 1')[0].cubics.length).toBeGreaterThan(0);
  });

  it('parses transforms', () => {
    expect(parseTransform('translate(10 20) scale(2)')).toEqual([2, 0, 0, 2, 10, 20]);
    const r = parseTransform('rotate(90)');
    expect(r[0]).toBeCloseTo(0, 9);
    expect(r[1]).toBeCloseTo(1, 9);
    expect(parseTransform('matrix(1 0 0 -1 0 5)')).toEqual([1, 0, 0, -1, 0, 5]);
    expect(parseTransform('skewX(45)')[2]).toBeCloseTo(1, 9);
    expect(parseTransform('')).toEqual([1, 0, 0, 1, 0, 0]);
  });
});

describe('svgToContours', () => {
  it('maps the viewBox to the em and flips the Y axis', () => {
    const { contours, advanceWidth, warnings } = svgToContours('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="10"/></svg>');
    expect(warnings).toEqual([]);
    expect(advanceWidth).toBe(1000);
    const b = bounds(contours);
    expect(b.xMin).toBeCloseTo(2 * (1000 / 24), 1);
    expect(b.yMax).toBeCloseTo(800 - 2 * (1000 / 24), 1);
    expect(b.yMin).toBeCloseTo(800 - 12 * (1000 / 24), 1);
    expect(contourArea(contours[0])).toBeLessThan(0);
  });

  it('handles groups, transforms, shapes, even odd holes and skipped elements', () => {
    const svg = `<svg viewBox="0 0 100 100" width="100" height="100">
      <defs><path id="x" d="M0 0h100v100z"/></defs>
      <title>t</title>
      <g transform="translate(10 0)" fill-rule="evenodd">
        <path d="M0 0h80v80h-80z M20 20h40v40h-40z"/>
      </g>
      <circle cx="50" cy="90" r="5" style="fill: black"/>
      <ellipse cx="10" cy="90" rx="5" ry="3"/>
      <polygon points="90,90 95,95 90,95"/>
      <rect x="0" y="0" width="10" height="10" rx="3" />
      <line x1="0" y1="0" x2="10" y2="10" stroke="black"/>
      <path d="M0 0h5v5z" fill="none" stroke="red"/>
      <use href="#x"/>
    </svg>`;
    const { contours, warnings } = svgToContours(svg, { unitsPerEm: 1000, ascender: 800, descender: -200 });
    expect(warnings.some((w) => w.includes('<line>'))).toBe(true);
    expect(warnings.some((w) => w.includes('fill="none"'))).toBe(true);
    expect(warnings.some((w) => w.includes('<use>'))).toBe(true);
    const holes = contours.filter((c) => contourArea(c) > 0);
    expect(holes).toHaveLength(1);
    expect(Math.abs(contourArea(holes[0]))).toBeCloseTo(400 * 400, -2);
    expect(contours.length).toBeGreaterThanOrEqual(5);
    expect(() => svgToContours('<div></div>')).toThrow(/no <svg>/);
    expect(() => svgToContours('<svg></svg>')).toThrow(/viewBox/);
  });
});
