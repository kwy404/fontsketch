// fontsketch editor: boot and the shared controller. Voodoo.js renders the
// panels from the reactive store S and calls actions on A; the canvas engine
// (editor.mjs) and the panel modules are plain JavaScript.
import * as lib from '../lib/fontsketch.mjs';
import { Editor } from './editor.mjs';
import { bbox, clone, inkBounds, matrix, status, transformContours } from './geom.mjs';
import { deleteProject, getSetting, listProjects, loadProject, newId, setSetting, takeHandoff } from './idb.mjs';
import { installLetters } from './letters.mjs';
import { P, changed, ensureGlyph, history, loadFont, onChange, readProject, setCore } from './project.mjs';
import { installDraw } from './panels/draw.mjs';
import { installExport } from './panels/exporter.mjs';
import { installFontPanel } from './panels/fontpanel.mjs';
import { installImports } from './panels/imports.mjs';
import { installSheet } from './panels/sheet.mjs';
import { installSpacing } from './panels/spacing.mjs';
import { installTemplates } from './panels/templates.mjs';
import { installQuick } from './panels/quickmode.mjs';
import { installTest } from './panels/test.mjs';

setCore(lib);
const V = window.V;
const $ = (s) => document.querySelector(s);
const prefersSmall = matchMedia('(max-width: 640px)').matches;

const S = V.reactive({
  ready: false,
  pro: false,
  panel: prefersSmall ? null : 'letters',
  wide: false,
  inspector: !matchMedia('(max-width: 1199px)').matches,
  tool: 'brush',
  brush: { size: 70, smoothing: 45, taper: 25, shape: 'round', angle: 35, pressure: true, merge: true, eraserSize: 90, preset: 'marker', cell: 100 },
  opts: { grid: false, snap: false, gridSize: 10, metrics: true, rulers: true, points: true, preview: false, stems: false, simplifyTolerance: 2, snapPoints: true },
  master: 0,
  zoom: 100,
  glyph: { name: '', char: '', code: '', label: '', adv: 0, lsb: 0, rsb: 0, status: 'empty', components: [], contours: 0, points: 0, bg: false, bgOpacity: 35, bgScale: 100, composable: false },
  sel: { count: 0, label: '', x: 0, y: 0, w: 0, h: 0, point: false, px: 0, py: 0, ptype: '' },
  status: { saved: '', pos: '' },
  canUndo: false,
  canRedo: false,
  font: { family: '', style: '', designer: '', license: '', version: '', ascender: 0, descender: 0, xHeight: 0, capHeight: 0, upm: 1000, total: 0, drawn: 0 },
  letters: { charset: 'basic', q: '', status: 'all', add: '' },
  fillFrom: 'quill-hand',
  compAdd: '',
  trace: { has: false, threshold: 50, invert: false },
  svgSheet: [],
  sheet: { step: 1, set: 'upper-lower', page: 'A4', guides: true, camera: false, busy: '', error: '', cells: [], found: 0, low: 0, warnings: [], cur: '', curConf: 0, curSkip: false, threshold: 50, accepting: 0 },
  spacing: { amount: 50 },
  kern: { leftChar: 'A', rightChar: 'V', left: 'A', right: 'V', value: 0, pairs: [], classes: [], newClass: '', suggest: ['AV', 'To', 'Ty', 'LT', 'Yo', 'Wa', 'P.', 'r.', 'AT', 'Va'] },
  test: { mode: 'type', text: 'The quick brown fox jumps over the lazy dog', size: 64, lh: 125, ls: 0, dark: false, weight: 400, error: '' },
  hint: { mode: 'auto', stems: [] },
  variable: { has: false, min: 100, def: 400, max: 900, embolden: 45, preview: 400 },
  problems: [],
  exporting: false,
  use: { tab: 'computer' },
  projects: [],
  lastProject: null,
  tour: { on: false, i: 0, title: '', text: '' },
  quick: { on: false, busy: false, style: 'script', capitals: false, guide: true, i: 0, total: 26, char: '', done: 0, here: false, last: false, tip: '', report: [], sample: '' },
  toasts: [],
});

const A = {};
Object.assign(V.config.globals, { S, A, Math });
window.fontsketchApp = { S, A, P, lib, history };

// ---------- Toasts ----------

