import type { Observable } from 'rxjs';
import type { Cohort, CreateCohortInput, Id, UpdateCohortInput } from '../../domain';

/** Persistence port for cohorts. See `user.repository.ts` for the port contract. */
export abstract class CohortRepository {
  /** Newest first (by `phase1StartDate`). */
  abstract watchAll(): Observable<readonly Cohort[]>;
  abstract create(input: CreateCohortInput): Observable<Cohort>;
  abstract update(id: Id, patch: UpdateCohortInput): Observable<Cohort>;
}
