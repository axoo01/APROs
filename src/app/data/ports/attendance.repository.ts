import type { Observable } from 'rxjs';
import type { AttendanceRecord, Id, IsoDate, UpsertAttendanceInput } from '../../domain';

/** Persistence port for daily attendance. See `user.repository.ts` for the port contract. */
export abstract class AttendanceRepository {
  abstract watchByCohort(cohortId: Id): Observable<readonly AttendanceRecord[]>;
  abstract watchByCohortOnDate(cohortId: Id, date: IsoDate): Observable<readonly AttendanceRecord[]>;
  /** Insert or replace the single record for (apprentice, date). */
  abstract upsert(input: UpsertAttendanceInput): Observable<AttendanceRecord>;
  /** Atomic batch upsert (e.g. "Mark remaining as Absent"). */
  abstract upsertMany(inputs: readonly UpsertAttendanceInput[]): Observable<readonly AttendanceRecord[]>;
  /** Removes the day's record → apprentice returns to "Not Here Yet" (used by undo). */
  abstract clear(apprenticeId: Id, date: IsoDate): Observable<void>;
  /** Atomic batch clear (e.g. undoing "Mark remaining as Absent"). */
  abstract clearMany(apprenticeIds: readonly Id[], date: IsoDate): Observable<void>;
}
