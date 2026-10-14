// fontsketch embeddable drawing pad. Mount it on a canvas, let someone write
// letters with a mouse, finger or pen, and get back real outlines, a compiled
// font loaded with the FontFace API (so any text on the page can use it at
// once) and a one call handoff into the full editor.
//
//   import { mountSketch } from './app/embed.mjs';
//   const pad = await mountSketch(document.querySelector('canvas'), {
//     char: 'a',
//     baseFont: './assets/fonts/quill-hand.fontsketch.json', // letters you did not draw
//     onFont: ({ family }) => (sentence.style.fontFamily = `"${family}", serif`),
//   });
//   pad.setChar('g');      // draw another letter
//   pad.openInEditor();    // continue in the editor with everything drawn
//
// See docs/app/README.md for every option.
import * as lib from './lib/fontsketch.mjs';
import { resample, stabilize, strokeOutline, tracePath } from './js/geom.mjs';

const HANDOFF_DB = 'fontsketch-handoff';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{
 *   char?: string, baseFont?: string | object | null, family?: string,
 *   brush?: { size?: number, pressure?: boolean, taper?: number, smoothing?: number },
 *   guides?: boolean, sheen?: boolean, ink?: string, guide?: string, paper?: string | null,
 *   onStroke?: (info: { char: string, contours: any[] }) => void,
 *   onFont?: (info: { family: string, face: FontFace, font: any, chars: string[] }) => void,
 *   onError?: (e: Error) => void,
 * }} [options]
 */
