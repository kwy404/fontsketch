// The editor's special dates (docs/app/js/seasons.mjs) run the site's
// seasons.js date rules and share the website's "off" choice.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { offKey, readSeasonsScript, rememberSeason, seasonArt, seasonState } from '../docs/app/js/seasons.mjs';

const fs = readSeasonsScript(readFileSync(new URL('../docs/assets/site/seasons.js', import.meta.url), 'utf8'));
const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

describe('editor seasons', () => {
  it('loads the date rules without touching a page', () => {
    expect(typeof fs.pick).toBe('function');
    expect(globalThis.document).toBeUndefined();
  });
  it('follows the date and has no season on an ordinary day', () => {
    expect(seasonState(fs, { date: new Date(2026, 9, 31) })).toMatchObject({ id: 'halloween', name: 'Halloween', on: true, forced: false });
    expect(seasonState(fs, { date: new Date(2026, 9, 15) })).toBeNull();
  });
  it('respects the shared off choice, unless the link forces a season', () => {
    const storage = memory();
    rememberSeason(storage, 'christmas', false);
    expect(storage.getItem(offKey('christmas'))).toBe('1');
    expect(seasonState(fs, { date: new Date(2026, 11, 24), storage }).on).toBe(false);
    expect(seasonState(fs, { search: '?season=christmas', date: new Date(2026, 5, 1), storage }).on).toBe(true);
    expect(seasonState(fs, { search: '?season=off', date: new Date(2026, 11, 24), storage })).toBeNull();
    rememberSeason(storage, 'christmas', true);
    expect(seasonState(fs, { date: new Date(2026, 11, 24), storage }).on).toBe(true);
  });
  it('survives blocked storage', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(() => rememberSeason(blocked, 'easter', false)).not.toThrow();
    expect(seasonState(fs, { search: '?season=easter', storage: blocked }).on).toBe(true);
  });
  it('points at art that exists', () => {
    for (const id of fs.IDS) {
      const art = seasonArt(id, new URL('../docs/assets/seasons/', import.meta.url).href);
      for (const url of Object.values(art)) expect(() => readFileSync(new URL(url)), url).not.toThrow();
    }
  });
});
