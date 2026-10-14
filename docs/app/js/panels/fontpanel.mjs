// Font settings: hinting (auto, manual stems per letter, a pixel preview of
// grid fitting) and the variable weight axis (Bold master by auto
// emboldening or by hand, live weight preview).
import { clone, flatten, interpolate, resolve, tracePath } from '../geom.mjs';
import { P, history } from '../project.mjs';
import { css, drawLine, fitCanvas } from '../render.mjs';

/** Ink spans along a horizontal line (y) or a vertical line (x). */
function spans(polys, axis, at) {
  const xs = [];
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j];
      const b = poly[i];
      const [a1, a2, b1, b2] = axis === 'y' ? [a.y, a.x, b.y, b.x] : [a.x, a.y, b.x, b.y];
      if ((a1 <= at && b1 > at) || (b1 <= at && a1 > at)) xs.push(a2 + ((at - a1) / (b1 - a1)) * (b2 - a2));
    }
  }
  xs.sort((p, q) => p - q);
  const out = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([Math.round(xs[i]), Math.round(xs[i + 1] - xs[i])]);
  return out;
}

/**
 * Stems of a glyph: vertical stems are ink spans across a horizontal line
 * near half the x-height (or cap height), horizontal stems are spans along a
 * vertical line through the middle. Only stem like spans are kept.
 */
export function detectStems(contours, meta) {
  const polys = contours.map((c) => flatten(c, 8));
  if (!polys.length) return { v: [], h: [] };
  let yMax = -Infinity, xMin = Infinity, xMax = -Infinity;
  for (const p of polys.flat()) {
    yMax = Math.max(yMax, p.y);
    xMin = Math.min(xMin, p.x);
    xMax = Math.max(xMax, p.x);
  }
  const ref = yMax > meta.xHeight * 1.2 ? meta.capHeight : meta.xHeight;
  const maxW = meta.unitsPerEm * 0.25;
  const v = spans(polys, 'y', ref * 0.42).filter(([, w]) => w > 4 && w < maxW);
  const h = spans(polys, 'x', (xMin + xMax) / 2).filter(([, w]) => w > 4 && w < maxW);
  return { v, h };
}

