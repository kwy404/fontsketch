// Builds the fontsketch marketing site in docs/ (the editor in docs/app/ is
// built separately by scripts/build-docs.mjs):
//   docs/index.html, docs/pt/            home with the drawing studio
//   docs/guides/, docs/pt/guias/         guides from scripts/site/guides/
//   docs/gallery/                        example fonts with type testers
//   docs/404.html, sitemap.xml, robots.txt
//   docs/assets/fonts/                   Quill Hand and the gallery fonts
//   docs/assets/site/core.js             the core engine bundled for the hero
// Code samples are highlighted at build time with Shiki (light-plus and
// dark-plus). With --png the social images are rendered with a local Edge or
// Chrome (scripts/site/build-art.mjs).
// Usage: node scripts/build-site.mjs [--png]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as core from '../src/node.mjs';
import { buildArt, guideCardSVG, renderPng, socialSVG } from './site/build-art.mjs';
import { writeQuillHand } from './site/quill-hand.mjs';
import { buildCompass, buildIcons, buildQuillVariable } from './site/gallery-fonts.mjs';
import { FONTS, GALLERY_META, fontFaces, galleryBody, galleryCards, galleryJsonLd } from './site/gallery-page.mjs';
import { HOME, homeBody, homeJsonLd } from './site/home.mjs';
import { GUIDE_BASE, guideBody, guideJsonLd, guidePath, indexBody, indexJsonLd } from './site/guides.mjs';
import { SITE, UPDATED, esc, page, rel } from './site/layout.mjs';
import { frontMatter, render } from './site/md.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const docs = join(root, 'docs');
const png = process.argv.includes('--png');

// ---------- Shiki ----------

async function loadShiki() {
  const require = createRequire(import.meta.url);
  try {
    require.resolve('shiki');
    return await import('shiki');
  } catch {
    const sibling = join(root, '..', 'graphemely', 'node_modules', 'shiki', 'dist', 'index.mjs');
    if (existsSync(sibling)) return import(pathToFileURL(sibling).href);
  }
  throw new Error('shiki is not installed: run npm install');
}
const shiki = await loadShiki();
const highlighter = await shiki.createHighlighter({ themes: ['light-plus', 'dark-plus'], langs: ['html', 'css', 'js', 'ts', 'tsx', 'bash', 'json', 'vue', 'text'] });

const FILE_ICONS = { html: ['#e34c26', '<>'], css: ['#663399', '#'], js: ['#c9a400', 'JS'], ts: ['#3178c6', 'TS'], tsx: ['#1f8fbf', 'TSX'], json: ['#8a6d00', '{}'], vue: ['#3f9b6e', 'V'], bash: ['#3f8f4f', '$_'], text: ['#6a66a8', 'Aa'] };
const TITLES = { html: 'index.html', css: 'styles.css', js: 'font.mjs', ts: 'font.ts', tsx: 'App.tsx', json: 'data.json', vue: 'App.vue', bash: 'Terminal', text: 'notes.txt' };
function fileIcon(lang) {
  const [color, label] = FILE_ICONS[lang] || FILE_ICONS.text;
  const size = label.length > 2 ? 5.2 : 6.4;
  return `<svg class="file-ic" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect width="16" height="16" rx="3" fill="${color}"/><text x="8" y="11" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="700" fill="#fff">${esc(label)}</text></svg>`;
}
let codeId = 0;
let idPrefix = 'c';
/** A VS Code style frame around Shiki output. */
function frame(code, lang = 'text', title) {
  const l = FILE_ICONS[lang] ? lang : lang === 'sh' || lang === 'shell' ? 'bash' : lang === 'javascript' || lang === 'mjs' ? 'js' : 'text';
  const html = highlighter.codeToHtml(code, { lang: l, themes: { light: 'light-plus', dark: 'dark-plus' }, defaultColor: false });
  const inner = /<code>([\s\S]*)<\/code>/.exec(html)[1];
  const id = `${idPrefix}-${++codeId}`;
  const name = title || TITLES[l];
  const kind = l === 'bash' ? 'terminal' : 'editor';
  return `<figure class="frame frame-${kind}" data-lang="${l}"><div class="frame-bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="frame-tab">${fileIcon(l)}<span>${esc(name)}</span></span><button type="button" class="frame-copy" v-copy-from="#${id}" aria-label="Copy ${esc(name)}"><svg class="ic" aria-hidden="true"><use href="#i-copy"/></svg><span>Copy</span></button></div><pre class="shiki" tabindex="0"><code id="${id}">${inner}</code></pre></figure>`;
}

