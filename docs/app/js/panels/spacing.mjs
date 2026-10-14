// Spacing and kerning: automatic side bearings from each letter's shape, a
// visual pair editor (drag the right letter or use the arrow keys), the pair
// list, kerning classes and the metrics table.
import { flatten, inkBounds, matrix, resolve, status, tracePath, transformContours } from '../geom.mjs';
import { P, history, kernValue } from '../project.mjs';
import { css, fitCanvas } from '../render.mjs';

/** Leftmost and rightmost ink at height y (nonzero), or null. */
function spanAt(polys, y) {
  const xs = [];
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j];
      const b = poly[i];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
  }
  if (!xs.length) return null;
  return [Math.min(...xs), Math.max(...xs)];
}

/**
 * Side bearings from shape: straight vertical sides get the full base
 * value, round and diagonal sides less, measured by how much of the side
 * profile hugs the outer edge between the baseline and the x-height or cap
 * height.
 */
export function autoBearings(contours, meta, base) {
  const ib = inkBounds(contours);
  if (!ib) return null;
  const polys = contours.map((c) => flatten(c, 6));
  const top = Math.min(ib.yMax, ib.yMax > meta.xHeight * 1.15 ? meta.capHeight : meta.xHeight);
  const bottom = Math.max(ib.yMin, 0);
  const h = Math.max(1, top - bottom);
  const width = Math.max(1, ib.xMax - ib.xMin);
  let left = 0;
  let right = 0;
  let n = 0;
  for (let k = 1; k < 20; k++) {
    const y = bottom + (h * k) / 20;
    const s = spanAt(polys, y);
    if (!s) continue;
    n++;
    left += Math.min(1, (s[0] - ib.xMin) / (width * 0.25));
    right += Math.min(1, (ib.xMax - s[1]) / (width * 0.25));
  }
  if (!n) return { lsb: Math.round(base * 0.6), rsb: Math.round(base * 0.6) };
  const f = (v) => Math.round(base * (1 - 0.65 * (v / n)));
  return { lsb: f(left), rsb: f(right) };
}

