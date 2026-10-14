// Atelier illustrations (640x400), light and dark.
import { readFileSync } from 'node:fs';
import { text, textD, measure, font } from './text.mjs';
import { broadNib, taper } from './lib.mjs';
import { PAL, headSVG } from './mascot.mjs';
import { nest } from './banner.mjs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { strokesToContours, contoursToSvgPath } = await import('../../../docs/assets/site/stroke.mjs');
const { buildQuillHand } = await import('../quill-hand.mjs');
const strokes = buildQuillHand().strokeData;

export const T = {
  light: { bg: '#FBF4E4', bg2: '#F3E5C6', paper: '#FFFDF6', line: '#2A2770', ink: '#2A2770', soft: '#6A66A8', faint: '#C9C4EC', ver: '#E4472B', gold: '#E2A93B', wood: '#C98B4E', woodD: '#9C6633', grid: '#E7D9B8', label: '#4C4890', shadow: 'rgba(28,26,74,.14)' },
  dark: { bg: '#17163A', bg2: '#201E4C', paper: '#2A2862', line: '#D4D1FF', ink: '#F1E6CF', soft: '#AAA6E6', faint: '#4A47A0', ver: '#FF7A5C', gold: '#F0BE5C', wood: '#8A5A32', woodD: '#5E3B1F', grid: '#2B2960', label: '#C9C6FF', shadow: 'rgba(0,0,0,.35)' },
};

