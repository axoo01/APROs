import { EOD_STATUSES, EOD_TAGS, type Cohort, type EodMark, type EodStatus, type IsoDate, type UpsertEodInput } from '../models';
import { addDays, isIsoDate } from '../utils/date.util';
import { NOTE_MAX_LENGTH } from './attendance-validation.rules';
import { isWorkingDay } from './working-days.rules';

type WorkingCalendar = Pick<Cohort, 'nonWorkingDays'>;

/** Streak length at which a card shows a "behind" pill. */
export const EOD_BEHIND_THRESHOLD = 2;
const MAX_LOOKBACK_DAYS = 120;

export const isBehind = (status: EodStatus | null | undefined): boolean =>
  status === 'NEEDS_SUPPORT' || status === 'BLOCKED';

/** Validates and normalizes an EOD write: known status/tag, trimmed note (empty → null), note length. */
export function normalizeEodInput(input: UpsertEodInput): { ok: true; value: EodMark } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (!isIsoDate(input.date)) issues.push('Date must be a valid YYYY-MM-DD date.');
  if (!EOD_STATUSES.includes(input.status)) issues.push(`Unknown EOD status "${input.status}".`);
  const tag = input.tag ?? null;
  if (tag !== null && !EOD_TAGS.includes(tag)) issues.push(`Unknown EOD tag "${tag}".`);
  const note = input.note?.trim() || null;
  if (note && note.length > NOTE_MAX_LENGTH) issues.push(`Note must be ${NOTE_MAX_LENGTH} characters or fewer.`);
  return issues.length ? { ok: false, issues } : { ok: true, value: { status: input.status, tag, note } };
}

/**
 * Consecutive working days rated Needs Support / Blocked, ending today.
 * Today: behind extends, On Pace ends it (0), unrated neither counts nor breaks.
 * Earlier days: On Pace or no rating (e.g. absent) ends the streak.
 */
export function behindStreak(
  marks: { get(date: IsoDate): EodStatus | undefined },
  today: IsoDate,
  calendar: WorkingCalendar,
): number {
  const todayStatus = marks.get(today);
  if (todayStatus === 'ON_PACE') return 0;
  let streak = isBehind(todayStatus) ? 1 : 0;
  for (let i = 1; i <= MAX_LOOKBACK_DAYS; i++) {
    const day = addDays(today, -i);
    if (!isWorkingDay(calendar, day)) continue;
    if (isBehind(marks.get(day))) streak += 1;
    else break;
  }
  return streak;
}

export interface EodTally {
  readonly ON_PACE: number;
  readonly NEEDS_SUPPORT: number;
  readonly BLOCKED: number;
  readonly total: number;
}

export function tallyEod(records: Iterable<{ readonly status: EodStatus }>): EodTally {
  const t = { ON_PACE: 0, NEEDS_SUPPORT: 0, BLOCKED: 0, total: 0 };
  for (const r of records) {
    t[r.status] += 1;
    t.total += 1;
  }
  return t;
}

/**
 * Longest run of consecutive Needs Support / Blocked days in an ordered list of working-day statuses
 * (`null` = unrated, which breaks a run). A run ≥ {@link EOD_BEHIND_THRESHOLD} marks someone "behind" in a log window.
 */
export function longestBehindRun(statuses: readonly (EodStatus | null | undefined)[]): number {
  let best = 0;
  let run = 0;
  for (const s of statuses) {
    run = isBehind(s) ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/** Share of rated days that were On Pace (100% when nothing is rated). */
export function onPaceRate(t: EodTally): number {
  return t.total === 0 ? 1 : t.ON_PACE / t.total;
}
