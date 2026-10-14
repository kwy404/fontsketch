import { describe, expect, it } from 'vitest';
import { createTemplate } from '../src/scan/template.mjs';
import {
  MARKER_CODES, PAGE_SIZES, crc8, decodePageCode, encodePageCode, guideLines, markerModules, rotateCode, templateLayout,
} from '../src/scan/layout.mjs';
import { CHARSETS, resolveChars, verticalClass } from '../src/scan/charsets.mjs';
import { textWidthEm, writePdf } from '../src/scan/pdf.mjs';

const popcount = (v) => {
  let n = 0;
  for (; v; v >>>= 1) n += v & 1;
  return n;
};

describe('character sets', () => {
  it('resolves named sets, arrays and literal strings without duplicates', () => {
    expect(resolveChars('digits')).toEqual([...'0123456789']);
    expect(resolveChars(['digits', '0a'])).toEqual([...'0123456789a']);
    expect(resolveChars('=digits')).toEqual([...'digts']);
    expect(resolveChars('a b\tc')).toEqual(['a', 'b', 'c']);
    expect(resolveChars('basicLatin')).toHaveLength(94);
    expect(resolveChars(undefined)).toEqual(resolveChars('essential'));
  });

  it('covers Portuguese accents', () => {
    for (const ch of ['ã', 'ç', 'Ã', 'Ê', 'õ']) expect(CHARSETS.portuguese).toContain(ch);
  });

  it('knows where characters sit on the metric lines', () => {
    expect(verticalClass('g')).toEqual({ top: 'xHeight', bottom: 'descender' });
    expect(verticalClass('A')).toEqual({ top: 'capHeight', bottom: 'baseline' });
    expect(verticalClass('d')).toEqual({ top: 'ascender', bottom: 'baseline' });
    expect(verticalClass('ç').bottom).toBe('baseline');
    expect(verticalClass('-').top).toBe('mid');
  });
});

describe('sheet layout', () => {
  it('lays out A4 and Letter pages inside the printable area', () => {
    for (const pageSize of ['A4', 'Letter']) {
      const t = templateLayout({ chars: 'basicLatin', pageSize });
      expect(t.width).toBe(PAGE_SIZES[pageSize].width);
      for (const page of t.pages) {
        for (const c of page.cells) {
          expect(c.x).toBeGreaterThanOrEqual(8 - 1e-9);
          expect(c.x + c.w).toBeLessThanOrEqual(t.width - 8 + 1e-9);
          expect(c.y).toBeGreaterThanOrEqual(t.marker.boxes[0].y + t.marker.size + t.marker.quiet - 1e-9);
          expect(c.y + c.h).toBeLessThanOrEqual(t.marker.boxes[3].y - t.marker.quiet + 1e-9);
        }
      }
      // the code row sits between the top markers, clear of both
      expect(t.code.x).toBeGreaterThan(t.marker.boxes[0].x + t.marker.size);
      expect(t.code.x + (t.code.bits + 2) * t.code.module).toBeLessThan(t.marker.boxes[1].x - t.marker.quiet);
    }
  });

  it('paginates large sets over several pages', () => {
    const t = templateLayout({ chars: ['basicLatin', 'portuguese'] });
    expect(t.pages.length).toBe(3);
    const all = t.pages.flatMap((p) => p.cells.map((c) => c.char));
    expect(all).toEqual(t.chars);
    expect(templateLayout({ chars: 'basicLatin', cols: 8, rows: 6 }).pages.length).toBe(2);
    expect(templateLayout({ chars: 'basicLatin', cols: 5, rows: 5 }).pages.length).toBe(4);
  });

  it('maps the font metrics onto every cell', () => {
    const t = templateLayout({ chars: 'abc' });
    const lines = Object.fromEntries(guideLines(t).map((g) => [g.name, g.y]));
    expect(lines.baseline).toBeCloseTo(t.cell.baseline, 9);
    expect(lines.xHeight).toBeCloseTo(t.cell.baseline - 500 / t.cell.unitsPerMm, 9);
    expect(lines.capHeight).toBeLessThan(lines.xHeight);
    expect(lines.descender).toBeGreaterThan(lines.baseline);
    expect(lines.descender).toBeLessThan(t.cell.height - t.cell.pad);
    // room above the cap height for accents
    expect(t.metrics.top).toBeGreaterThan(t.metrics.capHeight + 100);
    expect(guideLines(templateLayout({ chars: 'abc', guides: false }))).toEqual([]);
    expect(guideLines(templateLayout({ chars: 'abc', guides: { ascender: true } })).map((g) => g.name)).toContain('ascender');
  });

  it('gives the same id to the same options and a new id otherwise', () => {
    expect(templateLayout({ chars: 'abc' }).id).toBe(templateLayout({ chars: 'abc' }).id);
    expect(templateLayout({ chars: 'abc' }).id).not.toBe(templateLayout({ chars: 'abd' }).id);
    expect(templateLayout({ chars: 'abc' }).id).not.toBe(templateLayout({ chars: 'abc', pageSize: 'Letter' }).id);
  });

  it('rejects impossible options', () => {
    expect(() => templateLayout({ chars: '' })).toThrow(RangeError);
    expect(() => templateLayout({ chars: 'abc', cols: 1 })).toThrow(RangeError);
    expect(() => templateLayout({ chars: 'basicLatin', cols: 2, rows: 1 })).toThrow(/pages/);
    expect(() => templateLayout({ chars: 'abc', pageSize: /** @type {any} */ ('A5') })).toThrow(RangeError);
  });
});

