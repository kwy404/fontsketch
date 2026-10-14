// Gallery cards (home and gallery page) and the gallery page itself.
import { SITE, esc } from './layout.mjs';
import { ICONS } from './gallery-fonts.mjs';

export const FONTS = [
  {
    id: 'quill-hand', family: 'Quill Hand', file: 'quill-hand', kind: { en: 'Handwriting', pt: 'Manuscrita' },
    made: { en: 'Pen strokes drawn on the fontsketch stage, expanded with a soft felt pen, accents built from components.', pt: 'Traços de caneta desenhados no estúdio do fontsketch, com acentos montados por componentes.' },
    sample: { en: 'Ação! Handwriting that types itself.', pt: 'Ação! Sua letra virando fonte.' },
    chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&?!àãçéêíóõú',
  },
  {
    id: 'quill-hand-variable', family: 'Quill Hand Variable', file: 'quill-hand-variable', variable: true, kind: { en: 'Variable, wght 100 to 900', pt: 'Variável, wght 100 a 900' },
    made: { en: 'The same strokes expanded with a thin and a heavy pen: two compatible masters, one variable font file.', pt: 'Os mesmos traços com uma caneta fina e uma grossa: dois masters compatíveis, um arquivo de fonte variável.' },
    sample: { en: 'From Thin to Black', pt: 'Do Thin ao Black' },
    chars: 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz',
  },
  {
    id: 'compass', family: 'Compass Display', file: 'compass-display', kind: { en: 'Geometric display', pt: 'Display geométrica' },
    made: { en: 'Rings, bars and arcs placed with the fontsketch API, with lowercase mapped to the capitals.', pt: 'Anéis, barras e arcos montados com a API do fontsketch, com minúsculas apontando para as maiúsculas.' },
    sample: { en: 'GEOMETRY WITH A COMPASS', pt: 'GEOMETRIA DE COMPASSO' },
    chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&?!',
  },
  {
    id: 'icons', family: 'Atelier Icons', file: 'atelier-icons', icons: true, kind: { en: 'Icon font', pt: 'Fonte de ícones' },
    made: { en: 'Sixteen icons mapped to the Private Use Area from U+E000, with a CSS class for each one.', pt: 'Dezesseis ícones na Private Use Area a partir de U+E000, com uma classe CSS para cada um.' },
    sample: { en: '', pt: '' },
    chars: '',
  },
];

const L = {
  en: { size: 'Size', weight: 'Weight', type: 'Type to test', glyphs: 'glyphs', copy: 'Copy CSS', title: 'Font gallery: free fonts made with fontsketch', desc: 'Free fonts made with fontsketch: a handwriting font, a variable weight font, a geometric display face and an icon font, each with a live type tester and downloads.', kicker: 'Gallery', h1: 'Fonts made with fontsketch', lede: 'Four fonts built with the fontsketch engine, free to download under the MIT license. Each one shows a different way in: pen strokes, a variable weight axis, geometric shapes and SVG icons.', home: 'Home', how: 'How it was made', all: 'Every glyph' },
  pt: { size: 'Tamanho', weight: 'Peso', type: 'Digite para testar', glyphs: 'glifos', copy: 'Copiar CSS', title: '', desc: '', kicker: '', h1: '', lede: '', home: 'Início', how: 'Como foi feita', all: 'Todos os glifos' },
};

export function fontFaces(R, sizes) {
  return `<style>${FONTS.map((f) => (sizes[f.file] ? `@font-face{font-family:'${f.family}';src:url('${R}assets/fonts/${f.file}.woff2') format('woff2'),url('${R}assets/fonts/${f.file}.ttf') format('truetype');font-display:swap${f.variable ? ';font-weight:100 900' : ''}}` : '')).join('')}</style>`;
}

function dlLinks(R, f, sizes) {
  return ['woff2', 'ttf', 'otf', 'woff'].filter((x) => sizes[f.file]?.[x]).map((x) => `<a class="dl-chip" href="${R}assets/fonts/${f.file}.${x}" download><svg class="ic" aria-hidden="true"><use href="#i-download"/></svg>${x.toUpperCase()}<small>${(sizes[f.file][x] / 1024).toFixed(1)} kB</small></a>`).join('');
}