let toastId = 0;
const toastActions = new Map();
A.toast = (text, kind = 'info', action = null, fn = null, ms = 3200) => {
  const id = ++toastId;
  S.toasts.push({ id, text, kind, action });
  if (fn) toastActions.set(id, fn);
  setTimeout(() => {
    const i = S.toasts.findIndex((t) => t.id === id);
    if (i >= 0) S.toasts.splice(i, 1);
    toastActions.delete(id);
  }, action ? Math.max(ms, 6000) : ms);
};
A.toastAction = (id) => {
  const fn = toastActions.get(id);
  const i = S.toasts.findIndex((t) => t.id === id);
  if (i >= 0) S.toasts.splice(i, 1);
  if (fn) fn();
};

// ---------- Editor ----------

const editor = new Editor($('#cv'), {
  S,
  notify: (m) => A.toast(m),
  onSelect: () => syncSelection(),
  onView: () => {
    S.zoom = Math.round(editor.view.scale * 100 * (P.font ? 1000 / P.font.meta.unitsPerEm : 1));
    placeCtxbar();
  },
});
const ctx = { S, A, P, V, lib, editor, history, changed };
window.fontsketchApp.ctx = ctx;

/** Glyph order for navigation (set by letters.mjs). */
ctx.order = [];

function charOf(g) {
  return g && g.unicodes && g.unicodes.length ? String.fromCodePoint(g.unicodes[0]) : '';
}
ctx.charOf = charOf;

function syncGlyph() {
  const g = editor.glyph;
  if (!g) return;
  const ch = charOf(g);
  const contours = editor.contours;
  const ib = inkBounds(contours.length ? contours : []);
  const bg = P.extras.backgrounds?.[g.name];
  const nfd = ch ? ch.normalize('NFD') : '';
  Object.assign(S.glyph, {
    name: g.name,
    char: ch && ch.trim() ? ch : '',
    code: g.unicodes?.length ? `U+${g.unicodes[0].toString(16).toUpperCase().padStart(4, '0')}` : 'no code point',
    label: ch && ch.trim() && ch !== g.name ? `${ch} (${g.name})` : g.name,
    adv: g.advanceWidth,
    lsb: ib ? Math.round(ib.xMin) : 0,
    rsb: ib ? Math.round(g.advanceWidth - ib.xMax) : 0,
    status: status(g),
    components: (g.components || []).map((c) => ({ glyph: c.glyph, dx: c.dx || 0, dy: c.dy || 0 })),
    contours: contours.length,
    points: contours.reduce((n, c) => n + c.points.length, 0),
    bg: !!bg,
    bgOpacity: Math.round((bg?.opacity ?? 0.35) * 100),
    bgScale: Math.round((bg?.scale ?? 1) * 100),
    composable: nfd.length > 1 && !!lib.glyphNameFor && !!P.font.glyphs[lib.glyphNameFor(nfd[0])],
  });
  if (ctx.onGlyphSync) ctx.onGlyphSync();
}
ctx.syncGlyph = syncGlyph;

function syncSelection() {
  const n = editor.sel.size;
  const contoursSel = n ? editor.selectedContours(false).length : 0;
  const b = n ? bbox([{ points: [...editor.sel].map((k) => editor.pointByKey(k)).filter(Boolean) }]) : null;
  const one = n === 1 ? editor.pointByKey([...editor.sel][0]) : null;
  Object.assign(S.sel, {
    count: n || (editor.selComponent >= 0 ? 1 : 0),
    label: n
      ? S.pro
        ? `${n} point${n === 1 ? '' : 's'} in ${contoursSel} shape${contoursSel === 1 ? '' : 's'}. Drag the box to scale, the dot above it to rotate.`
        : `${contoursSel} shape${contoursSel === 1 ? '' : 's'} selected. Drag to move, corners to scale, the dot to rotate.`
      : editor.selComponent >= 0
        ? 'Component selected. Drag it or use the arrow keys.'
        : S.tool === 'pen'
          ? 'Click to add corners, drag for curves, click the first point to close. Enter finishes.'
          : 'Click a shape to select it, or drag a box around several.',
    x: b ? Math.round(b.xMin) : 0,
    y: b ? Math.round(b.yMin) : 0,
    w: b ? Math.round(b.xMax - b.xMin) : 0,
    h: b ? Math.round(b.yMax - b.yMin) : 0,
    point: !!one,
    px: one ? one.x : 0,
    py: one ? one.y : 0,
    ptype: one ? (one.on ? `On curve, ${one.type || 'corner'}` : 'Off curve control') : '',
  });
  placeCtxbar();
}

