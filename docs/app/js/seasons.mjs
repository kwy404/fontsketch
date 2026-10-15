// Special dates in the editor. The date rules live in the site's
// assets/site/seasons.js; the editor only needs its pick() function, not the
// page decorations that script adds (a chip, a garland and particles sized for
// the website), so the script is run with `document` hidden from it. The
// "off" choice is the same localStorage key the website uses, so turning a
// season off on one turns it off on both.

export const SEASON_NAMES = {
  newyear: 'New Year',
  carnival: 'Carnival',
  easter: 'Easter',
  valentine: "Valentine's",
  junina: 'Midsummer',
  halloween: 'Halloween',
  christmas: 'Christmas',
};

export const offKey = (id) => `fontsketch:season-off:${id}`;

/** Runs the site's seasons.js source without its DOM part and returns fsSeasons. */
export function readSeasonsScript(source, target = globalThis) {
  // seasons.js stops before touching the page when `document` is undefined.
  new Function('document', source)(undefined);
  return target.fsSeasons || null;
}

function read(storage, key) {
  try {
    return storage ? storage.getItem(key) : null;
  } catch {
    return null; // storage blocked
  }
}

/**
 * The season for this visit: { id, name, forced, on } or null.
 * `?season=off` gives null, `?season=<id>` forces one (always on), otherwise
 * the date decides and the shared off choice is respected.
 */
export function seasonState(fs, { search = '', date = new Date(), lang = 'en', storage = null } = {}) {
  const p = fs && fs.pick(search, date, lang);
  if (!p) return null;
  return { id: p.id, name: SEASON_NAMES[p.id] || p.id, forced: p.forced, on: p.forced || read(storage, offKey(p.id)) !== '1' };
}

/** Remembers the visitor's choice for a season, like the website chip does. */
export function rememberSeason(storage, id, on) {
  try {
    storage?.setItem(offKey(id), on ? '0' : '1');
  } catch {
    // private mode: the choice lasts for this visit only
  }
}

/** Art for a season, relative to docs/app/. */
export function seasonArt(id, base = '../assets/seasons/') {
  const dir = `${base}${id}/`;
  return { quill: `${dir}quill.svg`, quillDark: `${dir}quill-dark.svg`, accent: `${dir}accent.svg`, accentDark: `${dir}accent-dark.svg`, icon: `${dir}icon-1.svg`, iconDark: `${dir}icon-1-dark.svg` };
}

/** Loads the season and wires it to the app store: S.season = { id, name, on }. */
export async function installSeasons(ctx, { url = '../assets/site/seasons.js' } = {}) {
  const { S, A } = ctx;
  const html = document.documentElement;
  let state = null;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const fs = readSeasonsScript(await res.text(), window);
    state = seasonState(fs, { search: location.search, date: new Date(), lang: html.lang || navigator.language, storage: localStorage });
  } catch (e) {
    console.warn('seasons: not loaded', e);
    return;
  }
  if (!state) return;
  const art = seasonArt(state.id, new URL('../assets/seasons/', location.href).href);
  html.style.setProperty('--season-accent', `url("${art.accent}")`);
  html.style.setProperty('--season-accent-dark', `url("${art.accentDark}")`);
  html.style.setProperty('--season-quill', `url("${art.quill}")`);
  html.style.setProperty('--season-quill-dark', `url("${art.quillDark}")`);
  Object.assign(S.season, { id: state.id, name: state.name });
  const apply = (on) => {
    S.season.on = on;
    if (on) html.setAttribute('data-season', state.id);
    else html.removeAttribute('data-season');
  };
  apply(state.on);
  A.toggleSeason = () => {
    rememberSeason(localStorage, state.id, !S.season.on);
    apply(!S.season.on);
  };
}
