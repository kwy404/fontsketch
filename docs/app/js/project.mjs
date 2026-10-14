// The open project: the font, editor extras (reference images, charset),
// undo history, change notifications and autosave.
import { clone } from './geom.mjs';
import { newId, saveProject } from './idb.mjs';

/** @type {any} */
export let core = null;
export const setCore = (c) => (core = c);

export const P = {
  /** @type {any} */ font: null,
  id: '',
  extras: { backgrounds: {}, charset: 'basic', custom: '', previewText: '' },
  rev: 0,
  dirty: false,
};

const listeners = new Set();
/** Subscribe to changes: fn({ kind, glyphs }) where kind is 'glyph', 'font', 'meta', 'kerning' or 'load'. */
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

let saveTimer = 0;
export function changed(kind = 'font', glyphs = null) {
  P.rev++;
  P.dirty = true;
  invalidate();
  for (const fn of listeners) fn({ kind, glyphs });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(autosave, 1200);
}

// ---------- Load, serialize ----------

export function loadFont(font, { id = newId(), extras = {} } = {}) {
  P.font = font;
  P.id = id;
  P.extras = { backgrounds: {}, charset: 'basic', custom: '', previewText: '', ...extras };
  history.clear();
  P.rev++;
  P.dirty = false;
  invalidate();
  for (const fn of listeners) fn({ kind: 'load', glyphs: null });
}

/** The `.fontsketch.json` text: the core project format plus an `app` block. */
export function projectJSON() {
  const data = JSON.parse(core.serialize(P.font));
  data.app = { extras: P.extras };
  return JSON.stringify(data);
}

/** Reads a project file (string). Returns { font, extras }. */
export function readProject(text) {
  const data = JSON.parse(text);
  const font = core.deserialize(text);
  return { font, extras: (data && data.app && data.app.extras) || {} };
}

export async function autosave() {
  if (!P.font || !P.dirty) return;
  P.dirty = false;
  const glyphs = Object.values(P.font.glyphs).filter((g) => g.contours?.length || g.components?.length).length;
  try {
    await saveProject({
      id: P.id,
      name: P.font.meta.family || 'Untitled',
      updated: Date.now(),
      glyphs,
      sample: Object.values(P.font.glyphs)
        .filter((g) => g.unicodes?.length && (g.contours?.length || g.components?.length))
        .slice(0, 8)
        .map((g) => String.fromCodePoint(g.unicodes[0]))
        .join(''),
      data: projectJSON(),
    });
    for (const fn of listeners) fn({ kind: 'saved', glyphs: null });
  } catch (e) {
    console.warn('autosave failed', e);
    P.dirty = true;
  }
}

// ---------- Lookups (cached per revision) ----------

let cmapRev = -1;
let cmap = new Map();
function invalidate() {
  cmapRev = -1;
}
/** Glyph for a character (by code point), or undefined. */
export function glyphFor(ch) {
  if (cmapRev !== P.rev) {
    cmap = new Map();
    for (const g of Object.values(P.font.glyphs)) for (const u of g.unicodes || []) cmap.set(u, g);
    cmapRev = P.rev;
  }
  return cmap.get(ch.codePointAt(0));
}

/** Kerning value between two glyph names, honouring classes. */
export function kernValue(font, left, right) {
  const pairs = font.kerning.pairs;
  const direct = pairs[`${left}|${right}`];
  if (direct !== undefined) return direct;
  const classesOf = (name) => Object.entries(font.kerning.classes).filter(([, m]) => m.includes(name)).map(([k]) => k);
  const lc = classesOf(left);
  const rc = classesOf(right);
  for (const r of rc) if (pairs[`${left}|${r}`] !== undefined) return pairs[`${left}|${r}`];
  for (const l of lc) if (pairs[`${l}|${right}`] !== undefined) return pairs[`${l}|${right}`];
  for (const l of lc) for (const r of rc) if (pairs[`${l}|${r}`] !== undefined) return pairs[`${l}|${r}`];
  return 0;
}

