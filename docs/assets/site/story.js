// The story on the home page. It opens with the photo to font loop, which
// plays by itself while it is on screen. The other scenes are tall blocks
// with a sticky stage; their progress (0 to 1) is published as --p for the
// CSS, and the weight and hinting scenes redraw real outlines from Quill Hand.
import { expandStroke, strokesToContours, contoursToSvgPath } from './stroke.mjs';

const scenes = [...document.querySelectorAll('.scene')];
const R = document.body.dataset.root || '';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);
let data = null;
let loading = null;

function load() {
  if (!loading) loading = fetch(`${R}assets/fonts/quill-hand.strokes.json`).then((r) => r.json()).then((j) => { data = j; return j; });
  return loading;
}
const strokesOf = (g) => g.s.map((st) => (Array.isArray(st) ? { pts: st } : { pts: st.p, w: st.w }));
const glyphFor = (ch) => {
  for (const [n, g] of Object.entries(data.glyphs)) if (g.u.includes(ch.codePointAt(0))) return [n, g];
  return null;
};

// ---------- scene 1: the photo to font loop ----------
// Phases: 0 photo (with a shutter flash), 1 flatten, 2 split the boxes,
// 3 trace the letters, 4 type with the new font. Each phase adds a class
// (p0 to p4) and the CSS moves only transform and opacity.
function scanLoop(root) {
  const steps = [...root.querySelectorAll('.loop-steps li')];
  const typed = root.querySelector('.lv-typed');
  const btn = root.querySelector('[data-pause]');
  const nameInput = document.querySelector('#studio-app [data-sample]');
  const AT = [0, 1500, 2900, 4300, 6100];
  const timers = [];
  let visible = false;
  let paused = false;
  let running = false;
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clear = () => {
    while (timers.length) clearTimeout(timers.pop());
  };
  const mark = (k) => steps.forEach((li, j) => {
    li.classList.toggle('is-on', j <= k);
    li.classList.toggle('is-now', j === k);
  });
  if (reduce) {
    root.classList.add('is-static');
    mark(steps.length - 1);
    return;
  }
  function phase(k) {
    root.classList.add(`p${k}`);
    mark(k);
    if (k === 4) {
      const text = (nameInput?.value.trim() || typed.dataset.text).slice(0, 28);
      [...text].forEach((_, i) => later(() => {
        typed.textContent = [...text].slice(0, i + 1).join('');
      }, 120 + i * 95));
      later(() => {
        root.classList.add('is-resetting');
        later(cycle, 450);
      }, 120 + text.length * 95 + 2600);
    }
  }
  function cycle() {
    clear();
    root.className = 'scan-loop';
    typed.textContent = '';
    mark(0);
    void root.offsetWidth;
    AT.forEach((ms, k) => later(() => phase(k), ms + 60));
  }
  function play() {
    if (running || paused || !visible) return;
    running = true;
    cycle();
  }
  function stop() {
    running = false;
    clear();
    root.classList.remove('is-resetting');
  }
  btn?.addEventListener('click', () => {
    paused = !paused;
    btn.setAttribute('aria-pressed', String(paused));
    const label = paused ? btn.dataset.play : btn.dataset.pause;
    btn.setAttribute('aria-label', label);
    btn.title = label;
    root.classList.toggle('is-paused', paused);
    if (paused) {
      stop();
      root.className = 'scan-loop p0 p1 p2 p3 p4 is-paused';
      typed.textContent = (nameInput?.value.trim() || typed.dataset.text).slice(0, 28);
      mark(4);
    } else play();
  });
  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) play();
    else stop();
  }, { threshold: 0.25 }).observe(root);
}
const loop = document.getElementById('scan-loop');
if (loop) scanLoop(loop);

// ---------- scene 2: weight ----------
const WORD = document.documentElement.lang === 'pt-BR' ? 'Caligrafia' : 'Handwriting';
let lastWeight = -1;
function drawWeight(scene, p) {
  if (!data) return;
  const pen = 24 + p * 116;
  if (Math.abs(pen - lastWeight) < 0.6) return;
  lastWeight = pen;
  const g = scene.querySelector('.weight-word');
  const svg = scene.querySelector('.weight-svg');
  let x = 0;
  let h = '';
  for (const ch of WORD) {
    const hit = glyphFor(ch);
    if (!hit) continue;
    const [, gl] = hit;
    const d = contoursToSvgPath(strokesToContours(strokesOf(gl), { width: pen, swell: pen * 0.3, taper: 0.2 }));
    h += `<path transform="translate(${x.toFixed(1)} 0)" d="${d}"/>`;
    x += gl.adv + (pen - 66) * 0.6;
  }
  g.innerHTML = h;
  svg.setAttribute('viewBox', `-60 -900 ${Math.round(x + 160)} 1220`);
  const out = scene.querySelector('.axis-val');
  if (out) out.textContent = `wght ${Math.round(100 + p * 800)}`;
}

