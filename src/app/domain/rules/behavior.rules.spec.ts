import { cohortWeeks, currentCohortWeek, isFlaggedRating, phaseOneWeeks, isStandardBehaviorNote, isUrgentRating, normalizeBehaviorInput } from './behavior.rules';
import { BEHAVIOR_DEFINITIONS } from '../models';

describe('behavior rules', () => {
  it('lists cohort weeks from the start week to the current week', () => {
    const weeks = cohortWeeks({ phase1StartDate: '2026-11-02' }, '2026-11-25');
    expect(weeks.map((w) => [w.number, w.start, w.end])).toEqual([
      [1, '2026-11-02', '2026-11-06'],
      [2, '2026-11-09', '2026-11-13'],
      [3, '2026-11-16', '2026-11-20'],
      [4, '2026-11-23', '2026-11-27'],
    ]);
  });

  it('lists all Phase 1 weeks and finds the current one', () => {
    const weeks = phaseOneWeeks({ phase1StartDate: '2026-11-02', phase1EndDate: '2027-01-29' });
    expect(weeks).toHaveLength(13);
    expect(weeks.at(-1)).toEqual({ number: 13, start: '2027-01-25', end: '2027-01-29' });
    expect(currentCohortWeek(weeks, '2026-11-25')?.number).toBe(4);
    expect(currentCohortWeek(weeks, '2027-03-01')?.number).toBe(13);
  });

  it('requires a Monday week start and a known rating', () => {
    expect(normalizeBehaviorInput({ apprenticeId: 'a', weekStart: '2026-11-23', rating: '+M', note: '  ok ' })).toEqual({
      ok: true,
      value: { rating: '+M', note: 'ok' },
    });
    expect(normalizeBehaviorInput({ apprenticeId: 'a', weekStart: '2026-11-24', rating: '+M' }).ok).toBe(false);
  });

  it('classifies tiers and standard notes', () => {
    expect(isFlaggedRating('-H')).toBe(true);
    expect(isUrgentRating('-L')).toBe(true);
    expect(isUrgentRating('-M')).toBe(false);
    expect(isStandardBehaviorNote(BEHAVIOR_DEFINITIONS['+H'])).toBe(true);
    expect(isStandardBehaviorNote('Led the demo')).toBe(false);
    expect(isStandardBehaviorNote(null)).toBe(true);
  });
});