// ---------- Undo history ----------

/**
 * Snapshot based history. A change declares its scope: glyph names (the
 * glyph and its master copies), or 'kerning', 'meta' or 'font' (everything).
 */
class History {
  constructor(limit = 300) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
    this.pending = null;
  }
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.pending = null;
  }
  snap(scope) {
    const f = P.font;
    if (scope === 'font') return { font: clone(f) };
    if (scope === 'kerning') return { kerning: clone(f.kerning) };
    if (scope === 'meta') return { meta: clone(f.meta), axes: clone(f.axes || null) };
    const glyphs = {};
    const masters = (f.masters || []).map(() => ({}));
    for (const name of scope) {
      glyphs[name] = f.glyphs[name] ? clone(f.glyphs[name]) : null;
      (f.masters || []).forEach((m, i) => (masters[i][name] = m.glyphs[name] ? clone(m.glyphs[name]) : null));
    }
    return { glyphs, masters };
  }
  restore(s) {
    const f = P.font;
    if (s.font) {
      for (const k of Object.keys(f)) delete f[k];
      Object.assign(f, clone(s.font));
      return { kind: 'font' };
    }
    if (s.kerning) {
      f.kerning = clone(s.kerning);
      return { kind: 'kerning' };
    }
    if (s.meta) {
      f.meta = clone(s.meta);
      if (s.axes) f.axes = clone(s.axes);
      else delete f.axes;
      return { kind: 'meta' };
    }
    for (const [name, g] of Object.entries(s.glyphs)) {
      if (g) f.glyphs[name] = clone(g);
      else delete f.glyphs[name];
    }
    (f.masters || []).forEach((m, i) => {
      for (const [name, g] of Object.entries(s.masters[i] || {})) {
        if (g) m.glyphs[name] = clone(g);
        else delete m.glyphs[name];
      }
    });
    return { kind: 'glyph', glyphs: Object.keys(s.glyphs) };
  }
  /** Starts a change. Call commit() when done (or cancel()). */
  begin(label, scope) {
    if (this.pending) this.commit();
    this.pending = { label, scope, before: this.snap(scope) };
  }
  commit() {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    p.after = this.snap(p.scope);
    if (JSON.stringify(p.after) === JSON.stringify(p.before)) return;
    this.undoStack.push(p);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    const r = p.scope === 'font' || p.scope === 'kerning' || p.scope === 'meta' ? { kind: p.scope } : { kind: 'glyph', glyphs: p.scope };
    changed(r.kind, r.glyphs);
  }
  cancel() {
    if (this.pending) this.restore(this.pending.before);
    this.pending = null;
  }
  /** Runs fn as one undoable change. */
  run(label, scope, fn) {
    this.begin(label, scope);
    try {
      fn();
    } catch (e) {
      this.cancel();
      throw e;
    }
    this.commit();
  }
  undo() {
    if (this.pending) this.commit();
    const e = this.undoStack.pop();
    if (!e) return null;
    this.redoStack.push(e);
    const r = this.restore(e.before);
    changed(r.kind, r.glyphs);
    return e.label;
  }
  redo() {
    const e = this.redoStack.pop();
    if (!e) return null;
    this.undoStack.push(e);
    const r = this.restore(e.after);
    changed(r.kind, r.glyphs);
    return e.label;
  }
  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
}

export const history = new History();

/** Ensures a glyph exists for a character or name and returns it. */
export function ensureGlyph(name, unicode) {
  const f = P.font;
  if (!f.glyphs[name]) {
    const cap = f.meta.capHeight;
    core.addGlyph(f, { name, unicodes: unicode !== undefined ? [unicode] : undefined, advanceWidth: Math.round(cap * 0.85), contours: [] });
    for (const m of f.masters || []) m.glyphs[name] = { contours: [] };
  }
  return f.glyphs[name];
}
