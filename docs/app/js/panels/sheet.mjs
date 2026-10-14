// Handwriting sheet flow: print a template, photograph or upload the filled
// sheet (camera on phones), review every recognized cell with its
// confidence, fix a cell (ink threshold, redraw, skip) and accept them all
// into the font. Uses the scan module of the engine (lib.scan).
import { SHEET_SETS } from '../charsets.mjs';
import { tracePath } from '../geom.mjs';
import { P, history } from '../project.mjs';
import { css, fitCanvas } from '../render.mjs';

const TEMPLATE_METRICS = { unitsPerEm: 1000, ascender: 800, descender: -200, xHeight: 500, capHeight: 700 };

export function installSheet(ctx) {
  const { S, A, lib } = ctx;
  const scan = lib.scan;
  const cellsEl = document.getElementById('cells');
  const shotEl = document.getElementById('sheet-shot');
  const previewEl = document.getElementById('sheet-preview');
  /** char -> { glyph (scan result), skip, redrawn } */
  let cells = new Map();
  let results = [];
  let lastPhoto = null;
  let stream = null;

  const options = (set = S.sheet.set, page = S.sheet.page, guides = S.sheet.guides) => ({
    chars: (SHEET_SETS.find((s) => s.id === set) || SHEET_SETS[0]).chars,
    pageSize: page,
    guides: guides ? { baseline: true, xHeight: true, capHeight: true, descender: true, ascender: false } : false,
    metrics: TEMPLATE_METRICS,
    title: `${P.font?.meta.family || 'My font'} handwriting sheet`,
  });
  const templateFor = (o = options()) => scan.createTemplate(o);

  // ---------- Step 1: template ----------

  A.sheetPreview = () => {
    if (!scan) return;
    try {
      const t = templateFor();
      previewEl.innerHTML = '';
      const img = document.createElement('img');
      img.alt = `Preview of the handwriting template, page 1 of ${t.pages}`;
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(t.svg)}`;
      previewEl.append(img);
      previewEl.style.aspectRatio = `${t.template.width} / ${t.template.height}`;
      previewEl.title = t.pages > 1 ? `${t.pages} pages` : '1 page';
    } catch (e) {
      previewEl.textContent = `Could not build the template: ${e.message}`;
    }
  };
  A.downloadTemplate = (kind) => {
    const t = templateFor();
    if (kind === 'pdf') ctx.saveBytes(t.pdf, 'fontsketch-handwriting-sheet.pdf', 'application/pdf');
    else t.svgPages.forEach((svg, i) => ctx.saveBytes(new TextEncoder().encode(svg), `fontsketch-handwriting-sheet${t.pages > 1 ? `-page-${i + 1}` : ''}.svg`, 'image/svg+xml'));
    A.toast(t.pages > 1 ? `The template has ${t.pages} pages. Print all of them at 100% scale.` : 'Print it at 100% scale (no fit to page), then write one character per box.');
  };

  // ---------- Step 2: photo ----------

  A.scanFile = async (file) => {
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      await runScan(toImageData(bitmap));
    } catch (e) {
      S.sheet.error = `Could not read that photo: ${e.message}`;
    }
  };

  function toImageData(src) {
    const w = src.videoWidth || src.width;
    const h = src.videoHeight || src.height;
    const k = Math.min(1, 3200 / Math.max(w, h));
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * k);
    cv.height = Math.round(h * k);
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.drawImage(src, 0, 0, cv.width, cv.height);
    return c.getImageData(0, 0, cv.width, cv.height);
  }

  ctx.scanImageData = (im) => runScan(im);

  async function runScan(im) {
    S.sheet.error = '';
    S.sheet.busy = 'Finding the corner markers and flattening the page';
    await new Promise((r) => setTimeout(r, 30));
    let result;
    try {
      result = scan.scanSheet(im, { template: templateFor().template });
    } catch (e) {
      if (e.code === 'sheet-mismatch') {
        S.sheet.busy = 'This sheet was printed with other settings; finding them';
        await new Promise((r) => setTimeout(r, 30));
        result = tryAllTemplates(im);
        if (!result) result = scan.scanSheet(im, { template: templateFor().template, ignoreSheetId: true });
      } else {
        S.sheet.busy = '';
        S.sheet.error = e.message;
        return;
      }
    }
    S.sheet.busy = '';
    lastPhoto = { im, result };
    results = results.filter((r) => r.page !== result.page);
    results.push(result);
    for (const [ch, g] of Object.entries(result.glyphs)) cells.set(ch, { glyph: g, skip: g.empty, redrawn: false });
    const general = result.warnings.filter((w) => !w.char).map((w) => w.message);
    S.sheet.warnings = general;
    S.sheet.step = 3;
    if (!S.wide && !matchMedia('(max-width: 640px)').matches) S.wide = true;
    refreshCells();
    drawShot();
    const missing = result.pageCount > 1 ? ` Page ${result.page + 1} of ${result.pageCount}: add the other pages with another photo.` : '';
    A.toast(`Found ${Object.values(result.glyphs).filter((g) => !g.empty).length} letters.${missing}`, 'success');
  }

  function tryAllTemplates(im) {
    for (const set of SHEET_SETS) {
      for (const page of ['A4', 'Letter']) {
        for (const guides of [true, false]) {
          const o = options(set.id, page, guides);
          try {
            const result = scan.scanSheet(im, { template: scan.createTemplate(o).template });
            Object.assign(S.sheet, { set: set.id, page, guides });
            return result;
          } catch (e) {
            if (e.code !== 'sheet-mismatch') throw e;
          }
        }
      }
    }
    return null;
  }

  // Camera
  A.startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      S.sheet.error = 'This browser cannot use the camera here. Upload a photo instead.';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 3264 }, height: { ideal: 2448 } }, audio: false });
      const v = document.getElementById('camera-video');
      v.srcObject = stream;
      await v.play();
      S.sheet.camera = true;
    } catch (e) {
      S.sheet.error = `The camera is not available (${e.name || e.message}). Upload a photo instead.`;
    }
  };
  A.stopCamera = () => {
    if (stream) for (const t of stream.getTracks()) t.stop();
    stream = null;
    S.sheet.camera = false;
  };
  A.capture = async () => {
    const v = document.getElementById('camera-video');
    if (!v.videoWidth) return;
    const im = toImageData(v);
    A.stopCamera();
    await runScan(im);
  };

  // ---------- Step 3: review ----------

  function confClass(c) {
    return c >= 0.7 ? 'c-high' : c >= 0.4 ? 'c-mid' : 'c-low';
  }

  function refreshCells() {
    const list = [...cells.entries()];
    S.sheet.cells = list.map(([ch]) => ch);
    S.sheet.found = list.filter(([, c]) => !c.glyph.empty).length;
    S.sheet.low = list.filter(([, c]) => !c.glyph.empty && !c.skip && c.glyph.confidence < 0.6).length;
    S.sheet.accepting = list.filter(([, c]) => !c.skip && !c.glyph.empty).length;
    const frag = document.createDocumentFragment();
    for (const [ch, c] of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `cell ${confClass(c.glyph.confidence)}${c.skip ? ' is-skip' : ''}`;
      b.dataset.char = ch;
      b.setAttribute('aria-selected', S.sheet.cur === ch ? 'true' : 'false');
      const pct = Math.round(c.glyph.confidence * 100);
      b.setAttribute('aria-label', `${ch}: ${c.glyph.empty ? 'empty' : `${pct} percent sure`}${c.skip ? ', skipped' : ''}`);
      const cv = document.createElement('canvas');
      const conf = document.createElement('i');
      conf.className = 'conf';
      conf.textContent = c.glyph.empty ? '0' : c.redrawn ? 'ok' : String(pct);
      const label = document.createElement('span');
      label.textContent = ch;
      b.append(conf, cv, label);
      frag.append(b);
    }
    cellsEl.replaceChildren(frag);
    requestAnimationFrame(() => {
      for (const b of cellsEl.children) paintCell(b.querySelector('canvas'), cells.get(b.dataset.char).glyph);
    });
  }

  function paintCell(cv, g) {
    const w = cv.clientWidth || 52;
    const h = w;
    const c = fitCanvas(cv, w, h);
    c.clearRect(0, 0, w, h);
    const m = TEMPLATE_METRICS;
    const s = (h * 0.86) / (m.ascender - m.descender);
    const base = h * 0.07 + m.ascender * s;
    c.strokeStyle = css('--line') || '#ddd';
    c.beginPath();
    c.moveTo(0, base + 0.5);
    c.lineTo(w, base + 0.5);
    c.stroke();
    if (!g || g.empty) return;
    const ox = (w - g.advanceWidth * s) / 2;
    c.fillStyle = css('--ink') || '#222';
    c.beginPath();
    tracePath(c, g.contours, (x, y) => [ox + x * s, base - y * s]);
    c.fill('nonzero');
  }

  cellsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.cell');
    if (!b) return;
    selectCell(b.dataset.char);
  });
  function selectCell(ch) {
    const c = cells.get(ch);
    if (!c) return;
    S.sheet.cur = ch;
    S.sheet.curConf = Math.round(c.glyph.confidence * 100);
    S.sheet.curSkip = c.skip;
    for (const b of cellsEl.children) b.setAttribute('aria-selected', b.dataset.char === ch ? 'true' : 'false');
  }

  A.retraceCell = () => {
    const ch = S.sheet.cur;
    const r = results.find((x) => x.glyphs[ch]);
    if (!ch || !r) return;
    try {
      const g = r.rescan(ch, { threshold: S.sheet.threshold / 100 });
      cells.set(ch, { glyph: g, skip: g.empty, redrawn: false });
      refreshCells();
      selectCell(ch);
    } catch (e) {
      A.toast(`Could not trace again: ${e.message}`, 'error');
    }
  };
  A.toggleSkipCell = () => {
    const c = cells.get(S.sheet.cur);
    if (!c) return;
    c.skip = !c.skip;
    S.sheet.curSkip = c.skip;
    refreshCells();
  };

  function drawShot() {
    if (!lastPhoto) return;
    const { im, result } = lastPhoto;
    const cv = document.createElement('canvas');
    const k = Math.min(1, 900 / im.width);
    cv.width = Math.round(im.width * k);
    cv.height = Math.round(im.height * k);
    const c = cv.getContext('2d');
    const tmp = document.createElement('canvas');
    tmp.width = im.width;
    tmp.height = im.height;
    tmp.getContext('2d').putImageData(im, 0, 0);
    c.drawImage(tmp, 0, 0, cv.width, cv.height);
    // Detected markers.
    c.lineWidth = 3;
    c.strokeStyle = '#2c8a4e';
    for (const mk of result.markers || []) {
      c.beginPath();
      mk.corners.forEach(([x, y], i) => (i ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k)));
      c.closePath();
      c.stroke();
    }
    // The page outline through the homography (millimetres to pixels).
    const H = result.homography;
    const t = templateFor().template;
    if (H && t) {
      const ap = (x, y) => {
        const w = H[6] * x + H[7] * y + H[8];
        return [((H[0] * x + H[1] * y + H[2]) / w) * k, ((H[3] * x + H[4] * y + H[5]) / w) * k];
      };
      c.strokeStyle = '#d24a22';
      c.setLineDash([8, 6]);
      c.beginPath();
      [[0, 0], [t.width, 0], [t.width, t.height], [0, t.height]].forEach(([x, y], i) => (i ? c.lineTo(...ap(x, y)) : c.moveTo(...ap(x, y))));
      c.closePath();
      c.stroke();
    }
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', `The photo with ${result.markers?.length || 0} detected corner markers and the flattened page outline`);
    shotEl.replaceChildren(cv);
  }

  A.acceptSheet = () => {
    const chosen = [...cells.entries()].filter(([, c]) => !c.skip && !c.glyph.empty);
    if (!chosen.length) return A.toast('No letters to add yet.');
    const m = P.font.meta;
    const k = m.capHeight / TEMPLATE_METRICS.capHeight;
    const names = chosen.map(([ch]) => lib.glyphNameFor(ch));
    history.run('Add handwriting', names, () => {
      for (const [ch, c] of chosen) {
        const g = c.glyph;
        const name = lib.glyphNameFor(ch);
        const contours = g.contours.map((ct) => ({ ...ct, points: ct.points.map((p) => ({ ...p, x: Math.round(p.x * k), y: Math.round(p.y * k) })) }));
        lib.addGlyph(P.font, { ...(P.font.glyphs[name] || {}), name, unicodes: [ch.codePointAt(0)], advanceWidth: Math.round(g.advanceWidth * k), contours, components: [] });
        for (const ms of P.font.masters || []) delete ms.glyphs[name];
      }
    });
    S.wide = false;
    A.selectGlyph(names[0]);
    A.toast(`Added ${names.length} handwritten letters. Next: Auto accents and Auto spacing.`, 'success', 'Auto spacing', () => {
      A.openPanel('spacing');
      A.autoSpace();
    });
  };

  // ---------- Redraw a cell ----------

  const dlg = document.getElementById('redraw');
  const rcv = document.getElementById('redraw-canvas');
  let strokes = [];
  let live = null;
  const RM = TEMPLATE_METRICS;
  const rmap = () => {
    const w = rcv.clientWidth || 400;
    const s = (w * 0.8) / (RM.ascender - RM.descender);
    return { w, s, base: w * 0.1 + RM.ascender * s, ox: w * 0.15 };
  };
  function drawRedraw() {
    const { w, s, base, ox } = rmap();
    const c = fitCanvas(rcv, w, w);
    c.fillStyle = css('--ed-canvas') || '#fff';
    c.fillRect(0, 0, w, w);
    c.strokeStyle = css('--ed-guide') || '#ddd';
    for (const y of [0, RM.xHeight, RM.capHeight, RM.descender]) {
      c.beginPath();
      c.moveTo(0, base - y * s + 0.5);
      c.lineTo(w, base - y * s + 0.5);
      c.stroke();
    }
    if (!strokes.length && !live && S.sheet.cur) {
      c.fillStyle = css('--line-2') || '#ccc';
      c.font = `${Math.round(RM.capHeight * s * 1.05)}px Georgia, serif`;
      c.textAlign = 'center';
      c.fillText(S.sheet.cur, w / 2, base);
    }
    c.fillStyle = css('--ink') || '#222';
    for (const st of [...strokes, ...(live ? [live] : [])]) {
      for (const ct of outline(st)) {
        c.beginPath();
        tracePath(c, [ct], (x, y) => [ox + x * s, base - y * s]);
        c.fill('nonzero');
      }
    }
  }
  const outline = (st) => (st.length ? lib.strokeToOutline(st, (p) => 34 + 50 * (p.pressure ?? 0.6), { error: 1.5, smoothing: 2 }) : []);
  rcv.addEventListener('pointerdown', (e) => {
    rcv.setPointerCapture(e.pointerId);
    live = [toUnits(e)];
    drawRedraw();
  });
  rcv.addEventListener('pointermove', (e) => {
    if (!live) return;
    for (const ev of e.getCoalescedEvents ? e.getCoalescedEvents() : [e]) live.push(toUnits(ev));
    drawRedraw();
  });
  rcv.addEventListener('pointerup', () => {
    if (live) strokes.push(live);
    live = null;
    drawRedraw();
  });
  function toUnits(e) {
    const r = rcv.getBoundingClientRect();
    const { s, base, ox } = rmap();
    return { x: (e.clientX - r.left - ox) / s, y: (base - (e.clientY - r.top)) / s, pressure: e.pointerType === 'pen' ? e.pressure : 0.6 };
  }
  A.redrawCell = () => {
    if (!S.sheet.cur) return;
    strokes = [];
    dlg.showModal();
    requestAnimationFrame(drawRedraw);
  };
  A.redrawClear = () => {
    strokes = [];
    drawRedraw();
  };
  A.redrawClose = (use) => {
    dlg.close();
    if (!use || !strokes.length) return;
    let contours = strokes.flatMap(outline);
    try {
      contours = lib.removeOverlaps(contours);
    } catch {
      // overlapping strokes still render correctly
    }
    let xMin = Infinity, xMax = -Infinity;
    for (const ct of contours) for (const p of ct.points) {
      xMin = Math.min(xMin, p.x);
      xMax = Math.max(xMax, p.x);
    }
    const sb = 50;
    contours = contours.map((ct) => ({ ...ct, points: ct.points.map((p) => ({ ...p, x: Math.round(p.x - xMin + sb), y: Math.round(p.y) })) }));
    const ch = S.sheet.cur;
    const prev = cells.get(ch);
    cells.set(ch, { glyph: { ...(prev?.glyph || {}), char: ch, contours, advanceWidth: Math.round(xMax - xMin + sb * 2), confidence: 1, empty: false, warnings: [] }, skip: false, redrawn: true });
    refreshCells();
    selectCell(ch);
  };

  const prevPanel = ctx.onPanel;
  ctx.onPanel = (p) => {
    if (p === 'sheet' && !previewEl.children.length) requestAnimationFrame(A.sheetPreview);
    if (p !== 'sheet' && stream) A.stopCamera();
    prevPanel?.(p);
  };
  const prevTheme = ctx.onTheme;
  ctx.onTheme = () => {
    if (cells.size) refreshCells();
    prevTheme?.();
  };
  ctx.sheetState = () => ({ cells, results });
  void history;
}
