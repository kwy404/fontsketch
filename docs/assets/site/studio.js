// The drawing studio on the home page. It opens with Quill Hand, a complete
// handwritten font, already writing the sample sentence. Visitors can edit
// any glyph on the stage (draw strokes, drag spine points, erase strokes) and
// every copy of it in the sentence updates, or start a new font and draw
// their own letters, which replace the default font one by one. The live
// font is compiled in the browser with the fontsketch core engine.
import { expandStroke, strokesToContours, contoursToSvgPath } from './stroke.mjs';

const root = document.getElementById('studio-app');
if (root) start(root);

function start(el) {
  const $ = (s) => el.querySelector(s);
  const $$ = (s) => [...el.querySelectorAll(s)];
  const R = document.body.dataset.root || '';
  const svg = $('#stage-svg');
  const gGuides = svg.querySelector('.guides');
  const gInk = svg.querySelector('.ink');
  const gLive = svg.querySelector('.live');
  const gHandles = svg.querySelector('.handles');
  const stage = $('.stage');
  const specimen = $('[data-specimen]');
  const sampleInput = $('[data-sample]');
  const status = $('[data-status]');
  const progress = $('[data-progress]');
  const hint = $('#stage-hint');
  const charLabel = $('.stage-char');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pt = el.dataset.lang === 'pt';
  const KEY = 'fontsketch:studio:v1';
  const STRIP = $$('.strip .g').map((b) => b.dataset.ch);

  /** @type {any} */
  let data = null;
  /** @type {any} */
  let core = null;
  const S = { mode: 'edit', tool: 'pen', pen: 66, sel: 'a', edits: {}, drawn: {}, sample: sampleInput.value, gen: 0 };
  const undo = [];
  let autoplay = null;
  let faceName = '';

  const txt = {
    loading: pt ? 'Carregando o motor de fontes' : 'Loading the font engine',
    building: pt ? 'Compilando a fonte' : 'Compiling the font',
    ready: (n) => (pt ? `Fonte padrão, ${n} glifos, pronta` : `Default font, ${n} glyphs, ready`),
    live: (n) => (pt ? `Sua versão compilada, ${n} glifos` : `Your edit compiled, ${n} glyphs`),
    newp: (d, t) => (pt ? `${d} de ${t} letras desenhadas` : `${d} of ${t} letters drawn`),
    composite: (b) => (pt ? `Letra acentuada: editando a base ${b}` : `Accented letter: editing its base ${b}`),
    noCore: pt ? 'O motor de fontes não carregou, o desenho continua funcionando' : 'The font engine did not load, drawing still works',
    saved: pt ? 'Abrindo o editor' : 'Opening the editor',
    myFont: pt ? 'Minha Letra' : 'My Hand',
  };

  // ---------- names ----------
  const NAMES = { ' ': 'space', '.': 'period', ',': 'comma', '!': 'exclam', '?': 'question', '&': 'ampersand', 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine' };
  let byCode = new Map();
  const nameOf = (ch) => byCode.get(ch.codePointAt(0)) || NAMES[ch] || ch;

  // ---------- data access ----------
  const baseGlyph = (n) => data.glyphs[n];
  function glyph(n) {
    if (S.mode === 'new') return S.drawn[n] || null;
    return S.edits[n] || baseGlyph(n) || null;
  }
  const strokesOf = (g) => (g ? g.s.map((st) => (Array.isArray(st) ? { pts: st } : { pts: st.p, w: st.w })) : []);
  const pen = () => ({ width: S.pen, swell: S.pen * 0.3, taper: 0.2 });
  const advanceOf = (n) => (baseGlyph(n) ? baseGlyph(n).adv : 500);
  const offsetX = (n) => Math.round((900 - advanceOf(n)) / 2);

  // ---------- stage ----------
  function guides() {
    const lines = [[770, pt ? 'ascendente' : 'ascender', 'a'], [700, pt ? 'maiúsculas' : 'cap height', 'c'], [480, pt ? 'altura x' : 'x-height', 'x'], [0, pt ? 'linha de base' : 'baseline', 'b'], [-240, pt ? 'descendente' : 'descender', 'd']];
    const adv = advanceOf(nameOf(S.sel));
    const ox = offsetX(nameOf(S.sel));
    let h = '';
    for (const [y, label, k] of lines) {
      const base = k === 'b';
      h += `<line x1="-200" x2="1100" y1="${-y}" y2="${-y}" stroke="${base ? 'var(--ver-bright)' : 'var(--rule)'}" stroke-width="${base ? 2 : 1.4}" ${base ? '' : 'stroke-dasharray="6 6"'}/>`;
      h += `<text x="1080" y="${-y - 10}" text-anchor="end" font-size="26" font-family="system-ui, sans-serif" fill="var(--muted)" opacity=".8">${label}</text>`;
    }
    h += `<path d="M${ox} 280V-960M${ox + adv} 280V-960" stroke="var(--ver-bright)" stroke-width="1.2" stroke-dasharray="3 8" opacity=".55"/>`;
    gGuides.innerHTML = h;
  }

  /** Spine path in stage coordinates. */
  const spineD = (pts, ox) => pts.map((p, i) => `${i ? 'L' : 'M'}${(p[0] + ox).toFixed(1)} ${(-p[1]).toFixed(1)}`).join('');

  function renderStage({ animate = false } = {}) {
    const n = nameOf(S.sel);
    const ox = offsetX(n);
    charLabel.textContent = S.sel;
    svg.setAttribute('aria-label', `${pt ? 'Área de desenho' : 'Drawing stage'}: ${S.sel}`);
    guides();
    let h = '';
    if (S.mode === 'new' && baseGlyph(n)) {
      const ghost = strokesToContours(strokesOf(baseGlyph(n)), pen());
      h += `<path class="ghost" transform="translate(${ox} 0)" d="${contoursToSvgPath(ghost)}"/>`;
    }
    const g = glyph(n);
    const strokes = strokesOf(g);
    let delay = 0;
    strokes.forEach((st, i) => {
      const poly = expandStroke(st, pen());
      const d = polyD(poly, ox);
      if (animate && !reduce) {
        const id = `m${S.gen}-${i}`;
        const len = Math.max(0.35, Math.min(0.9, st.pts.length * 0.06));
        h += `<mask id="${id}" maskUnits="userSpaceOnUse" x="-300" y="-1100" width="1500" height="1500"><path class="reveal" d="${spineD(st.pts, ox)}" pathLength="1" stroke-dasharray="1 1" stroke="#fff" stroke-width="${S.pen * 2.6}" fill="none" stroke-linecap="round" stroke-linejoin="round" style="--delay:${delay.toFixed(2)}s;--dur:${len.toFixed(2)}s"/></mask>`;
        h += `<path class="glyph wet" data-i="${i}" d="${d}" mask="url(#${id})"/>`;
        delay += len * 0.85;
      } else h += `<path class="glyph" data-i="${i}" d="${d}"/>`;
    });
    if (animate && !reduce && strokes.length) {
      h += `<clipPath id="clip${S.gen}">${strokes.map((st) => `<path d="${polyD(expandStroke(st, pen()), ox)}"/>`).join('')}</clipPath><g clip-path="url(#clip${S.gen})"><rect class="sheen" style="--delay:${(delay + 0.1).toFixed(2)}s" x="0" y="-1100" width="160" height="1500" fill="#fff" opacity=".35" transform="skewX(-18)"/></g>`;
      setTimeout(() => gInk.querySelectorAll('.wet').forEach((p) => p.classList.remove('wet')), (delay + 0.4) * 1000);
    }
    gInk.innerHTML = h;
    S.gen++;
    renderHandles();
    $$('.strip .g').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ch === S.sel)));
    return delay;
  }

  function polyD(poly, ox) {
    // smooth closed path through the polygon (quadratic midpoints)
    const n = poly.length;
    const P = (p) => `${(p[0] + ox).toFixed(1)} ${(-p[1]).toFixed(1)}`;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let d = `M${P(mid(poly[n - 1], poly[0]))}`;
    for (let i = 0; i < n; i++) d += `Q${P(poly[i])} ${P(mid(poly[i], poly[(i + 1) % n]))}`;
    return `${d}Z`;
  }

  function renderHandles() {
    if (S.tool !== 'points') {
      gHandles.innerHTML = '';
      return;
    }
    const n = nameOf(S.sel);
    const ox = offsetX(n);
    const strokes = strokesOf(glyph(n));
    let h = '';
    strokes.forEach((st, i) => {
      h += `<path d="${spineD(st.pts, ox)}"/>`;
      st.pts.forEach((p, j) => {
        h += `<circle data-s="${i}" data-p="${j}" cx="${(p[0] + ox).toFixed(1)}" cy="${(-p[1]).toFixed(1)}" r="16"/>`;
      });
    });
    gHandles.innerHTML = h;
  }

  // ---------- editing ----------
  function editable(n) {
    if (S.mode === 'new') {
      if (!S.drawn[n]) S.drawn[n] = { u: baseGlyph(n)?.u || [], adv: advanceOf(n), s: [] };
      return S.drawn[n];
    }
    if (!S.edits[n]) {
      const b = baseGlyph(n);
      S.edits[n] = { u: b ? b.u : [], adv: advanceOf(n), s: b ? JSON.parse(JSON.stringify(b.s)) : [] };
    }
    return S.edits[n];
  }
  function snapshot(n) {
    const src = S.mode === 'new' ? S.drawn : S.edits;
    undo.push({ mode: S.mode, n, prev: src[n] ? JSON.stringify(src[n]) : null });
    if (undo.length > 60) undo.shift();
  }
  function changed() {
    renderStage();
    updateStrip();
    scheduleBuild();
    save();
  }

  function toPoint(e) {
    const m = svg.getScreenCTM().inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return [p.x - offsetX(nameOf(S.sel)), -p.y];
  }

  let drawing = null;
  let dragging = null;
  stage.addEventListener('pointerdown', (e) => {
    stopAutoplay();
    if (e.button !== 0) return;
    const n = nameOf(S.sel);
    if (S.tool === 'pen') {
      if (!baseGlyph(n) && S.mode === 'edit') return;
      stage.setPointerCapture(e.pointerId);
      drawing = { pts: [toPoint(e)] };
      gLive.innerHTML = `<path stroke-width="${S.pen}" d=""/>`;
      e.preventDefault();
    } else if (S.tool === 'points') {
      const c = e.target.closest('circle');
      if (!c) return;
      stage.setPointerCapture(e.pointerId);
      snapshot(n);
      dragging = { s: Number(c.dataset.s), p: Number(c.dataset.p), el: c };
      c.classList.add('is-drag');
      e.preventDefault();
    } else if (S.tool === 'erase') {
      const p = e.target.closest('path.glyph');
      if (!p) return;
      snapshot(n);
      editable(n).s.splice(Number(p.dataset.i), 1);
      changed();
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (drawing) {
      const p = toPoint(e);
      const last = drawing.pts[drawing.pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 9) return;
      drawing.pts.push(p);
      gLive.firstChild.setAttribute('d', spineD(drawing.pts, offsetX(nameOf(S.sel))));
    } else if (dragging) {
      const n = nameOf(S.sel);
      const p = toPoint(e);
      const g = editable(n);
      const st = g.s[dragging.s];
      const pts = Array.isArray(st) ? st : st.p;
      pts[dragging.p] = [Math.round(p[0]), Math.round(p[1])];
      const ox = offsetX(n);
      const path = gInk.querySelector(`path.glyph[data-i="${dragging.s}"]`);
      if (path) path.setAttribute('d', polyD(expandStroke({ pts, w: Array.isArray(st) ? 1 : st.w }, pen()), ox));
      dragging.el.setAttribute('cx', (p[0] + ox).toFixed(1));
      dragging.el.setAttribute('cy', (-p[1]).toFixed(1));
      scheduleBuild();
    }
  });
  const endPointer = () => {
    if (drawing) {
      const n = nameOf(S.sel);
      let pts = drawing.pts;
      drawing = null;
      gLive.innerHTML = '';
      if (pts.length === 1) pts = [pts[0], [pts[0][0] + 3, pts[0][1] + 6]];
      pts = simplify(smooth(pts), 5).map(([x, y]) => [Math.round(x), Math.round(y)]);
      snapshot(n);
      const g = editable(n);
      g.s.push(pts.length === 2 && Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) < 12 ? { p: pts, w: 1.3 } : pts);
      changed();
      const last = gInk.querySelector(`path.glyph[data-i="${g.s.length - 1}"]`);
      if (last && !reduce) {
        last.classList.add('wet');
        requestAnimationFrame(() => setTimeout(() => last.classList.remove('wet'), 60));
      }
    }
    if (dragging) {
      dragging.el.classList.remove('is-drag');
      dragging = null;
      changed();
    }
  };
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  function smooth(pts) {
    if (pts.length < 4) return pts;
    return pts.map((p, i) => {
      if (i === 0 || i === pts.length - 1) return p;
      const a = pts[i - 1], b = pts[i + 1];
      return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4];
    });
  }
  function simplify(pts, tol) {
    if (pts.length < 3) return pts;
    const keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      let best = 0, idx = -1;
      const [x1, y1] = pts[a], [x2, y2] = pts[b];
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      for (let i = a + 1; i < b; i++) {
        const d = Math.abs((x2 - x1) * (y1 - pts[i][1]) - (x1 - pts[i][0]) * (y2 - y1)) / len;
        if (d > best) {
          best = d;
          idx = i;
        }
      }
      if (best > tol) {
        keep[idx] = 1;
        stack.push([a, idx], [idx, b]);
      }
    }
    return pts.filter((_, i) => keep[i]);
  }

  // ---------- selection, strip and specimen ----------
  function select(ch, { animate = false } = {}) {
    let n = nameOf(ch);
    const comp = data.composites[n];
    if (comp) {
      const base = comp.comps[0][0];
      const baseCh = String.fromCodePoint((data.glyphs[base]?.u || [0x61])[0]);
      status.textContent = txt.composite(baseCh);
      ch = baseCh;
      n = base;
    }
    if (!baseGlyph(n) && !S.drawn[n]) return;
    S.sel = ch;
    $$('.specimen .c').forEach((s) => s.classList.toggle('is-sel', s.dataset.ch === ch));
    renderStage({ animate });
    const btn = el.querySelector(`.strip .g[data-ch="${CSS.escape(ch)}"]`);
    if (btn) btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function covered(ch) {
    if (ch === ' ' || S.mode === 'edit') return true;
    const n = nameOf(ch);
    if (S.drawn[n]?.s.length) return true;
    const comp = data.composites[n];
    return Boolean(comp && S.drawn[comp.comps[0][0]]?.s.length);
  }

  function renderSpecimen() {
    const frag = document.createDocumentFragment();
    for (const ch of S.sample) {
      if (ch === ' ') {
        frag.append(' ');
        continue;
      }
      const s = document.createElement('span');
      s.className = `c${covered(ch) ? '' : ' fallback'}${ch === S.sel ? ' is-sel' : ''}`;
      s.dataset.ch = ch;
      s.textContent = ch;
      frag.append(s);
    }
    specimen.replaceChildren(frag);
  }
  specimen.addEventListener('click', (e) => {
    const s = e.target.closest('.c');
    if (!s) return;
    stopAutoplay();
    select(s.dataset.ch);
    stage.focus({ preventScroll: true });
  });
  sampleInput.addEventListener('input', () => {
    S.sample = sampleInput.value || ' ';
    renderSpecimen();
    save();
  });

  function updateStrip() {
    let drawnCount = 0;
    $$('.strip .g').forEach((b) => {
      const n = nameOf(b.dataset.ch);
      const isDrawn = S.mode === 'new' ? Boolean(S.drawn[n]?.s.length) : Boolean(S.edits[n]);
      if (S.mode === 'new' && isDrawn) drawnCount++;
      b.classList.toggle('is-drawn', isDrawn);
      b.classList.toggle('is-missing', S.mode === 'new' && !isDrawn);
    });
    progress.textContent = S.mode === 'new' ? `(${drawnCount}/${STRIP.length})` : '';
    renderSpecimen();
  }
  $('.strip').addEventListener('click', (e) => {
    const b = e.target.closest('.g');
    if (!b) return;
    stopAutoplay();
    select(b.dataset.ch, { animate: S.mode === 'edit' });
  });

  // ---------- tools ----------
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tool]');
    if (t) {
      S.tool = t.dataset.tool;
      el.dataset.tool = S.tool;
      $$('[data-tool]').forEach((b) => {
        b.classList.toggle('is-on', b === t);
        b.setAttribute('aria-pressed', String(b === t));
      });
      renderHandles();
      return;
    }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    stopAutoplay();
    const act = a.dataset.act;
    if (act === 'undo') doUndo();
    if (act === 'clear') {
      const n = nameOf(S.sel);
      snapshot(n);
      editable(n).s = [];
      changed();
    }
    if (act === 'next') nextLetter();
    if (act === 'new') toggleMode();
    if (act === 'editor') openEditor();
  });
  $('[data-weight]').addEventListener('input', (e) => {
    S.pen = Number(e.target.value);
    renderStage();
    scheduleBuild();
    save();
  });
  el.addEventListener('click', (e) => {
    const d = e.target.closest('[data-dl]');
    if (!d) return;
    download(d.dataset.dl);
    d.closest('details')?.removeAttribute('open');
  });
  stage.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      doUndo();
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') {
      e.preventDefault();
      stopAutoplay();
      select(e.key);
    }
  });

  function doUndo() {
    const u = undo.pop();
    if (!u) return;
    const src = u.mode === 'new' ? S.drawn : S.edits;
    if (u.prev) src[u.n] = JSON.parse(u.prev);
    else delete src[u.n];
    changed();
  }

  function nextLetter() {
    const i = STRIP.indexOf(S.sel);
    for (let k = 1; k <= STRIP.length; k++) {
      const ch = STRIP[(i + k) % STRIP.length];
      if (!S.drawn[nameOf(ch)]?.s.length) {
        select(ch);
        return;
      }
    }
  }

  function toggleMode() {
    const btn = $('[data-act="new"]');
    S.mode = S.mode === 'edit' ? 'new' : 'edit';
    el.dataset.mode = S.mode;
    btn.querySelector('span').textContent = S.mode === 'new' ? btn.dataset.labelBack : btn.dataset.labelNew;
    hint.textContent = S.mode === 'new' ? hint.dataset.new : hint.dataset.edit;
    $('[data-font-name]').textContent = S.mode === 'new' ? txt.myFont : 'Quill Hand';
    if (S.mode === 'new') {
      S.sample = sampleInput.dataset.new;
      sampleInput.value = S.sample;
      select(STRIP.find((c) => !S.drawn[nameOf(c)]?.s.length) || 'a');
    } else {
      S.sample = sampleInput.dataset.default;
      sampleInput.value = S.sample;
      select('a');
    }
    updateStrip();
    scheduleBuild();
    save();
  }

  // ---------- compiling the live font ----------
  function buildFont({ clean = false } = {}) {
    const names = new Set([...Object.keys(data.glyphs)]);
    const font = core.createFont({ ...data.meta, family: S.mode === 'new' ? txt.myFont : 'Quill Hand', style: 'Regular' });
    const present = new Set(['space']);
    for (const n of names) {
      if (n === 'space' || n === '.notdef') continue;
      const isMark = data.glyphs[n].adv === 0 && data.glyphs[n].s.length > 0;
      const g = isMark ? baseGlyph(n) : glyph(n);
      if (!g || (!g.s.length && n !== 'uni00A0')) continue;
      let strokes = strokesOf(g);
      let adv = g.adv;
      if (S.mode === 'new' && !isMark && strokes.length) {
        let x0 = Infinity, x1 = -Infinity;
        for (const st of strokes) for (const [x] of st.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
        const dx = 40 + S.pen / 2 - x0;
        strokes = strokes.map((st) => ({ ...st, pts: st.pts.map(([x, y]) => [x + dx, y]) }));
        adv = Math.round(x1 - x0 + 80 + S.pen);
      }
      core.addGlyph(font, { name: n, unicodes: g.u || data.glyphs[n].u, advanceWidth: adv, contours: clean ? core.removeOverlaps(strokesToContours(strokes, pen())) : strokesToContours(strokes, pen()) });
      present.add(n);
    }
    for (const [n, c] of Object.entries(data.composites)) {
      if (!c.comps.every(([b]) => present.has(b))) continue;
      core.addGlyph(font, { name: n, unicodes: c.u, advanceWidth: font.glyphs[c.comps[0][0]].advanceWidth, contours: [], components: c.comps.map(([glyph, dx, dy]) => ({ glyph, dx, dy })) });
    }
    if (S.mode === 'edit') {
      for (const [k, v] of Object.entries(data.kerning)) {
        const [a, b] = k.split('|');
        if (present.has(a) && present.has(b)) font.kerning.pairs[k] = v;
      }
    }
    return font;
  }

  let buildTimer = 0;
  function scheduleBuild() {
    clearTimeout(buildTimer);
    buildTimer = setTimeout(compile, 140);
  }
  async function compile() {
    if (!core) return;
    const pristine = S.mode === 'edit' && !Object.keys(S.edits).length && S.pen === 66;
    if (pristine) {
      setFace('');
      status.textContent = txt.ready(Object.keys(data.glyphs).length + Object.keys(data.composites).length + 1);
      return;
    }
    try {
      const font = buildFont();
      const bytes = await core.exportFont(font, { format: 'ttf', hinting: 'none' });
      const name = `FS Live ${Date.now()}`;
      const face = new FontFace(name, bytes);
      await face.load();
      document.fonts.add(face);
      setFace(name, face);
      const count = Object.keys(font.glyphs).length;
      status.textContent = S.mode === 'new' ? txt.newp(STRIP.filter((c) => S.drawn[nameOf(c)]?.s.length).length, STRIP.length) : txt.live(count);
    } catch (err) {
      status.textContent = String(err && err.message ? err.message : err);
    }
  }
  let currentFace = null;
  function setFace(name, face) {
    if (currentFace) document.fonts.delete(currentFace);
    currentFace = face || null;
    faceName = name;
    el.style.setProperty('--live-font', name ? `'${name}', 'Quill Hand', cursive` : `'Quill Hand', cursive`);
  }

  // ---------- downloads and the editor hand-off ----------
  function fileBase() {
    return S.mode === 'new' ? 'my-hand' : 'quill-hand';
  }
  async function download(kind) {
    if (!core) return;
    let blob;
    const font = buildFont({ clean: true });
    try {
      if (kind === 'json') blob = new Blob([core.serialize(font)], { type: 'application/json' });
      else {
        const bytes = await core.exportFontAsync(font, { format: kind, hinting: 'auto' });
        blob = new Blob([bytes], { type: `font/${kind}` });
      }
    } catch (err) {
      status.textContent = String(err && err.message ? err.message : err);
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileBase()}.${kind === 'json' ? 'fontsketch.json' : kind}`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function openEditor() {
    const target = `${R}app/`;
    if (!core) {
      location.href = target;
      return;
    }
    status.textContent = txt.saved;
    try {
      const json = core.serialize(buildFont({ clean: true }));
      await new Promise((resolve, reject) => {
        const req = indexedDB.open('fontsketch-handoff', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('handoff');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction('handoff', 'readwrite');
          tx.objectStore('handoff').put(json, 'latest');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
      location.href = `${target}#handoff=latest`;
    } catch {
      location.href = target;
    }
  }

  // ---------- persistence ----------
  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ mode: S.mode, pen: S.pen, edits: S.edits, drawn: S.drawn, sample: S.sample }));
      } catch {
        /* storage full or blocked */
      }
    }, 400);
  }
  function restore() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!v) return false;
      S.pen = v.pen || 66;
      S.edits = v.edits || {};
      S.drawn = v.drawn || {};
      $('[data-weight]').value = String(S.pen);
      if (v.mode === 'new') toggleMode();
      if (v.sample) {
        S.sample = v.sample;
        sampleInput.value = v.sample;
      }
      return Object.keys(S.edits).length + Object.keys(S.drawn).length > 0 || v.mode === 'new';
    } catch {
      return false;
    }
  }

  // ---------- autoplay: Quill writes the sentence ----------
  function stopAutoplay() {
    if (!autoplay) return;
    clearTimeout(autoplay);
    autoplay = null;
    $$('.specimen .c').forEach((s) => s.classList.remove('is-writing'));
  }
  function startAutoplay() {
    const word = [...(pt ? 'Ação' : 'Quill')].filter((c) => baseGlyph(nameOf(c)) || data.composites[nameOf(c)]);
    let i = 0;
    const step = () => {
      const ch = word[i % word.length];
      $$('.specimen .c').forEach((s) => s.classList.toggle('is-writing', s.dataset.ch === ch));
      const n = nameOf(ch);
      const comp = data.composites[n];
      const baseCh = comp ? String.fromCodePoint(data.glyphs[comp.comps[0][0]].u[0]) : ch;
      S.sel = baseCh;
      const d = renderStage({ animate: true });
      i++;
      if (i >= word.length * 2) {
        autoplay = setTimeout(() => {
          stopAutoplay();
          select('a');
        }, (d + 1) * 1000);
        return;
      }
      autoplay = setTimeout(step, (d + 1.1) * 1000);
    };
    autoplay = setTimeout(step, 300);
  }

  // ---------- boot ----------
  fetch(`${R}assets/fonts/quill-hand.strokes.json`)
    .then((r) => r.json())
    .then((json) => {
      data = json;
      byCode = new Map();
      for (const [n, g] of Object.entries(data.glyphs)) for (const u of g.u) byCode.set(u, n);
      for (const [n, g] of Object.entries(data.composites)) for (const u of g.u) byCode.set(u, n);
      const resumed = restore();
      updateStrip();
      if (!resumed && !reduce && 'IntersectionObserver' in window) startAutoplay();
      else renderStage();
      status.textContent = txt.loading;
      return import('./core.js');
    })
    .then((mod) => {
      core = mod;
      compile();
    })
    .catch(() => {
      if (!data) return;
      status.textContent = txt.noCore;
    });
  void faceName;
}
