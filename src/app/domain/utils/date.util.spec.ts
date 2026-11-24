import type { IsoDate } from '../models';
import { addDays, dayOfWeek, diffDays, eachDay, isIsoDate, isWeekend, startOfWeek, toIsoDate } from './date.util';

describe('dates', () => {
  it('validates real calendar dates only', () => {
    expect(isIsoDate('2026-11-23')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('26-11-23')).toBe(false);
  });

  it('formats the local calendar date', () => {
    expect(toIsoDate(new Date(2026, 10, 23, 23, 59))).toBe('2026-11-23');
    expect(toIsoDate(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('diffs whole days', () => {
    expect(diffDays('2026-11-02', '2026-11-23')).toBe(21);
    expect(diffDays('2026-11-23', '2026-11-02')).toBe(-21);
  });

  it('knows weekdays and weekends', () => {
    expect(dayOfWeek('2026-11-23')).toBe(1); // Monday
    expect(isWeekend('2026-11-21')).toBe(true);
    expect(isWeekend('2026-11-22')).toBe(true);
    expect(isWeekend('2026-11-23')).toBe(false);
  });

  it('iterates inclusive ranges', () => {
    expect(eachDay('2026-11-29', '2026-12-01')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01']);
    expect(eachDay('2026-12-01', '2026-11-30')).toEqual([]);
  });

  it('finds the Monday of the week', () => {
    const cases: [IsoDate, IsoDate][] = [
      ['2026-11-23', '2026-11-23'],
      ['2026-11-26', '2026-11-23'],
      ['2026-11-29', '2026-11-23'],
    ];
    for (const [input, monday] of cases) expect(startOfWeek(input)).toBe(monday);
  });

  it('rejects malformed input in arithmetic', () => {
    expect(() => addDays('2026-02-30' as IsoDate, 1)).toThrow(RangeError);
  });
});
