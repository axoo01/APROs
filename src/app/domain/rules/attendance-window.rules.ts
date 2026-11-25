import type { Cohort, IsoDate } from '../models';
import { addDays, startOfWeek } from '../utils/date.util';
import { isWorkingDay } from './working-days.rules';

/** Time scopes for the attendance log. */
export const LOG_PRESETS = ['THIS_WEEK', 'LAST_WEEK', 'LAST_30_DAYS', 'DAY'] as const;
export type LogPreset = (typeof LOG_PRESETS)[number];

/** Inclusive calendar range; callers intersect it with working days and the cohort's dates. */
export interface DateWindow {
  readonly start: IsoDate;
  readonly end: IsoDate;
}

type WorkingCalendar = Pick<Cohort, 'nonWorkingDays'>;

const MAX_LOOKBACK_DAYS = 31;

/** Nearest working day strictly before `date` (falls back to the day before if none within a month). */
export function previousWorkingDay(calendar: WorkingCalendar, date: IsoDate): IsoDate {
  for (let i = 1; i <= MAX_LOOKBACK_DAYS; i++) {
    const d = addDays(date, -i);
    if (isWorkingDay(calendar, d)) return d;
  }
  return addDays(date, -1);
}

/** Nearest working day strictly after `date` (falls back to the next day if none within a month). */
export function nextWorkingDay(calendar: WorkingCalendar, date: IsoDate): IsoDate {
  for (let i = 1; i <= MAX_LOOKBACK_DAYS; i++) {
    const d = addDays(date, i);
    if (isWorkingDay(calendar, d)) return d;
  }
  return addDays(date, 1);
}

/**
 * - `THIS_WEEK`: Monday → today · `LAST_WEEK`: previous Mon → Fri
 * - `LAST_30_DAYS`: today − 29 → today · `DAY`: the chosen day
 */
export function resolveLogWindow(preset: LogPreset, today: IsoDate, day: IsoDate): DateWindow {
  switch (preset) {
    case 'THIS_WEEK':
      return { start: startOfWeek(today), end: today };
    case 'LAST_WEEK': {
      const start = addDays(startOfWeek(today), -7);
      return { start, end: addDays(start, 4) };
    }
    case 'LAST_30_DAYS':
      return { start: addDays(today, -29), end: today };
    case 'DAY':
      return { start: day, end: day };
  }
}

/** The comparison period for KPI deltas: same shape, immediately before (a single day compares to the previous working day). */
export function priorLogWindow(preset: LogPreset, window: DateWindow, calendar: WorkingCalendar): DateWindow {
  switch (preset) {
    case 'THIS_WEEK':
    case 'LAST_WEEK':
      return { start: addDays(window.start, -7), end: addDays(window.end, -7) };
    case 'LAST_30_DAYS':
      return { start: addDays(window.start, -30), end: addDays(window.end, -30) };
    case 'DAY': {
      const prev = previousWorkingDay(calendar, window.start);
      return { start: prev, end: prev };
    }
  }
}
