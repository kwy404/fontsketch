// The letter grid (Letters panel) and the filmstrip under the canvas: the
// glyphs of the chosen character set with live thumbnails, status, search,
// keyboard navigation and drop targets for SVG and image files.
import { charsFor } from './charsets.mjs';
import { status } from './geom.mjs';
import { P, history } from './project.mjs';
import { css, drawThumb } from './render.mjs';

export function installLetters(ctx) {
  const { S, A, lib, editor } = ctx;
  const grid = document.getElementById('letters');
  const film = document.getElementById('film');
  /** name -> character */
  let charOfName = new Map();
  const lastStatus = new Map();

  ctx.charForName = (name) => charOfName.get(name);

  function computeOrder() {
    const set = S.letters.charset;
    const names = [];
    charOfName = new Map();
    if (set === 'all') {
      const gs = Object.values(P.font.glyphs).filter((g) => g.name !== '.notdef' && g.name !== 'space' && g.name !== '.null');
      gs.sort((a, b) => (a.unicodes[0] ?? 1e9) - (b.unicodes[0] ?? 1e9) || a.name.localeCompare(b.name));
      for (const g of gs) {
        names.push(g.name);
        if (g.unicodes.length) charOfName.set(g.name, String.fromCodePoint(g.unicodes[0]));
      }
    } else {
      for (const ch of charsFor(set, P.extras.custom || '')) {
        if (ch === ' ') continue;
        const name = lib.glyphNameFor(ch);
        names.push(name);
        charOfName.set(name, ch);
      }
      // Glyphs without a code point (alternates, marks by name) at the end.
      for (const g of Object.values(P.font.glyphs)) {
        if (!g.unicodes.length && g.name !== '.notdef' && g.name !== '.null' && !names.includes(g.name) && (g.contours.length || g.components?.length)) names.push(g.name);
      }
    }
    ctx.order = names;
    let drawn = 0;
    for (const n of names) if (status(P.font.glyphs[n]) !== 'empty') drawn++;
    S.font.total = names.length;
    S.font.drawn = drawn;
  }

  function colors() {
    return { ink: css('--ink') || '#222', ghost: css('--line-2') || '#ccc' };
  }

  function paint(cv, name, w, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = P.font.glyphs[name];
    if (!g || status(g) === 'empty') {
      c.clearRect(0, 0, w, h);
      const ch = charOfName.get(name);
      if (ch) {
        c.fillStyle = colors().ghost;
        c.font = `${Math.round(h * 0.55)}px Georgia, serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(ch, w / 2, h * 0.55);
      }
      return;
    }
    drawThumb(c, P.font, g, w, h, colors().ink);
  }

  const label = (name) => {
    const ch = charOfName.get(name);
    return ch && ch.trim() ? ch : name;
  };

  // ---------- Grid ----------

  function renderGrid() {
    if (S.panel !== 'letters') return;
    const q = S.letters.q.trim().toLowerCase();
    const st = S.letters.status;
    const frag = document.createDocumentFragment();
    for (const name of ctx.order) {
      const g = P.font.glyphs[name];
      const s = status(g);
      if (st !== 'all' && s !== st) continue;
      const ch = charOfName.get(name) || '';
      if (q && !(ch === S.letters.q.trim() || name.toLowerCase().includes(q))) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `lt st-${s}`;
      b.dataset.name = name;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', name === editor.name ? 'true' : 'false');
      b.setAttribute('aria-label', `${ch.trim() ? ch : name}, ${s}`);
      b.tabIndex = name === editor.name ? 0 : -1;
      const cv = document.createElement('canvas');
      const sp = document.createElement('span');
      sp.textContent = name.length > 8 ? name.slice(0, 8) : name;
      b.append(cv, sp);
      frag.append(b);
    }
    grid.replaceChildren(frag);
    requestAnimationFrame(() => {
      for (const b of grid.children) {
        const cv = b.firstChild;
        paint(cv, b.dataset.name, cv.clientWidth || 56, cv.clientHeight || 58);
      }
    });
  }
  A.renderLetters = () => renderGrid();

  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.lt');
    if (!b) return;
    const ch = charOfName.get(b.dataset.name);
    if (P.font.glyphs[b.dataset.name]) A.selectGlyph(b.dataset.name);
    else if (ch) A.selectChar(ch);
    if (matchMedia('(max-width: 899px)').matches || S.wide) A.closePanel();
  });
  grid.addEventListener('keydown', (e) => listKeys(e, grid, '.lt'));

  function listKeys(e, root, sel) {
    const items = [...root.querySelectorAll(sel)];
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    const cols = Math.max(1, Math.round(root.clientWidth / (items[0].offsetWidth + 6)));
    const horizontal = root === film;
    let j = i;
    if (e.key === 'ArrowRight') j = i + 1;
    else if (e.key === 'ArrowLeft') j = i - 1;
    else if (e.key === 'ArrowDown' && !horizontal) j = i + cols;
    else if (e.key === 'ArrowUp' && !horizontal) j = i - cols;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = items.length - 1;
    else return;
    e.preventDefault();
    e.stopPropagation();
    j = Math.max(0, Math.min(items.length - 1, j));
    items[i].tabIndex = -1;
    items[j].tabIndex = 0;
    items[j].focus();
  }

  // ---------- Filmstrip ----------

  function renderFilm() {
    const frag = document.createDocumentFragment();
    for (const name of ctx.order) {
      const g = P.font.glyphs[name];
      const s = status(g);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `fi st-${s}`;
      b.dataset.name = name;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', name === editor.name ? 'true' : 'false');
      b.setAttribute('aria-label', `${label(name)}, ${s}`);
      b.tabIndex = name === editor.name ? 0 : -1;
      const cv = document.createElement('canvas');
      const sp = document.createElement('span');
      sp.textContent = label(name).slice(0, 5);
      b.append(cv, sp);
      frag.append(b);
      lastStatus.set(name, s);
    }
    film.replaceChildren(frag);
    requestAnimationFrame(() => {
      for (const b of film.children) paint(b.firstChild, b.dataset.name, b.firstChild.clientWidth || 44, b.firstChild.clientHeight || 46);
      scrollFilm();
    });
  }
  film.addEventListener('click', (e) => {
    const b = e.target.closest('.fi');
    if (!b) return;
    const ch = charOfName.get(b.dataset.name);
    if (P.font.glyphs[b.dataset.name]) A.selectGlyph(b.dataset.name);
    else if (ch) A.selectChar(ch);
  });
  film.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') return;
    listKeys(e, film, '.fi');
  });
  film.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      film.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });

  function scrollFilm() {
    const cur = film.querySelector('[aria-selected="true"]');
    if (cur) {
      const r = cur.offsetLeft - film.clientWidth / 2 + cur.offsetWidth / 2;
      film.scrollTo({ left: r, behavior: 'smooth' });
    }
  }

  function updateGlyphs(names) {
    let drawn = 0;
    for (const n of ctx.order) if (status(P.font.glyphs[n]) !== 'empty') drawn++;
    S.font.drawn = drawn;
    for (const name of names) {
      const s = status(P.font.glyphs[name]);
      for (const root of [film, grid]) {
        const b = root.querySelector(`[data-name="${CSS.escape(name)}"]`);
        if (!b) continue;
        const base = root === film ? 'fi' : 'lt';
        b.className = `${base} st-${s}`;
        const cv = b.firstChild;
        paint(cv, name, cv.clientWidth || 44, cv.clientHeight || 46);
        if (root === film && lastStatus.get(name) === 'empty' && s !== 'empty') {
          void b.offsetWidth;
          b.classList.add('pop');
        }
      }
      lastStatus.set(name, s);
    }
  }

  function markSelected(name) {
    for (const root of [film, grid]) {
      for (const b of root.querySelectorAll('[aria-selected="true"]')) {
        b.setAttribute('aria-selected', 'false');
        b.tabIndex = -1;
      }
      const b = root.querySelector(`[data-name="${CSS.escape(name)}"]`);
      if (b) {
        b.setAttribute('aria-selected', 'true');
        b.tabIndex = 0;
      }
    }
    scrollFilm();
  }

  function rebuild() {
    computeOrder();
    renderFilm();
    renderGrid();
  }

  // ---------- Charset ----------

  A.setCharset = () => {
    P.extras.charset = S.letters.charset;
    rebuild();
  };
  A.addChars = () => {
    const chars = [...(S.letters.add || '')].filter((c) => c.trim());
    if (!chars.length) return;
    const names = chars.map((c) => lib.glyphNameFor(c));
    history.run('Add letters', names, () => {
      chars.forEach((c, i) => {
        if (!P.font.glyphs[names[i]]) lib.addGlyph(P.font, { name: names[i], unicodes: [c.codePointAt(0)], advanceWidth: Math.round(P.font.meta.capHeight * 0.8), contours: [] });
      });
    });
    P.extras.custom = [...new Set([...(P.extras.custom || ''), ...chars])].join('');
    S.letters.add = '';
    rebuild();
    A.selectChar(chars[0]);
    A.toast(`Added ${chars.join(' ')}`);
  };

  // ---------- Drops on letters ----------

  for (const root of [grid, film]) {
    root.addEventListener('dragover', (e) => {
      const b = e.target.closest('[data-name]');
      if (!b || !e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      root.querySelectorAll('.drop-target').forEach((x) => x !== b && x.classList.remove('drop-target'));
      b.classList.add('drop-target');
    });
    root.addEventListener('dragleave', (e) => {
      const b = e.target.closest('[data-name]');
      if (b) b.classList.remove('drop-target');
    });
    root.addEventListener('drop', (e) => {
      const b = e.target.closest('[data-name]');
      if (!b || !e.dataTransfer?.files?.length) return;
      e.preventDefault();
      e.stopPropagation();
      b.classList.remove('drop-target');
      const name = b.dataset.name;
      const ch = charOfName.get(name);
      if (!P.font.glyphs[name] && ch) A.selectChar(ch);
      else A.selectGlyph(name);
      ctx.importIntoGlyph?.(e.dataTransfer.files[0]);
    });
  }

  // ---------- Hooks ----------

  const prevLoaded = ctx.onFontLoaded;
  ctx.onFontLoaded = () => {
    S.letters.charset = P.extras.charset || guessCharset();
    rebuild();
    prevLoaded?.();
  };
  function guessCharset() {
    const has = (c) => !!P.font.glyphs[lib.glyphNameFor(c)] && status(P.font.glyphs[lib.glyphNameFor(c)]) !== 'empty';
    if (has('\u00e3') || has('\u00e7')) return 'pt';
    if (Object.values(P.font.glyphs).some((g) => g.unicodes.some((u) => u >= 0xe000 && u <= 0xf8ff))) return 'all';
    return 'basic';
  }
  const prevSelected = ctx.onGlyphSelected;
  ctx.onGlyphSelected = (name) => {
    if (!ctx.order.includes(name)) {
      ctx.order.push(name);
      rebuild();
    }
    markSelected(name);
    prevSelected?.(name);
  };
  const prevChanged = ctx.onChanged;
  ctx.onChanged = (kind, glyphs) => {
    if (kind === 'glyph' && glyphs) {
      const missing = glyphs.some((n) => P.font.glyphs[n] && !ctx.order.includes(n) && S.letters.charset === 'all');
      if (missing) rebuild();
      else updateGlyphs(glyphs);
    } else if (kind === 'font' || kind === 'load') rebuild();
    prevChanged?.(kind, glyphs);
  };
  const prevPanel = ctx.onPanel;
  ctx.onPanel = (p) => {
    if (p === 'letters') requestAnimationFrame(renderGrid);
    prevPanel?.(p);
  };
  const prevTheme = ctx.onTheme;
  ctx.onTheme = () => {
    renderFilm();
    renderGrid();
    prevTheme?.();
  };
}
