// Page shell of the fontsketch site: head, top bar, footer, icon sprite and
// the strings shared by the English and Portuguese pages.

export const SITE = 'https://kwy404.github.io/fontsketch/';
export const REPO = 'https://github.com/kwy404/fontsketch';
export const NPM = 'https://www.npmjs.com/package/fontsketch';
export const VERSION = '0.1.0';
export const UPDATED = '2026-10-13';
export const MONSOON = 'https://cdn.jsdelivr.net/npm/monsooncss@0.2.0/dist/monsoon.min.css';
export const VOODOO = 'https://cdn.jsdelivr.net/npm/voodoojs@1.0.0/dist/voodoo.full.min.js';
export const AUTHOR = { name: 'Alexandre Kohler', github: 'https://github.com/kwy404', linkedin: 'https://www.linkedin.com/in/alexandre-silva-173687256/' };

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const MORE = [
  ['Monsoon', 'https://kwy404.github.io/monsoon/', 'CSS framework with no build step', 'framework CSS sem build'],
  ['Voodoo.js', 'https://kwy404.github.io/Voodoo.js/', 'reactive HTML attributes', 'atributos HTML reativos'],
  ['breakhound', 'https://kwy404.github.io/breakhound/', 'finds bugs in any JS library', 'acha bugs em qualquer biblioteca JS'],
  ['cookieowl', 'https://kwy404.github.io/cookieowl/', 'cookie consent for LGPD and GDPR', 'consentimento de cookies LGPD e GDPR'],
  ['installkite', 'https://kwy404.github.io/installkite/', 'make any site an installable PWA', 'transforma qualquer site em PWA'],
  ['a11ymedic', 'https://kwy404.github.io/a11ymedic/', 'accessibility checker with fixes', 'verificador de acessibilidade'],
  ['graphemely', 'https://kwy404.github.io/graphemely/', 'emoji safe string utilities', 'strings seguras com emoji'],
  ['numberparrot', 'https://kwy404.github.io/numberparrot/', 'parse localized numbers', 'converte números localizados'],
  ['edgegoat', 'https://kwy404.github.io/edgegoat/', 'edge case test inputs', 'casos extremos para testes'],
  ['vueleap', 'https://kwy404.github.io/vueleap/', 'migrate Vue 2 to Vue 3', 'migra Vue 2 para Vue 3'],
];

export const STR = {
  en: {
    skip: 'Skip to content',
    nav: [['studio', 'Studio', '#studio'], ['story', 'How it works', '#story'], ['gallery', 'Gallery', 'gallery/'], ['guides', 'Guides', 'guides/']],
    editor: 'Open the editor',
    theme: 'Theme: system, light or dark',
    menu: 'Menu',
    langLabel: 'Português',
    langShort: 'PT',
    footBlurb: 'A free, open source font maker. Draw, import or scan your handwriting and export real TTF, OTF, WOFF and WOFF2 fonts, all in your browser.',
    product: 'Product',
    guides: 'Popular guides',
    more: 'More from kwy404',
    made: 'Made by',
    builtMonsoon: 'Built with',
    builtVoodoo: 'Interactive parts built with',
    license: 'MIT License. Fonts you make are yours.',
    links: [['Font editor', 'app/'], ['Gallery', 'gallery/'], ['All guides', 'guides/'], ['npm package', NPM], ['Source on GitHub', REPO], ['Changelog', `${REPO}/blob/main/CHANGELOG.md`]],
  },
  pt: {
    skip: 'Pular para o conteúdo',
    nav: [['studio', 'Estúdio', '#studio'], ['story', 'Como funciona', '#story'], ['gallery', 'Galeria', 'gallery/'], ['guides', 'Guias', 'pt/guias/']],
    editor: 'Abrir o editor',
    theme: 'Tema: sistema, claro ou escuro',
    menu: 'Menu',
    langLabel: 'English',
    langShort: 'EN',
    footBlurb: 'Um criador de fontes gratuito e de código aberto. Desenhe, importe ou escaneie sua letra e exporte fontes TTF, OTF, WOFF e WOFF2 de verdade, tudo no navegador.',
    product: 'Produto',
    guides: 'Guias populares',
    more: 'Mais de kwy404',
    made: 'Feito por',
    builtMonsoon: 'Feito com',
    builtVoodoo: 'Partes interativas feitas com',
    license: 'Licença MIT. As fontes que você cria são suas.',
    links: [['Editor de fontes', 'app/'], ['Galeria', 'gallery/'], ['Todos os guias', 'pt/guias/'], ['Pacote npm', NPM], ['Código no GitHub', REPO], ['Changelog', `${REPO}/blob/main/CHANGELOG.md`]],
  },
};

