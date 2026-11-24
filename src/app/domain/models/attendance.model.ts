import type { Auditable, Id, IsoDate, IsoDateTime } from './common.model';

/** `P` present on time · `L` late · `A` absent · `E` excused (late or absence). */
export const ATTENDANCE_STATUSES = ['P', 'L', 'A', 'E'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_REASONS = [
  'TRAFFIC',
  'TRANSPORT',
  'SICK',
  'FAMILY',
  'APPOINTMENT',
  'OTHER',
] as const;
export type AttendanceReason = (typeof ATTENDANCE_REASONS)[number];

export interface AttendanceRecord extends Auditable {
  /** Deterministic: `${apprenticeId}:${date}` — guarantees one record per apprentice per day. */
  readonly id: Id;
  readonly apprenticeId: Id;
  /** Denormalized for cohort/day queries. */
  readonly cohortId: Id;
  readonly date: IsoDate;
  readonly status: AttendanceStatus;
  readonly reason: AttendanceReason | null;
  readonly note: string | null;
  readonly recordedBy: Id;
  readonly recordedAt: IsoDateTime;
}

export interface UpsertAttendanceInput {
  readonly apprenticeId: Id;
  readonly date: IsoDate;
  readonly status: AttendanceStatus;
  readonly reason?: AttendanceReason | null;
  readonly note?: string | null;
}

export function attendanceId(apprenticeId: Id, date: IsoDate): Id {
  return `${apprenticeId}:${date}`;
}
