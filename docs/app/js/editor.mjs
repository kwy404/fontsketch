// The glyph editor canvas: view (zoom, pan, rulers, guides, grid), drawing
// of outlines, points and handles, and the tools (select and transform, pen,
// brush, eraser, rectangle, ellipse, hand). Pointer events cover mouse,
// touch (two finger pan and pinch) and pens with pressure and tilt.
import { rasterUnion, subtract } from './booleans.mjs';
import {
  bbox, clone, closestOnSegment, contourAt, dist, ellipseContour, flatten, insertPoint, matrix, orient,
  polygonToContour, rectContour, resolve, roundPt, segments, stabilize, strokeOutline, tracePath, transformContours,
} from './geom.mjs';
import { cellsFromContours, cellsToContours, isPixelAligned, stampCells } from './pixel.mjs';
import { P, core, history } from './project.mjs';
import { css, fitCanvas } from './render.mjs';

const RULER = 20;
const HIT = 8;
const STRUCTURE_TOOLS = new Set(['pen', 'brush', 'eraser', 'rect', 'ellipse']);

export class Editor {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ S: any, notify: (msg: string) => void, onSelect?: () => void, onView?: () => void }} opts
   */
  constructor(canvas, opts) {
    this.cv = canvas;
    this.S = opts.S;
    this.notify = opts.notify;
    this.onSelect = opts.onSelect || (() => {});
    this.onView = opts.onView || (() => {});
    this.name = null;
    this.view = { scale: 0.5, ox: 0, oy: 0 };
    this.sel = new Set(); // "ci:pi"
    this.selComponent = -1;
    this.drag = null;
    this.pointers = new Map();
    this.penSeen = false;
    this.hover = null;
    this.stroke = null;
    this.penDraft = null; // { ci, out: {x,y} | null }
    this.space = false;
    this.bgImages = new Map();
    this.raf = 0;
    this.colors = null;
    this.clipboard = null;
    this.bind();
    new ResizeObserver(() => {
      const { w, h } = this.size;
      if (!this.sized) {
        if (w && h) {
          this.sized = { w, h };
          this.fit();
        }
        return;
      }
      // Keep the letter where it was when panels open or close.
      this.view.ox += (w - this.sized.w) / 2;
      this.view.oy += (h - this.sized.h) / 2;
      this.sized = { w, h };
      this.redraw();
    }).observe(canvas);
  }

  // ---------- Model access ----------

  get glyph() {
    return this.name ? P.font.glyphs[this.name] : null;
  }
  get editingMaster() {
    return this.S.master > 0 && P.font.masters?.length > 0;
  }
  /** The contours being edited (default master or the extra master). */
  get contours() {
    const g = this.glyph;
    if (!g) return [];
    if (this.editingMaster) {
      const m = P.font.masters[0];
      if (!m.glyphs[g.name]) m.glyphs[g.name] = { contours: clone(g.contours) };
      return m.glyphs[g.name].contours;
    }
    return g.contours;
  }
  set contours(v) {
    const g = this.glyph;
    if (!g) return;
    if (this.editingMaster) P.font.masters[0].glyphs[g.name].contours = v;
    else g.contours = v;
  }
  /** Scope for undo: the glyph and its master copies. */
  get scope() {
    return [this.name];
  }

  setGlyph(name) {
    if (this.penDraft) this.finishPen();
    this.name = name;
    this.sel.clear();
    this.selComponent = -1;
    this.stroke = null;
    this.fit();
    this.onSelect();
  }

  // ---------- View ----------

  get size() {
    return { w: this.cv.clientWidth, h: this.cv.clientHeight };
  }
  toScreen(x, y) {
    return [this.view.ox + x * this.view.scale, this.view.oy - y * this.view.scale];
  }
  toFont(sx, sy) {
    return { x: (sx - this.view.ox) / this.view.scale, y: (this.view.oy - sy) / this.view.scale };
  }
  fit() {
    const { w, h } = this.size;
    if (!w || !h || !P.font) return;
    const m = P.font.meta;
    const g = this.glyph;
    const adv = g ? g.advanceWidth : m.unitsPerEm / 2;
    const top = Math.max(m.ascender, m.capHeight) + 60;
    const bottom = m.descender - 60;
    // Space kept free for floating bars over the canvas (quick mode).
    const inTop = this.inset?.top || 0;
    const inBottom = this.inset?.bottom || 0;
    const usableW = w - RULER - 40;
    const usableH = Math.max(80, h - RULER - 30 - inTop - inBottom);
    const scale = Math.min(usableH / (top - bottom), usableW / Math.max(adv + 200, 600));
    this.view.scale = scale;
    this.view.ox = RULER + 20 + (usableW - adv * scale) / 2;
    this.view.oy = RULER + 15 + inTop + top * scale + Math.max(0, (usableH - (top - bottom) * scale) / 2);
    this.redraw();
    this.onView();
  }
  zoomAt(factor, sx, sy) {
    const s = Math.min(40, Math.max(0.02, this.view.scale * factor));
    const f = this.toFont(sx, sy);
    this.view.scale = s;
    this.view.ox = sx - f.x * s;
    this.view.oy = sy + f.y * s;
    this.redraw();
    this.onView();
  }
  zoomCenter(factor) {
    const { w, h } = this.size;
    this.zoomAt(factor, w / 2, h / 2);
  }
  panBy(dx, dy) {
    this.view.ox += dx;
    this.view.oy += dy;
    this.redraw();
  }

  // ---------- Snapping ----------

  snap(p, exclude = null) {
    const o = this.S.opts;
    let { x, y } = p;
    if (o.snap) {
      const g = Math.max(1, +o.gridSize || 10);
      x = Math.round(x / g) * g;
      y = Math.round(y / g) * g;
    }
    // Metric lines and side bearings attract within a few pixels.
    const tol = 6 / this.view.scale;
    const m = P.font.meta;
    for (const ly of [0, m.xHeight, m.capHeight, m.ascender, m.descender]) if (Math.abs(p.y - ly) < tol) y = ly;
    if (this.glyph) for (const lx of [0, this.glyph.advanceWidth]) if (Math.abs(p.x - lx) < tol) x = lx;
    // Other points of the glyph.
    if (o.snapPoints !== false) {
      this.contours.forEach((c, ci) =>
        c.points.forEach((q, pi) => {
          if (exclude && exclude.has(`${ci}:${pi}`)) return;
          if (Math.abs(q.x - p.x) < tol && Math.abs(q.y - p.y) < tol) {
            x = q.x;
            y = q.y;
          }
        }),
      );
    }
    return { x: Math.round(x), y: Math.round(y) };
  }

  // ---------- Hit testing ----------

  hitPoint(sx, sy) {
    // Beginners work with whole shapes; points appear in Pro mode.
    if (!this.S.pro && !this.editingMaster) return null;
    let best = null;
    let bd = HIT;
    this.contours.forEach((c, ci) =>
      c.points.forEach((p, pi) => {
        const [px, py] = this.toScreen(p.x, p.y);
        const d = Math.hypot(px - sx, py - sy) - (p.on ? 0.5 : 0);
        if (d < bd) {
          bd = d;
          best = { ci, pi };
        }
      }),
    );
    return best;
  }
  hitSegment(sx, sy) {
    const f = this.toFont(sx, sy);
    let best = null;
    this.contours.forEach((c, ci) => {
      for (const seg of segments(c)) {
        const r = closestOnSegment(seg, f.x, f.y);
        const d = r.d * this.view.scale;
        if (d < 6 && (!best || d < best.d)) best = { ci, seg, t: r.t, d };
      }
    });
    return best;
  }
  hitMetric(sx, sy) {
    const g = this.glyph;
    if (!g || sy < RULER) return null;
    const [x0] = this.toScreen(0, 0);
    const [x1] = this.toScreen(g.advanceWidth, 0);
    if (Math.abs(sx - x1) < 5) return 'rsb';
    if (Math.abs(sx - x0) < 5) return 'lsb';
    return null;
  }
  hitComponent(sx, sy) {
    const g = this.glyph;
    if (!g?.components?.length || this.editingMaster) return -1;
    const f = this.toFont(sx, sy);
    for (let i = g.components.length - 1; i >= 0; i--) {
      const comp = g.components[i];
      const base = P.font.glyphs[comp.glyph];
      if (!base) continue;
      const s = comp.scale ?? 1;
      const cs = transformContours(resolve(P.font, base), [s, 0, 0, s, comp.dx || 0, comp.dy || 0]);
      if (contourAt(f.x, f.y, cs) >= 0) return i;
    }
    return -1;
  }
  selectionBox() {
    if (this.sel.size < 2) return null;
    const pts = [...this.sel].map((k) => this.pointByKey(k)).filter(Boolean);
    const b = bbox([{ points: pts }]);
    if (!b || (b.xMax - b.xMin < 1 && b.yMax - b.yMin < 1)) return null;
    return b;
  }
  /** Transform handles in screen space: 8 scale handles and a rotate handle. */
  handles() {
    const b = this.selectionBox();
    if (!b) return [];
    const [l, t] = this.toScreen(b.xMin, b.yMax);
    const [r, bt] = this.toScreen(b.xMax, b.yMin);
    const cx = (l + r) / 2;
    const cy = (t + bt) / 2;
    return [
      { id: 'nw', x: l, y: t, ax: 'xMax', ay: 'yMin' },
      { id: 'n', x: cx, y: t, ay: 'yMin' },
      { id: 'ne', x: r, y: t, ax: 'xMin', ay: 'yMin' },
      { id: 'e', x: r, y: cy, ax: 'xMin' },
      { id: 'se', x: r, y: bt, ax: 'xMin', ay: 'yMax' },
      { id: 's', x: cx, y: bt, ay: 'yMax' },
      { id: 'sw', x: l, y: bt, ax: 'xMax', ay: 'yMax' },
      { id: 'w', x: l, y: cy, ax: 'xMax' },
      { id: 'rot', x: cx, y: t - 26 },
    ];
  }
  pointByKey(k) {
    const [ci, pi] = k.split(':').map(Number);
    return this.contours[ci]?.points[pi];
  }

  // ---------- Events ----------

  bind() {
    const cv = this.cv;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', (e) => this.down(e));
    cv.addEventListener('pointermove', (e) => this.move(e));
    cv.addEventListener('pointerup', (e) => this.up(e));
    cv.addEventListener('pointercancel', (e) => this.up(e, true));
    cv.addEventListener('lostpointercapture', (e) => this.pointers.delete(e.pointerId));
    cv.addEventListener('dblclick', (e) => this.dbl(e));
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const r = cv.getBoundingClientRect();
        const sx = e.clientX - r.left;
        const sy = e.clientY - r.top;
        if (e.ctrlKey || e.metaKey || this.S.opts.wheelZoom) this.zoomAt(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0022)), sx, sy);
        else this.panBy(-e.deltaX, -e.deltaY);
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && !isTyping(e)) {
        this.space = true;
        this.cursor();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.space = false;
        this.cursor();
      }
    });
  }

  pos(e) {
    const r = this.cv.getBoundingClientRect();
    return { sx: e.clientX - r.left, sy: e.clientY - r.top };
  }

  down(e) {
    if (!this.glyph) return;
    const { sx, sy } = this.pos(e);
    if (e.pointerType === 'pen') this.penSeen = true;
    this.pointers.set(e.pointerId, { sx, sy, type: e.pointerType });
    try {
      this.cv.setPointerCapture(e.pointerId);
    } catch {
      // synthetic events have no active pointer
    }
    this.cv.focus({ preventScroll: true });
    // Two touches: pan and pinch. Cancel whatever the first finger started.
    const touches = [...this.pointers.values()].filter((p) => p.type === 'touch');
    if (touches.length >= 2) {
      this.abortDrag();
      const [a, b] = touches;
      this.drag = { kind: 'pinch', d0: Math.hypot(a.sx - b.sx, a.sy - b.sy), c0: { x: (a.sx + b.sx) / 2, y: (a.sy + b.sy) / 2 }, view0: { ...this.view } };
      return;
    }
    if (this.drag) return;
    // Palm rejection: once a pen has been used, fingers only pan.
    const tool = this.space || e.button === 1 || (e.pointerType === 'touch' && this.penSeen) ? 'hand' : this.S.tool;
    if (e.button === 2) return;
    const f = this.toFont(sx, sy);
    if (sy < RULER || sx < RULER) {
      this.drag = { kind: 'pan', sx, sy };
      return;
    }
    if (this.editingMaster && STRUCTURE_TOOLS.has(tool) && tool !== 'pen') {
      this.notify('The Bold master keeps the same points as Regular: move points with the select tool, or switch back to Regular to draw.');
      return;
    }
    switch (tool) {
      case 'hand':
        this.drag = { kind: 'pan', sx, sy };
        break;
      case 'brush':
      case 'eraser':
        this.stroke = { tool, samples: [this.sample(e, f)] };
        this.drag = { kind: 'stroke' };
        break;
      case 'rect':
      case 'ellipse':
        this.drag = { kind: 'shape', tool, a: this.snap(f), b: this.snap(f) };
        break;
      case 'pen':
        this.penDown(e, sx, sy, f);
        break;
      default:
        this.selectDown(e, sx, sy, f);
    }
    this.redraw();
  }

  sample(e, f) {
    // Mouse reports 0.5 while pressed; treat it as full pressure so mouse
    // strokes have the chosen width.
    const p = e.pointerType === 'mouse' || !e.pressure ? 0.7 : e.pressure;
    // Tilting a pen (Apple Pencil, Wacom) widens the mark like shading with a pencil side.
    const tilt = e.pointerType === 'pen' ? Math.min(1, Math.hypot(e.tiltX || 0, e.tiltY || 0) / 60) : 0;
    return { x: f.x, y: f.y, p, tilt, t: e.timeStamp };
  }

  move(e) {
    const { sx, sy } = this.pos(e);
    const prev = this.pointers.get(e.pointerId);
    if (prev) this.pointers.set(e.pointerId, { ...prev, sx, sy });
    const d = this.drag;
    const f = this.toFont(sx, sy);
    this.cursorPos = f;
    if (!d) {
      this.updateHover(sx, sy);
      this.S.status.pos = `${Math.round(f.x)}, ${Math.round(f.y)}`;
      return;
    }
    switch (d.kind) {
      case 'pinch': {
        const touches = [...this.pointers.values()].filter((p) => p.type === 'touch');
        if (touches.length < 2) return;
        const [a, b] = touches;
        const dd = Math.hypot(a.sx - b.sx, a.sy - b.sy);
        const c = { x: (a.sx + b.sx) / 2, y: (a.sy + b.sy) / 2 };
        const s = Math.min(40, Math.max(0.02, d.view0.scale * (dd / (d.d0 || 1))));
        const fx = (d.c0.x - d.view0.ox) / d.view0.scale;
        const fy = (d.view0.oy - d.c0.y) / d.view0.scale;
        this.view.scale = s;
        this.view.ox = c.x - fx * s;
        this.view.oy = c.y + fy * s;
        this.redraw();
        this.onView();
        return;
      }
      case 'pan': {
        const now = performance.now();
        const dt = Math.max(1, now - (d.t || now - 16));
        d.vx = (0.7 * (sx - d.sx)) / dt * 16 + 0.3 * (d.vx || 0);
        d.vy = (0.7 * (sy - d.sy)) / dt * 16 + 0.3 * (d.vy || 0);
        d.t = now;
        this.panBy(sx - d.sx, sy - d.sy);
        d.sx = sx;
        d.sy = sy;
        return;
      }
      case 'stroke': {
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ev of evs.length ? evs : [e]) {
          const p = this.pos(ev);
          this.stroke.samples.push(this.sample(ev, this.toFont(p.sx, p.sy)));
        }
        break;
      }
      case 'shape':
        d.b = this.snap(f);
        d.shift = e.shiftKey;
        d.alt = e.altKey;
        break;
      case 'points':
        this.dragPoints(d, f, e);
        break;
      case 'metric':
        this.dragMetric(d, f);
        break;
      case 'component':
        this.dragComponent(d, f);
        break;
      case 'marquee':
        d.b = { sx, sy };
        break;
      case 'scale':
      case 'rotate':
        this.dragTransform(d, f, e);
        break;
      case 'penHandle':
        this.penDrag(d, f);
        break;
    }
    this.redraw();
  }

  up(e, cancelled = false) {
    this.pointers.delete(e.pointerId);
    const d = this.drag;
    if (!d) return;
    if (d.kind === 'pinch') {
      if (this.pointers.size === 0) this.drag = null;
      return;
    }
    this.drag = null;
    if (d.kind === 'pan' && !cancelled) this.glide(d);
    if (cancelled) {
      if (d.kind === 'stroke') this.stroke = null;
      history.cancel();
      this.redraw();
      return;
    }
    switch (d.kind) {
      case 'stroke':
        this.finishStroke();
        break;
      case 'shape':
        this.finishShape(d);
        break;
      case 'marquee':
        this.finishMarquee(d, e.shiftKey);
        break;
      case 'points':
      case 'metric':
      case 'component':
      case 'scale':
      case 'rotate':
      case 'penHandle':
        history.commit();
        break;
    }
    this.onSelect();
    this.redraw();
  }

  /** Inertia after a pan: keeps sliding and slows down. */
  glide(d) {
    let vx = d.vx || 0;
    let vy = d.vy || 0;
    if (performance.now() - (d.t || 0) > 80 || Math.hypot(vx, vy) < 1.5 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const step = () => {
      if (this.drag) return;
      vx *= 0.92;
      vy *= 0.92;
      this.panBy(vx, vy);
      if (Math.hypot(vx, vy) > 0.4) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  abortDrag() {
    if (this.drag && this.drag.kind !== 'pan' && this.drag.kind !== 'pinch') history.cancel();
    if (this.drag?.kind === 'penHandle') this.penDraft = null;
    this.stroke = null;
    this.drag = null;
  }

  updateHover(sx, sy) {
    const tool = this.space ? 'hand' : this.S.tool;
    let hover = null;
    if (tool === 'select' || tool === 'pen') {
      const pt = this.hitPoint(sx, sy);
      if (pt) hover = { kind: 'point', ...pt };
      else if (tool === 'select' && this.handles().find((h) => Math.hypot(h.x - sx, h.y - sy) < HIT)) hover = { kind: 'handle' };
      else if (this.hitMetric(sx, sy)) hover = { kind: 'metric' };
      else if (tool === 'pen' && !this.penDraft) {
        const s = this.hitSegment(sx, sy);
        if (s) hover = { kind: 'segment', ...s };
      }
    }
    const changedHover = JSON.stringify(hover && { ...hover, seg: undefined }) !== JSON.stringify(this.hover && { ...this.hover, seg: undefined });
    this.hover = hover;
    this.cursor();
    if (changedHover || tool === 'pen' || tool === 'brush' || tool === 'eraser') this.redraw();
  }

  cursor() {
    const tool = this.space ? 'hand' : this.S.tool;
    const h = this.hover;
    let c = 'default';
    if (tool === 'hand') c = this.drag?.kind === 'pan' ? 'grabbing' : 'grab';
    else if (h?.kind === 'metric') c = 'ew-resize';
    else if (h?.kind === 'point' || h?.kind === 'handle') c = 'pointer';
    else if (tool === 'pen') c = h?.kind === 'segment' ? 'copy' : 'crosshair';
    else if (tool === 'brush' || tool === 'eraser') c = 'none';
    else if (tool === 'rect' || tool === 'ellipse') c = 'crosshair';
    this.cv.style.cursor = c;
  }

  // ---------- Select tool ----------

  selectDown(e, sx, sy, f) {
    // Transform handles first.
    const h = this.handles().find((hd) => Math.hypot(hd.x - sx, hd.y - sy) < HIT);
    if (h) {
      const b = this.selectionBox();
      history.begin(h.id === 'rot' ? 'Rotate' : 'Scale', this.scope);
      this.drag = {
        kind: h.id === 'rot' ? 'rotate' : 'scale',
        h,
        b,
        start: f,
        orig: this.selectedSnapshot(),
        center: { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 },
      };
      return;
    }
    const pt = this.hitPoint(sx, sy);
    if (pt) {
      const key = `${pt.ci}:${pt.pi}`;
      if (e.shiftKey) {
        if (this.sel.has(key)) this.sel.delete(key);
        else this.sel.add(key);
      } else if (!this.sel.has(key)) {
        this.sel.clear();
        this.sel.add(key);
      }
      this.selComponent = -1;
      this.beginPointDrag(f, key);
      return;
    }
    const metric = this.hitMetric(sx, sy);
    if (metric) {
      history.begin(metric === 'lsb' ? 'Left side bearing' : 'Advance width', this.scope);
      const mg = !this.editingMaster && P.font.masters?.[0]?.glyphs?.[this.name];
      this.drag = { kind: 'metric', which: metric, start: f, adv0: this.glyph.advanceWidth, orig: clone(this.contours), comps: clone(this.glyph.components || []), masterOrig: mg ? clone(mg.contours) : null };
      return;
    }
    const b = this.selectionBox();
    if (b && f.x >= b.xMin && f.x <= b.xMax && f.y >= b.yMin && f.y <= b.yMax && !e.shiftKey) {
      this.beginPointDrag(f, null);
      return;
    }
    const ci = contourAt(f.x, f.y, this.contours);
    if (ci >= 0) {
      if (!e.shiftKey) this.sel.clear();
      this.contours[ci].points.forEach((_, pi) => this.sel.add(`${ci}:${pi}`));
      this.selComponent = -1;
      this.beginPointDrag(f, null);
      return;
    }
    const comp = this.hitComponent(sx, sy);
    if (comp >= 0) {
      this.sel.clear();
      this.selComponent = comp;
      const c = this.glyph.components[comp];
      history.begin('Move component', this.scope);
      this.drag = { kind: 'component', start: f, dx0: c.dx || 0, dy0: c.dy || 0 };
      return;
    }
    if (!e.shiftKey) this.sel.clear();
    this.selComponent = -1;
    this.drag = { kind: 'marquee', a: { sx, sy }, b: { sx, sy } };
  }

  selectedSnapshot() {
    const m = new Map();
    for (const k of this.sel) {
      const p = this.pointByKey(k);
      if (p) m.set(k, { x: p.x, y: p.y });
    }
    return m;
  }

  beginPointDrag(f, key) {
    history.begin('Move points', this.scope);
    // Off curve neighbours of moved on curve points travel along.
    const moving = new Set(this.sel);
    for (const k of this.sel) {
      const [ci, pi] = k.split(':').map(Number);
      const c = this.contours[ci];
      if (!c || !c.points[pi]?.on) continue;
      const n = c.points.length;
      for (const j of [pi - 1, pi + 1]) {
        if (!c.closed && (j < 0 || j >= n)) continue;
        const jj = (j + n) % n;
        if (!c.points[jj].on) moving.add(`${ci}:${jj}`);
      }
    }
    const orig = new Map();
    for (const k of moving) {
      const p = this.pointByKey(k);
      if (p) orig.set(k, { x: p.x, y: p.y });
    }
    this.drag = { kind: 'points', start: f, orig, anchor: key, moved: false };
  }

  dragPoints(d, f, e) {
    let dx = f.x - d.start.x;
    let dy = f.y - d.start.y;
    if (e.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    if (d.anchor) {
      const o = d.orig.get(d.anchor);
      const target = this.snap({ x: o.x + dx, y: o.y + dy }, new Set(d.orig.keys()));
      if (!e.shiftKey || dx) dx = target.x - o.x;
      if (!e.shiftKey || dy) dy = target.y - o.y;
    } else {
      dx = Math.round(dx);
      dy = Math.round(dy);
    }
    if (Math.abs(dx) + Math.abs(dy) > 0) d.moved = true;
    for (const [k, o] of d.orig) {
      const p = this.pointByKey(k);
      if (p) {
        p.x = Math.round(o.x + dx);
        p.y = Math.round(o.y + dy);
      }
    }
    // Dragging one handle of a smooth point keeps the opposite handle aligned.
    if (d.anchor && d.orig.size === 1) {
      const [ci, pi] = d.anchor.split(':').map(Number);
      const c = this.contours[ci];
      const p = c.points[pi];
      if (!p.on) {
        const n = c.points.length;
        for (const dir of [-1, 1]) {
          const on = c.points[(pi + dir + n) % n];
          if (on?.on && on.type === 'smooth') {
            const other = c.points[(pi + 2 * dir + n) % n];
            if (other && !other.on && other !== p) {
              const len = dist(on, other);
              const vx = on.x - p.x;
              const vy = on.y - p.y;
              const vl = Math.hypot(vx, vy) || 1;
              other.x = Math.round(on.x + (vx / vl) * len);
              other.y = Math.round(on.y + (vy / vl) * len);
            }
          }
        }
      }
    }
  }

  dragMetric(d, f) {
    const g = this.glyph;
    const dx = Math.round(f.x - d.start.x);
    if (d.which === 'rsb') {
      g.advanceWidth = Math.max(0, d.adv0 + dx);
      if (this.S.opts.snap) g.advanceWidth = Math.round(g.advanceWidth / (+this.S.opts.gridSize || 10)) * (+this.S.opts.gridSize || 10);
    } else {
      // Moving the left bearing shifts the outlines and keeps the right one.
      const shift = -dx;
      this.contours = transformContours(d.orig, matrix.translate(shift, 0));
      if (g.components) g.components = d.comps.map((c) => ({ ...c, dx: (c.dx || 0) + shift }));
      g.advanceWidth = Math.max(0, d.adv0 + shift);
      if (!this.editingMaster) for (const m of P.font.masters || []) if (m.glyphs[g.name] && d.masterOrig) m.glyphs[g.name].contours = transformContours(d.masterOrig, matrix.translate(shift, 0));
    }
  }

  dragComponent(d, f) {
    const c = this.glyph.components[this.selComponent];
    const s = this.snap({ x: d.dx0 + f.x - d.start.x, y: d.dy0 + f.y - d.start.y });
    c.dx = s.x;
    c.dy = s.y;
  }

  dragTransform(d, f, e) {
    const { b, h, center, orig } = d;
    let m;
    if (d.kind === 'rotate') {
      const a0 = Math.atan2(d.start.y - center.y, d.start.x - center.x);
      const a1 = Math.atan2(f.y - center.y, f.x - center.x);
      let deg = ((a1 - a0) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      d.deg = deg;
      m = matrix.rotate(deg, center.x, center.y);
    } else {
      const ax = h.ax ? b[h.ax] : center.x;
      const ay = h.ay ? b[h.ay] : center.y;
      const fx = h.ax ? (h.ax === 'xMin' ? b.xMax : b.xMin) : null;
      const fy = h.ay ? (h.ay === 'yMin' ? b.yMax : b.yMin) : null;
      let sx = fx === null ? 1 : (f.x - ax) / (fx - ax || 1);
      let sy = fy === null ? 1 : (f.y - ay) / (fy - ay || 1);
      if (e.shiftKey && fx !== null && fy !== null) sx = sy = Math.abs(sx) > Math.abs(sy) ? sx : sy;
      if (e.altKey) {
        m = matrix.scale(sx, sy, center.x, center.y);
      } else m = matrix.scale(sx, sy, ax, ay);
    }
    for (const [k, o] of orig) {
      const p = this.pointByKey(k);
      if (!p) continue;
      p.x = Math.round(m[0] * o.x + m[2] * o.y + m[4]);
      p.y = Math.round(m[1] * o.x + m[3] * o.y + m[5]);
    }
  }

  finishMarquee(d, add) {
    const x0 = Math.min(d.a.sx, d.b.sx);
    const x1 = Math.max(d.a.sx, d.b.sx);
    const y0 = Math.min(d.a.sy, d.b.sy);
    const y1 = Math.max(d.a.sy, d.b.sy);
    if (!add) this.sel.clear();
    const whole = !this.S.pro && !this.editingMaster;
    this.contours.forEach((c, ci) => {
      const hit = c.points.some((p) => {
        const [px, py] = this.toScreen(p.x, p.y);
        return px >= x0 && px <= x1 && py >= y0 && py <= y1;
      });
      if (!hit) return;
      c.points.forEach((p, pi) => {
        const [px, py] = this.toScreen(p.x, p.y);
        if (whole || (px >= x0 && px <= x1 && py >= y0 && py <= y1)) this.sel.add(`${ci}:${pi}`);
      });
    });
  }

  dbl(e) {
    if (!this.glyph) return;
    const { sx, sy } = this.pos(e);
    const pt = this.hitPoint(sx, sy);
    if (pt) {
      const p = this.contours[pt.ci].points[pt.pi];
      if (p.on) {
        history.run('Convert point', this.scope, () => {
          p.type = p.type === 'smooth' ? 'corner' : 'smooth';
          if (p.type === 'smooth') this.alignSmooth(pt.ci, pt.pi);
        });
        this.notify(`Point is now ${p.type}`);
        this.redraw();
      }
      return;
    }
    if (this.S.tool === 'select') {
      const f = this.toFont(sx, sy);
      const ci = contourAt(f.x, f.y, this.contours);
      if (ci >= 0) {
        this.sel.clear();
        this.contours[ci].points.forEach((_, pi) => this.sel.add(`${ci}:${pi}`));
        this.onSelect();
        this.redraw();
      }
    }
  }

  alignSmooth(ci, pi) {
    const c = this.contours[ci];
    const n = c.points.length;
    const p = c.points[pi];
    const a = c.points[(pi - 1 + n) % n];
    const b = c.points[(pi + 1) % n];
    if (a.on || b.on) return;
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const vl = Math.hypot(vx, vy) || 1;
    const la = dist(a, p);
    const lb = dist(b, p);
    a.x = Math.round(p.x - (vx / vl) * la);
    a.y = Math.round(p.y - (vy / vl) * la);
    b.x = Math.round(p.x + (vx / vl) * lb);
    b.y = Math.round(p.y + (vy / vl) * lb);
  }

  // ---------- Pen tool ----------

  penDown(e, sx, sy, f) {
    const pt = this.hitPoint(sx, sy);
    const contours = this.contours;
    if (this.penDraft) {
      const c = contours[this.penDraft.ci];
      if (pt && pt.ci === this.penDraft.ci && pt.pi === 0 && c.points.length > 2) {
        // Close the contour on its first point.
        history.begin('Close contour', this.scope);
        if (this.penDraft.out) c.points.push({ ...roundPt(this.penDraft.out), on: false });
        c.closed = true;
        const ci = this.penDraft.ci;
        this.penDraft = null;
        this.drag = { kind: 'penHandle', ci, pi: 0, closing: true, origin: { x: c.points[0].x, y: c.points[0].y } };
        return;
      }
      const s = this.snap(f);
      history.begin('Add point', this.scope);
      if (this.penDraft.out) c.points.push({ ...roundPt(this.penDraft.out), on: false });
      this.penDraft.out = null;
      c.points.push({ x: s.x, y: s.y, on: true, type: 'corner' });
      this.drag = { kind: 'penHandle', ci: this.penDraft.ci, pi: c.points.length - 1, origin: s };
      return;
    }
    if (this.editingMaster) {
      if (pt) this.selectDown(e, sx, sy, f);
      return;
    }
    if (pt) {
      const p = contours[pt.ci].points[pt.pi];
      if (e.altKey) {
        this.deletePoints(new Set([`${pt.ci}:${pt.pi}`]));
        return;
      }
      if (p.on && e.shiftKey) {
        history.run('Convert point', this.scope, () => (p.type = p.type === 'smooth' ? 'corner' : 'smooth'));
        return;
      }
      this.selectDown(e, sx, sy, f);
      return;
    }
    const seg = this.hitSegment(sx, sy);
    if (seg) {
      history.run('Insert point', this.scope, () => {
        const i = insertPoint(contours[seg.ci], seg.seg, seg.t);
        this.sel.clear();
        this.sel.add(`${seg.ci}:${i}`);
      });
      this.notify('Point added');
      return;
    }
    // Start a new contour.
    const s = this.snap(f);
    history.begin('New contour', this.scope);
    contours.push({ closed: false, points: [{ x: s.x, y: s.y, on: true, type: 'corner' }] });
    this.penDraft = { ci: contours.length - 1, out: null };
    this.drag = { kind: 'penHandle', ci: this.penDraft.ci, pi: 0, origin: s };
    this.sel.clear();
  }

  /** Dragging after placing a pen point pulls out symmetric handles. */
  penDrag(d, f) {
    const c = this.contours[d.ci];
    const o = d.origin;
    const dx = f.x - o.x;
    const dy = f.y - o.y;
    if (Math.hypot(dx, dy) * this.view.scale < 4) return;
    const on = c.points[d.pi];
    on.type = 'smooth';
    const inHandle = { x: Math.round(o.x - dx), y: Math.round(o.y - dy), on: false };
    if (d.closing) {
      // Incoming handle is the last point of the closed contour.
      if (!d.inAdded) {
        c.points.push(inHandle);
        d.inAdded = true;
      } else Object.assign(c.points[c.points.length - 1], inHandle);
      // Outgoing handle after the first point.
      if (!d.outAdded) {
        if (c.points[1] && !c.points[1].on && d.firstHadOut) Object.assign(c.points[1], { x: Math.round(o.x + dx), y: Math.round(o.y + dy) });
        d.outAdded = true;
      }
      return;
    }
    if (d.pi > 0) {
      if (!d.inAdded) {
        c.points.splice(d.pi, 0, inHandle);
        d.pi++;
        d.inAdded = true;
      } else Object.assign(c.points[d.pi - 1], inHandle);
    }
    if (this.penDraft) this.penDraft.out = { x: o.x + dx, y: o.y + dy };
  }

  finishPen() {
    const d = this.penDraft;
    if (!d) return;
    this.penDraft = null;
    const c = this.contours[d.ci];
    if (!c) return;
    history.run('Finish contour', this.scope, () => {
      if (c.points.filter((p) => p.on).length < 2 && c.points.length < 3) this.contours.splice(d.ci, 1);
      else {
        if (d.out) c.points.push({ ...roundPt(d.out), on: false });
        c.closed = true;
      }
    });
    this.redraw();
  }

  // ---------- Brush, eraser, shapes ----------

  brushOptions() {
    const b = this.S.brush;
    return { size: +b.size, shape: b.shape, angle: +b.angle, pressure: b.pressure, taper: +b.taper / 100 };
  }

  strokePolygon() {
    const st = this.stroke;
    if (!st || !st.samples.length || this.pixelMode) return null;
    const sm = stabilize(st.samples, +this.S.brush.smoothing / 100);
    const o = st.tool === 'eraser' ? { size: +this.S.brush.eraserSize, shape: 'round', pressure: this.S.brush.pressure } : this.brushOptions();
    return strokeOutline(sm, o);
  }

  /** The pixel brush paints whole grid cells (Pixel style). */
  get pixelMode() {
    return this.S.brush.shape === 'pixel';
  }
  get pixelCell() {
    return Math.max(1, +this.S.brush.cell || 100);
  }
  /** Cells under the current stroke. */
  strokeCells() {
    const st = this.stroke;
    if (!st || !st.samples.length) return new Set();
    const size = st.tool === 'eraser' ? +this.S.brush.eraserSize : +this.S.brush.size;
    return stampCells(st.samples, this.pixelCell, Math.min(size, this.pixelCell * 8));
  }

  finishPixelStroke() {
    const st = this.stroke;
    const stamp = this.strokeCells();
    this.stroke = null;
    if (!stamp.size) return;
    const cell = this.pixelCell;
    const erase = st.tool === 'eraser';
    history.run(erase ? 'Erase' : 'Pixels', this.scope, () => {
      if (isPixelAligned(this.contours, cell)) {
        // A pixel letter stays a set of cells: add or remove, then trace again.
        const cells = cellsFromContours(this.contours, cell);
        for (const k of stamp) erase ? cells.delete(k) : cells.add(k);
        this.contours = cellsToContours(cells, cell);
      } else if (erase) {
        this.contours = subtract(this.contours, cellsToContours(stamp, cell).map((c) => c.points), core);
      } else {
        this.contours = safeUnion([...this.contours, ...cellsToContours(stamp, cell)]);
      }
      if (!erase) this.inkFresh = { at: performance.now(), from: 0 };
    });
    this.sel.clear();
  }

  finishStroke() {
    if (this.pixelMode) return this.finishPixelStroke();
    const st = this.stroke;
    const poly = this.strokePolygon();
    this.stroke = null;
    if (!poly || poly.length < 3) return;
    if (st.tool === 'eraser') {
      history.run('Erase', this.scope, () => {
        this.contours = subtract(this.contours, [poly], core);
      });
      this.sel.clear();
      return;
    }
    const b = this.S.brush;
    let made;
    if (b.shape === 'round') {
      // Round brush: the core outliner (exact union of discs and their
      // tangent hulls, refitted with quadratic curves).
      const sm = stabilize(st.samples, +b.smoothing / 100);
      const o = this.brushOptions();
      const n = sm.length;
      const width = (p, i) => {
        let w = o.pressure ? o.size * (0.3 + 0.7 * Math.min(1, p.pressure ?? 0.7)) : o.size;
        w *= 1 + 0.6 * (p.tilt || 0);
        if (o.taper > 0) {
          const t = Math.min(i, n - 1 - i) / Math.max(1, Math.min(n / 2, 12));
          w *= Math.min(1, 1 - o.taper + o.taper * t);
        }
        return Math.max(2, w);
      };
      made = core.strokeToOutline(sm.map((p) => ({ x: p.x, y: p.y, pressure: p.p, tilt: p.tilt })), width, { error: Math.max(0.8, o.size / 50), smoothing: 1 });
    } else {
      const c = polygonToContour(poly, core, Math.max(1, +b.size / 40));
      made = c ? safeUnion([orient(c, true)]) : [];
    }
    made = made.map((c) => ({ ...c, points: c.points.map(roundPt) })).filter((c) => c.points.length >= 3);
    if (!made.length) return;
    history.run('Brush stroke', this.scope, () => {
      let contours = [...this.contours, ...made];
      if (b.merge) contours = safeUnion(contours);
      this.contours = contours;
      this.inkFresh = { at: performance.now(), from: contours.length - made.length };
    });
    this.sel.clear();
  }

  finishShape(d) {
    let { a, b } = d;
    if (Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2) return;
    if (d.shift) {
      const s = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      b = { x: a.x + Math.sign(b.x - a.x || 1) * s, y: a.y + Math.sign(b.y - a.y || 1) * s };
    }
    if (d.alt) a = { x: 2 * a.x - b.x, y: 2 * a.y - b.y };
    const c = d.tool === 'rect' ? rectContour(a.x, a.y, b.x, b.y) : ellipseContour((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2);
    history.run(d.tool === 'rect' ? 'Rectangle' : 'Ellipse', this.scope, () => {
      this.contours.push(c);
      this.sel.clear();
      const ci = this.contours.length - 1;
      c.points.forEach((_, pi) => this.sel.add(`${ci}:${pi}`));
    });
  }

  // ---------- Commands ----------

  selectAll() {
    this.sel.clear();
    this.contours.forEach((c, ci) => c.points.forEach((_, pi) => this.sel.add(`${ci}:${pi}`)));
    this.onSelect();
    this.redraw();
  }

  /** Contour indices with at least one selected point (or all when none). */
  selectedContours(allIfNone = true) {
    const s = new Set([...this.sel].map((k) => +k.split(':')[0]));
    if (!s.size && allIfNone) this.contours.forEach((_, i) => s.add(i));
    return [...s].sort((a, b) => a - b);
  }

  deletePoints(keys = this.sel) {
    if (!keys.size) {
      if (this.selComponent >= 0) {
        history.run('Delete component', this.scope, () => this.glyph.components.splice(this.selComponent, 1));
        this.selComponent = -1;
        this.onSelect();
        this.redraw();
      }
      return;
    }
    if (this.editingMaster) {
      this.notify('Delete points in the Regular master; the Bold master follows its structure.');
      return;
    }
    history.run('Delete', this.scope, () => {
      const by = new Map();
      for (const k of keys) {
        const [ci, pi] = k.split(':').map(Number);
        if (!by.has(ci)) by.set(ci, new Set());
        by.get(ci).add(pi);
      }
      const out = [];
      this.contours.forEach((c, ci) => {
        const del = by.get(ci);
        if (!del) return out.push(c);
        // Whole contour selected: remove it. Otherwise remove the points and
        // the off curve points that belonged only to removed on curve points.
        if (del.size >= c.points.length) return;
        const pts = c.points.filter((_, pi) => !del.has(pi));
        if (pts.filter((p) => p.on).length >= 2 || pts.length >= 3) out.push({ ...c, points: pts });
      });
      this.contours = out;
      // Masters must stay compatible.
      for (const m of P.font.masters || []) delete m.glyphs[this.name];
    });
    this.sel.clear();
    this.onSelect();
    this.redraw();
  }

  nudge(dx, dy) {
    if (this.selComponent >= 0) {
      history.run('Move component', this.scope, () => {
        const c = this.glyph.components[this.selComponent];
        c.dx = (c.dx || 0) + dx;
        c.dy = (c.dy || 0) + dy;
      });
    } else if (this.sel.size) {
      history.run('Nudge', this.scope, () => {
        for (const k of this.sel) {
          const p = this.pointByKey(k);
          if (p) {
            p.x += dx;
            p.y += dy;
          }
        }
      });
    }
    this.redraw();
  }

  /** Applies a matrix to the selection (or to the whole glyph). */
  transformSelection(m, label) {
    const keys = this.sel.size ? [...this.sel] : this.contours.flatMap((c, ci) => c.points.map((_, pi) => `${ci}:${pi}`));
    if (!keys.length) return;
    const flip = m[0] * m[3] - m[1] * m[2] < 0;
    history.run(label, this.scope, () => {
      for (const k of keys) {
        const p = this.pointByKey(k);
        if (!p) continue;
        const x = p.x;
        p.x = Math.round(m[0] * x + m[2] * p.y + m[4]);
        p.y = Math.round(m[1] * x + m[3] * p.y + m[5]);
      }
      if (flip) {
        // Mirrored contours change direction: reverse whole contours back.
        const whole = this.selectedContours().filter((ci) => this.contours[ci].points.every((_, pi) => keys.includes(`${ci}:${pi}`)));
        for (const ci of whole) {
          const c = this.contours[ci];
          const [first, ...rest] = c.points;
          c.points = [first, ...rest.reverse()];
        }
        this.sel.clear();
      }
    });
    this.onSelect();
    this.redraw();
  }

  selectionCenter() {
    const b = this.sel.size ? bbox([{ points: [...this.sel].map((k) => this.pointByKey(k)).filter(Boolean) }]) : bbox(this.contours);
    return b ? { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 } : { x: 0, y: 0 };
  }
  flip(axis) {
    const c = this.selectionCenter();
    this.transformSelection(axis === 'h' ? matrix.scale(-1, 1, c.x, c.y) : matrix.scale(1, -1, c.x, c.y), axis === 'h' ? 'Flip horizontal' : 'Flip vertical');
  }
  rotate(deg) {
    const c = this.selectionCenter();
    this.transformSelection(matrix.rotate(deg, c.x, c.y), `Rotate ${deg}`);
  }
  scaleBy(sx, sy = sx) {
    const c = this.selectionCenter();
    this.transformSelection(matrix.scale(sx, sy, c.x, c.y), 'Scale');
  }

  copy() {
    const g = this.glyph;
    if (!g) return null;
    const idx = this.selectedContours(false);
    const contours = idx.length ? idx.map((i) => clone(this.contours[i])) : clone(this.contours);
    this.clipboard = { contours, components: idx.length ? [] : clone(g.components || []), advanceWidth: g.advanceWidth };
    return this.clipboard;
  }
  cut() {
    const c = this.copy();
    if (!c) return;
    const idx = new Set(this.selectedContours());
    history.run('Cut', this.scope, () => {
      this.contours = this.contours.filter((_, i) => !idx.has(i));
      if (!this.sel.size) this.glyph.components = [];
    });
    this.sel.clear();
    this.redraw();
  }
  paste(data = this.clipboard) {
    if (!data || !this.glyph || this.editingMaster) return;
    history.run('Paste', this.scope, () => {
      const start = this.contours.length;
      this.contours.push(...clone(data.contours));
      if (data.components?.length) this.glyph.components = [...(this.glyph.components || []), ...clone(data.components)];
      if (!this.glyph.contours.length && !this.glyph.components?.length && data.advanceWidth) this.glyph.advanceWidth = data.advanceWidth;
      this.sel.clear();
      for (let ci = start; ci < this.contours.length; ci++) this.contours[ci].points.forEach((_, pi) => this.sel.add(`${ci}:${pi}`));
    });
    this.onSelect();
    this.redraw();
  }

  /** Path operations on the selected contours (or all). */
  pathOp(op) {
    if (this.editingMaster) {
      this.notify('Path operations change the point structure; run them on the Regular master.');
      return;
    }
    const idx = new Set(this.selectedContours());
    const picked = this.contours.filter((_, i) => idx.has(i));
    const rest = this.contours.filter((_, i) => !idx.has(i));
    if (!picked.length) return;
    let out;
    try {
      if (op === 'union') out = safeUnion(picked);
      else if (op === 'direction') out = core.correctDirection(picked);
      else if (op === 'simplify') out = simplifyContours(picked, +this.S.opts.simplifyTolerance || 2);
      else if (op === 'subtract') {
        // The topmost selected contour cuts the others.
        const cutter = picked[picked.length - 1];
        out = subtract(picked.slice(0, -1), [flatten(cutter)], core);
      } else if (op === 'round') out = picked.map((c) => ({ ...c, points: c.points.map(roundPt) }));
      else return;
    } catch (e) {
      this.notify(`Could not run that operation: ${e.message}`);
      return;
    }
    history.run(op === 'union' ? 'Remove overlaps' : op === 'direction' ? 'Correct direction' : op === 'simplify' ? 'Simplify' : op === 'subtract' ? 'Subtract' : 'Round', this.scope, () => {
      this.contours = [...rest, ...out];
      for (const m of P.font.masters || []) delete m.glyphs[this.name];
    });
    this.sel.clear();
    this.onSelect();
    this.redraw();
    const before = picked.reduce((n, c) => n + c.points.length, 0);
    const after = out.reduce((n, c) => n + c.points.length, 0);
    this.notify(`${picked.length} contour${picked.length === 1 ? '' : 's'} in, ${out.length} out, ${before} to ${after} points`);
  }

  /** Converts selected on curve points to corner or smooth, or segments to line or curve. */
  convert(kind) {
    if (!this.sel.size) return;
    history.run('Convert', this.scope, () => {
      const keys = [...this.sel].map((k) => k.split(':').map(Number));
      if (kind === 'smooth' || kind === 'corner') {
        for (const [ci, pi] of keys) {
          const p = this.contours[ci].points[pi];
          if (p.on) {
            p.type = kind;
            if (kind === 'smooth') this.alignSmooth(ci, pi);
          }
        }
        return;
      }
      if (this.editingMaster) return;
      const byContour = new Map();
      for (const [ci, pi] of keys) {
        if (!byContour.has(ci)) byContour.set(ci, new Set());
        byContour.get(ci).add(pi);
      }
      for (const [ci, set] of byContour) {
        const c = this.contours[ci];
        const n = c.points.length;
        if (kind === 'line') {
          // Remove off curve points whose both on curve neighbours are selected.
          const keep = c.points.filter((p, i) => {
            if (p.on) return true;
            let a = i;
            while (!c.points[(a - 1 + n) % n].on && a - i > -n) a--;
            let b = i;
            while (!c.points[(b + 1) % n].on && b - i < n) b++;
            return !(set.has((a - 1 + n) % n) && set.has((b + 1) % n));
          });
          c.points = keep;
        } else if (kind === 'curve') {
          // Line segments between two selected on curve points get a control.
          const out = [];
          c.points.forEach((p, i) => {
            out.push(p);
            const q = c.points[(i + 1) % n];
            if (p.on && q.on && set.has(i) && set.has((i + 1) % n) && (c.closed || i < n - 1)) {
              const mx = (p.x + q.x) / 2;
              const my = (p.y + q.y) / 2;
              const nx = -(q.y - p.y) * 0.25;
              const ny = (q.x - p.x) * 0.25;
              out.push({ x: Math.round(mx + nx), y: Math.round(my + ny), on: false });
            }
          });
          c.points = out;
        }
      }
      for (const m of P.font.masters || []) delete m.glyphs[this.name];
    });
    this.sel.clear();
    this.onSelect();
    this.redraw();
  }

  // ---------- Drawing ----------

  redraw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.draw();
    });
  }

  readColors() {
    const el = this.cv;
    const v = (n, fb) => css(n, el) || fb;
    this.colors = {
      bg: v('--ed-canvas', '#fff'),
      ink: v('--ed-ink', '#111'),
      fill: v('--ed-fill', 'rgba(20,20,30,.12)'),
      comp: v('--ed-comp', 'rgba(60,90,200,.25)'),
      line: v('--ed-line', '#888'),
      guide: v('--ed-guide', '#c7c7d1'),
      guideLabel: v('--ed-guide-label', '#777'),
      grid: v('--ed-grid', 'rgba(0,0,0,.05)'),
      accent: v('--ed-accent', '#e0562b'),
      select: v('--ed-select', '#2b6be0'),
      handle: v('--ed-handle', '#999'),
      ruler: v('--ed-ruler', '#f2f2f5'),
      rulerText: v('--ed-ruler-text', '#888'),
      stem: v('--ed-stem', 'rgba(43,107,224,.14)'),
      ghost: v('--ed-ghost', 'rgba(224,86,43,.35)'),
    };
  }

  draw() {
    const { w, h } = this.size;
    if (!w || !h) return;
    const ctx = fitCanvas(this.cv, w, h);
    if (!this.colors || this.colorsStale) {
      this.readColors();
      this.colorsStale = false;
    }
    const C = this.colors;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);
    const g = this.glyph;
    if (!g || !P.font) return;
    const m = P.font.meta;
    const tf = (x, y) => this.toScreen(x, y);
    const o = this.S.opts;
    const preview = o.preview;

    // Grid
    if (o.grid && !preview) {
      const step = Math.max(1, +o.gridSize || 10);
      let k = 1;
      while (step * k * this.view.scale < 8) k *= 2;
      const gs = step * k;
      const f0 = this.toFont(0, h);
      const f1 = this.toFont(w, 0);
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = Math.floor(f0.x / gs) * gs; x <= f1.x; x += gs) {
        const [sx] = tf(x, 0);
        ctx.moveTo(Math.round(sx) + 0.5, 0);
        ctx.lineTo(Math.round(sx) + 0.5, h);
      }
      for (let y = Math.floor(f0.y / gs) * gs; y <= f1.y; y += gs) {
        const [, sy] = tf(0, y);
        ctx.moveTo(0, Math.round(sy) + 0.5);
        ctx.lineTo(w, Math.round(sy) + 0.5);
      }
      ctx.stroke();
    }

    // Reference image
    const bg = P.extras.backgrounds?.[g.name];
    if (bg && bg.src && !preview) {
      let img = this.bgImages.get(bg.src);
      if (!img) {
        img = new Image();
        img.onload = () => this.redraw();
        img.src = bg.src;
        this.bgImages.set(bg.src, img);
      }
      if (img.complete && img.naturalWidth) {
        const height = (bg.scale || 1) * (m.ascender - m.descender);
        const width = (height * img.naturalWidth) / img.naturalHeight;
        const [x0, y0] = tf(bg.x || 0, (bg.y || 0) + height + m.descender);
        ctx.globalAlpha = bg.opacity ?? 0.35;
        ctx.drawImage(img, x0, y0, width * this.view.scale, height * this.view.scale);
        ctx.globalAlpha = 1;
      }
    }

    // Guide letter (quick mode): the style template's letter, very faint.
    const guide = this.guide;
    if (guide && guide.name === g.name && guide.contours?.length && !preview) {
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      tracePath(ctx, guide.contours, tf);
      ctx.fill('nonzero');
      ctx.restore();
    }

    // Metric guides
    if (o.metrics !== false) {
      const [ax0] = tf(0, 0);
      const [ax1] = tf(g.advanceWidth, 0);
      const lines = [
        ['ascender', m.ascender],
        ['cap height', m.capHeight],
        ['x-height', m.xHeight],
        ['baseline', 0],
        ['descender', m.descender],
      ];
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
      ctx.textBaseline = 'bottom';
      // The glyph box
      ctx.fillStyle = C.grid;
      const [, ya] = tf(0, m.ascender);
      const [, yd] = tf(0, m.descender);
      ctx.fillRect(ax0, ya, ax1 - ax0, yd - ya);
      for (const [label, y] of lines) {
        const [, sy] = tf(0, y);
        ctx.strokeStyle = label === 'baseline' ? C.line : C.guide;
        ctx.lineWidth = label === 'baseline' ? 1.5 : 1;
        ctx.setLineDash(label === 'baseline' ? [] : [4, 4]);
        ctx.beginPath();
        ctx.moveTo(RULER, Math.round(sy) + 0.5);
        ctx.lineTo(w, Math.round(sy) + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = C.guideLabel;
        ctx.fillText(`${label} ${y}`, Math.max(RULER + 4, ax1 + 8), sy - 2);
      }
      // Side bearings (draggable)
      const hot = this.hover?.kind === 'metric' || this.drag?.kind === 'metric';
      for (const x of [ax0, ax1]) {
        ctx.strokeStyle = hot ? C.accent : C.line;
        ctx.lineWidth = hot ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, RULER);
        ctx.lineTo(Math.round(x) + 0.5, h);
        ctx.stroke();
      }
      // Bearing labels
      const ib = bbox(this.contours);
      ctx.fillStyle = C.guideLabel;
      ctx.textBaseline = 'top';
      const [, by] = tf(0, m.descender);
      const lsb = ib ? Math.round(ib.xMin) : 0;
      const rsb = ib ? Math.round(g.advanceWidth - ib.xMax) : 0;
      ctx.fillText(`LSB ${lsb}`, ax0 + 4, by + 6);
      const rl = `RSB ${rsb}`;
      ctx.fillText(rl, ax1 - ctx.measureText(rl).width - 4, by + 6);
      const wl = `${g.advanceWidth}`;
      ctx.fillText(wl, (ax0 + ax1) / 2 - ctx.measureText(wl).width / 2, by + 22);
    }

    // Hinting stems
    if (o.stems && g.hints?.stems && !preview) {
      ctx.fillStyle = C.stem;
      for (const [pos, width] of g.hints.stems.v || []) {
        const [x0] = tf(pos, 0);
        const [x1] = tf(pos + width, 0);
        ctx.fillRect(Math.min(x0, x1), RULER, Math.abs(x1 - x0), h);
      }
      for (const [pos, width] of g.hints.stems.h || []) {
        const [, y0] = tf(0, pos);
        const [, y1] = tf(0, pos + width);
        ctx.fillRect(RULER, Math.min(y0, y1), w, Math.abs(y1 - y0));
      }
    }

    // Ghost of the other master when editing Bold.
    if (this.editingMaster) {
      ctx.strokeStyle = C.ghost;
      ctx.lineWidth = 1;
      ctx.beginPath();
      tracePath(ctx, g.contours, tf);
      ctx.stroke();
    }

    // Components
    if (g.components?.length) {
      g.components.forEach((comp, i) => {
        const base = P.font.glyphs[comp.glyph];
        if (!base) return;
        const s = comp.scale ?? 1;
        const cs = transformContours(resolve(P.font, base), [s, 0, 0, s, comp.dx || 0, comp.dy || 0]);
        ctx.fillStyle = preview ? C.ink : i === this.selComponent ? C.select : C.comp;
        ctx.beginPath();
        tracePath(ctx, cs, tf);
        ctx.fill('nonzero');
      });
    }

    // Outlines
    const contours = this.contours;
    ctx.beginPath();
    tracePath(ctx, contours, tf);
    ctx.fillStyle = preview ? C.ink : C.fill;
    ctx.fill('nonzero');
    if (!preview) {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }

    // Fresh ink: a glossy highlight sweeps across and fades as it dries.
    const fresh = this.inkFresh;
    if (fresh && !preview) {
      const age = performance.now() - fresh.at;
      if (age < 800) {
        const k = age / 800;
        ctx.save();
        ctx.beginPath();
        tracePath(ctx, contours, tf);
        ctx.clip('nonzero');
        ctx.fillStyle = C.ink;
        ctx.globalAlpha = 0.55 * (1 - k);
        ctx.fill();
        const gx = w * (k * 1.4 - 0.2);
        const g = ctx.createLinearGradient(gx - 160, 0, gx + 160, h);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, `rgba(255,255,255,${0.32 * (1 - k)})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        this.redraw();
      } else this.inkFresh = null;
    }

    // Live stroke
    if (this.stroke && this.pixelMode) {
      const cell = this.pixelCell;
      ctx.fillStyle = this.stroke.tool === 'eraser' ? 'rgba(224,86,43,.35)' : C.ink;
      for (const k of this.strokeCells()) {
        const [i, j] = k.split(',').map(Number);
        const [x0, y0] = tf(i * cell, (j + 1) * cell);
        const [x1, y1] = tf((i + 1) * cell, j * cell);
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    } else if (this.stroke) {
      const poly = this.strokePolygon();
      if (poly) {
        ctx.beginPath();
        poly.forEach((p, i) => (i ? ctx.lineTo(...tf(p.x, p.y)) : ctx.moveTo(...tf(p.x, p.y))));
        ctx.closePath();
        if (this.stroke.tool === 'eraser') {
          ctx.fillStyle = 'rgba(224,86,43,.25)';
          ctx.fill('nonzero');
          ctx.strokeStyle = C.accent;
          ctx.stroke();
        } else {
          ctx.fillStyle = C.ink;
          ctx.fill('nonzero');
        }
      }
    }

    // Brush cursor
    const tool = this.space ? 'hand' : this.S.tool;
    if ((tool === 'brush' || tool === 'eraser') && this.cursorPos && !this.drag) {
      const [cx, cy] = tf(this.cursorPos.x, this.cursorPos.y);
      const size = (tool === 'eraser' ? +this.S.brush.eraserSize : +this.S.brush.size) * this.view.scale;
      ctx.strokeStyle = tool === 'eraser' ? C.accent : C.select;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (this.pixelMode) {
        const cell = this.pixelCell;
        const k = Math.max(1, Math.round(Math.min((tool === 'eraser' ? +this.S.brush.eraserSize : +this.S.brush.size), cell * 8) / cell));
        const i = Math.floor(this.cursorPos.x / cell) - Math.floor((k - 1) / 2);
        const j = Math.floor(this.cursorPos.y / cell) - Math.floor((k - 1) / 2);
        const [x0, y0] = tf(i * cell, (j + k) * cell);
        const [x1, y1] = tf((i + k) * cell, j * cell);
        ctx.rect(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.round(x1 - x0), Math.round(y1 - y0));
      } else if (tool === 'brush' && this.S.brush.shape !== 'round') {
        const a = (+this.S.brush.angle * Math.PI) / 180;
        ctx.moveTo(cx - (Math.cos(a) * size) / 2, cy + (Math.sin(a) * size) / 2);
        ctx.lineTo(cx + (Math.cos(a) * size) / 2, cy - (Math.sin(a) * size) / 2);
      } else ctx.arc(cx, cy, Math.max(2, size / 2), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shape preview
    if (this.drag?.kind === 'shape') {
      const d = this.drag;
      let { a, b } = d;
      if (d.shift) {
        const s = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        b = { x: a.x + Math.sign(b.x - a.x || 1) * s, y: a.y + Math.sign(b.y - a.y || 1) * s };
      }
      if (d.alt) a = { x: 2 * a.x - b.x, y: 2 * a.y - b.y };
      const c = d.tool === 'rect' ? rectContour(a.x, a.y, b.x, b.y) : ellipseContour((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2);
      ctx.beginPath();
      tracePath(ctx, [c], tf);
      ctx.fillStyle = C.fill;
      ctx.fill();
      ctx.strokeStyle = C.select;
      ctx.stroke();
    }

    // Points and handles
    const showPoints = !preview && o.points !== false && (this.S.pro || this.editingMaster) && (tool === 'select' || tool === 'pen' || this.sel.size > 0 || this.editingMaster);
    if (showPoints) this.drawPoints(ctx, contours, tf, C);

    // Pen hover on a segment
    if (this.hover?.kind === 'segment' && tool === 'pen') {
      const f = this.cursorPos;
      const r = closestOnSegment(this.hover.seg, f.x, f.y);
      const [sx, sy] = tf(r.x, r.y);
      ctx.fillStyle = C.select;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pending outgoing pen handle
    if (this.penDraft?.out) {
      const c = contours[this.penDraft.ci];
      const last = c?.points[c.points.length - 1];
      if (last) {
        const [x0, y0] = tf(last.x, last.y);
        const [x1, y1] = tf(this.penDraft.out.x, this.penDraft.out.y);
        ctx.strokeStyle = C.handle;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x1, y1, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = C.bg;
        ctx.fill();
        ctx.stroke();
      }
    }

    // Selection box and transform handles
    if (tool === 'select' && !this.drag?.kind?.startsWith('marq')) {
      const hs = this.handles();
      if (hs.length) {
        const b = this.selectionBox();
        const [l, t] = tf(b.xMin, b.yMax);
        const [r, bt] = tf(b.xMax, b.yMin);
        ctx.strokeStyle = C.select;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(l) + 0.5, Math.round(t) + 0.5, Math.round(r - l), Math.round(bt - t));
        ctx.setLineDash([]);
        for (const hd of hs) {
          ctx.fillStyle = C.bg;
          ctx.strokeStyle = C.select;
          ctx.beginPath();
          if (hd.id === 'rot') {
            ctx.moveTo((l + r) / 2, t);
            ctx.lineTo(hd.x, hd.y + 5);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(hd.x, hd.y, 5, 0, Math.PI * 2);
          } else ctx.rect(hd.x - 4, hd.y - 4, 8, 8);
          ctx.fill();
          ctx.stroke();
        }
      }
    }
    if (this.drag?.kind === 'marquee') {
      const { a, b } = this.drag;
      ctx.fillStyle = 'rgba(43,107,224,.08)';
      ctx.strokeStyle = C.select;
      ctx.fillRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy);
      ctx.strokeRect(a.sx + 0.5, a.sy + 0.5, b.sx - a.sx, b.sy - a.sy);
    }

    if (o.rulers !== false) this.drawRulers(ctx, w, h, C);
  }

  drawPoints(ctx, contours, tf, C) {
    // Handle lines from on curve points to their controls.
    ctx.strokeStyle = C.handle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const c of contours) {
      const n = c.points.length;
      c.points.forEach((p, i) => {
        if (p.on) return;
        for (const j of [i - 1, i + 1]) {
          if (!c.closed && (j < 0 || j >= n)) continue;
          const q = c.points[(j + n) % n];
          const [x0, y0] = tf(p.x, p.y);
          const [x1, y1] = tf(q.x, q.y);
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
        }
      });
    }
    ctx.stroke();
    contours.forEach((c, ci) => {
      c.points.forEach((p, pi) => {
        const [x, y] = tf(p.x, p.y);
        const key = `${ci}:${pi}`;
        const selected = this.sel.has(key);
        const hovered = this.hover?.kind === 'point' && this.hover.ci === ci && this.hover.pi === pi;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = selected ? C.select : p.on ? C.ink : C.handle;
        ctx.fillStyle = selected ? C.select : C.bg;
        ctx.beginPath();
        const r = hovered ? 5.5 : 4;
        if (!p.on) ctx.arc(x, y, r - 1, 0, Math.PI * 2);
        else if (p.type === 'smooth') ctx.arc(x, y, r, 0, Math.PI * 2);
        else ctx.rect(x - r, y - r, r * 2, r * 2);
        ctx.fill();
        ctx.stroke();
        // Start point marker shows the contour direction.
        if (pi === 0 && c.points.length > 1) {
          const q = c.points[1];
          const [qx, qy] = tf(q.x, q.y);
          const a = Math.atan2(qy - y, qx - x);
          ctx.fillStyle = C.accent;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
          ctx.lineTo(x + Math.cos(a + 2.5) * 6 + Math.cos(a) * 6, y + Math.sin(a + 2.5) * 6 + Math.sin(a) * 6);
          ctx.lineTo(x + Math.cos(a - 2.5) * 6 + Math.cos(a) * 6, y + Math.sin(a - 2.5) * 6 + Math.sin(a) * 6);
          ctx.closePath();
          ctx.fill();
        }
      });
    });
  }

  drawRulers(ctx, w, h, C) {
    ctx.fillStyle = C.ruler;
    ctx.fillRect(0, 0, w, RULER);
    ctx.fillRect(0, 0, RULER, h);
    ctx.strokeStyle = C.guide;
    ctx.beginPath();
    ctx.moveTo(0, RULER + 0.5);
    ctx.lineTo(w, RULER + 0.5);
    ctx.moveTo(RULER + 0.5, 0);
    ctx.lineTo(RULER + 0.5, h);
    ctx.stroke();
    const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    const step = steps.find((s) => s * this.view.scale >= 50) || 1000;
    ctx.fillStyle = C.rulerText;
    ctx.strokeStyle = C.rulerText;
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.beginPath();
    const f0 = this.toFont(RULER, h);
    const f1 = this.toFont(w, RULER);
    for (let x = Math.floor(f0.x / step) * step; x <= f1.x; x += step / 5) {
      const [sx] = this.toScreen(x, 0);
      if (sx < RULER) continue;
      const major = Math.abs(x / step - Math.round(x / step)) < 1e-6;
      ctx.moveTo(Math.round(sx) + 0.5, major ? 6 : 14);
      ctx.lineTo(Math.round(sx) + 0.5, RULER);
      if (major) ctx.fillText(String(Math.round(x)), sx + 3, 2);
    }
    for (let y = Math.floor(f0.y / step) * step; y <= f1.y; y += step / 5) {
      const [, sy] = this.toScreen(0, y);
      if (sy < RULER) continue;
      const major = Math.abs(y / step - Math.round(y / step)) < 1e-6;
      ctx.moveTo(major ? 6 : 14, Math.round(sy) + 0.5);
      ctx.lineTo(RULER, Math.round(sy) + 0.5);
      if (major) {
        ctx.save();
        ctx.translate(2, sy - 3);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(Math.round(y)), 0, 0);
        ctx.restore();
      }
    }
    ctx.stroke();
    // Cursor marks
    if (this.cursorPos) {
      const [cx, cy] = this.toScreen(this.cursorPos.x, this.cursorPos.y);
      ctx.strokeStyle = C.accent;
      ctx.beginPath();
      ctx.moveTo(cx + 0.5, 0);
      ctx.lineTo(cx + 0.5, RULER);
      ctx.moveTo(0, cy + 0.5);
      ctx.lineTo(RULER, cy + 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = C.ruler;
    ctx.fillRect(0, 0, RULER, RULER);
  }
}

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

/** Vector union from the core, with a raster fallback when it throws. */
export function safeUnion(contours) {
  try {
    return core.removeOverlaps(contours);
  } catch (e) {
    console.warn('removeOverlaps failed, using raster union', e);
    return rasterUnion(contours, core);
  }
}

/** Reduces point count: flattens, simplifies and refits each contour. */
export function simplifyContours(contours, tolerance) {
  return contours
    .map((c) => {
      if (core.simplify && c.points.length > 6) {
        const poly = flatten(c, 6);
        const simple = core.simplify([...poly, poly[0]], tolerance).slice(0, -1);
        const out = polygonToContour(simple.length >= 3 ? simple : poly, core, tolerance);
        if (!out) return c;
        return orient(out, polyClockwise(c));
      }
      return c;
    })
    .filter(Boolean);
}
const polyClockwise = (c) => {
  const p = flatten(c);
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j].x - p[i].x) * (p[j].y + p[i].y);
  return a < 0;
};
