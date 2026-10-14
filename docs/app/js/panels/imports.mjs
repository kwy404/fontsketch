// Uploads: SVG (one drawing, a sheet of named drawings or an SVG font),
// images (traced into the current letter), font files (TTF, OTF, WOFF,
// WOFF2) and .fontsketch.json projects. Drag and drop works on the canvas,
// the upload zone and on letters in the grid and filmstrip.
import { traceImage } from '../booleans.mjs';
import { bbox } from '../geom.mjs';
import { P, history, readProject } from '../project.mjs';
import { attachSvg, collectShapes, nameHint, parsePath, shapesBounds, shapesToContours } from '../svg.mjs';

const DESC = 'gjpqy';
const ASC = 'bdfhklt';

export function installImports(ctx) {
  const { S, A, lib, editor } = ctx;
  let lastImage = null; // { imageData, name } for re-tracing

  const kindOf = (file) => {
    const n = file.name.toLowerCase();
    if (n.endsWith('.svg') || file.type === 'image/svg+xml') return 'svg';
    if (/\.(ttf|otf|woff2?)$/.test(n)) return 'font';
    if (n.endsWith('.json')) return 'project';
    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/.test(n)) return 'image';
    return 'unknown';
  };

  A.importFiles = async (files) => {
    const list = [...(files || [])];
    if (!list.length) return;
    const svgs = list.filter((f) => kindOf(f) === 'svg');
    if (svgs.length > 1) return importManySvgs(svgs);
    for (const f of list) await importOne(f);
  };

  async function importOne(file, { intoGlyph = false } = {}) {
    const kind = kindOf(file);
    try {
      if (kind === 'svg') return ctx.importSvgText(await file.text(), file.name, { forceSingle: intoGlyph });
      if (kind === 'image') return importImage(file);
      if (kind === 'font') return importFontFile(file);
      if (kind === 'project') return importProject(file);
      A.toast(`fontsketch cannot open ${file.name}. Try SVG, PNG, JPG, TTF, OTF, WOFF or WOFF2.`, 'error');
    } catch (e) {
      console.error(e);
      A.toast(`Could not import ${file.name}: ${e.message}`, 'error');
    }
  }
  ctx.importIntoGlyph = (file) => importOne(file, { intoGlyph: true });

  // ---------- Fonts and projects ----------

  async function importFontFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let font;
    try {
      font = lib.parseFontAsync ? await lib.parseFontAsync(bytes) : lib.parseFont(bytes);
    } catch (e) {
      throw new Error(`the font could not be read (${e.message})`);
    }
    if (P.dirty && !confirm(`Open ${file.name} as a new project? Your current project stays saved in this browser.`)) return;
    ctx.openFont(font);
    S.letters.charset = 'all';
    A.setCharset();
    const n = Object.values(font.glyphs).filter((g) => g.contours.length || g.components?.length).length;
    A.toast(`Opened ${font.meta.family} with ${n} glyphs. Edit any letter, then download it again.`, 'success');
  }

  async function importProject(file) {
    const { font, extras } = readProject(await file.text());
    if (P.dirty && !confirm(`Open ${file.name}? Your current project stays saved in this browser.`)) return;
    ctx.openFont(font, { extras });
    A.toast(`Opened the project ${font.meta.family}`, 'success');
  }

  // ---------- SVG ----------

  ctx.importSvgText = (text, fileName = 'drawing.svg', { forceSingle = false } = {}) => {
    if (/<font[\s>]/i.test(text) && /<glyph[\s>]/i.test(text)) return importSvgFont(text);
    const { svg, cleanup } = attachSvg(text);
    try {
      const named = forceSingle ? [] : [...svg.querySelectorAll('[id], [data-char], [data-glyph], [inkscape\\:label]')].filter((el) => el !== svg && nameHint(el) && el.closest('defs') === null && (el.matches('g, path, svg, symbol, use') || el.matches('rect, circle, ellipse, polygon')));
      // Keep only the outermost named elements.
      const outer = named.filter((el) => !named.some((o) => o !== el && o.contains(el)));
      const resolved = outer.map((el) => ({ el, hint: nameHint(el) })).filter(({ hint }) => hint.char || P.font.glyphs[hint.name] || lib.unicodeFor(hint.name) !== undefined);
      if (resolved.length >= 2) return prepareSheet(svg, resolved.map(({ el, hint }) => ({ el, char: hint.char || charForName(hint.name), name: hint.char ? lib.glyphNameFor(hint.char) : hint.name })));
      // Several separate top level drawings without names: offer a sheet.
      const tops = [...svg.children].filter((el) => el.matches('g, path, rect, circle, ellipse, polygon') && collectShapes(el, svg).length);
      if (!forceSingle && tops.length >= 3 && tops.length <= 400) {
        const start = Math.max(0, ctx.order.indexOf(editor.name));
        return prepareSheet(svg, sortReading(tops, svg).map((el, i) => {
          const name = ctx.order[(start + i) % ctx.order.length];
          return { el, name, char: ctx.charForName(name) || '' };
        }), true);
      }
      importSingle(svg, fileName);
    } finally {
      cleanup();
    }
  };

  const charForName = (name) => {
    const u = P.font.glyphs[name]?.unicodes?.[0] ?? lib.unicodeFor(name);
    return u !== undefined ? String.fromCodePoint(u) : name;
  };

  function sortReading(els, svg) {
    const boxes = els.map((el) => ({ el, b: shapesBounds(collectShapes(el, svg)) })).filter((x) => x.b);
    const hs = boxes.map((x) => x.b.yMax - x.b.yMin).sort((a, b) => a - b);
    const rowTol = (hs[Math.floor(hs.length / 2)] || 10) * 0.6;
    boxes.sort((a, b) => (Math.abs(a.b.yMin - b.b.yMin) > rowTol ? a.b.yMin - b.b.yMin : a.b.xMin - b.b.xMin));
    return boxes.map((x) => x.el);
  }

  /** Maps SVG user space into the em box: the viewBox spans descender to ascender. */
  function emMapping(svg, shapes) {
    const m = P.font.meta;
    const vb = svg.viewBox?.baseVal;
    let box;
    if (vb && vb.width && vb.height) box = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
    else {
      const w = parseFloat(svg.getAttribute('width'));
      const h = parseFloat(svg.getAttribute('height'));
      if (w && h) box = { x: 0, y: 0, w, h };
    }
    const ink = shapesBounds(shapes);
    if (!box && ink) box = { x: ink.xMin, y: ink.yMin, w: ink.xMax - ink.xMin, h: ink.yMax - ink.yMin };
    const em = m.ascender - m.descender;
    const s = em / box.h;
    return { map: (p) => ({ x: (p.x - box.x) * s, y: m.ascender - (p.y - box.y) * s }), scale: s, width: box.w * s };
  }

  function importSingle(svg, fileName) {
    const g = editor.glyph;
    if (!g) return;
    const shapes = collectShapes(svg, svg);
    if (!shapes.length) return A.toast('That SVG has no shapes to import.', 'error');
    const { map, scale, width } = emMapping(svg, shapes);
    let contours = shapesToContours(shapes, map, scale, lib);
    if (!contours.length) return A.toast('That SVG has no filled or stroked shapes.', 'error');
    contours = lib.correctDirection(contours);
    const ib = bbox(contours);
    history.run('Import SVG', [g.name], () => {
      g.contours = contours.map((c) => ({ ...c, points: c.points.map((p) => ({ ...p, x: Math.round(p.x), y: Math.round(p.y) })) }));
      g.components = [];
      g.advanceWidth = Math.round(Math.max(width, ib ? ib.xMax + Math.max(40, ib.xMin) : width));
      for (const m of P.font.masters || []) delete m.glyphs[g.name];
    });
    editor.fit();
    A.toast(`${fileName} placed in ${S.glyph.label}. The SVG's viewBox maps to the full em box.`, 'success');
  }

  /** Sheet: shows thumbnails with letters to confirm before adding. */
  function prepareSheet(svg, items, guessed = false) {
    const all = items.map((it) => collectShapes(it.el, svg)).flat();
    const ink = shapesBounds(all);
    if (!ink) return A.toast('No drawings found in that sheet.', 'error');
    const m = P.font.meta;
    // One scale for the whole sheet: the tallest typical drawing becomes the cap height.
    const heights = items.map((it) => {
      const b = shapesBounds(collectShapes(it.el, svg));
      return b ? b.yMax - b.yMin : 0;
    }).filter(Boolean).sort((a, b) => a - b);
    const ref = heights[Math.floor(heights.length * 0.85)] || heights[heights.length - 1];
    const s = m.capHeight / ref;
    const prepared = [];
    for (const it of items) {
      const shapes = collectShapes(it.el, svg);
      const b = shapesBounds(shapes);
      if (!b) continue;
      const ch = it.char || '';
      const drop = ch && DESC.includes(ch) ? -m.descender * 0.85 : 0;
      const map = (p) => ({ x: (p.x - b.xMin) * s + 50, y: (b.yMax - p.y) * s - drop });
      const contours = shapesToContours(shapes, map, s, lib);
      if (!contours.length) continue;
      prepared.push({ char: ch, name: it.name, contours: lib.correctDirection(contours), width: Math.round((b.xMax - b.xMin) * s + 100), thumb: thumb(contours) });
    }
    ctx.svgSheetData = prepared;
    S.svgSheet = prepared.map((p) => ({ char: p.char, thumb: p.thumb }));
    A.openPanel('uploads');
    A.toast(guessed ? `${prepared.length} drawings found. Check the letter under each one, then add them.` : `${prepared.length} named drawings found. Add them to your font.`);
  }

  function thumb(contours) {
    const b = bbox(contours);
    if (!b) return '';
    const size = Math.max(b.xMax - b.xMin, b.yMax - b.yMin) || 1;
    const d = contours.map((c) => c.points.length ? `M${c.points.map((p) => `${Math.round(p.x - b.xMin)} ${Math.round(b.yMax - p.y)}`).join('L')}Z` : '').join('');
    // A light preview from the control polygon (enough for a thumbnail).
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 ${size + 40} ${size + 40}"><path d="${d}" fill="#222" fill-rule="nonzero"/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  A.setSheetChar = (i, v) => {
    const ch = [...(v || '')][0] || '';
    S.svgSheet[i].char = ch;
    if (ctx.svgSheetData[i]) {
      ctx.svgSheetData[i].char = ch;
      ctx.svgSheetData[i].name = ch ? lib.glyphNameFor(ch) : '';
    }
  };
  A.acceptSvgSheet = () => {
    const data = (ctx.svgSheetData || []).filter((d) => d.name);
    if (!data.length) return;
    const names = data.map((d) => d.name);
    history.run('Import SVG sheet', names, () => {
      for (const d of data) {
        const g = P.font.glyphs[d.name];
        lib.addGlyph(P.font, { ...(g || {}), name: d.name, unicodes: g?.unicodes ?? (d.char && [...d.char].length === 1 ? [d.char.codePointAt(0)] : undefined), advanceWidth: d.width, contours: d.contours, components: [] });
        for (const m of P.font.masters || []) delete m.glyphs[d.name];
      }
    });
    S.svgSheet = [];
    ctx.svgSheetData = [];
    A.selectGlyph(names[0]);
    A.toast(`Added ${names.length} letters from the SVG sheet`, 'success', 'Undo', () => A.undo());
  };

  async function importManySvgs(files) {
    // Each file named after its letter (A.svg, a.svg, uni00E3.svg, aacute.svg).
    const items = [];
    for (const f of files) {
      const base = f.name.replace(/\.svg$/i, '');
      const fake = { getAttribute: (a) => (a === 'id' ? base : null) };
      const hint = nameHint(fake);
      const text = await f.text();
      items.push({ text, hint, file: f.name });
    }
    const prepared = [];
    for (const it of items) {
      const { svg, cleanup } = attachSvg(it.text);
      try {
        const shapes = collectShapes(svg, svg);
        if (!shapes.length) continue;
        const { map, scale, width } = emMapping(svg, shapes);
        const contours = lib.correctDirection(shapesToContours(shapes, map, scale, lib));
        const ch = it.hint?.char || (it.hint?.name ? charForName(it.hint.name) : '');
        prepared.push({ char: ch, name: it.hint?.char ? lib.glyphNameFor(it.hint.char) : it.hint?.name || '', contours, width: Math.round(width), thumb: thumb(contours) });
      } finally {
        cleanup();
      }
    }
    ctx.svgSheetData = prepared;
    S.svgSheet = prepared.map((p) => ({ char: p.char, thumb: p.thumb }));
    A.openPanel('uploads');
    A.toast(`${prepared.length} SVG files ready. Files named after letters (A.svg, b.svg) are matched for you.`);
  }

  function importSvgFont(text) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const face = doc.querySelector('font-face');
    const upm = parseFloat(face?.getAttribute('units-per-em')) || 1000;
    const fontEl = doc.querySelector('font');
    const defAdv = parseFloat(fontEl?.getAttribute('horiz-adv-x')) || upm / 2;
    const s = P.font.meta.unitsPerEm / upm;
    const glyphs = [...doc.querySelectorAll('glyph')];
    const names = [];
    const data = [];
    for (const el of glyphs) {
      const uni = el.getAttribute('unicode');
      const d = el.getAttribute('d');
      if (!uni || [...uni].length !== 1 || !d) continue;
      const name = lib.glyphNameFor(uni);
      const shapes = [{ subpaths: parsePath(d), fill: true, stroke: false }];
      const contours = shapesToContours(shapes, (p) => ({ x: p.x * s, y: p.y * s }), s, lib);
      names.push(name);
      data.push({ name, uni, contours, adv: Math.round((parseFloat(el.getAttribute('horiz-adv-x')) || defAdv) * s) });
    }
    if (!data.length) return A.toast('No glyphs found in that SVG font.', 'error');
    history.run('Import SVG font', names, () => {
      for (const d of data) lib.addGlyph(P.font, { ...(P.font.glyphs[d.name] || {}), name: d.name, unicodes: [d.uni.codePointAt(0)], advanceWidth: d.adv, contours: lib.correctDirection(d.contours), components: [] });
    });
    A.toast(`Imported ${data.length} glyphs from the SVG font`, 'success');
  }

  // ---------- Images ----------

  async function importImage(file) {
    const g = editor.glyph;
    if (!g) return;
    const bitmap = await loadBitmap(file);
    const max = 900;
    const k = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(bitmap.width * k));
    cv.height = Math.max(1, Math.round(bitmap.height * k));
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.fillStyle = '#fff';
    c.fillRect(0, 0, cv.width, cv.height);
    c.drawImage(bitmap, 0, 0, cv.width, cv.height);
    const imageData = c.getImageData(0, 0, cv.width, cv.height);
    // Dark ink on light paper is the common case; guess from the corners.
    S.trace.invert = cornerLuma(imageData) < 0.4;
    lastImage = { imageData, name: g.name };
    S.trace.has = true;
    traceInto(g.name);
  }

  function loadBitmap(file) {
    if (typeof createImageBitmap === 'function') return createImageBitmap(file);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('the image could not be decoded'));
      img.src = URL.createObjectURL(file);
    });
  }

  function cornerLuma(im) {
    const { width: w, height: h, data } = im;
    let sum = 0;
    let n = 0;
    for (const [x, y] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) {
      const i = (Math.max(0, y) * w + Math.max(0, x)) * 4;
      sum += (data[i] + data[i + 1] + data[i + 2]) / 765;
      n++;
    }
    return sum / n;
  }

  /** Crops to the ink and traces it into a glyph sized for its character. */
  function traceInto(name) {
    const g = P.font.glyphs[name];
    if (!g || !lastImage) return;
    const im = lastImage.imageData;
    const t = S.trace.threshold / 100;
    const crop = inkCrop(im, t, S.trace.invert);
    if (!crop) return A.toast('No ink found in that image. Move the threshold or try Light ink on dark paper.', 'error');
    const m = P.font.meta;
    const ch = ctx.charForName(name) || '';
    let top = m.capHeight;
    let bottom = 0;
    if (/[a-z]/.test(ch)) {
      top = ASC.includes(ch) ? Math.round(m.capHeight * 1.04) : m.xHeight;
      if (DESC.includes(ch)) bottom = m.descender * 0.95;
    }
    const scale = (top - bottom) / crop.height;
    const w = crop.width * scale;
    const box = { xMin: 50, xMax: 50 + w, yMin: bottom, yMax: top };
    const contours = traceImage(crop.data, { threshold: t, invert: S.trace.invert, box }, lib);
    if (!contours.length) return A.toast('Nothing to trace at this threshold.', 'error');
    history.run('Trace image', [name], () => {
      g.contours = contours;
      g.components = [];
      g.advanceWidth = Math.round(w + 100);
      for (const ms of P.font.masters || []) delete ms.glyphs[name];
    });
    editor.fit();
    const pts = contours.reduce((n, c) => n + c.points.length, 0);
    A.toast(`Traced ${contours.length} shapes (${pts} points) into ${S.glyph.label}`, 'success');
  }
  A.retrace = () => traceInto(editor.name);

  function inkCrop(im, t, invert) {
    const { width: w, height: h, data } = im;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        const ink = invert ? lum : 1 - lum;
        if (ink >= t) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    const pad = 3;
    x0 = Math.max(0, x0 - pad);
    y0 = Math.max(0, y0 - pad);
    x1 = Math.min(w - 1, x1 + pad);
    y1 = Math.min(h - 1, y1 + pad);
    const cw = x1 - x0 + 1;
    const chh = y1 - y0 + 1;
    const out = new ImageData(cw, chh);
    for (let y = 0; y < chh; y++) out.data.set(data.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x0 + cw) * 4), y * cw * 4);
    return { data: out, width: cw, height: chh };
  }

  // ---------- Drag and drop ----------

  const stage = document.getElementById('stage');
  const veil = document.getElementById('dropveil');
  const veilText = document.getElementById('dropveil-text');
  let depth = 0;
  const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    depth++;
    if (e.target.closest?.('#stage')) {
      veil.classList.add('on');
      veilText.textContent = `Drop an SVG or image to fill \u201c${S.glyph.char || S.glyph.name}\u201d, or a font file to open it`;
    }
  });
  window.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) veil.classList.remove('on');
  });
  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    const onStage = !!e.target.closest?.('#stage');
    veil.classList.toggle('on', onStage);
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    veil.classList.remove('on');
    const files = [...e.dataTransfer.files];
    if (!files.length) return;
    if (e.target.closest?.('#stage') && files.length === 1 && ['svg', 'image'].includes(kindOf(files[0]))) ctx.importIntoGlyph(files[0]);
    else A.importFiles(files);
  });
  const dz = document.getElementById('drop-uploads');
  dz.addEventListener('dragover', () => dz.classList.add('is-over'));
  dz.addEventListener('dragleave', () => dz.classList.remove('is-over'));
  dz.addEventListener('drop', () => dz.classList.remove('is-over'));
  void stage;

  const prevSelected = ctx.onGlyphSelected;
  ctx.onGlyphSelected = (name) => {
    S.trace.has = !!lastImage;
    prevSelected?.(name);
  };
}
