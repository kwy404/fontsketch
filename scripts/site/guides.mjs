// Guide pages, guide indexes and their structured data.
import { AUTHOR, SITE, UPDATED, esc } from './layout.mjs';
import { inline } from './md.mjs';

export const GUIDE_BASE = { en: 'guides/', pt: 'pt/guias/' };
export const guidePath = (lang, slug) => `${GUIDE_BASE[lang]}${slug}/`;

const T = {
  en: { home: 'Home', guides: 'Guides', guide: 'Guide', min: 'min read', updated: 'Updated', steps: 'Step by step', faq: 'Questions people ask', related: 'Keep reading', toc: 'On this page', tryTitle: 'Try it right now', tryText: 'Draw a letter on the stage and watch it become a real font. Free, no upload, no account.', tryBtn: 'Open the studio', editorBtn: 'Open the editor', other: 'Leia em português', indexTitle: 'Font making guides', indexKicker: 'The atelier library', indexLede: 'Practical, honest guides to making fonts: from your first handwriting font to variable weights, hinting, kerning, icon fonts and web font formats.', all: 'All guides', read: 'Read the guide' },
  pt: { home: 'Início', guides: 'Guias', guide: 'Guia', min: 'min de leitura', updated: 'Atualizado em', steps: 'Passo a passo', faq: 'Perguntas frequentes', related: 'Continue lendo', toc: 'Nesta página', tryTitle: 'Experimente agora', tryText: 'Desenhe uma letra no estúdio e veja ela virar uma fonte de verdade. Grátis, sem upload e sem cadastro.', tryBtn: 'Abrir o estúdio', editorBtn: 'Abrir o editor', other: 'Read in English', indexTitle: 'Guias para criar fontes', indexKicker: 'A biblioteca do ateliê', indexLede: 'Guias práticos para criar fontes: da sua primeira fonte com a sua letra até ícones, SVG e o processo completo de criação.', all: 'Todos os guias', read: 'Ler o guia' },
};

/** Light and dark illustration pair. */
export function art(R, name, alt, { eager = false, cls = '' } = {}) {
  const load = eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  return `<span class="art ${cls}"><img class="art-l" src="${R}assets/art/${name}.svg" width="640" height="400" alt="${esc(alt)}" ${load}><img class="art-d" src="${R}assets/art/${name}-dark.svg" width="640" height="400" alt="" aria-hidden="true" ${load}></span>`;
}

export function guideJsonLd(g, all) {
  const t = T[g.meta.lang];
  const url = SITE + guidePath(g.meta.lang, g.meta.slug);
  const lang = g.meta.lang === 'pt' ? 'pt-BR' : 'en';
  const image = `${SITE}assets/og/${g.meta.slug}.png`;
  const homeUrl = g.meta.lang === 'pt' ? `${SITE}pt/` : SITE;
  void all;
  return [
    {
      '@type': 'TechArticle',
      '@id': `${url}#article`,
      headline: g.meta.h1,
      description: g.meta.description,
      image,
      inLanguage: lang,
      datePublished: '2026-10-13',
      dateModified: UPDATED,
      wordCount: g.words,
      keywords: g.meta.keyword,
      author: { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.github },
      publisher: { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.github },
      mainEntityOfPage: url,
      about: { '@type': 'SoftwareApplication', name: 'fontsketch', url: SITE },
    },
    {
      '@type': 'HowTo',
      '@id': `${url}#howto`,
      name: g.meta.howto,
      description: g.meta.description,
      image,
      inLanguage: lang,
      totalTime: g.meta.time,
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'USD', value: '0' },
      tool: [{ '@type': 'HowToTool', name: 'fontsketch (free, in the browser)' }],
      step: g.meta.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text, url: `${url}#step-${i + 1}` })),
    },
    {
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: lang,
      mainEntity: g.meta.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.home, item: homeUrl },
        { '@type': 'ListItem', position: 2, name: t.guides, item: SITE + GUIDE_BASE[g.meta.lang] },
        { '@type': 'ListItem', position: 3, name: g.meta.h1, item: url },
      ],
    },
  ];
}

