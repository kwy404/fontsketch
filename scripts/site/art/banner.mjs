import { mascotSVG } from './mascot.mjs';
import { text, measure } from './text.mjs';

export const THEME = {
  light: { bg: '#F8EFDC', bg2: '#F2E3C4', rule: '#B9B4E6', margin: '#E9A08F', ink: '#2A2770', ver: '#E4472B', soft: '#5A5690', chip: '#FFFDF6', chipLine: '#2A2770', card: '#FFFDF6', cardLine: '#D9C79F', mark: '#2A2770' },
  dark: { bg: '#16153A', bg2: '#1E1C4A', rule: '#3A378A', margin: '#7A3A35', ink: '#F4E9D2', ver: '#FF7A5C', soft: '#B9B5EC', chip: '#24225A', chipLine: '#8F8BE8', card: '#F4E9D2', cardLine: '#B9A77F', mark: '#2A2770' },
};

/** Nest an SVG document at a position. */
export function nest(svg, x, y, w, h) {
  const vb = /viewBox="([^"]+)"/.exec(svg)[1];
  return svg.replace(/<svg[^>]*>/, `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}">`).replace(/<title[^<]*<\/title>/, '');
}

export function sheetCard(t, x, y, rot, letters = 'abcdefghijkl', cols = 4, cell = 44) {
  const rows = Math.ceil(letters.length / cols);
  const W = cols * cell + 28, H = rows * cell + 40;
  let g = `<g transform="translate(${x} ${y}) rotate(${rot})">`;
  g += `<rect x="4" y="7" width="${W}" height="${H}" rx="6" fill="#1C1A4A" opacity=".14"/>`;
  g += `<rect width="${W}" height="${H}" rx="6" fill="${t.card}" stroke="${t.cardLine}" stroke-width="2"/>`;
  for (const [mx, my] of [[8, 8], [W - 18, 8], [8, H - 18], [W - 18, H - 18]]) g += `<rect x="${mx}" y="${my}" width="10" height="10" fill="${t.mark}"/>`;
  [...letters].forEach((ch, i) => {
    const cx = 14 + (i % cols) * cell, cy = 24 + Math.floor(i / cols) * cell;
    g += `<rect x="${cx}" y="${cy}" width="${cell - 4}" height="${cell - 4}" rx="3" fill="none" stroke="#B9B4E6" stroke-width="1.3"/>`;
    g += `<path d="M${cx + 4} ${cy + cell - 13}h${cell - 12}" stroke="#E9A08F" stroke-width="1" stroke-dasharray="3 3"/>`;
    g += text(ch, cell * 0.62, cx + (cell - 4) / 2, cy + cell - 13, '#2A2770', { anchor: 'middle' });
  });
  return g + '</g>';
}

export function bannerSVG(mode = 'light') {
  const t = THEME[mode];
  const W = 1280, H = 320;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="b${mode[0]}-t">
<title id="b${mode[0]}-t">fontsketch: draw, import or scan your handwriting into a real font</title>
<rect width="${W}" height="${H}" fill="${t.bg}"/>`;
  // ruled handwriting guidelines
  for (const [yy, dash, op] of [[85, '', 0.9], [118, '6 8', 0.8], [190, '', 1], [226, '6 8', 0.6], [252, '', 0.5]]) {
    s += `<path d="M0 ${yy}H${W}" stroke="${t.rule}" stroke-width="${yy === 190 ? 2 : 1.4}" ${dash ? `stroke-dasharray="${dash}"` : ''} opacity="${op}"/>`;
  }
  s += `<path d="M322 0V${H}" stroke="${t.margin}" stroke-width="2" opacity=".7"/>`;
  // mascot
  s += nest(mascotSVG(mode), 22, 6, 308, 308);
  // wordmark
  const size = 150;
  const fw = measure('font', size);
  s += text('font', size, 356, 190, t.ink);
  s += text('sketch', size, 356 + fw + 4, 190, t.ver);
  // a few editing nodes on the wordmark
  // tagline
  s += text('Draw, import or scan your handwriting into a real font.', 33, 362, 250, t.soft);
  // chips
  let cx = 362;
  for (const label of ['TTF', 'OTF', 'WOFF2', 'Variable', 'Hinting', 'Icon fonts']) {
    const w = measure(label, 22) + 26;
    s += `<rect x="${cx}" y="264" width="${w}" height="34" rx="17" fill="${t.chip}" stroke="${t.chipLine}" stroke-width="1.6"/>`;
    s += text(label, 22, cx + w / 2, 288, t.ink, { anchor: 'middle' });
    cx += w + 10;
  }
  // scanned sheet card on the right
  s += sheetCard(t, 1036, 52, 6, 'QuilHand', 4, 46);
  s += '</svg>';
  return s;
}
