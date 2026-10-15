// Draw panel: brush presets with live previews, basic shapes, decorative
// swashes and marks, and the per letter reference image.
import { ellipseContour, flatten, orient, polygonToContour, rectContour, roundPt, strokeOutline } from '../geom.mjs';
import { stampCells } from '../pixel.mjs';
import { P, history } from '../project.mjs';
import { css, fitCanvas } from '../render.mjs';

export const PRESETS = [
  { id: 'marker', name: 'Marker', b: { shape: 'round', size: 70, smoothing: 45, taper: 15, pressure: false } },
  { id: 'brushpen', name: 'Brush pen', b: { shape: 'round', size: 95, smoothing: 50, taper: 65, pressure: true } },
  { id: 'fineliner', name: 'Fine liner', b: { shape: 'round', size: 34, smoothing: 35, taper: 0, pressure: false } },
  { id: 'heavy', name: 'Poster', b: { shape: 'round', size: 160, smoothing: 55, taper: 0, pressure: false } },
  { id: 'chisel', name: 'Chisel', b: { shape: 'chisel', size: 100, smoothing: 45, taper: 0, angle: 30, pressure: false } },
  { id: 'calli30', name: 'Broad nib 30\u00b0', b: { shape: 'calligraphy', size: 120, smoothing: 50, taper: 0, angle: 30, pressure: true } },
  { id: 'calli45', name: 'Broad nib 45\u00b0', b: { shape: 'calligraphy', size: 120, smoothing: 50, taper: 0, angle: 45, pressure: true } },
  { id: 'pencil', name: 'Sketch pencil', b: { shape: 'round', size: 22, smoothing: 15, taper: 30, pressure: true } },
  { id: 'pixel', name: 'Pixel', b: { shape: 'pixel', size: 100, smoothing: 0, taper: 0, pressure: false } },
];

/** Swash skeletons in a unit box (x 0..1, y 0..1), drawn with a tapering round brush. */
const SWASHES = [
  { id: 'underline', name: 'Underline swash', box: 'below', pts: wave(0.02, 0.55, 0.98, 0.45, 0.25, 1.2) },
  { id: 'curl', name: 'Curl', box: 'mark', pts: spiral(0.5, 0.45, 0.42, 1.6) },
  { id: 'tail', name: 'Loop tail', box: 'right', pts: [[0, 0.9], [0.3, 0.6], [0.55, 0.15], [0.85, 0.05], [1, 0.3], [0.8, 0.55], [0.45, 0.35], [0.2, 0.05]] },
  { id: 'flourish', name: 'Flourish', box: 'above', pts: [[0, 0.3], [0.2, 0.75], [0.4, 0.85], [0.55, 0.55], [0.45, 0.3], [0.6, 0.2], [0.8, 0.45], [1, 0.75]] },
  { id: 'teardrop', name: 'Teardrop', box: 'mark', drop: true },
  { id: 'star', name: 'Sparkle', box: 'mark', sparkle: true },
];

function wave(x0, y0, x1, y1, amp, turns) {
  const out = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI * 2 * turns) * amp * (1 - t * 0.6)]);
  }
  return out;
}
function spiral(cx, cy, r, turns) {
  const out = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const a = Math.PI * 2 * turns * t;
    out.push([cx + Math.cos(a) * r * (1 - t * 0.85), cy + Math.sin(a) * r * (1 - t * 0.85)]);
  }
  return out.reverse();
}

