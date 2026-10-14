// CSS helpers: @font-face rules for fonts made with fontsketch.

const FORMATS = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };

/** @param {string} s */
function cssString(s) {
  return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ')}"`;
}

/**
 * Builds an `@font-face` rule. `url` may be one URL or a list of
 * `{ url, format }` sources (the format is guessed from the file extension
 * when missing). Variable fonts get a weight range from their `wght` axis.
 * @param {import('./model.mjs').Font} font
 * @param {string | Array<string | { url: string, format?: string }>} url
 * @param {{ family?: string, display?: string, weight?: number | string, style?: string, unicodeRange?: string, variable?: boolean }} [options]
 * @returns {string}
 */
export function cssFontFace(font, url, options = {}) {
  const sources = (Array.isArray(url) ? url : [url]).map((s) => (typeof s === 'string' ? { url: s } : s));
  const src = sources.map((s) => {
    const ext = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(s.url)?.[1]?.toLowerCase() ?? '';
    const format = s.format || FORMATS[ext];
    return `url(${cssString(s.url)})${format ? ` format(${cssString(format)})` : ''}`;
  }).join(',\n       ');
  const wght = (font.axes || []).find((a) => a.tag === 'wght');
  const variable = options.variable ?? !!(wght && font.masters?.length);
  const weight = options.weight ?? (variable && wght ? `${wght.min} ${wght.max}` : font.meta.weightClass ?? weightOf(font.meta.style));
  const italic = /italic|oblique/i.test(font.meta.style || '') || (font.meta.italicAngle || 0) !== 0;
  const lines = [
    '@font-face {',
    `  font-family: ${cssString(options.family || font.meta.family)};`,
    `  src: ${src};`,
    `  font-weight: ${weight};`,
    `  font-style: ${options.style || (italic ? 'italic' : 'normal')};`,
    `  font-display: ${options.display || 'swap'};`,
  ];
  if (options.unicodeRange) lines.push(`  unicode-range: ${options.unicodeRange};`);
  lines.push('}');
  return lines.join('\n');
}

/** @param {string} style */
function weightOf(style = '') {
  const s = style.toLowerCase().replace(/[\s_-]/g, '');
  if (/thin|hairline/.test(s)) return 100;
  if (/extralight|ultralight/.test(s)) return 200;
  if (/light/.test(s)) return 300;
  if (/medium/.test(s)) return 500;
  if (/semibold|demibold/.test(s)) return 600;
  if (/extrabold|ultrabold/.test(s)) return 800;
  if (/black|heavy/.test(s)) return 900;
  if (/bold/.test(s)) return 700;
  return 400;
}

/**
 * Compact `unicode-range` value for the characters a font maps.
 * @param {import('./model.mjs').Font} font
 */
export function unicodeRange(font) {
  const codes = [...new Set(Object.values(font.glyphs).flatMap((g) => g.unicodes || []))].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < codes.length;) {
    let j = i;
    while (j + 1 < codes.length && codes[j + 1] === codes[j] + 1) j++;
    const hex = (c) => c.toString(16).toUpperCase().padStart(4, '0');
    parts.push(i === j ? `U+${hex(codes[i])}` : `U+${hex(codes[i])}-${hex(codes[j])}`);
    i = j + 1;
  }
  return parts.join(', ');
}
