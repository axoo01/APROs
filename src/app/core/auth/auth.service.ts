import type { Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Id, IsoDateTime, Role } from '../../domain';
import type { Actor } from '../../data/ports/actor-context.port';

/** Shape mirrors the claims a JWT from the future Spring Boot auth server will carry. */
export interface Session {
  readonly userId: Id;
  readonly role: Role;
  readonly fullName: string;
  readonly email: string;
  readonly startedAt: IsoDateTime;
}

/** Authentication port. The demo implementation signs in by email/persona; production will use SSO/JWT. */
export abstract class AuthService {
  abstract readonly session: Signal<Session | null>;
  abstract readonly isAuthenticated: Signal<boolean>;
  abstract readonly role: Signal<Role | null>;

  abstract loginWithEmail(email: string): Observable<Session>;
  /** Demo Mode only. */
  abstract loginAsPersona(role: Role): Observable<Session>;
  /** Demo Mode only: hop to the other role's persona without leaving the current screen. */
  abstract switchRole(role: Role): Observable<Session>;
  abstract logout(): void;
  abstract actor(): Actor | null;
}