// Floating contextual toolbar near the selection.
const ctxbar = $('#ctxbar');
function placeCtxbar() {
  const show = S.tool === 'select' && editor.sel.size > 0 && !editor.drag;
  ctxbar.hidden = !show;
  if (!show) return;
  const b = bbox([{ points: [...editor.sel].map((k) => editor.pointByKey(k)).filter(Boolean) }]);
  if (!b) return;
  const [l, t] = editor.toScreen(b.xMin, b.yMax);
  const [r, bt] = editor.toScreen(b.xMax, b.yMin);
  const stage = $('#stage').getBoundingClientRect();
  const w = ctxbar.offsetWidth || 320;
  const h = ctxbar.offsetHeight || 40;
  let x = (l + r) / 2 - w / 2;
  let y = t - h - 40;
  if (y < 60) y = bt + 14;
  x = Math.max(8, Math.min(stage.width - w - 8, x));
  y = Math.max(56, Math.min(stage.height - h - 70, y));
  ctxbar.style.left = `${x}px`;
  ctxbar.style.top = `${y}px`;
}
ctxbar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'flipH') editor.flip('h');
  else if (act === 'flipV') editor.flip('v');
  else if (act === 'rotate') editor.rotate(-90);
  else if (act === 'union') editor.pathOp('union');
  else if (act === 'subtract') editor.pathOp('subtract');
  else if (act === 'simplify') editor.pathOp('simplify');
  else if (act === 'delete') editor.deletePoints();
  else if (act === 'duplicate') A.duplicateTo();
  syncSelection();
});
const origRedraw = editor.draw.bind(editor);
editor.draw = () => {
  origRedraw();
  if (!ctxbar.hidden || (S.tool === 'select' && editor.sel.size)) placeCtxbar();
};

// ---------- Glyph navigation ----------

A.selectGlyph = (name, { focus = false } = {}) => {
  if (!P.font.glyphs[name]) return;
  editor.setGlyph(name);
  syncGlyph();
  syncSelection();
  if (ctx.onGlyphSelected) ctx.onGlyphSelected(name);
  if (focus) $('#cv').focus({ preventScroll: true });
};
/** Selects (creating when needed) the glyph for a character. */
A.selectChar = (ch) => {
  const name = lib.glyphNameFor(ch);
  if (!P.font.glyphs[name]) {
    history.run('Add letter', [name], () => ensureGlyph(name, ch.codePointAt(0)));
  }
  A.selectGlyph(name);
};
A.step = (dir) => {
  const order = ctx.order;
  if (!order.length) return;
  const i = order.indexOf(editor.name);
  const next = order[(i + dir + order.length) % order.length];
  const g = P.font.glyphs[next];
  if (!g) {
    const ch = ctx.charForName?.(next);
    if (ch) return A.selectChar(ch);
    return;
  }
  A.selectGlyph(next);
};

// ---------- Tools and view ----------

A.setTool = (t) => {
  if (t === 'pen' && !S.pro) t = 'select';
  if (editor.penDraft && t !== 'pen') editor.finishPen();
  S.tool = t;
  editor.hover = null;
  editor.cursor();
  syncSelection();
  editor.redraw();
};
A.zoom = (f) => editor.zoomCenter(f);
A.fit = () => editor.fit();
A.redraw = () => editor.redraw();
A.undo = () => {
  if (editor.penDraft) editor.finishPen();
  const label = history.undo();
  if (label) A.toast(`Undid ${label.toLowerCase()}`);
};
A.redo = () => {
  const label = history.redo();
  if (label) A.toast(`Redid ${label.toLowerCase()}`);
};

// ---------- Panels ----------

const TITLES = { templates: 'Templates', letters: 'Letters', draw: 'Brushes and shapes', uploads: 'Uploads', sheet: 'Handwriting sheet', spacing: 'Spacing and kerning', test: 'Test your font', font: 'Font settings', export: 'Download' };
A.panelTitle = (p) => TITLES[p] || '';
A.openPanel = (p) => {
  S.panel = p;
  if (ctx.onPanel) ctx.onPanel(p);
  requestAnimationFrame(() => editor.redraw());
};
A.togglePanel = (p) => (S.panel === p ? A.closePanel() : A.openPanel(p));
A.closePanel = () => {
  S.panel = null;
  S.wide = false;
  requestAnimationFrame(() => editor.redraw());
};

// ---------- Glyph properties ----------

