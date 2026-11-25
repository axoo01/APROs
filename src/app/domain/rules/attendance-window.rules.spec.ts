import { nextWorkingDay, previousWorkingDay, priorLogWindow, resolveLogWindow } from './attendance-window.rules';

const calendar = { nonWorkingDays: ['2026-11-20'] as const }; // Fri 20 Nov holiday
const TODAY = '2026-11-25'; // Wed

describe('attendance log windows', () => {
  it('resolves presets relative to today', () => {
    expect(resolveLogWindow('THIS_WEEK', TODAY, TODAY)).toEqual({ start: '2026-11-23', end: TODAY });
    expect(resolveLogWindow('LAST_WEEK', TODAY, TODAY)).toEqual({ start: '2026-11-16', end: '2026-11-20' });
    expect(resolveLogWindow('LAST_30_DAYS', TODAY, TODAY)).toEqual({ start: '2026-10-27', end: TODAY });
    expect(resolveLogWindow('DAY', TODAY, '2026-11-18')).toEqual({ start: '2026-11-18', end: '2026-11-18' });
  });

  it('compares against the immediately preceding period of the same shape', () => {
    const thisWeek = resolveLogWindow('THIS_WEEK', TODAY, TODAY);
    expect(priorLogWindow('THIS_WEEK', thisWeek, calendar)).toEqual({ start: '2026-11-16', end: '2026-11-18' });
    expect(priorLogWindow('DAY', { start: '2026-11-23', end: '2026-11-23' }, calendar)).toEqual({
      start: '2026-11-19',
      end: '2026-11-19',
    });
  });

  it('skips weekends and holidays when stepping back a working day', () => {
    expect(previousWorkingDay(calendar, '2026-11-23')).toBe('2026-11-19');
    expect(nextWorkingDay(calendar, '2026-11-19')).toBe('2026-11-23');
  });
});
