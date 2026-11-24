import type { Observable } from 'rxjs';
import type { Apprentice, Id } from '../../domain';

/** Persistence port for apprentices. See `user.repository.ts` for the port contract. */
export abstract class ApprenticeRepository {
  abstract watchByCohort(cohortId: Id): Observable<readonly Apprentice[]>;
  abstract assignCoach(apprenticeId: Id, coachId: Id | null): Observable<Apprentice>;
}
