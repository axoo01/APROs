import type { AttendanceStatus, Cohort, IsoDate } from '../models';
import { addDays, startOfWeek } from '../utils/date.util';
import { isWorkingDay } from './working-days.rules';

/**
 * One apprentice's marks keyed by date (a `Map` works). A missing date = no record.
 * Only `get` is required so callers can overlay today's live mark without copying history.
 */
export type MarksByDate = Pick<ReadonlyMap<IsoDate, AttendanceStatus>, 'get'>;

type WorkingCalendar = Pick<Cohort, 'nonWorkingDays'>;

/** When a pattern is worth surfacing to a coach. */
export const PATTERN_THRESHOLDS = { absenceStreak: 2, latesThisWeek: 2 } as const;

/** Safety bound for the backwards walk (≈ 3 months of working days). */
const MAX_LOOKBACK_DAYS = 120;

/**
 * Consecutive `A` days ending at `today`, walking back over working days only.
 * - Today: `A` extends the streak, `P`/`L` ends it (0), unmarked or `E` neither counts nor breaks it.
 * - `E` is neutral, consistent with the metrics: it is skipped, neither extending nor breaking the streak.
 * - `P`, `L`, or a working day with no record ends the streak.
 */
export function absenceStreak(marks: MarksByDate, today: IsoDate, calendar: WorkingCalendar): number {
  const todayStatus = marks.get(today);
  if (todayStatus === 'P' || todayStatus === 'L') return 0; // they showed up: the streak is over
  let streak = todayStatus === 'A' ? 1 : 0;
  for (let i = 1; i <= MAX_LOOKBACK_DAYS; i++) {
    const day = addDays(today, -i);
    if (!isWorkingDay(calendar, day)) continue;
    const status = marks.get(day);
    if (status === 'A') streak += 1;
    else if (status === 'E') continue;
    else break;
  }
  return streak;
}

/** Number of `L` marks from Monday of `today`'s week through `today` (inclusive). */
export function latesThisWeek(marks: MarksByDate, today: IsoDate): number {
  let count = 0;
  for (let day = startOfWeek(today); day <= today; day = addDays(day, 1)) {
    if (marks.get(day) === 'L') count += 1;
  }
  return count;
}

export interface AttendancePattern {
  readonly absenceStreak: number;
  readonly latesThisWeek: number;
}

export function detectPattern(marks: MarksByDate, today: IsoDate, calendar: WorkingCalendar): AttendancePattern {
  return { absenceStreak: absenceStreak(marks, today, calendar), latesThisWeek: latesThisWeek(marks, today) };
}

export function isNotablePattern(p: AttendancePattern): boolean {
  return p.absenceStreak >= PATTERN_THRESHOLDS.absenceStreak || p.latesThisWeek >= PATTERN_THRESHOLDS.latesThisWeek;
}