export function installFontPanel(ctx) {
  const { S, A, editor } = ctx;
  const hintEl = document.getElementById('hint-preview');
  const wcv = document.getElementById('weight-canvas');

  // ---------- Hinting ----------

  function syncStems() {
    const g = editor.glyph;
    const st = g?.hints?.stems || {};
    S.hint.stems = [...(st.v || []).map(([pos, width]) => ({ dir: 'v', pos, width })), ...(st.h || []).map(([pos, width]) => ({ dir: 'h', pos, width }))];
    drawHintPreview();
  }

  A.detectStems = (all) => {
    const names = all ? Object.values(P.font.glyphs).filter((g) => g.contours.length).map((g) => g.name) : [editor.name];
    history.run('Detect stems', names, () => {
      for (const n of names) {
        const g = P.font.glyphs[n];
        const st = detectStems(g.contours, P.font.meta);
        g.hints = { ...(g.hints || {}), stems: st };
      }
    });
    S.opts.stems = true;
    editor.redraw();
    A.toast(all ? `Stems found in ${names.length} letters` : `${S.hint.stems.length} stems in ${S.glyph.label}`);
  };
  A.setStem = (i, key, v) => {
    const s = S.hint.stems[i];
    if (!s || !Number.isFinite(v)) return;
    const g = editor.glyph;
    history.run('Edit stem', [g.name], () => {
      const list = g.hints.stems[s.dir];
      const idx = S.hint.stems.filter((x, j) => x.dir === s.dir && j < i).length;
      list[idx][key === 'pos' ? 0 : 1] = Math.round(v);
    });
  };
  A.deleteStem = (i) => {
    const s = S.hint.stems[i];
    const g = editor.glyph;
    history.run('Delete stem', [g.name], () => {
      const idx = S.hint.stems.filter((x, j) => x.dir === s.dir && j < i).length;
      g.hints.stems[s.dir].splice(idx, 1);
    });
  };
  A.addStem = (dir) => {
    const pts = [...editor.sel].map((k) => editor.pointByKey(k)).filter(Boolean);
    if (pts.length < 2) return A.toast('Select two points on opposite edges of the stem first (Pro mode, select tool).');
    const vals = pts.map((p) => (dir === 'v' ? p.x : p.y));
    const a = Math.min(...vals);
    const b = Math.max(...vals);
    const g = editor.glyph;
    history.run('Add stem', [g.name], () => {
      g.hints = g.hints || {};
      g.hints.stems = g.hints.stems || { v: [], h: [] };
      g.hints.stems[dir] = [...(g.hints.stems[dir] || []), [a, b - a]];
    });
  };

  /**
   * Pixel preview: the letter rasterized at small sizes, plain and with its
   * stem edges snapped to whole pixels (what hinting does on screen).
   */
  function drawHintPreview() {
    if (!hintEl || S.panel !== 'font' || !S.pro) return;
    const g = editor.glyph;
    hintEl.replaceChildren();
    if (!g || !g.contours.length) return;
    const st = g.hints?.stems || detectStems(g.contours, P.font.meta);
    for (const ppem of [12, 18]) {
      for (const fitOn of [false, true]) {
        const wrap = document.createElement('figure');
        wrap.style.margin = '0';
        const cv = document.createElement('canvas');
        const m = P.font.meta;
        const s = ppem / m.unitsPerEm;
        const W = Math.ceil(g.advanceWidth * s) + 2;
        const H = Math.ceil((m.ascender - m.descender) * s);
        cv.width = W;
        cv.height = H;
        const zoom = Math.max(4, Math.floor(72 / H));
        cv.style.width = `${W * zoom}px`;
        cv.style.height = `${H * zoom}px`;
        const c = cv.getContext('2d');
        c.fillStyle = '#fff';
        c.fillRect(0, 0, W, H);
        const fx = fitOn ? edgeMap((st.v || []).flatMap(([p, w]) => [p, p + w]), s) : (x) => x * s;
        const fy = fitOn ? edgeMap([0, m.xHeight, m.capHeight, ...(st.h || []).flatMap(([p, w]) => [p, p + w])], s) : (y) => y * s;
        c.fillStyle = '#111';
        c.beginPath();
        tracePath(c, resolve(P.font, g), (x, y) => [1 + fx(x), m.ascender * s - fy(y)]);
        c.fill('nonzero');
        const cap = document.createElement('figcaption');
        cap.style.cssText = 'font-size:10px;color:var(--ink-3);text-align:center';
        cap.textContent = `${ppem}px ${fitOn ? 'hinted' : 'plain'}`;
        wrap.append(cv, cap);
        hintEl.append(wrap);
      }
    }
  }
  /** Piecewise linear map that rounds the given edges to whole pixels. */
  function edgeMap(edges, s) {
    const e = [...new Set(edges.map(Math.round))].sort((a, b) => a - b);
    if (!e.length) return (v) => v * s;
    const to = e.map((v) => Math.round(v * s));
    return (v) => {
      if (v <= e[0]) return to[0] + (v - e[0]) * s;
      if (v >= e[e.length - 1]) return to[to.length - 1] + (v - e[e.length - 1]) * s;
      let i = 0;
      while (e[i + 1] < v) i++;
      const t = (v - e[i]) / (e[i + 1] - e[i] || 1);
      return to[i] + (to[i + 1] - to[i]) * t;
    };
  }

  // ---------- Variable weight ----------

  A.addWeightAxis = (auto) => {
    const min = Math.round(+S.variable.min) || 100;
    const def = Math.round(+S.variable.def) || 400;
    const max = Math.round(+S.variable.max) || 900;
    if (!(min <= def && def < max)) return A.toast('The axis needs min \u2264 default < max.', 'error');
    const amount = +S.variable.embolden || 40;
    history.run(auto ? 'Create Bold master' : 'Duplicate master', 'font', () => {
      P.font.axes = [{ tag: 'wght', name: 'Weight', min, default: def, max }];
      const glyphs = {};
      for (const g of Object.values(P.font.glyphs)) {
        if (!g.contours.length) continue;
        glyphs[g.name] = auto ? ctx.boldCopy(g, amount) : { contours: clone(g.contours), advanceWidth: g.advanceWidth };
      }
      P.font.masters = [{ name: 'Bold', location: { wght: max }, glyphs }];
      P.font.instances = [
        { name: 'Regular', location: { wght: def } },
        { name: 'Bold', location: { wght: max } },
      ];
    });
    S.variable.preview = max;
    if (!auto) A.setMaster(1);
    A.toast(auto ? 'Bold master created. Drag the weight slider to see every weight in between.' : 'Bold master duplicated. Move points to make it bolder; the structure stays locked.', 'success');
    requestAnimationFrame(A.drawWeightPreview);
  };
  A.reembolden = () => {
    const amount = +S.variable.embolden || 40;
    history.run('Re-embolden', 'font', () => {
      const m = P.font.masters[0];
      for (const g of Object.values(P.font.glyphs)) if (g.contours.length) m.glyphs[g.name] = ctx.boldCopy(g, amount);
    });
    A.drawWeightPreview();
  };
  A.removeAxis = () => {
    if (!confirm('Remove the weight axis and the Bold master?')) return;
    history.run('Remove axis', 'font', () => {
      delete P.font.axes;
      delete P.font.masters;
      delete P.font.instances;
    });
    A.setMaster(0);
  };
  A.setMaster = (i) => {
    S.master = i;
    editor.sel.clear();
    ctx.syncGlyph();
    editor.redraw();
  };
  A.drawWeightPreview = () => {
    if (!wcv || !S.variable.has || S.panel !== 'font') return;
    const w = wcv.clientWidth || 300;
    const h = wcv.clientHeight || 110;
    const c = fitCanvas(wcv, w, h);
    c.fillStyle = css('--ed-canvas') || '#fff';
    c.fillRect(0, 0, w, h);
    const t = (S.variable.preview - S.variable.def) / Math.max(1, S.variable.max - S.variable.def);
    const text = 'Hamburgefonts';
    const size = h * 0.55;
    const width = drawLine(c, P.font, text, { x: -1e5, baseline: -1e5, size, color: 'transparent', t: Math.max(0, t) });
    const fit = Math.min(size, (size * (w - 24)) / Math.max(1, width));
    drawLine(c, P.font, text, { x: 12, baseline: h * 0.68, size: fit, color: css('--ink') || '#222', t: Math.max(0, Math.min(1, t)) });
  };

  const prevSelected = ctx.onGlyphSelected;
  ctx.onGlyphSelected = (name) => {
    syncStems();
    prevSelected?.(name);
  };
  const prevChanged = ctx.onChanged;
  ctx.onChanged = (kind, glyphs) => {
    syncStems();
    if (S.panel === 'font') A.drawWeightPreview();
    prevChanged?.(kind, glyphs);
  };
  const prevPanel = ctx.onPanel;
  ctx.onPanel = (p) => {
    if (p === 'font') requestAnimationFrame(() => {
      syncStems();
      A.drawWeightPreview();
    });
    prevPanel?.(p);
  };
  void interpolate;
}
