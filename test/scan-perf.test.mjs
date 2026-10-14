// A full 56 cell sheet in a 12 megapixel photo, timed. The bound is loose for
// slow CI machines; the measured time is printed.
import { describe, expect, it } from 'vitest';
import { createTemplate } from '../src/scan/template.mjs';
import { scanSheet } from '../src/scan/scan.mjs';
import { DRAWABLE, glyphIoU, photograph, renderSheet } from './scan-synth.mjs';

describe('performance', () => {
  it('scans a 12 megapixel photo of a full page in a few seconds', async () => {
    const tpl = createTemplate({ chars: DRAWABLE.slice(0, 56).join('') });
    expect(tpl.template.pages[0].cells).toHaveLength(56);
    const sheet = renderSheet(tpl.template, 0, { ink: 'blue', pen: 0.7, seed: 3, R: 10 });
    await new Promise((r) => setTimeout(r, 0));
    const photo = photograph(sheet, {
      seed: 5, rotate: 6, perspective: 0.04, gradient: 0.3, shadow: 0.3, blur: 1.2, chroma: true, noise: 3, width: 3000, height: 4000, fill: 0.92,
    });
    await new Promise((r) => setTimeout(r, 0));
    const t0 = performance.now();
    const res = scanSheet(photo, { template: tpl });
    const ms = performance.now() - t0;
    console.log(`12 MP photo, 56 cells: ${Math.round(ms)} ms (${res.pixelsPerMm.toFixed(1)} px/mm in the photo, processed at ${res.resolution} px/mm)`);
    expect(Object.keys(res.glyphs)).toHaveLength(56);
    const ious = Object.values(res.glyphs).map((g) => glyphIoU(g.contours, sheet.truth[g.char].strokes, sheet.truth[g.char].pen, g.shiftX));
    expect(Math.min(...ious)).toBeGreaterThan(0.6);
    expect(ms).toBeLessThan(20000);
  }, 180000);
});
