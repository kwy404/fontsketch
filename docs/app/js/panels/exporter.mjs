// Export: TTF, OTF, WOFF, WOFF2 and variable fonts compiled in the browser,
// a web font kit (.zip with @font-face CSS and a sample page), and the
// .fontsketch.json project file.
import { clone, compatible, embolden, matrix, transformContours } from '../geom.mjs';
import { P, projectJSON } from '../project.mjs';
import { zip } from '../zip.mjs';

const MIME = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };

export function installExport(ctx) {
  const { S, A, lib } = ctx;

  ctx.saveBytes = (bytes, name, type = 'application/octet-stream') => {
    const blob = new Blob([bytes], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const slug = (s) => (s || 'font').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'font';
  const fileBase = () => `${slug(P.font.meta.family)}-${slug(P.font.meta.style || 'Regular')}`;

  /**
   * The font as it should be compiled: drafts dropped (open pen paths are
   * closed), masters made compatible for variable output.
   */
  function exportable(variable) {
    const f = clone(P.font);
    for (const g of Object.values(f.glyphs)) {
      g.contours = (g.contours || []).filter((c) => c.points.length >= 3).map((c) => ({ ...c, closed: true }));
      if (g.components && !g.components.length) delete g.components;
    }
    if (!variable) {
      delete f.axes;
      delete f.masters;
      return f;
    }
    const axis = f.axes?.find((a) => a.tag === 'wght');
    const master = f.masters?.[0];
    if (!axis || !master) throw new Error('add a weight axis in Font settings first');
    // Glyphs whose Bold copy is missing or no longer matches the Regular
    // points are emboldened again so the font always interpolates.
    const amount = +S.variable.embolden || 40;
    let fixed = 0;
    for (const g of Object.values(f.glyphs)) {
      if (!g.contours.length) continue;
      const mg = master.glyphs[g.name];
      if (mg && compatible(g.contours, mg.contours)) continue;
      master.glyphs[g.name] = boldCopy(g, amount);
      fixed++;
    }
    if (fixed) A.toast(`${fixed} letters changed shape since the Bold master was made; they were emboldened again for this export.`);
    return f;
  }

  function boldCopy(g, amount) {
    const contours = transformContours(embolden(g.contours, amount), matrix.translate(Math.round(amount), 0)).map((c) => ({ ...c, points: c.points.map((p) => ({ ...p, x: Math.round(p.x), y: Math.round(p.y) })) }));
    return { contours, advanceWidth: Math.round(g.advanceWidth + amount * 2) };
  }
  ctx.boldCopy = boldCopy;

  /** Compiles to bytes (async because WOFF2 loads Brotli on first use). */
  ctx.compile = async ({ format = 'ttf', variable = false, hinting = S.hint.mode } = {}) => {
    const font = exportable(variable);
    if (format === 'woff2' && lib.loadBrotli) await lib.loadBrotli();
    const opts = { format, variable, hinting };
    const out = lib.exportFontAsync ? await lib.exportFontAsync(font, opts) : await lib.exportFont(font, opts);
    return out instanceof Uint8Array ? out : new Uint8Array(out);
  };

  function checkProblems() {
    const problems = lib.validateFont ? lib.validateFont(P.font) : [];
    const drawn = Object.values(P.font.glyphs).filter((g) => g.contours?.length || g.components?.length);
    if (drawn.length <= 1) problems.unshift('Only the .notdef box is drawn. Draw a few letters first.');
    S.problems = problems.slice(0, 6);
    return drawn.length > 1;
  }

  A.download = async (format, variable = false) => {
    if (S.exporting) return;
    if (!checkProblems()) return A.toast('Draw at least one letter before downloading.', 'error');
    S.exporting = true;
    try {
      const bytes = await ctx.compile({ format, variable });
      const name = `${fileBase()}${variable ? '-Variable' : ''}.${format}`;
      ctx.saveBytes(bytes, name, MIME[format]);
      flip(format, variable);
      A.toast(`Downloaded ${name} (${(bytes.length / 1024).toFixed(1)} KB)`, 'success');
      return bytes;
    } catch (e) {
      console.error(e);
      A.toast(`Export failed: ${e.message}`, 'error');
    } finally {
      S.exporting = false;
    }
  };
  A.quickDownload = () => A.download('ttf');

  function flip(format, variable) {
    const cards = [...document.querySelectorAll('.exp-card')];
    const label = `${variable ? 'Variable ' : ''}${format.toUpperCase()}`;
    const card = cards.find((c) => c.querySelector('b')?.textContent === label);
    if (!card) return;
    card.classList.remove('flip');
    void card.offsetWidth;
    card.classList.add('flip');
  }

  A.downloadKit = async () => {
    if (S.exporting) return;
    if (!checkProblems()) return A.toast('Draw at least one letter before downloading.', 'error');
    S.exporting = true;
    try {
      const base = fileBase();
      const files = [];
      const woff2 = await ctx.compile({ format: 'woff2' });
      const woff = await ctx.compile({ format: 'woff' });
      const ttf = await ctx.compile({ format: 'ttf' });
      files.push({ name: `fonts/${base}.woff2`, data: woff2 }, { name: `fonts/${base}.woff`, data: woff }, { name: `fonts/${base}.ttf`, data: ttf });
      let vname = '';
      if (S.variable.has) {
        vname = `${base}-Variable.woff2`;
        files.push({ name: `fonts/${vname}`, data: await ctx.compile({ format: 'woff2', variable: true }) });
      }
      const css = kitCss(base, vname);
      files.push({ name: 'font.css', data: css });
      files.push({ name: 'index.html', data: kitHtml(css) });
      files.push({ name: 'README.txt', data: kitReadme(base) });
      ctx.saveBytes(zip(files), `${base}-webfont-kit.zip`, 'application/zip');
      A.toast(`Downloaded the web font kit for ${P.font.meta.family}`, 'success');
    } catch (e) {
      console.error(e);
      A.toast(`Export failed: ${e.message}`, 'error');
    } finally {
      S.exporting = false;
    }
  };

  function kitCss(base, vname) {
    const m = P.font.meta;
    let css = '';
    try {
      css = lib.cssFontFace(P.font, `fonts/${base}.woff2`);
    } catch {
      css = '';
    }
    if (!css) {
      css = `@font-face {\n  font-family: "${m.family}";\n  src: url("fonts/${base}.woff2") format("woff2"),\n       url("fonts/${base}.woff") format("woff");\n  font-weight: ${m.weightClass || 400};\n  font-style: normal;\n  font-display: swap;\n}\n`;
    } else if (!css.includes('.woff"')) {
      css = css.replace(/format\(["']woff2["']\)/, `format("woff2"),\n       url("fonts/${base}.woff") format("woff")`);
    }
    if (vname) {
      css += `\n/* Variable weight: one file, every weight from ${S.variable.min} to ${S.variable.max}. */\n@font-face {\n  font-family: "${m.family} Variable";\n  src: url("fonts/${vname}") format("woff2-variations"),\n       url("fonts/${vname}") format("woff2");\n  font-weight: ${S.variable.min} ${S.variable.max};\n  font-display: swap;\n}\n`;
    }
    return css;
  }

  function kitHtml(css) {
    const m = P.font.meta;
    const fam = m.family.replace(/</g, '');
    const chars = Object.values(P.font.glyphs).filter((g) => g.unicodes?.length && (g.contours?.length || g.components?.length)).map((g) => String.fromCodePoint(g.unicodes[0])).filter((c) => c.trim()).join('');
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fam)} specimen</title>
<link rel="stylesheet" href="font.css">
<style>
  body { margin: 0; padding: 48px 24px; font: 16px/1.6 system-ui, sans-serif; color: #1f1d27; background: #fbf8f2; }
  main { max-width: 860px; margin: 0 auto; }
  .f { font-family: "${fam}", serif; }
  h1 { font-size: 72px; line-height: 1.05; margin: 0 0 24px; font-weight: normal; }
  .chars { font-size: 40px; word-break: break-all; }
  pre { background: #fff; border: 1px solid #e1d8c8; border-radius: 10px; padding: 16px; overflow: auto; font-size: 13px; }
  .waterfall p { margin: 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
</head>
<body>
<main>
  <h1 class="f">${esc(fam)}</h1>
  <p class="f chars">${esc(chars)}</p>
  <div class="waterfall f">
    ${[14, 18, 24, 36, 48].map((s) => `<p style="font-size:${s}px">The quick brown fox jumps over the lazy dog</p>`).join('\n    ')}
  </div>
  <h2>Use it on your site</h2>
  <p>Copy the fonts folder and font.css next to your pages, then:</p>
  <pre>&lt;link rel="stylesheet" href="font.css"&gt;

body { font-family: "${esc(fam)}", sans-serif; }</pre>
  <pre>${esc(css)}</pre>
  <p>Made with fontsketch, https://kwy404.github.io/fontsketch/</p>
</main>
</body>
</html>
`;
  }

  function kitReadme(base) {
    const m = P.font.meta;
    return `${m.family} ${m.style}
${'='.repeat((m.family + m.style).length + 1)}

fonts/${base}.woff2  smallest file, for every modern browser
fonts/${base}.woff   for older browsers
fonts/${base}.ttf    install it on your computer (double click) or use it in apps
font.css             the @font-face rules
index.html           a specimen page

Designer: ${m.designer || 'unknown'}
License: ${m.license || 'not set'}
Version: ${m.version}

Made with fontsketch: https://kwy404.github.io/fontsketch/
`;
  }

  A.saveProjectFile = () => {
    const text = projectJSON();
    ctx.saveBytes(new TextEncoder().encode(text), `${slug(P.font.meta.family)}.fontsketch.json`, 'application/json');
    A.toast('Project file saved. Open it later from Uploads or the start screen.', 'success');
  };

  const prevPanel = ctx.onPanel;
  ctx.onPanel = (p) => {
    if (p === 'export') checkProblems();
    prevPanel?.(p);
  };
}