export async function mountSketch(canvas, options = {}) {
  const o = {
    char: 'a',
    guides: true,
    sheen: true,
    brush: { size: 74, pressure: true, taper: 0.35, smoothing: 0.35 },
    ...options,
  };
  o.brush = { size: 74, pressure: true, taper: 0.35, smoothing: 0.35, ...(options.brush || {}) };
  const base = await loadBase(o.baseFont);
  const meta = base ? base.meta : { unitsPerEm: 1000, ascender: 800, descender: -200, xHeight: 500, capHeight: 700 };
  /** char -> array of strokes (each a list of samples in font units) */
  const strokes = new Map();
  /** char -> contours */
  const drawn = new Map();
  let char = o.char;
  let live = null;
  let sheenAt = 0;
  let face = null;
  let family = '';
  let compileTimer = 0;
  let destroyed = false;
  const redo = [];

  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';
  if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
  if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label', `Drawing pad. Write the letter ${char}.`);

  // ---------- Coordinates ----------

  function view() {
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 300;
    const em = meta.ascender - meta.descender;
    const s = (h * 0.82) / em;
    const base = h * 0.09 + meta.ascender * s;
    return { w, h, s, base, ox: w / 2 };
  }
  const toUnits = (e) => {
    const r = canvas.getBoundingClientRect();
    const { s, base, ox } = view();
    return { x: (e.clientX - r.left - ox) / s, y: (base - (e.clientY - r.top)) / s, p: e.pointerType === 'pen' && e.pressure ? e.pressure : e.pointerType === 'touch' && e.pressure ? Math.max(0.35, e.pressure) : 0.7 };
  };

  // ---------- Drawing ----------

  const color = (v, fallback) => {
    if (!v) return fallback;
    if (v.startsWith('--')) return getComputedStyle(canvas).getPropertyValue(v).trim() || fallback;
    return v;
  };

  function paint() {
    if (destroyed) return;
    const { w, h, s, base, ox } = view();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    if (o.paper) {
      c.fillStyle = color(o.paper, '#fffdf8');
      c.fillRect(0, 0, w, h);
    }
    if (o.guides) {
      c.strokeStyle = color(o.guide, 'rgba(120,100,60,.28)');
      c.lineWidth = 1;
      for (const [y, dash] of [[0, []], [meta.xHeight, [5, 5]], [meta.capHeight, [2, 6]], [meta.descender, [2, 6]]]) {
        c.setLineDash(dash);
        c.beginPath();
        c.moveTo(0, Math.round(base - y * s) + 0.5);
        c.lineTo(w, Math.round(base - y * s) + 0.5);
        c.stroke();
      }
      c.setLineDash([]);
      // A faint model letter to trace when nothing is drawn yet.
      if (!(strokes.get(char) || []).length && !live) {
        c.fillStyle = color(o.guide, 'rgba(120,100,60,.16)');
        c.font = `${Math.round(meta.capHeight * s * 1.05)}px Georgia, serif`;
        c.textAlign = 'center';
        c.fillText(char, ox, base);
      }
    }
    const ink = color(o.ink, '#1f1d27');
    const tf = (x, y) => [ox + x * s, base - y * s];
    c.fillStyle = ink;
    const contours = drawn.get(char);
    if (contours) {
      c.beginPath();
      tracePath(c, contours, tf);
      c.fill('nonzero');
    }
    for (const st of live ? [live] : []) {
      const poly = outlinePoly(st);
      c.beginPath();
      poly.forEach((p, i) => (i ? c.lineTo(...tf(p.x, p.y)) : c.moveTo(...tf(p.x, p.y))));
      c.closePath();
      c.fill('nonzero');
    }
    // Wet ink: a soft highlight that fades as the ink dries.
    const age = performance.now() - sheenAt;
    if (o.sheen && contours && age < 900) {
      const k = 1 - age / 900;
      c.save();
      c.beginPath();
      tracePath(c, contours, tf);
      c.clip('nonzero');
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(Math.max(0, 0.15 + (1 - k) * 0.7 - 0.15), 'rgba(255,255,255,0)');
      g.addColorStop(Math.min(1, 0.15 + (1 - k) * 0.7), `rgba(255,255,255,${0.35 * k})`);
      g.addColorStop(Math.min(1, 0.15 + (1 - k) * 0.7 + 0.15), 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.restore();
      requestAnimationFrame(paint);
    }
  }

  function outlinePoly(samples) {
    const sm = stabilize(samples, o.brush.smoothing);
    return strokeOutline(sm, { size: o.brush.size, shape: 'round', pressure: o.brush.pressure, taper: o.brush.taper });
  }

  /** Exact outlines of every stroke of a letter, merged. */
  function outlinesOf(list) {
    const parts = [];
    for (const st of list) {
      const sm = resample(stabilize(st, o.brush.smoothing), 6);
      const n = sm.length;
      const width = (p, i) => {
        let w = o.brush.pressure ? o.brush.size * (0.3 + 0.7 * Math.min(1, p.pressure ?? 0.7)) : o.brush.size;
        const t = Math.min(i, n - 1 - i) / Math.max(1, Math.min(n / 2, 10));
        return Math.max(4, w * Math.min(1, 1 - o.brush.taper + o.brush.taper * t));
      };
      parts.push(...lib.strokeToOutline(sm.map((p) => ({ x: p.x, y: p.y, pressure: p.p })), width, { error: 1.2, smoothing: 1 }));
    }
    let merged = parts;
    try {
      merged = lib.removeOverlaps(parts);
    } catch {
      // overlapping contours still fill correctly with the nonzero rule
    }
    return merged.map((c) => ({ ...c, points: c.points.map((p) => ({ ...p, x: Math.round(p.x), y: Math.round(p.y) })) }));
  }

  function rebuild(ch) {
    const list = strokes.get(ch) || [];
    if (!list.length) drawn.delete(ch);
    else drawn.set(ch, outlinesOf(list));
  }

  // ---------- Pointer input ----------

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    canvas.setPointerCapture(e.pointerId);
    live = [toUnits(e)];
    paint();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!live) return;
    for (const ev of e.getCoalescedEvents ? e.getCoalescedEvents() : [e]) live.push(toUnits(ev));
    paint();
  });
  const finish = () => {
    if (!live) return;
    const st = live;
    live = null;
    if (!strokes.has(char)) strokes.set(char, []);
    strokes.get(char).push(st);
    redo.length = 0;
    rebuild(char);
    sheenAt = performance.now();
    paint();
    o.onStroke?.({ char, contours: drawn.get(char) || [] });
    scheduleCompile();
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', () => {
    live = null;
    paint();
  });
  canvas.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      api.undo();
    }
  });
  const ro = new ResizeObserver(() => paint());
  ro.observe(canvas);

  // ---------- Font ----------

  function buildFont() {
    const font = base ? lib.deserialize(lib.serialize(base)) : lib.createFont({ family: 'My Sketch' });
    font.meta.family = o.family || 'fontsketch Sketch';
    for (const [ch, contours] of drawn) {
      const name = lib.glyphNameFor(ch);
      let xMin = Infinity, xMax = -Infinity;
      for (const ct of contours) for (const p of ct.points) {
        xMin = Math.min(xMin, p.x);
        xMax = Math.max(xMax, p.x);
      }
      const sb = Math.round(meta.unitsPerEm * 0.05);
      const shifted = contours.map((ct) => ({ ...ct, points: ct.points.map((p) => ({ ...p, x: p.x - xMin + sb })) }));
      const prev = font.glyphs[name];
      lib.addGlyph(font, { ...(prev || {}), name, unicodes: [ch.codePointAt(0)], advanceWidth: Math.round(xMax - xMin + sb * 2), contours: shifted, components: [] });
      if (prev?.anchors) {
        // Keep accents centred over a redrawn base letter.
        const cx = Math.round((xMax - xMin) / 2 + sb);
        font.glyphs[name].anchors = Object.fromEntries(Object.entries(prev.anchors).map(([k, a]) => [k, { ...a, x: cx }]));
      }
    }
    return font;
  }

  function scheduleCompile() {
    clearTimeout(compileTimer);
    compileTimer = setTimeout(compile, 60);
  }
  async function compile() {
    try {
      const font = buildFont();
      const bytes = lib.exportFont(font, { format: 'ttf', hinting: 'none' });
      const name = `fsSketch${Math.random().toString(36).slice(2, 8)}`;
      const ff = new FontFace(name, bytes);
      await ff.load();
      document.fonts.add(ff);
      if (face) document.fonts.delete(face);
      face = ff;
      family = name;
      o.onFont?.({ family, face, font, chars: [...drawn.keys()] });
    } catch (e) {
      if (o.onError) o.onError(e);
      else console.warn('fontsketch sketch:', e);
    }
  }

  const api = {
    /** The letter being drawn. */
    get char() {
      return char;
    },
    /** Letters drawn so far. */
    get chars() {
      return [...drawn.keys()];
    },
    /** The family name of the latest compiled FontFace ('' before the first stroke). */
    get family() {
      return family;
    },
    setChar(ch) {
      char = [...String(ch)][0] || 'a';
      canvas.setAttribute('aria-label', `Drawing pad. Write the letter ${char}.`);
      paint();
    },
    undo() {
      const list = strokes.get(char);
      if (!list?.length) return;
      redo.push({ char, stroke: list.pop() });
      rebuild(char);
      paint();
      scheduleCompile();
    },
    redo() {
      const r = redo.pop();
      if (!r) return;
      if (!strokes.has(r.char)) strokes.set(r.char, []);
      strokes.get(r.char).push(r.stroke);
      rebuild(r.char);
      paint();
      scheduleCompile();
    },
    clear(all = false) {
      if (all) {
        strokes.clear();
        drawn.clear();
      } else {
        strokes.delete(char);
        drawn.delete(char);
      }
      paint();
      scheduleCompile();
    },
    /** Outlines (font units, Y up) of a drawn letter. */
    contours(ch = char) {
      return drawn.get(ch) || [];
    },
    /** SVG path data of a drawn letter, Y flipped for SVG. */
    svgPath(ch = char) {
      const contours = drawn.get(ch) || [];
      return lib.pathFromPoints ? lib.pathFromPoints(contours, { flipY: true }) : '';
    },
    /** The font with every drawn letter (a deep copy, safe to change). */
    toFont: buildFont,
    /** Font bytes in any format. */
    async export(format = 'ttf') {
      return lib.exportFontAsync ? lib.exportFontAsync(buildFont(), { format }) : lib.exportFont(buildFont(), { format });
    },
    /** Saves the font for the editor and opens it. */
    async openInEditor(url = new URL('./', import.meta.url).href) {
      const font = buildFont();
      const ok = await putHandoff('latest', lib.serialize(font));
      const glyph = drawn.size ? lib.glyphNameFor([...drawn.keys()].pop()) : '';
      location.href = `${url}#handoff=latest${ok && glyph ? `&glyph=${encodeURIComponent(glyph)}` : ''}`;
    },
    /** Redraws (for example after a theme change). */
    refresh: paint,
    destroy() {
      destroyed = true;
      ro.disconnect();
      if (face) document.fonts.delete(face);
    },
  };
  paint();
  return api;
}

async function loadBase(src) {
  if (!src) return null;
  if (typeof src === 'object') return lib.deserialize(lib.serialize(src));
  try {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return lib.deserialize(await r.text());
  } catch (e) {
    console.warn('fontsketch sketch: base font not loaded', e);
    return null;
  }
}

/** Writes a value into the handoff store the editor reads on #handoff=key. */
export function putHandoff(key, value) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(HANDOFF_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('handoff')) req.result.createObjectStore('handoff');
      };
      req.onsuccess = () => {
        const db = req.result;
        const t = db.transaction('handoff', 'readwrite');
        t.objectStore('handoff').put(value, key);
        t.oncomplete = () => {
          db.close();
          resolve(true);
        };
        t.onerror = () => resolve(false);
      };
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export { lib };
