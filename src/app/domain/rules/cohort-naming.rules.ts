import type { Cohort, IsoDate } from '../models';
import { monthOf, yearOf } from '../utils/date.util';

export interface CohortIdentity {
  readonly code: string;
  readonly year: number;
  readonly month: number;
  readonly sequenceNumber: number;
  readonly defaultDisplayName: string;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** `YY-MM-SS`, e.g. (2026-11-02, 4) → `26-11-04`. */
export function buildCohortCode(phase1StartDate: IsoDate, sequenceNumber: number): string {
  if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1 || sequenceNumber > 99) {
    throw new RangeError(`sequenceNumber must be an integer 1-99, got ${sequenceNumber}`);
  }
  return `${pad2(yearOf(phase1StartDate) % 100)}-${pad2(monthOf(phase1StartDate))}-${pad2(sequenceNumber)}`;
}

export function defaultCohortDisplayName(code: string): string {
  return `Cohort - ${code}`;
}

/**
 * Next sequence for the calendar year of `phase1StartDate`.
 * Uses max+1 (not count+1) so archived/removed cohorts never cause a code collision.
 */
export function nextSequenceNumber(
  existing: readonly Pick<Cohort, 'year' | 'sequenceNumber'>[],
  phase1StartDate: IsoDate,
): number {
  const year = yearOf(phase1StartDate);
  const max = existing
    .filter((c) => c.year === year)
    .reduce((acc, c) => Math.max(acc, c.sequenceNumber), 0);
  return max + 1;
}

export function deriveCohortIdentity(
  existing: readonly Pick<Cohort, 'year' | 'sequenceNumber'>[],
  phase1StartDate: IsoDate,
): CohortIdentity {
  const sequenceNumber = nextSequenceNumber(existing, phase1StartDate);
  const code = buildCohortCode(phase1StartDate, sequenceNumber);
  return {
    code,
    year: yearOf(phase1StartDate),
    month: monthOf(phase1StartDate),
    sequenceNumber,
    defaultDisplayName: defaultCohortDisplayName(code),
  };
}
