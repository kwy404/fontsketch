#!/usr/bin/env node
// fontsketch command line: build projects, make icon fonts, inspect fonts
// and write static instances of variable fonts.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProject, fromSvgFolder, fontInfo, makeInstance } from '../src/node.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8'));

const HELP = `fontsketch ${pkg.version}: create fonts from the command line

Usage:
  fontsketch build <project.fontsketch.json> [-o <dir>] [--formats ttf,woff2]
                   [--hinting auto|manual|none] [--variable] [--outlines truetype|cff]
                   [--legacy-kern] [--no-css]
  fontsketch from-svg <folder> --family <name> [-o <dir>] [--formats woff2,woff,ttf]
                   [--start E000] [--prefix icon]
  fontsketch info <font.ttf|otf|woff|woff2> [--json]
  fontsketch instance <font> --wght 700 [--<axis> <value> ...] [-o <file>] [--format ttf]

Options:
  -o, --out       output folder (build, from-svg) or file (instance)
  -h, --help      show this help
  -v, --version   show the version
`;

/** @param {string[]} argv */
function parseArgs(argv) {
  const positional = [];
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o') flags.out = argv[++i] ?? '';
    else if (a === '-h') flags.help = true;
    else if (a === '-v') flags.version = true;
    else if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const key = eq > 0 ? a.slice(2, eq) : a.slice(2);
      if (eq > 0) flags[key] = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) flags[key] = argv[++i];
      else if (i + 1 < argv.length && /^-\d/.test(argv[i + 1])) flags[key] = argv[++i];
      else flags[key] = true;
    } else positional.push(a);
  }
  return { positional, flags };
}

function fail(message) {
  process.stderr.write(`fontsketch: ${message}\n`);
  process.exit(1);
}

const list = (v, fallback) => (typeof v === 'string' ? v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : fallback);
const warn = (m) => process.stderr.write(`warning: ${m}\n`);
const size = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [command, target] = positional;
  if (flags.version) {
    process.stdout.write(`${pkg.version}\n`);
    return;
  }
  if (flags.help || !command) {
    process.stdout.write(HELP);
    return;
  }
  switch (command) {
    case 'build': {
      if (!target) fail('build needs a project file');
      const hinting = String(flags.hinting || 'none');
      if (!['auto', 'manual', 'none'].includes(hinting)) fail(`unknown hinting mode "${hinting}"`);
      const outlines = flags.outlines === 'cff' ? 'cff' : 'truetype';
      const files = buildProject(resolve(target), {
        out: typeof flags.out === 'string' ? flags.out : 'dist-fonts',
        formats: list(flags.formats, ['ttf', 'woff2']),
        hinting: /** @type {'auto' | 'manual' | 'none'} */ (hinting),
        variable: !!flags.variable,
        legacyKern: !!flags['legacy-kern'],
        outlines,
        css: !flags['no-css'],
        onWarning: warn,
      });
      for (const f of files) process.stdout.write(`wrote ${f.path} (${size(f.bytes)})\n`);
      return;
    }
    case 'from-svg': {
      if (!target) fail('from-svg needs a folder of .svg files');
      const { files, icons } = fromSvgFolder(resolve(target), {
        family: typeof flags.family === 'string' ? flags.family : 'Icons',
        out: typeof flags.out === 'string' ? flags.out : 'dist-icons',
        formats: list(flags.formats, ['woff2', 'woff', 'ttf']),
        start: typeof flags.start === 'string' ? parseInt(flags.start.replace(/^u\+?|^0x/i, ''), 16) : undefined,
        prefix: typeof flags.prefix === 'string' ? flags.prefix : 'icon',
        onWarning: warn,
      });
      process.stdout.write(`${icons.length} icons\n`);
      for (const f of files) process.stdout.write(`wrote ${f.path} (${size(f.bytes)})\n`);
      return;
    }
    case 'info': {
      if (!target) fail('info needs a font file');
      const info = fontInfo(new Uint8Array(readFileSync(resolve(target))));
      if (flags.json) {
        process.stdout.write(`${JSON.stringify(info, null, 2)}\n`);
        return;
      }
      const rows = [
        ['Family', info.family], ['Style', info.style], ['Full name', info.fullName], ['PostScript name', info.postscriptName],
        ['Version', info.version], ['Format', `${info.format} (${info.outlines} outlines)`], ['Size', size(info.size)],
        ['Units per em', info.unitsPerEm], ['Ascender / descender', `${info.ascender} / ${info.descender}`],
        ['x-height / cap height', `${info.xHeight} / ${info.capHeight}`], ['Weight class', info.weightClass ?? ''],
        ['Glyphs', info.glyphs], ['Characters', info.characters], ['Kerning', `${info.kerningPairs} pairs, ${info.kerningClasses} classes`],
        ['Hinted', info.hinted ? 'yes' : 'no'], ['Variable', info.variable ? info.axes.map((a) => `${a.tag} ${a.min} to ${a.max} (default ${a.default})`).join(', ') : 'no'],
      ];
      if (info.instances.length) rows.push(['Instances', info.instances.map((i) => i.name).join(', ')]);
      if (info.designer) rows.push(['Designer', info.designer]);
      if (info.license) rows.push(['License', info.license]);
      rows.push(['Tables', info.tables.map((t) => t.tag.trim()).join(' ')]);
      if (info.checksumProblems.length) rows.push(['Checksums', info.checksumProblems.join('; ')]);
      const width = Math.max(...rows.map(([k]) => String(k).length));
      for (const [k, v] of rows) process.stdout.write(`${String(k).padEnd(width)}  ${v}\n`);
      return;
    }
    case 'instance': {
      if (!target) fail('instance needs a variable font');
      const reserved = new Set(['out', 'format', 'help', 'version', 'hinting']);
      /** @type {Record<string, number>} */
      const location = {};
      for (const [k, v] of Object.entries(flags)) {
        if (reserved.has(k)) continue;
        const n = Number(v);
        if (!Number.isFinite(n)) fail(`--${k} needs a number`);
        location[k.length < 4 ? k.padEnd(4, ' ') : k] = n;
      }
      if (!Object.keys(location).length) fail('instance needs at least one axis value, for example --wght 700');
      const format = typeof flags.format === 'string' ? flags.format : 'ttf';
      if (!['ttf', 'otf', 'woff', 'woff2'].includes(format)) fail(`unknown format "${format}"`);
      const { font, bytes } = makeInstance(new Uint8Array(readFileSync(resolve(target))), location, { format: /** @type {any} */ (format) });
      const outPath = resolve(typeof flags.out === 'string' ? flags.out : `${font.meta.family.replace(/\s+/g, '')}-${font.meta.style.replace(/\s+/g, '')}.${format}`);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, bytes);
      process.stdout.write(`wrote ${outPath} (${size(bytes.length)}), style "${font.meta.style}"\n`);
      return;
    }
    default:
      fail(`unknown command "${command}" (try --help)`);
  }
}

try {
  main();
} catch (err) {
  fail(/** @type {Error} */ (err).message);
}
