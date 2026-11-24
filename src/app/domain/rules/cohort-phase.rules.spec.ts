import { describePhase, resolveCohortPhase } from './cohort-phase.rules';

const cohort = {
  phase1StartDate: '2026-11-02',
  phase1EndDate: '2027-01-29',
  phase2StartDate: '2027-02-08',
  phase2EndDate: '2027-05-28',
} as const;

describe('resolveCohortPhase', () => {
  it('is UPCOMING before Phase 1', () => {
    expect(resolveCohortPhase(cohort, '2026-10-30')).toMatchObject({ kind: 'UPCOMING', daysToNextMilestone: 3 });
  });

  it('tracks Phase 1 weeks (inclusive boundaries)', () => {
    expect(resolveCohortPhase(cohort, '2026-11-02')).toMatchObject({ kind: 'PHASE_1', week: 1, totalWeeks: 13 });
    expect(resolveCohortPhase(cohort, '2026-11-23')).toMatchObject({ kind: 'PHASE_1', week: 4 });
    expect(resolveCohortPhase(cohort, '2027-01-29')).toMatchObject({ kind: 'PHASE_1', week: 13 });
  });

  it('is INTERMISSION between phases', () => {
    expect(resolveCohortPhase(cohort, '2027-02-01')).toMatchObject({ kind: 'INTERMISSION', daysToNextMilestone: 7 });
  });

  it('tracks Phase 2 and completion', () => {
    expect(resolveCohortPhase(cohort, '2027-02-08')).toMatchObject({ kind: 'PHASE_2', week: 1 });
    expect(resolveCohortPhase(cohort, '2027-05-29')).toMatchObject({ kind: 'COMPLETED', week: null });
  });

  it('describes phases for the UI', () => {
    expect(describePhase(resolveCohortPhase(cohort, '2026-11-23'))).toBe('Phase 1 · Wk 4/13');
    expect(describePhase(resolveCohortPhase(cohort, '2027-06-01'))).toBe('Completed');
  });
});
