// Robustness of the photo pipeline against everything a phone photo does to
// a sheet. Every case renders a filled template with the stroke font,
// photographs it with random perspective, rotation, light, shadow, blur,
// JPEG like chroma loss and noise, scans it and compares each recovered
// glyph with the ground truth strokes (intersection over union in font
// units, position included). A summary per distortion type is printed.

import { describe, expect, it } from 'vitest';
import { createTemplate } from '../src/scan/template.mjs';
import { scanSheet } from '../src/scan/scan.mjs';
import { INKS, glyphIoU, photograph, randomCase, renderSheet } from './scan-synth.mjs';

const RECOVERED = 0.6;
const rows = [];
// long synchronous phases starve the test runner; yield between them
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function run(c) {
  const tpl = createTemplate({ chars: c.chars, cols: c.cols, pageSize: c.pageSize });
  const sheet = renderSheet(tpl.template, 0, { ink: c.ink || c.inkName, pen: c.pen, seed: c.seed });
  await tick();
  const photo = photograph(sheet, c.photo);
  await tick();
  const res = scanSheet(photo, { template: tpl });
  await tick();
  const ious = [...c.chars].map((ch) => {
    const g = res.glyphs[ch];
    const t = sheet.truth[ch];
    return { ch, iou: g && !g.empty ? glyphIoU(g.contours, t.strokes, t.pen, g.shiftX) : 0, empty: !g || g.empty };
  });
  const tags = ['all', `ink ${c.inkName}`];
  const p = c.photo;
  const rot = Math.abs((((p.rotate || 0) + 180) % 360) - 180);
  if (rot > 90) tags.push('upside down');
  if (Math.abs(rot - (rot > 90 ? 180 : 0)) > 8) tags.push('rotation over 8 deg');
  if ((p.perspective || 0) > 0.04) tags.push('strong perspective');
  if ((p.gradient || 0) > 0.3) tags.push('gradient light');
  if (p.shadow) tags.push('shadow');
  if ((p.blur || 0) > 1) tags.push('blur over 1 px');
  if (p.blurRamp) tags.push('partial blur');
  if (p.chroma) tags.push('jpeg chroma');
  if ((p.noise || 0) > 4) tags.push('noise over 4');
  if (res.pixelsPerMm < 4.5) tags.push('low resolution');
  if (c.pen < 0.6) tags.push('thin pen');
  rows.push({ tags, ious });
  return { res, ious };
}

async function check(c) {
  const { res, ious } = await run(c);
  expect(res.markers).toHaveLength(4);
  expect(res.sheetId).not.toBeNull();
  for (const r of ious) {
    expect(r.empty, `"${r.ch}" was not found`).toBe(false);
    expect(r.iou, `"${r.ch}" IoU`).toBeGreaterThan(0.35);
  }
  // a stroke only 2 or 3 pixels wide loses IoU to sub pixel edge error alone
  const penPx = c.pen * res.resolution;
  const mean = ious.reduce((a, b) => a + b.iou, 0) / ious.length;
  expect(mean).toBeGreaterThan(penPx < 3 ? 0.65 : 0.75);
}

describe('randomized phone photos (fixed seeds)', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const c = randomCase(seed);
    const p = c.photo;
    it(`case ${seed}: ${c.inkName} ${c.pen.toFixed(2)} mm, rotate ${p.rotate.toFixed(0)}, blur ${p.blur.toFixed(1)}${p.shadow ? ', shadow' : ''}${p.chroma ? ', jpeg' : ''}`, async () => {
      await check(c);
    }, 90000);
  }
});

const harsh = (seed, extra = {}) => ({
  seed: seed + 500, width: 2400, height: 1800, rotate: (seed % 2 ? 1 : -1) * (6 + seed), perspective: 0.05, fill: 0.85,
  gradient: 0.5, shadow: 0.45, tint: [1, 0.93, 0.8], blur: 0.9, chroma: true, noise: 4, ...extra,
});
const sample = 'aegkmoqsyABGQRS0369';

describe('pencil', () => {
  const cases = [
    { pen: 0.45, ink: INKS.pencil },
    { pen: 0.55, ink: { t: [0.66, 0.66, 0.68], grain: 0.35 } },
    { pen: 0.5, ink: { t: [0.5, 0.5, 0.53], grain: 0.45 } },
  ];
  cases.forEach((k, i) => {
    it(`low contrast gray pencil ${i + 1} (${k.pen} mm, transmittance ${k.ink.t[0]})`, async () => {
      await check({ seed: 900 + i, inkName: 'pencil', ink: k.ink, pen: k.pen, chars: sample, cols: 6, pageSize: 'A4', photo: harsh(i) });
    }, 90000);
  });
});

describe('coloured inks', () => {
  const inks = {
    blue: INKS.blue, red: INKS.red, green: INKS.green, purple: INKS.purple,
    'light blue gel': { t: [0.42, 0.62, 0.88] },
    'orange felt tip': { t: [0.92, 0.55, 0.2] },
  };
  Object.entries(inks).forEach(([name, ink], i) => {
    it(`${name} ink under a warm light and a shadow`, async () => {
      await check({ seed: 950 + i, inkName: name, ink, pen: 0.7, chars: sample, cols: 6, pageSize: 'Letter', photo: harsh(i + 3) });
    }, 90000);
  });
});

describe('summary', () => {
  it('recovers characters under every distortion type', () => {
    const by = new Map();
    for (const r of rows) {
      for (const tag of r.tags) {
        if (!by.has(tag)) by.set(tag, []);
        by.get(tag).push(...r.ious.map((x) => x.iou));
      }
    }
    const lines = ['distortion                  glyphs  recovered  mean IoU'];
    const stats = [];
    for (const [tag, v] of [...by.entries()].sort((a, b) => (a[0] === 'all' ? -1 : b[0] === 'all' ? 1 : a[0].localeCompare(b[0])))) {
      const rec = v.filter((x) => x >= RECOVERED).length / v.length;
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      lines.push(`${tag.padEnd(26)} ${String(v.length).padStart(7)}  ${(rec * 100).toFixed(1).padStart(8)} %  ${mean.toFixed(3).padStart(8)}`);
      stats.push({ tag, rec, mean });
    }
    console.log(`\nRecovery (IoU >= ${RECOVERED}) by distortion type\n${lines.join('\n')}\n`);
    for (const { tag, rec, mean } of stats) {
      expect(rec, tag).toBeGreaterThan(0.95);
      expect(mean, tag).toBeGreaterThan(0.78);
    }
    const all = by.get('all');
    expect(all.filter((x) => x >= RECOVERED).length / all.length).toBeGreaterThan(0.98);
  });
});
