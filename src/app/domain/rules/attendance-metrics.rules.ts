import type { AttendanceStatus } from '../models';

export interface AttendanceTally {
  readonly P: number;
  readonly L: number;
  readonly A: number;
  readonly E: number;
  readonly total: number;
}

export const EMPTY_TALLY: AttendanceTally = { P: 0, L: 0, A: 0, E: 0, total: 0 };

export function tallyAttendance(records: Iterable<{ readonly status: AttendanceStatus }>): AttendanceTally {
  const t = { P: 0, L: 0, A: 0, E: 0, total: 0 };
  for (const r of records) {
    t[r.status] += 1;
    t.total += 1;
  }
  return t;
}

/**
 * Attendance Rate = (P + L) / (P + L + A).
 * `E` is a neutral, non-penalizing day: excluded from the denominator. 100% when nothing is penalizable.
 */
export function attendanceRate(t: AttendanceTally): number {
  const denominator = t.P + t.L + t.A;
  return denominator === 0 ? 1 : (t.P + t.L) / denominator;
}

/**
 * Punctuality Rate = P / (P + L).
 * `E` is neutral (excluded). 100% when the apprentice was never physically present.
 */
export function punctualityRate(t: AttendanceTally): number {
  const denominator = t.P + t.L;
  return denominator === 0 ? 1 : t.P / denominator;
}

export interface AttendanceSummary extends AttendanceTally {
  readonly attendanceRate: number;
  readonly punctualityRate: number;
}

export function summarizeAttendance(records: Iterable<{ readonly status: AttendanceStatus }>): AttendanceSummary {
  const t = tallyAttendance(records);
  return { ...t, attendanceRate: attendanceRate(t), punctualityRate: punctualityRate(t) };
}

/** The three Sweep buckets. "Not Here Yet" = no record for the day (never implied Absent). */
export type AttendanceBucket = 'NOT_HERE_YET' | 'PRESENT' | 'ABSENT_EXCUSED';

export function bucketOf(status: AttendanceStatus | null | undefined): AttendanceBucket {
  switch (status) {
    case 'P':
    case 'L':
      return 'PRESENT';
    case 'A':
    case 'E':
      return 'ABSENT_EXCUSED';
    default:
      return 'NOT_HERE_YET';
  }
}

export const BUCKET_LABELS: Readonly<Record<AttendanceBucket, string>> = {
  NOT_HERE_YET: 'Not Here Yet',
  PRESENT: 'Present',
  ABSENT_EXCUSED: 'Absent / Excused',
};

export const STATUS_LABELS: Readonly<Record<AttendanceStatus, string>> = {
  P: 'Present',
  L: 'Late',
  A: 'Absent',
  E: 'Excused',
};