// ---------- scene 3: hinting ----------
let hintCache = null;
function drawHinting(scene, p) {
  if (!data) return;
  const canvas = scene.querySelector('.hint-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cols = 16, rows = 12, cell = W / cols;
  const t = ease(clamp((p - 0.15) / 0.6));
  if (!hintCache) {
    const n = data.glyphs.n;
    const slant = data.slant || 0;
    const upright = strokesOf(n).map((st) => ({ ...st, pts: st.pts.map(([x, y]) => [x - y * slant, y]) }));
    hintCache = { upright };
  }
  // unhinted: fractional placement and a stem a little wider than a pixel;
  // hinted: stems snapped to whole pixels and the x-height on a pixel line.
  const pen = 66 + (60 - 66) * t;
  const em = 16.6 + (16.67 - 16.6) * t;
  const s = em / 1000;
  const tx = 3.42 + (3.17 - 3.42) * t;
  const sx = 1 + 0.03 * t;
  const base = 9.35 + (9 - 9.35) * t;
  const d = contoursToSvgPath(strokesToContours(hintCache.upright, { width: pen, swell: 0, taper: 0 }));
  const path = new Path2D(d);
  const off = hintCache.off || (hintCache.off = new OffscreenCanvasOr(cols, rows));
  const octx = off.getContext('2d', { willReadFrequently: true });
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.clearRect(0, 0, cols, rows);
  octx.setTransform(s * sx, 0, 0, s, tx, base);
  octx.fillStyle = '#000';
  octx.fill(path);
  const img = octx.getImageData(0, 0, cols, rows).data;
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue('--ink').trim() || '#24216A';
  const card = css.getPropertyValue('--card').trim() || '#FFFDF6';
  const rule = css.getPropertyValue('--rule').trim() || '#D7D0EF';
  const ver = css.getPropertyValue('--ver-bright').trim() || '#E4472B';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = card;
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const a = img[(y * cols + x) * 4 + 3] / 255;
      if (a > 0.02) {
        ctx.globalAlpha = a;
        ctx.fillStyle = ink;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = rule;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= cols; x++) { ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, H); }
  for (let y = 0; y <= rows; y++) { ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(W, y * cell + 0.5); }
  ctx.stroke();
  ctx.setTransform(s * sx * cell, 0, 0, s * cell, tx * cell, base * cell);
  ctx.strokeStyle = ver;
  ctx.lineWidth = 2.5 / (s * cell);
  ctx.stroke(path);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  scene.querySelector('.hint-off')?.classList.toggle('is-on', t < 0.5);
  scene.querySelector('.hint-on')?.classList.toggle('is-on', t >= 0.5);
}
function OffscreenCanvasOr(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ---------- scene 4: kerning ----------
function setupKerning(scene) {
  if (!data) return;
  scene.querySelectorAll('.kern-pair').forEach((el) => {
    const [a, b] = el.dataset.pair;
    const na = glyphFor(a)?.[0], nb = glyphFor(b)?.[0];
    const v = data.kerning[`${na}|${nb}`] || 0;
    el.style.setProperty('--kern', `${v / 1000}em`);
    el.dataset.kern = String(v);
  });
}
function drawKerning(scene, p) {
  scene.querySelectorAll('.kern-pair').forEach((el) => {
    const k = Number(getComputedStyle(el).getPropertyValue('--k')) || 0;
    const kp = clamp(p * 2.4 - k * 0.3);
    const out = el.querySelector('.kp-val');
    if (out) out.textContent = `kern ${Math.round(Number(el.dataset.kern || 0) * kp)}`;
  });
}

// ---------- driver ----------
const updaters = { 2: drawWeight, 3: drawHinting, 4: drawKerning };
let ticking = false;
function update() {
  ticking = false;
  const vh = innerHeight;
  for (const scene of scenes) {
    const r = scene.getBoundingClientRect();
    if (r.bottom < -vh || r.top > vh * 1.5) continue;
    const p = reduce ? 1 : clamp(-r.top / Math.max(1, r.height - vh));
    scene.style.setProperty('--p', p.toFixed(4));
    updaters[scene.dataset.scene]?.(scene, p);
  }
}
function request() {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(update);
  }
}

if (scenes.length) {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      load().then(() => {
        const kern = scenes.find((s) => s.dataset.scene === '4');
        if (kern) setupKerning(kern);
        lastWeight = -1;
        update();
      });
      io.disconnect();
    }
  }, { rootMargin: '600px 0px' });
  scenes.forEach((s) => io.observe(s));
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', () => {
    lastWeight = -1;
    request();
  });
  new MutationObserver(() => {
    lastWeight = -1;
    request();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  update();
}
void expandStroke;
