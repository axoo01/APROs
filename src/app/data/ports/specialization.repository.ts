import type { Observable } from 'rxjs';
import type { Specialization } from '../../domain';

/** Persistence port for specializations (tracks). See `user.repository.ts` for the port contract. */
export abstract class SpecializationRepository {
  abstract watchAll(): Observable<readonly Specialization[]>;
}
