// Feature icon set, 48x48, duotone: ink line, parchment fill, vermilion accent.
import { textD } from './text.mjs';

export const ICON_THEME = {
  light: { line: '#2A2770', fill: '#F6E7C8', acc: '#E4472B', paper: '#FFFDF6', soft: '#B9B4E6' },
  dark: { line: '#D4D1FF', fill: '#2E2B6E', acc: '#FF7A5C', paper: '#3A3780', soft: '#6D69C9' },
  css: { line: 'var(--ic-line)', fill: 'var(--ic-fill)', acc: 'var(--ic-acc)', paper: 'var(--ic-paper)', soft: 'var(--ic-soft)' },
};

const L = (c, w = 2.6) => `stroke="${c.line}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

export const ICONS = {
  draw: ['Draw glyphs freehand', (c) => `
<path d="M8 36C12 22 20 16 24 22C28 28 20 34 26 34C32 34 34 20 40 14" fill="none" stroke="${c.acc}" stroke-width="3.2" stroke-linecap="round"/>
<path d="M30 40L40 30L44 34L34 44Z" fill="${c.fill}" ${L(c)}/>
<path d="M30 40L27 46L34 44" fill="${c.line}" ${L(c, 2)}/>`],
  'pen-tool': ['Bezier pen tool', (c) => `
<path d="M24 6L36 24L30 40H18L12 24Z" fill="${c.fill}" ${L(c)}/>
<path d="M24 6V26" ${L(c, 2.2)}/><circle cx="24" cy="28" r="3" fill="${c.acc}" ${L(c, 2)}/>
<path d="M17 44H31" ${L(c)}/>
<path d="M4 14H12M36 14H44" stroke="${c.acc}" stroke-width="2.2" stroke-linecap="round"/>
<rect x="2" y="12" width="4" height="4" fill="${c.paper}" stroke="${c.acc}" stroke-width="1.8"/><rect x="42" y="12" width="4" height="4" fill="${c.paper}" stroke="${c.acc}" stroke-width="1.8"/>`],
  'import-svg': ['Import SVG', (c) => `
<path d="M12 6H30L38 14V42H12Z" fill="${c.paper}" ${L(c)}/>
<path d="M30 6V14H38" fill="${c.fill}" ${L(c)}/>
<path d="M17 34C19 24 31 24 33 34" fill="none" stroke="${c.acc}" stroke-width="2.6" stroke-linecap="round"/>
<rect x="15" y="32" width="5" height="5" fill="${c.paper}" stroke="${c.acc}" stroke-width="2"/><rect x="30" y="32" width="5" height="5" fill="${c.paper}" stroke="${c.acc}" stroke-width="2"/>
<path d="M17 19H27" ${L(c, 2.2)}/><path d="M25 16L28 19L25 22" fill="none" ${L(c, 2.2)}/>`],
  'image-trace': ['Trace images to vectors', (c) => `
