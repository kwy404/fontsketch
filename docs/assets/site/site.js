// Shared behavior of the fontsketch site, built with Voodoo.js
// (https://kwy404.github.io/Voodoo.js/). Voodoo is loaded with data-manual:
// this module adds a few helpers and then calls V.start(). Pages declare
// their behavior in HTML (v-data, v-model, @click, :class, v-text,
// v-copy-from and v-theme-toggle). The studio and the scroll story live in
// their own modules.

const V = window.V;

// Close open download menus when clicking elsewhere or pressing Escape.
document.addEventListener('click', (e) => {
  document.querySelectorAll('details.dl[open]').forEach((d) => {
    if (!d.contains(e.target)) d.removeAttribute('open');
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('details.dl[open]').forEach((d) => {
    d.removeAttribute('open');
    d.querySelector('summary')?.focus();
  });
});

// Copy buttons: a short confirmation on the button itself.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.frame-copy');
  if (!btn) return;
  const label = btn.querySelector('span');
  if (!label) return;
  const before = label.textContent;
  label.textContent = document.documentElement.lang === 'pt-BR' ? 'Copiado' : 'Copied';
  setTimeout(() => {
    label.textContent = before;
  }, 1400);
});

// Close the mobile menu after following an in-page link.
document.addEventListener('click', (e) => {
  const a = e.target.closest('.topnav a[href^="#"], .topnav a[href*="/#"]');
  if (!a) return;
  const nav = document.getElementById('topnav');
  if (nav?.classList.contains('is-open')) document.querySelector('.nav-btn')?.click();
});

// Sections rise in as they scroll into view. Only transform and opacity
// move, nothing hides without JavaScript, and reduced motion skips it all.
const RISE = '.band h2, .band .lede, .way, .features li, .font-card, .gcard, .faq details, .loop-vis, .scene-text, .cta-in, .prose > h2, .steps li';
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      e.target.classList.add('is-in');
      setTimeout(() => e.target.classList.remove('rv', 'is-in'), 1400);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  const items = [...document.querySelectorAll(RISE)].filter((el) => el.getBoundingClientRect().top > innerHeight);
  document.documentElement.classList.add('js-motion');
  for (const el of items) {
    const sibs = [...el.parentElement.children].filter((c) => c.matches(RISE));
    el.style.setProperty('--rd', `${Math.min(sibs.indexOf(el), 7) * 70}ms`);
    el.classList.add('rv');
    io.observe(el);
  }
}

if (V) V.start();