// ---------- Fonts ----------

const sizes = {};
function exportAll(font, file, formats = ['woff2', 'ttf', 'otf', 'woff'], options = {}) {
  const dir = join(docs, 'assets', 'fonts');
  mkdirSync(dir, { recursive: true });
  const entry = { glyphs: Object.keys(font.glyphs).filter((n) => n !== '.notdef').length };
  if (options.json !== false) {
    writeFileSync(join(dir, `${file}.fontsketch.json`), core.serialize(font));
    entry.json = readFileSync(join(dir, `${file}.fontsketch.json`)).length;
  }
  delete options.json;
  for (const format of formats) {
    try {
      const bytes = core.exportFont(font, { format, hinting: 'auto', timestamp: Date.UTC(2026, 9, 13), ...options });
      writeFileSync(join(dir, `${file}.${format}`), bytes);
      entry[format] = bytes.length;
    } catch (err) {
      console.warn(`build-site: ${file}.${format} skipped: ${/** @type {Error} */ (err).message}`);
    }
  }
  sizes[file] = entry;
}
const { font: quill } = writeQuillHand();
exportAll(quill, 'quill-hand');
try {
  exportAll(buildQuillVariable(), 'quill-hand-variable', ['woff2', 'ttf'], { variable: true, json: false });
} catch (err) {
  console.warn(`build-site: variable font skipped: ${/** @type {Error} */ (err).message}`);
}
exportAll(buildCompass(), 'compass-display');
exportAll(buildIcons(), 'atelier-icons');
for (const f of Object.keys(sizes)) if (!sizes[f].woff2 && !sizes[f].ttf) delete sizes[f];

// ---------- Core bundle for the studio ----------

try {
  const { build } = await import('esbuild');
  await build({ entryPoints: [join(root, 'src/core/index.mjs')], bundle: true, format: 'esm', minify: true, target: ['es2020'], platform: 'browser', outfile: join(docs, 'assets/site/core.js'), legalComments: 'none', logLevel: 'error', external: ['brotli-wasm', 'node:*'] });
} catch (err) {
  console.warn(`build-site: core bundle failed: ${/** @type {Error} */ (err).message}`);
}

// ---------- Special dates script, minified ----------

try {
  const { transform } = await import('esbuild');
  const src = readFileSync(join(root, 'scripts/site/seasons.js'), 'utf8');
  const { code } = await transform(src, { minify: true, target: 'es2017', legalComments: 'none' });
  writeFileSync(join(docs, 'assets/site/seasons.js'), code);
} catch (err) {
  console.warn(`build-site: seasons script failed: ${/** @type {Error} */ (err).message}`);
}

// ---------- Art ----------

buildArt();

// ---------- Guides ----------

const guides = [];
for (const lang of ['en', 'pt']) {
  const dir = join(root, 'scripts', 'site', 'guides', lang);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
    const { meta, body } = frontMatter(readFileSync(join(dir, f), 'utf8'));
    if (`${meta.slug}.md` !== f) throw new Error(`${lang}/${f}: slug ${meta.slug} does not match`);
    guides.push({ meta, body });
  }
}
for (const g of guides) {
  if (g.meta.pair) g.pair = guides.find((x) => x.meta.slug === g.meta.pair && x.meta.lang !== g.meta.lang);
}
const altFor = (g) => {
  const a = { [g.meta.lang === 'pt' ? 'pt-BR' : 'en']: SITE + guidePath(g.meta.lang, g.meta.slug) };
  if (g.pair) a[g.pair.meta.lang === 'pt' ? 'pt-BR' : 'en'] = SITE + guidePath(g.pair.meta.lang, g.pair.meta.slug);
  a['x-default'] = a.en || a['pt-BR'];
  return a;
};

// ---------- Pages ----------

const out = {};
const stripChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?&';

const codeCli = () => frame(`# a folder of SVG icons becomes WOFF2, WOFF, TTF, CSS classes and a preview page
npx fontsketch from-svg ./icons --family Icons -o ./dist

# compile a project saved from the editor
npx fontsketch build my-hand.fontsketch.json -o ./fonts --formats woff2,ttf`, 'bash');
const codeApi = () => frame(`import { writeFileSync } from 'node:fs';
import { createFont, addGlyph, circleContour, reverseContour, exportFont, cssFontFace } from 'fontsketch';

const font = createFont({ family: 'My Hand', designer: 'Me' });
addGlyph(font, {
  name: 'o',
  advanceWidth: 520,
  contours: [circleContour(260, 250, 230), reverseContour(circleContour(260, 250, 130))],
});

writeFileSync('my-hand.woff2', exportFont(font, { format: 'woff2', hinting: 'auto' }));
console.log(cssFontFace(font, '/fonts/my-hand.woff2'));`, 'js', 'build-font.mjs');