export function guideBody(g, all, R, ctx) {
  const t = T[g.meta.lang];
  const lang = g.meta.lang;
  const mins = Math.max(3, Math.round(g.words / 220));
  const homeHref = R + (lang === 'pt' ? 'pt/' : '');
  const related = (g.meta.related || []).map((slug) => all.find((x) => x.meta.slug === slug && x.meta.lang === lang)).filter(Boolean);
  const link = ctx.link;
  return `<div class="guide-wrap">
<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${homeHref}">${t.home}</a></li><li><a href="${R}${GUIDE_BASE[lang]}">${t.guides}</a></li><li aria-current="page">${esc(g.meta.h1)}</li></ol></nav>
<header class="guide-head">
  <div class="guide-head-text">
    <p class="kicker">${t.guide} · ${esc(g.meta.keyword)}</p>
    <h1>${esc(g.meta.h1)}</h1>
    <p class="guide-meta"><span>${mins} ${t.min}</span><span>${t.updated} <time datetime="${UPDATED}">${UPDATED}</time></span>${g.pair ? `<a href="${R}${guidePath(g.pair.meta.lang, g.pair.meta.slug)}" hreflang="${g.pair.meta.lang === 'pt' ? 'pt-BR' : 'en'}" lang="${g.pair.meta.lang === 'pt' ? 'pt-BR' : 'en'}">${t.other}</a>` : ''}</p>
  </div>
  <figure class="guide-art">${art(R, g.meta.art, g.meta.alt, { eager: true })}</figure>
</header>
<div class="guide-grid">
  <aside class="guide-side" aria-label="${t.toc}">
    <div class="toc"><p class="toc-h">${t.toc}</p><ol>${g.toc.map((h) => `<li><a href="#${h.id}">${inline(h.text, link)}</a></li>`).join('')}<li><a href="#steps">${t.steps}</a></li><li><a href="#faq">${t.faq}</a></li></ol></div>
    <div class="try-card"><img src="${R}assets/art/quill-head.svg" width="84" height="112" alt="" loading="lazy"><p class="try-h">${t.tryTitle}</p><p>${t.tryText}</p><a class="btn btn-primary btn-sm" href="${homeHref}#studio">${t.tryBtn}</a><a class="btn btn-ghost btn-sm" href="${R}app/">${t.editorBtn}</a></div>
  </aside>
  <article class="prose" id="article">
${g.html}
    <section id="steps" class="prose-sec steps-sec"><h2>${t.steps}</h2><ol class="steps">${g.meta.steps.map((s, i) => `<li id="step-${i + 1}"><span class="step-n">${i + 1}</span><div><h3>${esc(s.name)}</h3><p>${inline(s.text, link)}</p></div></li>`).join('')}</ol></section>
    <section id="faq" class="prose-sec"><h2>${t.faq}</h2><div class="faq">${g.meta.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${inline(f.a, link)}</p></details>`).join('')}</div></section>
  </article>
</div>
<section class="related" aria-labelledby="related-h"><h2 id="related-h">${t.related}</h2><div class="cards">${related.map((r) => card(R, r, t)).join('')}</div></section>
</div>`;
}

function card(R, g, t) {
  return `<a class="gcard" href="${R}${guidePath(g.meta.lang, g.meta.slug)}">${art(R, g.meta.art, '')}<span class="gcard-k">${esc(g.meta.keyword)}</span><span class="gcard-t">${esc(g.meta.h1)}</span><span class="gcard-more">${t.read} <svg class="ic" aria-hidden="true"><use href="#i-arrow"/></svg></span></a>`;
}

export function indexBody(lang, guides, R) {
  const t = T[lang];
  const list = guides.filter((g) => g.meta.lang === lang);
  return `<div class="guide-wrap">
<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${R}${lang === 'pt' ? 'pt/' : ''}">${t.home}</a></li><li aria-current="page">${t.guides}</li></ol></nav>
<header class="index-head"><p class="kicker">${t.indexKicker}</p><h1>${t.indexTitle}</h1><p class="lede">${t.indexLede}</p></header>
<div class="cards cards-index">${list.map((g) => card(R, g, t)).join('')}</div>
</div>`;
}

export function indexJsonLd(lang, guides) {
  const t = T[lang];
  const list = guides.filter((g) => g.meta.lang === lang);
  return [
    {
      '@type': 'CollectionPage',
      name: t.indexTitle,
      url: SITE + GUIDE_BASE[lang],
      inLanguage: lang === 'pt' ? 'pt-BR' : 'en',
      hasPart: list.map((g) => ({ '@type': 'TechArticle', headline: g.meta.h1, url: SITE + guidePath(lang, g.meta.slug) })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.home, item: lang === 'pt' ? `${SITE}pt/` : SITE },
        { '@type': 'ListItem', position: 2, name: t.guides, item: SITE + GUIDE_BASE[lang] },
      ],
    },
  ];
}