A.setMetric = (which, v) => {
  const g = editor.glyph;
  if (!g || !Number.isFinite(v)) return;
  history.run('Spacing', editor.scope, () => {
    const ib = inkBounds(editor.contours);
    if (which === 'adv') g.advanceWidth = Math.max(0, Math.round(v));
    else if (ib && which === 'lsb') {
      const d = Math.round(v - ib.xMin);
      shiftGlyph(g, d);
      g.advanceWidth = Math.max(0, g.advanceWidth + d);
    } else if (ib && which === 'rsb') g.advanceWidth = Math.max(0, Math.round(ib.xMax + v));
  });
};
function shiftGlyph(g, d) {
  g.contours = transformContours(g.contours, matrix.translate(d, 0));
  for (const c of g.components || []) c.dx = (c.dx || 0) + d;
  for (const m of P.font.masters || []) if (m.glyphs[g.name]) m.glyphs[g.name].contours = transformContours(m.glyphs[g.name].contours, matrix.translate(d, 0));
}
ctx.shiftGlyph = shiftGlyph;
A.clearGlyph = () => {
  const g = editor.glyph;
  if (!g) return;
  history.run('Clear letter', editor.scope, () => {
    g.contours = [];
    g.components = [];
    for (const m of P.font.masters || []) delete m.glyphs[g.name];
  });
  A.toast(`Cleared ${S.glyph.label}`, 'info', 'Undo', () => A.undo());
};
A.setSelBox = (which, v) => {
  if (!editor.sel.size || !Number.isFinite(v)) return;
  const b = bbox([{ points: [...editor.sel].map((k) => editor.pointByKey(k)).filter(Boolean) }]);
  if (!b) return;
  let m;
  if (which === 'x') m = matrix.translate(v - b.xMin, 0);
  else if (which === 'y') m = matrix.translate(0, v - b.yMin);
  else if (which === 'w') m = matrix.scale(v / Math.max(1, b.xMax - b.xMin), 1, b.xMin, b.yMin);
  else m = matrix.scale(1, v / Math.max(1, b.yMax - b.yMin), b.xMin, b.yMin);
  editor.transformSelection(m, 'Transform');
};
A.rotateBy = (deg) => deg && editor.rotate(deg);
A.convert = (kind) => editor.convert(kind);
A.pathOp = (op) => editor.pathOp(op);
A.setPoint = (axis, v) => {
  if (editor.sel.size !== 1 || !Number.isFinite(v)) return;
  const p = editor.pointByKey([...editor.sel][0]);
  history.run('Move point', editor.scope, () => (p[axis] = Math.round(v)));
  syncSelection();
};
A.duplicateTo = () => {
  const d = $('#dup');
  $('#dup-input').value = '';
  $('#dup-mirror').checked = false;
  d.showModal();
  requestAnimationFrame(() => $('#dup-input').focus());
};
A.duplicateClose = () => $('#dup').close();
A.duplicateDone = (e) => {
  e.preventDefault();
  const target = [...($('#dup-input').value || '').trim()][0];
  $('#dup').close();
  if (!target) return;
  const data = editor.copy();
  if (!data) return;
  if ($('#dup-mirror').checked) {
    const b = bbox(data.contours);
    if (b) data.contours = transformContours(data.contours, matrix.scale(-1, 1, (b.xMin + b.xMax) / 2, 0));
  }
  const from = S.glyph.label;
  A.selectChar(target);
  editor.paste({ ...data, components: [] });
  A.toast(`Copied from ${from} to ${S.glyph.label}`, 'success', 'Undo', () => A.undo());
};

