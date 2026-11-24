import type { Cohort, IsoDate } from '../models';
import { eachDay, isWeekend } from '../utils/date.util';

type WorkingCalendar = Pick<Cohort, 'nonWorkingDays'>;

export type NonWorkingReason = 'WEEKEND' | 'HOLIDAY';

export function nonWorkingReason(cohort: WorkingCalendar, date: IsoDate): NonWorkingReason | null {
  if (isWeekend(date)) return 'WEEKEND';
  if (cohort.nonWorkingDays.includes(date)) return 'HOLIDAY';
  return null;
}

export function isWorkingDay(cohort: WorkingCalendar, date: IsoDate): boolean {
  return nonWorkingReason(cohort, date) === null;
}

export function workingDaysBetween(cohort: WorkingCalendar, start: IsoDate, end: IsoDate): IsoDate[] {
  const holidays = new Set(cohort.nonWorkingDays);
  return eachDay(start, end).filter((d) => !isWeekend(d) && !holidays.has(d));
}

export interface AttendanceDatePolicy {
  /** Demo Mode allows recording on any date so the product can be pitched any day. */
  readonly demoMode: boolean;
}

export type AttendanceDateCheck =
  | { readonly allowed: true; readonly warning: NonWorkingReason | null }
  | { readonly allowed: false; readonly reason: NonWorkingReason };

/** In production non-working days are blocked; in Demo Mode they're allowed with a warning. */
export function checkAttendanceDate(
  cohort: WorkingCalendar,
  date: IsoDate,
  policy: AttendanceDatePolicy,
): AttendanceDateCheck {
  const reason = nonWorkingReason(cohort, date);
  if (reason === null) return { allowed: true, warning: null };
  return policy.demoMode ? { allowed: true, warning: reason } : { allowed: false, reason };
}
