// Generates the fontsketch art: README assets (mascot, banners, icons) in
// assets/, the atelier illustrations in docs/assets/art/, and the SVG sources
// of the social images. With --png it also renders the PNG social images
// (assets/social-preview.png, docs/og.png and one Open Graph image per guide)
// with a local Edge or Chrome in headless mode.
// Usage: node scripts/site/build-art.mjs [--png]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mascotSVG, headSVG, faviconSVG } from './art/mascot.mjs';
import { bannerSVG, nest, sheetCard, THEME } from './art/banner.mjs';
import { ICONS, iconSVG } from './art/icons.mjs';
import { ART, artSVG } from './art/art.mjs';
import { text, measure } from './art/text.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const write = (p, s) => {
  const f = join(root, p);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, typeof s === 'string' ? `${s.trim()}\n` : s);
};

export function buildArt() {
  write('assets/mascot.svg', mascotSVG('light'));
  write('assets/mascot-dark.svg', mascotSVG('dark'));
  write('assets/mascot-head.svg', headSVG('light'));
  write('assets/mascot-head-dark.svg', headSVG('dark'));
  write('assets/favicon.svg', faviconSVG());
  write('assets/banner.svg', bannerSVG('light'));
  write('assets/banner-dark.svg', bannerSVG('dark'));
  for (const n of Object.keys(ICONS)) {
    write(`assets/icons/light/${n}.svg`, iconSVG(n, 'light'));
    write(`assets/icons/dark/${n}.svg`, iconSVG(n, 'dark'));
  }
  for (const n of Object.keys(ART)) {
    write(`docs/assets/art/${n}.svg`, artSVG(n, 'light'));
    write(`docs/assets/art/${n}-dark.svg`, artSVG(n, 'dark'));
  }
  // README illustrations reuse three of the atelier pieces
  for (const n of ['scan-to-font', 'nib-strokes', 'glyph-anatomy']) {
    write(`assets/illustrations/${n}.svg`, artSVG(n, 'light'));
    write(`assets/illustrations/${n}-dark.svg`, artSVG(n, 'dark'));
  }
  write('docs/favicon.svg', faviconSVG());
  write('docs/assets/art/quill-head.svg', headSVG('light'));
  write('docs/assets/art/quill.svg', mascotSVG('light'));
  write('docs/assets/art/quill-dark.svg', mascotSVG('dark'));
  return Object.keys(ART);
}

/** Wraps a title into lines that fit maxWidth at the given size. */
export function wrap(str, size, maxWidth) {
  const words = str.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Social card SVG: wordmark, tagline and Quill. */
export function socialSVG(W, H) {
  const t = THEME.light;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="${t.bg}"/>`;
  const base = H * 0.47;
  const x = W * 0.43;
  const size = Math.min(W * 0.135, (W - x - 50) / measure('fontsketch', 1));
  for (const [y, dash] of [[base - size * 0.7, ''], [base - size * 0.48, '7 9'], [base, ''], [base + size * 0.24, '7 9']]) s += `<path d="M0 ${y}H${W}" stroke="${t.rule}" stroke-width="${y === base ? 2.4 : 1.6}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
  s += `<path d="M${W * 0.4} 0V${H}" stroke="${t.margin}" stroke-width="2.4" opacity=".7"/>`;
  s += nest(mascotSVG('light'), 18, (H - W * 0.38) / 2, W * 0.38, W * 0.38);
  const fw = measure('font', size);
  s += text('font', size, x, base, t.ink) + text('sketch', size, x + fw + 4, base, t.ver);
  s += text('Turn your handwriting', W * 0.036, x + 4, base + 72, t.soft);
  s += text('into a real font, free in your browser.', W * 0.036, x + 4, base + 120, t.soft);
  let cx = x + 4;
  for (const label of ['TTF', 'OTF', 'WOFF2', 'Variable', 'Icon fonts']) {
    const w = measure(label, 26) + 30;
    s += `<rect x="${cx}" y="${base + 150}" width="${w}" height="42" rx="21" fill="${t.chip}" stroke="${t.chipLine}" stroke-width="2"/>`;
    s += text(label, 26, cx + w / 2, base + 180, t.ink, { anchor: 'middle' });
    cx += w + 12;
  }
  s += sheetCard(t, W - 176, 22, 7, 'Aa', 2, 50);
  return `${s}</svg>`;
}

/** Open Graph card for a guide. */
export function guideCardSVG({ title, kicker, art }) {
  const W = 1200, H = 630;
  const t = THEME.light;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="${t.bg}"/>
<path d="M0 586H${W}" stroke="${t.rule}" stroke-width="2"/><path d="M96 0V${H}" stroke="${t.margin}" stroke-width="2.4" opacity=".7"/>`;
  s += text(kicker, 30, 130, 92, t.ver);
  let size = 74;
  let lines = wrap(title, size, 560);
  if (lines.length > 4) {
    size = 60;
    lines = wrap(title, size, 560);
  }
  lines.forEach((ln, i) => {
    s += text(ln, size, 130, 190 + i * size * 1.18, t.ink);
  });
  s += nest(artSVG(art, 'light'), 690, 120, 480, 300);
  s += nest(headSVG('light'), 980, 410, 150, 200);
  const fw = measure('font', 46);
  s += text('font', 46, 130, 560, t.ink) + text('sketch', 46, 130 + fw + 2, 560, t.ver);
  s += text('kwy404.github.io/fontsketch', 24, 470, 556, t.soft);
  return `${s}</svg>`;
}

function findBrowser() {
  const candidates = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  return candidates.find((c) => existsSync(c));
}

/** Renders SVG strings to PNG files with a headless browser. */
export function renderPng(jobs) {
  const browser = findBrowser();
  if (!browser) {
    console.warn('build-art: no Edge or Chrome found, PNG images skipped');
    return false;
  }
  const tmp = join(root, 'tmp', 'png');
  mkdirSync(tmp, { recursive: true });
  for (const [i, job] of jobs.entries()) {
    const html = join(tmp, `job-${i}.html`);
    const svgFile = join(tmp, `job-${i}.svg`);
    writeFileSync(svgFile, job.svg);
    writeFileSync(html, `<!doctype html><html><body style="margin:0;overflow:hidden"><img src="job-${i}.svg" width="${job.width}" height="${job.height}" style="display:block"></body></html>`);
    const out = join(root, job.out);
    mkdirSync(dirname(out), { recursive: true });
    execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${join(tmp, 'profile')}`, `--window-size=${job.width},${job.height}`, `--screenshot=${out}`, pathToFileURL(html).href], { stdio: 'ignore', timeout: 60000 });
  }
  rmSync(tmp, { recursive: true, force: true });
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arts = buildArt();
  if (process.argv.includes('--png')) {
    renderPng([
      { svg: socialSVG(1280, 640), width: 1280, height: 640, out: 'assets/social-preview.png' },
      { svg: socialSVG(1200, 630), width: 1200, height: 630, out: 'docs/og.png' },
    ]);
  }
  console.log(`build-art: ${arts.length} illustrations, ${Object.keys(ICONS).length} icons, mascot and banners written`);
}