// Components
A.setComponent = (i, key, v) => {
  const g = editor.glyph;
  if (!g?.components?.[i] || !Number.isFinite(v)) return;
  history.run('Move component', editor.scope, () => (g.components[i][key] = Math.round(v)));
};
A.removeComponent = (i) => {
  const g = editor.glyph;
  history.run('Remove component', editor.scope, () => g.components.splice(i, 1));
};
A.addComponent = () => {
  const g = editor.glyph;
  const v = (S.compAdd || '').trim();
  if (!g || !v) return;
  const name = P.font.glyphs[v] ? v : lib.glyphNameFor(v);
  if (!P.font.glyphs[name]) return A.toast(`There is no glyph \u201c${v}\u201d yet. Draw it first.`, 'error');
  if (name === g.name) return;
  history.run('Add component', editor.scope, () => {
    g.components = [...(g.components || []), { glyph: name, dx: 0, dy: 0 }];
  });
  S.compAdd = '';
};
A.decompose = () => {
  const g = editor.glyph;
  if (!g?.components?.length) return;
  history.run('Decompose', editor.scope, () => {
    const extra = [];
    for (const c of g.components) {
      const base = P.font.glyphs[c.glyph];
      if (!base) continue;
      const s = c.scale ?? 1;
      const resolved = transformContours(ctx.resolveAll(base), [s, 0, 0, s, c.dx || 0, c.dy || 0]);
      extra.push(...resolved.map((ct) => ({ ...ct, points: ct.points.map((p) => ({ ...p, x: Math.round(p.x), y: Math.round(p.y) })) })));
    }
    g.contours = [...g.contours, ...extra];
    g.components = [];
    for (const m of P.font.masters || []) delete m.glyphs[g.name];
  });
};
A.composeCurrent = () => {
  const ch = S.glyph.char;
  if (!ch) return;
  try {
    history.run('Build accent', [editor.name], () => {
      const out = lib.compose(P.font, ch);
      if (out && out.name !== editor.name) P.font.glyphs[editor.name] = { ...out, name: editor.name };
    });
    A.toast(`Built ${ch} from its base letter and accent`, 'success');
  } catch (e) {
    A.toast(`Could not build ${ch}: ${e.message}`, 'error');
  }
};

A.autoAccents = () => {
  const accented = [...'\u00c0\u00c1\u00c2\u00c3\u00c4\u00c5\u00c7\u00c8\u00c9\u00ca\u00cb\u00cc\u00cd\u00ce\u00cf\u00d1\u00d2\u00d3\u00d4\u00d5\u00d6\u00d9\u00da\u00db\u00dc\u00dd\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5\u00e7\u00e8\u00e9\u00ea\u00eb\u00ec\u00ed\u00ee\u00ef\u00f1\u00f2\u00f3\u00f4\u00f5\u00f6\u00f9\u00fa\u00fb\u00fc\u00fd\u00ff'];
  const todo = accented.filter((ch) => {
    const g = P.font.glyphs[lib.glyphNameFor(ch)];
    return !g || status(g) === 'empty' || (g.components?.length && !g.contours.length);
  });
  const names = todo.map((ch) => lib.glyphNameFor(ch));
  let made = 0;
  const failed = [];
  history.run('Auto accents', 'font', () => {
    for (const ch of todo) {
      try {
        if (lib.compose(P.font, ch)) made++;
      } catch {
        failed.push(ch);
      }
    }
  });
  if (made) A.toast(`Built ${made} accented letters from your base letters and marks`, 'success', 'Undo', () => A.undo());
  else A.toast(failed.length ? 'Draw the base letters and the marks (\u00b4 ` ^ ~ \u00a8 \u00b8) first, then try again.' : 'All accented letters are already there.');
  void names;
};

// Meta
A.setMeta = (key, v) => {
  if (v === undefined || v === null || (typeof v === 'number' && !Number.isFinite(v))) return;
  history.run('Font info', 'meta', () => (P.font.meta[key] = typeof v === 'string' ? v.trim() : v));
  if (['ascender', 'descender', 'xHeight', 'capHeight'].includes(key)) editor.redraw();
};

// ---------- Projects ----------

const when = (t) => {
  const d = Date.now() - t;
  if (d < 60000) return 'just now';
  if (d < 3600000) return `${Math.round(d / 60000)} min ago`;
  if (d < 86400000) return `${Math.round(d / 3600000)} h ago`;
  return new Date(t).toLocaleDateString();
};
async function refreshProjects() {
  const list = await listProjects();
  S.projects = list.map((p) => ({ ...p, when: when(p.updated) }));
  S.lastProject = S.projects[0] || null;
}
ctx.refreshProjects = refreshProjects;

