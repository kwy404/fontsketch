// Templates: the gallery of starter fonts (start screen and Templates panel),
// loading a template as a new project, and "Auto fill missing" which copies
// letters you have not drawn yet from a template, scaled to your metrics.
import { status, transformContours } from '../geom.mjs';
import { P, history } from '../project.mjs';
import { css, fitCanvas } from '../render.mjs';
import { tracePath } from '../geom.mjs';

export const TEMPLATES = [
  { id: 'quill-hand', name: 'Quill Hand', note: 'Handwritten, friendly and complete', url: '../assets/fonts/quill-hand.fontsketch.json', sample: 'Hand Aa', kind: 'Handwriting' },
  { id: 'geometric', name: 'Atelier Geometric', note: 'Heavy display letters from circles and bars', url: 'templates/geometric.fontsketch.json', sample: 'Bold Gg', kind: 'Display' },
  { id: 'rounded', name: 'Atelier Rounded', note: 'Soft monoline with round ends', url: 'templates/rounded.fontsketch.json', sample: 'Soft Rr', kind: 'Rounded' },
  { id: 'mono', name: 'Atelier Mono', note: 'Every letter the same width, for code', url: 'templates/mono.fontsketch.json', sample: 'f(x)=1', kind: 'Monospace' },
  { id: 'icons', name: 'Atelier Icons', note: 'Icons in the Private Use Area, ready for your own', url: 'templates/icons.fontsketch.json', sample: '\ue000\ue001\ue002\ue00a\ue00b', kind: 'Icon font' },
];

const cache = new Map();

export function installTemplates(ctx) {
  const { S, A, lib } = ctx;

  async function fetchTemplate(id) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) throw new Error(`Unknown template ${id}`);
    if (!cache.has(id)) {
      cache.set(
        id,
        fetch(t.url)
          .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
          })
          .catch((e) => {
            cache.delete(id);
            throw e;
          }),
      );
    }
    return lib.deserialize(await cache.get(id));
  }
  ctx.fetchTemplate = fetchTemplate;

  /** Opens a template as a new project. `fresh` keeps it unsaved until edited. */
  ctx.loadTemplateFont = async (id, { quiet = false } = {}) => {
    try {
      const font = await fetchTemplate(id);
      ctx.openFont(font, { extras: { charset: id === 'icons' ? 'all' : undefined } });
      if (!quiet) A.toast(`${font.meta.family} is ready. It is your copy now: rename it in the top bar.`, 'success');
      return true;
    } catch (e) {
      if (!quiet) A.toast(`Could not load the template: ${e.message}`, 'error');
      return false;
    }
  };
  A.loadTemplate = async (id) => {
    if (P.dirty && !confirm('Open the template as a new project? Your current project stays saved in this browser.')) return;
    await ctx.loadTemplateFont(id);
    A.closeStart();
  };

  // ---------- Gallery ----------

  function card(t) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tpl-card';
    b.dataset.id = t.id;
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    const name = document.createElement('b');
    name.textContent = t.name;
    const note = document.createElement('small');
    note.textContent = `${t.kind}. ${t.note}`;
    b.append(cv, name, note);
    b.setAttribute('aria-label', `${t.name}: ${t.kind}. ${t.note}`);
    b.addEventListener('click', () => A.loadTemplate(t.id));
    return b;
  }

  async function paintCard(b) {
    const t = TEMPLATES.find((x) => x.id === b.dataset.id);
    const cv = b.querySelector('canvas');
    try {
      const font = await fetchTemplate(t.id);
      const w = cv.clientWidth || 160;
      const h = cv.clientHeight || 92;
      const c = fitCanvas(cv, w, h);
      c.clearRect(0, 0, w, h);
      drawSample(c, font, t.sample, w, h, css('--ink') || '#222');
    } catch {
      b.querySelector('small').textContent = 'Could not load this template.';
    }
  }

  function render(rootId) {
    const root = document.getElementById(rootId);
    if (!root) return;
    if (!root.children.length) root.append(...TEMPLATES.map(card));
    requestAnimationFrame(() => [...root.children].forEach(paintCard));
  }

  const prevPanel = ctx.onPanel;
  ctx.onPanel = (p) => {
    if (p === 'templates') render('tpl-grid');
    prevPanel?.(p);
  };
  const prevStart = ctx.onStart;
  ctx.onStart = () => {
    render('tpl-start');
    paintQuill();
    prevStart?.();
  };
  const prevTheme = ctx.onTheme;
  ctx.onTheme = () => {
    for (const id of ['tpl-grid', 'tpl-start']) {
      const root = document.getElementById(id);
      if (root?.children.length) [...root.children].forEach(paintCard);
    }
    prevTheme?.();
  };

  /** The default font card shows the sample in Quill Hand itself. */
  async function paintQuill() {
    const el = document.querySelector('.sc-quill');
    if (!el || el.dataset.done) return;
    try {
      const font = await fetchTemplate('quill-hand');
      const cv = document.createElement('canvas');
      cv.style.width = '100%';
      cv.style.height = '46px';
      cv.setAttribute('aria-hidden', 'true');
      el.textContent = '';
      el.append(cv);
      requestAnimationFrame(() => {
        const c = fitCanvas(cv, cv.clientWidth || 200, 46);
        drawSample(c, font, 'Aa Bb Gg 123', cv.clientWidth || 200, 46, css('--ink') || '#222', 'left');
      });
      el.dataset.done = '1';
    } catch {
      // keep the text sample
    }
  }

  // ---------- Fill missing letters ----------

  A.fillMissing = async () => {
    let src;
    try {
      src = await fetchTemplate(S.fillFrom);
    } catch (e) {
      return A.toast(`Could not load the template: ${e.message}`, 'error');
    }
    const font = P.font;
    const scaleY = font.meta.capHeight / (src.meta.capHeight || 700);
    const names = [];
    for (const name of ctx.order) {
      const mine = font.glyphs[name];
      if (mine && status(mine) !== 'empty') continue;
      const theirs = src.glyphs[name];
      if (!theirs || status(theirs) === 'empty') continue;
      names.push(name);
    }
    if (!names.length) return A.toast('Every letter in this set is already drawn.');
    history.run('Fill missing letters', names, () => {
      for (const name of names) {
        const theirs = src.glyphs[name];
        const s = scaleY;
        const contours = transformContours(theirs.contours, [s, 0, 0, s, 0, 0]).map((c) => ({ ...c, points: c.points.map((p) => ({ ...p, x: Math.round(p.x), y: Math.round(p.y) })) }));
        const comps = (theirs.components || []).filter((c) => font.glyphs[c.glyph] || src.glyphs[c.glyph]).map((c) => ({ ...c, dx: Math.round((c.dx || 0) * s), dy: Math.round((c.dy || 0) * s) }));
        lib.addGlyph(font, { ...(font.glyphs[name] || {}), name, unicodes: theirs.unicodes, advanceWidth: Math.round(theirs.advanceWidth * s), contours, components: comps.length ? comps : undefined });
        if (theirs.anchors) font.glyphs[name].anchors = JSON.parse(JSON.stringify(theirs.anchors));
      }
    });
    A.toast(`Filled ${names.length} letters from ${src.meta.family}. Undo to take them back.`, 'success', 'Undo', () => A.undo());
  };
}

