import type { Observable } from 'rxjs';
import type { Id, IsoDate, UpsertBehaviorInput, WeeklyBehaviorRecord } from '../../domain';

/** Persistence port for weekly behavior ratings. See `user.repository.ts` for the port contract. */
export abstract class BehaviorRepository {
  abstract watchByCohort(cohortId: Id): Observable<readonly WeeklyBehaviorRecord[]>;
  /** Atomic batch upsert (single rating or "Mark remaining as +M"). */
  abstract upsertMany(inputs: readonly UpsertBehaviorInput[]): Observable<readonly WeeklyBehaviorRecord[]>;
  /** Atomic batch removal → apprentices return to "Unrated" for that week (used by undo). */
  abstract clearMany(apprenticeIds: readonly Id[], weekStart: IsoDate): Observable<void>;
}