const ic = (id, path, extra = '') => `<symbol id="i-${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${extra}>${path}</symbol>`;
export const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${[
  ic('github', '<path d="M9 19c-4 1.3-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>'),
  ic('npm', '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 17V7h10v10h-3V10h-2v7Z"/>'),
  ic('linkedin', '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>'),
  ic('sun', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  ic('moon', '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>'),
  ic('system', '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  ic('menu', '<path d="M4 7h16M4 12h16M4 17h16"/>'),
  ic('copy', '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
  ic('check', '<path d="m5 12 5 5L20 7"/>'),
  ic('arrow', '<path d="M5 12h14M13 6l6 6-6 6"/>'),
  ic('download', '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>'),
  ic('external', '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  ic('pen', '<path d="M4 20l4-1 11-11-3-3L5 16Z"/><path d="M14 6l3 3"/>'),
  ic('points', '<path d="M5 18C8 6 16 6 19 18"/><rect x="3" y="16" width="4" height="4"/><rect x="17" y="16" width="4" height="4"/><circle cx="12" cy="9" r="2"/>'),
  ic('eraser', '<path d="M8 20h12M5 15l9-9 5 5-8 8H8Z"/><path d="M10 10l5 5"/>'),
  ic('undo', '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  ic('trash', '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  ic('sparkle', '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
  ic('play', '<path d="m7 4 13 8-13 8Z"/>'),
  ic('next', '<path d="M5 12h12M13 6l6 6-6 6"/>'),
  ic('book', '<path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h13"/>'),
  ic('globe', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18"/>'),
].join('')}</svg>`;

/** Relative prefix from a page path (like 'guides/x/') to the site root. */
export const rel = (path) => '../'.repeat((path.match(/\//g) || []).length);

function themeHead() {
  return `<script>(function(){try{var t=localStorage.getItem('voodoo:theme');if(t&&t.charAt(0)==='"')t=JSON.parse(t);var r=document.documentElement;if(t==='light'||t==='dark'){r.setAttribute('data-theme',t);r.style.colorScheme=t}else{r.removeAttribute('data-theme')}}catch(e){}})();</script>`;
}

/**
 * @param {object} o
 * @param {'en'|'pt'} o.lang
 * @param {string} o.path page path relative to the site root ('' for home)
 * @param {string} o.title
 * @param {string} o.description
 * @param {object[]} [o.jsonld]
 * @param {string} [o.ogImage] absolute URL
 * @param {string} [o.ogAlt]
 * @param {string} [o.ogType]
 * @param {Record<string,string>} [o.alternates] hreflang to absolute URL
 * @param {string} [o.nav] active nav id
 * @param {boolean} [o.noindex]
 * @param {string} [o.head] extra head markup
 * @param {string} [o.bodyClass]
 * @param {string} [o.langHref] relative URL of the page in the other language
 * @param {string} body
 */
export function page(o, body) {
  const s = STR[o.lang];
  const R = rel(o.path);
  const url = SITE + o.path;
  const og = o.ogImage || `${SITE}og.png`;
  const alts = o.alternates || {};
  const htmlLang = o.lang === 'pt' ? 'pt-BR' : 'en';
  const href = (h) => (/^(https?:|#|mailto:)/.test(h) ? h : R + h);
  const isHome = (o.path === '' || o.path === 'pt/') && !o.noindex;
  const navHref = (h) => (h.startsWith('#') ? (isHome ? h : `${R || './'}${o.lang === 'pt' ? 'pt/' : ''}${h}`) : R + h);
  const otherLang = o.langHref ? R + o.langHref : R + (o.lang === 'pt' ? '' : 'pt/');
  const guidesLinks = o.lang === 'pt'
    ? [['Criar fonte com minha letra', 'pt/guias/criar-fonte-com-minha-letra/'], ['Criar fonte online grátis', 'pt/guias/criar-fonte-online-gratis/'], ['Como criar uma fonte', 'pt/guias/como-criar-uma-fonte/'], ['Transformar SVG em fonte', 'pt/guias/transformar-svg-em-fonte/'], ['Gerador de fonte de ícones', 'pt/guias/gerador-de-fonte-de-icones/']]
    : [['Turn your handwriting into a font', 'guides/turn-your-handwriting-into-a-font/'], ['Create a font online free', 'guides/create-a-font-online-free/'], ['Make a font from SVG', 'guides/make-a-font-from-svg/'], ['Icon font generator', 'guides/icon-font-generator/'], ['Variable font tutorial', 'guides/variable-font-tutorial/'], ['Font hinting explained', 'guides/font-hinting-explained/']];
  return `<!doctype html>
<html lang="${htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
${themeHead()}
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
${o.noindex ? '<meta name="robots" content="noindex">\n' : ''}<link rel="canonical" href="${url}">
${Object.entries(alts).map(([l, u]) => `<link rel="alternate" hreflang="${l}" href="${u}">`).join('\n')}
<meta name="author" content="${AUTHOR.name}">
<meta name="theme-color" content="#FBF4E4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121132" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:site_name" content="fontsketch">
<meta property="og:locale" content="${o.lang === 'pt' ? 'pt_BR' : 'en_US'}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(o.ogAlt || 'fontsketch: turn your handwriting into a real font, free in your browser')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.description)}">
<meta name="twitter:image" content="${og}">
<link rel="icon" href="${R}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" href="${R}assets/fonts/quill-hand.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;0,9..144,800;1,9..144,600&amp;display=swap">
<link rel="stylesheet" href="${MONSOON}">
<link rel="stylesheet" href="${R}assets/site/site.css">
<script src="${VOODOO}" data-manual defer></script>
<script type="module" src="${R}assets/site/site.js"></script>
${o.head || ''}${(o.jsonld || []).length ? `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': o.jsonld }, null, 1)}\n</script>` : ''}
</head>
<body class="${o.bodyClass || ''}" data-root="${R}">
${SPRITE}
<a class="skip" href="#main">${s.skip}</a>
<header class="topbar" v-data="{ open: false }" @keydown.escape="open = false">
  <div class="topbar-in">
    <a class="brand" href="${R}${o.lang === 'pt' ? 'pt/' : ''}" aria-label="fontsketch home"><img src="${R}favicon.svg" width="34" height="34" alt=""><span class="brand-word"><span>font</span><span class="brand-ver">sketch</span></span></a>
    <nav id="topnav" class="topnav" :class="open ? 'is-open' : ''" aria-label="Main">
      ${s.nav.map(([id, label, h]) => `<a href="${navHref(h)}"${o.nav === id ? ' aria-current="page"' : ''}>${label}</a>`).join('\n      ')}
      <a class="topnav-cta btn btn-primary btn-sm" href="${R}app/"><svg class="ic" aria-hidden="true"><use href="#i-pen"/></svg>${s.editor}</a>
    </nav>
    <div class="topbar-tools">
      <a class="icon-btn lang-btn" href="${otherLang}" hreflang="${o.lang === 'pt' ? 'en' : 'pt-BR'}" lang="${o.lang === 'pt' ? 'en' : 'pt-BR'}" title="${s.langLabel}"><svg class="ic" aria-hidden="true"><use href="#i-globe"/></svg><span>${s.langShort}</span></a>
      <a class="icon-btn" href="${REPO}" rel="noopener" aria-label="fontsketch on GitHub"><svg class="ic" aria-hidden="true"><use href="#i-github"/></svg></a>
      <button type="button" class="icon-btn theme-btn" v-theme-toggle.cycle aria-label="${s.theme}" title="${s.theme}"><svg class="ic ti-system" aria-hidden="true"><use href="#i-system"/></svg><svg class="ic ti-light" aria-hidden="true"><use href="#i-sun"/></svg><svg class="ic ti-dark" aria-hidden="true"><use href="#i-moon"/></svg></button>
      <button type="button" class="icon-btn nav-btn" aria-controls="topnav" :aria-expanded="open ? 'true' : 'false'" aria-expanded="false" @click="open = !open" aria-label="${s.menu}"><svg class="ic" aria-hidden="true"><use href="#i-menu"/></svg></button>
    </div>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="foot-in">
    <div class="foot-brand">
      <a class="brand" href="${R}${o.lang === 'pt' ? 'pt/' : ''}"><img src="${R}favicon.svg" width="34" height="34" alt=""><span class="brand-word"><span>font</span><span class="brand-ver">sketch</span></span></a>
      <p>${s.footBlurb}</p>
      <p class="foot-made">${s.made} <strong>${AUTHOR.name}</strong> (<a href="${AUTHOR.github}" rel="me noopener">GitHub</a> and <a href="${AUTHOR.linkedin}" rel="me noopener">LinkedIn</a>).</p>
      <p class="foot-built">${s.builtMonsoon} <a href="https://kwy404.github.io/monsoon/" rel="noopener">Monsoon</a>. ${s.builtVoodoo} <a href="https://kwy404.github.io/Voodoo.js/" rel="noopener">Voodoo.js</a>.</p>
    </div>
    <div>
      <h2 class="foot-h">${s.product}</h2>
      <ul class="foot-list">${s.links.map(([t, h]) => `<li><a href="${href(h)}"${/^https/.test(h) ? ' rel="noopener"' : ''}>${t}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h2 class="foot-h">${s.guides}</h2>
      <ul class="foot-list">${guidesLinks.map(([t, h]) => `<li><a href="${R}${h}">${t}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h2 class="foot-h">${s.more}</h2>
      <ul class="foot-list foot-more">${MORE.map(([n, u, en, pt]) => `<li><a href="${u}" rel="noopener">${n}</a><small>${o.lang === 'pt' ? pt : en}</small></li>`).join('')}</ul>
    </div>
  </div>
  <p class="foot-legal">${s.license} <span>fontsketch ${VERSION}</span></p>
</footer>
</body>
</html>
`;
}
