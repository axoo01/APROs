import type { Observable } from 'rxjs';
import type { EodPacingRecord, Id, IsoDate, UpsertEodInput } from '../../domain';

/** Persistence port for end-of-day pacing. See `user.repository.ts` for the port contract. */
export abstract class EodRepository {
  abstract watchByCohort(cohortId: Id): Observable<readonly EodPacingRecord[]>;
  /** Insert or replace the single record for (apprentice, date). */
  abstract upsert(input: UpsertEodInput): Observable<EodPacingRecord>;
  /** Atomic batch upsert (e.g. "Mark remaining as On Pace"). */
  abstract upsertMany(inputs: readonly UpsertEodInput[]): Observable<readonly EodPacingRecord[]>;
  /** Atomic batch removal → apprentices return to "Not Logged" (used by undo). */
  abstract clearMany(apprenticeIds: readonly Id[], date: IsoDate): Observable<void>;
}
