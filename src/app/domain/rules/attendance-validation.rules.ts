import {
  ATTENDANCE_REASONS,
  ATTENDANCE_STATUSES,
  type AttendanceReason,
  type AttendanceStatus,
  type UpsertAttendanceInput,
} from '../models';
import { isIsoDate } from '../utils/date.util';

export const NOTE_MAX_LENGTH = 280;

export interface NormalizedAttendanceInput {
  readonly status: AttendanceStatus;
  readonly reason: AttendanceReason | null;
  readonly note: string | null;
}

/**
 * Validates and normalizes an attendance write:
 * - `E` (excused) requires a reason — excusing must be justified.
 * - `P` never carries a reason (cleared).
 * - Notes are trimmed; empty → null.
 */
export function normalizeAttendanceInput(
  input: UpsertAttendanceInput,
): { ok: true; value: NormalizedAttendanceInput } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (!isIsoDate(input.date)) issues.push('Date must be a valid YYYY-MM-DD date.');
  if (!ATTENDANCE_STATUSES.includes(input.status)) issues.push(`Unknown status "${input.status}".`);

  const reason = input.status === 'P' ? null : (input.reason ?? null);
  if (reason !== null && !ATTENDANCE_REASONS.includes(reason)) issues.push(`Unknown reason "${reason}".`);
  if (input.status === 'E' && reason === null) issues.push('Excused (E) requires a reason.');

  const note = input.note?.trim() || null;
  if (note && note.length > NOTE_MAX_LENGTH) issues.push(`Note must be ${NOTE_MAX_LENGTH} characters or fewer.`);

  return issues.length ? { ok: false, issues } : { ok: true, value: { status: input.status, reason, note } };
}