/** Loads a font into the editor as a project. */
ctx.openFont = (font, { id = newId(), extras = {}, select = null, keepPanel = false } = {}) => {
  loadFont(font, { id, extras });
  S.master = 0;
  syncFont();
  if (ctx.onFontLoaded) ctx.onFontLoaded();
  const first = select || ctx.order.find((n) => P.font.glyphs[n]) || Object.keys(P.font.glyphs).find((n) => n !== '.notdef' && n !== 'space');
  if (first) A.selectGlyph(first);
  if (!keepPanel && prefersSmall) S.panel = null;
};
A.openProject = async (id) => {
  const rec = await loadProject(id);
  if (!rec) return A.toast('That project could not be found', 'error');
  try {
    const { font, extras } = readProject(rec.data);
    ctx.openFont(font, { id, extras });
    A.closeStart();
    A.toast(`Opened ${font.meta.family}`);
  } catch (e) {
    A.toast(`Could not open the project: ${e.message}`, 'error');
  }
};
A.deleteProject = async (id) => {
  const p = S.projects.find((x) => x.id === id);
  if (!confirm(`Delete the project \u201c${p ? p.name : id}\u201d from this browser? This cannot be undone.`)) return;
  await deleteProject(id);
  await refreshProjects();
};
A.newBlank = () => {
  const font = lib.createFont({ family: 'My Font', designer: '' });
  ctx.openFont(font);
  A.closeStart();
  A.openPanel('letters');
  A.setTool('brush');
  A.toast('A blank font. Pick a letter and start drawing.');
};
A.openStart = async () => {
  await refreshProjects();
  const d = $('#start');
  if (!d.open) d.showModal();
  if (ctx.onStart) ctx.onStart();
};
A.closeStart = () => {
  const d = $('#start');
  if (d.open) d.close();
};
$('#start').addEventListener('close', () => maybeTour());

// ---------- Font sync ----------

function syncFont() {
  const m = P.font.meta;
  Object.assign(S.font, {
    family: m.family,
    style: m.style,
    designer: m.designer || '',
    license: m.license || '',
    version: m.version,
    ascender: m.ascender,
    descender: m.descender,
    xHeight: m.xHeight,
    capHeight: m.capHeight,
    upm: m.unitsPerEm,
  });
  const axis = P.font.axes?.find((a) => a.tag === 'wght');
  S.variable.has = !!(axis && P.font.masters?.length);
  if (axis) Object.assign(S.variable, { min: axis.min, def: axis.default, max: axis.max });
  if (!S.variable.has) S.master = 0;
  S.canUndo = history.canUndo;
  S.canRedo = history.canRedo;
  if (ctx.onFontSync) ctx.onFontSync();
}
ctx.syncFont = syncFont;

onChange(({ kind, glyphs }) => {
  if (kind === 'saved') {
    S.status.saved = 'Saved in this browser';
    refreshProjects();
    return;
  }
  if (kind !== 'load') S.status.saved = 'Saving';
  if (editor.name && !P.font.glyphs[editor.name]) {
    const first = Object.keys(P.font.glyphs).find((n) => n !== '.notdef');
    if (first) editor.setGlyph(first);
  }
  syncFont();
  syncGlyph();
  syncSelection();
  editor.redraw();
  if (ctx.onChanged) ctx.onChanged(kind, glyphs);
});

// ---------- Keyboard ----------

