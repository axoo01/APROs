import { PATTERN_THRESHOLDS, type AttendancePattern } from '../../domain';
import type { IconName } from '../../shared/components/icon/icon.component';

export interface PatternFlag {
  readonly key: 'absent' | 'late';
  /** Compact pill text, e.g. "3d absent". */
  readonly label: string;
  /** Sentence for tooltips, screen readers and the status drawer. */
  readonly description: string;
  readonly icon: IconName;
  readonly tone: string;
}

/** Recurring-pattern flags (thresholds live in the domain) — shared by the card pill and the status drawer. */
export function patternFlags(pattern: AttendancePattern | null | undefined): readonly PatternFlag[] {
  if (!pattern) return [];
  const flags: PatternFlag[] = [];
  if (pattern.absenceStreak >= PATTERN_THRESHOLDS.absenceStreak) {
    flags.push({
      key: 'absent',
      label: `${pattern.absenceStreak}d absent`,
      description: `Absent ${pattern.absenceStreak} working days in a row`,
      icon: 'alert',
      tone: 'bg-status-a-soft text-status-a ring-status-a/35',
    });
  }
  if (pattern.latesThisWeek >= PATTERN_THRESHOLDS.latesThisWeek) {
    flags.push({
      key: 'late',
      label: `${pattern.latesThisWeek}× late this wk`,
      description: `Late ${pattern.latesThisWeek} times this week`,
      icon: 'clock',
      tone: 'bg-status-l-soft text-warning ring-status-l/50',
    });
  }
  return flags;
}