const W = 640, H = 400;
const frame = (t, id, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${id}-t">
<title id="${id}-t">${title}</title>
<rect width="${W}" height="${H}" rx="22" fill="${t.bg}"/>
<g opacity=".7">${dots(t)}</g>
${body}
</svg>`;

function dots(t) {
  return `<defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1.2" fill="${t.grid}"/></pattern></defs><rect width="${W}" height="${H}" rx="22" fill="url(#dots)"/>`;
}

/** Word drawn from Quill Hand spines with a custom pen width. */
export function wordAt(word, size, x, y, penWidth, fill, swell = 20) {
  const s = size / 1000;
  let out = '', cx = 0;
  for (const ch of word) {
    const name = ch === ' ' ? 'space' : ch;
    const g = strokes[name];
    if (!g) { cx += 260; continue; }
    if (g.strokes.length) {
      const d = contoursToSvgPath(strokesToContours(g.strokes, { width: penWidth, swell, taper: 0.2 }));
      out += `<path transform="translate(${(x + cx * s).toFixed(1)} ${y}) scale(${s})" d="${d}" fill="${fill}"/>`;
    }
    cx += g.advance + (penWidth - 66) * 0.6;
  }
  return out;
}
export function wordWidth(word, size, penWidth) {
  let cx = 0;
  for (const ch of word) cx += (strokes[ch === ' ' ? 'space' : ch]?.advance ?? 260) + (penWidth - 66) * 0.6;
  return (cx * size) / 1000;
}

const label = (t, str, x, y, opts = {}) => text(str, opts.size || 17, x, y, opts.fill || t.label, opts);
const arrow = (t, x1, y1, x2, y2, col) => {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 9;
  const p1 = [x2 - h * Math.cos(a - 0.5), y2 - h * Math.sin(a - 0.5)], p2 = [x2 - h * Math.cos(a + 0.5), y2 - h * Math.sin(a + 0.5)];
  return `<path d="M${x1} ${y1}L${x2} ${y2}M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}L${x2} ${y2}L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}" fill="none" stroke="${col || t.soft}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
};
const card = (t, x, y, w, h, extra = '') => `<rect x="${x + 3}" y="${y + 6}" width="${w}" height="${h}" rx="12" fill="${t.shadow}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${t.paper}" stroke="${t.faint}" stroke-width="1.6" ${extra}/>`;
const node = (t, x, y, on = true) => on
  ? `<rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" fill="${t.paper}" stroke="${t.ver}" stroke-width="2"/>`
  : `<circle cx="${x}" cy="${y}" r="4.2" fill="${t.paper}" stroke="${t.ver}" stroke-width="2"/>`;
const quill = (mode, x, y, h) => nest(headSVG(mode), x, y, h * (228 / 304), h);

export const ART = {
  'scan-to-font': ['A phone photo of a handwriting sheet being flattened, cleaned and split into letters that become vector glyphs', (t, mode) => {
    let s = '';
    // tilted photo
    s += `<g transform="translate(44 70)"><rect x="0" y="0" width="170" height="262" rx="22" fill="${t.line}"/><rect x="10" y="26" width="150" height="206" rx="6" fill="#8F8A7A"/>`;
    s += `<path d="M24 52L148 40L156 214L18 222Z" fill="#F4EBD6"/>`;
    for (const [i, ch] of [...'abcdef'].entries()) {
      const cx = 40 + (i % 3) * 38, cy = 78 + Math.floor(i / 3) * 62;
      s += `<path d="M${cx - 6} ${cy - 14}h34v40h-34Z" fill="none" stroke="#B9B4E6" stroke-width="1.2" transform="skewY(-4)"/>`;
      s += text(ch, 30, cx + 11, cy + 18, '#2A2770', { anchor: 'middle', attrs: ' transform="skewY(-4)"' });
    }
    for (const [mx, my] of [[26, 54], [140, 44], [146, 204], [22, 212]]) s += `<rect x="${mx}" y="${my}" width="8" height="8" fill="#1C1A4A"/>`;
    s += `<circle cx="85" cy="246" r="7" fill="none" stroke="#8F8BE8" stroke-width="2"/></g>`;
    // steps
    const steps = ['flatten', 'clean', 'split', 'trace'];
    steps.forEach((st, i) => {
      const y = 92 + i * 58;
      s += `<circle cx="262" cy="${y}" r="15" fill="${i === 3 ? t.ver : t.paper}" stroke="${t.line}" stroke-width="2"/>`;
      s += text(String(i + 1), 18, 262, y + 6, i === 3 ? '#FFFDF6' : t.ink, { anchor: 'middle' });
      s += label(t, st, 286, y + 6);
      if (i < 3) s += `<path d="M262 ${y + 17}V${y + 41}" stroke="${t.faint}" stroke-width="2" stroke-dasharray="3 4"/>`;
    });
    s += arrow(t, 350, 200, 392, 200, t.ver);
    // vector glyph
    s += card(t, 404, 60, 196, 230);
    s += `<path d="M418 230H588M418 150H588" stroke="${t.faint}" stroke-width="1.4" stroke-dasharray="4 5"/>`;
    s += text('a', 210, 500, 230, t.ink, { anchor: 'middle', attrs: ` opacity=".92"` });
    {
      const g = font.glyphs.a, sc = 0.21, ox = 500 - (measure('a', 210) / 2), oy = 230;
      g.contours.forEach((c) => c.points.filter((p, i) => p.on && i % 5 === 0).forEach((p, i) => { if (i % 2 === 0) s += node(t, +(ox + p.x * sc).toFixed(1), +(oy - p.y * sc).toFixed(1), i % 4 === 0); }));
    }
    // type tiles
    [...'abc'].forEach((ch, i) => {
      const x = 430 + i * 52;
      s += `<rect x="${x}" y="312" width="44" height="50" rx="7" fill="${t.wood}" stroke="${t.woodD}" stroke-width="2"/>`;
      s += text(ch, 34, x + 22, 348, '#FFF7E6', { anchor: 'middle' });
    });
    return s;
  }],
  'glyph-anatomy': ['Glyph anatomy: ascender, cap height, x-height, baseline and descender lines around the letters Hg, with stem, bowl and counter labeled', (t) => {
    let s = '';
    const base = 268, k = 0.24;
    const lines = [['ascender', base - 770 * k], ['cap height', base - 700 * k], ['x-height', base - 480 * k], ['baseline', base], ['descender', base + 240 * k]];
    for (const [n, y] of lines) {
      s += `<path d="M150 ${y.toFixed(1)}H612" stroke="${n === 'baseline' ? t.ver : t.faint}" stroke-width="${n === 'baseline' ? 2.4 : 1.6}" ${n === 'baseline' ? '' : 'stroke-dasharray="6 6"'}/>`;
      s += label(t, n, 140, y + (n === 'ascender' ? -4 : n === 'cap height' ? 14 : 5), { anchor: 'end', size: 16 });
    }
    s += text('Hgx', 1000 * k, 190, base, t.ink);
    // callouts
    s += arrow(t, 222, 345, 214, 290, t.ver) + label(t, 'stem', 228, 360, { fill: t.ver });
    s += arrow(t, 420, 104, 400, 196, t.ver) + label(t, 'bowl', 410, 96, { fill: t.ver });
    s += arrow(t, 520, 352, 404, 232, t.ver) + label(t, 'counter', 492, 372, { fill: t.ver });
    s += arrow(t, 586, 120, 560, 200, t.ver) + label(t, 'terminal', 556, 112, { fill: t.ver });
    return s;
  }],
  'nib-strokes': ['Four writing tools and the strokes they make: broad nib, pointed pen, brush and monoline marker', (t, mode) => {
    const c = PAL[mode];
    let s = '';
    const rows = [['broad nib', 70], ['pointed pen', 160], ['brush', 250], ['monoline', 340]];
    const wave = (y) => [[150, y + 20], [210, y - 22], [270, y + 22], [330, y - 22], [390, y + 22], [450, y - 22], [510, y + 20], [580, y - 10]];
    rows.forEach(([n, y], i) => {
      s += label(t, n, 24, y + 6, { size: 18 });
      if (i === 0) s += `<path d="${broadNib(wave(y), 22, 35, { n: 160 })}" fill="${t.ink}"/>`;
      if (i === 1) s += `<path d="${taper(wave(y), (tt, tg) => 2.6 + 19 * Math.pow(Math.max(0, tg[1]), 1.4), { n: 120 })}" fill="${t.ink}"/>`;
      if (i === 2) s += `<path d="${taper(wave(y), (tt) => 3 + 16 * Math.pow(Math.sin(Math.PI * tt), 0.8), { n: 120 })}" fill="${t.ink}"/>`;
      if (i === 3) s += `<path d="M150 ${y + 20}C190 ${y - 40} 230 ${y - 40} 270 ${y + 22}S350 ${y + 60} 390 ${y + 22}S470 ${y - 40} 510 ${y + 20}S560 ${y + 10} 580 ${y - 10}" fill="none" stroke="${t.ver}" stroke-width="9" stroke-linecap="round"/>`;
    });
    void c;
    return s;
  }],
  'type-case': ['A wooden type case drawer with letters in its compartments and new glyphs flying in', (t) => {
    let s = '';
    s += `<rect x="60" y="150" width="520" height="216" rx="14" fill="${t.wood}" stroke="${t.woodD}" stroke-width="3"/>`;
    const cols = 8, rows = 3, cw = 60, ch = 64;
    const letters = 'abcdefghijklmnopqrstuvwx';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = 76 + c * cw, y = 164 + r * ch;
      s += `<rect x="${x}" y="${y}" width="${cw - 8}" height="${ch - 8}" rx="5" fill="${t.woodD}" opacity=".55"/>`;
      const l = letters[r * cols + c];
      if ((r * cols + c) % 5 !== 3) s += text(l, 36, x + (cw - 8) / 2, y + 42, '#FFF3DC', { anchor: 'middle' });
    }
    // flying letters
    for (const [l, x, y, rot] of [['Q', 140, 96, -12], ['u', 250, 60, 8], ['i', 360, 90, -6], ['l', 450, 54, 10], ['l', 530, 104, -10]]) {
      s += `<g transform="rotate(${rot} ${x} ${y})"><rect x="${x - 24}" y="${y - 36}" width="48" height="54" rx="8" fill="${t.paper}" stroke="${t.line}" stroke-width="2"/>${text(l, 38, x, y + 8, t.ink, { anchor: 'middle' })}</g>`;
    }
    s += `<path d="M120 140C150 126 140 120 150 110M520 140C510 130 520 124 528 118" fill="none" stroke="${t.ver}" stroke-width="2" stroke-dasharray="3 5" stroke-linecap="round"/>`;
    return s;
  }],
  'variable-weight': ['The word Quill morphing from a thin weight to a black weight along a weight axis slider', (t) => {
    let s = '';
    const weights = [[24, 100], [52, 300], [80, 500], [112, 700], [146, 900]];
    weights.forEach(([pw, wv], i) => {
      const y = 70 + i * 58;
      s += wordAt('Quill', 46, 60, y, pw, i === 4 ? t.ver : t.ink);
      s += label(t, String(wv), 250, y - 8, { size: 16 });
    });
    // big sample + slider
    s += wordAt('Aa', 190, 330, 260, 110, t.ink);
    s += `<path d="M330 330H600" stroke="${t.line}" stroke-width="4" stroke-linecap="round"/><circle cx="520" cy="330" r="13" fill="${t.ver}" stroke="${t.line}" stroke-width="3"/>`;
    s += label(t, 'wght 100', 330, 364, { size: 16 }) + label(t, '900', 600, 364, { size: 16, anchor: 'end' });
    return s;
  }],
  'hinting-grid': ['Hinting shown on a pixel grid: the stems of the letter n snap to whole pixels so it renders crisp at small sizes', (t) => {
    let s = '';
    const grid = (ox, snapped) => {
      let g = '';
      const px = 22, cols = 10, rows = 11;
      const on = snapped
        ? ['0000000000', '0000000000', '0000000000', '1101111000', '1110011100', '1100001100', '1100001100', '1100001100', '1100001100', '1100001100', '0000000000']
        : ['0000000000', '0000000000', '0000000000', '1a01a11a00', '11a00a1a00', '1a0000a1a0', '1a0000a1a0', '1a0000a1a0', '1a0000a1a0', '1a0000a1a0', '0000000000'];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const v = on[r][c];
        const f = v === '1' ? t.line : v === 'a' ? t.soft : t.paper;
        g += `<rect x="${ox + c * px}" y="${60 + r * px}" width="${px}" height="${px}" fill="${f}" stroke="${t.faint}" stroke-width="1"/>`;
      }
      return g;
    };
    s += grid(50, false) + grid(370, true);
    s += label(t, 'no hinting: blurry stems', 50, 330, { size: 17 }) + label(t, 'hinted: stems on the grid', 370, 330, { size: 17, fill: t.ver });
    s += arrow(t, 290, 180, 350, 180, t.ver);
    s += `<path d="M370 126V302M414 126V302M480 126V302" stroke="${t.ver}" stroke-width="2" stroke-dasharray="4 4"/>`;
    s += label(t, 'n at 11 px', 50, 46, { size: 16 }) + label(t, 'n at 11 px', 370, 46, { size: 16 });
    return s;
  }],
  'kerning-pair': ['Kerning the pair AV: sidebearing boxes before and after, with the V sliding closer to the A', (t) => {
    let s = '';
    const k = 0.22, base = 290;
    const box = (x, w, col) => `<rect x="${x}" y="${base - 700 * k}" width="${(w * k).toFixed(1)}" height="${700 * k}" fill="none" stroke="${col}" stroke-width="1.6" stroke-dasharray="5 5"/>`;
    s += `<path d="M30 ${base}H610" stroke="${t.faint}" stroke-width="1.4"/>`;
    s += label(t, 'before', 50, 80, { size: 18 });
    s += box(50, 580, t.faint) + box(50 + 580 * k, 560, t.faint);
    s += text('A', 1000 * k, 50, base, t.ink) + text('V', 1000 * k, 50 + 580 * k, base, t.ink);
    s += `<path d="M330 70V330" stroke="${t.faint}" stroke-width="1.4"/>`;
    s += label(t, 'after, kern -60', 356, 80, { size: 18, fill: t.ver });
    const ax = 356, vx = 356 + (580 - 60) * k;
    s += box(ax, 580, t.faint) + box(vx, 560, t.ver);
    s += text('A', 1000 * k, ax, base, t.ink) + text('V', 1000 * k, vx, base, t.ink);
    s += arrow(t, vx + 60, base + 30, vx + 4, base + 30, t.ver);
    s += label(t, 'To  Ty  AV  Wa  LT', 50, 362, { size: 22 });
    return s;
  }],
  'export-cards': ['Three cards for TTF, OTF and WOFF2 font files fanned out, each with an Aa specimen', (t) => {
    let s = '';
    const cards = [['TTF', -10, 150], ['OTF', 0, 320], ['WOFF2', 10, 490]];
    for (const [n, rot, x] of cards) {
      s += `<g transform="rotate(${rot} ${x} 220)">`;
      s += card(t, x - 85, 80, 170, 240);
      s += text('Aa', 92, x, 216, t.ink, { anchor: 'middle' });
      s += `<rect x="${x - 50}" y="248" width="100" height="40" rx="20" fill="${n === 'WOFF2' ? t.ver : t.line}"/>`;
      s += text(n, 24, x, 276, n === 'WOFF2' ? '#FFFDF6' : t.bg, { anchor: 'middle' });
      s += '</g>';
    }
    s += label(t, '.ttf   .otf   .woff   .woff2   @font-face', 320, 372, { anchor: 'middle', size: 19 });
    return s;
  }],
  'icon-font': ['SVG icons turning into an icon font: each icon gets a Private Use Area code point and a CSS class', (t) => {
    let s = '';
    const icons = [
      `<path d="M0 -14L4 -4H15L6 3L9 14L0 7L-9 14L-6 3L-15 -4H-4Z"/>`,
      `<path d="M0 12C-16 2 -14 -12 -6 -12C-2 -12 0 -8 0 -8C0 -8 2 -12 6 -12C14 -12 16 2 0 12Z"/>`,
      `<path d="M-12 -12H12V12H-12Z" fill="none" stroke-width="4"/>`,
      `<circle r="12" fill="none" stroke-width="4"/>`,
    ];
    icons.forEach((ic, i) => {
      const x = 90, y = 78 + i * 76;
      s += card(t, x - 40, y - 30, 80, 60);
      s += `<g transform="translate(${x} ${y})" fill="${t.ink}" stroke="${t.ink}">${ic}</g>`;
      s += label(t, ['star', 'heart', 'square', 'circle'][i] + '.svg', 140, y + 6, { size: 16 });
    });
    s += arrow(t, 250, 200, 300, 200, t.ver);
    s += card(t, 320, 60, 280, 280);
    icons.forEach((ic, i) => {
      const x = 380 + (i % 2) * 140, y = 120 + Math.floor(i / 2) * 120;
      s += `<g transform="translate(${x} ${y}) scale(1.4)" fill="${t.ver}" stroke="${t.ver}">${ic}</g>`;
      s += label(t, `U+E00${i}`, x, y + 44, { anchor: 'middle', size: 15 });
    });
    s += label(t, '.icon-star:before { content: "\\e000" }', 320, 376, { size: 15 });
    return s;
  }],
  'svg-to-glyph': ['An SVG path file becoming a glyph placed in the em square between baseline and cap height', (t) => {
    let s = '';
    s += card(t, 40, 70, 250, 250);
    const code = ['<svg viewBox="0 0 24 24">', '  <path d="M4 20', '    L12 4 L20 20', '    M8 13 H16"/>', '</svg>'];
    code.forEach((ln, i) => { s += text(ln, 17, 58, 112 + i * 34, i === 0 || i === 4 ? t.soft : t.ink); });
    s += arrow(t, 304, 200, 352, 200, t.ver);
    s += card(t, 368, 50, 232, 300);
    const base = 290, k = 0.25;
    s += `<path d="M378 ${base}H590M378 ${base - 700 * k}H590" stroke="${t.faint}" stroke-width="1.6" stroke-dasharray="5 5"/>`;
    s += label(t, 'cap height', 590, base - 700 * k - 8, { anchor: 'end', size: 14 }) + label(t, 'baseline', 590, base + 22, { anchor: 'end', size: 14, fill: t.ver });
    s += `<path d="M420 ${base}L484 ${base - 175}L548 ${base}M452 ${base - 72}H516" fill="none" stroke="${t.ink}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`;
    for (const [x, y] of [[420, base], [484, base - 175], [548, base], [452, base - 72], [516, base - 72]]) s += node(t, x, y);
    return s;
  }],
  'pen-tool': ['The bezier pen tool drawing the letter S with on-curve points and off-curve handles', (t, mode) => {
    let s = '';
    const S = 'M420 96C380 64 300 60 262 100C222 142 250 186 320 204C392 222 430 256 404 304C376 352 288 352 240 314';
    s += `<path d="${S}" fill="none" stroke="${t.ink}" stroke-width="30" stroke-linecap="round"/>`;
    s += `<path d="${S}" fill="none" stroke="${t.paper}" stroke-width="2" stroke-dasharray="6 6" opacity=".9"/>`;
    const handles = [[[420, 96], [380, 64]], [[262, 100], [300, 60]], [[262, 100], [222, 142]], [[320, 204], [250, 186]], [[320, 204], [392, 222]], [[404, 304], [430, 256]], [[404, 304], [376, 352]], [[240, 314], [288, 352]]];
    for (const [[x1, y1], [x2, y2]] of handles) s += `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${t.ver}" stroke-width="1.8"/>` + node(t, x2, y2, false);
    for (const [x, y] of [[420, 96], [262, 100], [320, 204], [404, 304], [240, 314]]) s += node(t, x, y);
    // nib cursor
    s += `<g transform="translate(240 314) rotate(-145)"><path d="M0 0L-9 20C-11 27-11 34-11 40L11 40C11 34 11 27 9 20Z" fill="${t.gold}" stroke="${t.line}" stroke-width="2.4" stroke-linejoin="round"/><path d="M0 4V24" stroke="${t.line}" stroke-width="2"/><circle cy="26" r="2.6" fill="${t.line}"/><path d="M-12 40h24v14h-24Z" fill="${t.faint}" stroke="${t.line}" stroke-width="2.4"/></g>`;
    s += label(t, 'corner', 470, 100, { size: 16 }) + label(t, 'smooth', 200, 220, { size: 16 }) + label(t, 'handle', 452, 260, { size: 16, fill: t.ver });
    s += quill(mode, 30, 230, 150);
    return s;
  }],
  'metrics-ruler': ['Font metrics on a ruler: units per em, advance width and left and right sidebearings of a glyph', (t) => {
    let s = '';
    const base = 300, k = 0.3, top = base - 800 * k, bot = base + 200 * k;
    s += `<rect x="40" y="${top}" width="34" height="${bot - top}" rx="4" fill="${t.gold}" stroke="${t.woodD}" stroke-width="2"/>`;
    for (let u = -200; u <= 800; u += 100) {
      const y = base - u * k;
      s += `<path d="M74 ${y}h-${u % 500 === 0 ? 16 : 9}" stroke="${t.woodD}" stroke-width="2"/>`;
      if (u % 200 === 0 && u > -200 && u < 800) s += text(String(u), 12, 52, y + 4, t.woodD, { anchor: 'middle' });
    }
    const gx = 170, adv = 470;
    s += `<rect x="${gx}" y="${top}" width="${adv * k}" height="${bot - top}" fill="none" stroke="${t.soft}" stroke-width="1.8" stroke-dasharray="6 6"/>`;
    s += `<path d="M84 ${base}H${gx + adv * k + 40}" stroke="${t.ver}" stroke-width="2"/><path d="M84 ${base - 480 * k}H${gx + adv * k + 40}" stroke="${t.faint}" stroke-width="1.6" stroke-dasharray="4 5"/>`;
    s += text('a', 1000 * k, gx, base, t.ink);
    const lsb = gx + 50 * k + 6, rsb = gx + 432 * k + 10;
    s += `<path d="M${lsb} ${base + 6}V${base + 40}M${rsb} ${base + 6}V${base + 40}" stroke="${t.ver}" stroke-width="1.6"/>`;
    s += arrow(t, lsb, base + 30, gx, base + 30, t.ver) + label(t, 'LSB', gx - 2, base + 52, { size: 14, fill: t.ver, anchor: 'end' });
    s += arrow(t, rsb, base + 30, gx + adv * k, base + 30, t.ver) + label(t, 'RSB', gx + adv * k + 4, base + 52, { size: 14, fill: t.ver });
    s += label(t, 'advance width 470', gx, top - 10, { size: 15 });
    s += label(t, 'x-height', gx + adv * k + 44, base - 480 * k + 5, { size: 14 }) + label(t, 'baseline', gx + adv * k + 44, base + 5, { size: 14, fill: t.ver });
    s += card(t, 400, 80, 200, 150);
    s += label(t, 'units per em  1000', 416, 116, { size: 16 }) + label(t, 'ascender  800', 416, 146, { size: 15 }) + label(t, 'x-height  480', 416, 172, { size: 15 }) + label(t, 'descender  -200', 416, 198, { size: 15 });
    return s;
  }],
};

export function artSVG(name, mode) {
  const t = T[mode];
  const [title, fn] = ART[name];
  return frame(t, `${name}-${mode[0]}`, title, fn(t, mode));
}
void measure; void textD; void wordWidth;
