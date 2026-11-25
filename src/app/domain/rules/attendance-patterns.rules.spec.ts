import type { AttendanceStatus, IsoDate } from '../models';
import { absenceStreak, isNotablePattern, latesThisWeek } from './attendance-patterns.rules';

const calendar = { nonWorkingDays: ['2026-11-20'] as IsoDate[] }; // Fri 20 Nov is a holiday
const marks = (entries: Record<IsoDate, AttendanceStatus>) => new Map(Object.entries(entries));

// Wed 25 Nov 2026
const TODAY = '2026-11-25';

describe('attendance patterns', () => {
  it('counts consecutive absences back over working days, skipping weekends and holidays', () => {
    // Tue 24 A, Mon 23 A, (weekend), (Fri 20 holiday), Thu 19 A, Wed 18 P
    const m = marks({ '2026-11-24': 'A', '2026-11-23': 'A', '2026-11-19': 'A', '2026-11-18': 'P' });
    expect(absenceStreak(m, TODAY, calendar)).toBe(3);
  });

  it('includes today only when already marked absent', () => {
    const m = marks({ '2026-11-24': 'A', '2026-11-23': 'A' });
    expect(absenceStreak(m, TODAY, calendar)).toBe(2);
    expect(absenceStreak(new Map([...m, [TODAY, 'A']]), TODAY, calendar)).toBe(3);
    expect(absenceStreak(new Map([...m, [TODAY, 'P']]), TODAY, calendar)).toBe(0);
  });

  it('treats E as neutral and a missing record as a break', () => {
    expect(absenceStreak(marks({ '2026-11-24': 'A', '2026-11-23': 'E', '2026-11-19': 'A' }), TODAY, calendar)).toBe(2);
    expect(absenceStreak(marks({ '2026-11-24': 'A', '2026-11-19': 'A' }), TODAY, calendar)).toBe(1);
  });

  it('counts lates from Monday through today only', () => {
    const m = marks({ '2026-11-20': 'L', '2026-11-23': 'L', '2026-11-25': 'L', '2026-11-26': 'L' });
    expect(latesThisWeek(m, TODAY)).toBe(2);
  });

  it('flags patterns at the thresholds', () => {
    expect(isNotablePattern({ absenceStreak: 2, latesThisWeek: 0 })).toBe(true);
    expect(isNotablePattern({ absenceStreak: 1, latesThisWeek: 2 })).toBe(true);
    expect(isNotablePattern({ absenceStreak: 1, latesThisWeek: 1 })).toBe(false);
  });
});
