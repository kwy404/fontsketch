// Date logic of the special dates script (scripts/site/seasons.js), run in a
// sandbox without a document so only the pure functions load.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const sandbox = {};
runInNewContext(readFileSync(new URL('../scripts/site/seasons.js', import.meta.url), 'utf8'), sandbox);
const { easter, seasonFor, pick, IDS } = sandbox.fsSeasons;
const day = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
const iso = (n) => new Date(n * 864e5).toISOString().slice(0, 10);

describe('special dates', () => {
  it('computes Easter Sunday for 2024 to 2030', () => {
    const known = { 2024: '2024-03-31', 2025: '2025-04-20', 2026: '2026-04-05', 2027: '2027-03-28', 2028: '2028-04-16', 2029: '2029-04-01', 2030: '2030-04-21' };
    for (const [y, d] of Object.entries(known)) expect(iso(easter(Number(y)))).toBe(d);
  });

  it.each([
    ['2026-12-29', null], ['2026-12-30', 'newyear'], ['2027-01-01', 'newyear'], ['2027-01-02', 'newyear'], ['2027-01-03', null],
    ['2026-02-13', null], ['2026-02-15', 'carnival'], ['2026-02-14', 'valentine'], ['2026-02-17', 'carnival'], ['2026-02-18', 'carnival'], ['2026-02-19', null], ['2026-02-12', null],
    ['2027-02-06', 'carnival'], ['2027-02-10', 'carnival'], ['2027-02-05', null], ['2027-02-11', null],
    ['2026-04-02', null], ['2026-04-03', 'easter'], ['2026-04-05', 'easter'], ['2026-04-06', null],
    ['2026-06-12', null], ['2026-06-13', 'junina'], ['2026-06-29', 'junina'], ['2026-06-30', null],
    ['2026-10-23', null], ['2026-10-24', 'halloween'], ['2026-10-31', 'halloween'], ['2026-11-01', null],
    ['2026-12-17', null], ['2026-12-18', 'christmas'], ['2026-12-26', 'christmas'], ['2026-12-27', null],
  ])('%s is %s in English', (date, id) => {
    expect(seasonFor(day(date), 'en')).toBe(id);
  });

  it('adds the Brazilian Valentine date for pt-BR only', () => {
    expect(seasonFor(day('2026-06-12'), 'pt-BR')).toBe('valentine');
    expect(seasonFor(day('2026-06-12'), 'pt-PT')).toBe(null);
    expect(seasonFor(day('2026-06-12'), 'en')).toBe(null);
    expect(seasonFor(day('2026-06-13'), 'pt-BR')).toBe('junina');
    expect(seasonFor(day('2026-02-14'), 'pt-BR')).toBe('valentine');
  });

  it('lets the query string force or disable a season', () => {
    const quiet = day('2026-03-10');
    expect(pick('', quiet, 'en')).toBe(null);
    for (const id of IDS) expect(pick(`?season=${id}`, quiet, 'en')).toEqual({ id, forced: true });
    expect(pick('?season=off', day('2026-10-31'), 'en')).toBe(null);
    expect(pick('?a=1&season=christmas', quiet, 'en')).toEqual({ id: 'christmas', forced: true });
    expect(pick('?season=unknown', day('2026-10-31'), 'en')).toEqual({ id: 'halloween', forced: false });
  });
});
