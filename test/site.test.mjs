// Checks the built website in docs/ (run `node scripts/build-site.mjs` after
// changing the site sources): every page has its head tags and footer, every
// local link and asset exists, and the sitemap lists only real pages.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const docs = fileURLToPath(new URL('../docs/', import.meta.url));
const pages = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (relative(docs, p).split(/[\\/]/)[0] !== 'app') walk(p);
    } else if (name.endsWith('.html')) pages.push(p);
  }
})(docs);
const rel = (p) => relative(docs, p).split('\\').join('/');

describe('website', () => {
  it('builds the home pages, the guides and the gallery', () => {
    const names = pages.map(rel);
    for (const p of ['index.html', 'pt/index.html', 'guides/index.html', 'pt/guias/index.html', 'gallery/index.html', '404.html']) expect(names).toContain(p);
    expect(names.filter((n) => /^guides\/[^/]+\/index\.html$/.test(n)).length).toBeLessThanOrEqual(4);
    expect(names.filter((n) => /^pt\/guias\/[^/]+\/index\.html$/.test(n)).length).toBeLessThanOrEqual(2);
  });

  it.each(pages.map((p) => [rel(p), p]))('%s has its head tags, footer and working local links', (name, file) => {
    const html = readFileSync(file, 'utf8');
    expect(html).toMatch(/<title>[^<]{5,}<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"]{20,160}">/);
    if (name !== '404.html') expect(html).toMatch(/<link rel="canonical" href="https:\/\/kwy404\.github\.io\/fontsketch\/[^"]*">/);
    for (const text of ['Alexandre Kohler', 'Monsoon', 'Voodoo.js', 'kwy404']) expect(html).toContain(text);
    if (name === '404.html') return;
    const dir = dirname(file);
    const refs = [...html.matchAll(/\b(?:href|src)="([^"#?]+)[^"]*"/g)].map((m) => m[1]).filter((u) => !/^(https?:|mailto:|data:)/.test(u));
    for (const ref of refs) {
      let target = join(dir, decodeURIComponent(ref));
      if (ref.endsWith('/')) target = join(target, 'index.html');
      expect(existsSync(target), `${name} links to ${ref}`).toBe(true);
    }
  });

  it('lists only existing pages in the sitemap', () => {
    const xml = readFileSync(join(docs, 'sitemap.xml'), 'utf8');
    const locs = [...xml.matchAll(/<loc>https:\/\/kwy404\.github\.io\/fontsketch\/([^<]*)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(5);
    for (const loc of locs) expect(existsSync(join(docs, loc, 'index.html')), loc).toBe(true);
  });
});
