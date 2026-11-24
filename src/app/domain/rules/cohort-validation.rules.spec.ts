import type { CohortDates, IsoDate } from '../models';
import { validateCohortDates, validateDisplayName, validateLockedIdentity } from './cohort-validation.rules';

const valid: CohortDates = {
  phase1StartDate: '2026-11-02',
  phase1EndDate: '2027-01-29',
  phase2StartDate: '2027-02-08',
  phase2EndDate: '2027-05-28',
};

describe('cohort validation', () => {
  it('accepts a well-ordered timeline', () => {
    expect(validateCohortDates(valid)).toEqual([]);
  });

  it('rejects invalid dates', () => {
    expect(validateCohortDates({ ...valid, phase1StartDate: '2026-02-30' as IsoDate })).toHaveLength(1);
  });

  it('rejects overlapping or inverted phases', () => {
    expect(validateCohortDates({ ...valid, phase1EndDate: '2026-11-01' })).toContain('Phase 1 must end on or after it starts.');
    expect(validateCohortDates({ ...valid, phase2StartDate: '2027-01-29' })).toContain('Phase 2 must start after Phase 1 ends.');
    expect(validateCohortDates({ ...valid, phase2EndDate: '2027-02-07' })).toContain('Phase 2 must end on or after it starts.');
  });

  it('keeps Phase 1 start within the locked code month', () => {
    const locked = { year: 2026, month: 11, code: '26-11-04' };
    expect(validateLockedIdentity(locked, '2026-11-09')).toEqual([]);
    expect(validateLockedIdentity(locked, '2026-12-01')).toHaveLength(1);
  });

  it('validates display names', () => {
    expect(validateDisplayName('Cohort - 26-11-04')).toEqual([]);
    expect(validateDisplayName('   ')).toHaveLength(1);
    expect(validateDisplayName('x'.repeat(61))).toHaveLength(1);
  });
});
