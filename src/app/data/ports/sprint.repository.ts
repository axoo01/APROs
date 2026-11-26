import type { Observable } from 'rxjs';
import type { Id, SprintMark, UpsertSprintInput } from '../../domain';

/** Persistence port for Phase 2 sprint marks (admin-only writes). See `user.repository.ts` for the port contract. */
export abstract class SprintRepository {
  abstract watchByCohort(cohortId: Id): Observable<readonly SprintMark[]>;
  /** Insert or replace the single mark for (apprentice, sprint). */
  abstract upsert(input: UpsertSprintInput): Observable<SprintMark>;
}
