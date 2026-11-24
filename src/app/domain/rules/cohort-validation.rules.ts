import type { Cohort, CohortDates, IsoDate } from '../models';
import { isIsoDate, monthOf, yearOf } from '../utils/date.util';

/** Returns human-readable issues; empty array means valid. */
export function validateCohortDates(dates: CohortDates): string[] {
  const issues: string[] = [];
  const fields = ['phase1StartDate', 'phase1EndDate', 'phase2StartDate', 'phase2EndDate'] as const;
  for (const f of fields) {
    if (!isIsoDate(dates[f])) issues.push(`${f} must be a valid YYYY-MM-DD date.`);
  }
  if (issues.length) return issues;

  if (dates.phase1EndDate < dates.phase1StartDate) issues.push('Phase 1 must end on or after it starts.');
  if (dates.phase2StartDate <= dates.phase1EndDate) issues.push('Phase 2 must start after Phase 1 ends.');
  if (dates.phase2EndDate < dates.phase2StartDate) issues.push('Phase 2 must end on or after it starts.');
  return issues;
}

/**
 * `code`, `year`, `month` are locked at creation, so a rescheduled Phase 1 start must stay
 * within the same calendar month the code was minted for.
 */
export function validateLockedIdentity(cohort: Pick<Cohort, 'year' | 'month' | 'code'>, phase1StartDate: IsoDate): string[] {
  if (!isIsoDate(phase1StartDate)) return [];
  return yearOf(phase1StartDate) === cohort.year && monthOf(phase1StartDate) === cohort.month
    ? []
    : [`Phase 1 must start in ${cohort.year}-${String(cohort.month).padStart(2, '0')} to keep cohort code ${cohort.code}.`];
}

export function validateDisplayName(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return ['Display name is required.'];
  if (trimmed.length > 60) return ['Display name must be 60 characters or fewer.'];
  return [];
}