<rect x="5" y="9" width="38" height="30" rx="4" fill="${c.fill}" ${L(c)}/>
<circle cx="15" cy="18" r="3.5" fill="${c.acc}"/>
<path d="M5 34L17 24L25 31L31 26L43 35" fill="none" ${L(c)} stroke-dasharray="0.1 5"/>
<path d="M24 39V30L31 26L43 35" fill="none" stroke="${c.acc}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="29" y="24" width="4.5" height="4.5" fill="${c.paper}" stroke="${c.acc}" stroke-width="2"/>`],
  'handwriting-sheet': ['Printable handwriting sheet', (c) => `
<rect x="8" y="4" width="32" height="40" rx="3" fill="${c.paper}" ${L(c)}/>
<rect x="11" y="7" width="4" height="4" fill="${c.line}"/><rect x="33" y="7" width="4" height="4" fill="${c.line}"/><rect x="11" y="37" width="4" height="4" fill="${c.line}"/><rect x="33" y="37" width="4" height="4" fill="${c.line}"/>
<path d="M14 15H34V33H14ZM24 15V33M14 24H34" fill="none" stroke="${c.soft}" stroke-width="1.6"/>
<path d="${textD('a', 11, 19, 22, { anchor: 'middle' })}" fill="${c.acc}"/><path d="${textD('b', 11, 29, 22, { anchor: 'middle' })}" fill="${c.line}"/><path d="${textD('c', 11, 19, 31, { anchor: 'middle' })}" fill="${c.line}"/>`],
  camera: ['Scan with your phone camera', (c) => `
<path d="M5 16a4 4 0 0 1 4-4h6l3-4h12l3 4h6a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" fill="${c.fill}" ${L(c)}/>
<circle cx="24" cy="26" r="9" fill="${c.paper}" ${L(c)}/>
<path d="M${textD('A', 12, 24, 30.5, { anchor: 'middle' }).slice(1)}" fill="${c.acc}"/>
<circle cx="37" cy="17" r="1.8" fill="${c.acc}"/>`],
  kerning: ['Kerning pairs and classes', (c) => `
<path d="M5 36L13 12L21 36M8 28H18" fill="none" ${L(c, 3)}/>
<path d="M27 12L35 36L43 12" fill="none" ${L(c, 3)}/>
<path d="M18 43H30" stroke="${c.acc}" stroke-width="2.4" stroke-linecap="round"/><path d="M21 40L18 43L21 46M27 40L30 43L27 46" fill="none" stroke="${c.acc}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M24 6V40" stroke="${c.acc}" stroke-width="1.6" stroke-dasharray="2 3"/>`],
  hinting: ['Automatic TrueType hinting', (c) => {
    let s = '';
    const ring = ['01110', '10001', '10001', '10001', '01110'];
    ring.forEach((row, y) => [...row].forEach((v, x) => {
      s += `<rect x="${4 + x * 8}" y="${4 + y * 8}" width="8" height="8" fill="${v === '1' ? c.line : c.paper}" stroke="${c.soft}" stroke-width="1"/>`;
    }));
    return s + `<ellipse cx="24" cy="24" rx="14" ry="15" fill="none" stroke="${c.acc}" stroke-width="2.6"/>`;
  }],
  'variable-font': ['Variable weight axis', (c) => `
<circle cx="12" cy="22" r="7" fill="none" stroke="${c.line}" stroke-width="1.5"/><path d="M19 14V30" stroke="${c.line}" stroke-width="1.5" stroke-linecap="round"/>
<path d="M30 14a8 8 0 1 0 0 16a8 8 0 1 0 0-16Zm0 4.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7Z" fill="${c.line}"/><path d="M38 14V30" stroke="${c.line}" stroke-width="5" stroke-linecap="round"/>
<path d="M6 40H42" ${L(c, 2.6)}/><circle cx="30" cy="40" r="4.5" fill="${c.acc}" ${L(c, 2)}/>`],
  export: ['Export TTF, OTF, WOFF and WOFF2', (c) => `
<path d="M8 30V40H40V30" fill="none" ${L(c)}/>
<path d="M14 18H34V34H14Z" fill="${c.fill}" ${L(c)}/>
<path d="M${textD('Aa', 11, 24, 30, { anchor: 'middle' }).slice(1)}" fill="${c.line}"/>
<path d="M24 4V14M19 9L24 4L29 9" fill="none" stroke="${c.acc}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`],
  'icon-font': ['SVG icons to icon font', (c) => `
<rect x="5" y="5" width="17" height="17" rx="4" fill="${c.fill}" ${L(c)}/><rect x="26" y="5" width="17" height="17" rx="4" fill="${c.fill}" ${L(c)}/>
<rect x="5" y="26" width="17" height="17" rx="4" fill="${c.fill}" ${L(c)}/><rect x="26" y="26" width="17" height="17" rx="4" fill="${c.acc}" ${L(c)}/>
<path d="M13.5 9.5L15.2 13H19L16 15.3L17 19L13.5 16.8L10 19L11 15.3L8 13H11.8Z" fill="${c.acc}"/>
<path d="M34.5 18.5C29 15 29.5 10 32 10C33.5 10 34.5 11.5 34.5 11.5C34.5 11.5 35.5 10 37 10C39.5 10 40 15 34.5 18.5Z" fill="${c.line}"/>
<circle cx="13.5" cy="34.5" r="4.5" fill="none" ${L(c, 2.4)}/>
<path d="M30 34.5H39M34.5 30V39" stroke="${c.paper}" stroke-width="2.6" stroke-linecap="round"/>`],
  autosave: ['Autosave in your browser', (c) => `
<path d="M10 6H32L40 14V42H10Z" fill="${c.fill}" ${L(c)}/>
<path d="M16 6V16H30V6" fill="${c.paper}" ${L(c)}/>
<path d="M17 34a8 8 0 1 0 2.5-6" fill="none" stroke="${c.acc}" stroke-width="2.6" stroke-linecap="round"/>
<path d="M18 23V28.5H23.5" fill="none" stroke="${c.acc}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`],
};

export function iconSVG(name, mode) {
  const c = ICON_THEME[mode];
  const [title, fn] = ICONS[name];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img" aria-label="${title}">${fn(c).replace(/\n/g, '')}</svg>`;
}

/** Icons as a sprite of symbols colored by CSS custom properties. */
export function iconSprite() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.keys(ICONS).map((n) => `<symbol id="f-${n}" viewBox="0 0 48 48">${ICONS[n][1](ICON_THEME.css).replace(/\n/g, '')}</symbol>`).join('')}</svg>`;
}
