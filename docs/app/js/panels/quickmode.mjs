// Quick mode: pick a style (script, block or pixel), draw the lowercase
// letters one after another on the main canvas with a faint guide letter,
// then let finishQuick() add the capitals, digits, punctuation, accents and
// spacing. Also the style switcher in the Draw panel and the "font is ready"
// dialog with a live sample in the new font.
import { status } from '../geom.mjs';
import { P, autosave, history } from '../project.mjs';
import { STYLES, finishQuick, guideFor, quickQueue, styleById } from '../quick.mjs';
import { css, fitCanvas } from '../render.mjs';
import { drawSample } from './templates.mjs';

const TIPS = {
  script: 'Write it the way you write by hand. Join the strokes or leave gaps, both work.',
  block: 'Bold and simple. Draw each stroke once; overlaps merge by themselves.',
  pixel: 'Click or drag to fill squares. Switch to the eraser (E) to clear them.',
};

export function installQuick(ctx) {
  const { S, A, lib, editor } = ctx;
  const $ = (s) => document.querySelector(s);
  const dots = $('#qb-dots');
  let queue = [];
  let source = null;
  let sourceStyle = '';

  async function loadSource(st) {
    if (source && sourceStyle === st.id) return source;
    try {
      source = await ctx.fetchTemplate(st.template);
      sourceStyle = st.id;
    } catch {
      source = null;
    }
    return source;
  }

  // ---------- Styles ----------

  /** Sets the brush, grid and tool for a style. */
  ctx.applyStyle = (id) => {
    const st = styleById(id);
    Object.assign(S.brush, st.brush);
    S.brush.cell = st.pixel || S.brush.cell || 100;
    S.opts.grid = !!st.pixel;
    if (st.pixel) S.opts.gridSize = st.pixel;
    A.setTool('brush');
    editor.redraw();
    ctx.onBrushChanged?.();
  };
  A.useStyle = (id) => {
    const st = styleById(id);
    ctx.applyStyle(id);
    A.savePrefs();
    A.toast(st.pixel ? 'Pixel style: every stroke fills whole squares on the grid.' : `${st.name} style brush`);
  };

  // ---------- Start ----------

  A.startQuick = async (id) => {
    if (S.quick.busy) return;
    const st = styleById(id);
    S.quick.busy = true;
    try {
      await autosave();
      await loadSource(st);
      queue = quickQueue({ capitals: S.quick.capitals });
      ctx.openFont(lib.createFont({ family: st.family }), { extras: { charset: 'latin1', style: st.id } });
      Object.assign(S.quick, { on: true, style: st.id, i: 0, total: queue.length, report: [], tip: TIPS[st.id] });
      ctx.applyStyle(st.id);
      A.closeStart();
      A.closePanel();
      renderDots();
      go(0);
    } finally {
      S.quick.busy = false;
    }
  };

  /** Keeps the letter clear of the quick bar. */
  function placeInsets() {
    const bar = $('.quickbar');
    const stage = $('#stage').getBoundingClientRect();
    if (!S.quick.on || !bar || !bar.offsetHeight) editor.inset = null;
    else {
      const r = bar.getBoundingClientRect();
      editor.inset = r.top - stage.top < stage.height / 2 ? { top: Math.max(0, r.bottom - stage.top - 20), bottom: 0 } : { top: 0, bottom: Math.max(0, stage.bottom - r.top + 6) };
    }
    editor.fit();
  }
  addEventListener('resize', () => S.quick.on && requestAnimationFrame(placeInsets));

  function go(i) {
    if (!queue.length) return;
    i = Math.max(0, Math.min(queue.length - 1, i));
    S.quick.i = i;
    const ch = queue[i];
    S.quick.char = ch;
    A.selectChar(ch);
    showGuide();
    sync();
    requestAnimationFrame(placeInsets);
    $('#cv').focus({ preventScroll: true });
  }

  function showGuide() {
    const ch = S.quick.char;
    const name = lib.glyphNameFor(ch);
    const g = P.font.glyphs[name];
    const guide = S.quick.on && S.quick.guide ? guideFor(P.font, source, ch) : null;
    // An empty letter takes the guide's width, so the box fits the letter.
    if (guide && g && status(g) === 'empty') g.advanceWidth = guide.advanceWidth;
    editor.guide = guide ? { name, contours: guide.contours } : null;
    editor.redraw();
  }
  A.quickGuide = () => showGuide();

  function sync() {
    if (!queue.length) return;
    const drawnNow = (ch) => status(P.font.glyphs[lib.glyphNameFor(ch)]) !== 'empty';
    S.quick.done = queue.filter(drawnNow).length;
    S.quick.here = drawnNow(queue[S.quick.i]);
    S.quick.last = S.quick.i === queue.length - 1;
    for (const b of dots.children) {
      const k = +b.dataset.i;
      const was = b.classList.contains('done');
      const now = drawnNow(queue[k]);
      b.classList.toggle('done', now);
      b.classList.toggle('cur', k === S.quick.i);
      b.setAttribute('aria-current', k === S.quick.i ? 'step' : 'false');
      if (now && !was) {
        b.classList.remove('pop');
        void b.offsetWidth;
        b.classList.add('pop');
      }
    }
    dots.children[S.quick.i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function renderDots() {
    dots.replaceChildren(
      ...queue.map((ch, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'qb-dot';
        b.dataset.i = String(i);
        b.textContent = ch;
        b.setAttribute('aria-label', `Letter ${ch}`);
        b.addEventListener('click', () => go(i));
        return b;
      }),
    );
  }

  A.quickStep = (d) => {
    if (d > 0 && S.quick.i >= queue.length - 1) return A.quickFinish();
    go(S.quick.i + d);
  };

  A.quickExit = () => {
    S.quick.on = false;
    editor.guide = null;
    requestAnimationFrame(placeInsets);
    A.toast('Quick mode is off. Your letters are saved.', 'info', 'Finish my font', () => A.quickFinish());
  };

  document.addEventListener('keydown', (e) => {
    if (!S.quick.on || e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
    if (document.querySelector('dialog[open]') || editor.penDraft) return;
    e.preventDefault();
    A.quickStep(1);
  });

  // ---------- Finish ----------

  A.quickFinish = async () => {
    if (S.quick.busy) return;
    const st = styleById(S.quick.style);
    S.quick.busy = true;
    let report;
    try {
      await loadSource(st);
      history.run('Finish the font', 'font', () => {
        report = finishQuick(P.font, lib, { source, pixel: st.pixel || 0, spacing: st.spacing || 60 });
      });
    } catch (e) {
      S.quick.busy = false;
      return A.toast(`Could not finish the font: ${e.message}`, 'error');
    }
    S.quick.on = false;
    S.quick.busy = false;
    editor.guide = null;
    editor.inset = null;
    S.letters.charset = 'latin1';
    A.setCharset();
    A.selectGlyph(P.font.glyphs.a ? 'a' : editor.name);
    S.quick.report = summary(report, source);
    S.quick.sample = S.quick.sample || 'Hello, world! Caf\u00e9 com a\u00e7\u00facar, 2026.';
    $('#quick-done').showModal();
    await renderSample(true);
  };

  function summary(r, src) {
    const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
    const lines = [];
    if (r.drawn.length) lines.push(`You drew ${n(r.drawn.length, 'letter', 'letters')}, now evenly spaced.`);
    if (r.capitals.length) lines.push(`${n(r.capitals.length, 'capital comes', 'capitals come')} from your lowercase. Draw a capital to replace it.`);
    if (r.filled.length) lines.push(`${n(r.filled.length, 'number, punctuation mark or accent', 'numbers, punctuation marks and accents')} came from ${src ? src.meta.family : 'the template'}.`);
    if (r.composed.length) lines.push(`${n(r.composed.length, 'accented letter was', 'accented letters were')} built, like ${r.composed.slice(0, 5).join(' ')}.`);
    if (r.missing.length) lines.push(`${n(r.missing.length, 'accented letter needs', 'accented letters need')} a base letter you skipped, like ${r.missing.slice(0, 6).join(' ')}.`);
    return lines;
  }

  async function renderSample(animate) {
    const box = $('#qd-sample');
    const family = await ctx.buildPreview?.();
    if (!family) return;
    box.style.fontFamily = `"${family}", serif`;
    box.classList.toggle('animate', !!animate);
    // Words stay whole when the line wraps; each letter rises on its own.
    let i = 0;
    const nodes = (S.quick.sample || ' ').split(/( +)/).filter(Boolean).map((part) => {
      if (!part.trim()) return document.createTextNode(part);
      const word = document.createElement('span');
      word.className = 'qd-word';
      for (const ch of part) {
        const s = document.createElement('span');
        s.textContent = ch;
        s.style.setProperty('--i', String(i++));
        word.append(s);
      }
      return word;
    });
    box.replaceChildren(...nodes);
  }
  A.quickSample = () => renderSample(false);
  A.quickDone = (next) => {
    $('#quick-done').close();
    if (next === 'download') {
      A.download('ttf');
    } else if (next === 'guide') A.openUseGuide();
  };

  // ---------- Style cards ----------

  async function paintStyles(rootId) {
    const root = document.getElementById(rootId);
    if (!root) return;
    if (!root.children.length) {
      for (const st of STYLES) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'qs-style';
        b.dataset.style = st.id;
        const cv = document.createElement('canvas');
        cv.setAttribute('aria-hidden', 'true');
        const name = document.createElement('b');
        name.textContent = st.name;
        const note = document.createElement('small');
        note.textContent = st.note;
        b.append(cv, name, note);
        b.setAttribute('aria-label', rootId === 'qs-styles' ? `Start a ${st.name.toLowerCase()} font: ${st.note}` : `${st.name} style: ${st.note}`);
        b.addEventListener('click', () => (rootId === 'qs-styles' ? A.startQuick(st.id) : A.useStyle(st.id)));
        root.append(b);
      }
    }
    for (const b of root.children) {
      const st = styleById(b.dataset.style);
      try {
        const font = await ctx.fetchTemplate(st.template);
        const cv = b.querySelector('canvas');
        const w = cv.clientWidth || 120;
        const h = cv.clientHeight || 54;
        const c = fitCanvas(cv, w, h);
        c.clearRect(0, 0, w, h);
        drawSample(c, font, st.sample, w, h, css('--ink') || '#222');
      } catch {
        // the name and note are enough
      }
    }
  }

  const prevStart = ctx.onStart;
  ctx.onStart = () => {
    requestAnimationFrame(() => paintStyles('qs-styles'));
    prevStart?.();
  };
  const prevPanel = ctx.onPanel;
  ctx.onPanel = (p) => {
    if (p === 'draw') requestAnimationFrame(() => paintStyles('style-chips'));
    prevPanel?.(p);
  };
  const prevTheme = ctx.onTheme;
  ctx.onTheme = () => {
    for (const id of ['qs-styles', 'style-chips']) if (document.getElementById(id)?.children.length) paintStyles(id);
    prevTheme?.();
  };
  // A pixel font always opens with the pixel brush; other fonts never do.
  const prevLoaded = ctx.onFontLoaded;
  ctx.onFontLoaded = () => {
    S.quick.on = false;
    editor.guide = null;
    editor.inset = null;
    if (P.extras.style === 'pixel') {
      if (S.brush.shape !== 'pixel') ctx.applyStyle('pixel');
    } else if (S.brush.shape === 'pixel') {
      Object.assign(S.brush, { shape: 'round', size: 70, smoothing: 45, taper: 15, pressure: false, preset: 'marker' });
      S.opts.grid = false;
    }
    prevLoaded?.();
  };
  const prevChanged = ctx.onChanged;
  ctx.onChanged = (kind, glyphs) => {
    if (S.quick.on) sync();
    prevChanged?.(kind, glyphs);
  };
  const prevSelected = ctx.onGlyphSelected;
  ctx.onGlyphSelected = (name) => {
    if (S.quick.on) {
      // Picking a letter from the strip or the grid moves quick mode with it.
      const i = queue.findIndex((ch) => lib.glyphNameFor(ch) === name);
      if (i >= 0 && i !== S.quick.i) {
        S.quick.i = i;
        S.quick.char = queue[i];
        showGuide();
        sync();
      } else if (i < 0) editor.guide = null;
    }
    prevSelected?.(name);
  };
}
