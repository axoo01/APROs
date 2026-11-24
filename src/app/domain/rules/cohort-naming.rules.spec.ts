import { buildCohortCode, defaultCohortDisplayName, deriveCohortIdentity, nextSequenceNumber } from './cohort-naming.rules';

describe('cohort naming', () => {
  it('builds YY-MM-SS codes', () => {
    expect(buildCohortCode('2026-11-02', 4)).toBe('26-11-04');
    expect(buildCohortCode('2030-01-15', 12)).toBe('30-01-12');
  });

  it('rejects out-of-range sequences', () => {
    expect(() => buildCohortCode('2026-11-02', 0)).toThrow(RangeError);
    expect(() => buildCohortCode('2026-11-02', 100)).toThrow(RangeError);
    expect(() => buildCohortCode('2026-11-02', 1.5)).toThrow(RangeError);
  });

  it('formats the default display name', () => {
    expect(defaultCohortDisplayName('26-11-04')).toBe('Cohort - 26-11-04');
  });

  it('sequences per calendar year of phase1StartDate using max + 1', () => {
    const existing = [
      { year: 2025, sequenceNumber: 5 },
      { year: 2026, sequenceNumber: 1 },
      { year: 2026, sequenceNumber: 3 }, // #2 archived/removed — must not collide
    ];
    expect(nextSequenceNumber(existing, '2026-11-02')).toBe(4);
    expect(nextSequenceNumber(existing, '2027-02-01')).toBe(1);
    expect(nextSequenceNumber([], '2026-01-05')).toBe(1);
  });

  it('derives the full immutable identity', () => {
    const id = deriveCohortIdentity(
      [
        { year: 2026, sequenceNumber: 1 },
        { year: 2026, sequenceNumber: 2 },
        { year: 2026, sequenceNumber: 3 },
      ],
      '2026-11-02',
    );
    expect(id).toEqual({
      code: '26-11-04',
      year: 2026,
      month: 11,
      sequenceNumber: 4,
      defaultDisplayName: 'Cohort - 26-11-04',
    });
  });
});
