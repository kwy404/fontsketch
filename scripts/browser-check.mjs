// Loads every export variant in a real browser with FontFace and checks the
// measured text widths (advances, kerning, composites, variable weights).
// Usage: node scripts/browser-check.mjs [path-to-chromium-browser]
// Uses BROWSER, then common Edge and Chrome install paths. Not part of CI.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { exportFont, interpolate, composeAll } from '../src/node.mjs';
import { sampleFont, sampleVariableFont, flatKerning } from '../test/helpers.mjs';

const candidates = [
  process.argv[2], process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/microsoft-edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const browser = candidates.find((p) => existsSync(p));
if (!browser) {
  console.error('browser-check: no Chromium based browser found (pass its path or set BROWSER)');
  process.exit(1);
}

const font = sampleFont();
composeAll(font, { chars: [...'\u00e1\u00e3\u00e7\u00c1\u00c3\u00d3'] });
const kern = flatKerning(font);
const strings = ['HOxo', 'AVAVA', 'ooxx', '\u00e1\u00e3\u00e7', '\u00c1\u00c3\u00d3', 'Ox\u{1F642}'];
const glyphOf = (f, ch) => Object.values(f.glyphs).find((g) => g.unicodes.includes(ch.codePointAt(0)));
const expected = (f, s, k) => {
  const chars = [...s];
  return chars.reduce((w, c, i) => w + glyphOf(f, c).advanceWidth + (i + 1 < chars.length ? k[`${glyphOf(f, c).name}|${glyphOf(f, chars[i + 1]).name}`] || 0 : 0), 0);
};
const cases = [];
for (const format of ['ttf', 'otf', 'woff', 'woff2']) {
  for (const options of [{}, { hinting: 'auto' }, { legacyKern: true }]) {
    const bytes = exportFont(font, { format, ...options });
    cases.push({ id: `${format} ${JSON.stringify(options)}`, b64: Buffer.from(bytes).toString('base64'), expect: strings.map((s) => expected(font, s, kern)) });
  }
}
const vf = sampleVariableFont();
const weights = [100, 250, 400, 650, 900];
const vcases = ['ttf', 'woff2'].map((format) => ({
  id: `variable ${format}`,
  b64: Buffer.from(exportFont(vf, { format, variable: true })).toString('base64'),
  expect: weights.map((w) => expected(interpolate(vf, { wght: w }), 'HHI', {})),
}));

const html = `<!doctype html><meta charset="utf-8"><pre id="out">running</pre><div id="stage"></div><script>
const cases = ${JSON.stringify(cases)}, vcases = ${JSON.stringify(vcases)}, strings = ${JSON.stringify(strings)}, weights = ${JSON.stringify(weights)};
const bytes = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
(async () => {
  const out = [];
  const ctx = document.createElement('canvas').getContext('2d');
  for (const [i, c] of cases.entries()) {
    try {
      const f = new FontFace('S' + i, bytes(c.b64)); await f.load(); document.fonts.add(f);
      ctx.font = '1000px S' + i;
      const widths = strings.map((s) => Math.round(ctx.measureText(s).width));
      out.push({ id: c.id, ok: widths.every((w, k) => Math.abs(w - c.expect[k]) <= 1), widths, expect: c.expect });
    } catch (e) { out.push({ id: c.id, ok: false, error: String(e) }); }
  }
  for (const [i, c] of vcases.entries()) {
    try {
      const f = new FontFace('V' + i, bytes(c.b64), { weight: '100 900' }); await f.load(); document.fonts.add(f);
      const widths = weights.map((w) => {
        const s = document.createElement('span');
        s.style.cssText = 'position:absolute;white-space:pre;font:1000px V' + i + ';font-variation-settings:"wght" ' + w;
        s.textContent = 'HHI'; document.getElementById('stage').appendChild(s);
        const width = Math.round(s.getBoundingClientRect().width); s.remove(); return width;
      });
      out.push({ id: c.id, ok: widths.every((w, k) => Math.abs(w - c.expect[k]) <= 2), widths, expect: c.expect });
    } catch (e) { out.push({ id: c.id, ok: false, error: String(e) }); }
  }
  document.getElementById('out').textContent = 'RESULT ' + JSON.stringify(out);
})();
</script>`;
const dir = mkdtempSync(join(tmpdir(), 'fontsketch-browser-'));
const page = join(dir, 'check.html');
writeFileSync(page, html);
let dom = '';
try {
  dom = execFileSync(browser, ['--headless=new', '--disable-gpu', '--virtual-time-budget=15000', '--dump-dom', pathToFileURL(page).href], { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'ignore'] });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
const match = /RESULT ([^<]*)/.exec(dom);
if (!match) {
  console.error('browser-check: the page did not finish');
  process.exit(1);
}
const results = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id}${r.ok ? '' : ` ${r.error || JSON.stringify({ widths: r.widths, expect: r.expect })}`}`);
}
console.log(`${results.length - failed} of ${results.length} fonts loaded with FontFace and measured as expected`);
process.exit(failed ? 1 : 0);
