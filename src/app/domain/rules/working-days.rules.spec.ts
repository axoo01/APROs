import { checkAttendanceDate, isWorkingDay, nonWorkingReason, workingDaysBetween } from './working-days.rules';

const cohort = { nonWorkingDays: ['2026-12-04', '2026-12-25'] as const };

describe('working days', () => {
  it('classifies weekends and holidays', () => {
    expect(nonWorkingReason(cohort, '2026-11-21')).toBe('WEEKEND');
    expect(nonWorkingReason(cohort, '2026-12-04')).toBe('HOLIDAY');
    expect(nonWorkingReason(cohort, '2026-11-23')).toBeNull();
    expect(isWorkingDay(cohort, '2026-11-23')).toBe(true);
  });

  it('lists working days in a range', () => {
    expect(workingDaysBetween(cohort, '2026-11-30', '2026-12-06')).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
    ]);
  });

  it('blocks non-working days in production', () => {
    expect(checkAttendanceDate(cohort, '2026-11-21', { demoMode: false })).toEqual({ allowed: false, reason: 'WEEKEND' });
    expect(checkAttendanceDate(cohort, '2026-11-23', { demoMode: false })).toEqual({ allowed: true, warning: null });
  });

  it('never blocks in Demo Mode, but warns', () => {
    expect(checkAttendanceDate(cohort, '2026-12-25', { demoMode: true })).toEqual({ allowed: true, warning: 'HOLIDAY' });
  });
});
