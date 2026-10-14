import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFont, serialize, fontInfo, buildProject, fromSvgFolder, makeInstance, readFontFile } from '../src/node.mjs';
import { sampleFont, sampleVariableFont } from './helpers.mjs';

const bin = fileURLToPath(new URL('../bin/fontsketch.mjs', import.meta.url));
let dir;

const run = (...args) => spawnSync(process.execPath, [bin, ...args], { cwd: dir, encoding: 'utf8' });

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'fontsketch-cli-'));
  writeFileSync(join(dir, 'sketch.fontsketch.json'), serialize(sampleFont()));
  writeFileSync(join(dir, 'variable.fontsketch.json'), serialize(sampleVariableFont()));
  mkdirSync(join(dir, 'icons'));
  writeFileSync(join(dir, 'icons', 'home.svg'), '<svg viewBox="0 0 24 24"><path d="M3 12 12 3l9 9h-3v9H6v-9z"/></svg>');
  writeFileSync(join(dir, 'icons', 'Star Filled.svg'), '<svg viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9"/></svg>');
  writeFileSync(join(dir, 'icons', 'ring-uE0A0.svg'), '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zm0 4a6 6 0 1 1 0 12a6 6 0 1 1 0-12z"/></svg>');
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('fontsketch CLI', () => {
  it('prints help and the version', () => {
    expect(run('--help').stdout).toMatch(/fontsketch build <project\.fontsketch\.json>/);
    expect(run().stdout).toMatch(/Usage:/);
    expect(run('-v').stdout.trim()).toBe(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
  });

  it('builds a project into fonts and a stylesheet', () => {
    const r = run('build', 'sketch.fontsketch.json', '-o', 'out', '--formats', 'ttf,otf,woff,woff2', '--hinting', 'auto', '--legacy-kern');
    expect(r.status, r.stderr).toBe(0);
    const files = readdirSync(join(dir, 'out')).sort();
    expect(files).toEqual(['SketchTest-Regular.css', 'SketchTest-Regular.otf', 'SketchTest-Regular.ttf', 'SketchTest-Regular.woff', 'SketchTest-Regular.woff2']);
    const css = readFileSync(join(dir, 'out', 'SketchTest-Regular.css'), 'utf8');
    expect(css).toMatch(/url\("\.\/SketchTest-Regular\.woff2"\) format\("woff2"\),\s+url\("\.\/SketchTest-Regular\.woff"\)/);
    const font = parseFont(new Uint8Array(readFileSync(join(dir, 'out', 'SketchTest-Regular.woff2'))));
    expect(font.meta.family).toBe('Sketch Test');
  });

  it('builds a variable font and writes static instances', () => {
    const r = run('build', 'variable.fontsketch.json', '-o', 'vf', '--variable', '--formats', 'ttf,woff2', '--no-css');
    expect(r.status, r.stderr).toBe(0);
    expect(readdirSync(join(dir, 'vf')).sort()).toEqual(['SketchTest-Regular-VF.ttf', 'SketchTest-Regular-VF.woff2']);
    const inst = run('instance', 'vf/SketchTest-Regular-VF.ttf', '--wght', '700', '-o', 'bold.ttf');
    expect(inst.status, inst.stderr).toBe(0);
    expect(inst.stdout).toMatch(/style "Bold"/);
    const bold = parseFont(new Uint8Array(readFileSync(join(dir, 'bold.ttf'))));
    expect(bold.axes).toBeUndefined();
    expect(bold.meta.weightClass).toBe(700);
    const xs = bold.glyphs.I.contours[0].points.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(110);
    const woff2 = run('instance', 'vf/SketchTest-Regular-VF.woff2', '--wght', '250', '--format', 'woff2');
    expect(woff2.status, woff2.stderr).toBe(0);
    expect(readdirSync(dir)).toContain('SketchTest-W250.woff2');
  });

  it('makes an icon font with CSS and an HTML preview', () => {
    const r = run('from-svg', 'icons', '--family', 'My Icons', '-o', 'icons-out', '--prefix', 'mi');
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/3 icons/);
    const out = join(dir, 'icons-out');
    expect(readdirSync(out).sort()).toEqual(['MyIcons-Regular.css', 'MyIcons-Regular.ttf', 'MyIcons-Regular.woff', 'MyIcons-Regular.woff2', 'index.html']);
    const css = readFileSync(join(out, 'MyIcons-Regular.css'), 'utf8');
    expect(css).toContain('.mi-home::before { content: "\\e000"; }');
    expect(css).toContain('.mi-ring::before { content: "\\e0a0"; }');
    expect(css).toContain('.mi-star-filled::before { content: "\\e001"; }');
    expect(readFileSync(join(out, 'index.html'), 'utf8')).toContain('<i class="mi mi-home"');
    const font = parseFont(new Uint8Array(readFileSync(join(out, 'MyIcons-Regular.ttf'))));
    expect(font.glyphs.ring.unicodes).toEqual([0xe0a0]);
    expect(font.glyphs.ring.contours).toHaveLength(2);
  });

  it('prints font information as text and JSON', () => {
    const text = run('info', 'out/SketchTest-Regular.ttf');
    expect(text.status, text.stderr).toBe(0);
    expect(text.stdout).toMatch(/Family\s+Sketch Test/);
    expect(text.stdout).toMatch(/Hinted\s+yes/);
    const json = JSON.parse(run('info', 'vf/SketchTest-Regular-VF.woff2', '--json').stdout);
    expect(json).toMatchObject({ format: 'woff2', variable: true, unitsPerEm: 1000 });
    expect(json.axes[0].tag).toBe('wght');
    expect(json.instances).toHaveLength(9);
  });

  it('fails with a helpful message', () => {
    expect(run('nope').stderr).toMatch(/unknown command "nope"/);
    expect(run('build').stderr).toMatch(/needs a project file/);
    expect(run('build', 'sketch.fontsketch.json', '--hinting', 'loud').stderr).toMatch(/unknown hinting mode/);
    expect(run('instance', 'out/SketchTest-Regular.ttf').stderr).toMatch(/at least one axis/);
    expect(run('instance', 'out/SketchTest-Regular.ttf', '--wght', '700').stderr).toMatch(/no axes/);
    expect(run('info', 'missing.ttf').status).toBe(1);
  });
});