const typing = (e) => {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
};
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key;
  if (typing(e)) {
    if (k === 'Escape') e.target.blur();
    return;
  }
  if (document.querySelector('dialog[open]') && !mod) return;
  if (mod && (k === 'z' || k === 'Z')) {
    e.preventDefault();
    if (e.shiftKey) A.redo();
    else A.undo();
    return;
  }
  if (mod && (k === 'y' || k === 'Y')) return e.preventDefault(), A.redo();
  if (mod && k.toLowerCase() === 's') return e.preventDefault(), A.saveProjectFile();
  if (mod && k.toLowerCase() === 'e') return e.preventDefault(), A.quickDownload();
  if (mod && k.toLowerCase() === 'o') return e.preventDefault(), A.openStart();
  if (mod && k === '0') return e.preventDefault(), editor.fit();
  if (mod && (k === '=' || k === '+')) return e.preventDefault(), editor.zoomCenter(1.25);
  if (mod && k === '-') return e.preventDefault(), editor.zoomCenter(0.8);
  if (mod && k.toLowerCase() === 'a') return e.preventDefault(), editor.selectAll(), S.tool !== 'select' && A.setTool('select');
  if (mod && k.toLowerCase() === 'c') {
    const data = editor.copy();
    if (data && navigator.clipboard) navigator.clipboard.writeText(JSON.stringify({ fontsketch: 'contours', ...data })).catch(() => {});
    A.toast('Copied');
    return e.preventDefault();
  }
  if (mod && k.toLowerCase() === 'x') return e.preventDefault(), editor.cut();
  if (mod && k.toLowerCase() === 'v') {
    e.preventDefault();
    if (editor.clipboard) editor.paste();
    else if (navigator.clipboard?.readText) {
      navigator.clipboard.readText().then((t) => {
        try {
          const d = JSON.parse(t);
          if (d.fontsketch === 'contours') editor.paste(d);
        } catch {
          if (/<svg[\s>]/i.test(t) && ctx.importSvgText) ctx.importSvgText(t, 'clipboard.svg');
        }
      }).catch(() => {});
    }
    return;
  }
  if (mod && k.toLowerCase() === 'd') {
    e.preventDefault();
    const d = editor.copy();
    if (d) editor.paste({ ...d, contours: transformContours(d.contours, matrix.translate(20, -20)), components: [] });
    return;
  }
  if (e.altKey && (k === 'ArrowLeft' || k === 'ArrowRight')) return e.preventDefault(), A.step(k === 'ArrowLeft' ? -1 : 1);
  if (k === 'PageUp' || k === 'PageDown') return e.preventDefault(), A.step(k === 'PageUp' ? -1 : 1);
  if (k.startsWith('Arrow')) {
    if (!editor.sel.size && editor.selComponent < 0) return;
    e.preventDefault();
    const s = e.shiftKey ? 10 : 1;
    editor.nudge(k === 'ArrowLeft' ? -s : k === 'ArrowRight' ? s : 0, k === 'ArrowUp' ? s : k === 'ArrowDown' ? -s : 0);
    syncSelection();
    return;
  }
  if (k === 'Delete' || k === 'Backspace') return e.preventDefault(), editor.deletePoints();
  if (k === 'Enter' && editor.penDraft) return e.preventDefault(), editor.finishPen();
  if (k === 'Escape') {
    if (S.tour.on) return A.endTour();
    if (editor.penDraft) return editor.finishPen();
    if (editor.sel.size) {
      editor.sel.clear();
      syncSelection();
      return editor.redraw();
    }
    if (S.panel && prefersSmall) return A.closePanel();
    return;
  }
  if (mod || e.altKey) return;
  const tools = { v: 'select', p: 'pen', b: 'brush', e: 'eraser', r: 'rect', o: 'ellipse', h: 'hand' };
  const lower = k.toLowerCase();
  if (tools[lower]) return A.setTool(tools[lower]);
  if (k === '[' || k === ']') {
    const key = S.tool === 'eraser' ? 'eraserSize' : 'size';
    S.brush[key] = Math.max(6, Math.min(300, Math.round(S.brush[key] * (k === ']' ? 1.15 : 0.87))));
    editor.redraw();
    return;
  }
  if (lower === 'g') return (S.opts.grid = !S.opts.grid), editor.redraw();
  if (lower === 'f') return (S.opts.preview = !S.opts.preview), editor.redraw();
  if (k === '?') return A.showShortcuts();
});
A.showShortcuts = () => $('#shortcuts').showModal();

// Theme changes repaint the canvases.
const repaint = () => {
  editor.colorsStale = true;
  editor.redraw();
  if (ctx.onTheme) ctx.onTheme();
};
document.addEventListener('voodoo:theme', () => requestAnimationFrame(repaint));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', repaint);

// ---------- Preferences ----------

A.savePrefs = () => {
  syncSelection();
  editor.redraw();
  setSetting('prefs', { pro: S.pro, hint: S.hint.mode, brush: { ...S.brush }, tour: true }).catch(() => {});
  if (!S.pro && S.tool === 'pen') A.setTool('select');
};

// ---------- Tour ----------

