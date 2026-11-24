import type { Observable } from 'rxjs';
import type { User } from '../../domain';

/**
 * Persistence port for staff users. Components/facades depend on this abstract class (DI token), never an adapter.
 * Contract (all ports): `watch*()` emits immediately + on change; commands are cold, emit once, error with a DomainError.
 */
export abstract class UserRepository {
  abstract watchAll(): Observable<readonly User[]>;
  abstract findByEmail(email: string): Observable<User | null>;
}