export function installDraw(ctx) {
  const { S, A, lib, editor } = ctx;
  const presetsEl = document.getElementById('presets');
  const shapesEl = document.getElementById('shape-chips');
  const swashEl = document.getElementById('swash-chips');

  // ---------- Presets ----------

  function renderPresets() {
    if (!presetsEl.children.length) {
      for (const p of PRESETS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'preset';
        b.dataset.id = p.id;
        b.append(document.createElement('canvas'));
        const n = document.createElement('b');
        n.textContent = p.name;
        b.append(n);
        b.addEventListener('click', () => A.usePreset(p.id));
        presetsEl.append(b);
      }
    }
    const ink = css('--ink') || '#222';
    for (const b of presetsEl.children) {
      const p = PRESETS.find((x) => x.id === b.dataset.id);
      b.setAttribute('aria-pressed', S.brush.preset === p.id ? 'true' : 'false');
      const cv = b.firstChild;
      const w = cv.clientWidth || 130;
      const h = 38;
      const c = fitCanvas(cv, w, h);
      c.clearRect(0, 0, w, h);
      // A sample S-stroke in a 1000 unit box, pressure rising then falling.
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        pts.push({ x: 60 + t * 880, y: 160 + Math.sin(t * Math.PI * 2) * 70, p: Math.sin(t * Math.PI) * 0.9 + 0.1 });
      }
      const s = w / 1000;
      c.fillStyle = ink;
      if (p.b.shape === 'pixel') {
        // The same S stroke, as the squares the pixel brush would fill.
        for (const k of stampCells(pts.map((q) => ({ x: q.x, y: q.y - 60 })), 60)) {
          const [i, j] = k.split(',').map(Number);
          c.fillRect(Math.round(i * 60 * s), Math.round(h - (j + 1) * 60 * s), Math.ceil(60 * s), Math.ceil(60 * s));
        }
        continue;
      }
      const poly = strokeOutline(pts, { size: p.b.size, shape: p.b.shape, angle: p.b.angle ?? 35, pressure: p.b.pressure, taper: p.b.taper / 100 });
      c.beginPath();
      poly.forEach((q, i) => (i ? c.lineTo(q.x * s, h - q.y * s * 1.0 + 0) : c.moveTo(q.x * s, h - q.y * s)));
      c.closePath();
      c.fill('nonzero');
    }
  }
  ctx.onBrushChanged = () => S.panel === 'draw' && renderPresets();
  A.usePreset = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    if (p.id === 'pixel') return A.useStyle('pixel');
    if (S.brush.shape === 'pixel') S.opts.grid = false;
    Object.assign(S.brush, p.b, { preset: id });
    A.setTool('brush');
    renderPresets();
    A.savePrefs();
    A.toast(`${p.name} brush`);
  };

  // ---------- Shapes ----------

  const SHAPES = [
    { id: 'square', name: 'Square', make: (m, cx) => [rectContour(cx - m.xHeight / 2, 0, cx + m.xHeight / 2, m.xHeight)] },
    { id: 'circle', name: 'Circle', make: (m, cx) => [ellipseContour(cx, m.xHeight / 2, m.xHeight / 2, m.xHeight / 2)] },
    { id: 'ring', name: 'Ring', make: (m, cx) => ring(cx, m.xHeight / 2, m.xHeight / 2, m.xHeight / 2 - Math.max(40, m.xHeight * 0.18)) },
    { id: 'stem', name: 'Stem', make: (m, cx) => [rectContour(cx - m.capHeight * 0.06, 0, cx + m.capHeight * 0.06, m.capHeight)] },
    { id: 'bar', name: 'Bar', make: (m, cx) => [rectContour(cx - m.xHeight * 0.45, m.xHeight * 0.45, cx + m.xHeight * 0.45, m.xHeight * 0.57)] },
    { id: 'triangle', name: 'Triangle', make: (m, cx) => [poly([[cx - m.capHeight * 0.4, 0], [cx, m.capHeight], [cx + m.capHeight * 0.4, 0]])] },
    { id: 'diamond', name: 'Diamond', make: (m, cx) => [poly([[cx, 0], [cx - m.xHeight * 0.4, m.xHeight / 2], [cx, m.xHeight], [cx + m.xHeight * 0.4, m.xHeight / 2]])] },
    { id: 'arch', name: 'Arch', make: (m, cx) => arch(cx, m.xHeight, Math.max(40, m.xHeight * 0.17)) },
  ];
  function poly(pts) {
    return orient({ closed: true, points: pts.map(([x, y]) => roundPt({ x, y, on: true })) }, true);
  }
  function ring(cx, cy, r, r2) {
    const outer = ellipseContour(cx, cy, r, r);
    const inner = orient(ellipseContour(cx, cy, r2, r2), false);
    return [outer, inner];
  }
  function arch(cx, xh, w) {
    const r = xh * 0.42;
    const outer = [];
    const inner = [];
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI - (i * Math.PI) / 24;
      outer.push({ x: cx + Math.cos(a) * r, y: xh - r + Math.sin(a) * r });
      inner.push({ x: cx + Math.cos(a) * (r - w), y: xh - r + Math.sin(a) * (r - w) });
    }
    const pts = [{ x: cx - r, y: 0 }, ...outer, { x: cx + r, y: 0 }, { x: cx + r - w, y: 0 }, ...inner.reverse(), { x: cx - r + w, y: 0 }];
    const c = polygonToContour(pts, lib, 1);
    return c ? [orient(c, true)] : [];
  }

  function chip(item, onClick, paint) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'shape-chip';
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    const s = document.createElement('span');
    s.textContent = item.name;
    b.append(cv, s);
    b.addEventListener('click', onClick);
    b._paint = () => paint(cv);
    return b;
  }

  function paintContours(cv, contours) {
    const c = fitCanvas(cv, 40, 40);
    c.clearRect(0, 0, 40, 40);
    const all = contours.flatMap((x) => flatten(x));
    if (!all.length) return;
    const xs = all.map((p) => p.x);
    const ys = all.map((p) => p.y);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const sz = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) || 1;
    const s = 32 / sz;
    c.fillStyle = css('--ink') || '#222';
    c.beginPath();
    for (const ct of contours) {
      flatten(ct).forEach((p, i) => (i ? c.lineTo(4 + (p.x - x0) * s, 36 - (p.y - y0) * s) : c.moveTo(4 + (p.x - x0) * s, 36 - (p.y - y0) * s)));
      c.closePath();
    }
    c.fill('nonzero');
  }

  function insert(contours, label) {
    const g = editor.glyph;
    if (!g) return;
    if (editor.editingMaster) return A.toast('Switch to the Regular master to add shapes.');
    history.run(label, editor.scope, () => {
      const start = editor.contours.length;
      editor.contours.push(...contours);
      editor.sel.clear();
      for (let ci = start; ci < editor.contours.length; ci++) editor.contours[ci].points.forEach((_, pi) => editor.sel.add(`${ci}:${pi}`));
      for (const m of P.font.masters || []) delete m.glyphs[g.name];
    });
    A.setTool('select');
    editor.onSelect();
    editor.redraw();
  }

  function renderShapes() {
    if (!shapesEl.children.length) {
      for (const sh of SHAPES) {
        shapesEl.append(
          chip(sh, () => {
            const g = editor.glyph;
            insert(sh.make(P.font.meta, g ? g.advanceWidth / 2 : 300), sh.name);
          }, (cv) => paintContours(cv, sh.make({ xHeight: 500, capHeight: 700 }, 300))),
        );
      }
      for (const sw of SWASHES) swashEl.append(chip(sw, () => insert(makeSwash(sw, P.font.meta, editor.glyph), sw.name), (cv) => paintContours(cv, makeSwash(sw, { xHeight: 500, capHeight: 700, descender: -200, ascender: 800 }, { advanceWidth: 600 }))));
    }
    for (const b of [...shapesEl.children, ...swashEl.children]) b._paint();
  }

  function makeSwash(sw, m, g) {
    const adv = g ? g.advanceWidth : 600;
    let box;
    if (sw.box === 'below') box = { x: 0, y: m.descender * 0.9, w: adv, h: -m.descender * 0.7 };
    else if (sw.box === 'above') box = { x: adv * 0.1, y: m.capHeight + 20, w: adv * 0.8, h: Math.max(80, (m.ascender - m.capHeight) * 1.4) };
    else if (sw.box === 'right') box = { x: adv * 0.55, y: m.descender * 0.8, w: adv * 0.55, h: m.xHeight * 0.75 };
    else box = { x: adv / 2 - m.xHeight * 0.25, y: m.xHeight + 60, w: m.xHeight * 0.5, h: m.xHeight * 0.5 };
    if (sw.drop) {
      const cx = box.x + box.w / 2;
      const r = box.w * 0.28;
      const pts = [];
      for (let i = 0; i <= 32; i++) {
        const a = -Math.PI / 2 + (i / 32) * Math.PI * 2;
        const tip = Math.max(0, Math.sin(a));
        pts.push({ x: cx + Math.cos(a) * r * (1 - tip * 0.85), y: box.y + r + Math.sin(a) * r + tip * tip * r * 1.6 });
      }
      const c = polygonToContour(pts, lib, 1);
      return c ? [orient(c, true)] : [];
    }
    if (sw.sparkle) {
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const r = box.w * 0.5;
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 2 - (i * Math.PI) / 4;
        const rr = i % 2 ? r * 0.18 : r;
        pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, on: true });
      }
      return [orient({ closed: true, points: pts.map(roundPt) }, true)];
    }
    const size = Math.max(24, (S.brush.size || 70) * 0.8);
    const samples = sw.pts.map(([x, y], i, arr) => ({ x: box.x + x * box.w, y: box.y + y * box.h, pressure: 0.35 + 0.65 * Math.sin((i / (arr.length - 1)) * Math.PI) }));
    const out = lib.strokeToOutline(samples, (p) => size * (0.25 + 0.75 * p.pressure), { error: 1, smoothing: 2 });
    return out.map((c) => ({ ...c, points: c.points.map(roundPt) }));
  }

  // ---------- Reference image ----------

  A.setBackground = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !editor.glyph) return;
    ctx.setBackgroundFile(file);
  };
  ctx.setBackgroundFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => downscale(String(reader.result)).then((src) => {
      P.extras.backgrounds = P.extras.backgrounds || {};
      P.extras.backgrounds[editor.name] = { src, opacity: 0.35, scale: 1, x: 0, y: 0 };
      ctx.changed('glyph', [editor.name]);
      A.toast('Reference image placed behind the letter. Draw over it with the brush.');
    });
    reader.readAsDataURL(file);
  };
  A.clearBackground = () => {
    if (P.extras.backgrounds) delete P.extras.backgrounds[editor.name];
    ctx.changed('glyph', [editor.name]);
  };
  A.setBackgroundProp = (key, v) => {
    const bg = P.extras.backgrounds?.[editor.name];
    if (!bg) return;
    bg[key] = +v;
    if (key === 'opacity') S.glyph.bgOpacity = Math.round(v * 100);
    if (key === 'scale') S.glyph.bgScale = Math.round(v * 100);
    P.dirty = true;
    editor.redraw();
  };

  /** Keeps project files small: reference images are stored at most 900 px. */
  function downscale(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
        if (k >= 1 && src.length < 600000) return resolve(src);
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.naturalWidth * k);
        cv.height = Math.round(img.naturalHeight * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }

  const prevPanel = ctx.onPanel;
  ctx.onPanel = (p) => {
    if (p === 'draw') requestAnimationFrame(() => {
      renderPresets();
      renderShapes();
    });
    prevPanel?.(p);
  };
  const prevTheme = ctx.onTheme;
  ctx.onTheme = () => {
    if (S.panel === 'draw') {
      renderPresets();
      renderShapes();
    }
    prevTheme?.();
  };
}