const TOUR = [
  { sel: '[data-tour="rail"]', title: 'Everything lives in the rail', text: 'Templates, the letter grid, brushes, uploads, your handwriting sheet, spacing, a type tester and export. Open one, then close it to get the whole canvas back.' },
  { sel: '[data-tour="canvas"]', title: 'Draw right here', text: 'Write a letter with your mouse, finger or a pen. Pressure works with tablets and Apple Pencil. Pinch or Ctrl and scroll to zoom, hold Space to pan.' },
  { sel: '[data-tour="filmstrip"]', title: 'Hop between letters', text: 'The strip shows every letter as you draw it. Click one to edit it, or press Alt and the arrow keys.' },
  { sel: '[data-tour="download"]', title: 'One click to a real font', text: 'Download a TTF you can install anywhere. The arrow opens OTF, WOFF2, variable fonts and a web kit.' },
];
async function maybeTour() {
  if (S.tour.on || S.quick.on) return;
  let seen = false;
  try {
    seen = localStorage.getItem('fontsketch:tour') === '1';
  } catch {
    seen = true;
  }
  if (!seen) A.tourGo(0);
}
A.tourGo = (i) => {
  if (i >= TOUR.length) return A.endTour();
  const step = TOUR[i];
  Object.assign(S.tour, { on: true, i, title: step.title, text: step.text });
  requestAnimationFrame(() => {
    const el = document.querySelector(step.sel);
    const spot = $('#tour-spot');
    const card = $('#tour-card');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 6;
    Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const cw = card.offsetWidth || 320;
    const ch = card.offsetHeight || 180;
    let x = r.right + 16;
    let y = r.top + 10;
    if (x + cw > innerWidth - 10) x = Math.max(10, Math.min(innerWidth - cw - 10, r.left + r.width / 2 - cw / 2));
    if (x !== r.right + 16) y = r.top - ch - 16 > 10 ? r.top - ch - 16 : Math.min(innerHeight - ch - 10, r.bottom + 16);
    if (r.height > innerHeight * 0.5 && x !== r.right + 16) y = Math.max(10, r.top + 60);
    card.style.left = `${x}px`;
    card.style.top = `${Math.max(10, Math.min(innerHeight - ch - 10, y))}px`;
    card.querySelector('.btn-primary')?.focus();
  });
};
A.endTour = () => {
  S.tour.on = false;
  try {
    localStorage.setItem('fontsketch:tour', '1');
  } catch {
    // private mode
  }
  $('#cv').focus({ preventScroll: true });
};

// ---------- Panels and modules ----------

installLetters(ctx);
installDraw(ctx);
installTemplates(ctx);
installImports(ctx);
installSheet(ctx);
installSpacing(ctx);
installTest(ctx);
installFontPanel(ctx);
installExport(ctx);
installQuick(ctx);

// Resolved outlines including components (used by decompose and exports).
ctx.resolveAll = (g) => {
  const walk = (glyph, depth) => {
    let out = clone(glyph.contours || []);
    if (depth < 6) {
      for (const c of glyph.components || []) {
        const base = P.font.glyphs[c.glyph];
        if (!base) continue;
        const s = c.scale ?? 1;
        out = out.concat(transformContours(walk(base, depth + 1), [s, 0, 0, s, c.dx || 0, c.dy || 0]));
      }
    }
    return out;
  };
  return walk(g, 0);
};

// ---------- Boot ----------

async function boot() {
  const prefs = await getSetting('prefs').catch(() => null);
  if (prefs) {
    S.pro = !!prefs.pro;
    if (prefs.hint) S.hint.mode = prefs.hint;
    if (prefs.brush) Object.assign(S.brush, prefs.brush);
  }
  await refreshProjects();
  const hash = new URLSearchParams(location.hash.slice(1));
  let opened = false;
  if (hash.has('handoff')) {
    const key = hash.get('handoff') || 'latest';
    try {
      const value = await takeHandoff(key);
      if (value) {
        const font = lib.deserialize(value);
        ctx.openFont(font, { select: hash.get('glyph') || null });
        P.dirty = true;
        A.toast('Your letter from the home page is ready to keep drawing', 'success');
        opened = true;
      } else A.toast('The drawing from the home page was already opened or has expired.');
    } catch (e) {
      A.toast(`Could not open the drawing: ${e.message}`, 'error');
    }
    window.history.replaceState(null, '', location.pathname);
  }
  if (!opened && hash.has('template')) {
    opened = await ctx.loadTemplateFont(hash.get('template'), { quiet: true });
    window.history.replaceState(null, '', location.pathname);
  }
  if (!opened && S.lastProject) {
    const rec = await loadProject(S.lastProject.id);
    if (rec) {
      try {
        const { font, extras } = readProject(rec.data);
        ctx.openFont(font, { id: rec.id, extras });
        opened = true;
        S.status.saved = 'Saved in this browser';
      } catch (e) {
        console.warn('could not reopen the last project', e);
      }
    }
  }
  if (!opened) opened = await ctx.loadTemplateFont('quill-hand', { quiet: true, fresh: true });
  if (!opened) ctx.openFont(lib.createFont({ family: 'My Font' }));
  S.ready = true;
  if (hash.has('quick')) {
    // app/#quick=script (or block, pixel) goes straight to quick mode.
    window.history.replaceState(null, '', location.pathname);
    await A.startQuick(hash.get('quick') || 'script');
  } else if (!hash.has('handoff') && !hash.has('editor')) A.openStart();
  else maybeTour();
}

V.start();
boot().catch((e) => {
  console.error(e);
  A.toast(`The editor could not start: ${e.message}`, 'error');
});