describe('Node API', () => {
  it('exposes the CLI helpers', () => {
    const out = join(dir, 'api');
    const written = buildProject(sampleFont(), { out, formats: ['woff'] });
    expect(written.map((w) => w.path.split(/[\\/]/).pop())).toEqual(['SketchTest-Regular.woff', 'SketchTest-Regular.css']);
    const info = fontInfo(new Uint8Array(readFileSync(written[0].path)));
    expect(info).toMatchObject({ format: 'woff', glyphs: 22, kerningClasses: 2, hinted: false });
    const { icons } = fromSvgFolder(join(dir, 'icons'), { out: join(dir, 'api-icons'), formats: ['ttf'], start: 0xf000 });
    expect(icons.map((i) => i.code.toString(16))).toEqual(['f000', 'e0a0', 'f001']);
    const { font, bytes } = makeInstance(sampleVariableFont(), { wght: 900 }, { format: 'otf' });
    expect(font.meta.style).toBe('Black');
    expect(parseFont(bytes).glyphs.H.advanceWidth).toBe(700);
    expect(readFontFile(join(dir, 'sketch.fontsketch.json')).meta.family).toBe('Sketch Test');
    writeFileSync(join(dir, 'junk.json'), '{"a":1}');
    expect(() => readFontFile(join(dir, 'junk.json'))).toThrow(/not a font file or fontsketch project/);
    expect(() => execFileSync(process.execPath, [bin, 'from-svg', join(dir, 'api')], { stdio: 'pipe' })).toThrow();
  });
});