for (const lang of ['en', 'pt']) {
  idPrefix = `h${lang}`;
  codeId = 0;
  const path = lang === 'pt' ? 'pt/' : '';
  const R = rel(path);
  const t = HOME[lang];
  out[`${path}index.html`] = page(
    {
      lang, path, nav: 'studio', title: t.title, description: t.description, jsonld: homeJsonLd(lang),
      alternates: { en: SITE, 'pt-BR': `${SITE}pt/`, 'x-default': SITE }, langHref: lang === 'pt' ? '' : 'pt/',
      bodyClass: 'home', ogAlt: 'fontsketch, the free font maker in the browser, with Quill the octopus mascot',
      head: `${fontFaces(R, sizes)}<script type="module" src="${R}assets/site/studio.js"></script>\n<script type="module" src="${R}assets/site/story.js"></script>\n`,
    },
    homeBody(lang, { R, guides, stripChars, sizes: sizes['quill-hand'] || {}, galleryCards: galleryCards(R, lang, sizes), code: { cli: codeCli(), api: codeApi() } }),
  );
}

for (const g of guides) {
  const lang = g.meta.lang;
  idPrefix = `g${guides.indexOf(g)}`;
  codeId = 0;
  const path = guidePath(lang, g.meta.slug);
  const R = rel(path);
  const link = (h) => {
    if (h.startsWith('guide:')) {
      const slug = h.slice(6);
      if (!guides.find((x) => x.meta.slug === slug && x.meta.lang === lang)) throw new Error(`${lang}/${g.meta.slug}: broken guide link ${slug}`);
      return { href: R + guidePath(lang, slug) };
    }
    if (h.startsWith('app:')) return { href: `${R}app/${h.slice(4)}` };
    return { href: h, external: /^https?:/.test(h) };
  };
  const r = render(g.body, { link, frame: (code, l) => frame(code, l) });
  Object.assign(g, r);
  out[`${path}index.html`] = page(
    {
      lang, path, nav: 'guides', ogType: 'article', title: g.meta.title, description: g.meta.description, jsonld: guideJsonLd(g, guides),
      alternates: altFor(g), langHref: g.pair ? guidePath(g.pair.meta.lang, g.pair.meta.slug) : undefined,
      ogImage: `${SITE}assets/og/${g.meta.slug}.png`, ogAlt: g.meta.alt, bodyClass: 'guide',
    },
    guideBody(g, guides, R, { link }),
  );
}

for (const lang of ['en', 'pt']) {
  const path = GUIDE_BASE[lang];
  const R = rel(path);
  const en = lang === 'en';
  out[`${path}index.html`] = page(
    {
      lang, path, nav: 'guides',
      title: en ? 'Guides | fontsketch' : 'Guias | fontsketch',
      description: en ? 'Short guides to making a font with fontsketch and using it on a website.' : 'Guias curtos para fazer uma fonte com o fontsketch.',
      jsonld: indexJsonLd(lang, guides), alternates: { en: `${SITE}guides/`, 'pt-BR': `${SITE}pt/guias/`, 'x-default': `${SITE}guides/` }, langHref: en ? 'pt/guias/' : 'guides/',
    },
    indexBody(lang, guides, R),
  );
}

