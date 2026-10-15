// Special dates. Sets data-season on <html> from the visitor's local date;
// ?season=<id> forces one and ?season=off turns it off. site.css and
// season-fx.js react to the attribute. A chip lets the visitor switch the
// theme off, remembered per season.
(function (g) {
  var IDS = ['newyear', 'carnival', 'easter', 'valentine', 'junina', 'halloween', 'christmas'];
  var DAY = 864e5;
  // Easter Sunday as a day number (anonymous Gregorian algorithm).
  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var h = (19 * a + b - d - Math.floor((b - f + 1) / 3) + 15) % 30, l = (32 + 2 * e + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451), n = h + l - 7 * m + 114;
    return Date.UTC(y, Math.floor(n / 31) - 1, (n % 31) + 1) / DAY;
  }
  function seasonFor(date, lang) {
    var y = date.getFullYear(), md = (date.getMonth() + 1) * 100 + date.getDate();
    var n = Date.UTC(y, date.getMonth(), date.getDate()) / DAY, e = easter(y), br = /^pt-br/i.test(lang || '');
    if (md >= 1230 || md <= 102) return 'newyear';
    if (md === 214 || (br && md === 612)) return 'valentine';
    if (n >= e - 50 && n <= e - 46) return 'carnival';
    if (n >= e - 2 && n <= e) return 'easter';
    if (md >= 613 && md <= 629) return 'junina';
    if (md >= 1024 && md <= 1031) return 'halloween';
    if (md >= 1218 && md <= 1226) return 'christmas';
    return null;
  }
  function pick(search, date, lang) {
    var q = /[?&]season=([a-z]+)/.exec(search || '');
    if (q && q[1] === 'off') return null;
    if (q && IDS.indexOf(q[1]) >= 0) return { id: q[1], forced: true };
    var id = seasonFor(date, lang);
    return id ? { id: id, forced: false } : null;
  }
  g.fsSeasons = { IDS: IDS, easter: easter, seasonFor: seasonFor, pick: pick };
  if (typeof document === 'undefined') return;

  var html = document.documentElement, pt = /^pt/i.test(html.lang);
  var p = pick(location.search, new Date(), html.lang || navigator.language);
  if (!p) return;
  var id = p.id, base = document.currentScript.src.replace(/assets\/site\/seasons\.js.*$/, '') + 'assets/seasons/' + id + '/';
  var NAMES = pt ? ['Ano Novo', 'Carnaval', 'Páscoa', 'Dia dos Namorados', 'Festa Junina', 'Halloween', 'Natal'] : ['New Year', 'Carnival', 'Easter', "Valentine's", 'Midsummer', 'Halloween', 'Christmas'];
  var name = NAMES[IDS.indexOf(id)], KEY = 'fontsketch:season-off:' + id, on = true, stop = null;
  function store(v) {
    try {
      return v == null ? localStorage.getItem(KEY) : localStorage.setItem(KEY, v);
    } catch (e) {
      return null; // storage blocked
    }
  }
  on = p.forced || store() !== '1';
  ['quill', 'accent'].forEach(function (k) {
    html.style.setProperty('--season-' + k, 'url("' + base + k + '.svg")');
    html.style.setProperty('--season-' + k + '-dark', 'url("' + base + k + '-dark.svg")');
  });
  function set(v) {
    on = v;
    if (v) html.setAttribute('data-season', id); else html.removeAttribute('data-season');
    document.querySelectorAll('img[data-season-src]').forEach(function (img) {
      var s = img.getAttribute('data-season-src');
      if ((img.getAttribute('src').indexOf('/seasons/') >= 0) === v) return;
      img.setAttribute('data-season-src', img.getAttribute('src'));
      img.setAttribute('src', s);
    });
    var sw = document.querySelector('.season-chip [role=switch]');
    if (sw) sw.setAttribute('aria-checked', String(v));
    if (stop) { stop(); stop = null; }
    if (v && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      import(base.replace(/seasons\/[a-z]+\/$/, 'site/season-fx.js')).then(function (m) { if (on) stop = m.start(id); }).catch(function () {});
    }
  }
  if (on) html.setAttribute('data-season', id);
  document.addEventListener('DOMContentLoaded', function () {
    var host = document.querySelector('.hero') || document.querySelector('main');
    if (host) {
      host.classList.add('season-host');
      host.insertAdjacentHTML('afterbegin', '<div class="season-accent" aria-hidden="true"></div>');
    }
    var hero = document.querySelector('.hero');
    if (hero) hero.insertAdjacentHTML('afterbegin', '<span class="season-quill" aria-hidden="true"></span>');
    document.querySelectorAll('img[src$="art/quill.svg"], img[src$="art/quill-dark.svg"], img[src$="art/quill-head.svg"]').forEach(function (img) {
      img.setAttribute('data-season-src', base + (/dark/.test(img.src) ? 'quill-dark.svg' : 'quill.svg'));
    });
    var chip = document.createElement('div');
    chip.className = 'season-chip';
    chip.innerHTML = '<img src="' + base + 'icon-1.svg" class="sc-l" width="22" height="22" alt=""><img src="' + base + 'icon-1-dark.svg" class="sc-d" width="22" height="22" alt=""><span>' + (pt ? 'Modo ' + name : name + ' mode') + '</span><button type="button" role="switch" aria-checked="' + on + '" aria-label="' + (pt ? 'Tema de ' : 'Theme for ') + name + '"><i></i></button>';
    chip.querySelector('button').addEventListener('click', function () {
      store(on ? '1' : '0');
      set(!on);
    });
    document.body.appendChild(chip);
    set(on);
  });
})(typeof window !== 'undefined' ? window : globalThis);
