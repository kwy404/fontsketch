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

if (V) V.start();