describe('markers and page code', () => {
  it('uses marker codes that stay distinct under every rotation', () => {
    const rots = (c) => [c, rotateCode(c), rotateCode(rotateCode(c)), rotateCode(rotateCode(rotateCode(c)))];
    let min = 16;
    MARKER_CODES.forEach((a, i) => {
      const ra = rots(a);
      for (let r = 1; r < 4; r++) min = Math.min(min, popcount(a ^ ra[r]));
      MARKER_CODES.forEach((b, j) => {
        if (j > i) for (const rb of rots(b)) min = Math.min(min, popcount(a ^ rb));
      });
    });
    expect(min).toBeGreaterThanOrEqual(6);
    expect(rotateCode(rotateCode(rotateCode(rotateCode(0x1234))))).toBe(0x1234);
  });

  it('draws each marker with a full black border', () => {
    for (let id = 0; id < 4; id++) {
      const mods = new Set(markerModules(id).map(([x, y]) => y * 6 + x));
      for (let k = 0; k < 6; k++) {
        expect(mods.has(k)).toBe(true);
        expect(mods.has(30 + k)).toBe(true);
        expect(mods.has(k * 6)).toBe(true);
        expect(mods.has(k * 6 + 5)).toBe(true);
      }
    }
  });

  it('round trips the page code and detects corruption', () => {
    for (const [id, page, count] of [[0, 0, 1], [0xbeef, 3, 4], [0xffff, 14, 15]]) {
      const bits = encodePageCode(id, page, count);
      expect(bits).toHaveLength(32);
      expect(decodePageCode(bits)).toEqual({ id, page, count });
      for (const flip of [0, 9, 20, 31]) {
        const bad = bits.slice();
        bad[flip] ^= 1;
        expect(decodePageCode(bad)).toBeNull();
      }
    }
    expect(decodePageCode([1, 0])).toBeNull();
    // standard CRC-8 check value of "123456789"
    expect(crc8([...'123456789'].map((c) => c.charCodeAt(0)))).toBe(0xf4);
  });
});

describe('createTemplate output', () => {
  const tpl = createTemplate({ chars: ['lowercase', 'portuguese', '<&>'], cols: 6, title: 'My <hand> & font' });

  it('renders one standalone SVG per page', () => {
    expect(tpl.svgPages).toHaveLength(tpl.pages);
    expect(tpl.svg).toBe(tpl.svgPages[0]);
    for (const svg of tpl.svgPages) {
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">')).toBe(true);
      expect(svg.trim().endsWith('</svg>')).toBe(true);
      expect(svg).not.toMatch(/<[^>]*&(?!amp;|lt;|gt;|quot;)/);
    }
    expect(tpl.svg).toContain('My &lt;hand&gt; &amp; font');
    const labels = tpl.svgPages.join('').match(/<text[^>]*fill="rgb\(110,110,110\)"[^>]*>([^<]*)<\/text>/g);
    expect(labels).toHaveLength(tpl.template.chars.length);
    expect(tpl.svgPages.join('')).toContain('>&lt;</text>');
    // guide lines use the dropout colour
    expect(tpl.svg).toContain('stroke="rgb(159,216,238)"');
  });

  it('writes a valid multi page PDF', () => {
    const pdf = tpl.pdf;
    const text = Array.from(pdf, (b) => String.fromCharCode(b)).join('');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const startxref = Number(/startxref\n(\d+)/.exec(text)[1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const entries = text.slice(startxref).split('\n').filter((l) => / 00000 n $/.test(l));
    entries.forEach((line, i) => {
      const off = Number(line.slice(0, 10));
      expect(text.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
    expect(text).toContain(`/Count ${tpl.pages}`);
    expect(text.match(/\/Type \/Page /g)).toHaveLength(tpl.pages);
    // stream lengths match their content
    for (const m of text.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
      const start = m.index + m[0].length;
      expect(text.slice(start + Number(m[1]), start + Number(m[1]) + 10)).toBe('\nendstream');
    }
    // Latin-1 labels are octal escapes, PDF specials are escaped
    expect(text).toContain('(\\343)');
    expect(text).toContain('(<)');
  });

  it('estimates text widths and writes a minimal PDF', () => {
    expect(textWidthEm('MW')).toBeGreaterThan(textWidthEm('il'));
    const bytes = writePdf([[{ t: 'line', x1: 0, y1: 0, x2: 10, y2: 10, stroke: [0, 0, 0], sw: 1 }]], 100, 100);
    expect(bytes.length).toBeGreaterThan(300);
  });
});