idPrefix = 'gal';
codeId = 0;
out['gallery/index.html'] = page(
  {
    lang: 'en', path: 'gallery/', nav: 'gallery', title: GALLERY_META.title, description: GALLERY_META.desc, jsonld: galleryJsonLd(sizes),
    head: fontFaces('../', sizes), alternates: { en: `${SITE}gallery/`, 'x-default': `${SITE}gallery/` },
  },
  galleryBody('../', sizes, frame(readFileSync(join(root, 'scripts/site/gallery-fonts.mjs'), 'utf8').split('\n').filter((l) => /^ {2}[A-E]: |^export function buildCompass|^ {2}for \(const \[name, \[adv, fn\]\]|^ {4}core\.addGlyph/.test(l)).slice(0, 9).join('\n'), 'js', 'compass-display.mjs')),
);

const rootLinks = (html) => html.replace(/\b(href|src)="(?![a-z]+:|#|\/)([^"]*)"/g, (_, a, v) => `${a}="/fontsketch/${v.replace(/^(\.\.?\/)+/, '')}"`);
out['404.html'] = rootLinks(page(
  { lang: 'en', path: '', title: 'Page not found | fontsketch', description: 'This page is not in the type case. Head back to fontsketch, the free font maker that turns your handwriting into a real font in your browser.', noindex: true },
  `<section class="notfound"><span class="art nf-art"><img class="art-l" src="assets/art/quill.svg" width="452" height="452" alt="Quill the octopus looking for a missing letter"><img class="art-d" src="assets/art/quill-dark.svg" width="452" height="452" alt="" aria-hidden="true"></span><div><p class="kicker">404</p><h1>This glyph is missing from the font</h1><p class="lede">The page you asked for is not in the type case. Maybe it was renamed, or the link lost a letter.</p><p class="cta-btns"><a class="btn btn-primary" href="./">Back to the studio</a><a class="btn btn-outline" href="guides/">Browse the guides</a></p></div></section>`,
));

// ---------- Sitemap and robots ----------

const urls = [
  { loc: '', alt: { en: '', 'pt-BR': 'pt/' }, pr: '1.0' },
  { loc: 'pt/', alt: { en: '', 'pt-BR': 'pt/' }, pr: '0.9' },
  { loc: 'guides/', alt: { en: 'guides/', 'pt-BR': 'pt/guias/' }, pr: '0.9' },
  { loc: 'pt/guias/', alt: { en: 'guides/', 'pt-BR': 'pt/guias/' }, pr: '0.8' },
  { loc: 'gallery/', pr: '0.8' },
  { loc: 'app/', pr: '0.9' },
  ...guides.map((g) => {
    const a = altFor(g);
    return { loc: guidePath(g.meta.lang, g.meta.slug), alt: Object.keys(a).length > 2 ? Object.fromEntries(Object.entries(a).filter(([k]) => k !== 'x-default').map(([k, v]) => [k, v.slice(SITE.length)])) : null, pr: '0.8' };
  }),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((u) => `  <url><loc>${SITE}${u.loc}</loc><lastmod>${UPDATED}</lastmod><priority>${u.pr}</priority>${u.alt ? Object.entries(u.alt).map(([l, p]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${p}"/>`).join('') : ''}</url>`).join('\n')}
</urlset>
`;
out['sitemap.xml'] = sitemap;
out['robots.txt'] = `User-agent: *\nAllow: /\nDisallow: /404.html\n\nSitemap: ${SITE}sitemap.xml\n`;
if (!existsSync(join(docs, '.nojekyll'))) out['.nojekyll'] = '';

// ---------- Checks ----------

const problems = [];
const dash = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
const titles = new Set();
for (const [name, content] of Object.entries(out)) {
  if (dash.test(content)) problems.push(`${name}: contains an en or em dash`);
  if (/\p{Extended_Pictographic}/u.test(content)) problems.push(`${name}: contains an emoji`);
  if (!name.endsWith('.html')) continue;
  const text = content.replace(/<(script|style|pre|code|kbd|samp|textarea|template|noscript|svg)\b[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, '');
  const brace = /.{0,40}[{}].{0,40}/.exec(text);
  if (brace) problems.push(`${name}: braces outside code would be read by Voodoo: ${brace[0]}`);
  const title = /<title>([^<]*)<\/title>/.exec(content)[1];
  if (titles.has(title)) problems.push(`${name}: duplicate title ${title}`);
  titles.add(title);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

for (const [name, content] of Object.entries(out)) {
  mkdirSync(dirname(join(docs, name)), { recursive: true });
  writeFileSync(join(docs, name), content);
}

if (png) {
  renderPng([
    { svg: socialSVG(1280, 640), width: 1280, height: 640, out: 'assets/social-preview.png' },
    { svg: socialSVG(1200, 630), width: 1200, height: 630, out: 'docs/og.png' },
    ...guides.map((g) => ({ svg: guideCardSVG({ title: g.meta.h1, kicker: g.meta.lang === 'pt' ? 'Guia do fontsketch' : 'fontsketch guide', art: g.meta.art }), width: 1200, height: 630, out: `docs/assets/og/${g.meta.slug}.png` })),
  ]);
}

console.log(`build-site: ${Object.keys(out).filter((n) => n.endsWith('.html')).length} pages, ${guides.length} guides, fonts: ${Object.entries(sizes).map(([k, v]) => `${k} ${v.woff2 || v.ttf || 0} B`).join(', ')}`);
void FONTS;
