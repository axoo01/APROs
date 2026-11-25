import {
  BEHAVIOR_DEFINITIONS,
  BEHAVIOR_RATINGS,
  type BehaviorMark,
  type BehaviorRating,
  type Cohort,
  type IsoDate,
  type UpsertBehaviorInput,
} from '../models';
import { addDays, isIsoDate, startOfWeek } from '../utils/date.util';
import { NOTE_MAX_LENGTH } from './attendance-validation.rules';

export const isPositiveRating = (r: BehaviorRating | null | undefined): boolean => !!r && r.startsWith('+');
export const isFlaggedRating = (r: BehaviorRating | null | undefined): boolean => !!r && r.startsWith('-');
/** `-L` = needs urgent attention. */
export const isUrgentRating = (r: BehaviorRating | null | undefined): boolean => r === '-L';

const STANDARD_NOTES: ReadonlySet<string> = new Set(Object.values(BEHAVIOR_DEFINITIONS));
/** True when a note is empty or one of the standard definitions (i.e. safe to replace with another definition). */
export function isStandardBehaviorNote(note: string | null | undefined): boolean {
  return !note?.trim() || STANDARD_NOTES.has(note.trim());
}

/** Validates and normalizes a behavior write: known rating, Monday week start, trimmed note. */
export function normalizeBehaviorInput(
  input: UpsertBehaviorInput,
): { ok: true; value: BehaviorMark } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (!isIsoDate(input.weekStart)) issues.push('Week start must be a valid YYYY-MM-DD date.');
  else if (startOfWeek(input.weekStart) !== input.weekStart) issues.push('Week start must be a Monday.');
  if (!BEHAVIOR_RATINGS.includes(input.rating)) issues.push(`Unknown rating "${input.rating}".`);
  const note = input.note?.trim() || null;
  if (note && note.length > NOTE_MAX_LENGTH) issues.push(`Note must be ${NOTE_MAX_LENGTH} characters or fewer.`);
  return issues.length ? { ok: false, issues } : { ok: true, value: { rating: input.rating, note } };
}

export interface CohortWeek {
  /** 1-based cohort week number. */
  readonly number: number;
  /** Monday. */
  readonly start: IsoDate;
  /** Friday. */
  readonly end: IsoDate;
}

/** Cohort weeks from the Phase 1 start week through the week containing `until` (oldest first). */
export function cohortWeeks(cohort: Pick<Cohort, 'phase1StartDate'>, until: IsoDate): CohortWeek[] {
  const weeks: CohortWeek[] = [];
  const last = startOfWeek(until);
  for (let start = startOfWeek(cohort.phase1StartDate), n = 1; start <= last; start = addDays(start, 7), n++) {
    weeks.push({ number: n, start, end: addDays(start, 4) });
  }
  return weeks;
}

/** Every Phase 1 week (e.g. Week 1 → Week 13), whether past, current or upcoming. */
export function phaseOneWeeks(cohort: Pick<Cohort, 'phase1StartDate' | 'phase1EndDate'>): CohortWeek[] {
  return cohortWeeks(cohort, cohort.phase1EndDate);
}

/** The week containing `today`, clamped to the first/last week when outside the range. */
export function currentCohortWeek(weeks: readonly CohortWeek[], today: IsoDate): CohortWeek | null {
  const monday = startOfWeek(today);
  const first = weeks[0];
  const last = weeks.at(-1);
  if (!first || !last) return null;
  if (monday < first.start) return first;
  if (monday > last.start) return last;
  return weeks.find((w) => w.start === monday) ?? null;
}
