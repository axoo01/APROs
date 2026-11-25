import type { EodStatus, IsoDate } from '../models';
import { behindStreak, longestBehindRun, normalizeEodInput, onPaceRate, tallyEod } from './eod.rules';

const calendar = { nonWorkingDays: ['2026-11-20'] as const };
const TODAY = '2026-11-25'; // Wed
const marks = (e: Record<IsoDate, EodStatus>) => new Map(Object.entries(e));

describe('EOD rules', () => {
  it('counts consecutive behind days over working days, ending today', () => {
    // Tue NS, Mon BLOCKED, (weekend + Fri holiday), Thu NS, Wed ON_PACE
    const m = marks({ '2026-11-24': 'NEEDS_SUPPORT', '2026-11-23': 'BLOCKED', '2026-11-19': 'NEEDS_SUPPORT', '2026-11-18': 'ON_PACE' });
    expect(behindStreak(m, TODAY, calendar)).toBe(3);
    expect(behindStreak(new Map([...m, [TODAY, 'BLOCKED']]), TODAY, calendar)).toBe(4);
    expect(behindStreak(new Map([...m, [TODAY, 'ON_PACE']]), TODAY, calendar)).toBe(0);
  });

  it('treats an unrated past working day as a break', () => {
    expect(behindStreak(marks({ '2026-11-24': 'BLOCKED', '2026-11-19': 'BLOCKED' }), TODAY, calendar)).toBe(1);
  });

  it('normalizes notes and rejects unknown values', () => {
    const ok = normalizeEodInput({ apprenticeId: 'a', date: TODAY, status: 'ON_PACE', note: '  shipped PR  ' });
    expect(ok).toEqual({ ok: true, value: { status: 'ON_PACE', tag: null, note: 'shipped PR' } });
    expect(normalizeEodInput({ apprenticeId: 'a', date: TODAY, status: 'NOPE' as EodStatus }).ok).toBe(false);
  });

  it('tallies statuses and the on-pace rate', () => {
    const t = tallyEod([{ status: 'ON_PACE' }, { status: 'ON_PACE' }, { status: 'BLOCKED' }, { status: 'NEEDS_SUPPORT' }]);
    expect(t).toEqual({ ON_PACE: 2, NEEDS_SUPPORT: 1, BLOCKED: 1, total: 4 });
    expect(onPaceRate(t)).toBe(0.5);
    expect(onPaceRate(tallyEod([]))).toBe(1);
  });

  it('finds the longest consecutive behind run in a window', () => {
    expect(longestBehindRun(['ON_PACE', 'BLOCKED', 'NEEDS_SUPPORT', 'ON_PACE', 'BLOCKED'])).toBe(2);
    expect(longestBehindRun(['BLOCKED', null, 'BLOCKED'])).toBe(1);
    expect(longestBehindRun([])).toBe(0);
  });
});