export function installSpacing(ctx) {
  const { S, A, lib, editor } = ctx;
  const kcv = document.getElementById('kern-canvas');
  const table = document.getElementById('metrics-table');

  // ---------- Auto spacing ----------

  function spaceGlyph(g, base) {
    const contours = resolve(P.font, g);
    const sb = autoBearings(contours, P.font.meta, base);
    if (!sb) return false;
    const ib = inkBounds(contours);
    const dx = Math.round(sb.lsb - ib.xMin);
    if (dx) ctx.shiftGlyph(g, dx);
    g.advanceWidth = Math.max(0, Math.round(ib.xMax + dx + sb.rsb));
    return true;
  }
  const baseUnits = () => Math.round((+S.spacing.amount / 100) * P.font.meta.unitsPerEm * 0.12);
  A.autoSpace = () => {
    const names = Object.values(P.font.glyphs).filter((g) => g.contours.length && g.name !== '.notdef').map((g) => g.name);
    if (!names.length) return A.toast('Draw a few letters first.');
    history.run('Auto spacing', names, () => {
      for (const n of names) spaceGlyph(P.font.glyphs[n], baseUnits());
      // Composed letters follow their base advance.
      for (const g of Object.values(P.font.glyphs)) {
        if (g.contours.length || !g.components?.length) continue;
        const base = P.font.glyphs[g.components[0].glyph];
        if (base) g.advanceWidth = base.advanceWidth;
      }
    });
    A.toast(`Spaced ${names.length} letters. Check a few words in Test.`, 'success', 'Undo', () => A.undo());
  };
  A.autoSpaceGlyph = () => {
    const g = editor.glyph;
    if (!g) return;
    history.run('Auto space', [g.name], () => spaceGlyph(g, baseUnits()));
  };

  // ---------- Kerning pairs ----------

  const sideName = (v) => {
    v = (v || '').trim();
    if (!v) return '';
    if (v.startsWith('@')) return v;
    if (P.font.glyphs[v] && [...v].length > 1) return v;
    return lib.glyphNameFor([...v][0]);
  };
  const sideLabel = (name) => {
    if (name.startsWith('@')) return name;
    const g = P.font.glyphs[name];
    return g?.unicodes?.length ? String.fromCodePoint(g.unicodes[0]) : name;
  };

  function syncKern() {
    const k = P.font.kerning;
    S.kern.value = k.pairs[`${S.kern.left}|${S.kern.right}`] ?? (S.kern.left.startsWith('@') || S.kern.right.startsWith('@') ? 0 : kernValue(P.font, S.kern.left, S.kern.right));
    S.kern.pairs = Object.entries(k.pairs)
      .map(([key, value]) => {
        const [l, r] = key.split('|');
        return { key, value, label: `${sideLabel(l)}${l.startsWith('@') || r.startsWith('@') ? ' ' : ''}${sideLabel(r)}` };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
    S.kern.classes = Object.entries(k.classes).map(([name, members]) => ({ name, members: members.map(sideLabel).join(' ') }));
    drawKern();
  }

  A.setKernSide = (side, v) => {
    const name = sideName(v);
    if (!name) return;
    S.kern[side] = name;
    S.kern[`${side}Char`] = v.trim();
    syncKern();
  };
  A.pickPair = (label) => {
    const parts = label.includes(' ') ? label.split(' ') : [...label];
    if (parts.length < 2) return;
    S.kern.leftChar = parts[0];
    S.kern.rightChar = parts[1];
    S.kern.left = sideName(parts[0]);
    S.kern.right = sideName(parts[1]);
    syncKern();
  };
  A.setKernValue = (v) => {
    v = Math.round(+v || 0);
    const key = `${S.kern.left}|${S.kern.right}`;
    history.run('Kerning', 'kerning', () => {
      if (v === 0) delete P.font.kerning.pairs[key];
      else P.font.kerning.pairs[key] = v;
    });
  };
  A.deletePair = (key) => history.run('Delete pair', 'kerning', () => delete P.font.kerning.pairs[key]);

  // Classes: "@name: A \u00c0 \u00c1"
  A.addClass = () => {
    const m = /^\s*(@?[\w.-]+)\s*[:=]?\s*(.*)$/.exec(S.kern.newClass || '');
    if (!m || !m[2].trim()) return A.toast('Type a class like @round: O C G Q');
    const name = m[1].startsWith('@') ? m[1] : `@${m[1]}`;
    const members = m[2].split(/[\s,]+/).filter(Boolean).map(sideName).filter((n) => P.font.glyphs[n]);
    history.run('Kerning class', 'kerning', () => (P.font.kerning.classes[name] = members));
    S.kern.newClass = '';
  };
  A.setClass = (name, text) => {
    const members = text.split(/[\s,]+/).filter(Boolean).map(sideName).filter((n) => P.font.glyphs[n]);
    history.run('Kerning class', 'kerning', () => (P.font.kerning.classes[name] = members));
  };
  A.deleteClass = (name) => {
    history.run('Delete class', 'kerning', () => {
      delete P.font.kerning.classes[name];
      for (const key of Object.keys(P.font.kerning.pairs)) if (key.split('|').includes(name)) delete P.font.kerning.pairs[key];
    });
  };

  // ---------- Pair canvas ----------

  let drag = null;
  function layoutPair() {
    const w = kcv.clientWidth || 300;
    const h = kcv.clientHeight || 170;
    const m = P.font.meta;
    const firstOf = (n) => (n.startsWith('@') ? P.font.glyphs[(P.font.kerning.classes[n] || [])[0]] : P.font.glyphs[n]);
    const lg = firstOf(S.kern.left);
    const rg = firstOf(S.kern.right);
    const em = m.ascender - m.descender;
    const s = (h * 0.78) / em;
    const total = ((lg?.advanceWidth || 500) + (rg?.advanceWidth || 500)) * s;
    const ox = (w - total) / 2;
    const base = h * 0.11 + m.ascender * s;
    return { w, h, s, ox, base, lg, rg };
  }
  function drawKern() {
    if (S.panel !== 'spacing' || !kcv.clientWidth) return;
    const { w, h, s, ox, base, lg, rg } = layoutPair();
    const c = fitCanvas(kcv, w, h);
    c.fillStyle = css('--ed-canvas') || '#fff';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = css('--ed-guide') || '#ddd';
    c.beginPath();
    c.moveTo(0, base + 0.5);
    c.lineTo(w, base + 0.5);
    c.stroke();
    const v = +S.kern.value || 0;
    const ink = css('--ink') || '#222';
    if (lg) {
      c.fillStyle = ink;
      c.beginPath();
      tracePath(c, resolve(P.font, lg), (x, y) => [ox + x * s, base - y * s]);
      c.fill('nonzero');
    }
    if (rg) {
      const rx = ox + ((lg?.advanceWidth || 500) + v) * s;
      c.fillStyle = drag ? css('--vermilion') || '#d24a22' : ink;
      c.beginPath();
      tracePath(c, resolve(P.font, rg), (x, y) => [rx + x * s, base - y * s]);
      c.fill('nonzero');
      // Advance boundary
      c.strokeStyle = css('--vermilion') || '#d24a22';
      c.setLineDash([3, 3]);
      c.beginPath();
      c.moveTo(Math.round(rx) + 0.5, 8);
      c.lineTo(Math.round(rx) + 0.5, h - 8);
      c.stroke();
      c.setLineDash([]);
    }
    c.fillStyle = css('--ink-3') || '#777';
    c.font = '12px ui-sans-serif, system-ui, sans-serif';
    c.fillText(`${v > 0 ? '+' : ''}${v} units`, 10, h - 10);
  }
  kcv.addEventListener('pointerdown', (e) => {
    kcv.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, v0: +S.kern.value || 0 };
    drawKern();
  });
  kcv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const { s } = layoutPair();
    S.kern.value = Math.round((drag.v0 + ((e.clientX - drag.x) * 0.5) / s) / 5) * 5;
    drawKern();
  });
  const endDrag = () => {
    if (!drag) return;
    drag = null;
    A.setKernValue(S.kern.value);
  };
  kcv.addEventListener('pointerup', endDrag);
  kcv.addEventListener('pointercancel', endDrag);
  kcv.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    e.stopPropagation();
    A.setKernValue((+S.kern.value || 0) + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 20 : 5));
  });

  // ---------- Metrics table ----------

  function renderTable() {
    if (S.panel !== 'spacing' || !S.pro) return;
    const rows = ctx.order.filter((n) => status(P.font.glyphs[n]) !== 'empty').map((n) => {
      const g = P.font.glyphs[n];
      const ib = inkBounds(resolve(P.font, g));
      return `<tr data-name="${n}"><td>${escapeHtml(sideLabel(n))}</td><td><input type="number" data-k="adv" value="${g.advanceWidth}" aria-label="Width of ${escapeHtml(n)}"></td><td><input type="number" data-k="lsb" value="${ib ? Math.round(ib.xMin) : 0}" aria-label="Left bearing of ${escapeHtml(n)}"></td><td><input type="number" data-k="rsb" value="${ib ? Math.round(g.advanceWidth - ib.xMax) : 0}" aria-label="Right bearing of ${escapeHtml(n)}"></td></tr>`;
    });
    table.innerHTML = `<table><thead><tr><th>Letter</th><th>Width</th><th>Left</th><th>Right</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
  }
  table.addEventListener('change', (e) => {
    const input = e.target.closest('input');
    const tr = e.target.closest('tr');
    if (!input || !tr) return;
    const g = P.font.glyphs[tr.dataset.name];
    const v = Math.round(+input.value);
    if (!g || !Number.isFinite(v)) return;
    history.run('Spacing', [g.name], () => {
      const ib = inkBounds(resolve(P.font, g));
      if (input.dataset.k === 'adv') g.advanceWidth = Math.max(0, v);
      else if (ib && input.dataset.k === 'lsb') {
        const d = Math.round(v - ib.xMin);
        ctx.shiftGlyph(g, d);
        g.advanceWidth += d;
      } else if (ib) g.advanceWidth = Math.max(0, Math.round(ib.xMax + v));
    });
  });

  // ---------- Hooks ----------

  const prevPanel = ctx.onPanel;
  ctx.onPanel = (p) => {
    if (p === 'spacing') requestAnimationFrame(() => {
      syncKern();
      renderTable();
    });
    prevPanel?.(p);
  };
  const prevChanged = ctx.onChanged;
  ctx.onChanged = (kind, glyphs) => {
    if (S.panel === 'spacing') {
      syncKern();
      if (kind !== 'kerning') renderTable();
    }
    prevChanged?.(kind, glyphs);
  };
  const prevSync = ctx.onFontSync;
  ctx.onFontSync = () => {
    if (S.panel === 'spacing') renderTable();
    prevSync?.();
  };
  const prevTheme = ctx.onTheme;
  ctx.onTheme = () => {
    drawKern();
    prevTheme?.();
  };
  new ResizeObserver(() => drawKern()).observe(kcv);
  void matrix;
  void transformContours;
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
