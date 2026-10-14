// Test panel: compiles the font in the browser after every change and loads
// it with the FontFace API, so the tester shows the real TTF (kerning,
// spacing, variable weight) as an app or a website would.
import { P } from '../project.mjs';
import { SAMPLES } from '../charsets.mjs';

const WATERFALL = [12, 14, 16, 20, 24, 32, 40, 56, 72, 96];

export function installTest(ctx) {
  const { S, A, V, lib } = ctx;
  const out = document.getElementById('test-out');
  let face = null;
  let family = '';
  let builtRev = -1;
  let timer = 0;
  let building = false;

  /** Compiles the current font and registers it. Returns the family name. */
  async function build() {
    if (builtRev === P.rev && face) return family;
    if (building) return family;
    building = true;
    const rev = P.rev;
    try {
      const variable = S.variable.has;
      const bytes = await ctx.compile({ format: 'ttf', variable, hinting: 'none' });
      const name = `fsPreview${rev}x${Math.random().toString(36).slice(2, 6)}`;
      const ff = new FontFace(name, bytes, variable ? { weight: `${S.variable.min} ${S.variable.max}` } : {});
      await ff.load();
      document.fonts.add(ff);
      if (face) document.fonts.delete(face);
      face = ff;
      family = name;
      builtRev = rev;
      S.test.error = '';
      ctx.previewFamily = name;
      if (ctx.onPreviewFont) ctx.onPreviewFont(name);
    } catch (e) {
      S.test.error = `The preview could not be built: ${e.message}`;
      console.warn(e);
    } finally {
      building = false;
    }
    if (builtRev !== P.rev) schedule();
    return family;
  }
  ctx.buildPreview = build;

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (S.panel !== 'test') return;
      await build();
      render();
    }, 350);
  }

  function style(el, size) {
    el.style.fontFamily = `"${family}", "Adobe NotDef", serif`;
    el.style.fontSize = `${size}px`;
    el.style.lineHeight = String(S.test.lh / 100);
    el.style.letterSpacing = `${S.test.ls / 1000}em`;
    el.style.fontKerning = 'normal';
    el.style.fontVariationSettings = S.variable.has ? `"wght" ${S.test.weight}` : 'normal';
    el.style.fontWeight = S.variable.has ? String(S.test.weight) : '';
  }

  function render() {
    if (!family) return;
    out.replaceChildren();
    const text = S.test.text || SAMPLES.pangram;
    if (S.test.mode === 'waterfall') {
      for (const size of WATERFALL) {
        const row = document.createElement('div');
        row.className = 'wf';
        const label = document.createElement('small');
        label.textContent = `${size}px`;
        const span = document.createElement('span');
        span.textContent = text.split('\n')[0];
        style(span, size);
        row.append(label, span);
        out.append(row);
      }
    } else if (S.test.mode === 'paragraph') {
      const h = document.createElement('h4');
      h.textContent = text.split('\n')[0].slice(0, 60);
      style(h, Math.min(64, S.test.size * 1.4));
      out.append(h);
      for (const para of [SAMPLES.paragraph, `${text} ${SAMPLES.paragraph.split('. ').slice(1).join('. ')}`]) {
        const p = document.createElement('p');
        p.textContent = para;
        style(p, Math.min(28, Math.max(12, S.test.size / 3)));
        out.append(p);
      }
    } else {
      const div = document.createElement('div');
      div.textContent = text;
      div.contentEditable = 'plaintext-only';
      div.spellcheck = false;
      div.setAttribute('aria-label', 'Preview text, editable');
      div.addEventListener('input', () => {
        S.test.text = div.textContent;
      });
      style(div, S.test.size);
      out.append(div);
    }
  }

  A.sample = (k) => {
    S.test.text = SAMPLES[k] || SAMPLES.pangram;
    if (k === 'paragraph') S.test.mode = 'paragraph';
  };

  // Re-render on any tester setting; rebuild on font changes.
  V.effect(() => {
    void [S.test.mode, S.test.size, S.test.lh, S.test.ls, S.test.weight, S.test.dark];
    const t = S.test.text;
    if (S.panel !== 'test' || !family) return;
    // Typing in the editable line should not reset the caret.
    const editable = out.querySelector('[contenteditable]');
    if (editable && document.activeElement === editable && editable.textContent === t) {
      style(editable, S.test.size);
      return;
    }
    render();
  });

  const prevPanel = ctx.onPanel;
  ctx.onPanel = (p) => {
    if (p === 'test') {
      if (!S.wide && !matchMedia('(max-width: 899px)').matches) S.wide = false;
      build().then(render);
    }
    prevPanel?.(p);
  };
  const prevChanged = ctx.onChanged;
  ctx.onChanged = (kind, glyphs) => {
    if (S.panel === 'test') schedule();
    prevChanged?.(kind, glyphs);
  };
  const prevSync = ctx.onFontSync;
  ctx.onFontSync = () => {
    if (S.variable.has && (S.test.weight < S.variable.min || S.test.weight > S.variable.max)) S.test.weight = S.variable.def;
    prevSync?.();
  };
  void lib;
}