export function galleryCards(R, lang, sizes, { full = false } = {}) {
  const t = L[lang];
  return `<div class="fonts${full ? ' fonts-full' : ''}">${FONTS.map((f) => {
    const count = sizes[f.file]?.glyphs || 0;
    if (f.icons) {
      return `<article class="font-card font-icons" id="${f.id}">
  <header class="fc-head"><h3>${f.family}</h3><p class="fc-kind">${f.kind[lang]} · ${ICONS.length} ${t.glyphs}</p></header>
  <ul class="icon-grid">${ICONS.map(([name, label], i) => `<li><span class="icon-glyph" aria-hidden="true">&#x${(0xe000 + i).toString(16)};</span><code>.at-${name}</code><small>U+${(0xe000 + i).toString(16).toUpperCase()}</small><span class="sr-only">${label}</span></li>`).join('')}</ul>
  <p class="fc-made">${f.made[lang]}</p>
  <div class="fc-dl">${dlLinks(R, f, sizes)}</div>
</article>`;
    }
    return `<article class="font-card" id="${f.id}" v-data="{ size: ${f.variable ? 64 : 56}, wght: 400 }">
  <header class="fc-head"><h3>${f.family}</h3><p class="fc-kind">${f.kind[lang]}${count ? ` · ${count} ${t.glyphs}` : ''}</p></header>
  <p class="tester" contenteditable="true" spellcheck="false" role="textbox" aria-multiline="true" aria-label="${t.type}: ${f.family}" :style="'font-size:' + size + 'px;font-variation-settings:&quot;wght&quot; ' + wght" style="font-family:'${f.family}',cursive;font-size:${f.variable ? 64 : 56}px">${esc(f.sample[lang])}</p>
  <div class="fc-controls"><label><span>${t.size}</span><input type="range" min="20" max="140" v-model.number="size" aria-label="${t.size}"></label>${f.variable ? `<label><span>${t.weight} <output v-text="wght">400</output></span><input type="range" min="100" max="900" step="1" v-model.number="wght" aria-label="${t.weight}"></label>` : ''}</div>
  ${full ? `<details class="fc-all"><summary>${t.all}</summary><p class="glyph-wall" style="font-family:'${f.family}',cursive">${esc(f.chars)}</p></details>` : ''}
  <p class="fc-made">${f.made[lang]}</p>
  <div class="fc-dl">${dlLinks(R, f, sizes)}</div>
</article>`;
  }).join('\n')}</div>`;
}

export function galleryBody(R, sizes, code) {
  const t = L.en;
  return `<div class="guide-wrap">
<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${R}">${t.home}</a></li><li aria-current="page">Gallery</li></ol></nav>
<header class="index-head"><p class="kicker">${t.kicker}</p><h1>${t.h1}</h1><p class="lede">${t.lede}</p></header>
${galleryCards(R, 'en', sizes, { full: true })}
<section class="prose gallery-how" aria-labelledby="how-h"><h2 id="how-h">${t.how}</h2>
<p>Compass Display is a good example of building a font from code. Each letter is a list of shapes, and the engine does the rest: it fixes contour direction, writes the TrueType and CFF outlines, adds kerning and compresses the web formats.</p>
${code}
<p>Want a font of your own? Start from Quill Hand in the <a href="${R}#studio">studio on the home page</a>, or follow the guide on <a href="${R}guides/turn-your-handwriting-into-a-font/">turning your handwriting into a font</a>.</p>
</section>
</div>`;
}

export function galleryJsonLd(sizes) {
  return [
    {
      '@type': 'CollectionPage', name: L.en.h1, url: `${SITE}gallery/`, inLanguage: 'en',
      hasPart: FONTS.filter((f) => sizes[f.file]).map((f) => ({ '@type': 'CreativeWork', name: f.family, genre: f.kind.en, license: 'https://opensource.org/licenses/MIT', encodingFormat: 'font/woff2', url: `${SITE}gallery/#${f.id}`, author: { '@type': 'Person', name: 'Alexandre Kohler' } })),
    },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE }, { '@type': 'ListItem', position: 2, name: 'Gallery', item: `${SITE}gallery/` }] },
  ];
}

export const GALLERY_META = L.en;