/** Draws a sample string from a font (no kerning) centered in a box. */
export function drawSample(c, font, text, w, h, color, align = 'center') {
  const cmap = new Map();
  for (const g of Object.values(font.glyphs)) for (const u of g.unicodes || []) cmap.set(u, g);
  const m = font.meta;
  const em = m.ascender - m.descender;
  let size = (h * 0.78) / (em / m.unitsPerEm);
  const items = [...text].map((ch) => cmap.get(ch.codePointAt(0)));
  const advance = items.reduce((n, g) => n + (g ? g.advanceWidth : m.unitsPerEm * 0.3), 0);
  const maxW = w * 0.9;
  if ((advance * size) / m.unitsPerEm > maxW) size = (maxW * m.unitsPerEm) / advance;
  const s = size / m.unitsPerEm;
  let x = align === 'center' ? (w - advance * s) / 2 : 4;
  const base = h / 2 + ((m.ascender + m.descender) / 2) * s * 0.9;
  c.fillStyle = color;
  for (const g of items) {
    if (g) {
      const ox = x;
      c.beginPath();
      tracePath(c, resolveSimple(font, g), (gx, gy) => [ox + gx * s, base - gy * s]);
      c.fill('nonzero');
    }
    x += (g ? g.advanceWidth : m.unitsPerEm * 0.3) * s;
  }
}

function resolveSimple(font, g, depth = 0) {
  let out = g.contours || [];
  if (depth < 4) {
    for (const c of g.components || []) {
      const base = font.glyphs[c.glyph];
      if (!base) continue;
      const s = c.scale ?? 1;
      out = out.concat(transformContours(resolveSimple(font, base, depth + 1), [s, 0, 0, s, c.dx || 0, c.dy || 0]));
    }
  }
  return out;
}
